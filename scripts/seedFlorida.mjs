#!/usr/bin/env node
/**
 * Creates Florida's FIRST LOCAL ENTITIES in `treasury.municipalities` — the
 * seven Knight session-3 governments. Before this the state had only its state
 * node, from the state-ACFR arc.
 *
 * Order matters: the three COUNTIES that parent a city must exist before it, so
 * each city's `county_id` can point at one. Idempotent — re-running updates the
 * existing rows rather than duplicating.
 *
 * ENTITY TYPE: 'city' / 'county', NOT 'municipality'. The table carries both
 * conventions; 'municipality' is the legacy Plano-era Texas cohort and every
 * milestone since uses 'city'. The Utah phantom-row defect this guards against
 * is a load run with the wrong entity type silently creating a SECOND row of the
 * same name, with the data split between the two.
 *
 * ⚠ NAME COLLISIONS, and why every lookup key carries `state` AND `entity_type`.
 * Florida itself has a Town of Palm Beach alongside Palm Beach COUNTY, and eight
 * other governments whose names begin with "Miami". Nationally, "Bradenton" is
 * unique but "Miami" is not — there are Miamis in Oklahoma, Texas, Arizona and
 * West Virginia, and TT's coverage is still growing. Matching on name alone
 * would be ambiguous the moment any of them is loaded.
 *
 * ⚠ PALM BEACH COUNTY IS A KNIGHT COMMUNITY THAT IS ITSELF A COUNTY (spec §2.2,
 * "already the primary entity"). It gets ONE row, entity_type 'county', and no
 * companion city row — creating both would double-count it in every rollup, the
 * §4.5 consolidated-government rule in a slightly different shape.
 *
 * geo_id and hero_image_url are left NULL, matching every entity seeded since
 * Tucson.
 *
 * Usage:
 *   node scripts/seedFlorida.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FL_ENTITIES, FL_STATE } from './data/floridaKnightEntities.mjs';

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

async function findOne(name, entityType) {
  const { data, error } = await db
    .from('municipalities')
    .select('id, name, state, entity_type, population, county_id')
    .eq('name', name).eq('state', FL_STATE).eq('entity_type', entityType);
  if (error) throw new Error(`lookup ${name}: ${error.message}`);
  if (data.length > 1) {
    throw new Error(`${data.length} rows already exist for (${name}, ${FL_STATE}, ${entityType}) — `
      + 'refusing to guess which is canonical. This is the Utah phantom-row shape.');
  }
  return data[0] || null;
}

async function upsertEntity(ent, countyId = null) {
  const row = {
    name: ent.dbName,
    state: FL_STATE,
    entity_type: ent.entityType,
    population: ent.population,
    county_id: countyId,
  };
  const existing = await findOne(ent.dbName, ent.entityType);
  if (existing) {
    const { error } = await db.from('municipalities').update(row).eq('id', existing.id);
    if (error) throw new Error(`update ${ent.dbName}: ${error.message}`);
    console.log(`  UPDATED  ${ent.dbName} (${ent.entityType})  pop ${ent.population.toLocaleString()}  ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await db.from('municipalities').insert(row).select('id').single();
  if (error) throw new Error(`insert ${ent.dbName}: ${error.message}`);
  console.log(`  INSERTED ${ent.dbName} (${ent.entityType})  pop ${ent.population.toLocaleString()}  ${data.id}`);
  return data.id;
}

export async function seed() {
  console.log(`Seeding Florida local entities (Knight session 3) — the state's first\n`);

  const idByName = new Map();
  // Counties first: FL_ENTITIES is ordered counties-then-cities for exactly this.
  for (const ent of FL_ENTITIES.filter((e) => e.entityType === 'county')) {
    idByName.set(ent.dbName, await upsertEntity(ent, null));
  }
  for (const ent of FL_ENTITIES.filter((e) => e.entityType === 'city')) {
    const countyId = ent.countyDbName ? idByName.get(ent.countyDbName) : null;
    if (ent.countyDbName && !countyId) {
      throw new Error(`${ent.dbName} names parent county "${ent.countyDbName}", which was not seeded`);
    }
    idByName.set(ent.dbName, await upsertEntity(ent, countyId));
  }

  // ── Post-seed assertions ──────────────────────────────────────────────────
  // Each of these has been a real defect somewhere in this table's history.
  const { data: all, error } = await db
    .from('municipalities')
    .select('id, name, entity_type, population, county_id')
    .eq('state', FL_STATE).order('name');
  if (error) throw new Error(`verify: ${error.message}`);

  const problems = [];
  for (const ent of FL_ENTITIES) {
    const hits = all.filter((m) => m.name === ent.dbName && m.entity_type === ent.entityType);
    if (hits.length !== 1) {
      problems.push(`${ent.dbName} (${ent.entityType}): ${hits.length} rows, expected 1`);
      continue;
    }
    const m = hits[0];
    if (m.population !== ent.population) {
      problems.push(`${ent.dbName}: population ${m.population} != Census PEP V2024 ${ent.population}`);
    }
    const wantCounty = ent.countyDbName ? idByName.get(ent.countyDbName) : null;
    if (m.county_id !== wantCounty) {
      problems.push(`${ent.dbName}: county_id ${m.county_id} != ${wantCounty}`);
    }
  }
  // Palm Beach County must NOT have acquired a companion city row.
  const strayPalmBeach = all.filter((m) => m.name === 'Palm Beach County' && m.entity_type !== 'county');
  if (strayPalmBeach.length) {
    problems.push(`Palm Beach County has ${strayPalmBeach.length} non-county row(s) — it is one entity, not two`);
  }
  // The state node must still be exactly one row and must not have been touched.
  const states = all.filter((m) => m.entity_type === 'state');
  if (states.length !== 1 || states[0].name !== 'Florida') {
    problems.push(`expected exactly one FL state node, found ${states.length}`);
  }

  console.log(`\n  FL entities now in the table: ${all.map((m) => `${m.name} (${m.entity_type})`).join(', ')}`);
  if (problems.length) {
    console.error('\nSEED VERIFICATION FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nAll seed assertions passed.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
    || process.argv[1]?.endsWith('seedFlorida.mjs')) {
  await seed();
}
