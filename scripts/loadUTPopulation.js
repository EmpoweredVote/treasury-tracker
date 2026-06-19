#!/usr/bin/env node
/**
 * Utah city population loader (v2.5 Phase 69 — D-69-03 / SC#2).
 *
 * Sets a single recent Census vintage population + population_year for the 10
 * Treasury-Tracker Utah cities so per-capita ($/resident) renders. Mirrors
 * scripts/loadORPopulation.js / loadTXPopulation.js exactly — only the state
 * FIPS (49), the expected-city list, and the never-lower-to-0 guard differ.
 *
 * Source: Census Population Estimates, sub-county places, vintage 2024
 *   https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_49.csv
 *   (SUMLEV 162 = incorporated place; POPESTIMATE2024 → POP_YEAR 2024.)
 *
 * Run AFTER the budget loads (69-01 + 69-02) so all 10 municipality rows exist.
 *   node scripts/loadUTPopulation.js --dry-run
 *   node scripts/loadUTPopulation.js
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, createWriteStream, unlinkSync } from 'node:fs';
import { get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_49.csv';
const CSV_PATH = path.join(tmpdir(), 'sub-est2024_49.csv');
const POP_YEAR = 2024;

// Census-normalized lookup keys (what normalizeCensusName yields from the CSV NAME).
const EXPECTED_CITIES = [
  'Layton', 'Lehi', 'Ogden', 'Orem', 'Provo',
  'Salt Lake City', 'Sandy', 'St. George', 'West Jordan', 'West Valley City',
];

// Census-normalized name → exact treasury.municipalities.name. The budget loader
// (loadUtahTransparency.js) created each municipality from the FULL Transparent Utah
// entity_name, so every UT city row carries the "City" suffix — verified live
// 2026-06-19. (Plan 69-03's interface assumed the suffix was stripped for most
// cities; that was wrong — corrected here so the UPDATE matches the real rows.)
const DB_NAME = {
  Layton: 'Layton City',
  Lehi: 'Lehi City',
  Ogden: 'Ogden City',
  Orem: 'Orem City',
  Provo: 'Provo City',
  'Salt Lake City': 'Salt Lake City',
  Sandy: 'Sandy City',
  'St. George': 'St. George City',
  'West Jordan': 'West Jordan City',
  'West Valley City': 'West Valley City',
};

// Known-good 2024 Census values for the >1% drift sanity check.
// Read from the actual sub-est2024_49.csv (SUMLEV=162) on 2026-06-19 — not guesses.
const KNOWN_VALUES = {
  Layton: 84348,
  Lehi: 93446,
  Ogden: 88656,
  Orem: 96646,
  Provo: 115479,
  'Salt Lake City': 217783,
  Sandy: 92840,
  'St. George': 106288,
  'West Jordan': 116688,
  'West Valley City': 138144,
};

function normalizeCensusName(name) {
  return name.replace(/ city$/, '').replace(/ town$/, '').replace(/ village$/, '').trim();
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const cleanup = () => { try { unlinkSync(dest); } catch (_) {} };
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        res.resume();   // drain the (empty) redirect body, release the socket
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); cleanup();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { file.close(); cleanup(); reject(err); });
    }).on('error', (err) => { file.close(); cleanup(); reject(err); });
  });
}

async function main() {
  const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean' } } });
  const dryRun = flags['dry-run'] || false;

  if (!SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  // Download CSV if not cached
  if (!existsSync(CSV_PATH)) {
    console.log(`Downloading Census CSV from ${CSV_URL}...`);
    await downloadFile(CSV_URL, CSV_PATH);
    console.log('Downloaded.');
  } else {
    console.log('Using cached CSV.');
  }

  // Parse CSV
  const lines = readFileSync(CSV_PATH, 'utf8').split('\n');
  const header = lines[0].split(',');

  // Verify expected column positions (abort on Census format drift)
  if (header[0] !== 'SUMLEV' || header[8] !== 'NAME' || header[15] !== 'POPESTIMATE2024') {
    console.error(`Census CSV format changed — expected POPESTIMATE2024 at column 15`);
    console.error(`Got: col 0=${header[0]}, col 8=${header[8]}, col 15=${header[15]}`);
    process.exit(1);
  }

  const cityMap = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    if (cols[0] !== '162') continue; // incorporated place only
    const dbName = normalizeCensusName(cols[8]);
    const pop = parseInt(cols[15], 10);
    if (!isNaN(pop)) cityMap.set(dbName, pop);
  }

  // Verify all expected cities found
  const missing = EXPECTED_CITIES.filter(c => !cityMap.has(c));
  if (missing.length > 0) {
    console.error(`ERROR: Missing cities in CSV: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Sanity check values against known-good
  for (const [name, expected] of Object.entries(KNOWN_VALUES)) {
    const actual = cityMap.get(name);
    if (actual === undefined) {
      console.warn(`WARNING: ${name} not in cityMap — cannot verify known value`);
      continue;
    }
    if (Math.abs(actual - expected) / expected > 0.01) {
      console.warn(`WARNING: ${name} population drift: got ${actual}, expected ~${expected} (>1% deviation)`);
    }
  }

  console.log('\nCity populations from Census 2024:');
  for (const city of EXPECTED_CITIES) {
    console.log(`  ${city}: ${cityMap.get(city).toLocaleString()}`);
  }

  if (dryRun) {
    console.log('\nDRY RUN — no DB updates:');
    for (const city of EXPECTED_CITIES) {
      console.log(`  DRY: would UPDATE "${DB_NAME[city]}" to population=${cityMap.get(city)}, population_year=${POP_YEAR}`);
    }
    process.exit(0);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  let updated = 0, skipped = 0, failed = 0;

  for (const city of EXPECTED_CITIES) {
    const pop = cityMap.get(city);
    const dbName = DB_NAME[city];

    // D-69-03 guard: never lower a non-zero population to 0. The Census figures are
    // all non-zero, but refuse defensively if a target ever resolves to 0/NaN.
    if (!pop || pop <= 0) {
      console.error(`FAILED ${dbName}: refusing to write non-positive population (${pop}) — never lower a real value to 0`);
      failed++;
      continue;
    }

    // Check current state for idempotence
    const { data: current } = await supabase
      .from('municipalities')
      .select('population, population_year')
      .eq('name', dbName)
      .eq('state', 'UT')
      .single();

    if (current && current.population === pop && current.population_year === POP_YEAR) {
      console.log(`SKIP ${dbName}: already set to ${pop} (${POP_YEAR})`);
      skipped++;
      continue;
    }

    const { data: updatedRows, error } = await supabase
      .from('municipalities')
      .update({ population: pop, population_year: POP_YEAR })
      .eq('name', dbName)
      .eq('state', 'UT')
      .select('id');

    if (error) {
      console.error(`FAILED ${dbName}: ${error.message}`);
      failed++;
    } else if (!updatedRows || updatedRows.length === 0) {
      console.error(`FAILED ${dbName}: update matched 0 rows — municipality may not exist (run the budget loads first)`);
      failed++;
    } else {
      console.log(`UPDATED ${dbName}: ${pop} (${POP_YEAR})`);
      updated++;
    }
  }

  console.log(`\nSummary: Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
