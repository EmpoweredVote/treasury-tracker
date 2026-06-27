#!/usr/bin/env node
/**
 * MN OSA City/County Finances Report — BATCH driver (v2.9 Phase 90 — MNCITY-01/02)
 *
 * For a given fiscal year, opens the ONE all-cities workbook (cired_<YY>_data.xlsx), enumerates
 * the full city roster via enumerateEntities(), and iterates the Phase 89 importEntity() write
 * path over every city (operating + revenue, never-overwrite guard, per-FY source_url from
 * resolveSourceUrl(fy,'city'), per-FY Population, per-entity GAAPInd basis).
 *
 * SIMPLER than the Ohio batch (scripts/loadOhioAOSBatch.js): MN has ONE workbook per FY with the
 * accounting basis in the per-row `GAAPInd` column, so there is NO GAAP→CASH→MOD precedence
 * assignment — every city is loaded under its own row's basis. The basis "distribution" is just a
 * tally of GAAP-vs-Cash for the SUMMARY + the Phase 90-02 mnCityBasis.json record.
 *
 * Acquisition (CONTEXT D-04): use the --file override if provided; else resolveSourceUrl(fy,'city')
 * + download to _mn-recon/cired_<YY>_data.xlsx if absent. _mn-recon/ is gitignored (Phase 89).
 *
 * Source-gap residual (CONTEXT D-03): a city whose row exists but whose Total Revenues AND Total
 * Expenditures are both blank/zero is reported in `residual`, NEVER written (no phantom rows). The
 * committed cross-FY residual file (scripts/mnCityResidual.json) is written in plan 90-02.
 *
 * Live writes run SERIALLY (no parallel RPC fan-out) with the gitignored .env SUPABASE_SERVICE_KEY
 * sourced (CONTEXT D-05). Per-city errors are captured into a failures array without aborting the run.
 *
 * Usage:
 *   node scripts/loadMNOSABatch.js --fy 2023 --file _mn-recon/cired_23_data.xlsx --dry-run
 *   node scripts/loadMNOSABatch.js --fy 2023 --dry-run        # acquires from manifest
 *   node scripts/loadMNOSABatch.js --fy 2023 --limit 10 --dry-run
 *   node scripts/loadMNOSABatch.js --fy 2023                  # live (needs .env SUPABASE_SERVICE_KEY)
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import {
  enumerateEntities,
  importEntity,
  resolveSourceUrl,
  getSupabase,
  normalizeLabel,
} from './loadMNOSA.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECON_DIR = join(__dirname, '..', '_mn-recon');
const FAILURES_LOG = join(__dirname, 'load-mn-cities.failures.txt');

// Canonical county DB names (handles cross-FY spelling/casing variants — e.g. Lake of the Woods).
let _canonCounty = null;
function canonicalCountyName(bareName) {
  if (_canonCounty === null) {
    try { _canonCounty = JSON.parse(readFileSync(join(__dirname, 'mnCountyNameCanonical.json'), 'utf8')).byStem || {}; }
    catch { _canonCounty = {}; }
  }
  const stem = normalizeLabel(bareName.replace(/\s+county$/i, ''));
  if (_canonCounty[stem]) return _canonCounty[stem];
  return bareName.endsWith(' County') ? bareName : `${bareName} County`;
}

/**
 * Acquire the city workbook for a fiscal year.
 * If fileOverride is given, use it directly. Else resolve city_url from the manifest and
 * download to _mn-recon/cired_<YY>_data.xlsx if absent. Returns { workbook, sourceUrl, file }
 * or null if unavailable.
 */
async function acquireWorkbook(fy, fileOverride, entityType = 'city') {
  const sourceUrl = resolveSourceUrl(fy, entityType);
  if (fileOverride) {
    if (!existsSync(fileOverride)) {
      console.log(`  --file path not found: ${fileOverride}`);
      return null;
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileOverride);
    return { workbook: wb, sourceUrl, file: fileOverride };
  }
  if (!sourceUrl) {
    console.log(`  No manifest ${entityType}_url for FY${fy} — skipping`);
    return null;
  }
  const yy = String(fy).slice(-2);
  // Local cache filename (the manifest URL handles cored_/county_/dash differences — this is just a path).
  const prefix = entityType === 'county' ? 'county' : 'cired';
  const localPath = join(RECON_DIR, `${prefix}_${yy}_data.xlsx`);
  if (!existsSync(localPath)) {
    if (!existsSync(RECON_DIR)) mkdirSync(RECON_DIR, { recursive: true });
    console.log(`  Downloading ${sourceUrl} → ${localPath}`);
    try {
      execSync(`curl -fsSL -o "${localPath}" "${sourceUrl}"`, { stdio: 'pipe', timeout: 120000 });
    } catch (e) {
      console.log(`  Download failed (${e.message}) — skipping FY${fy}`);
      return null;
    }
  } else {
    console.log(`  Using cached ${localPath}`);
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(localPath);
  } catch (e) {
    console.log(`  Failed to parse XLSX (${e.message}) — skipping FY${fy}`);
    return null;
  }
  return { workbook: wb, sourceUrl, file: localPath };
}

