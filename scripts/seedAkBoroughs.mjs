#!/usr/bin/env node
/**
 * Creates Alaska's six largest borough governments in treasury.municipalities.
 *
 * Idempotent: re-running updates the existing rows rather than duplicating.
 * Alaska previously held only its state node and the Municipality of Anchorage.
 *
 * ── ⚠⚠ FIVE `county`, ONE `city`, AND THE DIFFERENCE IS MEASURED ──────────
 *
 * Alaska has no counties. Its 19 ORGANIZED boroughs are what the census counts
 * at SUMLEV 050, exactly where another state's counties sit, so they are typed
 * `county`.
 *
 * ⚠⚠ NOT `borough`: in TT that value means the 949 PENNSYLVANIA boroughs, a
 * city-like unit BENEATH a county. One label for both would file a
 * county-equivalent inside a county's children panel.
 *
 * The exception is JUNEAU, a consolidated city-borough like Anchorage. The test
 * that settles it — and that must be run before typing any further Alaska
 * government — is that a unified government's population is IDENTICAL at
 * SUMLEV 050 (county-equivalent), 162 (whole place) and 157 (county-part),
 * because the two geographies are the same thing. Census vintage 2024:
 *
 *   Juneau City and Borough     050/162/157 all 31,572   -> UNIFIED  -> `city`
 *   Ketchikan Gateway Borough   050 13,677 = Ketchikan city 8,033
 *                                            + balance     5,267     -> `county`
 *   Kodiak Island Borough       050 12,654 = Kodiak city   5,399
 *                                            + balance     6,681     -> `county`
 *   Mat-Su / Fairbanks NS / Kenai Peninsula each print a "Balance of ..." row,
 *   i.e. they contain cities                                         -> `county`
 *
 * ⚠ `entity_type` is identity-load-bearing (`treasury_ensure_municipality` keys
 * on it), so a wrong value MINTS A SECOND GOVERNMENT rather than mislabelling
 * this one. The post-seed assertion below is what catches that.
 *
 * ⚠ Bethel Census Area (18,237) is larger than two of these boroughs and is NOT
 * seeded: Alaska's 11 census areas are statistical only and have no government.
 *
 * `county_id` is left null for all six. The five boroughs ARE county-equivalents
 * and Juneau is its own, so none of them has a parent county.
 *
 * geo_id and hero_image_url are left NULL, matching Anchorage and the rest.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AK_BOROUGHS } from './lib/akBoroughSources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent is fine */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

/**
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage every other seeded entity uses.
 *   co-est2024-alldata.csv, SUMLEV=050, STNAME=Alaska, POPESTIMATE2024.
 *
 * ⚠ The sub-county file for Alaska is `sub-est2024_2.csv`, with NO leading zero
 * on the state FIPS; `_02` returns HTTP 404. Same trap `seedColorado.mjs`
 * documents for `_8` vs `_08`.
 *
 * These feed the loader's per-capita plausibility guard — the ONLY check that
 * can catch a wrong `units` multiplier, since the tie gate is blind to it.
 */
const POPULATION_YEAR = 2024;

async function upsert(ent) {
  const { data: existing } = await db.from('municipalities')
    .select('id').eq('name', ent.name).eq('state', 'AK').maybeSingle();

  const row = {
    name: ent.name,
    state: 'AK',
    entity_type: ent.entityType,
    population: ent.population,
    population_year: POPULATION_YEAR,
    county_id: null,
  };
  const q = existing
    ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
    : db.from('municipalities').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw new Error(`${ent.name}: ${error.message}`);
  console.log(`  ${existing ? 'Updated' : 'Created'} ${ent.name} (${ent.entityType}) `
    + `${data.id} pop ${ent.population.toLocaleString()}`);
  return data.id;
}

for (const ent of AK_BOROUGHS) await upsert(ent);

// ── Phantom-row guard ────────────────────────────────────────────────────────
// Exactly one row per borough, with the intended type. A duplicate here means a
// prior run used a different entity_type and split the history.
const names = AK_BOROUGHS.map((b) => b.name);
const { data: rows, error } = await db.from('municipalities')
  .select('id, name, entity_type, county_id').eq('state', 'AK').in('name', names);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== AK_BOROUGHS.length) {
  console.error(`Expected ${AK_BOROUGHS.length} rows, found ${rows.length}:`, rows);
  process.exit(1);
}
for (const ent of AK_BOROUGHS) {
  const got = rows.find((r) => r.name === ent.name);
  if (!got || got.entity_type !== ent.entityType || got.county_id !== null) {
    console.error(`${ent.name} is not a county-less ${ent.entityType}:`, got);
    process.exit(1);
  }
}

// ⚠ Nothing here may disturb the two Alaska entities that already existed.
const { data: all } = await db.from('municipalities')
  .select('name, entity_type').eq('state', 'AK').order('name');
console.log(`\n  Alaska now holds ${all.length} entities:`);
for (const r of all) console.log(`    ${r.name} / ${r.entity_type}`);

// Namesake check — a name-only lookup anywhere downstream must be unambiguous.
// "Kodiak" and "Ketchikan" are also CITIES inside their own boroughs, and those
// cities are separate governments that TT may load later.
for (const n of names) {
  const { data: ns } = await db.from('municipalities').select('state, entity_type').eq('name', n);
  if (ns.length !== 1) console.log(`  ⚠ "${n}" matches ${ns.length} rows: `
    + ns.map((r) => `${r.state}/${r.entity_type}`).join(', '));
}

console.log('\nSeed OK.');
