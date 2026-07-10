#!/usr/bin/env node
/**
 * Tucson, Arizona Municipality Seeder (Phase 129-01)
 *
 * Creates (or updates) the municipality row for Tucson, AZ.
 * NOTE: data_source rows are owned by processTucson.js (Phase 129-02, one
 * ephemeral row per fiscal year, WR-05/LOAD-01 lifecycle). This seeder
 * intentionally does NOT create any data_source rows, avoiding dataset_id
 * collisions between a base seeder row and the per-FY loader rows (the
 * seedGreshamOregon.js convention).
 *
 * Idempotent: safe to re-run. Looks up the row by name+state and updates it
 * in-place; inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedTucsonArizona.js
 *
 * Population source: Census Population Estimates Program, Vintage 2024
 * sub-county file (www2.census.gov/programs-surveys/popest/datasets/
 * 2020-2024/cities/totals/sub-est2024.csv), SUMLEV=162, STATE=04, PLACE=77000,
 * NAME="Tucson city, Arizona" -> POPESTIMATE2024 = 554013.
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// ── Municipality payload ─────────────────────────────────────────────────
// Population from Census Vintage 2024 sub-county estimates (sub-est2024.csv),
// STATE=04, PLACE=77000, "Tucson city, Arizona" -> POPESTIMATE2024 = 554013.
const TUCSON = {
  name: 'Tucson',
  state: 'AZ',
  entity_type: 'city',
  population: 554013,
  population_year: 2024,
};

// ── Idempotent upsert for municipality: select by name+state → insert or update ──
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
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
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
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

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Tucson, AZ (Phase 129-01) — municipality only...\n');
  console.log('NOTE: data_source rows are created by processTucson.js (Phase 129-02).\n');

  // ── Step 1: Upsert Tucson municipality ──────────────────────────────
  console.log(`Upserting municipality: ${TUCSON.name}, ${TUCSON.state}`);
  const tucsonId = await upsertMunicipality(TUCSON);
  console.log(`  id: ${tucsonId}\n`);

  // ── Step 2: Verify municipality row ────────────────────────────────
  const { data: muniCheck, error: muniCheckErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year')
    .eq('name', 'Tucson')
    .eq('state', 'AZ')
    .eq('entity_type', 'city');

  if (muniCheckErr) { console.error(`  ERROR: ${muniCheckErr.message}`); process.exit(1); }
  if (muniCheck.length !== 1) {
    console.error(`  ERROR: expected 1 Tucson, AZ row, found ${muniCheck.length}`);
    process.exit(1);
  }
  const mc = muniCheck[0];
  console.log(`  OK: Tucson, AZ municipality (id=${mc.id}, population=${mc.population}, population_year=${mc.population_year})`);

  if (mc.population !== TUCSON.population) {
    console.error(`  WARNING: expected population ${TUCSON.population}, got ${mc.population}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
