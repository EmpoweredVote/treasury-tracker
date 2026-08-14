#!/usr/bin/env node
/**
 * Seattle, WA + King County Data Model Seeder (Task 9)
 *
 * Creates (or updates) the municipality row for Seattle, WA, seeds a King
 * County node under the existing Washington state node, and links Seattle to
 * King County via `county_id` (US -> Washington -> King County -> Seattle
 * breadcrumb + Cities-in-County panel).
 *
 * Mirrors scripts/seedTucsonArizona.js / scripts/seedWisconsinMadison.js
 * (city-under-county shape). King County is a FULL entity, not a
 * navigation-only node: the King County ACFR extractor (Task 8, commit
 * 78cad11) loads real General Fund data for it in a later task.
 *
 * NOTE: this seeder intentionally creates NO data_source rows -- those are
 * owned by the loaders (processSeattle.js / processKingCounty.js, Tasks
 * 10-11), avoiding dataset_id collisions between a base seeder row and the
 * per-FY loader rows (the seedGreshamOregon.js convention).
 *
 * Idempotent: safe to re-run.
 *   - Seattle: select by name+state+entity_type -> update in place or insert.
 *   - King County: reuse-or-create via treasury_ensure_municipality, never
 *     duplicated.
 *   - Link: county_id is set only when NULL or already King County's id --
 *     never silently repointed if Seattle is already linked to a different
 *     county (see linkSeattleToKingCounty below).
 *
 * Population (Census Vintage 2024 Population Estimates Program, fetched live
 * at authoring time -- see printed source URLs in main()):
 *   - Seattle city, WA: www2.census.gov/programs-surveys/popest/datasets/
 *     2020-2024/cities/totals/sub-est2024.csv, STATE=53, COUNTY=033,
 *     PLACE=63000, NAME="Seattle city", STNAME="Washington" ->
 *     POPESTIMATE2024 = 780,995.
 *   - King County, WA: www2.census.gov/programs-surveys/popest/datasets/
 *     2020-2024/counties/totals/co-est2024-alldata.csv, STATE=53,
 *     COUNTY=033, CTYNAME="King County" -> POPESTIMATE2024 = 2,340,211.
 *
 * Usage:
 *   node --env-file=.env scripts/seedWashingtonSeattle.js [--dry-run]
 *   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, e.g. via .env)
 *
 * Exports (consumed by Tasks 10-12, which import these rather than
 * hardcoding IDs):
 *   - getSeattleId(supabase)
 *   - getKingCountyId(supabase)
 */

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Entity payloads ─────────────────────────────────────────────────────────
// Population from Census Vintage 2024 sub-county estimates (sub-est2024.csv),
// STATE=53, COUNTY=033, PLACE=63000, "Seattle city" -> POPESTIMATE2024 = 780995.
const SEATTLE = {
  name: 'Seattle',
  state: 'WA',
  entity_type: 'city',
  population: 780995,
  population_year: 2024,
};

// Population from Census Vintage 2024 county estimates (co-est2024-alldata.csv),
// STATE=53, COUNTY=033, "King County" -> POPESTIMATE2024 = 2340211.
const KING_COUNTY_NAME = 'King County';
const KING_COUNTY_STATE = 'WA';
const KING_COUNTY_POPULATION_2024 = 2340211;

