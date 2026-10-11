#!/usr/bin/env node
/**
 * Seed the 61 New York cities other than NYC.
 *
 * Spec: docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md §8
 *
 * ⚠ Keyed on OSC's own `municipalCode`, never on the display name. TT already
 * has one NY city — New York City — loaded from its own ACFRs; this script
 * must never touch it, and the roster it reads does not contain it.
 *
 * ⚠ Population is NOT in this source. Rows are seeded at 0 and backfilled from
 * Census PEP separately. Inventing a population here would be a figure with no
 * publisher.
 */
import { createClient } from '@supabase/supabase-js';

import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
import { assertRosterHasNoNyc } from './lib/nyOsc.mjs';
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

const EXPECTED_CITIES = 61;

// ⚠⚠ PRE-FLIGHT, BEFORE ANY WRITE. These two checks used to live inside the
// write loop, so a bad roster entry at position 40 would have created 39
// municipalities before refusing.
assertRosterHasNoNyc(NY_CITY_ENTITIES);
if (NY_CITY_ENTITIES.length !== EXPECTED_CITIES) {
  throw new Error(`REFUSING: roster has ${NY_CITY_ENTITIES.length} cities, expected ${EXPECTED_CITIES}`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');

const db = createClient(url, key, { auth: { persistSession: false } });

const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log(`[dry-run] roster is clean; would ensure ${NY_CITY_ENTITIES.length} NY cities`);
  process.exit(0);
}

for (const e of NY_CITY_ENTITIES) {
  // ⚠ `ensureMunicipality` returns an OBJECT and throws internally on a null
  // id, so `if (!id) throw` here would be dead code and `id` would not be one.
  await ensureMunicipality(db, {
    name: e.name,
    state: 'NY',
    entityType: 'city',
    population: 0,
    source: 'NY_OSC',
    sourceEntityKey: e.municipalCode,
  });
}

// ⚠ Count what the DATABASE holds, not what the loop iterated — the loop
// counter was a tautology over the roster length and verified nothing.
const { count, error } = await db
  .from('municipalities')
  .select('id', { count: 'exact', head: true })
  .eq('state', 'NY')
  .eq('entity_type', 'city')
  .eq('source', 'NY_OSC');
if (error) throw new Error(`verification query failed: ${error.message}`);

console.log(`ensured ${EXPECTED_CITIES} NY cities; database now holds ${count} with source=NY_OSC`);
if (count !== EXPECTED_CITIES) {
  console.error(`REFUSING: expected ${EXPECTED_CITIES} in the database, found ${count}`);
  process.exit(1);
}
