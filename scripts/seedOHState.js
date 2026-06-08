#!/usr/bin/env node
/**
 * Ohio State Seeder
 *
 * Performs the following (all idempotent):
 *   A. Upsert Ohio municipality row (entity_type='state', population=11799448,
 *      population_year=2024, state='OH')
 *   B. Upsert two data_source rows:
 *        - 'Ohio General Fund Operating Budget'
 *          (api_type='pdf_download', dataset_type='operating',
 *           dataset_id='oh-gf-operating',
 *           base_url='https://www.lsc.ohio.gov/budget/',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *        - 'Ohio General Fund Revenue'
 *          (api_type='pdf_download', dataset_type='revenue',
 *           dataset_id='oh-gf-revenue',
 *           base_url='https://www.lsc.ohio.gov/publications/historical-revenues-and-expenditures',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *   C. Verification: calls treasury_list_source_ids RPC and asserts the sources appear.
 *      Exits non-zero if missing.
 *
 * Ohio is a state-level entity (entity_type='state').
 * county_id stays NULL — states don't belong to a county.
 * fiscal_years [2022,2023,2024,2025,2026] = FY2021-22 through FY2025-26.
 * Ohio fiscal year ends June 30.
 * GRF = General Revenue Fund (Ohio's primary operating fund).
 *
 * Usage:
 *   node scripts/seedOHState.js
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
const OHIO = {
  name:            'Ohio',
  state:           'OH',
  entity_type:     'state',
  population:      11799448,
  population_year: 2024,
  // county_id: omitted — states don't belong to a county
};

// ── Data source payloads ─────────────────────────────────────────────────────
// Two canonical rows — municipality_id injected after upsert.
const DATA_SOURCE_TEMPLATES = [
  {
    name:         'Ohio General Fund Operating Budget',
    api_type:     'pdf_download',
    dataset_type: 'operating',
    dataset_id:   'oh-gf-operating',
    base_url:     'https://www.lsc.ohio.gov/budget/',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
  },
  {
    name:         'Ohio General Fund Revenue',
    api_type:     'pdf_download',
    dataset_type: 'revenue',
    dataset_id:   'oh-gf-revenue',
    base_url:     'https://www.lsc.ohio.gov/publications/historical-revenues-and-expenditures',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
  },
];

// ── Idempotent upsert for municipality: SELECT by name+state → INSERT or UPDATE ──
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

// ── Idempotent upsert for data_source: SELECT by name → INSERT or UPDATE ──
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
  console.log('Seeding Ohio state — municipality + data_sources...\n');

  // ── Step A: Upsert Ohio state municipality ────────────────────────────────
  console.log(`Upserting municipality: ${OHIO.name}, ${OHIO.state} (entity_type=${OHIO.entity_type})`);
  const ohStateId = await upsertMunicipality(OHIO);
  console.log(`  id: ${ohStateId}\n`);

  // ── Step B: Upsert data_source rows ──────────────────────────────────────
  console.log('Upserting data_source rows...');
  for (const template of DATA_SOURCE_TEMPLATES) {
    const src = { ...template, municipality_id: ohStateId };
    console.log(`  Upserting: ${src.name}`);
    const row = await upsertDataSourceByName(src);
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
    'Ohio General Fund Operating Budget',
    'Ohio General Fund Revenue',
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
