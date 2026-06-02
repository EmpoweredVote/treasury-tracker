#!/usr/bin/env node
/**
 * Los Angeles Data Sources Seeder
 *
 * Creates (or updates):
 *   1. treasury.municipalities row for Los Angeles, CA (population 3878704, year 2024)
 *   2. treasury.data_sources row for the LA Operating Budget Socrata dataset (uyzw-yi8n)
 *
 * Idempotent: safe to re-run. Looks up existing rows by name and updates them
 * in-place; inserts only when the row does not exist yet.
 *
 * Revenue dataset 6cbx-e2fd is intentionally NOT seeded — only goes through FY2022
 * and contains 35 summary rows per year (not line-item data). See 15-RESEARCH.md.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedLADataSources.js
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seedLADataSources.js
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

// ── Los Angeles municipality payload ────────────────────────────────────
const LA_MUNICIPALITY = {
  name: 'Los Angeles',
  state: 'CA',
  entity_type: 'city',
  population: 3878704,
  population_year: 2024,
};

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

// ── LA data_sources payload factory ─────────────────────────────────────
// base_url MUST be controllerdata.lacity.org (NOT data.lacity.org) — Pitfall #1
function LA_DATA_SOURCE(municipalityId) {
  return {
    name: 'Los Angeles Operating Budget',
    api_type: 'socrata',
    dataset_type: 'operating',
    base_url: 'https://controllerdata.lacity.org',
    dataset_id: 'uyzw-yi8n',
    column_mapping: {
      fiscal_year_column: 'budget_fiscal_year',
      approved_amount_column: 'adopted_budget_amount',
      actual_amount_column: 'total_expenditures',
      category_column: 'department_name',
      subcategory_column: 'fund_name',
      where_extra: "AND adopted_budget_amount > 0",
    },
    fiscal_years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    municipality_id: municipalityId,
  };
}

// ── Idempotent upsert: select by name (or dataset_id+municipality_id) → insert or update ──
// Falls back to dataset_id + municipality_id lookup if a prior row exists under a different name
// (handles pre-existing "LA City Budget & Expenditures" row seeded before this script existed).
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

  // Fallback lookup: by dataset_id + municipality_id (handles renamed prior rows)
  let existingId = existingByName?.id;
  if (!existingId && src.dataset_id && src.municipality_id) {
    const { data: existingByDataset, error: selectErrByDataset } = await supabase
      .schema('treasury')
      .from('data_sources')
      .select('id, name')
      .eq('dataset_id', src.dataset_id)
      .eq('municipality_id', src.municipality_id)
      .maybeSingle();

    if (selectErrByDataset) {
      console.error(`  ERROR selecting by dataset_id: ${selectErrByDataset.message}`);
      process.exit(1);
    }

    if (existingByDataset?.id) {
      console.log(
        `  (found existing row by dataset_id with name="${existingByDataset.name}" — will rename to "${src.name}")`
      );
      existingId = existingByDataset.id;
    }
  }

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

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Los Angeles municipality + data_sources rows...\n');

  // Step 1: Upsert municipality FIRST (FK dependency — data_sources requires municipality_id)
  console.log(`Upserting municipality: ${LA_MUNICIPALITY.name}, ${LA_MUNICIPALITY.state}`);
  const laId = await upsertMunicipality(LA_MUNICIPALITY);
  console.log(`  id: ${laId}`);
  console.log('');

  // Step 2: Upsert the operating budget data_sources row using the resolved id
  const src = LA_DATA_SOURCE(laId);
  console.log(`Upserting data_source: ${src.name}`);

  const row = await upsertDataSourceByName(src);

  if (!row) {
    console.error(`  ERROR: no row returned for "${src.name}"`);
    process.exit(1);
  }

  console.log(`  id:           ${row.id}`);
  console.log(`  api_type:     ${row.api_type}`);
  console.log(`  dataset_type: ${row.dataset_type}`);
  console.log(`  dataset_id:   ${row.dataset_id}`);
  console.log(`  fiscal_years: ${JSON.stringify(row.fiscal_years)}`);
  console.log('');

  // ── Verification via treasury_list_source_ids RPC ─────────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');

  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');

  if (listErr) {
    console.error(`  ERROR calling treasury_list_source_ids: ${listErr.message}`);
    process.exit(1);
  }

  const laBudgetRows = (listing || []).filter(
    r =>
      r.api_type === 'socrata' &&
      r.dataset_type === 'operating' &&
      r.name?.startsWith('Los Angeles')
  );

  if (laBudgetRows.length !== 1) {
    console.error(
      `  ERROR: expected 1 Los Angeles operating budget source, got ${laBudgetRows.length}`
    );
    console.error('  Rows found:', JSON.stringify(laBudgetRows, null, 2));
    process.exit(1);
  }

  console.log(
    `  Verification: treasury_list_source_ids returns 1 Los Angeles operating budget source.`
  );
  for (const r of laBudgetRows) {
    console.log(`  - ${r.name} (${r.dataset_type}) id=${r.id}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
