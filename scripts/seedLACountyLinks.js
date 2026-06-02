#!/usr/bin/env node
/**
 * LA County Links — County Municipality Seeder + county_id Updater
 *
 * Performs three operations (all idempotent):
 *   1. Insert county municipality rows for San Diego County, Sacramento County,
 *      and Alameda County (entity_type='county'). Skips any already present.
 *   2. Set county_id = LA_COUNTY_ID for all 88 LA County incorporated cities.
 *   3. Set county_id for 4 other CA cities (San Diego, Sacramento, Berkeley,
 *      Fremont) to their respective county municipality rows.
 *
 * San Francisco is intentionally excluded — SF is a consolidated city-county
 * government; no SF County municipality row exists (D-06).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedLACountyLinks.js
 *   SUPABASE_SERVICE_KEY=... node scripts/seedLACountyLinks.js --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ─────────────────────────────────────────────────────────────────

/** LA County municipality UUID — verified in DB (entity_type='county') */
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';

/** Known UUIDs for the 4 other-county CA cities (D-05) */
const OTHER_COUNTY_CITIES = {
  SAN_DIEGO: '1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2',
  SACRAMENTO: '9722596e-1102-4aca-8758-c32fc0c1731d',
  BERKELEY: '61236aa6-7845-49a2-a49a-78ef0050b395',
  FREMONT: 'eb7e50b1-eab5-4a0d-a9ce-a345109a13f9',
};

/** Three county rows to insert (linking-only — no budget data in this phase) */
const COUNTY_ROWS_TO_INSERT = [
  { name: 'San Diego County', state: 'CA', entity_type: 'county', population: 0, population_year: null },
  { name: 'Sacramento County', state: 'CA', entity_type: 'county', population: 0, population_year: null },
  { name: 'Alameda County', state: 'CA', entity_type: 'county', population: 0, population_year: null },
];

