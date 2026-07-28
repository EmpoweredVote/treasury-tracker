#!/usr/bin/env node
/**
 * Madison, WI + Dane County Data Model Seeder (Phase 136 / MAD-04)
 *
 * Creates (or updates) the municipality row for Madison, WI, seeds a Dane
 * County node under the existing Wisconsin state node, and links Madison to
 * Dane County via `county_id` (US -> Wisconsin -> Dane County -> Madison
 * breadcrumb + Cities-in-County panel).
 *
 * Mirrors scripts/seedTucsonArizona.js, with one deliberate difference:
 * Dane County is a FULL entity, not a navigation-only node. The CMREB
 * `Counties` sheet carries Dane's own revenue and expenditure data, so
 * loadWICMREB.js loads real budget rows for it in the same pass. (Pima County
 * in v2.17 had no such source and was left nav-only.)
 *
 * NOTE: this seeder intentionally creates NO data_source rows -- those are
 * owned by the loader (seedGreshamOregon.js / seedTucsonArizona.js convention).
 *
 * Idempotent: safe to re-run.
 *   - Madison: select by name+state -> update in place or insert.
 *   - Dane County: reuse-or-create, never duplicated.
 *   - Link: county_id set only when NULL or already Dane's id; never silently
 *     repointed if Madison is already linked to a different county.
 *
 * NAME COLLISION WARNING: the database already contains "Madison" (MN),
 * "Madison Lake" (MN), "Madison County" (OH) and "Madison County" (VA). Every
 * lookup here is qualified by state AND entity_type for that reason. A bare
 * name match would hit the wrong row.
 *
 * Population (MAD-04): taken from the CMREB workbook's own figures, which are
 * Wisconsin DOA estimates for the reporting year -- NOT Census, and not derived.
 * The bulletin warns a county figure may exceed the sum of its municipalities
 * because some cities/villages straddle county lines, so Dane's is taken as
 * printed rather than computed.
 *   - CMREB2024.xlsx, Cities sheet,   MADISON row -> Population = 291,037
 *   - CMREB2024.xlsx, Counties sheet, DANE row    -> Population = 599,930
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedWisconsinMadison.js [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
// treasury_ensure_municipality lives in the public schema.
const publicClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const MADISON = {
  name: 'Madison',
  state: 'WI',
  entity_type: 'city',
  population: 291037,
  population_year: 2024,
};

const DANE_COUNTY_NAME = 'Dane County';
const DANE_STATE = 'WI';
const DANE_POPULATION_2024 = 599930;

// ── Idempotent municipality upsert: select by name+state -> insert or update ──
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
    .from('municipalities')
    .select('id, entity_type, population')
    .eq('name', m.name)
    .eq('state', m.state)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting "${m.name}, ${m.state}": ${selectErr.message}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(existing?.id
      ? `  [dry-run] would UPDATE ${m.name}, ${m.state} [${existing.id}] -> pop ${m.population.toLocaleString()} (${m.population_year})`
      : `  [dry-run] would INSERT ${m.name}, ${m.state} (${m.entity_type}) pop ${m.population.toLocaleString()} (${m.population_year})`);
    return existing?.id ?? null;
  }

  let data, error;
  if (existing?.id) {
    ({ data, error } = await supabase.from('municipalities').update(m).eq('id', existing.id).select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase.from('municipalities').insert(m).select());
    if (!error) console.log('  (inserted new municipality row)');
  }
  if (error) {
    console.error(`  ERROR writing "${m.name}": ${error.message}`);
    process.exit(1);
  }
  const row = data?.[0];
  if (!row) {
    console.error(`  ERROR: no row returned for "${m.name}"`);
    process.exit(1);
  }
  return row.id;
}

// ── Reuse-or-create the Dane County entity ────────────────────────────────────
async function ensureDaneCounty() {
  const { data: existingCounty, error: cErr } = await supabase
    .from('municipalities')
    .select('id')
    .eq('state', DANE_STATE)
    .eq('entity_type', 'county')
    .ilike('name', DANE_COUNTY_NAME)
    .maybeSingle();

  if (cErr) {
    console.error(`  ERROR looking up "${DANE_COUNTY_NAME}": ${cErr.message}`);
    process.exit(1);
  }

  let countyId = existingCounty?.id ?? null;

  if (countyId) {
    console.log(`  Reusing existing county entity [${countyId}]`);
  } else if (DRY_RUN) {
    console.log(`  [dry-run] would CREATE "${DANE_COUNTY_NAME}, ${DANE_STATE}" (county) pop ${DANE_POPULATION_2024.toLocaleString()}`);
    return null;
  } else {
    const { data: newId, error: insErr } = await publicClient.rpc('treasury_ensure_municipality', {
      p_name: DANE_COUNTY_NAME,
      p_state: DANE_STATE,
      p_entity_type: 'county',
      p_population: DANE_POPULATION_2024,
    });
    if (insErr) {
      console.error(`  ERROR creating "${DANE_COUNTY_NAME}": ${insErr.message}`);
      process.exit(1);
    }
    countyId = newId;
    console.log(`  Created county entity [${countyId}]`);
  }

  if (DRY_RUN) return countyId;

  // treasury_ensure_municipality seeds population as 0 on some paths and never
  // sets population_year -- (re)set both explicitly on every run.
  const { error: popErr } = await supabase
    .from('municipalities')
    .update({ population: DANE_POPULATION_2024, population_year: 2024 })
    .eq('id', countyId);
  if (popErr) {
    console.error(`  ERROR setting Dane County population: ${popErr.message}`);
    process.exit(1);
  }
  console.log(`  Population set: ${DANE_POPULATION_2024.toLocaleString()} (2024)`);
  return countyId;
}

// ── Link Madison -> Dane County (NULL-or-same guard, never repoint) ───────────
async function linkMadisonToDane(madisonId, daneId) {
  const { data: madison, error: selErr } = await supabase
    .from('municipalities').select('id, county_id').eq('id', madisonId).single();
  if (selErr) {
    console.error(`  ERROR reading Madison's county_id: ${selErr.message}`);
    process.exit(1);
  }

  if (madison.county_id === daneId) {
    console.log('  Link outcome: already-linked');
    return 'already-linked';
  }
  if (madison.county_id == null) {
    const { error: updErr } = await supabase
      .from('municipalities').update({ county_id: daneId }).eq('id', madisonId);
    if (updErr) {
      console.error(`  ERROR linking Madison to Dane County: ${updErr.message}`);
      process.exit(1);
    }
    console.log('  Link outcome: linked (county_id was NULL -> Dane County id)');
    return 'linked';
  }
  console.log(`  Link outcome: skipped (Madison already linked to a different county_id=${madison.county_id})`);
  return 'skipped';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Madison, WI + Dane County seeder${DRY_RUN ? ' (dry-run)' : ''}\n`);

  // Show the collision set up front so a misfire is obvious in the log.
  const { data: collisions } = await supabase
    .from('municipalities').select('name, state, entity_type, id').ilike('name', '%madison%');
  console.log('  Existing "%madison%" rows (collision check):');
  for (const c of collisions ?? []) {
    console.log(`    ${c.name}, ${c.state} (${c.entity_type}) [${c.id}]`);
  }
  console.log();

  console.log(`Madison, WI:`);
  const madisonId = await upsertMunicipality(MADISON);
  console.log(`\n${DANE_COUNTY_NAME}, WI:`);
  const daneId = await ensureDaneCounty();

  if (DRY_RUN) {
    console.log('\n[dry-run] no writes performed.');
    return;
  }

  console.log('\nLinking:');
  const outcome = await linkMadisonToDane(madisonId, daneId);

  // Verify what we actually wrote rather than assuming the writes landed.
  const { data: check } = await supabase
    .from('municipalities')
    .select('id, name, state, entity_type, population, population_year, county_id')
    .in('id', [madisonId, daneId]);
  console.log('\nVerification:');
  for (const r of check ?? []) {
    console.log(`  ${r.name}, ${r.state} (${r.entity_type}) pop ${Number(r.population).toLocaleString()} ` +
      `(${r.population_year}) county_id=${r.county_id ?? 'NULL'} [${r.id}]`);
  }
  console.log(`\nDone. Madison=${madisonId} Dane=${daneId} link=${outcome}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
