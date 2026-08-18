#!/usr/bin/env node
/**
 * CA State Controller Bulk Loader (hardened — Phase 52-02)
 *
 * Downloads expenditure and revenue data from bythenumbers.sco.ca.gov for ALL
 * cities in a county and imports into Supabase. Auto-creates municipality
 * records for cities that don't exist yet.
 *
 * Phase 52 hardening:
 *   - Durable source attribution: each city budget carries a durable ByTheNumbers
 *     dataset PAGE url (not the /resource/*.json API endpoint) as source_url and
 *     the run's fetch date as source_date (--source-date, default = today).
 *   - Population: estimated_population from the feed is persisted on created
 *     cities and backfilled on existing cities whose population is 0/NULL (a
 *     non-zero population is never reset to 0).
 *   - Never-overwrite collision policy (D-06): a city that already has budget
 *     data for (fiscal_year, dataset_type) from a DIFFERENT source (e.g. Anaheim,
 *     Santa Ana, the LA custom load) is SKIPPED and logged — never overwritten.
 *
 * Usage:
 *   node scripts/bulkLoadStateController.js --county "Orange" --fy 2023
 *   node scripts/bulkLoadStateController.js --county "Orange" --fy 2021 --fy 2022 --fy 2023
 *   node scripts/bulkLoadStateController.js --county "Orange" --fy 2023 --source-date 2026-06-14
 *   node scripts/bulkLoadStateController.js --county "Orange" --dry-run --list-cities
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATASETS = {
  expenditures: { id: 'ju3w-4gxp', type: 'operating', label: 'Expenditures', pageUrl: 'https://bythenumbers.sco.ca.gov/d/ju3w-4gxp' },
  revenues:     { id: 'rrtv-rsj9', type: 'revenue',   label: 'Revenues',     pageUrl: 'https://bythenumbers.sco.ca.gov/d/rrtv-rsj9' },
};

/** The data_source label this loader writes (the "ByTheNumbers source" for collision checks). */
function runSourceName(ds) { return `CA State Controller - ${ds.label}`; }

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

