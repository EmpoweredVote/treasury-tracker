#!/usr/bin/env node
/**
 * Seed the 719 New York school districts.
 *
 * ⚠ Population is NOT in this source and is seeded 0. `treasury_ensure_
 * municipality` only applies p_population on INSERT, so a re-run cannot
 * clobber a population backfilled later.
 *
 * ⚠ 719 name rows resolve onto 717 entities — two codes are published under
 * two spellings and the RPC records the second as an alias. Expect
 * 717 distinct municipalities, not 719.
 */
import { createClient } from '@supabase/supabase-js';

import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
import { NY_SCHOOL_ENTITIES } from './data/nyOscSchoolEntities.mjs';

const SOURCE_KEY = 'NY_OSC_SCHOOL';
const EXPECTED_NAMES = 719;
const EXPECTED_ENTITIES = 717;

// ⚠ PRE-FLIGHT, BEFORE ANY WRITE.
if (NY_SCHOOL_ENTITIES.length !== EXPECTED_NAMES) {
  throw new Error(`REFUSING: roster has ${NY_SCHOOL_ENTITIES.length} rows, expected ${EXPECTED_NAMES}`);
}
const codes = new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode));
if (codes.size !== EXPECTED_ENTITIES) {
  throw new Error(`REFUSING: roster has ${codes.size} codes, expected ${EXPECTED_ENTITIES}`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

if (process.argv.includes('--dry-run')) {
  console.log(`[dry-run] roster is clean; would ensure ${codes.size} districts from ${NY_SCHOOL_ENTITIES.length} name rows`);
  process.exit(0);
}

for (const e of NY_SCHOOL_ENTITIES) {
  await ensureMunicipality(db, {
    name: e.name,
    state: 'NY',
    entityType: 'school_district',
    population: 0,
    source: SOURCE_KEY,
    sourceEntityKey: e.municipalCode,
  });
}

const { count, error } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id', { count: 'exact', head: true })
  .eq('source', SOURCE_KEY);
if (error) throw new Error(`verification query failed: ${error.message}`);
if (count === null) throw new Error('verification query returned no count');

console.log(`database now holds ${count} source keys for ${SOURCE_KEY}`);
if (count !== EXPECTED_ENTITIES) {
  console.error(`REFUSING: expected ${EXPECTED_ENTITIES}, found ${count}`);
  process.exit(1);
}
