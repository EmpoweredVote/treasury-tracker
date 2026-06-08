#!/usr/bin/env node
/**
 * Texas State Seeder
 *
 * Performs the following (all idempotent):
 *   A. Upsert Texas municipality row (entity_type='state', population=29145505,
 *      population_year=2024, state='TX')
 *   B. Upsert two data_source rows:
 *        - 'Texas General Fund Operating Budget'
 *          (api_type='pdf_download', dataset_type='operating',
 *           dataset_id='tx-gf-operating',
 *           base_url='https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *        - 'Texas General Fund Revenue'
 *          (api_type='html', dataset_type='revenue',
 *           dataset_id='tx-gf-revenue',
 *           base_url='https://comptroller.texas.gov/transparency/revenue/watch/general-revenue/',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *   C. Verification: calls treasury_list_source_ids RPC and asserts both sources appear.
 *      Exits non-zero if missing.
 *
 * Texas is a state-level entity (entity_type='state').
 * county_id stays NULL — states don't belong to a county.
 * Fiscal year ends August 31. Budget is biennial (split evenly across two years).
 * FY2022+FY2023 = 87th Leg; FY2024+FY2025 = 88th Leg; FY2026 = 89th Leg.
 *
 * Usage:
 *   node scripts/seedTXState.js
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
// Population: 29,145,505 (2020 Census); Texas does not have a 2024 estimate uniform yet.
const TEXAS = {
  name:            'Texas',
  state:           'TX',
  entity_type:     'state',
  population:      29145505,
  population_year: 2024,
  // county_id: omitted — states don't belong to a county
};

// ── Data source payloads ─────────────────────────────────────────────────────
const DATA_SOURCES = [
  {
    name:         'Texas General Fund Operating Budget',
    api_type:     'pdf_download',
    dataset_type: 'operating',
    dataset_id:   'tx-gf-operating',
    base_url:     'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
    // municipality_id: injected after upsert
  },
  {
    name:         'Texas General Fund Revenue',
    api_type:     'html',
    dataset_type: 'revenue',
    dataset_id:   'tx-gf-revenue',
    base_url:     'https://comptroller.texas.gov/transparency/revenue/watch/general-revenue/',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
    // municipality_id: injected after upsert
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
  console.log('Seeding Texas state — municipality + data_sources...\n');

  // Step A: Upsert Texas state municipality
  console.log(`Upserting municipality: ${TEXAS.name}, ${TEXAS.state} (entity_type=${TEXAS.entity_type})`);
  const txStateId = await upsertMunicipality(TEXAS);
  console.log(`  id: ${txStateId}\n`);

  // Step B: Upsert data_source rows
  console.log('Upserting data_source rows...');
  for (const src of DATA_SOURCES) {
    const payload = { ...src, municipality_id: txStateId };
    console.log(`  Upserting: ${payload.name}`);
    const row = await upsertDataSourceByName(payload);
    if (!row) {
      console.error(`  ERROR: no row returned for "${payload.name}"`);
      process.exit(1);
    }
    console.log(`  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}\n`);
  }

  // Step C: Verification via treasury_list_source_ids
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) {
    console.error(`  ERROR: ${listErr.message}`);
    process.exit(1);
  }

  const expectedNames = [
    'Texas General Fund Operating Budget',
    'Texas General Fund Revenue',
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
    console.error('\nERROR: expected source(s) not found in treasury_list_source_ids');
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
