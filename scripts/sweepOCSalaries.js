#!/usr/bin/env node
/**
 * OC Salary Sweep — Phase 55 Plan 55-03
 *
 * Loads GCC salary data for all 34 Orange County cities across the full year range
 * (2009–2024), downloading each year's ZIP exactly ONCE and processing all cities
 * from that single download.
 *
 * Strategy (efficiency-first):
 *   OUTER LOOP: year (2009–2024, 16 ZIPs total)
 *   INNER LOOP: city (34 OC cities per year)
 *   → 16 ZIP downloads total instead of 34×16=544
 *
 * Cities read FROM THE DB (not hard-coded): municipalities with county_id = OC entity.
 *
 * Writes only p_dataset_type='salaries' — additive, never touches operating/revenue rows.
 * Gap cities (no rows in that year's CSV) get no salaries row — documented (D-06).
 *
 * Usage:
 *   node scripts/sweepOCSalaries.js [--dry-run] [--start-year 2020] [--end-year 2024]
 *   node scripts/sweepOCSalaries.js --dry-run --start-year 2024 --end-year 2024
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ── Env / Supabase setup ─────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── GCC constants ────────────────────────────────────────────────────────────

const GCC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const GCC_ZIP_URL = (year) => `https://gcc.sco.ca.gov/RawExport/${year}_City.zip`;
const GCC_YEARS = [2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];

// OC County entity ID (Phase 54)
const OC_COUNTY_ID = '65e7c643-5829-4821-9537-f8595bce61ab';

const DATA_SOURCE_NAME = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';

// ── GCC CSV field indices (0-based, from 55-SPIKE-FINDINGS.md) ───────────────

const COL_EMPLOYER_NAME   = 2;
const COL_DEPT            = 3;
const COL_POSITION        = 4;
const COL_REGULAR_PAY     = 11;
const COL_OVERTIME_PAY    = 12;
const COL_LUMP_SUM_PAY    = 13;
const COL_OTHER_PAY       = 14;
const COL_TOTAL_WAGES     = 15;
const COL_TOTAL_BENEFITS  = 20;

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) continue;
    rows.push(parseCSVLine(trimmed));
  }
  return rows;
}

// ── ZIP extractor ─────────────────────────────────────────────────────────────

function extractCsvFromZipSync(zipBuffer) {
  let offset = 0;
  while (offset + 30 < zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compression = zipBuffer.readUInt16LE(offset + 8);
    const compSize    = zipBuffer.readUInt32LE(offset + 18);
    const fnLen       = zipBuffer.readUInt16LE(offset + 26);
    const extraLen    = zipBuffer.readUInt16LE(offset + 28);
    const fileName    = zipBuffer.slice(offset + 30, offset + 30 + fnLen).toString('utf8');
    const dataStart   = offset + 30 + fnLen + extraLen;
    const compressedData = zipBuffer.slice(dataStart, dataStart + compSize);
    if (fileName.toLowerCase().endsWith('.csv')) {
      let uncompressed;
      if (compression === 0) { uncompressed = compressedData; }
      else if (compression === 8) { uncompressed = inflateRawSync(compressedData); }
      else { throw new Error(`Unsupported ZIP compression method ${compression}`); }
      return { fileName, data: uncompressed };
    }
    offset = dataStart + compSize;
  }
  throw new Error('No .csv file found in ZIP archive');
}

// ── Download + parse year ZIP → all-city row map ────────────────────────────

/**
 * Download the year ZIP, parse the CSV, and build a map of
 * city name (lower-cased) → array of row arrays.
 * Returns the map so inner loop can slice per-city without re-downloading.
 */