/** All 88 LA County incorporated cities (D-04) — all get county_id = LA_COUNTY_ID */
const LA_COUNTY_CITY_NAMES = [
  'Agoura Hills', 'Alhambra', 'Arcadia', 'Artesia', 'Avalon', 'Azusa',
  'Baldwin Park', 'Bell', 'Bell Gardens', 'Bellflower', 'Beverly Hills',
  'Bradbury', 'Burbank', 'Calabasas', 'Carson', 'Cerritos', 'Claremont',
  'Commerce', 'Compton', 'Covina', 'Cudahy', 'Culver City', 'Diamond Bar',
  'Downey', 'Duarte', 'El Monte', 'El Segundo', 'Gardena', 'Glendale',
  'Glendora', 'Hawaiian Gardens', 'Hawthorne', 'Hermosa Beach', 'Hidden Hills',
  'Huntington Park', 'Industry', 'Inglewood', 'Irwindale', 'La Canada Flintridge',
  'La Habra Heights', 'La Mirada', 'La Puente', 'La Verne', 'Lakewood',
  'Lancaster', 'Lawndale', 'Lomita', 'Long Beach', 'Los Angeles',
  'Lynwood', 'Malibu', 'Manhattan Beach', 'Maywood', 'Monrovia',
  'Montebello', 'Monterey Park', 'Norwalk', 'Palmdale', 'Palos Verdes Estates',
  'Paramount', 'Pasadena', 'Pico Rivera', 'Pomona', 'Rancho Palos Verdes',
  'Redondo Beach', 'Rolling Hills', 'Rolling Hills Estates', 'Rosemead',
  'San Dimas', 'San Fernando', 'San Gabriel', 'San Marino', 'Santa Clarita',
  'Santa Fe Springs', 'Santa Monica', 'Sierra Madre', 'Signal Hill',
  'South El Monte', 'South Gate', 'South Pasadena', 'Temple City',
  'Torrance', 'Vernon', 'Walnut', 'West Covina', 'West Hollywood',
  'Westlake Village', 'Whittier',
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' } },
    strict: false,
  });
  const dryRun = values['dry-run'] ?? false;

  console.log('LA County Links — County Seeder + county_id Updater');
  console.log('─'.repeat(55));
  if (dryRun) console.log('[DRY RUN] No writes will be performed.\n');

  // ── Step 1: Insert missing county municipality rows ──────────────────────────

  console.log('Step 1: Insert county municipality rows (San Diego, Sacramento, Alameda)');

  const { data: existingCA, error: fetchErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('state', 'CA');

  if (fetchErr) {
    console.error('Failed to fetch existing CA municipalities:', fetchErr.message);
    process.exit(1);
  }

  const existingNames = new Set((existingCA || []).map(m => m.name.toLowerCase()));
  const missingCounties = COUNTY_ROWS_TO_INSERT.filter(
    r => !existingNames.has(r.name.toLowerCase())
  );
  const alreadyExistingCounties = COUNTY_ROWS_TO_INSERT.filter(
    r => existingNames.has(r.name.toLowerCase())
  );

  console.log(`  Already in DB (${alreadyExistingCounties.length}): ${alreadyExistingCounties.map(r => r.name).join(', ') || '(none)'}`);
  console.log(`  Will insert (${missingCounties.length}): ${missingCounties.map(r => r.name).join(', ') || '(none)'}`);

  // Build county name → id map (needed for Step 3)
  const countyIdMap = {};

  // Seed ids for already-existing counties
  for (const row of alreadyExistingCounties) {
    const match = (existingCA || []).find(m => m.name.toLowerCase() === row.name.toLowerCase());
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

    console.log(`  Inserted ${inserted.length} county rows:`);
    for (const row of inserted) {
      console.log(`    [${row.id}] ${row.name}`);
      countyIdMap[row.name] = row.id;
    }
  } else if (missingCounties.length > 0 && dryRun) {
    console.log(`  [DRY RUN] Would insert: ${missingCounties.map(r => r.name).join(', ')}`);
    // In dry-run, we still need IDs to show what would happen in step 3
    // For dry-run, mark as placeholder
    for (const row of missingCounties) {
      countyIdMap[row.name] = `<new-uuid-for-${row.name.replace(/ /g, '-')}>`;
    }
  } else {
    console.log('  Nothing to insert — all county rows already present.');
  }

  const SD_COUNTY_ID = countyIdMap['San Diego County'];
  const SAC_COUNTY_ID = countyIdMap['Sacramento County'];
  const ALAMEDA_COUNTY_ID = countyIdMap['Alameda County'];

  console.log(`  SD County ID: ${SD_COUNTY_ID || '(missing)'}`);
  console.log(`  Sacramento County ID: ${SAC_COUNTY_ID || '(missing)'}`);
  console.log(`  Alameda County ID: ${ALAMEDA_COUNTY_ID || '(missing)'}`);

  // ── Step 2: Set county_id for 88 LA County cities ───────────────────────────

  console.log(`\nStep 2: Set county_id for ${LA_COUNTY_CITY_NAMES.length} LA County cities → ${LA_COUNTY_ID}`);

  if (!dryRun) {
    const { data: updated, error: laErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update({ county_id: LA_COUNTY_ID })
      .eq('state', 'CA')
      .in('name', LA_COUNTY_CITY_NAMES)
      .select('id, name');

    if (laErr) {
      console.error('LA County city update failed:', laErr.message);
      process.exit(1);
    }

    console.log(`  Updated ${updated?.length ?? 0} rows (expected 88)`);
    if ((updated?.length ?? 0) !== 88) {
      console.warn(`  WARNING: Expected 88 cities but got ${updated?.length ?? 0}. Some cities may not be in the DB.`);
    }
  } else {
    console.log(`  [DRY RUN] Would set county_id = ${LA_COUNTY_ID} for ${LA_COUNTY_CITY_NAMES.length} cities`);
    console.log(`  First: ${LA_COUNTY_CITY_NAMES[0]}, Last: ${LA_COUNTY_CITY_NAMES[LA_COUNTY_CITY_NAMES.length - 1]}`);
  }

  // ── Step 3: Set county_id for 4 other-county CA cities ──────────────────────

  console.log('\nStep 3: Set county_id for 4 other-county CA cities (D-05)');

  if (!SD_COUNTY_ID || !SAC_COUNTY_ID || !ALAMEDA_COUNTY_ID) {
    console.error('Missing county IDs — cannot proceed with Step 3. Run without --dry-run or check DB.');
    if (!dryRun) process.exit(1);
  }

  const otherCityLinks = [
    { id: OTHER_COUNTY_CITIES.SAN_DIEGO, name: 'San Diego', county_id: SD_COUNTY_ID },
    { id: OTHER_COUNTY_CITIES.SACRAMENTO, name: 'Sacramento', county_id: SAC_COUNTY_ID },
    { id: OTHER_COUNTY_CITIES.BERKELEY, name: 'Berkeley', county_id: ALAMEDA_COUNTY_ID },
    { id: OTHER_COUNTY_CITIES.FREMONT, name: 'Fremont', county_id: ALAMEDA_COUNTY_ID },
  ];

  for (const city of otherCityLinks) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would set ${city.name} (${city.id}) county_id → ${city.county_id}`);
      continue;
    }

    const { data: updated, error: cityErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update({ county_id: city.county_id })
      .eq('id', city.id)
      .select('id, name');

    if (cityErr) {
      console.error(`  Update failed for ${city.name}:`, cityErr.message);
      process.exit(1);
    }

    console.log(`  Set ${city.name} county_id → ${city.county_id} (rows: ${updated?.length ?? 0})`);
  }

  console.log('\n' + '─'.repeat(55));
  if (dryRun) {
    console.log('Dry run complete — no writes performed.');
  } else {
    console.log('Done. county_id links established for all LA County cities and 4 other CA cities.');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
