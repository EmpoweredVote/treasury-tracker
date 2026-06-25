#!/usr/bin/env node
/**
 * Phase 87 — Ohio Enrichment Parity loader (inline-authored, $0; NO paid API path).
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for the FIXED Ohio
 * category vocabulary loaded in Phases 85–86. Ohio's taxonomy is standardized statewide by
 * the Auditor of State Summarized Annual Financial Reports (GAAP + CASH/MOD bases; cities +
 * counties), so this is an EXPLICIT hand-authored map (data/ohioEnrichment87.mjs) keyed by
 * exact name_key — one accurate row per key — with a 100% COVERAGE GATE instead of a
 * heuristic router/fallback: the loader derives the live worklist and ABORTS if any live OH
 * key is missing from the map (no silent fallback).
 *
 * Every row is generic, entity- AND state-neutral, and bleed-safe (no locality names, no
 * dollar figures). Two guards run before any write: a $-leak guard and a locality-name guard
 * (against the live OH municipalities.name list, with a skip-set for common-English-word
 * names so generic civic text does not false-positive). Writes use DELETE-THEN-INSERT over
 * the authored keys — the (name_key, municipality_id) index is NULLS DISTINCT, so upsert
 * would INSERT duplicate universal rows; delete-then-insert is the only idempotent +
 * overwrite-correct path (see memory reference_category_enrichment_nulls_distinct).
 *
 * Ohio trees are FLAT — all keys are depth-0 plain (no depth-1 parent|child composites).
 *
 * Usage:
 *   node scripts/loadOhioEnrichment87.mjs            # dry-run: derive worklist + assert coverage, NO DB write
 *   node scripts/loadOhioEnrichment87.mjs --apply    # delete-then-insert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { OHIO_ENRICHMENT, EXPECTED_KEYS } from '../data/ohioEnrichment87.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}

const GENERATED_AT = process.env.PHASE87_TS || '2026-06-25T00:00:00.000Z';

const EVIDENCE = 'Inline-authored plain-language description for a standardized Ohio budget category (Phase 87, Ohio parity). Ohio\'s category vocabulary is fixed statewide by the Auditor of State Summarized Annual Financial Reports (GAAP + CASH/MOD bases; cities + counties), so each name maps to one hand-written concept. Generic, entity- and state-neutral, and bleed-safe — not specific to any locality.';

// Locality names that are also common English words — excluded from the locality-name guard
// so generic civic text does not false-positive. Includes the state-node name "ohio" and
// city/county names that are ordinary words in standard descriptions.
const GUARD_NAME_SKIP = new Set([
  'ohio',
  'marion',
  'union',
  'clinton',
  'green',
  'mentor',
  'oberlin',
  'independence',
  'springfield',
  'franklin',
  'lebanon',
  'milford',
  'reading',
  'amherst',
  'seven hills',
  'huber heights',
  // Additional common-word Ohio municipality names
  'heath',
  'kent',
  'grove city',
  'north',
  'plain',
  'grove',
  'heath',
  'jackson',
  'madison',
  'monroe',
  'harrison',
  'hamilton',
  'warren',
  'perry',
  'ross',
  'lake',
  'summit',
  'washington',
  'clark',
  'butler',
  'highland',
  'fairfield',
  'athens',
  'gallia',
]);

function buildRow(nameKey) {
  const c = OHIO_ENRICHMENT[nameKey];
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
 * Pure: resolve a list of live link_keys against OHIO_ENRICHMENT.
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
    if (!OHIO_ENRICHMENT[key]) { missing.push(key); continue; }
    rows.push(buildRow(key));
  }
  return { rows, missing };
}

/** Pure: rows whose authored text contains a `$<digit>` figure. */
export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(`${r.plain_name} ${r.short_description} ${r.description}`));
}

