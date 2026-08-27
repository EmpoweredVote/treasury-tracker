/**
 * Phase 72 — Utah Enrichment Parity loader (inline-authored, $0; NO paid API path).
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for every
 * newly-loaded Utah category, derived LIVE from production (self-contained + reproducible):
 *   - operating + revenue DEPTH-0 = FUND names  → fresh Utah fund concept library
 *   - operating + revenue DEPTH-1 = `fund|dept` composites → route the dept portion through
 *       the shared department library (general_dept fallback WRITTEN — reads fine under a fund)
 *   - salaries DEPTH-0 = DEPARTMENT names → shared department library; names that match a real
 *       concept are written (even single-city); names that hit ONLY the general_dept fallback
 *       are COUNTED + DEFERRED (left raw) per SC#3 / D-72-08.
 *
 * Department routing reuses the Phase 61 CONCEPTS + ROUTE_RULES + EXPLICIT_ROWS verbatim and
 * merges a fresh county-government concept set on top (UTAH_COUNTY_CONCEPTS). Utah county-dept
 * routes (UTAH_DEPT_EXTRA_ROUTES) are tried FIRST so county semantics win (the CA rules mis-map
 * e.g. assessor→finance, sheriff→police).
 *
 * Every row is generic + bleed-safe (no entity names, no $ figures). Idempotent upsert on
 * (name_key, municipality_id). The enrichment name_key equals the node's budget_categories.link_key
 * (depth-0 plain; depth-1 `fund|dept` composite) — matching the convention in scripts/enrichCategories.js
 * and the two-tier join the app reads (city-scoped row first, then NULL universal).
 *
 * Usage:
 *   node scripts/loadUtahEnrichment72.mjs            # dry-run: derive worklist + print mapping, NO DB write
 *   node scripts/loadUtahEnrichment72.mjs --apply    # upsert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { CONCEPTS } from '../data/caParityEnrichment61.mjs';
import { EXPLICIT_ROWS, ROUTE_RULES } from '../data/caParityEnrichment61_oprev.mjs';
import { UTAH_FUND_CONCEPTS, UTAH_COUNTY_CONCEPTS, UTAH_FUND_ROUTES, UTAH_FUND_TO_DEPT, UTAH_DEPT_EXTRA_ROUTES } from '../data/utahEnrichment72.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}

const GENERATED_AT = process.env.PHASE72_TS || '2026-06-20T00:00:00.000Z';

// Merged department library: CA city concepts + fresh Utah county-gov concepts.
const DEPT_CONCEPTS = { ...CONCEPTS, ...UTAH_COUNTY_CONCEPTS };
// A few city-concept dept routes the Phase 61 ROUTE_RULES miss for bare Utah terms.
const SUPPLEMENTAL_DEPT_ROUTES = [['attorney', 'city_attorney']];

const EVIDENCE = 'Inline-authored plain-language description mapped from a Utah budget category name to a generic civic-finance concept (Phase 72, Utah parity). Fund names map to a Utah governmental-fund concept; department names reuse the standardized municipal/county concept library. Generic and bleed-safe — not specific to any entity.';

/** Fund-only routing (fund families + reused CA service concepts). Returns {row,via} or null. */
function resolveFundStrict(key) {
  for (const [needle, id] of UTAH_FUND_ROUTES) if (key.includes(needle)) return { row: UTAH_FUND_CONCEPTS[id], via: 'fund:' + id };
  for (const [needle, id] of UTAH_FUND_TO_DEPT) if (key.includes(needle)) return { row: CONCEPTS[id], via: 'fund_dept:' + id };
  return null;
}

/**
 * Resolve a FUND name_key (op/rev depth-0):
 *   1. fund families / reused service concepts (resolveFundStrict).
 *   2. fall through to the department resolver (catches anything in CONCEPTS/ROUTE_RULES).
 *   3. general_fund fallback (genuinely idiosyncratic project-area names).
 */
export function resolveFund(key) {
  const f = resolveFundStrict(key);
  if (f) return f;
  const d = resolveDept(key);
  if (d.via !== 'fallback:general_dept') return { row: d.row, via: 'fund_route:' + d.via };
  return { row: UTAH_FUND_CONCEPTS.general_fund, via: 'fallback:general_fund' };
}

