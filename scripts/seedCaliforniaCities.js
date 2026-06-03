#!/usr/bin/env node
/**
 * California Cities Data Sources Seeder (Phase 16)
 *
 * Creates (or updates) the rows that drive Phase 16 California live loads:
 *
 *   Municipalities:
 *     - San Francisco, CA (population 827,526, year 2024)
 *     - San Diego, CA     (population 1,404,452, year 2024)
 *     (Los Angeles, CA already exists from Phase 15 — reused, NOT modified.)
 *
 *   Data sources (5 total):
 *     - 'San Francisco Operating Budget' — Socrata (dataset xdgd-c79v), operating rows
 *     - 'San Francisco Revenue Budget'   — Socrata (dataset xdgd-c79v), revenue rows
 *     - 'San Diego Operating Budget'     — CSV download seshat.datasd.org, operating rows
 *     - 'San Diego Revenue Budget'       — CSV download seshat.datasd.org, revenue rows
 *     - 'Los Angeles Revenue Budget'     — Socrata (dataset vvm4-a2zu), integer fiscal year
 *
 * Idempotent: safe to re-run. Looks up rows by name and updates them in-place;
 * inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedCaliforniaCities.js
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Municipality payloads ───────────────────────────────────────────────
// Populations from 16-RESEARCH.md, Census sub-est2024_6.csv, SUMLEV=162
const MUNICIPALITIES = [
  { name: 'San Francisco', state: 'CA', entity_type: 'city', population: 827526, population_year: 2024 },
  { name: 'San Diego',     state: 'CA', entity_type: 'city', population: 1404452, population_year: 2024 },
];

// ── Idempotent upsert for municipality: select by name+state → insert or update ──
async function upsertMunicipality(m) {
  // Check if a row with this name + state already exists
  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id')
    .eq('name', m.name)
    .eq('state', m.state)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting municipality "${m.name}, ${m.state}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;

  if (existing?.id) {
    // Row exists — update it in-place (preserves id, created_at, etc.)
    ({ data, error } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    // Row does not exist — insert it
    ({ data, error } = await supabase
      .schema('treasury')
      .from('municipalities')
      .insert(m)
      .select());
    if (!error) console.log(`  (inserted new municipality row)`);
  }

  if (error) {
    console.error(`  ERROR writing municipality "${m.name}": ${error.message}`);
    process.exit(1);
  }

  const row = data?.[0];
  if (!row) {
    console.error(`  ERROR: no row returned for municipality "${m.name}"`);
    process.exit(1);
  }

  return row.id;
}

// ── Lookup existing municipality (must already exist — does NOT insert or update) ──
async function getExistingMunicipalityId(name, state) {
  const { data, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id')
    .eq('name', name)
    .eq('state', state)
    .maybeSingle();
  if (error) { console.error(`  ERROR fetching ${name}, ${state}: ${error.message}`); process.exit(1); }
  if (!data?.id) {
    console.error(`  ERROR: ${name}, ${state} not found — expected to exist from a prior phase`);
    process.exit(1);
  }
  return data.id;
}

// ── Idempotent upsert: select by name (or dataset_id+municipality_id) → insert or update ──
// Falls back to dataset_id + municipality_id lookup if a prior row exists under a different name
// (handles pre-existing rows seeded before this script existed).
async function upsertDataSourceByName(src) {
  // Primary lookup: by name
  const { data: existingByName, error: selectErrByName } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (selectErrByName) {
    console.error(`  ERROR selecting "${src.name}": ${selectErrByName.message}`);
    process.exit(1);
  }

  // Note: this script omits the dataset_id+municipality_id fallback lookup that seedLADataSources.js
  // uses for pre-existing renamed rows. Phase 16 sources have no pre-existing rows, and SF Op + SF Rev
  // (as well as SD Op + SD Rev) intentionally share (dataset_id, municipality_id) — that pair is not
  // a unique key here. Primary name lookup is sufficient and safe.
  const existingId = existingByName?.id;

  let data, error;

  if (existingId) {
    // Row exists — update it in-place (preserves id, created_at, etc.)
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existingId)
      .select());
    if (!error) console.log(`  (updated existing row ${existingId})`);
  } else {
    // Row does not exist — insert it
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .insert(src)
      .select());
    if (!error) console.log(`  (inserted new row)`);
  }

  if (error) {
    console.error(`  ERROR writing "${src.name}": ${error.message}`);
    process.exit(1);
  }

  return data?.[0];
}

// ── Data source factory functions ────────────────────────────────────────
// Column mappings MUST match keys consumed by bulkLoadBudget.js (Plan 16-01)
// and loadSanDiegoCSV.js (Plan 16-02) exactly.

function SF_OPERATING(municipalityId) {
  return {
    name: 'San Francisco Operating Budget',
    api_type: 'socrata',
    dataset_type: 'operating',
    base_url: 'https://data.sfgov.org',
    dataset_id: 'xdgd-c79v',
    column_mapping: {
      fiscal_year_column: 'fiscal_year',
      approved_amount_column: 'budget',
      actual_amount_column: null,
      category_column: 'department',
      subcategory_column: 'fund_type',
      where_extra: "AND revenue_or_spending='Spending'",
    },
    fiscal_years: [2025, 2026],
    municipality_id: municipalityId,
  };
}

// SF Revenue: spreads SF_OPERATING, overrides name, dataset_type, and where_extra
function SF_REVENUE(municipalityId) {
  return {
    ...SF_OPERATING(municipalityId),
    name: 'San Francisco Revenue Budget',
    dataset_type: 'revenue',
    column_mapping: {
      ...SF_OPERATING(municipalityId).column_mapping,
      where_extra: "AND revenue_or_spending='Revenue'",
    },
  };
}

function SD_OPERATING(municipalityId) {
  return {
    name: 'San Diego Operating Budget',
    api_type: 'csv_download',
    dataset_type: 'operating',
    base_url: 'https://seshat.datasd.org/operating_budget/budget_operating_datasd.csv',
    dataset_id: 'budget_operating_datasd', // descriptive label; CSV does not have a Socrata 4x4
    column_mapping: {
      fiscal_year_column: 'report_fy',
      approved_amount_column: 'amount',
      actual_amount_column: null,
      category_column: 'dept_name',
      subcategory_column: 'account',
      account_number_column: 'account_number',
      budget_cycle_column: 'budget_cycle',
      budget_cycle_value: 'adopted',
    },
    // FY2026 rows in the source CSV have empty budget_cycle — loader returns 0 rows under adopted filter.
    // Only FY2025 is loadable until San Diego labels FY2026 rows with a cycle value.
    fiscal_years: [2025],
    municipality_id: municipalityId,
  };
}

// SD Revenue mirrors SD Operating exactly; only name and dataset_type differ
function SD_REVENUE(municipalityId) {
  return {
    ...SD_OPERATING(municipalityId),
    name: 'San Diego Revenue Budget',
    dataset_type: 'revenue',
  };
}

function LA_REVENUE(municipalityId) {
  return {
    name: 'Los Angeles Revenue Budget',
    api_type: 'socrata',
    dataset_type: 'revenue',
    base_url: 'https://controllerdata.lacity.org',   // controllerdata, NOT data.lacity.org — Phase 15 Pitfall #1
    dataset_id: 'vvm4-a2zu',
    column_mapping: {
      fiscal_year_column: 'fiscal_year',
      approved_amount_column: 'revenue_budget',
      actual_amount_column: null,
      category_column: 'department_name',
      subcategory_column: 'revenue_source_name',
      fiscal_year_type: 'integer',                   // critical — activates integer WHERE clause in bulkLoadBudget.js
    },
    fiscal_years: [2025, 2026],
    municipality_id: municipalityId,
  };
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding California cities (Phase 16) — SF, SD municipalities + SF/SD/LA-revenue data_sources...\n');

  // ── Step 1: Upsert SF + SD municipalities (LA exists from Phase 15) ───
  const muniIds = {};
  for (const m of MUNICIPALITIES) {
    console.log(`Upserting municipality: ${m.name}, ${m.state}`);
    muniIds[m.name] = await upsertMunicipality(m);
    console.log(`  id: ${muniIds[m.name]}\n`);
  }

  // ── Step 2: Lookup existing LA municipality (must NOT be modified) ────
  console.log('Looking up existing municipality: Los Angeles, CA');
  const laId = await getExistingMunicipalityId('Los Angeles', 'CA');
  muniIds['Los Angeles'] = laId;
  console.log(`  id: ${laId} (reused from Phase 15 — not modified)\n`);

  // ── Step 3: Upsert all 5 data_sources rows ───────────────────────────
  const sources = [
    SF_OPERATING(muniIds['San Francisco']),
    SF_REVENUE(muniIds['San Francisco']),
    SD_OPERATING(muniIds['San Diego']),
    SD_REVENUE(muniIds['San Diego']),
    LA_REVENUE(muniIds['Los Angeles']),
  ];

  for (const src of sources) {
    console.log(`Upserting data_source: ${src.name}`);
    const row = await upsertDataSourceByName(src);
    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }
    console.log(`  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}  fiscal_years=${JSON.stringify(row.fiscal_years)}\n`);
  }

  // ── Step 4: Verification via treasury_list_source_ids ────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) { console.error(`  ERROR: ${listErr.message}`); process.exit(1); }

  const expectedNames = [
    'San Francisco Operating Budget',
    'San Francisco Revenue Budget',
    'San Diego Operating Budget',
    'San Diego Revenue Budget',
    'Los Angeles Revenue Budget',
  ];

  let allFound = true;
  for (const name of expectedNames) {
    const hit = (listing || []).find(r => r.name === name);
    if (hit) {
      console.log(`  OK: ${name} (api_type=${hit.api_type}, type=${hit.dataset_type})`);
    } else {
      console.log(`  MISSING: ${name}`);
      allFound = false;
    }
  }

  if (!allFound) {
    console.error(`\nERROR: one or more expected sources not found in treasury_list_source_ids`);
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
