#!/usr/bin/env node
/**
 * Creates the Kitsap County and Bainbridge Island rows in treasury.municipalities.
 *
 * Order matters: Kitsap must exist first so Bainbridge.county_id can point at it.
 * Idempotent -- re-running updates the existing rows rather than duplicating.
 *
 * geo_id and hero_image_url are left NULL, matching Seattle, King County and the
 * Washington state node.
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

export const KITSAP_NAME = 'Kitsap County';
export const BAINBRIDGE_NAME = 'Bainbridge Island';

// TASK 3 STEP 1: WA OFM April 1, 2025 official population estimates.
// Source: WA Office of Financial Management, "April 1 Population of Cities,
// Towns and Counties Used for Allocation of Selected State Revenues"
// (ofm_april1_population_final.xlsx), sheet "Population", column
// "2025 Population Estimate". Cross-verified against OFM's companion
// "Postcensal Estimates of April 1 Population, 1960 to Present"
// (ofm_april1_postcensal_estimates_pop_1960-present.xlsx), sheet
// "Population", column "2025 Postcensal Estimate of Total Population" --
// both files agree exactly on both figures.
//   Kitsap County:      Filter=1 (county row), Line 183 -> 288,900
//   Bainbridge Island:  Filter=4 (city row),   Line 186 -> 25,530
const POPULATION = { [KITSAP_NAME]: 288900, [BAINBRIDGE_NAME]: 25530 };
const POPULATION_YEAR = 2025;

async function upsertEntity({ name, entityType, countyId }) {
  const population = POPULATION[name];
  if (!Number.isInteger(population)) {
    throw new Error(`POPULATION[${name}] is not set — read it from WA OFM first (Task 3 Step 1).`);
  }
  const { data: existing } = await db.from('municipalities')
    .select('id').eq('name', name).eq('state', 'WA').maybeSingle();

  const row = { name, state: 'WA', entity_type: entityType, population,
                population_year: POPULATION_YEAR, county_id: countyId };

  const q = existing
    ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
    : db.from('municipalities').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw new Error(`${name}: ${error.message}`);
  console.log(`  ${existing ? 'Updated' : 'Created'} ${name} (${entityType}) ${data.id} pop ${population.toLocaleString()}`);
  return data.id;
}

const kitsapId = await upsertEntity({ name: KITSAP_NAME, entityType: 'county', countyId: null });
await upsertEntity({ name: BAINBRIDGE_NAME, entityType: 'city', countyId: kitsapId });

// Guard against the Utah phantom-row defect: a county load run without the
// county entity type silently creates a second, city-typed row of the same name.
const { data: all } = await db.from('municipalities')
  .select('name, entity_type').eq('state', 'WA').in('name', [KITSAP_NAME, BAINBRIDGE_NAME]);
if (all.length !== 2) {
  console.error(`Expected exactly 2 rows, found ${all.length}:`, all);
  process.exit(1);
}
console.log('\nSeed OK.');
