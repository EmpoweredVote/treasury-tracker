#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, createWriteStream } from 'node:fs';
import { get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_41.csv';
const CSV_PATH = path.join(tmpdir(), 'sub-est2024_41.csv');
const POP_YEAR = 2024;

// Exact DB names for OR cities (must match municipalities.name)
const EXPECTED_CITIES = ['Portland', 'Gresham'];

// Known-good 2024 Census values for sanity check (from sub-est2024_41.csv verified 2026-05-31)
const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,   // Census sub-est2024_41.csv, SUMLEV=162, "Gresham city" → 111507 (2024)
};

function normalizeCensusName(name) {
  return name.replace(/ city$/, '').replace(/ town$/, '').replace(/ village$/, '').trim();
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        // Follow redirect (one level)
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', (err) => { file.close(); reject(err); });
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

  // Verify expected column positions
  if (header[0] !== 'SUMLEV' || header[8] !== 'NAME' || header[15] !== 'POPESTIMATE2024') {
    console.error(`Census CSV format changed — expected POPESTIMATE2024 at column 15`);
    console.error(`Got: col 0=${header[0]}, col 8=${header[8]}, col 15=${header[15]}`);
    process.exit(1);
  }

  const cityMap = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    if (cols[0] !== '162') continue;
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
      console.log(`  DRY: would UPDATE ${city} to population=${cityMap.get(city)}, population_year=2024`);
    }
    process.exit(0);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  let updated = 0, skipped = 0, failed = 0;

  for (const city of EXPECTED_CITIES) {
    const pop = cityMap.get(city);

    // Check current state for idempotence
    const { data: current } = await supabase
      .from('municipalities')
      .select('population, population_year')
      .eq('name', city)
      .eq('state', 'OR')
      .single();

    if (current && current.population === pop && current.population_year === POP_YEAR) {
      console.log(`SKIP ${city}: already set to ${pop} (${POP_YEAR})`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('municipalities')
      .update({ population: pop, population_year: POP_YEAR })
      .eq('name', city)
      .eq('state', 'OR');

    if (error) {
      console.error(`FAILED ${city}: ${error.message}`);
      failed++;
    } else {
      console.log(`UPDATED ${city}: ${pop} (${POP_YEAR})`);
      updated++;
    }
  }

  console.log(`\nSummary: Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
