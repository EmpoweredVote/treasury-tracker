#!/usr/bin/env node
/**
 * LA-02 §4.4 audit: find rows whose data_source label does NOT say CA State
 * Controller but whose figure IS the State Controller's, i.e. the LA mislabel
 * repeated elsewhere.
 *
 * Test: for every CA city row inside SCO's coverage (FY2003-2024), fetch the SCO
 * total for that entity+FY+dataset and compare to the stored total. A DOLLAR-EXACT
 * match is the signature — that is how the LA case was proven (4/4 years exact).
 * Near-misses are reported too, since a mislabel could ride a slightly different
 * category filter.
 */
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(SB_URL, KEY);
const DS = { operating: 'ju3w-4gxp', revenue: 'rrtv-rsj9' };
const SCO_MIN = 2003, SCO_MAX = 2024;

// 1. Any remaining generic-portal ingestion labels, ANY state — the LA pattern.
const { data: portal, error: pErr } = await db.schema('treasury').from('budgets')
  .select('fiscal_year,dataset_type,data_source,total_budget,municipality_id')
  .or('data_source.ilike.%socrata%,data_source.ilike.%data.%.org%,data_source.ilike.%opendata%')
  .order('id', { ascending: true });
if (pErr) throw new Error(pErr.message);
console.log(`\n=== A. Generic portal/ingestion labels remaining (any state): ${portal.length} ===`);
for (const r of portal) console.log(`  FY${r.fiscal_year} ${r.dataset_type} ${r.data_source} ${r.total_budget}`);

// 2. CA city rows with a non-SCO label, inside SCO coverage.
const { data: munis } = await db.schema('treasury').from('municipalities')
  .select('id,name,state,entity_type').eq('state', 'CA').order('id', { ascending: true });
const byId = new Map(munis.map(m => [m.id, m]));

// Paged: PostgREST caps a response at 1000 rows, so an unpaged read silently
// returns a partial set. Order by the PRIMARY KEY so the page window is a total
// order (muni+fy ties duplicated a row and skipped another once before).
async function pageBudgets() {
  const PAGE = 1000; let from = 0, all = [];
  for (;;) {
    const { data, error } = await db.schema('treasury').from('budgets')
      .select('municipality_id,fiscal_year,dataset_type,data_source,total_budget')
      .in('dataset_type', ['operating', 'revenue'])
      .gte('fiscal_year', SCO_MIN).lte('fiscal_year', SCO_MAX)
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
const rows = await pageBudgets();
console.log(`  (read ${rows.length} CA-and-other rows in SCO's year range)`);

const SKIP_NAMES = new Set(['Empowered Vote', 'California']);
const cand = rows.filter(r => {
  const m = byId.get(r.municipality_id);              // CA municipalities only
  if (!m || m.entity_type !== 'city' || SKIP_NAMES.has(m.name)) return false;
  return !/^CA State Controller/.test(r.data_source || '');   // filter in JS, not PostgREST
});
const cities = [...new Set(cand.map(r => byId.get(r.municipality_id).name))].sort();
console.log(`  cities involved: ${cities.join(', ')}`);
console.log(`\n=== B. CA city rows, non-SCO label, FY${SCO_MIN}-${SCO_MAX}: ${cand.length} to test ===`);

const cache = new Map();
async function scoTotal(name, fy, dataset) {
  const k = `${name}|${fy}|${dataset}`;
  if (cache.has(k)) return cache.get(k);
  const u = new URL(`https://bythenumbers.sco.ca.gov/resource/${DS[dataset]}.json`);
  u.searchParams.set('$select', 'sum(value) as total');
  u.searchParams.set('$where', `entity_name='${name.replace(/'/g, "''")}' AND fiscal_year='${fy}'`);
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(u, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const v = j?.[0]?.total != null ? Number(j[0].total) : null;
      cache.set(k, v); return v;
    } catch (e) { if (a === 2) { console.log(`    ! ${k}: ${e.message}`); cache.set(k, null); return null; } }
  }
}

const exact = [], near = [], far = [], nodata = [];
for (const r of cand) {
  const m = byId.get(r.municipality_id);
  const sco = await scoTotal(m.name, r.fiscal_year, r.dataset_type);
  const stored = Number(r.total_budget);
  if (sco == null || sco === 0) { nodata.push({ ...r, name: m.name }); continue; }
  const d = stored - sco, pct = (d / sco) * 100;
  const rec = { name: m.name, fy: r.fiscal_year, ds: r.dataset_type, label: r.data_source, stored, sco, d, pct };
  if (d === 0) exact.push(rec);
  else if (Math.abs(pct) < 0.5) near.push(rec);
  else far.push(rec);
}

const f = n => n.toLocaleString('en-US');
console.log(`\n  🛑 DOLLAR-EXACT matches (mislabelled SCO data): ${exact.length}`);
for (const r of exact) console.log(`     ${r.name} FY${r.fy} ${r.ds}: ${f(r.stored)} == SCO  [${r.label}]`);
console.log(`\n  ⚠ within 0.5% but not exact: ${near.length}`);
for (const r of near) console.log(`     ${r.name} FY${r.fy} ${r.ds}: stored ${f(r.stored)} vs SCO ${f(r.sco)} (${r.pct.toFixed(4)}%)  [${r.label}]`);
console.log(`\n  ✅ clearly a different figure (>0.5%): ${far.length}`);
const byCity = new Map();
for (const r of far) {
  const k = `${r.name} ${r.ds}`;
  if (!byCity.has(k)) byCity.set(k, []);
  byCity.get(k).push(r.pct);
}
for (const [k, ps] of byCity) {
  const lo = Math.min(...ps), hi = Math.max(...ps);
  console.log(`     ${k}: ${ps.length} yr(s), ${lo.toFixed(1)}% .. ${hi.toFixed(1)}% vs SCO`);
}
console.log(`\n  (no SCO figure for that entity/year: ${nodata.length})`);
for (const r of nodata) console.log(`     ${r.name} FY${r.fiscal_year} ${r.dataset_type}`);