function downloadAndIndexYear(year, cacheDir) {
  const cachePath = path.join(cacheDir, `${year}_City.zip`);

  // Use cached file if present (from a prior interrupted run)
  let zipBuf;
  if (fs.existsSync(cachePath)) {
    console.log(`  [cache hit] ${cachePath}`);
    zipBuf = fs.readFileSync(cachePath);
  } else {
    const url = GCC_ZIP_URL(year);
    console.log(`  Downloading ${url} ...`);
    try {
      zipBuf = execSync(
        `curl -s -A "${GCC_UA}" "${url}"`,
        { maxBuffer: 120 * 1024 * 1024, timeout: 180_000 }
      );
    } catch (err) {
      throw new Error(`curl download failed for ${year}: ${err.message}`);
    }
    if (zipBuf.length < 1000 || zipBuf.readUInt32LE(0) !== 0x04034b50) {
      throw new Error(`GCC returned non-ZIP response for ${year} (${zipBuf.length} bytes)`);
    }
    fs.writeFileSync(cachePath, zipBuf);
    console.log(`  Downloaded + cached (${(zipBuf.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  const { fileName, data } = extractCsvFromZipSync(zipBuf);
  const csvText = data.toString('utf8');
  console.log(`  Parsed ${fileName} (${(csvText.length / 1024 / 1024).toFixed(1)} MB)`);

  const rows = parseCSV(csvText);
  if (rows.length < 2) return new Map();

  // Build a map: city name (lower) → rows (skip header row 0)
  const cityMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 21) continue;
    const name = (row[COL_EMPLOYER_NAME] || '').trim().toLowerCase();
    if (!name) continue;
    if (!cityMap.has(name)) cityMap.set(name, []);
    cityMap.get(name).push(row);
  }

  console.log(`  Indexed ${cityMap.size} distinct employers in ${year}`);
  return cityMap;
}

// ── Tree builder ─────────────────────────────────────────────────────────────

function buildTree(rows) {
  const depts = new Map();
  for (const row of rows) {
    const dept = (row[COL_DEPT] || 'UNKNOWN').trim() || 'UNKNOWN';
    const pos  = (row[COL_POSITION] || 'Unknown Position').trim() || 'Unknown Position';
    const totalWages    = parseFloat(row[COL_TOTAL_WAGES])    || 0;
    const totalBenefits = parseFloat(row[COL_TOTAL_BENEFITS]) || 0;
    const totalComp     = totalWages + totalBenefits;
    if (totalComp === 0) continue;
    const base  = parseFloat(row[COL_REGULAR_PAY])  || 0;
    const ot    = parseFloat(row[COL_OVERTIME_PAY])  || 0;
    const lump  = parseFloat(row[COL_LUMP_SUM_PAY])  || 0;
    const other = parseFloat(row[COL_OTHER_PAY])     || 0;
    const otOth = ot + lump + other;
    if (!depts.has(dept)) depts.set(dept, new Map());
    const posMap = depts.get(dept);
    if (!posMap.has(pos)) {
      posMap.set(pos, { total: 0, count: 0, sumBase: 0, sumOtOth: 0, sumBenefits: 0 });
    }
    const entry = posMap.get(pos);
    entry.total       += totalComp;
    entry.count       += 1;
    entry.sumBase     += base;
    entry.sumOtOth    += otOth;
    entry.sumBenefits += totalBenefits;
  }
  let grandTotal = 0;
  const tree = [];
  for (const [deptName, posMap] of depts) {
    let deptTotal = 0;
    const children = [];
    for (const [posName, entry] of posMap) {
      const count = entry.count;
      deptTotal += entry.total;
      const m = {
        avgBase:          count > 0 ? Math.round(entry.sumBase     / count) : 0,
        avgOvertimeOther: count > 0 ? Math.round(entry.sumOtOth    / count) : 0,
        avgBenefits:      count > 0 ? Math.round(entry.sumBenefits / count) : 0,
        count,
      };
      children.push({ n: `${posName} (${count})`, a: entry.total, m });
    }
    children.sort((a, b) => b.a - a.a);
    grandTotal += deptTotal;
    tree.push({ n: deptName, a: deptTotal, c: children });
  }
  tree.sort((a, b) => b.a - a.a);
  return { tree, total: grandTotal };
}

// ── Supabase sync ─────────────────────────────────────────────────────────────

async function syncCityYear(municipalityId, year, rows, dryRun) {
  const { tree, total } = buildTree(rows);
  const deptCount = tree.length;
  const posCount  = tree.reduce((s, d) => s + d.c.length, 0);
  const rowCount  = rows.length;

  if (dryRun) {
    console.log(`    [dry-run] ${deptCount} depts, ${posCount} positions, ${rowCount} records, total $${Math.round(total).toLocaleString()}`);
    return { total: Math.round(total), rowCount, deptCount, posCount };
  }

  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id:  municipalityId,
    p_fiscal_year:      year,
    p_dataset_type:     'salaries',
    p_total:            total,
    p_tree:             tree,
    p_row_count:        rowCount,
    p_data_source_name: DATA_SOURCE_NAME,
  });

  if (error) {
    console.error(`    RPC error: ${error.message}`);
    return null;
  }

  console.log(`    Wrote salaries: ${deptCount} depts, ${posCount} positions, ${rowCount} records, total $${Math.round(total).toLocaleString()}`);
  return { total: Math.round(total), rowCount, deptCount, posCount, dbRows: data?.rows_inserted };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run':    { type: 'boolean' },
      'start-year': { type: 'string' },
      'end-year':   { type: 'string' },
    },
    strict: false,
  });

  const dryRun    = values['dry-run'] ?? false;
  const startYear = values['start-year'] ? Number(values['start-year']) : 2009;
  const endYear   = values['end-year']   ? Number(values['end-year'])   : 2024;
  const years     = GCC_YEARS.filter(y => y >= startYear && y <= endYear);

  console.log('\nOC Salary Sweep — Phase 55 Plan 55-03');
  console.log(`  Years: ${years[0]}–${years[years.length-1]} (${years.length} ZIPs to download)`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Source: ${DATA_SOURCE_NAME}\n`);

  // Step 1: Read OC cities FROM DB
  console.log('Fetching OC cities from DB...');
  const { data: cities, error: cityErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id,name')
    .eq('county_id', OC_COUNTY_ID)
    .eq('entity_type', 'city')
    .order('name');

  if (cityErr) { console.error('Failed to fetch OC cities:', cityErr.message); process.exit(1); }
  console.log(`Found ${cities.length} OC cities in DB:\n  ${cities.map(c=>c.name).join(', ')}\n`);

  // Step 2: Create temp cache dir (for ZIPs)
  const cacheDir = path.join(os.tmpdir(), 'gcc-salary-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`ZIP cache dir: ${cacheDir}\n`);

  // Step 3: Coverage tracking
  // cityResults[cityName] = { years: [{year, total, rowCount, deptCount, posCount}], gap: [] }
  const cityResults = {};
  for (const c of cities) {
    cityResults[c.name] = { id: c.id, covered: [], gaps: [] };
  }

  let totalSalaryRows = 0;
  let totalDownloads = 0;

  // Step 4: OUTER LOOP = year; INNER LOOP = city (efficient: 16 downloads, not 544)
  for (const year of years) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Year ${year}`);

    let cityMap;
    try {
      cityMap = downloadAndIndexYear(year, cacheDir);
      totalDownloads++;
    } catch (err) {
      console.error(`  ERROR downloading ${year}: ${err.message}`);
      // Mark all cities as gapped for this year
      for (const c of cities) {
        cityResults[c.name].gaps.push({ year, reason: `Download failed: ${err.message}` });
      }
      continue;
    }

    // INNER LOOP: cities
    for (const city of cities) {
      const cityKey = city.name.trim().toLowerCase();
      const rows = cityMap.get(cityKey) || [];

      if (rows.length === 0) {
        console.log(`  ${city.name} (${year}): no records — gap (D-06)`);
        cityResults[city.name].gaps.push({ year, reason: 'Not in GCC source for this year' });
        continue;
      }

      console.log(`  ${city.name} (${year}): ${rows.length.toLocaleString()} records`);
      const result = await syncCityYear(city.id, year, rows, dryRun);

      if (result) {
        cityResults[city.name].covered.push({ year, ...result });
        totalSalaryRows += result.rowCount;
      } else {
        cityResults[city.name].gaps.push({ year, reason: 'Sync RPC error' });
      }

      // Politeness: brief pause between cities within a year (no extra downloads)
      await new Promise(r => setTimeout(r, 50));
    }

    // Pause between year downloads to be gentle on source
    if (year !== years[years.length - 1]) {
      console.log(`\n  [pause 2s between year downloads]`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Step 5: Summary output
  console.log('\n\n' + '='.repeat(60));
  console.log('SWEEP COMPLETE');
  console.log('='.repeat(60));

  const covered = cities.filter(c => cityResults[c.name].covered.length > 0);
  const gapped  = cities.filter(c => cityResults[c.name].covered.length === 0);

  console.log(`\nCovered cities: ${covered.length}`);
  console.log(`Gap cities:     ${gapped.length}`);
  console.log(`Total downloads: ${totalDownloads} ZIPs`);
  console.log(`Total salary records processed: ${totalSalaryRows.toLocaleString()}`);

  console.log('\n--- COVERED ---');
  for (const c of covered) {
    const r = cityResults[c.name];
    const years = r.covered.map(x => x.year).sort();
    const grandTotal = r.covered.reduce((s,x) => s + (x.total||0), 0);
    console.log(`  ${c.name}: ${years.length} years (${years[0]}–${years[years.length-1]}), total comp $${Math.round(grandTotal).toLocaleString()}`);
  }

  if (gapped.length > 0) {
    console.log('\n--- GAPS ---');
    for (const c of gapped) {
      console.log(`  ${c.name}: no GCC coverage found`);
    }
  }

  // Write results JSON for coverage doc generation
  const resultPath = path.join(cacheDir, 'sweep-results.json');
  fs.writeFileSync(resultPath, JSON.stringify({ cities: cityResults, covered: covered.map(c=>c.name), gapped: gapped.map(c=>c.name) }, null, 2));
  console.log(`\nResults saved to: ${resultPath}`);

  return { cityResults, covered, gapped };
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
