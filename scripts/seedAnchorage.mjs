#!/usr/bin/env node
/**
 * Creates the Municipality of Anchorage row in treasury.municipalities — the
 * FIRST Alaska LOCAL entity in the table. Alaska previously had only its state
 * node, from the state-ACFR arc (`processAKAcfr.js`, FY2006-2025).
 *
 * Idempotent: re-running updates the existing row rather than duplicating.
 *
 * ── ⚠⚠ ONE ENTITY, BECAUSE ANCHORAGE IS ONE GOVERNMENT ────────────────────
 *
 * The Municipality of Anchorage is a UNIFIED home-rule municipality: the city
 * and the borough are consolidated into a single government. There is no
 * separate "Anchorage Borough" to seed, and `county_id` is null because
 * Anchorage IS the county-equivalent — not because its parent is unknown.
 *
 * ⭐ The census confirms the consolidation arithmetically. Anchorage's 2024
 * estimate is IDENTICAL at all three summary levels:
 *
 *     SUMLEV 050  "Anchorage Municipality"  (county-equivalent)   289,600
 *     SUMLEV 162  "Anchorage municipality"  (whole place)         289,600
 *     SUMLEV 157  "Anchorage municipality"  (county-part)         289,600
 *
 * A non-consolidated city differs from its county at 050; Anchorage cannot,
 * because the two geographies are the same. That identity is the evidence for
 * the modelling decision, not an assumption behind it.
 *
 * ── ⚠⚠ ENTITY TYPE: `city`, AND IT IS IDENTITY-LOAD-BEARING ───────────────
 *
 * `treasury_ensure_municipality` keys on (name, state, entity_type), so the
 * wrong value does not mislabel this row — it MINTS A SECOND GOVERNMENT, and
 * the app then shows one entity twice with its history split between the
 * halves. The Utah phantom-row defect. The post-seed assertion below is what
 * catches it.
 *
 * `city` follows TT's own precedent for consolidated city-counties: San
 * Francisco CA and Philadelphia PA are both `city` in this table today.
 *
 * ⚠⚠ NOT `borough`. In TT `borough` means the 949 PENNSYLVANIA boroughs — a
 * city-like unit beneath a county — whereas an Alaska borough is a
 * county-equivalent. One label for both would conflate two unrelated things in
 * the county children panel.
 *
 * ⚠ NOT `municipality` either, despite being the entity's legal name. That
 * value is the legacy Plano-era Texas cohort (29 ordinary TX cities plus
 * Leonardtown MD); every milestone since uses `city`. New work follows the
 * dominant, current convention rather than the coincidence of wording.
 *
 * geo_id and hero_image_url are left NULL, matching Tucson, Seattle, King
 * County, Austin/Travis, Colorado Springs and the state nodes.
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

/**
 * ⚠ The name as the PUBLISHER prints it on its own cover page. A later
 * re-spelling by muni.org would miss this lookup and fork the entity, which is
 * what `npm run check:forks` exists to catch.
 */
export const ANCHORAGE_NAME = 'Municipality of Anchorage';

/**
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage every other seeded entity uses, so Anchorage is
 * comparable with the rest of the table.
 *
 *   co-est2024-alldata.csv, SUMLEV=050 "Anchorage Municipality",
 *   POPESTIMATE2024 -> 289,600. Cross-read against
 *   sub-est2024_2.csv SUMLEV=162 and SUMLEV=157, both also 289,600.
 *
 * ⚠ NOTE THE SUB-COUNTY FILENAME: `sub-est2024_2.csv`, with NO leading zero on
 * the Alaska state FIPS. `sub-est2024_02.csv` returns HTTP 404 — the same trap
 * `seedColorado.mjs` documents for `_8` vs `_08`. ⚠ This is the opposite of the
 * zero-padding the census ladder requires elsewhere; the convention is per
 * FILE, so probe it rather than carrying a rule across endpoints.
 *
 * This feeds the loader's per-capita plausibility guard — the ONLY check that
 * can catch a wrong `units` multiplier, since the tie gate is structurally
 * blind to it. At FY2024 the true figure is ~$2,774/capita (General Fund
 * revenue, $803.3M ÷ 289,600); a 1000x slip lands in the millions per resident
 * and is rejected.
 *
 * ⚠ Anchorage's per-capita figure is HIGH for a city because a unified
 * municipality carries borough-level services — notably the ~$263M Education
 * line that a non-consolidated city would never show in its General Fund. That
 * is the government being unusual, not the figure being wrong.
 */
const POPULATION = 289_600;
const POPULATION_YEAR = 2024;

const { data: existing } = await db.from('municipalities')
  .select('id').eq('name', ANCHORAGE_NAME).eq('state', 'AK').maybeSingle();

const row = {
  name: ANCHORAGE_NAME,
  state: 'AK',
  entity_type: 'city',
  population: POPULATION,
  population_year: POPULATION_YEAR,
  /** ⚠ null because Anchorage IS the county-equivalent. See the header. */
  county_id: null,
};

const q = existing
  ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
  : db.from('municipalities').insert(row).select().single();
const { data, error } = await q;
if (error) { console.error(`${ANCHORAGE_NAME}: ${error.message}`); process.exit(1); }
console.log(`  ${existing ? 'Updated' : 'Created'} ${ANCHORAGE_NAME}, AK (city) ${data.id} `
  + `pop ${POPULATION.toLocaleString()}`);

// ── Phantom-row guard (see header) ───────────────────────────────────────────
// Exactly ONE Anchorage row in AK. A second would mean a prior run used a
// different entity_type and split the history.
const { data: akAnchorage, error: guardErr } = await db.from('municipalities')
  .select('id, name, entity_type, county_id').eq('state', 'AK').ilike('name', '%anchorage%');
if (guardErr) { console.error(guardErr.message); process.exit(1); }
if (akAnchorage.length !== 1) {
  console.error(`Expected exactly 1 Anchorage row in AK, found ${akAnchorage.length}:`, akAnchorage);
  process.exit(1);
}
if (akAnchorage[0].entity_type !== 'city' || akAnchorage[0].county_id !== null) {
  console.error('Anchorage is not a county-less city:', akAnchorage[0]);
  process.exit(1);
}

// The AK state node must be untouched and distinct — this load has no business
// changing it, and a name-only lookup downstream must not be able to confuse
// the two Alaska rows.
const { data: akAll } = await db.from('municipalities')
  .select('name, entity_type').eq('state', 'AK').order('entity_type');
console.log(`  Alaska rows: ${akAll.map((r) => `${r.name}/${r.entity_type}`).join(', ')}`);

// "Anchorage" namesakes across all states — a name-only lookup anywhere
// downstream would otherwise be ambiguous.
const { data: namesakes } = await db.from('municipalities')
  .select('state, entity_type').ilike('name', '%anchorage%');
console.log(`  "Anchorage" rows across all states: `
  + `${namesakes.map((r) => `${r.state}/${r.entity_type}`).join(', ') || '(none)'}`);

console.log('\nSeed OK.');
