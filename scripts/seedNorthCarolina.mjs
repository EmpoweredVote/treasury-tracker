#!/usr/bin/env node
/**
 * Creates the four NC-DURHAM-AVL-01 rows in treasury.municipalities — North
 * Carolina's first LOCAL entities (the state previously had only its state
 * node, from the state-ACFR arc).
 *
 * Order matters: both COUNTIES must exist before their cities, so each city's
 * `county_id` can point at one. Idempotent — re-running updates the existing
 * rows rather than duplicating.
 *
 * ENTITY TYPE: 'city' / 'county', NOT 'municipality'. The table carries both
 * conventions; 'municipality' is the legacy Plano-era Texas cohort and every
 * milestone since (Tucson, Seattle, Bainbridge, Austin/Travis, Colorado
 * Springs/El Paso, the MN/OH/VA bulk loads) uses 'city'. New work follows the
 * dominant, current convention.
 *
 * The Utah phantom-row defect this guards against: a load run without the right
 * entity type silently creates a SECOND row of the same name, and the app then
 * shows one entity twice with the data split between them. The post-seed
 * assertion below is what catches that.
 *
 * ⚠ NAME COLLISION, and why `state` is in every lookup key here. "Durham" is
 * also a town in Connecticut and New Hampshire, and TT already carries CT
 * entities. Matching a municipality by name alone would be ambiguous the
 * moment either is loaded. Every read and write below filters on
 * (name, state, entity_type).
 *
 * geo_id and hero_image_url are left NULL, matching Tucson, Seattle, King
 * County, Austin/Travis, Colorado Springs/El Paso and the state nodes.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

export const DURHAM_COUNTY_NAME = 'Durham County';
export const DURHAM_CITY_NAME = 'Durham';
export const BUNCOMBE_COUNTY_NAME = 'Buncombe County';
export const ASHEVILLE_NAME = 'Asheville';
export const MECKLENBURG_COUNTY_NAME = 'Mecklenburg County';
export const CHARLOTTE_NAME = 'Charlotte';

/**
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage every other entity in this table uses, so these four are
 * comparable with the rest.
 *
 *   Durham city      sub-est2024_37.csv, SUMLEV=162 (whole place), PLACE=19000
 *                    -> 301,870.
 *
 *                    ⚠ STRADDLES THREE COUNTIES, like Austin. The SUMLEV=157
 *                    county-part rows are Durham 301,432 / Orange 145 / Wake
 *                    293, which sum to the whole-place figure. The WHOLE-PLACE
 *                    number is used because the ACFR being loaded reports the
 *                    whole city government, not the part of it inside one
 *                    county; using the county-part figure would understate the
 *                    denominator of every per-capita figure by 438 people.
 *                    `county_id` still points at Durham County, which holds
 *                    99.86% of the population.
 *
 *   Asheville city   sub-est2024_37.csv, SUMLEV=162, PLACE=02140 -> 94,992.
 *                    Does NOT straddle: the SUMLEV=157 Buncombe county-part row
 *                    is also 94,992, so county_id is an identity here.
 *
 *   Durham County    co-est2024-alldata.csv, SUMLEV=050, FIPS 37063 -> 343,628.
 *   Buncombe County  co-est2024-alldata.csv, SUMLEV=050, FIPS 37021 -> 279,210.
 *
 * ⚠ The NC places file is `sub-est2024_37.csv` — NC's FIPS is 37, a two-digit
 * code with no leading-zero ambiguity, so the `sub-est2024_8.csv` trap that
 * Colorado exposed cannot arise here. It is still worth checking any fetched
 * CSV actually parses as CSV: a 404 from this host is an HTML page, and saved
 * blindly to a `.csv` name it looks like a successful download.
 */
const POPULATIONS = {
  [DURHAM_CITY_NAME]: 301870,
  [DURHAM_COUNTY_NAME]: 343628,
  [ASHEVILLE_NAME]: 94992,
  [BUNCOMBE_COUNTY_NAME]: 279210,
  // Added by the Knight campaign, session 2 — same program and vintage as the
  // four above, so all six are comparable.
  //
  //   Charlotte city      sub-est2024_37.csv, SUMLEV=162, PLACE=12000 -> 943,476.
  //                       ⚠ Unlike Durham, Charlotte does NOT straddle counties:
  //                       its SUMLEV=157 Mecklenburg county-part row is ALSO
  //                       943,476, so `county_id` is an identity here and the
  //                       whole-place / county-part choice cannot change the
  //                       per-capita denominator.
  //   Mecklenburg County  co-est2024-alldata.csv, SUMLEV=050, FIPS 37119
  //                       -> 1,206,285.
  [CHARLOTTE_NAME]: 943476,
  [MECKLENBURG_COUNTY_NAME]: 1206285,
};

