#!/usr/bin/env node
/**
 * Long Beach + Bakersfield CA Data Sources Seeder (Phase 29)
 *
 * Performs the following (all idempotent):
 *   A. Upsert Long Beach municipality row (population=451000, population_year=2024, county_id=LA_COUNTY_ID)
 *   B. Upsert Bakersfield municipality row (population=417000, population_year=2024)
 *   C. Upsert four data_source rows:
 *        - 'Long Beach General Fund Operating Budget'   (api_type='pdf_download', dataset_type='operating')
 *        - 'Long Beach General Fund Revenue Budget'     (api_type='pdf_download', dataset_type='revenue')
 *        - 'Bakersfield Operating Budget'               (api_type='pdf_download', dataset_type='operating')
 *        - 'Bakersfield Revenue Budget'                 (api_type='pdf_download', dataset_type='revenue')
 *   D. Verification: calls treasury_list_source_ids RPC and asserts all four names appear.
 *      Exits non-zero if any are missing.
 *
 * Population values from Census sub-est2024_06.csv (SUMLEV=162, California sub-county estimates).
 * Long Beach county_id = LA_COUNTY_ID (Long Beach is one of the 88 LA County cities — Phase 25).
 * Bakersfield county_id stays NULL — Kern County not loaded (deferred per CONTEXT.md).
 *
 * Usage:
 *   node scripts/seedLongBeachBakersfieldCA.js
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
    } catch {}
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

// ── Municipality payloads ───────────────────────────────────────────────────
// Populations from Census sub-est2024_06.csv (SUMLEV=162, CA sub-county estimates)
// POPUL-01: Long Beach ~451K, Bakersfield ~417K, both population_year=2024
// Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01)
// Long Beach IS in LA County 88-city list (Phase 25); set county_id directly (verified line 63 seedLACountyLinks.js)
// Seeder comment documents non-standard FY period (D-02) — no DB schema change, no UI change
// county_id for Bakersfield: stays NULL — Kern County not loaded (deferred per CONTEXT.md)
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';  // verified: seedLACountyLinks.js line 36

const MUNICIPALITIES = [
  {
    name:            'Long Beach',
    state:           'CA',
    entity_type:     'city',
    population:      451000,
    population_year: 2024,
    county_id:       LA_COUNTY_ID,  // Long Beach IS in LA County; set directly (don't rely on Phase 25 re-run)
  },
  {
    name:            'Bakersfield',
    state:           'CA',
    entity_type:     'city',
    population:      417000,
    population_year: 2024,
    // county_id stays NULL — Kern County not loaded (deferred)
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
  console.log('Seeding Long Beach + Bakersfield CA (Phase 29) — municipalities + data_sources...\n');

  // ── Step A+B: Upsert Long Beach and Bakersfield municipalities ─────────────
  console.log(`Upserting municipality: ${MUNICIPALITIES[0].name}, ${MUNICIPALITIES[0].state}`);
  const longBeachId = await upsertMunicipality(MUNICIPALITIES[0]);
  console.log(`  id: ${longBeachId}\n`);

  console.log(`Upserting municipality: ${MUNICIPALITIES[1].name}, ${MUNICIPALITIES[1].state}`);
  const bakersfieldId = await upsertMunicipality(MUNICIPALITIES[1]);
  console.log(`  id: ${bakersfieldId}\n`);

  // ── Step C: Upsert four data_source rows ─────────────────────────────────
  // These canonical named rows are what treasury_list_source_ids and the app depend on.
  // Per-FY pdf_download rows (with dataset_id = `fy${year}`) are created by processLongBeach.js
  // and processBakersfield.js — do NOT create per-FY rows here.
  const dataSources = [
    {
      name:            'Long Beach General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'longbeach-gf-operating',
      base_url:        'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/',
      municipality_id: longBeachId,
    },
    {
      name:            'Long Beach General Fund Revenue Budget',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'longbeach-gf-revenue',
      base_url:        'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/',
      municipality_id: longBeachId,
    },
    {
      name:            'Bakersfield Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'bakersfield-operating',
      base_url:        'https://docs.bakersfieldcity.us/',
      municipality_id: bakersfieldId,
    },
    {
      name:            'Bakersfield Revenue Budget',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'bakersfield-revenue',
      base_url:        'https://docs.bakersfieldcity.us/',
      municipality_id: bakersfieldId,
    },
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

  // ── Step D: Verification via treasury_list_source_ids ────────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) {
    console.error(`  ERROR: ${listErr.message}`);
    process.exit(1);
  }

  const expectedNames = [
    'Long Beach General Fund Operating Budget',
    'Long Beach General Fund Revenue Budget',
    'Bakersfield Operating Budget',
    'Bakersfield Revenue Budget',
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
    console.error('\nERROR: one or more expected sources not found in treasury_list_source_ids');
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
