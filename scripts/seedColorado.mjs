#!/usr/bin/env node
/**
 * Creates the El Paso County and City of Colorado Springs rows in
 * treasury.municipalities — the first CO LOCAL entities in the table (Colorado
 * previously had only its state node, from the state-ACFR arc).
 *
 * Order matters: El Paso County must exist first so Colorado Springs.county_id
 * can point at it. Idempotent — re-running updates the existing rows rather
 * than duplicating.
 *
 * ENTITY TYPE: 'city' / 'county', NOT 'municipality'. The table carries both
 * conventions; 'municipality' is the legacy Plano-era Texas cohort and every
 * milestone since (Tucson, Seattle, Bainbridge, Austin/Travis, the MN/OH/VA
 * bulk loads) uses 'city'. New work follows the dominant, current convention.
 *
 * The Utah phantom-row defect this guards against: a load run without the right
 * entity type silently creates a SECOND row of the same name, and the app then
 * shows one entity twice with the data split between them. The post-seed
 * assertion below is what catches that.
 *
 * geo_id and hero_image_url are left NULL, matching Tucson, Seattle, King
 * County, Austin/Travis and the state nodes.
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

export const EL_PASO_NAME = 'El Paso County';
export const SPRINGS_NAME = 'Colorado Springs';

/**
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage `scripts/loadTXPopulation.js` and `seedAustinTravis.mjs`
 * use, so these two are comparable with every other entity in the table.
 *
 *   Colorado Springs:  sub-est2024_8.csv, SUMLEV=162 (whole place)
 *                      "Colorado Springs city", POPESTIMATE2024 -> 493,554.
 *
 *                      NOTE THE FILENAME: `sub-est2024_8.csv`, with NO leading
 *                      zero on the state FIPS. `sub-est2024_08.csv` returns
 *                      HTTP 404 as an HTML error page — which, fetched blindly
 *                      to a `.csv` name, is the same trap as the PDF viewer
 *                      shells this milestone's fetcher guards against. Texas
 *                      (`_48`) never exposed it.
 *
 *                      Unlike Austin, this city does NOT straddle counties:
 *                      the SUMLEV=162 whole-place figure and the SUMLEV=157
 *                      El Paso county-part figure are BOTH 493,554, so
 *                      county_id is an identity here rather than the
 *                      predominance claim it is for Austin.
 *
 *   El Paso County:    co-est2024-alldata.csv, SUMLEV=050 "El Paso County",
 *                      POPESTIMATE2024 -> 752,772.
 *
 * These feed the loader's per-capita plausibility guard — the ONLY check that
 * can catch a wrong `units` multiplier, since the tie gate is structurally
 * blind to it. At FY2024 the true figures are ~$752/capita (Colorado Springs
 * General Fund revenue) and ~$409/capita (El Paso County); a 1000x slip lands
 * in the hundreds of thousands per resident and is rejected.
 */
const POPULATION = { [EL_PASO_NAME]: 752772, [SPRINGS_NAME]: 493554 };
const POPULATION_YEAR = 2024;

async function upsertEntity({ name, entityType, countyId }) {
  const population = POPULATION[name];
  if (!Number.isInteger(population)) {
    throw new Error(`POPULATION[${name}] is not set — read it from the Census vintage 2024 files first.`);
  }
  const { data: existing } = await db.from('municipalities')
    .select('id').eq('name', name).eq('state', 'CO').maybeSingle();

  const row = {
    name, state: 'CO', entity_type: entityType, population,
    population_year: POPULATION_YEAR, county_id: countyId,
  };

  const q = existing
    ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
    : db.from('municipalities').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw new Error(`${name}: ${error.message}`);
  console.log(`  ${existing ? 'Updated' : 'Created'} ${name}, CO (${entityType}) ${data.id} pop ${population.toLocaleString()}`);
  return data.id;
}

const elPasoId = await upsertEntity({ name: EL_PASO_NAME, entityType: 'county', countyId: null });
await upsertEntity({ name: SPRINGS_NAME, entityType: 'city', countyId: elPasoId });

// Phantom-row guard (see header): exactly two CO rows, exactly one of each type.
const { data: all } = await db.from('municipalities')
  .select('name, entity_type, county_id').eq('state', 'CO').in('name', [EL_PASO_NAME, SPRINGS_NAME]);
if (all.length !== 2) {
  console.error(`Expected exactly 2 rows, found ${all.length}:`, all);
  process.exit(1);
}
const springs = all.find((r) => r.name === SPRINGS_NAME);
if (springs.entity_type !== 'city' || springs.county_id !== elPasoId) {
  console.error('Colorado Springs is not a city linked to El Paso County:', springs);
  process.exit(1);
}

// "El Paso County" also exists in TEXAS (El Paso, TX). Confirm any namesakes are
// distinct rows, since a name-only lookup anywhere downstream would otherwise
// silently pick the wrong county — the same check seedAustinTravis.mjs runs for
// "Austin" (TX vs MN).
for (const n of [EL_PASO_NAME, SPRINGS_NAME]) {
  const { data: namesakes } = await db.from('municipalities')
    .select('id, name, state, entity_type').eq('name', n);
  console.log(`  "${n}" rows across all states: ${namesakes.map((r) => `${r.state}/${r.entity_type}`).join(', ') || '(none)'}`);
}

console.log('\nSeed OK.');
