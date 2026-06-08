#!/usr/bin/env node
/**
 * New York State Seeder
 *
 * Performs the following (all idempotent):
 *   A. Upsert New York state municipality row (entity_type='state', population=20201249,
 *      population_year=2024, state='NY')
 *   B. Upsert two data_source rows:
 *        - 'New York General Fund Operating Budget'
 *          (api_type='xlsx_download', dataset_type='operating',
 *           dataset_id='ny-gf-operating',
 *           base_url='https://openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *        - 'New York General Fund Revenue'
 *          (api_type='xlsx_download', dataset_type='revenue',
 *           dataset_id='ny-gf-revenue',
 *           base_url='https://openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *   C. Verification: calls treasury_list_source_ids RPC and asserts both sources appear.
 *      Exits non-zero if missing.
 *
 * New York State fiscal year runs April 1 to March 31.
 * SFY 2021-22 (ends March 31, 2022) = our FY2022.
 * General Fund data from New York State Division of the Budget enacted financial plan
 * tables (openbudget.ny.gov) and NY State Comptroller cash basis reports.
 *
 * Usage:
 *   node scripts/seedNYState.js
 *
 * Env vars:
 *   SUPABASE_URL         - Supabase project URL (defaults to project URL)
 *   SUPABASE_SERVICE_KEY - Service role key (also accepts SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ──────────────────────────────────────────────────────────────
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
// entity_type='state' accepted by Phase 32 CHECK constraint.
// county_id stays NULL — states don't belong to a county.
// Population: 20,201,249 (2020 Census); 2024 estimate ~19.8M but using Census figure.
const NEW_YORK = {
  name:            'New York',
  state:           'NY',
  entity_type:     'state',
  population:      20201249,
  population_year: 2024,
};

// ── Data source payloads ─────────────────────────────────────────────────────
// Source: NYS Division of the Budget enacted financial plan tables
// (openbudget.ny.gov — machine-readable Excel format).
// FY2022 = SFY 2021-22 (ends March 31, 2022)
// FY2026 = SFY 2025-26 (projected)
const DATA_SOURCES = [
  {
    name:         'New York General Fund Operating Budget',
    api_type:     'xlsx_download',
    dataset_type: 'operating',
    dataset_id:   'ny-gf-operating',
    base_url:     'https://openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
  },
  {
    name:         'New York General Fund Revenue',
    api_type:     'xlsx_download',
    dataset_type: 'revenue',
    dataset_id:   'ny-gf-revenue',
    base_url:     'https://openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
  },
];

// ── Idempotent upsert for municipality ───────────────────────────────────────
async function upsertMunicipality(m) {
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
    ({ data, error } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
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

// ── Idempotent upsert for data_source ────────────────────────────────────────
async function upsertDataSourceByName(src) {
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
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existingId)
      .select());
    if (!error) console.log(`  (updated existing row ${existingId})`);
  } else {
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
  console.log('Seeding New York state — municipality + data_sources...\n');

  // ── Step A: Upsert New York state municipality ────────────────────────────
  console.log(`Upserting municipality: ${NEW_YORK.name}, ${NEW_YORK.state} (entity_type=${NEW_YORK.entity_type})`);
  const nyStateId = await upsertMunicipality(NEW_YORK);
  console.log(`  id: ${nyStateId}\n`);

  // ── Step B: Upsert data_source rows ──────────────────────────────────────
  console.log('Upserting data_source rows...');
  for (const src of DATA_SOURCES) {
    console.log(`  Upserting: ${src.name}`);
    const row = await upsertDataSourceByName({ ...src, municipality_id: nyStateId });
    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }
    console.log(`  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}\n`);
  }

  // ── Step C: Verification via treasury_list_source_ids ────────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) {
    console.error(`  ERROR: ${listErr.message}`);
    process.exit(1);
  }

  const expectedNames = [
    'New York General Fund Operating Budget',
    'New York General Fund Revenue',
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
    console.error('\nERROR: expected source not found in treasury_list_source_ids');
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
