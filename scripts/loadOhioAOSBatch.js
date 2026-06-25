#!/usr/bin/env node
/**
 * Ohio AOS Summarized Annual Financial Reports — BATCH driver (v2.8 Phase 85 — OHCITY-01/02)
 *
 * For a given fiscal year, opens up to three basis workbooks (GAAP, CASH, MOD), enumerates
 * each city roster via enumerateCities(), assigns every city its best-available basis by
 * precedence GAAP→CASH→MOD (CONTEXT D-02), then iterates the Phase 84 importCity() write
 * path over the whole roster (operating + revenue, never-overwrite guard, per-FY+basis
 * source_url from resolveSourceUrl).
 *
 * Mirrors scripts/loadVAComparativeReportBatch.js (the proven all-localities batch analog):
 * its enumerateRoster→loop-over-single-locality-write-path shape is exactly Ohio's, minus
 * VA's section-segmentation, plus Ohio's GAAP→CASH→MOD per-city fallback.
 *
 * Residual (CONTEXT D-03): cities that appear in an OI_Demographics roster but have no
 * financial row in any basis workbook are reported as source-gap residual (never created as
 * municipalities). The committed residual file (scripts/ohioCityResidual.json) is written in
 * plan 85-02.
 *
 * Acquisition (CONTEXT D-04): use --file-gaap/--file-cash/--file-mod overrides if provided;
 * else resolveSourceUrl(fy, basis) + download to _oh-recon/City_<FY>_<BASIS>_Summarized.XLSX
 * if absent. A basis with no URL or failed download is simply skipped.
 *
 * Live writes run SERIALLY (no parallel RPC fan-out) with the gitignored .env
 * SUPABASE_SERVICE_KEY sourced (CONTEXT D-05). Per-city errors are captured into a failures
 * array without aborting the whole run (mirror the VA load logs).
 *
 * Usage:
 *   node scripts/loadOhioAOSBatch.js --fy 2024 --file-gaap _oh-recon/City_2024_GAAP_Summarized.XLSX --file-cash _oh-recon/City_2024_CASH_Summarized.XLSX --dry-run
 *   node scripts/loadOhioAOSBatch.js --fy 2024 --dry-run           # acquires from manifest
 *   node scripts/loadOhioAOSBatch.js --fy 2024 --limit 10 --dry-run
 *   node scripts/loadOhioAOSBatch.js --fy 2024                     # live (needs .env SUPABASE_SERVICE_KEY)
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import {
  enumerateCities,
  importCity,
  resolveSourceUrl,
  getSupabase,
  detectLayout,
  cellText,
  cellNum,
} from './loadOhioAOS.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECON_DIR = join(__dirname, '..', '_oh-recon');
const FAILURES_LOG = join(__dirname, 'load-ohio-cities.failures.txt');

/**
 * Enumerate demographics-only city names from the OI_Demographics tab of a workbook.
 * These are cities with population/county data but may lack a financial row.
 * Used to compute the source-gap residual (CONTEXT D-03).
 */
function enumerateDemographics(workbook) {
  const layout = detectLayout(workbook);
  const ws = workbook.getWorksheet('OI_Demographics');
  if (!ws) return [];
  const names = [];
  for (let r = layout.demoDataStart; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw = cellText(row.getCell(layout.demoEntityCol));
    if (!raw) continue;
    // Require a finite population value to skip blank/footer rows
    const pop = cellNum(row.getCell(layout.demoPopCol));
    if (!Number.isFinite(pop)) continue;
    const bare = raw.replace(/^city\s+of\s+/i, '').trim();
    if (bare) names.push(bare);
  }
  return names;
}

/**
 * Acquire a workbook for a (fy, basis) combination.
 * If fileOverride is given, use it directly.
 * Else resolve the URL from the manifest and download to _oh-recon/ if absent.
 * Returns { workbook, sourceUrl } or null if the basis is unavailable.
 */
