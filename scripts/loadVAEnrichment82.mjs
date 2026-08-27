/**
 * Phase 82 — Virginia Enrichment Parity loader (inline-authored, $0; NO paid API path).
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for the FIXED Virginia
 * function/activity/source vocabulary loaded in Phases 80–81. Virginia's taxonomy is standardized
 * statewide by the APA Comparative Report, so this is an EXPLICIT hand-authored map
 * (data/vaEnrichment82.mjs) keyed by exact name_key — one accurate row per key — with a
 * 100% COVERAGE GATE instead of Phase 72's heuristic router/fallback: the loader derives the live
 * worklist and ABORTS if any live VA key is missing from the map (no silent fallback).
 *
 * Every row is generic, entity- AND state-neutral, and bleed-safe (no locality names, no $ figures).
 * Two guards run before any write: a $-leak guard and a locality-name guard (against the live VA
 * municipalities.name list). Writes use DELETE-THEN-INSERT over the authored keys — the
 * (name_key, municipality_id) index is NULLS DISTINCT, so upsert would INSERT duplicate universal
 * rows; delete-then-insert is the only idempotent + overwrite-correct path (see memory
 * category-enrichment-nulls-distinct; reference impl scripts/loadUtahEnrichment72.mjs). This
 * intentionally OVERWRITES the 7 shared universal keys with improved state-neutral text (D-82-03),
 * notably correcting the stale `miscellaneous`→"Information Technology" row.
 *
 * The enrichment name_key equals budget_categories.link_key (depth-0 plain; depth-1 `parent|child`
 * composite) — matching scripts/enrichCategories.js and the two-tier join the app/API reads
 * (city-scoped row first, then NULL universal).
 *
 * Usage:
 *   node scripts/loadVAEnrichment82.mjs            # dry-run: derive worklist + assert coverage, NO DB write
 *   node scripts/loadVAEnrichment82.mjs --apply    # delete-then-insert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { VA_ENRICHMENT, EXPECTED_KEYS } from '../data/vaEnrichment82.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}

const GENERATED_AT = process.env.PHASE82_TS || '2026-06-23T00:00:00.000Z';

const EVIDENCE = 'Inline-authored plain-language description for a standardized Virginia budget category (Phase 82, VA parity). Virginia\'s function/activity/revenue vocabulary is fixed statewide by the APA Comparative Report, so each name maps to one hand-written concept. Generic, entity- and state-neutral, and bleed-safe — not specific to any locality.';

// Locality names that are also common English words (or the legitimate state-node name) — excluded
// from the locality-name guard so generic civic text + state-node descriptions don't false-positive.
const GUARD_NAME_SKIP = new Set(['virginia', 'orange', 'marion', 'wise', 'bland', 'broadway', 'stanley']);

function buildRow(nameKey) {
  const c = VA_ENRICHMENT[nameKey];
  return {
    name_key: nameKey,
    municipality_id: null,
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

/**
 * Pure: resolve a list of live link_keys against VA_ENRICHMENT.
 * Returns { rows, missing } — `missing` = live keys with no map entry (coverage gap).
 * Exported for offline tests (no DB access).
 */
export function buildRows(liveKeys) {
  const rows = [];
  const missing = [];
  const seen = new Set();
  for (const key of liveKeys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!VA_ENRICHMENT[key]) { missing.push(key); continue; }
    rows.push(buildRow(key));
  }
  return { rows, missing };
}

/** Pure: rows whose authored text contains a `$<digit>` figure. */
export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(`${r.plain_name} ${r.short_description} ${r.description}`));
}

/**
 * Pure: rows whose authored text contains a VA locality name (word-boundary, case-insensitive),
 * excluding GUARD_NAME_SKIP (the state-node "Virginia" + common-English-word town names).
 * Returns [{ name_key, leaked }].
 */
