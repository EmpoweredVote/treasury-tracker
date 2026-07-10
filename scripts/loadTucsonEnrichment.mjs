#!/usr/bin/env node
/**
 * Phase 129 Plan 03 — Tucson category enrichment loader (inline-authored, $0; NO paid API path).
 *
 * Bleed-safe category_enrichment for every GF category Tucson loaded in Plan 129-02. The worklist
 * is derived LIVE from production — Tucson's loaded `budgets` (operating + revenue, all FYs) ->
 * their `budget_categories` (depth 0 AND depth 1, so both icicle parents like Current/Debt service
 * and any stored function/source leaves are covered) -> the distinct set of `link_key` (fallback
 * lowercased trimmed `name`) — not a guessed label list, so coverage is provably 100% of what
 * actually loaded. Modeled on scripts/loadVAEnrichment82.mjs (explicit map + 100% coverage gate +
 * delete-then-insert NULLS-DISTINCT-safe universal writes).
 *
 * Two scopes, resolved per key from data/tucsonEnrichment129.mjs (TUCSON_ENRICHMENT):
 *   - universal   (municipality_id = NULL)      — generic, shareable GAAP/CAFR concept.
 *   - tucson      (municipality_id = <Tucson>)  — era-specific / ambiguous printed-statement quirk.
 * A live key already covered by a PRE-EXISTING category_enrichment row (universal from an earlier
 * loader, e.g. CA-parity/MN/Ohio, or a prior Tucson-scoped row) does NOT need a map entry — the
 * coverage gate checks the live DB first and only consults the map for keys not already covered.
 *
 * Write discipline: universal rows are DELETE-THEN-INSERT over the exact keys this run authors
 * (the (name_key, municipality_id) index is NULLS DISTINCT — upsert would insert duplicate
 * universal rows). Tucson-scoped rows use upsert on (name_key, municipality_id), which is safe
 * (municipality_id is a real, non-null value there). Idempotent: a second --apply nets 0 new rows.
 *
 * Guards before any write: a $-figure leak guard (all authored rows) and an AZ locality-name leak
 * guard (universal rows only — a universal row must never carry Tucson/Pima/other-AZ-city text).
 *
 * Usage:
 *   node scripts/loadTucsonEnrichment.mjs            # dry-run: derive worklist + assert coverage, NO DB write
 *   node scripts/loadTucsonEnrichment.mjs --apply    # write universal (delete-then-insert) + Tucson-scoped (upsert) rows
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { TUCSON_ENRICHMENT, EXPECTED_KEYS } from '../data/tucsonEnrichment129.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}

const GENERATED_AT = process.env.PHASE129_TS || new Date().toISOString();

const EVIDENCE = 'Inline-authored plain-language description for a Tucson, AZ General Fund budget category (Phase 129, Plan 03). Generic GAAP/CAFR concepts are shared as universal rows (bleed-safe, no city text); era-specific/ambiguous printed-statement labels are scoped to Tucson\'s municipality_id.';

function buildRow(nameKey, scope, tucsonId) {
  const c = TUCSON_ENRICHMENT[nameKey];
  return {
    name_key: nameKey,
    municipality_id: scope === 'universal' ? null : tucsonId,
    plain_name: c.plain_name,
    short_description: c.short_description,
    description: c.description,
    tags: c.tags,
    source: 'ai',
    confidence: c.confidence,
    evidence_summary: EVIDENCE,
    generated_at: GENERATED_AT,
  };
}

/** Pure: rows whose authored text contains a `$<digit>` figure. */
export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(`${r.plain_name} ${r.short_description} ${r.description}`));
}