async function acquireWorkbook(fy, basis, fileOverride) {
  if (fileOverride) {
    if (!existsSync(fileOverride)) {
      console.log(`  [${basis}] --file-${basis.toLowerCase()} path not found: ${fileOverride}`);
      return null;
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileOverride);
    const url = resolveSourceUrl(fy, basis);
    return { workbook: wb, sourceUrl: url, file: fileOverride };
  }

  // Resolve from manifest
  const url = resolveSourceUrl(fy, basis);
  if (!url) {
    console.log(`  [${basis}] No manifest URL for FY${fy} ${basis} — skipping`);
    return null;
  }

  const filename = `City_${fy}_${basis}_Summarized.XLSX`;
  const localPath = join(RECON_DIR, filename);

  if (!existsSync(localPath)) {
    // Ensure _oh-recon/ exists
    if (!existsSync(RECON_DIR)) mkdirSync(RECON_DIR, { recursive: true });
    console.log(`  [${basis}] Downloading ${url} → ${localPath}`);
    try {
      execSync(`curl -fsSL -o "${localPath}" "${url}"`, { stdio: 'pipe', timeout: 120000 });
    } catch (e) {
      console.log(`  [${basis}] Download failed (${e.message}) — skipping`);
      return null;
    }
  } else {
    console.log(`  [${basis}] Using cached ${localPath}`);
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(localPath);
  } catch (e) {
    console.log(`  [${basis}] Failed to parse XLSX (${e.message}) — skipping`);
    return null;
  }
  return { workbook: wb, sourceUrl: url, file: localPath };
}

/**
 * Load all Ohio cities for a given fiscal year (GAAP→CASH→MOD basis precedence).
 *
 * opts: {
 *   fy: number,
 *   fileGaap?: string,  // --file-gaap override
 *   fileCash?: string,  // --file-cash override
 *   fileMod?: string,   // --file-mod override
 *   dryRun?: boolean,
 *   limit?: number,
 *   sourceDate?: string,
 * }
 *
 * Returns: {
 *   fy,
 *   processed: number,
 *   assigned: { GAAP: number, CASH: number, MOD: number },
 *   residual: string[],
 *   failures: Array<{ cityName, basis, error }>,
 *   results: Array<importCity summary>,
 * }
 */
