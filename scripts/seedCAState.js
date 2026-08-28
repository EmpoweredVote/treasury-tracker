#!/usr/bin/env node
/**
 * California State Seeder (Phase 33)
 *
 * Performs the following (all idempotent):
 *   A. Upsert California municipality row (entity_type='state', population=39500000,
 *      population_year=2024, state='CA')
 *   B. Upsert one data_source row:
 *        - 'California General Fund Operating Budget'
 *          (api_type='xlsx_download', dataset_type='operating',
 *           dataset_id='ca-lao-gf-operating',
 *           base_url='https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *   C. Verification: lists every source (paged) and asserts the source appears.
 *      Exits non-zero if missing.
 *
 * California is a state-level entity (entity_type='state' accepted by Phase 32 CHECK constraint).
 * county_id stays NULL — states don't belong to a county.
 * fiscal_years [2022,2023,2024,2025,2026] = FY2021-22 through FY2025-26 (5 FYs to match trend depth).
 *
 * Usage:
 *   node scripts/seedCAState.js
 *
 * Env vars:
 *   SUPABASE_URL         - Supabase project URL (defaults to project URL)
 *   SUPABASE_SERVICE_KEY - Service role key (also accepts SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { listAllSourcesResult } from './lib/listAllSources.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ──────────────────────────────────────────────────────────────
// Reads ../.env.local then ../.env, sets process.env keys not already present.
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`  loadEnv: unexpected error reading ${f}: ${e.message}`);
      }
    }
  }
}
loadEnv();

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Municipality payload ─────────────────────────────────────────────────────
// Phase 32 CHECK constraint accepts 'state' as a valid entity_type value.
// county_id stays NULL — states don't belong to a county.
// Population: 2024 Census estimate (~39.5M CA total resident population).
const CALIFORNIA = {
  name:            'California',
  state:           'CA',
  entity_type:     'state',
  population:      39500000,
  population_year: 2024,
  // county_id: omitted — states don't belong to a county
};

// ── Data source payload ─────────────────────────────────────────────────────
// Single canonical row (not per-FY). municipality_id injected after upsert.
// fiscal_years = [2022,2023,2024,2025,2026] = FY2021-22 through FY2025-26.
// api_type='xlsx_download' — LAO Excel file, read by extractCA.py + processCA.js.
const DATA_SOURCE_TEMPLATE = {
  name:            'California General Fund Operating Budget',
  api_type:        'xlsx_download',
  dataset_type:    'operating',
  dataset_id:      'ca-lao-gf-operating',
  base_url:        'https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx',
  fiscal_years:    [2022, 2023, 2024, 2025, 2026],
  // municipality_id: injected in main() after upsertMunicipality()
};

// ── Idempotent upsert for municipality: SELECT by name+state → INSERT or UPDATE ──
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

// ── Idempotent upsert for data_source: SELECT by name → INSERT or UPDATE ──
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

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding California state (Phase 33) — municipality + data_source...\n');

  // ── Step A: Upsert California state municipality ──────────────────────────
  console.log(`Upserting municipality: ${CALIFORNIA.name}, ${CALIFORNIA.state} (entity_type=${CALIFORNIA.entity_type})`);
  const caStateId = await upsertMunicipality(CALIFORNIA);
  console.log(`  id: ${caStateId}\n`);

  // ── Step B: Upsert data_source row ───────────────────────────────────────
  const dataSources = [
    { ...DATA_SOURCE_TEMPLATE, municipality_id: caStateId },
  ];

  console.log('Upserting data_source rows...');
  for (const src of dataSources) {
    console.log(`  Upserting: ${src.name}`);
    const row = await upsertDataSourceByName(src);
    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }
    console.log(`  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}\n`);
  }

  // ── Step C: Verification via listAllSources (paged) ────────────────────
  console.log('Verifying via listAllSources (paged, cap-proof)...');
  const { data: listing, error: listErr } = await listAllSourcesResult(supabase);
  if (listErr) {
    console.error(`  ERROR: ${listErr.message}`);
    process.exit(1);
  }

  const expectedNames = [
    'California General Fund Operating Budget',
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
    console.error('\nERROR: expected source not found in treasury.data_sources');
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