/** Read-only: find an existing city municipality by name + state (null if new). */
async function findCityMunicipality(cityName, state) {
  const { data, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, population, population_year, county_id')
    .eq('state', state)
    .eq('entity_type', 'city')
    .eq('name', cityName)
    .limit(1);
  if (error) throw new Error(`Municipality lookup failed for ${cityName}: ${error.message}`);
  return (data && data[0]) || null;
}

/**
 * Read-only: return an existing budget row that this run would COLLIDE with.
 *
 * ⚠ SCOPE-02 narrowed this. It used to treat any row for (muni, fy, dataset) from
 * a different source as a collision and skip — which is why SCO's published
 * all-funds actuals for Fresno FY2020-2024, Riverside/Santa Ana FY2023-2024 and
 * Oakland FY2024 were never loaded: a city adopted-budget row held the key.
 * Those are DIFFERENT figures (all-funds actuals vs an adopted General Fund
 * budget), not competing versions of the same one, and the widened unique index
 * now lets both exist.
 *
 * A collision is now only a row occupying this run's exact identity — same
 * fund_scope AND basis — from a different source.
 */
async function findConflictingBudget(municipalityId, fiscalYear, datasetType, sourceName) {
  const { data, error } = await supabase
    .schema('treasury')
    .from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType)
    .eq('fund_scope', 'all_funds')
    .eq('basis', 'actual')
    .limit(1);
  if (error) throw new Error(`Budget lookup failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  if (existing.data_source && existing.data_source !== sourceName) return existing;
  return null;
}

async function importCityData(cityName, state, population, rows, fiscalYear, datasetType, ds, fetchDate) {
  // Ensure municipality exists (creates with feed population when provided)
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: cityName, p_state: state, p_entity_type: 'city', p_population: population || 0,
  });
  if (munErr) { console.error(`    Municipality error: ${munErr.message}`); return null; }

  // Backfill population on existing cities with 0/NULL population (never lower a
  // non-zero population to 0; only write when the feed provides a value).
  if (population && population > 0) {
    const { error: popErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update({ population, population_year: fiscalYear })
      .eq('id', municipalityId)
      .or('population.is.null,population.eq.0');
    if (popErr) console.warn(`    Population backfill warning for ${cityName}: ${popErr.message}`);
  }

  // Build tree from hierarchy: category -> subcategory_1 -> subcategory_2/line_description
  const tree = new Map();
  for (const row of rows) {
    const a = amt(row.value);
    if (a === 0) continue;  // skip zero-value rows
    const cat = row.category || 'Unknown';
    const sub1 = row.subcategory_1 || 'General';
    if (!tree.has(cat)) tree.set(cat, new Map());
    const catNode = tree.get(cat);
    if (!catNode.has(sub1)) catNode.set(sub1, []);
    catNode.get(sub1).push({
      d: row.line_description || row.subcategory_2 || sub1,
      a,
      aa: a,
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

  // Write the per-city budget tree with durable source attribution (Phase 52-01 RPC params).
  const { data: result, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year: fiscalYear,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: jsonTree,
    p_row_count: rows.length,
    p_data_source_name: runSourceName(ds),
    p_source_url: ds.pageUrl,
    p_source_date: fetchDate,
    // SCOPE-02: the SCO Annual Report is citywide all funds (Modesto FY2024 ties
    // to the dollar) and reports a closed year's actuals.
    p_fund_scope: 'all_funds',
    p_basis: 'actual',
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
      city:   { type: 'string' },
      'exclude-city': { type: 'string', multiple: true },
      fy: { type: 'string', short: 'y', multiple: true },
      type: { type: 'string', short: 't' },
      'source-date': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'list-cities': { type: 'boolean' },
    },
    strict: false,
  });

  const county = values.county || 'Los Angeles';
  const cityFilter = values.city || null;
  // Cities to exclude entirely from a county load (case-insensitive). Used to keep
  // flagship custom-source cities (e.g. San Jose, Fresno, Bakersfield) from getting
  // SCO history backfilled onto years their richer custom budget doesn't cover —
  // which would create a misleading basis-mismatch trend. Those cities are still
  // county-linked + salaried + enriched separately; the never-overwrite guard alone
  // can't protect the empty years, so they're suppressed here. (Chris decision: the
  // 12 named custom cities get salaries+enrichment only, no SCO backfill.)
  const excludeSet = new Set((values['exclude-city'] || []).map(c => c.trim().toLowerCase()));
  const state = 'CA';
  const fiscalYears = values.fy ? values.fy.map(Number) : [2023];
  const types = values.type ? [values.type] : ['expenditures', 'revenues'];
  const dryRun = values['dry-run'] ?? false;
  const listCities = values['list-cities'] ?? false;
  // Fetch date computed ONCE per run (never inside the per-city loop); overridable.
  const fetchDate = values['source-date'] || new Date().toISOString().slice(0, 10);

  console.log(`\n🏛️  CA State Controller Bulk Loader (hardened)`);
  console.log(`   County: ${county}`);
  if (cityFilter) console.log(`   City filter: ${cityFilter}`);
  if (excludeSet.size) console.log(`   Excluding (custom-source, no backfill): ${[...excludeSet].join(', ')}`);
  console.log(`   Fiscal Years: ${fiscalYears.join(', ')}`);
  console.log(`   Types: ${types.join(', ')}`);
  console.log(`   Source date: ${fetchDate}${values['source-date'] ? '' : ' (today)'}\n`);

  for (const dsType of types) {
    const ds = DATASETS[dsType];
    if (!ds) { console.error(`Unknown type: ${dsType}`); continue; }
    const srcName = runSourceName(ds);

    for (const fy of fiscalYears) {
      console.log(`\n📊 ${ds.label} FY ${fy} — ${county} County`);

      const where = cityFilter
        ? `entity_name='${cityFilter}' AND fiscal_year='${fy}'`
        : `county='${county}' AND fiscal_year='${fy}'`;
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

      if (listCities) {
        for (const [city, data] of [...byCity.entries()].sort()) {
          console.log(`    ${city}: ${data.rows.length} rows, pop ${data.population.toLocaleString()}`);
        }
      }

      // Collision pre-pass: classify every city BEFORE any write so SKIP lines
      // show in dry-run too and no overwrite ever occurs.
      let citiesImported = 0, totalItems = 0, skippedCount = 0;
      const wouldImport = [];
      for (const [cityName, cityData] of byCity) {
        if (excludeSet.has(cityName.trim().toLowerCase())) {
          console.log(`  EXCLUDE ${cityName} (${state}) — flagship custom-source city, SCO backfill suppressed`);
          skippedCount++;
          continue;
        }
        const existing = await findCityMunicipality(cityName, state);
        if (existing) {
          const conflict = await findConflictingBudget(existing.id, fy, ds.type, srcName);
          if (conflict) {
            console.log(`  SKIP ${cityName} (${state}) — existing ${conflict.data_source} data preserved`);
            skippedCount++;
            continue;
          }
        }
        wouldImport.push([cityName, cityData]);
      }

      if (dryRun) {
        console.log(`  (dry run — skipping import) ${wouldImport.length} cities would import, ${skippedCount} skipped (existing other-source data preserved)`);
        continue;
      }

      for (const [cityName, cityData] of wouldImport) {
        const result = await importCityData(cityName, state, cityData.population, cityData.rows, fy, ds.type, ds, fetchDate);
        if (result && result.rows_inserted) {
          totalItems += result.rows_inserted;
          citiesImported++;
          process.stdout.write(`\r  Imported ${citiesImported}/${wouldImport.length} cities (${totalItems.toLocaleString()} items)...`);
        }
      }
      console.log(`\n  ✅ ${citiesImported} cities imported, ${totalItems.toLocaleString()} items; ${skippedCount} skipped (other-source data preserved)`);
    }
  }

  console.log('\n🎉 State Controller import complete!\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
