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
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');

const db = createClient(url, key, { auth: { persistSession: false } });

const dryRun = process.argv.includes('--dry-run');

let ensured = 0;
for (const e of NY_CITY_ENTITIES) {
  if (e.name.toLowerCase().includes('new york')) {
    throw new Error(`REFUSING: roster contains ${e.name} — NYC is loaded from its own ACFRs`);
  }
  if (dryRun) { ensured++; continue; }

  const id = await ensureMunicipality(db, {
    name: e.name,
    state: 'NY',
    entityType: 'city',
    population: 0,
    source: 'NY_OSC',
    sourceEntityKey: e.municipalCode,
  });
  if (!id) throw new Error(`ensureMunicipality returned no id for ${e.name}`);
  ensured++;
}

console.log(`${dryRun ? '[dry-run] would ensure' : 'ensured'} ${ensured} NY cities`);
if (ensured !== 61) {
  console.error(`REFUSING: expected 61, got ${ensured}`);
  process.exit(1);
}
