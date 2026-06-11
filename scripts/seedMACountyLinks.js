#!/usr/bin/env node
/**
 * MA County Links — County Municipality Seeder + county_id Updater
 *
 * Performs three operations (all idempotent):
 *   1. INSERT 5 MA county municipality rows (Barnstable County, Bristol County,
 *      Dukes County, Norfolk County, Plymouth County) with 2024 Census populations.
 *      Skips any already present.
 *   2. UPDATE county_id for all 97 MA cities in those 5 counties (5 sequential UPDATEs).
 *   3. Run DB verification queries to confirm row counts and per-county breakdowns.
 *
 * Nantucket is intentionally excluded — it is a consolidated town-county government
 * (no separate Nantucket County municipality row is appropriate).
 *
 * The remaining 254 MA cities (in dissolved counties: Berkshire, Essex, Franklin,
 * Hampden, Hampshire, Middlesex, Suffolk, Worcester) retain county_id=NULL — this
 * script does NOT touch them.
 *
 * Usage:
 *   node scripts/seedMACountyLinks.js
 *   node scripts/seedMACountyLinks.js --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env / .env.local before reading process.env
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* ignore missing files */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ─────────────────────────────────────────────────────────────────

/** 5 MA county rows to insert — 2024 Census populations */
const COUNTY_ROWS = [
  { name: 'Barnstable County', state: 'MA', entity_type: 'county', population: 232570,  population_year: 2024 },
  { name: 'Bristol County',    state: 'MA', entity_type: 'county', population: 588593,  population_year: 2024 },
  { name: 'Dukes County',      state: 'MA', entity_type: 'county', population: 21061,   population_year: 2024 },
  { name: 'Norfolk County',    state: 'MA', entity_type: 'county', population: 740754,  population_year: 2024 },
  { name: 'Plymouth County',   state: 'MA', entity_type: 'county', population: 542090,  population_year: 2024 },
];

/** Barnstable County — 15 cities (Cape Cod municipalities) */
const BARNSTABLE_CITIES = [
  'Barnstable', 'Bourne', 'Brewster', 'Chatham', 'Dennis', 'Eastham',
  'Falmouth', 'Harwich', 'Mashpee', 'Orleans', 'Provincetown', 'Sandwich',
  'Truro', 'Wellfleet', 'Yarmouth',
];

/** Bristol County — 20 cities */
const BRISTOL_CITIES = [
  'Acushnet', 'Attleboro', 'Berkley', 'Dartmouth', 'Dighton', 'Easton',
  'Fairhaven', 'Fall River', 'Freetown', 'Mansfield', 'New Bedford',
  'North Attleborough', 'Norton', 'Raynham', 'Rehoboth', 'Seekonk',
  'Somerset', 'Swansea', 'Taunton', 'Westport',
];

/** Dukes County — 7 cities (Martha's Vineyard; Gosnold may not be in DB) */
const DUKES_CITIES = [
  'Aquinnah', 'Chilmark', 'Edgartown', 'Gosnold', 'Oak Bluffs',
  'Tisbury', 'West Tisbury',
];

/** Norfolk County — 28 cities */
const NORFOLK_CITIES = [
  'Avon', 'Bellingham', 'Braintree', 'Brookline', 'Canton', 'Cohasset',
  'Dedham', 'Dover', 'Foxborough', 'Franklin', 'Holbrook', 'Medfield',
  'Medway', 'Millis', 'Milton', 'Needham', 'Norfolk', 'Norwood',
  'Plainville', 'Quincy', 'Randolph', 'Sharon', 'Stoughton', 'Walpole',
  'Wellesley', 'Westwood', 'Weymouth', 'Wrentham',
];

/** Plymouth County — 27 cities */
const PLYMOUTH_CITIES = [
  'Abington', 'Bridgewater', 'Brockton', 'Carver', 'Duxbury',
  'East Bridgewater', 'Halifax', 'Hanover', 'Hanson', 'Hingham', 'Hull',
  'Kingston', 'Lakeville', 'Marion', 'Marshfield', 'Mattapoisett',
  'Middleborough', 'Norwell', 'Pembroke', 'Plymouth', 'Plympton',
  'Rochester', 'Rockland', 'Scituate', 'Wareham', 'West Bridgewater',
  'Whitman',
];