// ── Idempotent upsert for municipality: select by name+state+entity_type ────
// -> insert or update. entity_type is included in the lookup because a bare
// name+state match is not guaranteed unique across entity types.
async function upsertMunicipality(supabase, m) {
  const { data: existing, error: selectErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year')
    .eq('name', m.name)
    .eq('state', m.state)
    .eq('entity_type', m.entity_type)
    .maybeSingle();

  if (selectErr) {
    throw new Error(`selecting municipality "${m.name}, ${m.state}": ${selectErr.message}`);
  }

  // Already correct -- skip the write entirely so a re-run is a true no-op,
  // not just an identical value written again.
  if (existing?.id && existing.population === m.population && existing.population_year === m.population_year) {
    console.log(`  no change (${m.name}, ${m.state} already at pop ${m.population.toLocaleString()}, ${m.population_year}) [${existing.id}]`);
    return existing.id;
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
    throw new Error(`writing municipality "${m.name}": ${error.message}`);
  }
  const row = data?.[0];
  if (!row) {
    throw new Error(`no row returned for municipality "${m.name}"`);
  }
  return row.id;
}

// ── Reuse-or-create the King County entity (seedCountyLinks.js pattern) ─────
async function ensureKingCounty(supabase, publicClient) {
  const { data: existingCounty, error: cErr } = await supabase
    .from('municipalities')
    .select('id')
    .eq('state', KING_COUNTY_STATE)
    .eq('entity_type', 'county')
    .ilike('name', KING_COUNTY_NAME)
    .maybeSingle();

  if (cErr) {
    throw new Error(`looking up "${KING_COUNTY_NAME}": ${cErr.message}`);
  }

  let countyId = existingCounty?.id ?? null;

  if (countyId) {
    console.log(`  Reusing existing county entity [${countyId}]`);
  } else if (DRY_RUN) {
    console.log(`  [dry-run] would CREATE "${KING_COUNTY_NAME}, ${KING_COUNTY_STATE}" (county) pop ${KING_COUNTY_POPULATION_2024.toLocaleString()}`);
    return null;
  } else {
    const { data: newId, error: insErr } = await publicClient.rpc('treasury_ensure_municipality', {
      p_name: KING_COUNTY_NAME,
      p_state: KING_COUNTY_STATE,
      p_entity_type: 'county',
      p_population: KING_COUNTY_POPULATION_2024,
    });
    if (insErr) {
      throw new Error(`creating "${KING_COUNTY_NAME}": ${insErr.message}`);
    }
    countyId = newId;
    console.log(`  Created county entity [${countyId}]`);
  }

  if (DRY_RUN) return countyId;

  // treasury_ensure_municipality seeds population as 0 on some paths and does
  // not set population_year -- (re)set the pinned Census 2024 population +
  // population_year explicitly, but only if it isn't already correct, so a
  // re-run is a true no-op rather than an identical value written again.
  const { data: current, error: curErr } = await supabase
    .from('municipalities').select('population, population_year').eq('id', countyId).single();
  if (curErr) {
    throw new Error(`reading King County population: ${curErr.message}`);
  }
  if (current.population === KING_COUNTY_POPULATION_2024 && current.population_year === 2024) {
    console.log(`  no change (population already ${KING_COUNTY_POPULATION_2024.toLocaleString()}, 2024)`);
    return countyId;
  }

  const { error: popErr } = await supabase
    .from('municipalities')
    .update({ population: KING_COUNTY_POPULATION_2024, population_year: 2024 })
    .eq('id', countyId);
  if (popErr) {
    throw new Error(`setting King County population: ${popErr.message}`);
  }
  console.log(`  Population set: ${KING_COUNTY_POPULATION_2024.toLocaleString()} (2024)`);

  return countyId;
}

/**
 * Link Seattle to King County under a NULL-or-same guard.
 *
 * The guard exists so a re-run can never REPOINT an entity that something else
 * already claimed. An unconditional update would silently move a city between
 * counties on any future run; failing loudly is the only safe response to an
 * unexpected existing value.
 */
async function linkSeattleToKingCounty(supabase, seattleId, kingCountyId) {
  const { data: row, error } = await supabase.schema('treasury').from('municipalities')
    .select('county_id').eq('id', seattleId).single();
  if (error) throw new Error(`Could not read Seattle's county_id: ${error.message}`);

  if (row.county_id === kingCountyId) { console.log('  county_id already correct - no change'); return; }
  if (row.county_id !== null) {
    throw new Error(
      `Seattle.county_id is already ${row.county_id}, not King County (${kingCountyId}). ` +
      `Refusing to repoint an existing link.`);
  }
  const { error: upErr } = await supabase.schema('treasury').from('municipalities')
    .update({ county_id: kingCountyId }).eq('id', seattleId).is('county_id', null);
  if (upErr) throw new Error(`county_id update failed: ${upErr.message}`);
  console.log(`  Linked Seattle -> King County (${kingCountyId})`);
}

// ── Exports consumed by Tasks 10-12 (import these rather than hardcoding IDs) ──
export async function getSeattleId(supabase) {
  const { data, error } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', SEATTLE.name)
    .eq('state', SEATTLE.state)
    .eq('entity_type', 'city')
    .single();
  if (error) throw new Error(`getSeattleId: ${error.message}`);
  return data.id;
}

export async function getKingCountyId(supabase) {
  const { data, error } = await supabase
    .from('municipalities')
    .select('id')
    .eq('state', KING_COUNTY_STATE)
    .eq('entity_type', 'county')
    .ilike('name', KING_COUNTY_NAME)
    .single();
  if (error) throw new Error(`getKingCountyId: ${error.message}`);
  return data.id;
}

// ── Main ─────────────────────────────────────────────────────────────────
/**
 * NOT ATOMIC: the Seattle upsert and the King County create/populate below
 * are two independent steps against the DB, not one transaction. A failure
 * between them (e.g. the treasury_ensure_municipality RPC call fails) can
 * leave Seattle inserted with no King County row and no county_id link yet.
 *
 * This is an ACCEPTED RISK, not a defect: every step here is idempotent
 * (upsertMunicipality/ensureKingCounty diff-before-write, and
 * linkSeattleToKingCounty's NULL-or-same guard makes relinking safe), so the
 * remedy for a mid-run failure is simply to re-run this script. A re-run
 * will skip whatever already landed and complete only what's missing.
 */
async function main() {
  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL env var');
  }
  if (!SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) env var');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
  // treasury_ensure_municipality lives in the public schema.
  const publicClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`Seattle, WA + King County seeder${DRY_RUN ? ' (dry-run)' : ''}\n`);
  console.log('Population sources (Census Vintage 2024 Population Estimates Program):');
  console.log('  Seattle:     https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv');
  console.log('               (STATE=53, COUNTY=033, PLACE=63000, NAME="Seattle city") -> 780,995');
  console.log('  King County: https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv');
  console.log('               (STATE=53, COUNTY=033, CTYNAME="King County") -> 2,340,211\n');

  // Show the collision set up front so a misfire is obvious in the log.
  const { data: collisions, error: collErr } = await supabase
    .from('municipalities').select('name, state, entity_type, id').eq('state', 'WA');
  if (collErr) throw new Error(`collision check failed: ${collErr.message}`);
  console.log('  Existing WA rows (collision check):');
  for (const c of collisions ?? []) {
    console.log(`    ${c.name}, ${c.state} (${c.entity_type}) [${c.id}]`);
  }
  console.log();

  console.log('Seattle, WA:');
  const seattleId = await upsertMunicipality(supabase, SEATTLE);
  console.log(`\n${KING_COUNTY_NAME}, WA:`);
  const kingCountyId = await ensureKingCounty(supabase, publicClient);

  if (DRY_RUN) {
    console.log('\n[dry-run] no writes performed.');
    return;
  }

  console.log('\nLinking:');
  await linkSeattleToKingCounty(supabase, seattleId, kingCountyId);

  // Verify what we actually wrote rather than assuming the writes landed.
  const { data: check, error: checkErr } = await supabase
    .from('municipalities')
    .select('id, name, state, entity_type, population, population_year, county_id')
    .in('id', [seattleId, kingCountyId]);
  if (checkErr) throw new Error(`verification query failed: ${checkErr.message}`);

  console.log('\nVerification:');
  for (const r of check ?? []) {
    console.log(`  ${r.name}, ${r.state} (${r.entity_type}) pop ${Number(r.population).toLocaleString()} ` +
      `(${r.population_year}) county_id=${r.county_id ?? 'NULL'} [${r.id}]`);
  }

  let verifyOk = true;
  const seattleRow = check?.find(r => r.id === seattleId);
  const countyRow = check?.find(r => r.id === kingCountyId);
  if (!seattleRow || seattleRow.population !== SEATTLE.population) {
    console.error(`  WARNING: Seattle population mismatch (expected ${SEATTLE.population})`);
    verifyOk = false;
  }
  if (!seattleRow || seattleRow.county_id !== kingCountyId) {
    console.error(`  WARNING: Seattle county_id mismatch (expected ${kingCountyId})`);
    verifyOk = false;
  }
  if (!countyRow || countyRow.population !== KING_COUNTY_POPULATION_2024) {
    console.error(`  WARNING: King County population mismatch (expected ${KING_COUNTY_POPULATION_2024})`);
    verifyOk = false;
  }
  if (!verifyOk) {
    throw new Error('one or more postcondition checks did not match - see WARNING lines above.');
  }

  console.log(`\nDone. Seattle=${seattleId} KingCounty=${kingCountyId}`);
}

// Only run main() when this file is executed directly (not when imported by
// Tasks 10-12 for getSeattleId/getKingCountyId). Compares resolved file URLs
// rather than raw strings so this works on Windows too (argv[1] "C:/..." vs.
// import.meta.url "file:///C:/...").
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
}
