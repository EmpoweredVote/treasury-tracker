#!/usr/bin/env node
/**
 * Creates the Travis County and City of Austin rows in treasury.municipalities.
 *
 * Order matters: Travis County must exist first so Austin.county_id can point
 * at it. Idempotent — re-running updates the existing rows rather than
 * duplicating.
 *
 * ENTITY TYPE: 'city' / 'county', NOT 'municipality'.
 *   The table carries both conventions — 858 rows use 'city' and 30 use
 *   'municipality'. The 'municipality' rows are the legacy Plano-era Texas
 *   cohort; every milestone since (Tucson, Seattle, Bainbridge, the MN/OH/VA
 *   bulk loads) uses 'city', and Tucson — the closest precedent, a lone city
 *   linked to its county — is 'city' with county_id set. New work follows the
 *   dominant, current convention. The pre-existing TX 'municipality' rows are
 *   deliberately NOT rewritten here: that would be a silent migration of 30
 *   other entities riding along with an unrelated onboarding.
 *
 * The Utah phantom-row defect this guards against: a load run without the
 * right entity type silently creates a SECOND row of the same name, and the
 * app then shows one entity twice with the data split between them. The
 * post-seed assertion below is what catches that.
 *
 * geo_id and hero_image_url are left NULL, matching Tucson, Seattle, King
 * County and the state nodes.
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

export const TRAVIS_NAME = 'Travis County';
export const AUSTIN_NAME = 'Austin';

/**
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage `scripts/loadTXPopulation.js` already uses for the
 * twelve existing Texas cities, so Austin is comparable with its siblings.
 *
 *   Austin:         sub-est2024_48.csv, SUMLEV=162 (whole place) "Austin city",
 *                   POPESTIMATE2024 -> 993,588.
 *
 *                   Read the SUMLEV=162 row, not a SUMLEV=157 county-part row.
 *                   Austin straddles THREE counties and the file splits it:
 *                   Travis 922,309 + Williamson 70,212 + Hays 1,067 = 993,588.
 *                   Taking the Travis part alone would understate the city by
 *                   71,279 people and quietly skew every per-capita figure.
 *
 *   Travis County:  co-est2024-alldata.csv, SUMLEV=050 "Travis County",
 *                   POPESTIMATE2024 -> 1,363,767.
 *
 * The county straddle is also why Austin.county_id -> Travis is a
 * PREDOMINANCE claim, not an identity: 92.8% of Austin's population is in
 * Travis County, and Travis is the county of the city's seat of government.
 */
const POPULATION = { [TRAVIS_NAME]: 1363767, [AUSTIN_NAME]: 993588 };
const POPULATION_YEAR = 2024;

async function upsertEntity({ name, entityType, countyId }) {
  const population = POPULATION[name];
  if (!Number.isInteger(population)) {
    throw new Error(`POPULATION[${name}] is not set — read it from the Census vintage 2024 files first.`);
  }
  const { data: existing } = await db.from('municipalities')
    .select('id').eq('name', name).eq('state', 'TX').maybeSingle();

  const row = {
    name, state: 'TX', entity_type: entityType, population,
    population_year: POPULATION_YEAR, county_id: countyId,
  };

  const q = existing
    ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
    : db.from('municipalities').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw new Error(`${name}: ${error.message}`);
  console.log(`  ${existing ? 'Updated' : 'Created'} ${name}, TX (${entityType}) ${data.id} pop ${population.toLocaleString()}`);
  return data.id;
}

const travisId = await upsertEntity({ name: TRAVIS_NAME, entityType: 'county', countyId: null });
await upsertEntity({ name: AUSTIN_NAME, entityType: 'city', countyId: travisId });

// Phantom-row guard (see header): exactly two TX rows, exactly one of each type.
const { data: all } = await db.from('municipalities')
  .select('name, entity_type, county_id').eq('state', 'TX').in('name', [TRAVIS_NAME, AUSTIN_NAME]);
if (all.length !== 2) {
  console.error(`Expected exactly 2 rows, found ${all.length}:`, all);
  process.exit(1);
}
const austin = all.find((r) => r.name === AUSTIN_NAME);
if (austin.entity_type !== 'city' || austin.county_id !== travisId) {
  console.error('Austin is not a city linked to Travis County:', austin);
  process.exit(1);
}

// There is already an "Austin" in MN (from the MN OSA bulk load). Confirm the
// two are distinct rows, since a name-only lookup anywhere downstream would
// otherwise silently pick the wrong city.
const { data: namesakes } = await db.from('municipalities')
  .select('id, name, state, entity_type').eq('name', AUSTIN_NAME);
console.log(`\n  "Austin" rows across all states: ${namesakes.map((r) => `${r.state}/${r.entity_type}`).join(', ')}`);

console.log('\nSeed OK.');
