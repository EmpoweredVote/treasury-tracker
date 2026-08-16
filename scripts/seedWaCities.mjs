#!/usr/bin/env node
/**
 * Creates the WA-CITIES-01 county nodes and cities in treasury.municipalities.
 *
 * Order matters: a county must exist before a city can point county_id at it.
 * Idempotent -- re-running updates the existing rows rather than duplicating.
 *
 * THE FOUR NEW COUNTIES ARE NAV-ONLY: a breadcrumb parent with a population
 * but no budget rows, matching the v2.17/v2.18 Pima precedent (Pima is still
 * nav-only today). They are not a placeholder for county finances; loading
 * those is a separate, deferred milestone.
 *
 * ⚠ KING COUNTY ALREADY EXISTS from v2.21 and is REUSED, never recreated.
 * Bellevue and Kent belong to it. A second row named "King County" would split
 * Seattle and Bellevue across two identically-named nodes, and nothing
 * downstream would report an error -- the app would simply show two counties.
 * This script hard-fails rather than create one.
 *
 * READINESS GATE IS `fiscalYears`, NOT population. Every city in the roster
 * has a population (they were all read from WA OFM in one pass), but only a
 * reconned city has a fiscal-year window. Seeding an unreconned city would
 * create an entity with nothing behind it. Harmless in the app today --
 * getCities visibility is gated on treasury.budgets metadata rows, so a
 * municipality with no budgets does not appear -- but it would make the
 * municipalities table stop describing what is actually loaded, and every
 * later count would have to special-case it.
 *
 * geo_id and hero_image_url are left NULL, matching every other WA entity;
 * banners resolve through src/utils/wikiImage.ts, not through the DB.
 *
 * Usage:
 *   node scripts/seedWaCities.mjs           # counties + every ready city
 *   node scripts/seedWaCities.mjs Tacoma    # one city (counties still ensured)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WA_ENTITIES, POPULATION_YEAR } from './lib/waRoster.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent is fine */ }
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL — refusing to guess a production URL.'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

async function findId(name) {
  const { data, error } = await db.from('municipalities')
    .select('id').eq('name', name).eq('state', 'WA').maybeSingle();
  if (error) throw new Error(`lookup failed for ${name}: ${error.message}`);
  return data ? data.id : null;
}

async function upsertEntity(entity, countyId) {
  if (!Number.isInteger(entity.population)) {
    throw new Error(`${entity.name}: population is not set — read it from WA OFM first.`);
  }
  const row = {
    name: entity.name, state: 'WA', entity_type: entity.entityType,
    population: entity.population, population_year: POPULATION_YEAR, county_id: countyId,
  };
  const existingId = await findId(entity.name);
  const q = existingId
    ? db.from('municipalities').update(row).eq('id', existingId).select().single()
    : db.from('municipalities').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw new Error(`${entity.name}: ${error.message}`);
  console.log(`  ${existingId ? 'Updated' : 'Created'} ${entity.name.padEnd(18)} ` +
    `${entity.entityType.padEnd(6)} pop ${String(entity.population).padStart(9)}` +
    `${entity.navOnly ? '  (nav-only — no budget rows)' : ''}  ${data.id}`);
  return data.id;
}

const ONLY = process.argv[2] || null;

// ── Counties first ──────────────────────────────────────────────────────────
const countyIds = new Map();
for (const c of WA_ENTITIES.filter((e) => e.entityType === 'county' && e.navOnly)) {
  countyIds.set(c.name, await upsertEntity(c, null));
}

// Kitsap County is a v2.22 entity with real budget rows; it is not touched here.
const kitsapId = await findId('Kitsap County');
if (kitsapId) countyIds.set('Kitsap County', kitsapId);

// King County must already exist from v2.21.
const kingId = await findId('King County');
if (!kingId) {
  console.error('ABORT: King County is missing. It should exist from v2.21, and Bellevue/Kent');
  console.error('       depend on it. Refusing to create it here — a second King County row');
  console.error('       would split Seattle and Bellevue across two identically-named nodes.');
  process.exit(1);
}
countyIds.set('King County', kingId);
console.log(`  Reused   King County        county            (v2.21)  ${kingId}`);

// ── Cities ──────────────────────────────────────────────────────────────────
let seeded = 0, skipped = [];
for (const city of WA_ENTITIES.filter((e) => e.entityType === 'city' && !e.navOnly)) {
  if (ONLY && city.name !== ONLY) continue;
  if (city.name === 'Bainbridge Island') continue;   // v2.22, already seeded
  if (!city.fiscalYears) { skipped.push(city.name); continue; }
  const countyId = countyIds.get(city.countyName);
  if (!countyId) throw new Error(`${city.name}: parent county ${city.countyName} was not seeded`);
  await upsertEntity(city, countyId);
  seeded++;
}
if (skipped.length) console.log(`  Skipped (not yet reconned): ${skipped.join(', ')}`);

// ── Guards ──────────────────────────────────────────────────────────────────
// The Utah phantom-row defect: a load run without the right entity type
// silently creates a SECOND row of the same name with a different type.
const names = WA_ENTITIES.map((e) => e.name);
const { data: all, error: allErr } = await db.from('municipalities')
  .select('name, entity_type, county_id').eq('state', 'WA').in('name', names);
if (allErr) throw new Error(`verification query failed: ${allErr.message}`);
const counts = new Map();
for (const r of all) counts.set(r.name, (counts.get(r.name) || 0) + 1);
const dupes = [...counts].filter(([, n]) => n > 1);
if (dupes.length) {
  console.error('ABORT: duplicate municipality rows:', dupes.map(([n, c]) => `${n} x${c}`).join(', '));
  process.exit(1);
}

// Exactly one King County, app-wide, in WA.
const { count: kingCount, error: kcErr } = await db.from('municipalities')
  .select('*', { count: 'exact', head: true }).eq('state', 'WA').eq('name', 'King County');
if (kcErr) throw new Error(`King County count failed: ${kcErr.message}`);
if (kingCount !== 1) { console.error(`ABORT: ${kingCount} rows named "King County" in WA, expected exactly 1`); process.exit(1); }

console.log(`\nSeed OK — ${seeded} city row(s) written, no duplicates, one King County.`);