/** Resolve a DEPARTMENT word to a concept: county routes → supplemental → exact → explicit → CA routes → general_dept. */
export function resolveDept(deptKey) {
  for (const [needle, id] of UTAH_DEPT_EXTRA_ROUTES) if (deptKey.includes(needle)) return { row: DEPT_CONCEPTS[id], via: 'county:' + id };
  for (const [needle, id] of SUPPLEMENTAL_DEPT_ROUTES) if (deptKey.includes(needle)) return { row: DEPT_CONCEPTS[id], via: 'supp:' + id };
  if (EXPLICIT_ROWS[deptKey]) return { row: EXPLICIT_ROWS[deptKey], via: 'explicit' };
  for (const [needle, id] of ROUTE_RULES) if (deptKey.includes(needle)) return { row: CONCEPTS[id], via: 'route:' + id };
  return { row: CONCEPTS.general_dept, via: 'fallback:general_dept' };
}

/**
 * Resolve any worklist key for a given bucket.
 *   bucket 'fund'      → fund concept, always written.
 *   bucket 'composite' → dept portion (after the last '|'), always written (general_dept allowed — D-72-09).
 *   bucket 'dept'      → dept concept; general_dept-ONLY result is deferred (D-72-08).
 * Returns { row, via, defer }.
 */
export function resolve(key, bucket) {
  if (bucket === 'fund') return { ...resolveFund(key), defer: false };
  if (bucket === 'composite') {
    const dept = key.split('|').pop().trim();
    const r = resolveDept(dept);
    // The child node may itself be a fund-type label (e.g. "general fund", "capital projects",
    // "tax increment"). Prefer a fund concept over the generic department fallback.
    if (r.via === 'fallback:general_dept') {
      const f = resolveFundStrict(dept);
      if (f) return { ...f, defer: false };
    }
    return { ...r, defer: false };
  }
  // bucket === 'dept'
  const r = resolveDept(key);
  return { ...r, defer: r.via === 'fallback:general_dept' };
}