/** Pure: universal rows whose authored text contains an AZ locality name (word-boundary, case-insensitive). */
export function findLocalityLeaks(rows, localityNames) {
  const names = [...new Set((localityNames || []).map(n => (n || '').toLowerCase().trim()))].filter(Boolean);
  const res = [];
  for (const r of rows.filter(r => r.municipality_id === null)) {
    const text = `${r.plain_name} ${r.short_description} ${r.description}`.toLowerCase();
    for (const n of names) {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (re.test(text)) { res.push({ name_key: r.name_key, leaked: n }); break; }
    }
  }
  return res;
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or service key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY).'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  // 1. Resolve Tucson's municipality_id.
  const { data: tucson, error: tErr } = await supabase.from('municipalities').select('id,name,state').eq('name', 'Tucson').eq('state', 'AZ').eq('entity_type', 'city').maybeSingle();
  if (tErr || !tucson) { console.error('Tucson, AZ municipality not found:', tErr?.message); process.exit(1); }
  const tucsonId = tucson.id;

  // 2. AZ locality names (for the universal-row bleed guard).
  const { data: azMunis } = await supabase.from('municipalities').select('name').eq('state', 'AZ');
  const localityNames = (azMunis || []).map(m => m.name);

  // 3. Tucson's loaded budgets (op + rev, all FYs).
  const { data: budgets, error: bErr } = await supabase.from('budgets').select('id,dataset_type').eq('municipality_id', tucsonId).in('dataset_type', ['operating', 'revenue']);
  if (bErr) { console.error('budgets fetch error:', bErr.message); process.exit(1); }
  const bids = (budgets || []).map(b => b.id);
  if (!bids.length) { console.error('No Tucson operating/revenue budgets found — run 129-02 first.'); process.exit(1); }

  // 4. Distinct live link_keys across depth 0 and depth 1 (paginate past the 1000-row cap).
  async function collectKeys(depth) {
    const keys = new Set();
    for (let i = 0; i < bids.length; i += 25) {
      const slice = bids.slice(i, i + 25);
      for (let from = 0; ; from += 1000) {
        const { data: cats, error } = await supabase.from('budget_categories').select('name,link_key').in('budget_id', slice).eq('depth', depth).range(from, from + 999);
        if (error) { console.error('budget_categories fetch error:', error.message); process.exit(1); }
        for (const c of (cats || [])) {
          const k = (c.link_key || (c.name || '').toLowerCase().trim());
          if (k) keys.add(k);
        }
        if (!cats || cats.length < 1000) break;
      }
    }
    return keys;
  }
  const d0 = await collectKeys(0);
  const d1 = await collectKeys(1);
  const liveKeys = [...new Set([...d0, ...d1])].sort();

  // 5. Existing coverage (universal OR Tucson-scoped) for the live keys.
  const { data: existing, error: eErr } = await supabase.from('category_enrichment').select('name_key,municipality_id').in('name_key', liveKeys).or(`municipality_id.eq.${tucsonId},municipality_id.is.null`);
  if (eErr) { console.error('category_enrichment fetch error:', eErr.message); process.exit(1); }
  const existingKeys = new Set((existing || []).map(e => e.name_key));

  // 6. For live keys not already covered, resolve scope from the map. Missing -> coverage gap.
  const toAuthor = [];
  const missing = [];
  for (const key of liveKeys) {
    if (existingKeys.has(key)) continue; // already covered — no write needed
    if (!TUCSON_ENRICHMENT[key]) { missing.push(key); continue; }
    toAuthor.push(key);
  }
  const stale = EXPECTED_KEYS.filter(k => !liveKeys.includes(k)); // map keys no longer live (non-fatal)

  const rows = toAuthor.map(key => buildRow(key, TUCSON_ENRICHMENT[key].scope, tucsonId));
  const dollarLeaks = findDollarLeaks(rows);
  const localityLeaks = findLocalityLeaks(rows, localityNames);

  const covered = liveKeys.length - missing.length;
  console.log('=== Phase 129-03 Tucson enrichment build (live worklist) ===');
  console.log('Tucson municipality_id:', tucsonId);
  console.log('Tucson operating+revenue budgets:', bids.length);
  console.log(`live keys: depth0=${d0.size} depth1=${d1.size} | total distinct=${liveKeys.length}`);
  console.log('already covered (pre-existing universal or Tucson-scoped row):', liveKeys.length - toAuthor.length - missing.length);
  console.log('to author this run:', rows.length, `(universal=${rows.filter(r => r.municipality_id === null).length}, tucson-scoped=${rows.filter(r => r.municipality_id !== null).length})`);
  console.log('stale map keys (in map, not live — non-fatal):', stale.length, stale.length ? '(' + stale.join(', ') + ')' : '');
  console.log(`coverage: ${covered}/${liveKeys.length}`);
  console.log('\n--- mapping (key -> scope -> text preview) ---');
  for (const key of liveKeys) {
    if (existingKeys.has(key)) { console.log(`  [covered]   ${key}`); continue; }
    if (missing.includes(key)) { console.log(`  [MISSING]   ${key}`); continue; }
    const c = TUCSON_ENRICHMENT[key];
    console.log(`  [${c.scope}] ${key} -> "${c.plain_name}" — ${c.short_description}`);
  }
  console.log('\nMISSING coverage (live key not covered and not in map, must be 0):', missing.length, missing.length ? '\n  ' + missing.join('\n  ') : '');
  console.log('$-leak rows (must be 0):', dollarLeaks.length, dollarLeaks.map(r => r.name_key).join(', '));
  console.log('AZ locality-leak rows in universal text (must be 0):', localityLeaks.length, localityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));

  mkdirSync('data', { recursive: true });
  writeFileSync('data/tucson-enrichment-129.expanded.json', JSON.stringify({
    generated_at: GENERATED_AT, live_keys: liveKeys.length, covered, authored: rows.length, missing, stale,
    rows: rows.map(r => ({ name_key: r.name_key, scope: r.municipality_id === null ? 'universal' : 'tucson', plain_name: r.plain_name })),
  }, null, 2));
  console.log('Expanded mapping written to data/tucson-enrichment-129.expanded.json');

  if (missing.length) { console.error(`ABORT: ${missing.length} live Tucson key(s) have no enrichment coverage and no map entry (add them to data/tucsonEnrichment129.mjs).`); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
  if (localityLeaks.length) { console.error('ABORT: AZ locality-name leak detected in universal-row text'); process.exit(1); }

  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to write.'); process.exit(0); }
  if (!rows.length) { console.log('\nNothing to write — already 100% covered.'); process.exit(0); }

  // Universal rows: delete-then-insert (NULLS DISTINCT — see file header).
  const universalRows = rows.filter(r => r.municipality_id === null);
  const tucsonRows = rows.filter(r => r.municipality_id !== null);

  if (universalRows.length) {
    const keysToWrite = universalRows.map(r => r.name_key);
    for (let i = 0; i < keysToWrite.length; i += 100) {
      const chunk = keysToWrite.slice(i, i + 100);
      const { error } = await supabase.from('category_enrichment').delete().is('municipality_id', null).in('name_key', chunk);
      if (error) { console.error('universal delete error:', error.message); process.exit(1); }
    }
    const { error } = await supabase.from('category_enrichment').insert(universalRows);
    if (error) { console.error('universal insert error:', error.message); process.exit(1); }
    console.log(`Wrote ${universalRows.length} universal row(s) (delete-then-insert).`);
  }

  if (tucsonRows.length) {
    const { error } = await supabase.from('category_enrichment').upsert(tucsonRows, { onConflict: 'name_key,municipality_id' });
    if (error) { console.error('tucson-scoped upsert error:', error.message); process.exit(1); }
    console.log(`Wrote ${tucsonRows.length} Tucson-scoped row(s) (upsert).`);
  }

  console.log(`\nDone. Wrote ${rows.length} category_enrichment row(s) total.`);
}

const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadTucsonEnrichment.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