/**
 * Load all MN cities for a given fiscal year from the one workbook.
 *
 * opts: { fy, file?, dryRun?, limit?, sourceDate? }
 * Returns: {
 *   fy, processed,
 *   basis: { GAAP, Cash, other },
 *   residual: Array<{ name, reason }>,       // filed-nothing cities (not written)
 *   failures: Array<{ entityName, error }>,
 *   results: Array<importEntity summary>,
 * }
 */
export async function loadMNOSABatch(opts) {
  const {
    fy,
    entityType = 'city',
    file = null,
    dryRun = false,
    limit = null,
    sourceDate = new Date().toISOString().slice(0, 10),
  } = opts;

  const fiscalYear = Number(fy);
  const noun = entityType === 'county' ? 'counties' : 'cities';

  console.log(`\nMN OSA Batch FY${fiscalYear} [${entityType}]${dryRun ? '  [dry-run]' : ''}`);
  console.log('Acquiring workbook:');
  const info = await acquireWorkbook(fiscalYear, file, entityType);
  if (!info) {
    console.error(`No workbook available for FY${fiscalYear} ${entityType} — cannot proceed.`);
    return { fy: fiscalYear, entityType, processed: 0, basis: { GAAP: 0, Cash: 0, other: 0 }, residual: [], failures: [], results: [] };
  }
  const { workbook, sourceUrl } = info;

  const roster = enumerateEntities(workbook, entityType);
  console.log(`  ${roster.length} ${noun} in Governmental Funds sheet`);

  const workList = limit != null ? roster.slice(0, limit) : roster;
  const supabase = (dryRun || workList.length === 0) ? null : await getSupabase();
  const fmt = (n) => (n == null || !Number.isFinite(n)) ? '—' : '$' + Math.round(n).toLocaleString('en-US');

  console.log(`\nLoading ${workList.length} ${noun}${limit != null ? ` (limit ${limit})` : ''}...\n`);

  const results = [];
  const failures = [];
  const basis = { GAAP: 0, Cash: 0, other: 0 };
  const residual = [];

  for (const entityName of workList) {
    // County canonical DB name: "<Name> County" (MN city/county name collision — D-02),
    // mapped through the canonical-alias table to collapse cross-FY spelling variants.
    const municipalityName = entityType === 'county' ? canonicalCountyName(entityName) : null;
    try {
      const s = await importEntity(supabase, workbook, {
        entityName,
        municipalityName,
        fiscalYear,
        sourceUrl: resolveSourceUrl(fiscalYear, entityType) || sourceUrl,
        sourceDate,
        dryRun,
        entityType,
      });
      results.push(s);
      // Basis tally (per-row GAAPInd; counties have no GAAPInd → all 'other'/unknown)
      if (s.basis === 'GAAP') basis.GAAP += 1;
      else if (s.basis === 'Cash') basis.Cash += 1;
      else basis.other += 1;
      // Source-gap residual: filed nothing (both totals zero/blank) — never written.
      const noFin = (!Number.isFinite(s.revenueTotal) || s.revenueTotal === 0)
        && (!Number.isFinite(s.operatingTotal) || s.operatingTotal === 0);
      if (noFin) residual.push({ name: s.entityName, reason: `no Governmental Funds financial total in FY${fiscalYear}` });
    } catch (e) {
      failures.push({ entityName, error: e.message });
      console.error(`  ✗ ${entityName} — ERROR: ${e.message}`);
      if (!dryRun) {
        try { appendFileSync(FAILURES_LOG, `FY${fiscalYear} ${entityName}: ${e.message}\n`); } catch { /* best-effort */ }
      }
    }
  }

  const processed = workList.length;

  console.log(`\n--- FY${fiscalYear} Summary ---`);
  console.log(`  Processed: ${processed} ${noun}`);
  console.log(`  Basis distribution: GAAP=${basis.GAAP}, Cash=${basis.Cash}${basis.other ? `, other/unknown=${basis.other}` : ''}`);
  console.log(`  Source-gap residual (filed nothing): ${residual.length}`);
  console.log(`  Failures: ${failures.length}`);
  if (dryRun) console.log(`  (dry-run — zero writes)`);

  const sampleName = entityType === 'county' ? 'Hennepin County' : 'Minneapolis';
  const sample = results.find((r) => r.entityName === sampleName);
  if (sample) console.log(`  ${sampleName} → basis=${sample.basis ?? 'n/a'}  rev ${fmt(sample.revenueTotal)}  op ${fmt(sample.operatingTotal)}  pop ${sample.population ?? '—'}`);

  return { fy: fiscalYear, entityType, processed, basis, residual, failures, results };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      fy:            { type: 'string' },
      'entity-type': { type: 'string' },
      file:          { type: 'string' },
      'source-date': { type: 'string' },
      limit:         { type: 'string' },
      'dry-run':     { type: 'boolean' },
    },
  });

  if (!values.fy) {
    console.error('Required: --fy <YYYY> [--entity-type city|county] [--file <path>] [--limit N] [--dry-run]');
    process.exit(1);
  }
  const entityType = (values['entity-type'] || 'city').toLowerCase();
  if (!['city', 'county'].includes(entityType)) {
    console.error(`--entity-type must be 'city' or 'county', got: ${entityType}`);
    process.exit(1);
  }

  await loadMNOSABatch({
    fy: parseInt(values.fy, 10),
    entityType,
    file: values.file || null,
    sourceDate: values['source-date'] || undefined,
    limit: values.limit != null ? parseInt(values.limit, 10) : null,
    dryRun: !!values['dry-run'],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
