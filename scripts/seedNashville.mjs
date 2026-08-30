/**
 * Seed The Metropolitan Government of Nashville and Davidson County.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Knight session 6b. `scripts/lib/acfrGfLoad.mjs` resolves an entity by
 * (name, state, entity_type) and REFUSES to load one with no population, because
 * the per-capita guard is the only check that can catch a wrong `units`.
 *
 * ⚠ ONE ENTITY, `city`, `county_id` NULL — a consolidated government (spec §4.5).
 * ⚠ Population 729,505 is the CONSOLIDATED GOVERNMENT figure (Census SUMLEV 170),
 * which equals Davidson County (050). It is NOT the "(balance)" place figure
 * (162 = 704,963), which excludes six independent satellite cities.
 * See scripts/data/tnKnightEntities.mjs.
 *
 * Usage:
 *   node scripts/seedNashville.mjs --dry-run
 *   node scripts/seedNashville.mjs --commit
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import { TN_ENTITIES } from './data/tnKnightEntities.mjs';

const STATE = 'TN';

export async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, commit: { type: 'boolean', default: false } },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    process.exit(1);
  }

  for (const e of TN_ENTITIES) {
    console.log(`  ${e.name}, TN (${e.entityType}) population ${e.population.toLocaleString()} `
      + `county_id=${e.parentCountyKey ?? 'NULL (consolidated)'}`);
  }
  if (!values.commit) { console.log('\nDry run — nothing written.'); return TN_ENTITIES; }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  for (const e of TN_ENTITIES) {
    const { data: id, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: e.name, p_state: STATE, p_entity_type: e.entityType, p_population: e.population,
    });
    if (error) throw new Error(`Municipality error (${e.name}): ${error.message}`);
    console.log(`  ${e.name} -> ${id}`);

    // ⚠ Asserted, not assumed: a consolidated government must carry NO parent.
    const { data: row, error: readErr } = await db.schema('treasury').from('municipalities')
      .select('county_id, entity_type, population').eq('id', id).limit(1);
    if (readErr) throw new Error(`Verify failed (${e.name}): ${readErr.message}`);
    const got = row?.[0];
    if (got?.county_id !== null) {
      console.error(`REFUSING: ${e.name} has county_id=${got?.county_id}; a consolidated government must have NULL.`);
      process.exit(2);
    }
    console.log(`    verified entity_type=${got.entity_type} population=${got.population} county_id=NULL`);
  }
  return TN_ENTITIES;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('seedNashville.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
