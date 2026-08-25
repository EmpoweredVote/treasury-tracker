#!/usr/bin/env node
/**
 * Statewide (non-OC) CA Salary Sweep — Phase 60 Plan 60-01/60-02
 *
 * Loads GCC salary data for the NON-Orange-County CA cities across the full year
 * range (2009–2024), downloading each year's ZIP exactly ONCE and processing all
 * target cities from that single download.
 *
 * Strategy (efficiency-first), identical to sweepOCSalaries.js:
 *   OUTER LOOP: year (2009–2024, 16 ZIPs total)
 *   INNER LOOP: city (the non-OC CA cohort per year)
 *   → 16 ZIP downloads total instead of ~98×16.
 *
 * Cohort read FROM THE DB (not hard-coded): CA municipalities with
 * entity_type='city' whose county_id is NOT Orange County. NULL-county cities
 * (e.g. San Francisco, a combined city-county node) ARE included — the OC
 * exclusion is done in JS so the null-unsafe SQL `<>` does not silently drop them.
 *
 * Optional --county "<Name>" narrows the cohort to a single county (resolved as
 * "<Name> County"), e.g. --county "Los Angeles".
 *
 * Writes only p_dataset_type='salaries' — additive, never touches operating/revenue rows.
 * Never-overwrite: treasury_sync_city_budget keys on (municipality_id, fiscal_year,
 * dataset_type) and preserves a different data_source. Gap cities (no rows in that
 * year's CSV) get no salaries row — documented (D-06).
 *
 * Usage:
 *   node scripts/sweepCASalaries.js [--dry-run] [--start-year 2009] [--end-year 2024] [--county "<Name>"]
 *   node scripts/sweepCASalaries.js --dry-run --start-year 2024 --end-year 2024
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Shared helpers (single source of truth — see loadCASalaries.js).
import { normalizeDeptLabel, parseMoney } from './loadCASalaries.js';

// ── Env / Supabase setup ─────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── GCC constants ────────────────────────────────────────────────────────────

const GCC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const GCC_ZIP_URL = (year) => `https://gcc.sco.ca.gov/RawExport/${year}_City.zip`;
const GCC_YEARS = [2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];

// OC County entity ID (Phase 54) — EXCLUDED from this sweep (already loaded in v2.2).
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
    const gpFlag      = zipBuffer.readUInt16LE(offset + 6);
    const compression = zipBuffer.readUInt16LE(offset + 8);
    const compSize    = zipBuffer.readUInt32LE(offset + 18);
    const fnLen       = zipBuffer.readUInt16LE(offset + 26);

    // Streamed entry (general-purpose bit 3): sizes live in a trailing data descriptor,
    // not the local header this extractor reads. Fail loudly rather than mis-extract (WR-03).
    if (gpFlag & 0x08) {
      const namePeek = zipBuffer.slice(offset + 30, offset + 30 + fnLen).toString('utf8');
      throw new Error(`ZIP entry ${namePeek} uses a data descriptor (streamed); compSize is in the trailing descriptor and is unsupported by this extractor.`);
    }
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

function downloadAndIndexYear(year, cacheDir) {
  const cachePath = path.join(cacheDir, `${year}_City.zip`);

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
    const tmpPath = `${cachePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, zipBuf);
    fs.renameSync(tmpPath, cachePath);
    console.log(`  Downloaded + cached (${(zipBuf.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  if (zipBuf.length < 1000 || zipBuf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`Cached/downloaded ZIP for ${year} is not a valid ZIP (${zipBuf.length} bytes)`);
  }

  const { fileName, data } = extractCsvFromZipSync(zipBuf);
  const csvText = data.toString('utf8');
  console.log(`  Parsed ${fileName} (${(csvText.length / 1024 / 1024).toFixed(1)} MB)`);

  const rows = parseCSV(csvText);
  if (rows.length < 2) return new Map();

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
    const dept = normalizeDeptLabel(row[COL_DEPT]); // expand approved abbreviations (D-01: no fabrication)
    const pos  = (row[COL_POSITION] || 'Unknown Position').trim() || 'Unknown Position';
    const totalWages    = parseMoney(row[COL_TOTAL_WAGES]);
    const totalBenefits = parseMoney(row[COL_TOTAL_BENEFITS]);
    const totalComp     = totalWages + totalBenefits;
    if (totalComp === 0) continue;
    const base  = parseMoney(row[COL_REGULAR_PAY]);
    const ot    = parseMoney(row[COL_OVERTIME_PAY]);
    const lump  = parseMoney(row[COL_LUMP_SUM_PAY]);
    const other = parseMoney(row[COL_OTHER_PAY]);
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
    // GCC is a W-2-based CALENDAR-year report, so month 1 — not the 7 the
    // RPC used to hardcode. Authority in lib/loaderFiscalCalendars.mjs.
    p_fiscal_year_start_month: monthForSource(DATA_SOURCE_NAME),
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
      'county':     { type: 'string' },
    },
    strict: false,
  });

  const dryRun    = values['dry-run'] ?? false;
  const startYear = values['start-year'] ? Number(values['start-year']) : 2009;
  const endYear   = values['end-year']   ? Number(values['end-year'])   : 2024;
  const countyFilter = values['county'] || null;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    console.error('Invalid --start-year/--end-year range (must be integers, start <= end)');
    process.exit(1);
  }
  const years = GCC_YEARS.filter(y => y >= startYear && y <= endYear);

  console.log('\nStatewide (non-OC) CA Salary Sweep — Phase 60');
  console.log(`  Years: ${years[0]}–${years[years.length-1]} (${years.length} ZIPs to download)`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  County filter: ${countyFilter || '(all non-OC CA cities)'}`);
  console.log(`  Source: ${DATA_SOURCE_NAME}\n`);

  // Step 1: Resolve the target cohort FROM DB.
  let targetCountyId = null;
  if (countyFilter) {
    const countyEntityName = `${countyFilter} County`;
    const { data: county, error: cErr } = await supabase
      .schema('treasury')
      .from('municipalities')
      .select('id,name')
      .eq('state', 'CA')
      .eq('entity_type', 'county')
      .ilike('name', countyEntityName)
      .maybeSingle();
    if (cErr) { console.error('County lookup failed:', cErr.message); process.exit(1); }
    if (!county) { console.error(`County entity "${countyEntityName}" not found.`); process.exit(1); }
    targetCountyId = county.id;
    console.log(`Resolved county "${county.name}" [${targetCountyId}]`);
  }

  console.log('Fetching CA cities from DB...');
  const { data: allCities, error: cityErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id,name,county_id')
    .eq('state', 'CA')
    .eq('entity_type', 'city')
    .order('name');

  if (cityErr) { console.error('Failed to fetch CA cities:', cityErr.message); process.exit(1); }
  if (!allCities || allCities.length === 0) { console.error('No CA cities found'); process.exit(1); }

  // Cohort selection in JS (NULL-safe): exclude OC, or narrow to --county.
  // PostgREST .neq is null-unsafe and would drop NULL-county cities (e.g. San Francisco).
  const cities = allCities.filter(c =>
    targetCountyId ? c.county_id === targetCountyId : c.county_id !== OC_COUNTY_ID
  );
  if (cities.length === 0) { console.error('No target cities after cohort filter'); process.exit(1); }
  console.log(`Target cohort: ${cities.length} cities:\n  ${cities.map(c=>c.name).join(', ')}\n`);

  // Step 2: Temp cache dir for ZIPs
  const cacheDir = path.join(os.tmpdir(), 'gcc-salary-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`ZIP cache dir: ${cacheDir}\n`);

  // Step 3: Coverage tracking
  const cityResults = {};
  for (const c of cities) {
    cityResults[c.name] = { id: c.id, covered: [], gaps: [], preserved: [] };
  }

  // Step 3a: Never-overwrite guard (matches the budget loaders' findConflictingBudget
  // convention). treasury_sync_city_budget has NO source-aware guard — it deletes+replaces
  // the tree for any existing (muni, fiscal_year, dataset_type) row and leaves the old
  // data_source label stale. So we pre-load existing 'salaries' rows for the cohort and
  // SKIP any (municipality_id, fiscal_year) that already has a row from a DIFFERENT source
  // (e.g. Los Angeles FY2017–2026 'LA City Payroll'). Same-source (GCC) rows are re-writable
  // (idempotent). The protected set is keyed `${municipality_id}|${fiscal_year}`.
  const cohortIds = cities.map(c => c.id);
  const { data: existingSal, error: exErr } = await supabase
    .schema('treasury')
    .from('budgets')
    .select('municipality_id,fiscal_year,data_source')
    .eq('dataset_type', 'salaries')
    .in('municipality_id', cohortIds);
  if (exErr) { console.error('Failed to load existing salaries rows:', exErr.message); process.exit(1); }
  const protectedKeys = new Set();
  for (const row of existingSal || []) {
    if (row.data_source !== DATA_SOURCE_NAME) {
      protectedKeys.add(`${row.municipality_id}|${row.fiscal_year}`);
    }
  }
  console.log(`Never-overwrite guard: ${protectedKeys.size} existing (city, year) salaries rows from another source will be preserved (skipped).\n`);

  let totalSalaryRows = 0;
  let totalDownloads = 0;
  let totalPreserved = 0;
  let hadFailures = false;

  // Step 4: OUTER LOOP = year; INNER LOOP = city (efficient: 16 downloads, not ~1,568)
  for (const year of years) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Year ${year}`);

    let cityMap;
    try {
      cityMap = downloadAndIndexYear(year, cacheDir);
      totalDownloads++;
    } catch (err) {
      console.error(`  ERROR downloading ${year}: ${err.message}`);
      hadFailures = true;
      for (const c of cities) {
        cityResults[c.name].gaps.push({ year, reason: `Download failed: ${err.message}` });
      }
      continue;
    }

    for (const city of cities) {
      // Never-overwrite: preserve an existing salaries row from another source.
      if (protectedKeys.has(`${city.id}|${year}`)) {
        console.log(`  ${city.name} (${year}): SKIP — preserving existing salaries from another source (never-overwrite)`);
        cityResults[city.name].preserved.push({ year });
        totalPreserved++;
        continue;
      }

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
        hadFailures = true;
      }

      await new Promise(r => setTimeout(r, 50));
    }

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
  console.log(`Preserved (city, year) rows skipped (never-overwrite): ${totalPreserved}`);
  console.log(`Total downloads: ${totalDownloads} ZIPs`);
  console.log(`Total salary records processed: ${totalSalaryRows.toLocaleString()}`);

  console.log('\n--- COVERED ---');
  for (const c of covered) {
    const r = cityResults[c.name];
    const yrs = r.covered.map(x => x.year).sort();
    const grandTotal = r.covered.reduce((s,x) => s + (x.total||0), 0);
    console.log(`  ${c.name}: ${yrs.length} years (${yrs[0]}–${yrs[yrs.length-1]}), total comp $${Math.round(grandTotal).toLocaleString()}`);
  }

  if (gapped.length > 0) {
    console.log('\n--- GAPS (no GCC coverage in the swept range) ---');
    for (const c of gapped) {
      console.log(`  ${c.name}: no GCC coverage found`);
    }
  }

  // Write results JSON for coverage doc generation (Plan 60-03)
  const resultName = countyFilter ? `sweep-results-ca-${countyFilter.replace(/\s+/g,'-').toLowerCase()}.json` : 'sweep-results-ca.json';
  const resultPath = path.join(cacheDir, resultName);
  fs.writeFileSync(resultPath, JSON.stringify({ cities: cityResults, covered: covered.map(c=>c.name), gapped: gapped.map(c=>c.name) }, null, 2));
  console.log(`\nResults saved to: ${resultPath}`);

  if (hadFailures) {
    console.error('\nCompleted with failures (download or sync RPC errors) — DB load is INCOMPLETE.');
    process.exit(1);
  }

  return { cityResults, covered, gapped };
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
