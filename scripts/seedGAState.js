#!/usr/bin/env node
/**
 * Georgia State Seeder
 *
 * Performs the following (all idempotent):
 *   A. Upsert Georgia municipality row (entity_type='state', population=10711908,
 *      population_year=2024, state='GA')
 *   B. Upsert two data_source rows:
 *        - 'Georgia General Fund Operating Budget'
 *          (api_type='pdf_download', dataset_type='operating',
 *           dataset_id='ga-gf-operating',
 *           base_url='https://opb.georgia.gov/budget-information/budget-documents/governors-budget-reports',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *        - 'Georgia General Fund Revenue'
 *          (api_type='pdf_download', dataset_type='revenue',
 *           dataset_id='ga-gf-revenue',
 *           base_url='https://opb.georgia.gov/budget-information/budget-documents/governors-budget-reports',
 *           fiscal_years=[2022,2023,2024,2025,2026])
 *   C. Verification: lists every source (paged) and asserts sources appear.
 *      Exits non-zero if missing.
 *
 * Georgia is a state-level entity (entity_type='state' accepted by Phase 32 CHECK constraint).
 * county_id stays NULL — states don't belong to a county.
 * fiscal_years [2022,2023,2024,2025,2026] = FY ending June 30 of each calendar year.
 *
 * Source: Governor's Office of Planning and Budget (opb.georgia.gov)
 *         Georgia Budget and Policy Institute (gbpi.org)
 *
 * Usage:
 *   node scripts/seedGAState.js
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
// Population: 2024 Census estimate (~10.7M GA total resident population).
const GEORGIA = {
  name:            'Georgia',
  state:           'GA',
  entity_type:     'state',
  population:      10711908,
  population_year: 2024,
  // county_id: omitted — states don't belong to a county
};

// ── Data source payloads ─────────────────────────────────────────────────────
// Two canonical rows (operating + revenue). municipality_id injected after upsert.
// fiscal_years = [2022,2023,2024,2025,2026] = FY ending June 30 of each year.
// api_type='pdf_download' — Governor's Budget Reports (PDF) from opb.georgia.gov.
const DATA_SOURCE_TEMPLATES = [
  {
    name:         'Georgia General Fund Operating Budget',
    api_type:     'pdf_download',
    dataset_type: 'operating',
    dataset_id:   'ga-gf-operating',
    base_url:     'https://opb.georgia.gov/budget-information/budget-documents/governors-budget-reports',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
    // municipality_id: injected in main() after upsertMunicipality()
  },
  {
    name:         'Georgia General Fund Revenue',
    api_type:     'pdf_download',
    dataset_type: 'revenue',
    dataset_id:   'ga-gf-revenue',
    base_url:     'https://opb.georgia.gov/budget-information/budget-documents/governors-budget-reports',
    fiscal_years: [2022, 2023, 2024, 2025, 2026],
    // municipality_id: injected in main() after upsertMunicipality()
  },
];

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
  console.log('Seeding Georgia state — municipality + data_source...\n');

  // ── Step A: Upsert Georgia state municipality ──────────────────────────
  console.log(`Upserting municipality: ${GEORGIA.name}, ${GEORGIA.state} (entity_type=${GEORGIA.entity_type})`);
  const gaStateId = await upsertMunicipality(GEORGIA);
  console.log(`  id: ${gaStateId}\n`);

  // ── Step B: Upsert data_source rows ───────────────────────────────────────
  const dataSources = DATA_SOURCE_TEMPLATES.map(t => ({ ...t, municipality_id: gaStateId }));

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
    'Georgia General Fund Operating Budget',
    'Georgia General Fund Revenue',
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
