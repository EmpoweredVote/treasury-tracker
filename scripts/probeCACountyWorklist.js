#!/usr/bin/env node
/**
 * One-off probe: CA county coverage worklist (NorCal/Central expansion scoping).
 *
 * Cross-references the production DB against the SCO ByTheNumbers expenditures
 * feed (ju3w-4gxp) to answer: which of California's counties are already loaded
 * (county-gov budget + linked cities) and which remain. Read-only — no writes.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXP_DATASET = 'ju3w-4gxp';
const HOST = 'https://bythenumbers.sco.ca.gov';

async function fetchJSON(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise(res => setTimeout(res, 1500 * i));
    }
  }
}

/** Distinct SCO counties + how many distinct cities each has in the feed. */
async function fetchScoCountyCityCounts() {
  const params = new URLSearchParams({
    $select: 'county, count(distinct entity_name) as cities',
    $group: 'county',
    $order: 'cities DESC',
    $limit: '500',
  });
  const rows = await fetchJSON(`${HOST}/resource/${EXP_DATASET}.json?${params}`);
  return rows
    .filter(r => (r.county || '').trim())
    .map(r => ({ county: r.county.trim(), scoCities: Number(r.cities) }));
}

async function main() {
  // 1. All CA municipalities (cities + counties) from the DB.
  const { data: munis, error: mErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, entity_type, county_id, population')
    .eq('state', 'CA');
  if (mErr) throw new Error(`municipalities: ${mErr.message}`);

  const counties = munis.filter(m => m.entity_type === 'county');
  const cities = munis.filter(m => m.entity_type === 'city');
  const byId = new Map(munis.map(m => [m.id, m]));

  // 2. Which municipality_ids have budget rows, and which dataset_types.
  //    Page through budgets to collect (municipality_id -> set of dataset_type).
  const budgetByMuni = new Map();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .schema('treasury')
      .from('budgets')
      .select('municipality_id, dataset_type')
      .order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`budgets: ${error.message}`);
    if (!data.length) break;
    for (const b of data) {
      if (!budgetByMuni.has(b.municipality_id)) budgetByMuni.set(b.municipality_id, new Set());
      budgetByMuni.get(b.municipality_id).add(b.dataset_type);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // 3. SCO full county universe.
  const sco = await fetchScoCountyCityCounts();
  const scoByName = new Map(sco.map(s => [s.county.toLowerCase(), s]));

  // Helper: county entity name normalize ("Los Angeles County" -> "los angeles")
  const normCounty = n => n.replace(/\s+county$/i, '').trim().toLowerCase();

  // DB county entities keyed by normalized name.
  const dbCountyByName = new Map(counties.map(c => [normCounty(c.name), c]));

  // Count DB cities linked per county_id.
  const linkedCityCount = new Map();
  for (const c of cities) {
    if (c.county_id) linkedCityCount.set(c.county_id, (linkedCityCount.get(c.county_id) || 0) + 1);
  }

  // 4. Build the worklist row per SCO county.
  const rows = sco.map(s => {
    const dbCounty = dbCountyByName.get(s.county.toLowerCase());
    const countyEntity = !!dbCounty;
    const countyBudget = dbCounty ? (budgetByMuni.get(dbCounty.id)?.size > 0) : false;
    const linked = dbCounty ? (linkedCityCount.get(dbCounty.id) || 0) : 0;
    return {
      county: s.county,
      scoCities: s.scoCities,
      countyEntity,
      countyBudget,
      linkedCities: linked,
    };
  });

  // 5. Classify.
  const DONE = rows.filter(r => r.countyEntity && r.countyBudget && r.linkedCities > 0);
  const PARTIAL = rows.filter(r => (r.countyEntity || r.linkedCities > 0) && !(r.countyBudget && r.linkedCities > 0));
  const NOT_STARTED = rows.filter(r => !r.countyEntity && r.linkedCities === 0);

  const pad = (s, n) => String(s).padEnd(n);
  const fmt = r =>
    `  ${pad(r.county, 20)} sco_cities=${pad(r.scoCities, 4)} county_entity=${pad(r.countyEntity ? 'Y' : '-', 2)} county_budget=${pad(r.countyBudget ? 'Y' : '-', 2)} linked_cities=${r.linkedCities}`;

  console.log(`\n=== CA COUNTY WORKLIST (SCO universe: ${sco.length} counties) ===`);
  console.log(`DB has: ${counties.length} CA county entities, ${cities.length} CA cities ` +
    `(${cities.filter(c => budgetByMuni.has(c.id)).length} with budgets, ${[...linkedCityCount.values()].reduce((a, b) => a + b, 0)} linked to a county)\n`);

  console.log(`--- DONE (county-gov budget + linked cities) : ${DONE.length} ---`);
  DONE.sort((a, b) => b.scoCities - a.scoCities).forEach(r => console.log(fmt(r)));

  console.log(`\n--- PARTIAL (entity or some cities, but not full) : ${PARTIAL.length} ---`);
  PARTIAL.sort((a, b) => b.scoCities - a.scoCities).forEach(r => console.log(fmt(r)));

  console.log(`\n--- NOT STARTED (no county entity, no linked cities) : ${NOT_STARTED.length} ---`);
  const notStartedCities = NOT_STARTED.reduce((a, r) => a + r.scoCities, 0);
  NOT_STARTED.sort((a, b) => b.scoCities - a.scoCities).forEach(r => console.log(fmt(r)));
  console.log(`\n  >>> NOT-STARTED totals: ${NOT_STARTED.length} counties, ${notStartedCities} cities in the SCO feed`);
}

main().catch(e => { console.error(e); process.exit(1); });