export async function loadOhioAOSBatch(opts) {
  const {
    fy,
    fileGaap = null,
    fileCash = null,
    fileMod = null,
    dryRun = false,
    limit = null,
    sourceDate = new Date().toISOString().slice(0, 10),
  } = opts;

  const fiscalYear = Number(fy);

  // ── Step 1: Acquire workbooks per basis ────────────────────────────────────
  console.log(`\nOhio AOS Batch FY${fiscalYear}${dryRun ? '  [dry-run]' : ''}`);
  console.log('Acquiring workbooks:');
  const basisInfos = {}; // { GAAP: { workbook, sourceUrl }, CASH: ..., MOD: ... }

  for (const [basis, override] of [['GAAP', fileGaap], ['CASH', fileCash], ['MOD', fileMod]]) {
    const info = await acquireWorkbook(fiscalYear, basis, override);
    if (info) {
      basisInfos[basis] = info;
      const names = enumerateCities(info.workbook);
      console.log(`  [${basis}] ${names.length} cities in financial tab`);
    }
  }

  if (Object.keys(basisInfos).length === 0) {
    console.error('No workbooks available for any basis — cannot proceed.');
    return { fy: fiscalYear, processed: 0, assigned: { GAAP: 0, CASH: 0, MOD: 0 }, residual: [], failures: [], results: [] };
  }

  // ── Step 2: Enumerate + assign basis (CONTEXT D-02: GAAP→CASH→MOD) ────────
  // Build Map<cityName, { basis, workbook, sourceUrl }>
  // Seed from GAAP first; then CASH-only cities; then MOD-only cities.
  const cityMap = new Map(); // cityName → { basis, workbook, sourceUrl }

  for (const basis of ['GAAP', 'CASH', 'MOD']) {
    if (!basisInfos[basis]) continue;
    const { workbook, sourceUrl } = basisInfos[basis];
    for (const name of enumerateCities(workbook)) {
      if (!cityMap.has(name)) {
        // First basis whose workbook contains this city wins (GAAP→CASH→MOD)
        cityMap.set(name, { basis, workbook, sourceUrl });
      }
    }
  }

  const assigned = { GAAP: 0, CASH: 0, MOD: 0 };
  for (const { basis } of cityMap.values()) {
    assigned[basis] = (assigned[basis] || 0) + 1;
  }

  // ── Step 3: Residual — demographics-only cities (CONTEXT D-03) ─────────────
  // Union all OI_Demographics rosters across opened workbooks; subtract financial-tab set
  const demoSet = new Set();
  for (const { workbook } of Object.values(basisInfos)) {
    for (const name of enumerateDemographics(workbook)) {
      demoSet.add(name);
    }
  }
  const residual = [...demoSet].filter((name) => !cityMap.has(name)).sort();

  console.log(`\nRoster summary:`);
  console.log(`  Assigned: ${cityMap.size} cities (GAAP: ${assigned.GAAP}, CASH: ${assigned.CASH || 0}, MOD: ${assigned.MOD || 0})`);
  console.log(`  Demographics-only residual: ${residual.length} cities`);
  if (residual.length > 0) {
    console.log(`  Residual cities: ${residual.slice(0, 5).join(', ')}${residual.length > 5 ? ` ... (+${residual.length - 5} more)` : ''}`);
  }

  // ── Step 4: Loop over assigned (city, basis) pairs ─────────────────────────
  const allCities = [...cityMap.entries()]; // [cityName, { basis, workbook, sourceUrl }]
  const workList = limit != null ? allCities.slice(0, limit) : allCities;

  const supabase = (dryRun || workList.length === 0) ? null : await getSupabase();
  const fmt = (n) => (n == null || !Number.isFinite(n)) ? '—' : '$' + Math.round(n).toLocaleString('en-US');

  console.log(`\nLoading ${workList.length} cities${limit != null ? ` (limit ${limit})` : ''}...\n`);

  const results = [];
  const failures = [];

  for (const [cityName, { basis, workbook, sourceUrl }] of workList) {
    try {
      const s = await importCity(supabase, workbook, {
        cityName,
        fiscalYear,
        basis,
        sourceUrl: resolveSourceUrl(fiscalYear, basis) || sourceUrl,
        sourceDate,
        dryRun,
      });
      results.push(s);
      const status = dryRun ? 'dry-run' : 'loaded';
      console.log(`  ✓ ${cityName.padEnd(22)} [${basis}]  op ${fmt(s.operatingTotal).padStart(16)}  rev ${fmt(s.revenueTotal).padStart(16)}  pop ${s.population ?? '—'}  [${status}]`);
    } catch (e) {
      failures.push({ cityName, basis, error: e.message });
      console.error(`  ✗ ${cityName} [${basis}] — ERROR: ${e.message}`);
      // Append to failures log for live runs (not dry-run)
      if (!dryRun) {
        try {
          appendFileSync(FAILURES_LOG, `FY${fiscalYear} ${basis} ${cityName}: ${e.message}\n`);
        } catch { /* best-effort */ }
      }
    }
  }

  const processed = workList.length;

  // ── Step 5: Summary output ─────────────────────────────────────────────────
  console.log(`\n--- FY${fiscalYear} Summary ---`);
  console.log(`  Processed: ${processed} cities`);
  console.log(`  Basis distribution: GAAP=${assigned.GAAP}, CASH=${assigned.CASH || 0}, MOD=${assigned.MOD || 0}`);
  console.log(`  Residual (demographics-only, no financial tab row): ${residual.length}`);
  console.log(`  Failures: ${failures.length}`);
  if (dryRun) console.log(`  (dry-run — zero writes)`);

  // Columbus line (dry-run proof)
  const columbusEntry = cityMap.get('Columbus');
  if (columbusEntry) {
    console.log(`  Columbus → basis=${columbusEntry.basis}`);
  }

  return {
    fy: fiscalYear,
    processed,
    assigned,
    residual,
    failures,
    results,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      fy:           { type: 'string' },
      'file-gaap':  { type: 'string' },
      'file-cash':  { type: 'string' },
      'file-mod':   { type: 'string' },
      'source-date':{ type: 'string' },
      limit:        { type: 'string' },
      'dry-run':    { type: 'boolean' },
    },
  });

  if (!values.fy) {
    console.error('Required: --fy <YYYY> [--file-gaap <p>] [--file-cash <p>] [--file-mod <p>] [--limit N] [--dry-run]');
    process.exit(1);
  }

  await loadOhioAOSBatch({
    fy: parseInt(values.fy, 10),
    fileGaap: values['file-gaap'] || null,
    fileCash: values['file-cash'] || null,
    fileMod: values['file-mod'] || null,
    sourceDate: values['source-date'] || undefined,
    limit: values.limit != null ? parseInt(values.limit, 10) : null,
    dryRun: !!values['dry-run'],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