/**
 * Pure: rows whose authored text contains an OH locality name (word-boundary, case-insensitive),
 * excluding GUARD_NAME_SKIP (the state-node "ohio" + common-English-word municipality names).
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

  // 1. OH cohort: entity_type IN ('city', 'county'), state = 'OH'.
  const { data: munis, error: mErr } = await supabase.from('municipalities').select('id,name,entity_type').eq('state', 'OH').in('entity_type', ['city', 'county']);
  if (mErr) { console.error('municipalities fetch error:', mErr.message); process.exit(1); }
  const ids = (munis || []).map(m => m.id);
  const localityNames = (munis || []).map(m => m.name);
  if (!ids.length) { console.error('No OH city/county municipalities found.'); process.exit(1); }

  // 2. All OH budgets → id (operating + revenue).
  let budgets = [];
  for (let i = 0; i < ids.length; i += 30) {
    const { data: bs, error } = await supabase.from('budgets').select('id,dataset_type').in('municipality_id', ids.slice(i, i + 30));
    if (error) { console.error('budgets fetch error:', error.message); process.exit(1); }
    budgets = budgets.concat(bs || []);
  }

  // 3. Distinct live link_keys across operating + revenue, depth 0 only.
  // Ohio trees are FLAT — depth-0 only; no depth-1 composites.
  async function collectKeys(datasetTypes) {
    const bids = budgets.filter(b => datasetTypes.includes(b.dataset_type)).map(b => b.id);
    const keys = new Set();
    for (let i = 0; i < bids.length; i += 25) {
      const slice = bids.slice(i, i + 25);
      for (let from = 0; ; from += 1000) {
        const { data: cats, error } = await supabase.from('budget_categories')
          .select('name,link_key').in('budget_id', slice).eq('depth', 0).range(from, from + 999);
        if (error) { console.error('budget_categories fetch error:', error.message); process.exit(1); }
        for (const c of (cats || [])) {
          const k = (c.link_key || (c.name || '').toLowerCase().trim());
          if (k && k !== 'total') keys.add(k);
        }
        if (!cats || cats.length < 1000) break;
      }
    }
    return keys;
  }

  const opD0 = await collectKeys(['operating']);
  const rvD0 = await collectKeys(['revenue']);
  const liveKeys = [...new Set([...opD0, ...rvD0])];

  // 4. Build rows + coverage gate.
  const { rows, missing } = buildRows(liveKeys);
  const stale = EXPECTED_KEYS.filter(k => !liveKeys.includes(k)); // map keys no longer present live (non-fatal)
  const dollarLeaks = findDollarLeaks(rows);
  const localityLeaks = findLocalityLeaks(rows, localityNames);

  console.log('=== Phase 87 Ohio enrichment build (live worklist) ===');
  console.log('OH entities (city+county):', ids.length, '| budgets:', budgets.length);
  console.log(`live keys: operating d0=${opD0.size} | revenue d0=${rvD0.size} | total distinct=${liveKeys.length}`);
  console.log('map size (EXPECTED_KEYS):', EXPECTED_KEYS.length);
  console.log('rows to author:', rows.length);
  console.log('MISSING coverage (live key not in map, must be 0):', missing.length, missing.length ? '\n  ' + missing.join('\n  ') : '');
  console.log('stale map keys (in map, not live — non-fatal):', stale.length, stale.length ? '(' + stale.join(', ') + ')' : '');
  console.log('$-leak rows (must be 0):', dollarLeaks.length, dollarLeaks.map(r => r.name_key).join(', '));
  console.log('locality-leak rows (must be 0):', localityLeaks.length, localityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));

  mkdirSync('data', { recursive: true });
  writeFileSync('data/ohio-enrichment-87.expanded.json', JSON.stringify({
    generated_at: GENERATED_AT, authored: rows.length, missing, stale,
    rows: rows.map(r => ({ name_key: r.name_key, plain_name: r.plain_name, confidence: r.confidence })),
  }, null, 2));
  console.log('Expanded mapping written to data/ohio-enrichment-87.expanded.json');

  if (missing.length) { console.error(`ABORT: ${missing.length} live OH key(s) have no enrichment in the map (no fallback — add them to data/ohioEnrichment87.mjs).`); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
  if (localityLeaks.length) { console.error('ABORT: OH locality name leak detected in authored text'); process.exit(1); }

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
if (entry.endsWith('loadOhioEnrichment87.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