/** Per-county expected counts for validation */
const EXPECTED_COUNTS = {
  'Barnstable County': 15,
  'Bristol County':    20,
  'Dukes County':      7,   // 6 acceptable if Gosnold absent
  'Norfolk County':    28,
  'Plymouth County':   27,
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' } },
    strict: false,
  });
  const dryRun = values['dry-run'] ?? false;

  console.log('MA County Links — County Seeder + county_id Updater');
  console.log('─'.repeat(55));
  if (dryRun) console.log('[DRY RUN] No writes will be performed.\n');

  // ── Step 1: Insert missing county municipality rows ──────────────────────────

  console.log('Step 1: Insert county municipality rows (Barnstable, Bristol, Dukes, Norfolk, Plymouth)');

  const { data: existingMA, error: fetchErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('state', 'MA');

  if (fetchErr) {
    console.error('Failed to fetch existing MA municipalities:', fetchErr.message);
    process.exit(1);
  }

  const existingNames = new Set((existingMA || []).map(m => m.name.toLowerCase()));
  const missingCounties = COUNTY_ROWS.filter(r => !existingNames.has(r.name.toLowerCase()));
  const alreadyExistingCounties = COUNTY_ROWS.filter(r => existingNames.has(r.name.toLowerCase()));

  console.log(`  Already in DB (${alreadyExistingCounties.length}): ${alreadyExistingCounties.map(r => r.name).join(', ') || '(none)'}`);
  console.log(`  Will insert  (${missingCounties.length}): ${missingCounties.map(r => r.name).join(', ') || '(none)'}`);

  // Build county name → id map
  const countyIdMap = {};

  // Seed IDs for already-existing counties
  for (const row of alreadyExistingCounties) {
    const match = (existingMA || []).find(m => m.name.toLowerCase() === row.name.toLowerCase());
    if (match) countyIdMap[row.name] = match.id;
  }

  if (missingCounties.length > 0 && !dryRun) {
    const { data: inserted, error: insertErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .insert(missingCounties)
      .select('id, name');

    if (insertErr) {
      console.error('County insert failed:', insertErr.message);
      process.exit(1);
    }

    const safeInserted = inserted ?? [];
    console.log(`  Inserted ${safeInserted.length} county rows:`);
    for (const row of safeInserted) {
      console.log(`    [${row.id}] ${row.name}`);
      countyIdMap[row.name] = row.id;
    }
    if (safeInserted.length !== missingCounties.length) {
      console.warn(`  WARNING: Expected to insert ${missingCounties.length} rows but received ${safeInserted.length} back. Verify DB state.`);
    }
  } else if (missingCounties.length > 0 && dryRun) {
    console.log(`  [DRY RUN] Would insert:`);
    for (const row of missingCounties) {
      console.log(`    ${row.name} (population: ${row.population}, year: ${row.population_year})`);
      countyIdMap[row.name] = `<new-uuid-for-${row.name.replace(/ /g, '-')}>`;
    }
  } else {
    console.log('  Nothing to insert — all county rows already present.');
  }

  const barnstableId = countyIdMap['Barnstable County'];
  const bristolId    = countyIdMap['Bristol County'];
  const dukesId      = countyIdMap['Dukes County'];
  const norfolkId    = countyIdMap['Norfolk County'];
  const plymouthId   = countyIdMap['Plymouth County'];

  console.log(`  Barnstable County ID : ${barnstableId || '(missing)'}`);
  console.log(`  Bristol County ID    : ${bristolId    || '(missing)'}`);
  console.log(`  Dukes County ID      : ${dukesId      || '(missing)'}`);
  console.log(`  Norfolk County ID    : ${norfolkId    || '(missing)'}`);
  console.log(`  Plymouth County ID   : ${plymouthId   || '(missing)'}`);

  // ── Step 2: UPDATE county_id for each county's cities ───────────────────────

  console.log(`\nStep 2: Update county_id for 97 MA cities (5 counties)`);

  const countyUpdates = [
    { name: 'Barnstable County', id: barnstableId, cities: BARNSTABLE_CITIES, expected: 15 },
    { name: 'Bristol County',    id: bristolId,    cities: BRISTOL_CITIES,    expected: 20 },
    { name: 'Dukes County',      id: dukesId,      cities: DUKES_CITIES,      expected: 7  },
    { name: 'Norfolk County',    id: norfolkId,    cities: NORFOLK_CITIES,    expected: 28 },
    { name: 'Plymouth County',   id: plymouthId,   cities: PLYMOUTH_CITIES,   expected: 27 },
  ];

  const missingIds = countyUpdates.filter(c => !c.id).map(c => c.name);
  if (missingIds.length > 0) {
    console.error(`Cannot proceed with Step 2: missing county IDs for: ${missingIds.join(', ')}`);
    process.exit(1);
  }

  let totalUpdated = 0;

  for (const county of countyUpdates) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would update ${county.cities.length} cities → ${county.name}`);
      console.log(`    First: ${county.cities[0]}, Last: ${county.cities[county.cities.length - 1]}`);
      totalUpdated += county.cities.length;
      continue;
    }

    const { data: updated, error: updateErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update({ county_id: county.id })
      .eq('state', 'MA')
      .in('name', county.cities)
      .select('id, name');

    if (updateErr) {
      console.error(`  Update failed for ${county.name}:`, updateErr.message);
      process.exit(1);
    }

    const actualCount = updated?.length ?? 0;
    console.log(`  ${county.name}: updated ${actualCount} rows (expected ${county.expected})`);

    if (actualCount !== county.expected) {
      if (county.name === 'Dukes County' && actualCount === 6) {
        console.warn(`  WARNING: Dukes County got ${actualCount} (not 7). Gosnold may not be in DB — count of 6 is acceptable.`);
      } else {
        console.warn(`  WARNING: Expected ${county.expected} cities for ${county.name} but got ${actualCount}. Some cities may not be in DB.`);
      }
    }

    totalUpdated += actualCount;
  }

  // ── Step 3: DB verification (live run only) ──────────────────────────────────

  if (!dryRun) {
    console.log('\nStep 3: DB verification');

    // Query A: total MA cities with county_id set
    const { count: linkedCount, error: totalErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'MA')
      .not('county_id', 'is', null);

    if (totalErr) {
      console.error('  Verification query A failed:', totalErr.message);
    } else {
      const count = linkedCount ?? 0;
      console.log(`  Query A — MA cities with county_id set: ${count}`);
      if (count !== 97 && count !== 96) {
        console.warn(`  WARNING: Expected 97 (or 96 if Gosnold absent) but got ${count}.`);
      } else {
        console.log(`  Query A PASS: ${count} is within expected range (96–97).`);
      }
    }

    // Query B: per-county breakdown
    const { data: perCounty, error: perCountyErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .select('county_id, id')
      .eq('state', 'MA')
      .eq('entity_type', 'city')
      .not('county_id', 'is', null);

    if (perCountyErr) {
      console.error('  Verification query B failed:', perCountyErr.message);
    } else {
      // Group by county_id and resolve names
      const countByCounityId = {};
      for (const row of (perCounty || [])) {
        countByCounityId[row.county_id] = (countByCounityId[row.county_id] || 0) + 1;
      }

      const idToName = {
        [barnstableId]: 'Barnstable County',
        [bristolId]:    'Bristol County',
        [dukesId]:      'Dukes County',
        [norfolkId]:    'Norfolk County',
        [plymouthId]:   'Plymouth County',
      };

      console.log('  Query B — Per-county city breakdown:');
      for (const [id, count] of Object.entries(countByCounityId)) {
        const countyName = idToName[id] || `Unknown (${id})`;
        const expected = EXPECTED_COUNTS[countyName];
        const status = (expected && (count === expected || (countyName === 'Dukes County' && count === 6)))
          ? 'PASS' : 'WARN';
        console.log(`    ${countyName}: ${count} cities [${status}]`);
      }
    }

    // Query C: confirm county rows with populations
    const { data: countyRows, error: countyRowsErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .select('name, population, population_year')
      .eq('state', 'MA')
      .eq('entity_type', 'county')
      .order('name');

    if (countyRowsErr) {
      console.error('  Verification query C failed:', countyRowsErr.message);
    } else {
      console.log(`  Query C — MA county rows (${(countyRows || []).length} found):`);
      for (const row of (countyRows || [])) {
        console.log(`    ${row.name}: population=${row.population}, year=${row.population_year}`);
      }
      if ((countyRows || []).length !== 5) {
        console.warn(`  WARNING: Expected 5 county rows but found ${(countyRows || []).length}.`);
      } else {
        console.log('  Query C PASS: 5 county rows confirmed.');
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(55));
  if (dryRun) {
    console.log('Dry run complete — no writes performed.');
    console.log(`Would insert ${missingCounties.length} county rows.`);
    console.log(`Would update ~97 cities across 5 counties:`);
    console.log(`  Barnstable County: ${BARNSTABLE_CITIES.length} cities`);
    console.log(`  Bristol County:    ${BRISTOL_CITIES.length} cities`);
    console.log(`  Dukes County:      ${DUKES_CITIES.length} cities`);
    console.log(`  Norfolk County:    ${NORFOLK_CITIES.length} cities`);
    console.log(`  Plymouth County:   ${PLYMOUTH_CITIES.length} cities`);
  } else {
    console.log(`DONE. ${totalUpdated} MA cities linked to their county.`);
    console.log('MA county seeding + city linking complete.');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
