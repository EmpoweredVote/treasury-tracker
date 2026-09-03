#!/usr/bin/env node
/**
 * Phase 66 — SoCal Enrichment Parity loader (inline-authored, $0; NO paid API path).
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for the SoCal
 * residual: salary department name_keys shared by >=2 SoCal cities (across ALL years)
 * that Phase 61's universal rows did not already cover. Op/rev are already 100% covered.
 *
 * The worklist is derived LIVE from production (self-contained + reproducible):
 *   uncovered = depth-0 budget_categories.link_key (salaries, all years, 95 SoCal cities)
 *               that has no universal category_enrichment row; >=2 distinct cities.
 * Single-city dept-name tail is DEFERRED (Phase 61 precedent — self-explanatory, low value).
 *
 * Resolution reuses the Phase 61 concept library + router verbatim (zero fabricated text):
 *   SOCAL_EXACT / Phase61 EXACT_OVERRIDE -> EXPLICIT_ROWS -> keyword ROUTE_RULES -> general_dept.
 * Every row is generic + bleed-safe (no $ figures, no city names). Idempotent upsert.
 *
 * Usage:
 *   node scripts/loadSoCalEnrichment66.mjs            # dry-run: derive worklist + print mapping, NO DB write
 *   node scripts/loadSoCalEnrichment66.mjs --apply    # upsert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { CONCEPTS } from '../data/caParityEnrichment61.mjs';
import { EXPLICIT_ROWS, ROUTE_RULES } from '../data/caParityEnrichment61_oprev.mjs';
import { SOCAL_EXACT } from '../data/socalEnrichment66.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}
const APPLY = process.argv.includes('--apply');
const GENERATED_AT = process.env.PHASE66_TS || '2026-06-17T00:00:00.000Z';
const EXACT_OVERRIDE = { 'it': 'information_technology', 'cra': 'redevelopment', 'human': 'human_resources', ...SOCAL_EXACT };

function resolve(nameKey) {
  if (EXACT_OVERRIDE[nameKey]) return { row: CONCEPTS[EXACT_OVERRIDE[nameKey]], via: 'exact:' + EXACT_OVERRIDE[nameKey] };
  if (EXPLICIT_ROWS[nameKey]) return { row: EXPLICIT_ROWS[nameKey], via: 'explicit' };
  for (const [needle, concept] of ROUTE_RULES) {
    if (nameKey.includes(needle)) return { row: CONCEPTS[concept], via: 'route:' + concept };
  }
  return { row: CONCEPTS.general_dept, via: 'fallback:general_dept' };
}

const SOCAL_COUNTIES = ['Riverside County','San Bernardino County','San Diego County','Ventura County','Santa Barbara County','Imperial County'];
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { db: { schema: 'treasury' } });

// 1. Universal enrichment name_keys (paginate past the 1000-row cap).
const enrKeys = new Set();
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from('category_enrichment').select('name_key').is('municipality_id', null).order('id').range(from, from + 999);
  if (!data || !data.length) break;
  data.forEach(e => enrKeys.add(e.name_key));
  if (data.length < 1000) break;
}

// 2. SoCal cohort city ids.
let ids = [];
for (const n of SOCAL_COUNTIES) {
  const { data: c } = await supabase.from('municipalities').select('id').eq('name', n).eq('entity_type', 'county').maybeSingle();
  const { data: cc } = await supabase.from('municipalities').select('id').eq('county_id', c.id).eq('entity_type', 'city');
  ids = ids.concat(cc.map(x => x.id));
}

// 3. All salaries budgets (all years) → budget_id → city.
let budgets = [];
for (let i = 0; i < ids.length; i += 30) {
  const { data: bs } = await supabase.from('budgets').select('id,municipality_id').in('municipality_id', ids.slice(i, i + 30)).eq('dataset_type', 'salaries');
  budgets = budgets.concat(bs || []);
}
const budCity = {}; budgets.forEach(b => budCity[b.id] = b.municipality_id);
const bids = budgets.map(b => b.id);

// 4. Distinct depth-0 link_keys with the set of cities that use them.
const keyCities = new Map();
for (let i = 0; i < bids.length; i += 25) {
  const { data: cats } = await supabase.from('budget_categories').select('budget_id,name,link_key').in('budget_id', bids.slice(i, i + 25)).eq('depth', 0);
  for (const c of (cats || [])) {
    const k = (c.link_key || (c.name || '').toLowerCase().trim());
    if (!k) continue;
    if (!keyCities.has(k)) keyCities.set(k, new Set());
    keyCities.get(k).add(budCity[c.budget_id]);
  }
}

// 5. Worklist = uncovered, >=2 distinct cities. Single-city tail deferred.
const uncovered = [...keyCities.keys()].filter(k => !enrKeys.has(k));
const worklist = uncovered.filter(k => keyCities.get(k).size >= 2).sort((a, b) => keyCities.get(b).size - keyCities.get(a).size);
const deferredSingleCity = uncovered.filter(k => keyCities.get(k).size < 2).length;

const rows = [];
const mappingLog = [];
const viaCounts = {};
for (const nameKey of worklist) {
  const { row, via } = resolve(nameKey);
  const bucket = via.split(':')[0];
  viaCounts[bucket] = (viaCounts[bucket] || 0) + 1;
  rows.push({
    name_key: nameKey,
    municipality_id: null,
    plain_name: row.plain_name,
    short_description: row.short_description,
    description: row.description,
    tags: row.tags,
    source: 'ai',
    confidence: row.confidence,
    evidence_summary: 'Inline-authored plain-language description of a standard municipal department/category, mapped from the department name to a generic civic-finance concept (Phase 66, SoCal parity). Generic and bleed-safe — not specific to any city.',
    generated_at: GENERATED_AT,
  });
  mappingLog.push({ name_key: nameKey, cities: keyCities.get(nameKey).size, plain_name: row.plain_name, via });
}

const leaks = rows.filter(r => /\$\s?\d/.test(`${r.description} ${r.plain_name} ${r.short_description}`));
const fallbacks = mappingLog.filter(m => m.via.startsWith('fallback'));

console.log('=== Phase 66 SoCal enrichment build (live worklist) ===');
console.log('universal enrichment name_keys (existing):', enrKeys.size);
console.log('SoCal cohort cities:', ids.length, '| salaries budgets:', budgets.length);
console.log('uncovered salary keys:', uncovered.length, '| >=2-city (authoring):', worklist.length, '| single-city (deferred):', deferredSingleCity);
console.log('resolution:', JSON.stringify(viaCounts));
console.log('fallback-to-general_dept:', fallbacks.length, fallbacks.length ? '(' + fallbacks.map(f => f.name_key).join(', ') + ')' : '');
console.log('$-leak rows (must be 0):', leaks.length);

mkdirSync('data', { recursive: true });
writeFileSync('data/socal-enrichment-66.expanded.json', JSON.stringify({ generated_at: GENERATED_AT, authored: rows.length, deferred_single_city: deferredSingleCity, mapping: mappingLog }, null, 2));
console.log('Expanded mapping written to data/socal-enrichment-66.expanded.json');

if (leaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to upsert.'); process.exit(0); }

let written = 0;
for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200);
  const { error } = await supabase.from('category_enrichment').upsert(batch, { onConflict: 'name_key,municipality_id' });
  if (error) { console.error('upsert error:', error.message); process.exit(1); }
  written += batch.length;
  process.stdout.write(`\r  upserted ${written}/${rows.length}`);
}
console.log(`\nDone. Upserted ${written} universal category_enrichment rows. Deferred single-city tail: ${deferredSingleCity}.`);
