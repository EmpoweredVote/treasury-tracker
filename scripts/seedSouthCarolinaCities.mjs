/**
 * Seed Columbia and Myrtle Beach, SC, and link them to their parent counties.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Knight session 6a. `scripts/lib/acfrGfLoad.mjs` resolves an entity by
 * (name, state, entity_type) and REFUSES to load one that has no population,
 * because the per-capita guard is the only check that can catch a wrong `units`.
 * So the entity must exist first, with a real population.
 *
 * ⚠ The parent counties are already present — `scripts/loadScRfa.mjs` created
 * them earlier in this session — so `county_id` is resolved by lookup rather
 * than created here. If that lookup misses, this exits rather than silently
 * leaving the link null.
 *
 * Usage:
 *   node scripts/seedSouthCarolinaCities.mjs --dry-run
 *   node scripts/seedSouthCarolinaCities.mjs --commit
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import { SC_ENTITIES, SC_SOURCE } from './data/scKnightEntities.mjs';

const STATE = 'SC';

export async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, commit: { type: 'boolean', default: false } },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    process.exit(1);
  }

  const cities = SC_ENTITIES.filter((e) => e.source === SC_SOURCE.CITY_ACFR);
  for (const c of cities) {
    console.log(`  ${c.name}, SC (${c.entityType}) population ${c.population.toLocaleString()} `
      + `-> parent ${c.parentCountyKey}`);
  }
  if (!values.commit) { console.log('\nDry run — nothing written.'); return cities; }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  for (const c of cities) {
    const parent = SC_ENTITIES.find((e) => e.key === c.parentCountyKey);
    const { data: county, error: cErr } = await db.schema('treasury').from('municipalities')
      .select('id').eq('name', parent.name).eq('state', STATE).eq('entity_type', 'county').limit(1);
    if (cErr) throw new Error(`County lookup failed (${parent.name}): ${cErr.message}`);
    if (!county?.[0]) {
      console.error(`REFUSING: parent county ${parent.name} not found. Run scripts/loadScRfa.mjs first.`);
      process.exit(2);
    }

    const { data: id, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: c.name, p_state: STATE, p_entity_type: c.entityType, p_population: c.population,
    });
    if (error) throw new Error(`Municipality error (${c.name}): ${error.message}`);

    const { error: linkErr } = await db.schema('treasury').from('municipalities')
      .update({ county_id: county[0].id }).eq('id', id);
    if (linkErr) throw new Error(`county_id error (${c.name}): ${linkErr.message}`);
    console.log(`  ${c.name} -> ${id}  (county_id ${county[0].id})`);
  }
  return cities;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('seedSouthCarolinaCities.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
