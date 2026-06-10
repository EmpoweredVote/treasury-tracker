#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, createWriteStream, unlinkSync } from 'node:fs';
import { get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

// MA FIPS = 25; SUMLEV=061 covers all 351 MA municipalities (towns + 26 official cities)
const CSV_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_25.csv';
const CSV_PATH = path.join(tmpdir(), 'sub-est2024_25.csv');
const POP_YEAR = 2024;

// Known-good 2024 Census sanity values (from training knowledge — warn only if >1% drift)
// ASSUMED values per RESEARCH.md §A6 — script warns but does not exit on drift
const KNOWN_VALUES = {
  Boston: { min: 660000, max: 730000 },      // ~695K ± generous range
  Worcester: { min: 204000, max: 226000 },   // ~215K ± 5%
  Cambridge: { min: 112000, max: 124000 },   // ~118K ± 5%
  Springfield: { min: 147000, max: 163000 }, // ~155K ± 5%
};

/**
 * Normalize a Census municipality name to match the DLS-sourced DB name.
 * Steps:
 *   1. Strip trailing " city", " town", " village" (case-insensitive — Census uses
 *      both "Agawam town" and "Agawam Town" for different SUMLEV rows)
 *   2. Replace hyphens with spaces  ("Manchester-by-the-Sea" → "Manchester by the Sea")
 *   3. Title-case each word         ("Manchester by the Sea" → "Manchester By The Sea")
 *   4. Trim whitespace
 *
 * This handles the ONE confirmed Census↔DLS mismatch (Manchester-by-the-Sea / Pitfall 2).
 * Case-insensitive suffix stripping handles towns that appear as "Agawam Town" (title case)
 * in the SUMLEV=061 rows (e.g., "Agawam Town" → "Agawam", matching the DLS DB name).
 */
function normalizeCensusName(name) {
  return name
    .replace(/ city$/i, '')
    .replace(/ town$/i, '')
    .replace(/ village$/i, '')
    .replace(/-/g, ' ')                         // "Manchester-by-the-Sea" → "Manchester by the Sea"
    .replace(/\b\w/g, c => c.toUpperCase())     // title-case each word after hyphen split
    .trim();
}

/**
 * Redirect-safe HTTPS file downloader.
 * Handles 301/302 redirects from Census.gov (the OR script confirmed this is needed).
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const cleanup = () => { try { unlinkSync(dest); } catch (_) {} };
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        res.resume();   // drain the redirect body, release the socket
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

  // --- Step 1: Query all MA municipalities from DB (dynamic — 351 expected) ---
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  const { data: maMunis, error: muniErr } = await supabase
    .from('municipalities')
    .select('id, name')
    .eq('state', 'MA');

  if (muniErr || !maMunis?.length) {
    console.error('ERROR: Could not fetch MA municipalities from DB:', muniErr?.message || 'empty result');
    process.exit(1);
  }

  const dbNames = new Map(maMunis.map(m => [m.name, m.id]));
  console.log(`DB MA municipalities: ${dbNames.size} (expected 351)`);

  // --- Step 2: Download Census CSV if not cached ---
  if (!existsSync(CSV_PATH)) {
    console.log(`Downloading Census CSV from ${CSV_URL}...`);
    await downloadFile(CSV_URL, CSV_PATH);
    console.log('Downloaded.');
  } else {
    console.log(`Using cached CSV: ${CSV_PATH}`);
  }

  // --- Step 3: Parse CSV ---
  const lines = readFileSync(CSV_PATH, 'utf8').split('\n');
  const header = lines[0].split(',');

  // Verify expected column positions (guard against Census CSV format changes)
  if (header[0] !== 'SUMLEV' || header[8] !== 'NAME' || header[15] !== 'POPESTIMATE2024') {
    console.error('Census CSV format changed — expected POPESTIMATE2024 at column 15');
    console.error(`Got: col 0=${header[0]}, col 8=${header[8]}, col 15=${header[15]}`);
    process.exit(1);
  }

  // Filter to SUMLEV=061 only — MA towns/MCDs appear ONLY at SUMLEV=061
  // (NOT 162 — that would only match ~26 incorporated cities, missing 325 towns; see Pitfall 1)
  const cityMap = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    if (cols[0] !== '061') continue;
    const dbName = normalizeCensusName(cols[8]);
    const pop = parseInt(cols[15], 10);
    if (!isNaN(pop) && dbName) cityMap.set(dbName, pop);
  }
  console.log(`Census SUMLEV=061 rows parsed: ${cityMap.size}`);

  // --- Step 4: Sanity check known-good values (warn only — ASSUMED values per RESEARCH §A6) ---
  for (const [name, { min, max }] of Object.entries(KNOWN_VALUES)) {
    const actual = cityMap.get(name);
    if (actual === undefined) {
      console.warn(`WARNING: ${name} not found in Census CSV — cannot verify known value`);
    } else if (actual < min || actual > max) {
      console.warn(`WARNING: ${name} population ${actual.toLocaleString()} outside expected range [${min.toLocaleString()}, ${max.toLocaleString()}]`);
    } else {
      console.log(`  Sanity OK: ${name} = ${actual.toLocaleString()} (within expected range)`);
    }
  }

  // --- Step 5: Dry-run preview ---
  if (dryRun) {
    console.log('\nDRY RUN — no DB updates:');
    let previewCount = 0;
    for (const [censusName, pop] of cityMap.entries()) {
      if (dbNames.has(censusName)) {
        console.log(`  DRY: would UPDATE ${censusName} → population=${pop.toLocaleString()}, population_year=${POP_YEAR}`);
        previewCount++;
      }
    }

    // Report unmatched Census names
    const missingInDb = [];
    for (const censusName of cityMap.keys()) {
      if (!dbNames.has(censusName)) missingInDb.push(censusName);
    }

    // Report DB cities with no Census match
    const dbMissingFromCensus = [...dbNames.keys()].filter(n => !cityMap.has(n));

    console.log(`\nDry-run summary:`);
    console.log(`  DB municipalities: ${dbNames.size}`);
    console.log(`  Census SUMLEV=061 rows: ${cityMap.size}`);
    console.log(`  Would update: ${previewCount}`);
    console.log(`  Census rows not in DB: ${missingInDb.length}`);
    console.log(`  DB cities missing from Census: ${dbMissingFromCensus.length}`);

    if (missingInDb.length > 0) {
      console.log(`\nCensus names not found in DB (${missingInDb.length}):`);
      for (const n of missingInDb) console.log(`  UNMATCHED Census: ${n}`);
    }
    if (dbMissingFromCensus.length > 0) {
      console.log(`\nDB municipalities with no Census match (${dbMissingFromCensus.length}):`);
      for (const n of dbMissingFromCensus) console.log(`  MISSING from Census: ${n}`);
    }

    process.exit(0);
  }

  // --- Step 6: Live UPDATE loop ---
  let updated = 0, skipped = 0, failed = 0;
  const missingInDb = [];

  for (const [censusName, pop] of cityMap.entries()) {
    if (!dbNames.has(censusName)) {
      missingInDb.push(censusName);
      continue;
    }
    const muniId = dbNames.get(censusName);

    // Idempotence check — skip if already set to the same value
    const { data: current } = await supabase
      .from('municipalities')
      .select('population, population_year')
      .eq('id', muniId)
      .single();

    if (current && current.population === pop && current.population_year === POP_YEAR) {
      skipped++;
      continue;
    }

    const { data: updatedRows, error } = await supabase
      .from('municipalities')
      .update({ population: pop, population_year: POP_YEAR })
      .eq('id', muniId)
      .select('id');

    if (error) {
      console.error(`FAILED ${censusName}: ${error.message}`);
      failed++;
    } else if (!updatedRows || updatedRows.length === 0) {
      console.error(`FAILED ${censusName}: 0 rows matched`);
      failed++;
    } else {
      console.log(`UPDATED ${censusName}: ${pop.toLocaleString()} (${POP_YEAR})`);
      updated++;
    }
  }

  // Report Census rows not in DB (non-fatal — expected ~6 extra SUMLEV=061 rows)
  if (missingInDb.length > 0) {
    console.warn(`\nCensus SUMLEV=061 rows not matched to any DB municipality (${missingInDb.length}):`);
    for (const n of missingInDb) console.warn(`  UNMATCHED Census: ${n}`);
  }

  // Report DB cities with no Census match (non-fatal if small)
  const dbMissingFromCensus = [...dbNames.keys()].filter(n => !cityMap.has(n));
  if (dbMissingFromCensus.length > 0) {
    console.warn(`\nDB municipalities with no Census match (${dbMissingFromCensus.length}):`);
    for (const n of dbMissingFromCensus) console.warn(`  MISSING: ${n}`);
  }

  console.log(`\nSummary: Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Census rows not in DB: ${missingInDb.length}, DB cities missing from Census: ${dbMissingFromCensus.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
