#!/usr/bin/env node
/**
 * Pima County Municipalities Data Model Seeder (Phase 132-01)
 *
 * Creates (or updates) the municipality rows for four Pima County, AZ
 * municipalities — Oro Valley, Marana, Sahuarita, South Tucson — and links
 * each to the EXISTING Pima County navigation node (seeded in v2.17 by
 * seedTucsonArizona.js) via `county_id`, so US -> Arizona -> Pima County ->
 * {city} resolves and all five munis (incl. Tucson) share the Cities-in-County
 * panel.
 *
 * The Pima County node ALREADY EXISTS. This seeder REUSES it (resolve by
 * name+state+entity_type) and ABORTS if it is missing — it never creates a
 * second county node. Tucson's existing row + link are left untouched.
 *
 * NOTE: data_source rows are owned by processPimaCities.js (Phase 132-02).
 * This seeder creates NO data_source rows (seedTucsonArizona.js convention).
 *
 * Idempotent: safe to re-run.
 *   - City: select by name+state via .maybeSingle() -> update in-place or insert.
 *   - Link: county_id set only when NULL or already Pima's id (never repointed).
 *
 * Usage:
 *   node scripts/seedPimaMunicipalities.js        (source .env first for the key)
 *
 * Population source (2024 vintage, Census Population Estimates Program,
 * sub-est2024.csv, SUMLEV=162 place rows, STNAME="Arizona", POPESTIMATE2024):
 *   - Oro Valley town   -> 48855
 *   - Marana town       -> 62380
 *   - Sahuarita town    -> 37448
 *   - South Tucson city -> 4535
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// ── Entity payloads (entity_type='city' — TT has no 'town' type) ───────────
const CITIES = [
  { name: 'Oro Valley',   state: 'AZ', entity_type: 'city', population: 48855, population_year: 2024 },
  { name: 'Marana',       state: 'AZ', entity_type: 'city', population: 62380, population_year: 2024 },
  { name: 'Sahuarita',    state: 'AZ', entity_type: 'city', population: 37448, population_year: 2024 },
  { name: 'South Tucson', state: 'AZ', entity_type: 'city', population: 4535,  population_year: 2024 },
];

const PIMA_COUNTY_NAME = 'Pima County';
const PIMA_STATE = 'AZ';

// ── Idempotent upsert for municipality: select by name+state → insert or update ──
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', m.name)
    .eq('state', m.state)
    .maybeSingle();
  if (selectErr) {
    console.error(`  ERROR selecting municipality "${m.name}, ${m.state}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;
  if (existing?.id) {
    ({ data, error } = await supabase.from('municipalities').update(m).eq('id', existing.id).select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase.from('municipalities').insert(m).select());
    if (!error) console.log(`  (inserted new municipality row)`);
  }
  if (error) { console.error(`  ERROR writing municipality "${m.name}": ${error.message}`); process.exit(1); }
  const row = data?.[0];
  if (!row) { console.error(`  ERROR: no row returned for municipality "${m.name}"`); process.exit(1); }
  return row.id;
}

// ── Resolve the EXISTING Pima County node (reuse only; abort if missing) ──
async function resolvePimaCounty() {
  const { data, error } = await supabase
    .from('municipalities')
    .select('id')
    .eq('state', PIMA_STATE)
    .eq('entity_type', 'county')
    .ilike('name', PIMA_COUNTY_NAME);
  if (error) { console.error(`  ERROR looking up "${PIMA_COUNTY_NAME}": ${error.message}`); process.exit(1); }
  if (!data || data.length === 0) {
    console.error(`  ERROR: existing Pima County node NOT found. It should have been seeded in v2.17`);
    console.error(`  (seedTucsonArizona.js). Refusing to create a second county node — run that first.`);
    process.exit(1);
  }
  if (data.length > 1) {
    console.error(`  ERROR: found ${data.length} Pima County rows — ambiguous, aborting.`);
    process.exit(1);
  }
  return data[0].id;
}

// ── Link city -> Pima County via county_id (NULL-or-same guard, never repoint) ──
async function linkToPima(cityId, cityName, pimaId) {
  const { data: city, error: selErr } = await supabase
    .from('municipalities').select('id, county_id').eq('id', cityId).single();
  if (selErr) { console.error(`  ERROR reading ${cityName}'s county_id: ${selErr.message}`); process.exit(1); }

  if (city.county_id === pimaId) return 'already-linked';
  if (city.county_id == null) {
    const { error: updErr } = await supabase.from('municipalities').update({ county_id: pimaId }).eq('id', cityId);
    if (updErr) { console.error(`  ERROR linking ${cityName} to Pima: ${updErr.message}`); process.exit(1); }
    return 'linked';
  }
  console.log(`  WARNING: ${cityName} already linked to a different county_id=${city.county_id} — skipped (not repointed)`);
  return 'skipped';
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Pima County municipalities (Phase 132-01) — data model only...\n');
  console.log('NOTE: data_source rows are created by processPimaCities.js (Phase 132-02).\n');

  console.log(`Resolving EXISTING ${PIMA_COUNTY_NAME}, ${PIMA_STATE} node...`);
  const pimaId = await resolvePimaCounty();
  console.log(`  Pima County id: ${pimaId} (reused, not created)\n`);

  const ids = {};
  for (const c of CITIES) {
    console.log(`Upserting municipality: ${c.name}, ${c.state} (pop ${c.population}, 2024)`);
    const id = await upsertMunicipality(c);
    console.log(`  id: ${id}`);
    const outcome = await linkToPima(id, c.name, pimaId);
    console.log(`  link -> Pima County: ${outcome}\n`);
    ids[c.name] = id;
  }

  // ── Verify postconditions ──────────────────────────────────────────────
  console.log('Verifying...');
  let ok = true;
  for (const c of CITIES) {
    const { data, error } = await supabase
      .from('municipalities')
      .select('id, population, population_year, county_id')
      .eq('name', c.name).eq('state', 'AZ').eq('entity_type', 'city');
    if (error) { console.error(`  ERROR: ${error.message}`); process.exit(1); }
    if (data.length !== 1) { console.error(`  ERROR: expected 1 ${c.name} row, found ${data.length}`); process.exit(1); }
    const r = data[0];
    const good = r.population === c.population && r.population_year === 2024 && r.county_id === pimaId;
    if (!good) ok = false;
    console.log(`  ${good ? 'OK ' : 'BAD'} ${c.name}: id=${r.id} pop=${r.population}/${r.population_year} county_id=${r.county_id}`);
  }
  // No duplicate county node
  const { data: cnt } = await supabase
    .from('municipalities').select('id').eq('state', 'AZ').eq('entity_type', 'county').ilike('name', PIMA_COUNTY_NAME);
  if (cnt.length !== 1) { console.error(`  ERROR: expected exactly 1 Pima County node, found ${cnt.length}`); ok = false; }
  else console.log(`  OK  exactly one Pima County node (${cnt[0].id})`);

  if (!ok) { console.error('\nFAILED: one or more postcondition checks did not match.'); process.exit(1); }
  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
