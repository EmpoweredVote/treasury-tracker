#!/usr/bin/env node
/**
 * Create every Florida city and county that files an Annual Financial Report in
 * `treasury.municipalities` — 479 governments, of which seven already exist from
 * the Knight session-3 load.
 *
 * Usage:
 *   node scripts/seedFlStatewide.mjs --dry-run
 *   node scripts/seedFlStatewide.mjs
 *
 * Mirrors scripts/seedFlorida.mjs, which seeded the first seven, and keeps its
 * assertions. It differs in three ways that matter at 479 entities.
 *
 * ── ⚠⚠ 1. THE SEVEN EXISTING ROWS MUST BE RE-USED, NOT RE-CREATED ──────────
 *
 * `treasury_ensure_municipality` and this seeder both key on
 * (name, state, entity_type) — ALL THREE. Miami, Tallahassee, Bradenton and the
 * counties Leon, Manatee, Miami-Dade and Palm Beach already carry 190 budget
 * rows between them. A display name that drifts by one character creates a
 * SECOND row and orphans every one of them, and nothing about that failure is
 * loud: both rows look fine on their own.
 *
 * `scripts/buildFlStatewideEntities.mjs` asserts the registry reproduces all
 * seven names exactly; this seeder then asserts each resolves to exactly ONE row
 * — the Utah phantom-row shape, where a wrong entity type silently created a
 * second row of the same name with the data split between them.
 *
 * ── ⚠ 2. A NULL POPULATION IS A FACT, NOT A GAP ────────────────────────────
 *
 * Hastings and Weeki Wachee dissolved (2018 and 2020) and have no Census
 * Vintage 2024 estimate, because the governments no longer exist. Their audited
 * filings are still real and still load; the population column says null rather
 * than inventing a number or dropping 15 entity-years of verified history.
 *
 * ── ⚠ 3. FIVE CITIES HAVE NO COUNTY ROW TO POINT AT ────────────────────────
 *
 * Jacksonville, Atlantic Beach, Baldwin, Jacksonville Beach and Neptune Beach
 * are in Duval County, which files no AFR — it was consolidated with
 * Jacksonville in 1968, so Jacksonville IS the county government. Their
 * `county_id` is null, and the registry records why. Inventing a Duval County
 * row would create a government that does not exist.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FL_STATEWIDE_ENTITIES, FL_STATE } from './data/flStatewideEntities.mjs';
import { FL_EXISTING_TT_NAMES } from './data/flCensusAliases.mjs';

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

export async function seed({ dryRun = false } = {}) {
  loadEnv();
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).'); process.exit(1); }
  const db = key
    ? createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key,
      { db: { schema: 'treasury' } })
    : null;

  const counties = FL_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'county');
  const cities = FL_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'city');
  console.log(`\nSeeding Florida statewide — ${FL_STATEWIDE_ENTITIES.length} governments `
    + `(${cities.length} cities, ${counties.length} counties)${dryRun ? '  [dry-run]' : ''}\n`);

  // ── Read the whole FL cohort once rather than 479 times.
  let existing = [];
  if (db) {
    const { data, error } = await db.from('municipalities')
      .select('id, name, entity_type, population, county_id').eq('state', FL_STATE);
    if (error) throw new Error(`lookup: ${error.message}`);
    existing = data;
  }
  const byKey = new Map();
  for (const m of existing) {
    const k = `${m.name}|${m.entity_type}`;
    if (byKey.has(k)) {
      throw new Error(`more than one row already exists for (${k}, ${FL_STATE}) — refusing to guess `
        + 'which is canonical. This is the Utah phantom-row shape.');
    }
    byKey.set(k, m);
  }
  console.log(`  already in the table: ${existing.length} FL rows `
    + `(${existing.filter((m) => m.entity_type === 'state').length} state node)\n`);

  const idByName = new Map();
  let inserted = 0; let updated = 0; let unchanged = 0;

  async function upsert(ent, countyId) {
    const k = `${ent.name}|${ent.entityType}`;
    const row = {
      name: ent.name,
      state: FL_STATE,
      entity_type: ent.entityType,
      population: ent.population,
      county_id: countyId,
    };
    const prior = byKey.get(k);
    if (prior) {
      const same = prior.population === ent.population && prior.county_id === countyId;
      if (same) { unchanged++; return prior.id; }
      if (!dryRun) {
        const { error } = await db.from('municipalities').update(row).eq('id', prior.id);
        if (error) throw new Error(`update ${ent.name}: ${error.message}`);
      }
      updated++;
      return prior.id;
    }
    if (dryRun) { inserted++; return `dry-${ent.code}`; }
    const { data, error } = await db.from('municipalities').insert(row).select('id').single();
    if (error) throw new Error(`insert ${ent.name}: ${error.message}`);
    inserted++;
    return data.id;
  }

  // ⚠ Counties FIRST — a city's county_id cannot point at a row that does not exist yet.
  for (const ent of counties) idByName.set(ent.name, await upsert(ent, null));
  console.log(`  counties done: ${idByName.size}`);

  for (const ent of cities) {
    let countyId = null;
    if (ent.countyDbName) {
      countyId = idByName.get(ent.countyDbName) || null;
      if (!countyId) {
        throw new Error(`${ent.name} names parent county "${ent.countyDbName}", which is not among the `
          + '66 filing counties. A city may not point at a county row that does not exist.');
      }
    }
    idByName.set(ent.name, await upsert(ent, countyId));
  }

  console.log(`  inserted ${inserted}, updated ${updated}, unchanged ${unchanged}`);

  if (dryRun) { console.log('\n  [dry-run] nothing written.'); return; }

  // ── Post-seed assertions. Each has been a real defect somewhere in this table.
  const { data: all, error } = await db.from('municipalities')
    .select('id, name, entity_type, population, county_id').eq('state', FL_STATE);
  if (error) throw new Error(`verify: ${error.message}`);

  const problems = [];
  for (const ent of FL_STATEWIDE_ENTITIES) {
    const hits = all.filter((m) => m.name === ent.name && m.entity_type === ent.entityType);
    if (hits.length !== 1) { problems.push(`${ent.name} (${ent.entityType}): ${hits.length} rows, expected 1`); continue; }
    const m = hits[0];
    if (m.population !== ent.population) {
      problems.push(`${ent.name}: population ${m.population} != Census PEP V2024 ${ent.population}`);
    }
    const wantCounty = ent.countyDbName ? idByName.get(ent.countyDbName) : null;
    if ((m.county_id || null) !== (wantCounty || null)) {
      problems.push(`${ent.name}: county_id ${m.county_id} != ${wantCounty}`);
    }
  }

  // ⚠ The seven pre-existing rows must not have been duplicated.
  for (const n of FL_EXISTING_TT_NAMES) {
    const hits = all.filter((m) => m.name === n);
    if (hits.length !== 1) {
      problems.push(`⚠⚠ "${n}" existed before this seed and now has ${hits.length} rows — `
        + 'its 190 pre-existing budget rows hang off exactly one of them.');
    }
  }

  // ⚠ A city named the same as a county must not have become a county row.
  const dupNames = new Map();
  for (const m of all) dupNames.set(m.name, (dupNames.get(m.name) || 0) + 1);
  for (const [n, c] of dupNames) if (c > 1) problems.push(`"${n}" has ${c} rows in FL`);

  // ⚠ The state node must still be exactly one row and untouched.
  const states = all.filter((m) => m.entity_type === 'state');
  if (states.length !== 1 || states[0].name !== 'Florida') {
    problems.push(`expected exactly one FL state node, found ${states.length}`);
  }

  // ⚠ Duval must not have been invented.
  if (all.some((m) => m.name === 'Duval County')) {
    problems.push('a "Duval County" row exists — Duval was consolidated into Jacksonville in 1968 '
      + 'and files no AFR. That row names a government that does not exist.');
  }

  console.log(`\n  FL rows now: ${all.length} `
    + `(${all.filter((m) => m.entity_type === 'city').length} cities, `
    + `${all.filter((m) => m.entity_type === 'county').length} counties, `
    + `${all.filter((m) => m.entity_type === 'state').length} state)`);
  if (problems.length) {
    console.error(`\nSEED VERIFICATION FAILED — ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\n  ✅ All seed assertions passed.');
}

if (process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1]
  || process.argv[1].endsWith('seedFlStatewide.mjs'))) {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' } } });
  seed({ dryRun: values['dry-run'] || false })
    .catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