async function findOne(name, entityType) {
  const { data, error } = await db
    .from('municipalities')
    .select('id, name, state, entity_type, population, county_id')
    .eq('name', name).eq('state', 'NC').eq('entity_type', entityType);
  if (error) throw new Error(`lookup ${name}: ${error.message}`);
  if (data.length > 1) {
    throw new Error(`${data.length} rows already exist for (${name}, NC, ${entityType}) — `
      + 'refusing to guess which is canonical. This is the Utah phantom-row shape.');
  }
  return data[0] || null;
}

async function upsertEntity({ name, entityType, countyId = null }) {
  const population = POPULATIONS[name];
  if (population === undefined) throw new Error(`no Census population recorded for ${name}`);

  const existing = await findOne(name, entityType);
  const row = { name, state: 'NC', entity_type: entityType, population, county_id: countyId };

  if (existing) {
    const { error } = await db.from('municipalities').update(row).eq('id', existing.id);
    if (error) throw new Error(`update ${name}: ${error.message}`);
    console.log(`  UPDATED  ${name} (${entityType})  pop ${population.toLocaleString()}  ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await db.from('municipalities').insert(row).select('id').single();
  if (error) throw new Error(`insert ${name}: ${error.message}`);
  console.log(`  INSERTED ${name} (${entityType})  pop ${population.toLocaleString()}  ${data.id}`);
  return data.id;
}

export async function seed() {
  console.log('Seeding North Carolina local entities (NC-DURHAM-AVL-01 + Knight session 2)\n');

  // Counties first — the cities' county_id points at them.
  const durhamCountyId = await upsertEntity({ name: DURHAM_COUNTY_NAME, entityType: 'county' });
  const buncombeCountyId = await upsertEntity({ name: BUNCOMBE_COUNTY_NAME, entityType: 'county' });
  await upsertEntity({ name: DURHAM_CITY_NAME, entityType: 'city', countyId: durhamCountyId });
  await upsertEntity({ name: ASHEVILLE_NAME, entityType: 'city', countyId: buncombeCountyId });

  // Knight campaign session 2.
  const mecklenburgCountyId = await upsertEntity({
    name: MECKLENBURG_COUNTY_NAME, entityType: 'county',
  });
  await upsertEntity({
    name: CHARLOTTE_NAME, entityType: 'city', countyId: mecklenburgCountyId,
  });

  // ── Post-seed assertions ──────────────────────────────────────────────────
  // Every one of these has been a real defect somewhere in this table's
  // history, so they are checked rather than assumed.
  const { data: all, error } = await db
    .from('municipalities')
    .select('id, name, entity_type, population, county_id')
    .eq('state', 'NC').order('name');
  if (error) throw new Error(`verify: ${error.message}`);

  const problems = [];
  const wanted = [
    [DURHAM_CITY_NAME, 'city', durhamCountyId],
    [DURHAM_COUNTY_NAME, 'county', null],
    [ASHEVILLE_NAME, 'city', buncombeCountyId],
    [BUNCOMBE_COUNTY_NAME, 'county', null],
    [CHARLOTTE_NAME, 'city', mecklenburgCountyId],
    [MECKLENBURG_COUNTY_NAME, 'county', null],
  ];
  for (const [name, entityType, countyId] of wanted) {
    const hits = all.filter((m) => m.name === name && m.entity_type === entityType);
    if (hits.length !== 1) { problems.push(`${name} (${entityType}): ${hits.length} rows, expected 1`); continue; }
    const m = hits[0];
    if (m.population !== POPULATIONS[name]) {
      problems.push(`${name}: population ${m.population} != Census ${POPULATIONS[name]}`);
    }
    if (countyId && m.county_id !== countyId) {
      problems.push(`${name}: county_id ${m.county_id} != ${countyId}`);
    }
  }
  // The state node must still be exactly one row and must not have been touched.
  const states = all.filter((m) => m.entity_type === 'state');
  if (states.length !== 1 || states[0].name !== 'North Carolina') {
    problems.push(`expected exactly one NC state node, found ${states.length}`);
  }

  console.log(`\n  NC entities now in the table: ${all.map((m) => `${m.name} (${m.entity_type})`).join(', ')}`);
  if (problems.length) {
    console.error('\nSEED VERIFICATION FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nAll seed assertions passed.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
    || process.argv[1]?.endsWith('seedNorthCarolina.mjs')) {
  await seed();
}
