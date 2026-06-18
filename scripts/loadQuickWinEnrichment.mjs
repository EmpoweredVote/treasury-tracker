#!/usr/bin/env node
/**
 * Quick-win counties (Santa Clara, Fresno, Kern) — Enrichment Parity loader.
 * Inline-authored, $0; NO paid API path. Mirrors scripts/loadSoCalEnrichment66.mjs.
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for the
 * SALARY department residual: depth-0 name_keys shared by >=2 of the cohort's
 * cities (across ALL years) that the existing universal rows don't already cover.
 * Single-city dept-name tail is DEFERRED (Phase 61/66 precedent — low value).
 *
 * Op/rev coverage is REPORTED, not auto-authored: the SCO category taxonomy is
 * statewide-uniform and Phase 61 covered it universally, so we expect ~0 uncovered
 * op/rev keys. If any appear they're printed for deliberate handling (we do NOT
 * route op/rev names through the dept-oriented fallback).
 *
 * Resolution reuses the Phase 61 + 66 concept library verbatim (zero fabricated text):
 *   EXACT_OVERRIDE -> EXPLICIT_ROWS -> keyword ROUTE_RULES -> general_dept fallback.
 *
 * Usage:
 *   node scripts/loadQuickWinEnrichment.mjs            # dry-run: worklist + mapping, NO write
 *   node scripts/loadQuickWinEnrichment.mjs --apply    # upsert universal rows
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
const GENERATED_AT = process.env.QUICKWIN_TS || '2026-06-18T00:00:00.000Z';
// Quick-win residual depts that would otherwise hit the generic general_dept
// fallback, each mapped to an EXISTING generic concept (bleed-safe, no fabricated text).
const QUICKWIN_EXACT = {
  'attorney':      'city_attorney',
  'rda':           'redevelopment',   // redevelopment agency (cf. 'cra')
  'executive':     'city_manager',
  'city engineer': 'engineering',
  'ambulance':     'fire',            // EMS, generically under fire/emergency services
  'corrections':   'public_safety',   // jail/detention — public-safety umbrella
  'shop':          'fleet',           // vehicle/equipment maintenance shop
};
const EXACT_OVERRIDE = { 'it': 'information_technology', 'cra': 'redevelopment', 'human': 'human_resources', ...SOCAL_EXACT, ...QUICKWIN_EXACT };

function resolve(nameKey) {
  if (EXACT_OVERRIDE[nameKey]) return { row: CONCEPTS[EXACT_OVERRIDE[nameKey]], via: 'exact:' + EXACT_OVERRIDE[nameKey] };
  if (EXPLICIT_ROWS[nameKey]) return { row: EXPLICIT_ROWS[nameKey], via: 'explicit' };
  for (const [needle, concept] of ROUTE_RULES) {
    if (nameKey.includes(needle)) return { row: CONCEPTS[concept], via: 'route:' + concept };
  }
  return { row: CONCEPTS.general_dept, via: 'fallback:general_dept' };
}

const COUNTIES = ['Santa Clara County', 'Fresno County', 'Kern County'];
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { db: { schema: 'treasury' } });

// 1. Existing universal enrichment name_keys (paginate past the 1000-row cap).
const enrKeys = new Set();
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from('category_enrichment').select('name_key').is('municipality_id', null).range(from, from + 999);
  if (!data || !data.length) break;
  data.forEach(e => enrKeys.add(e.name_key));
  if (data.length < 1000) break;
}

// 2. Cohort city ids.
let ids = [];
for (const n of COUNTIES) {
  const { data: c } = await supabase.from('municipalities').select('id').eq('name', n).eq('entity_type', 'county').maybeSingle();
  const { data: cc } = await supabase.from('municipalities').select('id').eq('county_id', c.id).eq('entity_type', 'city');
  ids = ids.concat(cc.map(x => x.id));
}

// 3. Budgets per dataset_type → budget_id → city.
async function budgetsFor(datasetType) {
  let budgets = [];
  for (let i = 0; i < ids.length; i += 30) {
    const { data: bs } = await supabase.from('budgets').select('id,municipality_id').in('municipality_id', ids.slice(i, i + 30)).eq('dataset_type', datasetType);
    budgets = budgets.concat(bs || []);
  }
  return budgets;
}

// 4. Distinct depth-0 link_keys with the set of cities that use them.
async function keyCitiesFor(budgets) {
  const budCity = {}; budgets.forEach(b => budCity[b.id] = b.municipality_id);
  const bids = budgets.map(b => b.id);
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
  return keyCities;
}

// Op/rev coverage report (expect ~0 uncovered).
for (const dt of ['operating', 'revenue']) {
  const kc = await keyCitiesFor(await budgetsFor(dt));
  const unc = [...kc.keys()].filter(k => !enrKeys.has(k));
  const unc2 = unc.filter(k => kc.get(k).size >= 2);
  console.log(`[${dt}] distinct keys: ${kc.size} | uncovered: ${unc.length} | >=2-city uncovered: ${unc2.length}${unc2.length ? ' -> ' + unc2.join(', ') : ''}`);
}

// Salaries residual = authoring target.
const salBudgets = await budgetsFor('salaries');
const keyCities = await keyCitiesFor(salBudgets);
const uncovered = [...keyCities.keys()].filter(k => !enrKeys.has(k));
const worklist = uncovered.filter(k => keyCities.get(k).size >= 2).sort((a, b) => keyCities.get(b).size - keyCities.get(a).size);
const deferredSingleCity = uncovered.filter(k => keyCities.get(k).size < 2).length;

const rows = [], mappingLog = [], viaCounts = {};
for (const nameKey of worklist) {
  const { row, via } = resolve(nameKey);
  const bucket = via.split(':')[0];
  viaCounts[bucket] = (viaCounts[bucket] || 0) + 1;
  rows.push({
    name_key: nameKey, municipality_id: null,
    plain_name: row.plain_name, short_description: row.short_description, description: row.description,
    tags: row.tags, source: 'ai', confidence: row.confidence,
    evidence_summary: 'Inline-authored plain-language description of a standard municipal department/category, mapped from the department name to a generic civic-finance concept (quick-win counties: Santa Clara, Fresno, Kern). Generic and bleed-safe — not specific to any city.',
    generated_at: GENERATED_AT,
  });
  mappingLog.push({ name_key: nameKey, cities: keyCities.get(nameKey).size, plain_name: row.plain_name, via });
}

const leaks = rows.filter(r => /\$\s?\d/.test(`${r.description} ${r.plain_name} ${r.short_description}`));
const fallbacks = mappingLog.filter(m => m.via.startsWith('fallback'));

console.log('\n=== Quick-win enrichment build (live worklist) ===');
console.log('universal enrichment name_keys (existing):', enrKeys.size);
console.log('cohort cities:', ids.length, '| salaries budgets:', salBudgets.length);
console.log('uncovered salary keys:', uncovered.length, '| >=2-city (authoring):', worklist.length, '| single-city (deferred):', deferredSingleCity);
console.log('resolution:', JSON.stringify(viaCounts));
console.log('fallback-to-general_dept:', fallbacks.length, fallbacks.length ? '(' + fallbacks.map(f => f.name_key).join(', ') + ')' : '');
console.log('$-leak rows (must be 0):', leaks.length);

mkdirSync('data', { recursive: true });
writeFileSync('data/quickwin-enrichment.expanded.json', JSON.stringify({ generated_at: GENERATED_AT, authored: rows.length, deferred_single_city: deferredSingleCity, mapping: mappingLog }, null, 2));
console.log('Expanded mapping written to data/quickwin-enrichment.expanded.json');

if (leaks.length) { console.error('ABORT: $-figure leak detected'); process.exit(1); }
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
