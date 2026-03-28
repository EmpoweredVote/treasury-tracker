#!/usr/bin/env node
/**
 * CA State Controller Bulk Loader
 *
 * Downloads expenditure and revenue data from bythenumbers.sco.ca.gov
 * for ALL cities in a county and imports into Supabase. Auto-creates
 * municipality records for cities that don't exist yet.
 *
 * Usage:
 *   node scripts/bulkLoadStateController.js --county "Los Angeles" --fy 2023
 *   node scripts/bulkLoadStateController.js --county "Los Angeles" --fy 2023 --type expenditures
 *   node scripts/bulkLoadStateController.js --county "Los Angeles" --fy 2021 --fy 2022 --fy 2023
 *   node scripts/bulkLoadStateController.js --county "Los Angeles" --fy 2023 --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATASETS = {
  expenditures: { id: 'ju3w-4gxp', type: 'operating', label: 'Expenditures' },
  revenues:     { id: 'rrtv-rsj9', type: 'revenue',   label: 'Revenues' },
};

function amt(v) {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

async function fetchAllPages(datasetId, where) {
  const PAGE = 10000;
  let offset = 0, all = [];
  while (true) {
    const params = new URLSearchParams({ $limit: String(PAGE), $offset: String(offset), $where: where });
    const url = `https://bythenumbers.sco.ca.gov/resource/${datasetId}.json?${params}`;
    if (offset === 0) console.log(`  Fetching: ${url.substring(0, 120)}...`);
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
    const page = await resp.json();
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
    process.stdout.write(`\r  Fetched ${all.length.toLocaleString()} rows...`);
  }
  console.log(`\r  Fetched ${all.length.toLocaleString()} rows total`);
  return all;
}

async function importCityData(cityName, state, population, rows, fiscalYear, datasetType, dataSourceId) {
  // Ensure municipality exists
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: cityName, p_state: state, p_entity_type: 'city', p_population: population || 0,
  });
  if (munErr) { console.error(`    Municipality error: ${munErr.message}`); return null; }

  // Build tree from hierarchy: category -> subcategory_1 -> subcategory_2
  const tree = new Map();
  for (const row of rows) {
    const cat = row.category || 'Unknown';
    const sub1 = row.subcategory_1 || 'General';
    if (!tree.has(cat)) tree.set(cat, new Map());
    const catNode = tree.get(cat);
    if (!catNode.has(sub1)) catNode.set(sub1, []);
    catNode.get(sub1).push({
      d: row.line_description || row.subcategory_2 || sub1,
      a: amt(row.value),
      aa: null,
      f: row.category || null,
      e: row.subcategory_2 || null,
    });
  }

  // Convert to compact JSON tree
  let total = 0;
  const jsonTree = [];
  for (const [catName, subs] of tree) {
    let catTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.a, 0);
      catTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    total += catTotal;
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  // Use the budget tree RPC — but we need to override the municipality_id
  // The RPC uses the data_source's municipality_id, so we need a version that accepts it directly
  // For now, use a direct approach: create budget, then call the tree inserter

  // Check if budget exists
  const { data: existingBudget } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: dataSourceId });

  // Use the tree sync RPC — it will use the data_source's municipality_id (LA County)
  // But we actually need per-city budgets. Let's use a direct SQL approach via a new RPC.
  const { data: result, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year: fiscalYear,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: jsonTree,
    p_row_count: rows.length,
    p_data_source_name: `CA State Controller - ${DATASETS[datasetType === 'operating' ? 'expenditures' : 'revenues'].label}`,
  });

  if (error) {
    console.error(`    RPC error: ${error.message}`);
    return null;
  }

  return result;
}

async function main() {
  const { values } = parseArgs({
    options: {
      county: { type: 'string', short: 'c' },
      fy: { type: 'string', short: 'y', multiple: true },
      type: { type: 'string', short: 't' },
      'dry-run': { type: 'boolean' },
      'list-cities': { type: 'boolean' },
    },
    strict: false,
  });

  const county = values.county || 'Los Angeles';
  const state = 'CA';
  const fiscalYears = values.fy ? values.fy.map(Number) : [2023];
  const types = values.type ? [values.type] : ['expenditures', 'revenues'];

  console.log(`\n🏛️  CA State Controller Bulk Loader`);
  console.log(`   County: ${county}`);
  console.log(`   Fiscal Years: ${fiscalYears.join(', ')}`);
  console.log(`   Types: ${types.join(', ')}\n`);

  for (const dsType of types) {
    const ds = DATASETS[dsType];
    if (!ds) { console.error(`Unknown type: ${dsType}`); continue; }

    for (const fy of fiscalYears) {
      console.log(`\n📊 ${ds.label} FY ${fy} — ${county} County`);

      const where = `county='${county}' AND fiscal_year='${fy}'`;
      const rows = await fetchAllPages(ds.id, where);

      if (rows.length === 0) { console.log('  No data found'); continue; }

      // Group by entity_name
      const byCity = new Map();
      for (const row of rows) {
        const city = row.entity_name;
        if (!byCity.has(city)) byCity.set(city, { rows: [], population: 0 });
        byCity.get(city).rows.push(row);
        if (row.estimated_population) byCity.get(city).population = parseInt(row.estimated_population);
      }

      console.log(`  ${byCity.size} cities found, ${rows.length.toLocaleString()} total rows\n`);

      if (values['list-cities']) {
        for (const [city, data] of [...byCity.entries()].sort()) {
          console.log(`    ${city}: ${data.rows.length} rows, pop ${data.population.toLocaleString()}`);
        }
        continue;
      }

      if (values['dry-run']) {
        console.log('  (dry run — skipping import)');
        continue;
      }

      let citiesImported = 0, totalItems = 0;
      for (const [cityName, cityData] of byCity) {
        const result = await importCityData(cityName, state, cityData.population, cityData.rows, fy, ds.type, null);

        if (result && result.rows_inserted) {
          totalItems += result.rows_inserted;
          citiesImported++;
          process.stdout.write(`\r  Imported ${citiesImported}/${byCity.size} cities (${totalItems.toLocaleString()} items)...`);
        }
      }
      console.log(`\n  ✅ ${citiesImported} cities, ${totalItems.toLocaleString()} items imported`);
    }
  }

  console.log('\n🎉 State Controller import complete!\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