export function findLocalityLeaks(rows, localityNames) {
  const names = [...new Set((localityNames || []).map(n => (n || '').toLowerCase().trim()))]
    .filter(n => n && !GUARD_NAME_SKIP.has(n));
  const res = [];
  for (const r of rows) {
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

  // 1. VA cohort: all entity types incl. the 'Virginia' state node.
  const { data: munis, error: mErr } = await supabase.from('municipalities').select('id,name,entity_type').eq('state', 'VA');
  if (mErr) { console.error('municipalities fetch error:', mErr.message); process.exit(1); }
  const ids = (munis || []).map(m => m.id);
  const localityNames = (munis || []).map(m => m.name);
  if (!ids.length) { console.error('No VA municipalities found.'); process.exit(1); }

  // 2. All VA budgets → id, grouped by dataset_type.
  let budgets = [];
  for (let i = 0; i < ids.length; i += 30) {
    const { data: bs, error } = await supabase.from('budgets').select('id,dataset_type').in('municipality_id', ids.slice(i, i + 30));
    if (error) { console.error('budgets fetch error:', error.message); process.exit(1); }
    budgets = budgets.concat(bs || []);
  }

  // 3. Distinct live link_keys across operating + revenue, depth 0 and 1 (paginate the 1000-row cap).
  async function collectKeys(datasetTypes, depth) {
    const bids = budgets.filter(b => datasetTypes.includes(b.dataset_type)).map(b => b.id);
    const keys = new Set();
    for (let i = 0; i < bids.length; i += 25) {
      const slice = bids.slice(i, i + 25);
      for (let from = 0; ; from += 1000) {
        const { data: cats, error } = await supabase.from('budget_categories')
          .select('name,link_key').in('budget_id', slice).eq('depth', depth).range(from, from + 999);
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

  const opD0 = await collectKeys(['operating'], 0);
  const opD1 = await collectKeys(['operating'], 1);
  const rvD0 = await collectKeys(['revenue'], 0);
  const rvD1 = await collectKeys(['revenue'], 1);
  const liveKeys = [...new Set([...opD0, ...opD1, ...rvD0, ...rvD1])];

  // 4. Build rows + coverage gate.
  const { rows, missing } = buildRows(liveKeys);
  const stale = EXPECTED_KEYS.filter(k => !liveKeys.includes(k)); // map keys no longer present live (non-fatal)
  const dollarLeaks = findDollarLeaks(rows);
  const localityLeaks = findLocalityLeaks(rows, localityNames);

  console.log('=== Phase 82 Virginia enrichment build (live worklist) ===');
  console.log('VA entities:', ids.length, '| budgets:', budgets.length);
  console.log(`live keys: operating d0=${opD0.size} d1=${opD1.size} | revenue d0=${rvD0.size} d1=${rvD1.size} | total distinct=${liveKeys.length}`);
  console.log('map size (EXPECTED_KEYS):', EXPECTED_KEYS.length);
  console.log('rows to author:', rows.length);
  console.log('MISSING coverage (live key not in map, must be 0):', missing.length, missing.length ? '\n  ' + missing.join('\n  ') : '');
  console.log('stale map keys (in map, not live — non-fatal):', stale.length, stale.length ? '(' + stale.join(', ') + ')' : '');
  console.log('$-leak rows (must be 0):', dollarLeaks.length, dollarLeaks.map(r => r.name_key).join(', '));
  console.log('locality-leak rows (must be 0):', localityLeaks.length, localityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));

  mkdirSync('data', { recursive: true });
  writeFileSync('data/va-enrichment-82.expanded.json', JSON.stringify({
    generated_at: GENERATED_AT, authored: rows.length, missing, stale,
    rows: rows.map(r => ({ name_key: r.name_key, plain_name: r.plain_name, confidence: r.confidence })),
  }, null, 2));
  console.log('Expanded mapping written to data/va-enrichment-82.expanded.json');

  if (missing.length) { console.error(`ABORT: ${missing.length} live VA key(s) have no enrichment in the map (no fallback — add them to data/vaEnrichment82.mjs).`); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
  if (localityLeaks.length) { console.error('ABORT: VA locality name leak detected in authored text'); process.exit(1); }

  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to write.'); process.exit(0); }

  // Delete-then-insert over the authored keys (NULLS DISTINCT — see file header).
  const keysToWrite = [...new Set(rows.map(r => r.name_key))];
  let deleted = 0;
  for (let i = 0; i < keysToWrite.length; i += 100) {
    const chunk = keysToWrite.slice(i, i + 100);
    const { error } = await supabase.from('category_enrichment').delete().is('municipality_id', null).in('name_key', chunk);
    if (error) { console.error('delete error:', error.message); process.exit(1); }
    deleted += chunk.length;
    process.stdout.write(`\r  cleared ${deleted}/${keysToWrite.length} keys`);
  }
  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from('category_enrichment').insert(batch);
    if (error) { console.error('insert error:', error.message); process.exit(1); }
    written += batch.length;
    process.stdout.write(`\r  inserted ${written}/${rows.length}`);
  }
  console.log(`\nDone. Wrote ${written} universal category_enrichment rows (delete-then-insert over ${keysToWrite.length} keys).`);
}

// Run only when executed as the entry script (so tests can import the pure helpers without hitting the DB).
const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadVAEnrichment82.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