function buildRow(nameKey, row) {
  return {
    name_key: nameKey,
    municipality_id: null,
    plain_name: row.plain_name,
    short_description: row.short_description,
    description: row.description,
    tags: row.tags,
    source: 'ai',
    confidence: row.confidence,
    evidence_summary: EVIDENCE,
    generated_at: GENERATED_AT,
  };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { db: { schema: 'treasury' } });

  // 1. Existing universal enrichment name_keys (paginate past the 1000-row cap).
  const enrKeys = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('category_enrichment').select('name_key').is('municipality_id', null).range(from, from + 999);
    if (error) { console.error('enrichment fetch error:', error.message); process.exit(1); }
    if (!data || !data.length) break;
    data.forEach(e => enrKeys.add(e.name_key));
    if (data.length < 1000) break;
  }

  // 2. Utah cohort: cities + county governments (exclude the 'Utah' state row).
  const { data: munis, error: mErr } = await supabase.from('municipalities').select('id,name,entity_type').eq('state', 'UT').in('entity_type', ['city', 'county']);
  if (mErr) { console.error('municipalities fetch error:', mErr.message); process.exit(1); }
  const ids = (munis || []).map(m => m.id);

  // 3. All UT budgets → budget_id → municipality_id, grouped by dataset_type.
  let budgets = [];
  for (let i = 0; i < ids.length; i += 30) {
    const { data: bs } = await supabase.from('budgets').select('id,municipality_id,dataset_type').in('municipality_id', ids.slice(i, i + 30));
    budgets = budgets.concat(bs || []);
  }
  const budCity = {}; budgets.forEach(b => budCity[b.id] = b.municipality_id);

  // 4. Collect distinct keys → set of cities, per (dataset_type, depth).
  //    Returns Map<key, Set<municipality_id>>.
  async function collectKeys(datasetTypes, depth) {
    const bids = budgets.filter(b => datasetTypes.includes(b.dataset_type)).map(b => b.id);
    const keyCities = new Map();
    for (let i = 0; i < bids.length; i += 25) {
      const { data: cats } = await supabase.from('budget_categories').select('budget_id,name,link_key').in('budget_id', bids.slice(i, i + 25)).eq('depth', depth);
      for (const c of (cats || [])) {
        const k = (c.link_key || (c.name || '').toLowerCase().trim());
        if (!k) continue;
        if (!keyCities.has(k)) keyCities.set(k, new Set());
        keyCities.get(k).add(budCity[c.budget_id]);
      }
    }
    return keyCities;
  }

  const fundKeys = await collectKeys(['operating', 'revenue'], 0);   // FUND worklist
  const compositeKeys = await collectKeys(['operating', 'revenue'], 1); // `fund|dept` worklist
  const deptKeys = await collectKeys(['salaries'], 0);                // DEPARTMENT worklist

  const rows = [];
  const seenKeys = new Set(); // dedup: a name_key yields ONE universal row even if it appears in multiple buckets
  const mappingLog = [];
  const viaCounts = {};
  let deferredSingleCity = 0;
  const deferredKeys = [];

  function processBucket(keyMap, bucket) {
    // Inherit existing universal rows (e.g. CA police/fire/finance) by skipping covered keys —
    // EXCEPT county-concept keys, which must overwrite the stale city-oriented CA mapping
    // (CA routes assessor→finance, sheriff→police; the county concept is accurate universally).
    let considered = 0;
    for (const key of [...keyMap.keys()].sort((a, b) => keyMap.get(b).size - keyMap.get(a).size)) {
      const { row, via, defer } = resolve(key, bucket);
      const isCounty = via.startsWith('county:');
      if (enrKeys.has(key) && !isCounty) continue; // already covered by an acceptable universal row
      considered++;
      if (defer) { deferredSingleCity++; if (deferredKeys.length < 50) deferredKeys.push(key); continue; }
      if (seenKeys.has(key)) continue; // already authored from an earlier bucket — one universal row per key
      seenKeys.add(key);
      const vk = bucket + ':' + via.split(':')[0];
      viaCounts[vk] = (viaCounts[vk] || 0) + 1;
      rows.push(buildRow(key, row));
      mappingLog.push({ name_key: key, bucket, cities: keyMap.get(key).size, plain_name: row.plain_name, via, overwrite: enrKeys.has(key) });
    }
    return considered;
  }

  const fundUncovered = processBucket(fundKeys, 'fund');
  const compUncovered = processBucket(compositeKeys, 'composite');
  const deptUncovered = processBucket(deptKeys, 'dept');

  const leaks = rows.filter(r => /\$\s?\d/.test(`${r.description} ${r.plain_name} ${r.short_description}`));
  const fundFallback = mappingLog.filter(m => m.via === 'fallback:general_fund');
  const compGeneralDept = mappingLog.filter(m => m.bucket === 'composite' && m.via === 'fallback:general_dept');

  console.log('=== Phase 72 Utah enrichment build (live worklist) ===');
  console.log('UT cohort entities:', ids.length, '| budgets:', budgets.length, '| existing universal keys:', enrKeys.size);
  console.log(`fund keys: ${fundKeys.size} (uncovered ${fundUncovered}) | composite keys: ${compositeKeys.size} (uncovered ${compUncovered}) | dept keys: ${deptKeys.size} (uncovered ${deptUncovered})`);
  console.log('resolution via-counts:', JSON.stringify(viaCounts));
  console.log('fund fallback→general_fund:', fundFallback.length, fundFallback.length ? '(' + fundFallback.slice(0, 20).map(f => f.name_key).join(', ') + ')' : '');
  console.log('composite fallback→general_dept (written):', compGeneralDept.length);
  console.log('salaries single-city DEFERRED (general_dept-only, NOT written):', deferredSingleCity, deferredKeys.length ? '\n  e.g. ' + deferredKeys.slice(0, 20).join(', ') : '');
  console.log('rows to author:', rows.length);
  console.log('$-leak rows (must be 0):', leaks.length);

  mkdirSync('data', { recursive: true });
  writeFileSync('data/utah-enrichment-72.expanded.json', JSON.stringify({
    generated_at: GENERATED_AT, authored: rows.length, deferred_single_city: deferredSingleCity,
    via_counts: viaCounts, deferred_sample: deferredKeys, mapping: mappingLog,
  }, null, 2));
  console.log('Expanded mapping written to data/utah-enrichment-72.expanded.json');

  if (leaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to write.'); process.exit(0); }

  // The unique index treats NULL municipality_id as DISTINCT, so ON CONFLICT cannot match an
  // existing universal row — upserting would INSERT duplicates. Delete-then-insert is the only
  // idempotent + overwrite-correct path: clear every universal row for the keys we author
  // (removing stale CA mappings like assessor→Finance AND any prior run's rows), then insert fresh.
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
  console.log(`\nDone. Wrote ${written} universal category_enrichment rows (delete-then-insert over ${keysToWrite.length} keys). Deferred single-city salary depts: ${deferredSingleCity}.`);
}

// Run only when executed as the entry script (so tests can import resolve* without hitting the DB).
const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadUtahEnrichment72.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
