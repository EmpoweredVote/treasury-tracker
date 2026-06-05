#!/usr/bin/env node
/**
 * Fresno + Riverside CA Data Sources Seeder (Phase 30)
 *
 * Performs the following (all idempotent):
 *   A. Upsert Fresno municipality row (population=550000, population_year=2024)
 *   B. Upsert Riverside municipality row (population=324000, population_year=2024)
 *   C. Upsert four data_source rows:
 *        - 'Fresno General Fund Operating Budget'    (api_type='pdf_download', dataset_type='operating')
 *        - 'Fresno General Fund Revenue Budget'      (api_type='pdf_download', dataset_type='revenue')
 *        - 'Riverside General Fund Operating Budget' (api_type='pdf_download', dataset_type='operating')
 *        - 'Riverside General Fund Revenue Budget'   (api_type='pdf_download', dataset_type='revenue')
 *   D. Verification: calls treasury_list_source_ids RPC and asserts all four names appear.
 *      Exits non-zero if any are missing.
 *
 * Population values from Census sub-est2024_06.csv (SUMLEV=162, California sub-county estimates).
 * Fresno county_id stays NULL — Fresno County not loaded (deferred per CONTEXT.md).
 * Riverside county_id stays NULL — Riverside County not loaded (deferred per CONTEXT.md).
 * NOTE: This seeds the City of Riverside, NOT Riverside County (see Pitfall 6 in RESEARCH.md).
 *
 * Usage:
 *   node scripts/seedFresnoRiversideCA.js
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
// POPUL-01: Fresno ~550K, Riverside ~324K, both population_year=2024
// county_id for Fresno: stays NULL — Fresno County not loaded (deferred per CONTEXT.md)
// county_id for Riverside: stays NULL — Riverside County not loaded (deferred per CONTEXT.md)
// NOTE: Riverside refers to the City of Riverside (pop ~324K), NOT Riverside County (pop ~2.4M)
const MUNICIPALITIES = [
  {
    name:            'Fresno',
    state:           'CA',
    entity_type:     'city',
    population:      550000,
    population_year: 2024,
    // county_id stays NULL — Fresno County not loaded (deferred)
  },
  {
    name:            'Riverside',
    state:           'CA',
    entity_type:     'city',
    population:      324000,
    population_year: 2024,
    // county_id stays NULL — Riverside County not loaded (deferred)
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
  console.log('Seeding Fresno + Riverside CA (Phase 30) — municipalities + data_sources...\n');

  // ── Step A+B: Upsert Fresno and Riverside municipalities ──────────────────
  console.log(`Upserting municipality: ${MUNICIPALITIES[0].name}, ${MUNICIPALITIES[0].state}`);
  const fresnoId = await upsertMunicipality(MUNICIPALITIES[0]);
  console.log(`  id: ${fresnoId}\n`);

  console.log(`Upserting municipality: ${MUNICIPALITIES[1].name}, ${MUNICIPALITIES[1].state}`);
  const riversideId = await upsertMunicipality(MUNICIPALITIES[1]);
  console.log(`  id: ${riversideId}\n`);

  // ── Step C: Upsert four data_source rows ─────────────────────────────────
  // These canonical named rows are what treasury_list_source_ids and the app depend on.
  // Per-FY pdf_download rows (with dataset_id = `fy${year}`) are created by processFresno.js
  // and processRiverside.js — do NOT create per-FY rows here.
  // IMPORTANT: These exact name strings are the contract that Plan 2 / Plan 3 processors
  // look up via treasury_list_source_ids — they must match character-for-character.
  const dataSources = [
    {
      name:            'Fresno General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'fresno-gf-operating',
      base_url:        'https://www.fresno.gov/finance/city-budget/',
      municipality_id: fresnoId,
    },
    {
      name:            'Fresno General Fund Revenue Budget',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'fresno-gf-revenue',
      base_url:        'https://www.fresno.gov/finance/city-budget/',
      municipality_id: fresnoId,
    },
    {
      name:            'Riverside General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'riverside-gf-operating',
      base_url:        'https://www.riversideca.gov/finance/budget',
      municipality_id: riversideId,
    },
    {
      name:            'Riverside General Fund Revenue Budget',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'riverside-gf-revenue',
      base_url:        'https://www.riversideca.gov/finance/budget',
      municipality_id: riversideId,
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
    'Fresno General Fund Operating Budget',
    'Fresno General Fund Revenue Budget',
    'Riverside General Fund Operating Budget',
    'Riverside General Fund Revenue Budget',
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
