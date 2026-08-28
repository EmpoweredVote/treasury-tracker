#!/usr/bin/env node
/**
 * Sacramento CA Data Sources Seeder (Phase 26)
 *
 * Performs three operations (all idempotent):
 *   A. Update Sacramento municipality population = 536000, population_year = 2024.
 *      Does NOT insert a new row (Sacramento already exists). Does NOT touch the
 *      county FK set by Phase 25 — only population and population_year are updated.
 *
 *   B. Upsert two data_sources rows required by loadSacramentoCSV.js:
 *        - 'Sacramento Operating Budget'  (dataset_type='operating', api_type='csv_download')
 *        - 'Sacramento Revenue Budget'    (dataset_type='revenue',   api_type='csv_download')
 *      Both rows set municipality_id to the Sacramento UUID (loader reads ds.municipality_id).
 *
 *   C. Upsert one source_registry row named 'open-budget-sacramento'.
 *      source_registry is in the treasury schema and not directly accessible via the default
 *      PostgREST schema; if insert fails, logs a warning and continues (attribution is
 *      non-blocking — the loader tolerates a null sourceRegistryId).
 *
 *   D. Verification block: lists every source (paged) and asserts both Sacramento
 *      source names appear. Exits non-zero if either is missing.
 *
 * Usage:
 *   node scripts/seedSacramentoCA.js
 *
 * Env vars:
 *   SUPABASE_URL         - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Service role key (also accepts SUPABASE_SERVICE_ROLE_KEY)
 *
 * Attribution: Open Budget Sacramento (https://openbudgetsac.org), MIT license
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { listAllSourcesResult } from './lib/listAllSources.mjs';
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
    } catch {}
  }
}
loadEnv();

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL env var');
  process.exit(1);
}
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ─────────────────────────────────────────────────────────────────
/** Sacramento municipality UUID — confirmed in scripts/seedLACountyLinks.js (Phase 25) */
const SACRAMENTO_ID = '9722596e-1102-4aca-8758-c32fc0c1731d';

const GITHUB_BASE = 'https://raw.githubusercontent.com/opensacorg/openbudgetsac.org/main/_src/data/flow';

// ── Idempotent data_source upsert ─────────────────────────────────────────────
async function upsertDataSourceByName(src) {
  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting "${src.name}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;

  if (existing?.id) {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing row ${existing.id})`);
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Sacramento CA (Phase 26) — municipality population + data_sources + source_registry...\n');

  // ── Step A: Update Sacramento municipality population ──────────────────────
  console.log('Step A: Updating Sacramento municipality population...');

  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, state, population, population_year')
    .eq('id', SACRAMENTO_ID)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting Sacramento municipality: ${selectErr.message}`);
    process.exit(1);
  }

  if (!existing) {
    console.error(`  ERROR: Sacramento municipality (id=${SACRAMENTO_ID}) not found — expected to exist from a prior phase`);
    process.exit(1);
  }

  console.log(`  Found: ${existing.name}, ${existing.state} (id=${existing.id})`);
  console.log(`  Current: population=${existing.population}, population_year=${existing.population_year}`);

  // Update ONLY population and population_year — the county FK (Phase 25) is preserved
  const { error: updateErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .update({ population: 536000, population_year: 2024 })
    .eq('id', SACRAMENTO_ID);

  if (updateErr) {
    console.error(`  ERROR updating Sacramento population: ${updateErr.message}`);
    process.exit(1);
  }

  console.log('  OK: population set to 536000, population_year=2024\n');

  // ── Step B: Upsert two data_sources rows ──────────────────────────────────
  console.log('Step B: Upserting Sacramento data_sources rows...');

  const dataSources = [
    {
      name: 'Sacramento Operating Budget',
      dataset_type: 'operating',
      api_type: 'csv_download',
      base_url: GITHUB_BASE,
      municipality_id: SACRAMENTO_ID,
      fiscal_years: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    },
    {
      name: 'Sacramento Revenue Budget',
      dataset_type: 'revenue',
      api_type: 'csv_download',
      base_url: GITHUB_BASE,
      municipality_id: SACRAMENTO_ID,
      fiscal_years: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    },
  ];

  for (const src of dataSources) {
    console.log(`  Upserting: ${src.name}`);
    const row = await upsertDataSourceByName(src);
    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }
    console.log(`  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}\n`);
  }

  // ── Step C: Upsert source_registry row ────────────────────────────────────
  // NOTE: source_registry is in the treasury schema and not exposed via the default
  // PostgREST schema (confirmed Phase 24). Access via supabase.schema('treasury') is
  // available for SELECT (loader uses it) but may deny writes via RLS.
  // Attribution is non-blocking — loader tolerates a null sourceRegistryId.
  console.log('Step C: Upserting open-budget-sacramento source_registry row...');

  // First, check if the row already exists (the loader does this same SELECT)
  const { data: srExisting, error: srSelectErr } = await supabase
    .schema('treasury')
    .from('source_registry')
    .select('id')
    .eq('name', 'open-budget-sacramento')
    .maybeSingle();

  if (srSelectErr) {
    console.warn(`  WARNING: source_registry SELECT failed (${srSelectErr.message}). Attribution will be null — non-blocking.`);
  } else if (srExisting?.id) {
    console.log(`  OK: source_registry row already exists (id=${srExisting.id})`);
  } else {
    // Attempt insert — log warning on failure (non-blocking per plan)
    const { data: srInserted, error: srInsertErr } = await supabase
      .schema('treasury')
      .from('source_registry')
      .insert({
        name: 'open-budget-sacramento',
        url: 'https://openbudgetsac.org',
      })
      .select('id')
      .maybeSingle();

    if (srInsertErr) {
      console.warn(`  WARNING: source_registry insert failed (${srInsertErr.message}) [code=${srInsertErr.code}]. Attribution will be null — non-blocking.`);
    } else if (srInserted?.id) {
      console.log(`  OK: source_registry row inserted (id=${srInserted.id})`);
    } else {
      console.warn('  WARNING: source_registry insert returned no row. Attribution will be null — non-blocking.');
    }
  }
  console.log('');

  // ── Step D: Verification via listAllSources (paged) ─────────────────────
  console.log('Step D: Verifying via listAllSources (paged, cap-proof)...');

  const { data: listing, error: listErr } = await listAllSourcesResult(supabase);
  if (listErr) {
    console.error(`  ERROR: ${listErr.message}`);
    process.exit(1);
  }

  const expectedNames = [
    'Sacramento Operating Budget',
    'Sacramento Revenue Budget',
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
    console.error('\nERROR: one or more expected Sacramento sources not found in treasury.data_sources');
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
