#!/usr/bin/env node
/** Verification probe for the 3 quick-win counties. Read-only. */
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
const COUNTIES = ['Santa Clara County', 'Fresno County', 'Kern County'];

const HOST = 'https://bythenumbers.sco.ca.gov';
async function scoTotal(dataset, where) {
  const p = new URLSearchParams({ $select: 'sum(value)', $where: where });
  const r = await fetch(`${HOST}/resource/${dataset}.json?${p}`, { headers: { Accept: 'application/json' } });
  const j = await r.json();
  return Number(j?.[0]?.sum_value || 0);
}

async function budgetsForMuni(id) {
  const { data } = await sb.from('budgets').select('fiscal_year,dataset_type,total_budget,data_source,source_url').eq('municipality_id', id);
  return data || [];
}

console.log('=== QUICK-WIN VERIFICATION ===\n');
let allRows = [];
for (const cn of COUNTIES) {
  const { data: county } = await sb.from('municipalities').select('id,name,population').eq('name', cn).eq('entity_type', 'county').maybeSingle();
  const { data: cities } = await sb.from('municipalities').select('id,name,population,county_id').eq('county_id', county.id).eq('entity_type', 'city');
  const cb = await budgetsForMuni(county.id);
  allRows.push(...cb);
  const cYears = cb.filter(b => b.dataset_type === 'operating').map(b => b.fiscal_year);
  console.log(`### ${cn}  (pop ${county.population.toLocaleString()})`);
  console.log(`  County-gov budget: operating FY${Math.min(...cYears)}-${Math.max(...cYears)} (${cb.length} rows op+rev), latest op total $${(cb.filter(b=>b.dataset_type==='operating').sort((a,b)=>b.fiscal_year-a.fiscal_year)[0]?.total_budget||0).toLocaleString()}`);
  console.log(`  Cities linked: ${cities.length}`);
  // per-city spans
  let opMin = 9999, opMax = 0, salMin = 9999, salMax = 0, missingOp = [], noSal = [];
  for (const c of cities) {
    const b = await budgetsForMuni(c.id); allRows.push(...b);
    const op = b.filter(x => x.dataset_type === 'operating').map(x => x.fiscal_year);
    const sal = b.filter(x => x.dataset_type === 'salaries').map(x => x.fiscal_year);
    if (op.length) { opMin = Math.min(opMin, ...op); opMax = Math.max(opMax, ...op); } else missingOp.push(c.name);
    if (sal.length) { salMin = Math.min(salMin, ...sal); salMax = Math.max(salMax, ...sal); } else noSal.push(c.name);
  }
  console.log(`  City operating span: FY${opMin}-${opMax} | salaries span: FY${salMin}-${salMax}`);
  console.log(`  Cities missing operating: ${missingOp.length ? missingOp.join(', ') : 'none'}`);
  console.log(`  Cities missing salaries:  ${noSal.length ? noSal.join(', ') : 'none'}\n`);
}

// Independent reconciliation: re-fetch FY2024 from SCO, compare to DB stored total.
console.log('=== INDEPENDENT RECONCILIATION (SCO FY2024 vs DB) ===');
async function reconcileCounty(scoName, dbName) {
  const sco = await scoTotal('uctr-c2j8', `entity_name='${scoName}' AND fiscal_year='2024'`);
  const { data: m } = await sb.from('municipalities').select('id').eq('name', dbName).eq('entity_type', 'county').maybeSingle();
  const { data: b } = await sb.from('budgets').select('total_budget').eq('municipality_id', m.id).eq('fiscal_year', 2024).eq('dataset_type', 'operating').maybeSingle();
  const db = b?.total_budget || 0;
  const delta = sco ? ((db - sco) / sco * 100) : 0;
  console.log(`  ${dbName} gov op FY2024: SCO sum=$${sco.toLocaleString()} | DB=$${db.toLocaleString()} | delta ${delta.toFixed(2)}%`);
}
async function reconcileCity(scoName, dbName) {
  const sco = await scoTotal('ju3w-4gxp', `entity_name='${scoName}' AND fiscal_year='2024'`);
  const { data: m } = await sb.from('municipalities').select('id').eq('name', dbName).eq('entity_type', 'city').maybeSingle();
  const { data: b } = await sb.from('budgets').select('total_budget').eq('municipality_id', m.id).eq('fiscal_year', 2024).eq('dataset_type', 'operating').maybeSingle();
  const db = b?.total_budget || 0;
  const delta = sco ? ((db - sco) / sco * 100) : 0;
  console.log(`  ${dbName} (city) op FY2024: SCO sum=$${sco.toLocaleString()} | DB=$${db.toLocaleString()} | delta ${delta.toFixed(2)}%`);
}
await reconcileCounty('Santa Clara', 'Santa Clara County');
await reconcileCounty('Kern', 'Kern County');
await reconcileCity('Sunnyvale', 'Sunnyvale');
await reconcileCity('Clovis', 'Clovis');

// Source-chain audit on all collected new rows.
console.log('\n=== SOURCE-CHAIN AUDIT ===');
const durable = allRows.filter(r => /\/d\//.test(r.source_url || ''));
const fragile = allRows.filter(r => /\/resource\//.test(r.source_url || ''));
const nullSrc = allRows.filter(r => !r.source_url);
console.log(`  total budget rows examined: ${allRows.length}`);
console.log(`  durable /d/ source_url: ${durable.length} | fragile /resource/: ${fragile.length} | null: ${nullSrc.length}`);
console.log(`  distinct data_source labels: ${[...new Set(allRows.map(r => r.data_source))].join(' | ')}`);

// Enrichment bleed-safety: the 37 new universal rows.
console.log('\n=== ENRICHMENT BLEED-SAFETY (universal rows) ===');
const { data: enr } = await sb.from('category_enrichment').select('name_key,municipality_id,plain_name,description').is('municipality_id', null).eq('generated_at', '2026-06-18T00:00:00.000Z');
const cityNames = ['sunnyvale','clovis','arvin','fresno','kern','santa clara','bakersfield','san jose'];
const leak = (enr || []).filter(e => /\$\s?\d/.test(`${e.plain_name} ${e.description}`) || cityNames.some(n => `${e.plain_name} ${e.description}`.toLowerCase().includes(n)));
console.log(`  new universal rows: ${(enr || []).length} | municipality_id all NULL: ${(enr || []).every(e => e.municipality_id === null)}`);
console.log(`  rows with $-figure or city-name leak: ${leak.length}`);
console.log('\nDone.');
