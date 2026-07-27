#!/usr/bin/env node
/**
 * Oregon Cities Municipality Seeder — Bend + six Washington County cities
 *
 * Creates (or updates) the municipality rows for:
 *   Beaverton, Cornelius, Hillsboro, Sherwood, Tigard, Tualatin (Washington County)
 *   Bend (Deschutes County)
 *
 * NOTE: data_source rows are NOT created here. Per the seedTroutdaleOregon.js /
 * seedPimaMunicipalities.js convention, data_source rows are owned by the
 * per-city loader so a base seeder row cannot collide with per-FY loader rows.
 *
 * NOTE: county_id is left NULL. Oregon has no county navigation nodes in TT yet
 * (Portland, Gresham and Troutdale are all unlinked), so there is nothing to
 * link to. If Washington County / Deschutes County nodes are added later, a
 * follow-up linker should set county_id — this seeder never invents a county node.
 *
 * Idempotent: safe to re-run. Rows are resolved by the table's real unique key
 * (name, state, entity_type) and updated in-place; inserts only when absent.
 *
 * Usage:
 *   set -a; . ./.env; set +a; node scripts/seedWashingtonCountyOregonCities.js
 *   node scripts/seedWashingtonCountyOregonCities.js --dry-run   (no writes)
 *
 * Population + geo_id source (single file, no auth):
 *   Census Population Estimates Program, Subcounty Resident Population Estimates
 *   vintage 2024 — sub-est2024_41.csv (Oregon), SUMLEV=162 incorporated places,
 *   column POPESTIMATE2024.
 *   https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_41.csv
 *   geo_id = STATE(41) + PLACE fips, matching the 7-digit format already used by
 *   the CA city rows (e.g. Berkeley = 0606000).
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// ── Entity payloads ──────────────────────────────────────────────────────
// POPESTIMATE2024 / PLACE fips straight from sub-est2024_41.csv, SUMLEV=162.
// `county` is documentation only — there is no OR county node to link to yet.
const CITIES = [
  { name: 'Beaverton',  state: 'OR', entity_type: 'city', population:  98302, population_year: 2024, geo_id: '4105350', county: 'Washington' },
  { name: 'Bend',       state: 'OR', entity_type: 'city', population: 106926, population_year: 2024, geo_id: '4105800', county: 'Deschutes'  },
  { name: 'Cornelius',  state: 'OR', entity_type: 'city', population:  15369, population_year: 2024, geo_id: '4115550', county: 'Washington' },
  { name: 'Hillsboro',  state: 'OR', entity_type: 'city', population: 110337, population_year: 2024, geo_id: '4134100', county: 'Washington' },
  { name: 'Sherwood',   state: 'OR', entity_type: 'city', population:  20441, population_year: 2024, geo_id: '4167100', county: 'Washington' },
  { name: 'Tigard',     state: 'OR', entity_type: 'city', population:  57301, population_year: 2024, geo_id: '4173650', county: 'Washington' },
  { name: 'Tualatin',   state: 'OR', entity_type: 'city', population:  28036, population_year: 2024, geo_id: '4174950', county: 'Washington' },
];

// Strip the doc-only field before writing.
const toRow = ({ county, ...row }) => row;

// ── Idempotent upsert keyed on the real unique index (name, state, entity_type) ──
async function upsertMunicipality(c) {
  const row = toRow(c);

  const { data: existing, error: selectErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year, geo_id')
    .eq('name', row.name)
    .eq('state', row.state)
    .eq('entity_type', row.entity_type)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting municipality "${row.name}, ${row.state}": ${selectErr.message}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(existing?.id
      ? `  DRY-RUN would UPDATE ${existing.id} (pop ${existing.population} -> ${row.population}, geo_id ${existing.geo_id ?? 'null'} -> ${row.geo_id})`
      : `  DRY-RUN would INSERT new row`);
    return existing?.id ?? null;
  }

  let data, error;
  if (existing?.id) {
    ({ data, error } = await supabase
      .from('municipalities')
      .update(row)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
      .from('municipalities')
      .insert(row)
      .select());
    if (!error) console.log(`  (inserted new municipality row)`);
  }

  if (error) {
    console.error(`  ERROR writing municipality "${row.name}": ${error.message}`);
    process.exit(1);
  }

  const written = data?.[0];
  if (!written) {
    console.error(`  ERROR: no row returned for municipality "${row.name}"`);
    process.exit(1);
  }
  return written.id;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding 7 Oregon cities — municipality rows only${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);
  console.log('NOTE: no data_source rows are created here; the per-city loader owns those.');
  console.log('NOTE: county_id stays NULL — Oregon has no county nodes in TT yet.\n');

  for (const c of CITIES) {
    console.log(`Upserting: ${c.name}, ${c.state} (pop ${c.population}, 2024, ${c.county} County)`);
    const id = await upsertMunicipality(c);
    console.log(`  id: ${id ?? '(none — dry run insert)'}\n`);
  }

  if (DRY_RUN) {
    console.log('Dry run complete — nothing written.');
    return;
  }

  // ── Verify postconditions ──────────────────────────────────────────────
  console.log('Verifying...');
  let ok = true;

  for (const c of CITIES) {
    const { data, error } = await supabase
      .from('municipalities')
      .select('id, population, population_year, geo_id, county_id')
      .eq('name', c.name)
      .eq('state', 'OR')
      .eq('entity_type', 'city');

    if (error) { console.error(`  ERROR: ${error.message}`); process.exit(1); }
    if (data.length !== 1) {
      console.error(`  ERROR: expected 1 ${c.name}, OR city row, found ${data.length}`);
      ok = false;
      continue;
    }

    const r = data[0];
    const good = r.population === c.population
      && r.population_year === 2024
      && r.geo_id === c.geo_id;
    if (!good) ok = false;
    console.log(`  ${good ? 'OK ' : 'BAD'} ${c.name}: id=${r.id} pop=${r.population}/${r.population_year} geo_id=${r.geo_id}`);
  }

  if (!ok) {
    console.error('\nFAILED: one or more postcondition checks did not match.');
    process.exit(1);
  }
  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
