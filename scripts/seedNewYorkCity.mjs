/**
 * NO SHEBANG — a test imports this module, and the repo guard refuses a
 * `#!` on any module a test reaches: a shebang plus CRLF breaks the whole
 * Vite suite with an error naming no file. Run it with `node <path>`.
 *
 * Seed the City of New York -- TT's first New York local government.
 *
 * ⚠ `county_id` IS NULL BY DESIGN. NYC is larger than every one of the five
 * counties inside it. TT's navigation orders large to small, so the city sits
 * directly beneath the New York STATE node, in the tier a county would
 * normally occupy. If the boroughs are ever loaded they nest UNDER this row.
 * 322 existing cities already carry a NULL county_id, so this needs no schema
 * change and no new entity_type.
 *
 * ⚠ The name is `New York City`. The bare string `New York` is the STATE node
 * (1a7f871c-7f2e-4786-9c55-5ab3409716f4), and a collision there would break
 * every name-keyed lookup and `?entity=` alias resolution.
 *
 * ⚠ `ensureMunicipality` accepts neither `geoid` nor `county_id`, so both are
 * stamped in a follow-up update here rather than by widening that shared
 * helper for one caller.
 *
 * Usage:
 *   node --env-file=.env scripts/seedNewYorkCity.mjs --dry-run
 *   node --env-file=.env scripts/seedNewYorkCity.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { ensureMunicipality } from './lib/ensureMunicipality.mjs';

export const NYC_ENTITY = {
  name: 'New York City',
  entityType: 'city',
  state: 'NY',
  geoid: '3651000',          // FIPS place
  // ⚠ NOT a free-text label. `municipalities_geoid_shape` is a CHECK
  // constraint keying the required geoid LENGTH off this exact vocabulary;
  // anything outside it falls to ELSE -1 and the row is rejected. A 7-digit
  // place geoid is `census-pep-162-exact`, and SUMLEV 162 is precisely the
  // record the population was read from.
  geoidBasis: 'census-pep-162-exact',
  countyId: null,            // see the header -- deliberate, not missing
  // ⚠ READ FROM THE SOURCE, NOT RECALLED. Census PEP
  // `sub-est2024_36.csv`, SUMLEV 162 / STATE 36 / PLACE 51000
  // ("New York city"), field POPESTIMATE2024 -- the same file, vintage and
  // field `scripts/lib/censusPep.mjs` uses for every other TT place, so NYC
  // stays comparable with the rest of the corpus.
  //
  // ⚠ Census Vintage 2025 later revised this upward to ~8,597,000. NYC is NOT
  // moved to it alone: a per-capita figure is only meaningful against the same
  // vintage every other entity carries. Move the corpus or move nothing.
  //
  // Feeds the loader's per-capita plausibility guard, the only check that can
  // catch a wrong `units`.
  population: 8_478_072,
  populationYear: 2024,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('[dry-run] would ensure municipality:');
    for (const [k, v] of Object.entries(NYC_ENTITY)) console.log(`    ${k}: ${v}`);
    console.log('[dry-run] no write performed.');
    return;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  const { id } = await ensureMunicipality(db, {
    name: NYC_ENTITY.name,
    state: NYC_ENTITY.state,
    entityType: NYC_ENTITY.entityType,
    population: NYC_ENTITY.population,
  });

  // ⚠ Explicitly writes county_id = null. The RPC does not set it, and leaving
  // it unstated would make "beside the state node" an accident rather than a
  // decision -- and an accident a later backfill could quietly reverse.
  const { error } = await db.schema('treasury').from('municipalities').update({
    geoid: NYC_ENTITY.geoid,
    geoid_basis: NYC_ENTITY.geoidBasis,
    county_id: NYC_ENTITY.countyId,
    population_year: NYC_ENTITY.populationYear,
  }).eq('id', id);
  if (error) { console.error(`Stamping geoid/county_id failed: ${error.message}`); process.exit(1); }

  console.log(`New York City -> ${id}`);
  console.log(`  geoid ${NYC_ENTITY.geoid}, county_id NULL, population ${NYC_ENTITY.population.toLocaleString()}`);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('seedNewYorkCity.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
