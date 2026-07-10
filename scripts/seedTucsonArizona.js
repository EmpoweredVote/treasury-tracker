#!/usr/bin/env node
/**
 * Tucson, Arizona + Pima County Data Model Seeder (Phase 129-01)
 *
 * Creates (or updates) the municipality row for Tucson, AZ, seeds a Pima
 * County navigation node under the existing Arizona state node, and links
 * Tucson to Pima County via `county_id` (US -> Arizona -> Pima County ->
 * Tucson breadcrumb + Cities-in-County panel).
 *
 * NOTE: data_source rows are owned by processTucson.js (Phase 129-02, one
 * ephemeral row per fiscal year, WR-05/LOAD-01 lifecycle). This seeder
 * intentionally does NOT create any data_source rows, avoiding dataset_id
 * collisions between a base seeder row and the per-FY loader rows (the
 * seedGreshamOregon.js convention).
 *
 * Idempotent: safe to re-run.
 *   - Tucson: select by name+state via .maybeSingle() -> update in-place or
 *     insert (seedGreshamOregon.js pattern).
 *   - Pima County: reuse-or-create via treasury_ensure_municipality
 *     (seedCountyLinks.js pattern) -> never duplicated.
 *   - Link: county_id is set only when NULL or already Pima's id (never
 *     silently repointed if Tucson is already linked to a different county).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedTucsonArizona.js
 *
 * Population sources (2024 vintage, Census Population Estimates Program):
 *   - Tucson city, AZ: Vintage 2024 sub-county file
 *     (www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv),
 *     SUMLEV=162, STATE=04, PLACE=77000, NAME="Tucson city, Arizona" ->
 *     POPESTIMATE2024 = 554013.
 *   - Pima County, AZ: Vintage 2024 county file
 *     (www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv),
 *     STATE=04, COUNTY=019, CTYNAME="Pima County" -> POPESTIMATE2024 = 1080149.
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
// treasury_ensure_municipality lives in the public schema.
const publicClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Entity payloads ───────────────────────────────────────────────────────
// Population from Census Vintage 2024 sub-county estimates (sub-est2024.csv),
// STATE=04, PLACE=77000, "Tucson city, Arizona" -> POPESTIMATE2024 = 554013.
const TUCSON = {
  name: 'Tucson',
  state: 'AZ',
  entity_type: 'city',
  population: 554013,
  population_year: 2024,
};

// Population from Census Vintage 2024 county estimates (co-est2024-alldata.csv),
// STATE=04, COUNTY=019, "Pima County, Arizona" -> POPESTIMATE2024 = 1080149.
const PIMA_COUNTY_NAME = 'Pima County';
const PIMA_STATE = 'AZ';
const PIMA_POPULATION_2024 = 1080149;

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

// ── Reuse-or-create the Pima County navigation node (seedCountyLinks.js pattern) ──
async function ensurePimaCounty() {
  const { data: existingCounty, error: cErr } = await supabase
    .from('municipalities')
    .select('id')
    .eq('state', PIMA_STATE)
    .eq('entity_type', 'county')
    .ilike('name', PIMA_COUNTY_NAME)
    .maybeSingle();

  if (cErr) {
    console.error(`  ERROR looking up "${PIMA_COUNTY_NAME}": ${cErr.message}`);
    process.exit(1);
  }

  let countyId = existingCounty?.id ?? null;

  if (countyId) {
    console.log(`  Reusing existing county entity [${countyId}]`);
  } else {
    const { data: newId, error: insErr } = await publicClient.rpc('treasury_ensure_municipality', {
      p_name: PIMA_COUNTY_NAME,
      p_state: PIMA_STATE,
      p_entity_type: 'county',
      p_population: PIMA_POPULATION_2024,
    });
    if (insErr) {
      console.error(`  ERROR creating "${PIMA_COUNTY_NAME}": ${insErr.message}`);
      process.exit(1);
    }
    countyId = newId;
    console.log(`  Created county entity [${countyId}]`);
  }

  // seedCountyLinks.js's treasury_ensure_municipality seeds county population
  // as 0 on some paths and does not set population_year -- (re)set the pinned
  // Census 2024 population + population_year explicitly here, every run.
  const { error: popErr } = await supabase
    .from('municipalities')
    .update({ population: PIMA_POPULATION_2024, population_year: 2024 })
    .eq('id', countyId);
  if (popErr) {
    console.error(`  ERROR setting Pima County population: ${popErr.message}`);
    process.exit(1);
  }
  console.log(`  Population set: ${PIMA_POPULATION_2024} (2024)`);

  return countyId;
}

// ── Link Tucson -> Pima County via county_id (NULL-or-same guard, never repoint) ──
async function linkTucsonToPima(tucsonId, pimaId) {
  const { data: tucson, error: selErr } = await supabase
    .from('municipalities')
    .select('id, county_id')
    .eq('id', tucsonId)
    .single();
  if (selErr) {
    console.error(`  ERROR reading Tucson's county_id: ${selErr.message}`);
    process.exit(1);
  }

  if (tucson.county_id === pimaId) {
    console.log('  Link outcome: already-linked (county_id already == Pima County id)');
    return 'already-linked';
  }

  if (tucson.county_id == null) {
    const { error: updErr } = await supabase
      .from('municipalities')
      .update({ county_id: pimaId })
      .eq('id', tucsonId);
    if (updErr) {
      console.error(`  ERROR linking Tucson to Pima County: ${updErr.message}`);
      process.exit(1);
    }
    console.log('  Link outcome: linked (county_id was NULL -> set to Pima County id)');
    return 'linked';
  }

  // Tucson already points at a DIFFERENT county -- never silently repoint.
  console.log(`  Link outcome: skipped (Tucson already linked to a different county_id=${tucson.county_id})`);
  return 'skipped';
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Tucson, AZ + Pima County (Phase 129-01) — data model only...\n');
  console.log('NOTE: data_source rows are created by processTucson.js (Phase 129-02).\n');

  // ── Step 1: Upsert Tucson municipality ──────────────────────────────
  console.log(`Upserting municipality: ${TUCSON.name}, ${TUCSON.state}`);
  const tucsonId = await upsertMunicipality(TUCSON);
  console.log(`  id: ${tucsonId}\n`);

  // ── Step 2: Reuse-or-create Pima County navigation node ─────────────
  console.log(`Ensuring county entity: ${PIMA_COUNTY_NAME}, ${PIMA_STATE}`);
  const pimaId = await ensurePimaCounty();
  console.log(`  id: ${pimaId}\n`);

  // ── Step 3: Link Tucson -> Pima County (NULL-or-same guard) ─────────
  console.log(`Linking ${TUCSON.name} -> ${PIMA_COUNTY_NAME}`);
  const linkOutcome = await linkTucsonToPima(tucsonId, pimaId);
  console.log('');

  // ── Step 4: Verify municipality rows ────────────────────────────────
  const { data: muniCheck, error: muniCheckErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year, county_id')
    .eq('name', 'Tucson')
    .eq('state', 'AZ')
    .eq('entity_type', 'city');

  if (muniCheckErr) { console.error(`  ERROR: ${muniCheckErr.message}`); process.exit(1); }
  if (muniCheck.length !== 1) {
    console.error(`  ERROR: expected 1 Tucson, AZ row, found ${muniCheck.length}`);
    process.exit(1);
  }
  const mc = muniCheck[0];
  console.log(`  OK: Tucson, AZ municipality (id=${mc.id}, population=${mc.population}, population_year=${mc.population_year}, county_id=${mc.county_id})`);

  if (mc.population !== TUCSON.population) {
    console.error(`  WARNING: expected population ${TUCSON.population}, got ${mc.population}`);
  }
  if (mc.county_id !== pimaId) {
    console.error(`  WARNING: expected county_id=${pimaId}, got ${mc.county_id} (link outcome was "${linkOutcome}")`);
  }

  const { data: pimaCheck, error: pimaCheckErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year')
    .eq('state', 'AZ')
    .eq('entity_type', 'county')
    .ilike('name', PIMA_COUNTY_NAME);
  if (pimaCheckErr) { console.error(`  ERROR: ${pimaCheckErr.message}`); process.exit(1); }
  if (pimaCheck.length !== 1) {
    console.error(`  ERROR: expected 1 Pima County, AZ row, found ${pimaCheck.length}`);
    process.exit(1);
  }
  const pc = pimaCheck[0];
  console.log(`  OK: Pima County, AZ (id=${pc.id}, population=${pc.population}, population_year=${pc.population_year})`);
  if (pc.population !== PIMA_POPULATION_2024) {
    console.error(`  WARNING: expected population ${PIMA_POPULATION_2024}, got ${pc.population}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
