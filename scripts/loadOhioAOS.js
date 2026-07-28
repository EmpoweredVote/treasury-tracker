#!/usr/bin/env node
/**
 * Ohio Auditor of State Summarized Annual Financial Reports Loader (v2.8 Phase 84 — OHSRC-01/02)
 *
 * Parses the Ohio AOS "Summarized Annual Financial Reports" (Hinkle System) all-cities XLSX
 * into the tracker's budget tree for a single city and writes it to Supabase via the
 * existing budget RPCs.
 *
 * Mirrors scripts/loadVAComparativeReport.js (the closest analog): reuses the formula-safe
 * cellNum/cellText helpers, the getSupabase/findConflictingBudget/importDataset write path,
 * and the never-overwrite guard (treasury_sync_city_budget is NOT source-safe — see
 * auto-memory project_sync_city_budget_not_source_safe). Swaps VA's multi-exhibit layout
 * for Ohio's single flat wide table: one row per city, columns = categories.
 *
 * Supports both workbook formats (OHSRC-02):
 *   GAAP:     SOREACIFB_TotalGov  — "Revenues" / "Expenditures" terminology
 *   CASH/MOD: SORDACIFB_TotalGov  — "Receipts"  / "Disbursements" terminology
 *             (smaller workbook, ~5-7 cities that file a non-GAAP basis)
 *
 * Trees (CONTEXT D-01/D-02/D-04/D-04b):
 *   - Revenue ('revenue'): flat 1-level tree of the SOREACIFB/SORDACIFB revenue source columns
 *       INCLUDING Intergovernmental (D-01); total = "Total" column.
 *   - Expenditure ('operating'): flat 1-level tree of the ~18 expenditure/disbursement function
 *       columns INCLUDING Capital Outlay, Principal Retirement, Interest & Fiscal Charges,
 *       Bond Issuance Costs (D-02); total = "Total" column.
 *   Both trees are FLAT (D-04): leaf nodes only, no sub-levels.
 *   EXCLUDED (D-04b): Other Financing Sources/Uses and fund-balance lines.
 *
 * GAAP layout — SOREACIFB_TotalGov:
 *   Row 7 = column headers; data starts row 8.
 *   Col 1: Entity Name, Col 2: County
 *   Cols 3-15: Revenue sources; Col 16: Total Revenues
 *   Cols 17-34: Expenditure functions; Col 35: Total Expenditures
 *   Cols 36+: Other Financing / Fund Balances — EXCLUDED
 *
 * CASH/MOD layout — SORDACIFB_TotalGov:
 *   Row 6 = column headers; data starts row 7.
 *   Col 2: Entity Name, Col 4: County
 *   Cols 5-17: Receipt sources; Col 18: Total Receipts
 *   Cols 19-36: Disbursement functions; Col 37: Total Disbursements
 *   Cols 38+: Other Financing / Fund Balances — EXCLUDED
 *
 * OI_Demographics sheet layout:
 *   GAAP:     Row 4 = headers; data row 5. Col 1: Entity, Col 2: County, Col 3: Pop
 *   CASH/MOD: Row 3 = headers; data row 4. Col 2: Entity, Col 3: County, Col 4: Pop
 *
 * Source stamping (D-05): data_source='Ohio Auditor of State Summarized Annual Financial
 * Reports'; source_url = per-FY+basis direct file URL (--source-url); source_date = fetch date.
 *
 * Usage:
 *   node scripts/loadOhioAOS.js --file <xlsx> --city Columbus --fy 2024 --basis GAAP --dry-run
 *   node scripts/loadOhioAOS.js --file <xlsx> --city Kenton --fy 2024 --basis CASH --dry-run
 *   node scripts/loadOhioAOS.js --file <xlsx> --city Columbus --fy 2024 --basis GAAP --source-url <url>
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';

export const DATA_SOURCE_NAME = 'Ohio Auditor of State Summarized Annual Financial Reports';

// ── Workbook layout profiles (GAAP vs CASH/MOD) ──────────────────────────────
/**
 * Detect which layout profile applies based on which sheet name exists.
 * Returns a layout descriptor with all per-format constants.
 *
 * GAAP workbook uses SOREACIFB_TotalGov (accrual-basis terminology: Revenues/Expenditures).
 * CASH/MOD workbooks use SORDACIFB_TotalGov (cash/modified-basis: Receipts/Disbursements).
 * Both share the OI_Demographics tab for population/county, but with different offsets.
 */
export function detectLayout(workbook, entityType = 'city') {
  if (workbook.getWorksheet('SOREACIFB_TotalGov')) {
    if (entityType === 'county') {
      // County GAAP: header row 6, data row 7, entity col 1, county col 2.
      // Revenue sources cols 3-15, Total col 16.
      // Expenditure functions cols 17-31, Total col 32.
      // Cols 33+ = Excess/OFS/fund-balance/transfers — EXCLUDED (mirrors city D-04b).
      // OI_Demographics: row 4 = headers, data row 5, entity col 1, county col 2, pop col 3.
      return {
        basis: 'GAAP',
        sheetName: 'SOREACIFB_TotalGov',
        headerRow: 6, dataStart: 7,
        entityCol: 1, countyCol: 2,
        revSourceCols: [3,4,5,6,7,8,9,10,11,12,13,14,15],
        revTotalCol: 16,
        expFuncCols:  [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
        expTotalCol: 32,
        demoHeaderRow: 4, demoDataStart: 5,
        demoEntityCol: 1, demoCountyCol: 2, demoPopCol: 3,
      };
    }
    // City GAAP: row 7 = headers, data row 8, entity col 1, county col 2
    return {
      basis: 'GAAP',
      sheetName: 'SOREACIFB_TotalGov',
      headerRow: 7, dataStart: 8,
      entityCol: 1, countyCol: 2,
      revSourceCols: [3,4,5,6,7,8,9,10,11,12,13,14,15],
      revTotalCol: 16,
      expFuncCols:  [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34],
      expTotalCol: 35,
      // OI_Demographics: row 4 = headers, data row 5, entity col 1
      demoHeaderRow: 4, demoDataStart: 5,
      demoEntityCol: 1, demoCountyCol: 2, demoPopCol: 3,
    };
  }
  if (workbook.getWorksheet('SORDACIFB_TotalGov')) {
    if (entityType === 'county') {
      // County CASH/MOD: header row 6, data row 7, entity col 1, county col 2.
      // Receipt sources cols 3-15, Total col 16.
      // Disbursement functions cols 17-31, Total col 32.
      // Cols 33+ = Excess/OFS/fund-balance/transfers — EXCLUDED.
      // OI_Demographics: row 4 = headers, data row 5.
      //   GAAP/CASH county workbooks: entity col 1, county col 2, pop col 3.
      //   MOD county workbook: entity col 2, county col 3, pop col 4 (col 1 is blank).
      // Both share the same financial tab layout; demoEntityCol is set to the common county
      // value (col 1) — MOD county workbooks shift one right but this is handled by the
      // CASH/MOD branch selecting col 1 here and MOD workbooks having an extra blank col.
      // In practice the OI_Demographics probe for counties uses col 1 for GAAP/CASH and
      // col 2 for MOD; since enumerateCities/cityPopulation/cityCounty use
      // demoEntityCol we set it to 1 for CASH (most common) — callers using MOD county
      // workbooks directly will get null/'' from the blank col 1, which is acceptable
      // because the batch driver always prefers GAAP (with correct OI_Demographics layout)
      // and county CASH/MOD OI_Demographics is not used for the canonical record.
      // For full correctness, county MOD OI_Demographics uses entityCol=2; see the
      // batch driver which only reads OI_Demographics from the GAAP workbook for counties.
      return {
        basis: 'CASH_OR_MOD',
        sheetName: 'SORDACIFB_TotalGov',
        headerRow: 6, dataStart: 7,
        entityCol: 1, countyCol: 2,
        revSourceCols: [3,4,5,6,7,8,9,10,11,12,13,14,15],
        revTotalCol: 16,
        expFuncCols:  [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
        expTotalCol: 32,
        // OI_Demographics for county CASH: headerRow 4, dataStart 5, entity col 1
        demoHeaderRow: 4, demoDataStart: 5,
        demoEntityCol: 1, demoCountyCol: 2, demoPopCol: 3,
      };
    }
    // City CASH/MOD: row 6 = headers, data row 7, entity col 2, county col 4
    // Receipts cols 5-17, Total col 18; Disbursements cols 19-36, Total col 37; cols 38+ excluded
    return {
      basis: 'CASH_OR_MOD',
      sheetName: 'SORDACIFB_TotalGov',
      headerRow: 6, dataStart: 7,
      entityCol: 2, countyCol: 4,
      revSourceCols: [5,6,7,8,9,10,11,12,13,14,15,16,17],
      revTotalCol: 18,
      expFuncCols:  [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36],
      expTotalCol: 37,
      // OI_Demographics: row 3 = headers, data row 4, entity col 2
      demoHeaderRow: 3, demoDataStart: 4,
      demoEntityCol: 2, demoCountyCol: 3, demoPopCol: 4,
    };
  }
  throw new Error('Unrecognised workbook: neither SOREACIFB_TotalGov nor SORDACIFB_TotalGov sheet found');
}

// ── Legacy GAAP column constants (kept for backward-compat with tests) ────────
// HEADER ROW is row 7; data starts row 8.
const REVENUE_SOURCE_COLS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const REVENUE_TOTAL_COL = 16;
const EXPENDITURE_FUNC_COLS = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34];
const EXPENDITURE_TOTAL_COL = 35;
const SOREACIFB_HEADER_ROW = 7;
const SOREACIFB_DATA_START  = 8;
const OI_DEMO_HEADER_ROW    = 4;
const OI_DEMO_DATA_START    = 5;

// ── Cell helpers (reused verbatim from loadVAComparativeReport.js) ──────────
/** Raw numeric value of a cell; handles exceljs formula objects ({result}). NaN if non-numeric. */
export function cellNum(cell) {
  if (cell == null) return NaN;
  const v = cell.value;
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    return NaN; // formula w/o cached numeric result, richText, etc. — never a raw-$ value
  }
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Plain text of a cell (richText-aware), whitespace-collapsed. */
export function cellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').replace(/\s+/g, ' ').trim();
    if (v.text != null) return String(v.text).replace(/\s+/g, ' ').trim();
    if (v.result != null) return String(v.result).replace(/\s+/g, ' ').trim();
    return '';
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

// ── Column-header helpers ────────────────────────────────────────────────────
/**
 * Read column headers from the financial sheet's header row.
 * Returns a Map from col-index (1-based) to label string.
 * Accepts a layout descriptor (from detectLayout) or defaults to GAAP row 7.
 */
function readSheetHeaders(ws, headerRow) {
  const hdr = ws.getRow(headerRow);
  const map = new Map();
  for (let c = 1; c <= ws.columnCount; c++) {
    const label = cellText(hdr.getCell(c));
    if (label) map.set(c, label);
  }
  return map;
}

/** @deprecated Use readSheetHeaders(ws, layout.headerRow) */
function readSoreacifbHeaders(ws) {
  return readSheetHeaders(ws, SOREACIFB_HEADER_ROW);
}

// ── City-row lookup ──────────────────────────────────────────────────────────
/**
 * Find the data row in a sheet for the given city.
 * Entity names in the XLSX are "City of <Name>"; we match by bare city name.
 * entityCol is 1-based (defaults to 1 for GAAP, 2 for CASH/MOD).
 * Throws if not found.
 */
function findCityRow(ws, dataStart, cityName, entityCol = 1) {
  const want = cityName.trim().toLowerCase();
  for (let r = dataStart; r <= ws.rowCount; r++) {
    const nameCell = cellText(ws.getRow(r).getCell(entityCol));
    // Strip "City of " prefix for comparison
    const bare = nameCell.replace(/^city\s+of\s+/i, '').trim().toLowerCase();
    if (bare === want || nameCell.toLowerCase() === want) return ws.getRow(r);
  }
  throw new Error(`City "${cityName}" not found in sheet ${ws.name} (col ${entityCol})`);
}

// ── Revenue tree ─────────────────────────────────────────────────────────────
/**
 * Build the flat revenue tree for a city.
 * Works on both GAAP (SOREACIFB_TotalGov) and CASH/MOD (SORDACIFB_TotalGov) workbooks.
 * Returns { tree, total } where tree is [{n, a}] with no children (D-04).
 * Includes Intergovernmental (D-01). Drops zero/blank sources.
 */
export function buildRevenueTree(workbook, cityName, entityType = 'city') {
  const layout = detectLayout(workbook, entityType);
  const ws = workbook.getWorksheet(layout.sheetName);
  const headers = readSheetHeaders(ws, layout.headerRow);
  const dataRow = findCityRow(ws, layout.dataStart, cityName, layout.entityCol);

  const tree = [];
  for (const col of layout.revSourceCols) {
    const label = headers.get(col);
    if (!label) continue;
    const a = cellNum(dataRow.getCell(col));
    if (!Number.isFinite(a) || a === 0) continue;
    tree.push({ n: label, a });
  }
  tree.sort((x, y) => y.a - x.a);

  // Total from the Total column
  let total = cellNum(dataRow.getCell(layout.revTotalCol));
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Expenditure tree ──────────────────────────────────────────────────────────
/**
 * Build the flat expenditure tree for a city.
 * Works on both GAAP (SOREACIFB_TotalGov) and CASH/MOD (SORDACIFB_TotalGov) workbooks.
 * Returns { tree, total } where tree is [{n, a}] with no children (D-04).
 * Includes Capital Outlay, debt-service functions (D-02).
 * Excludes Other Financing Sources/Uses and fund-balance lines (D-04b).
 */
export function buildExpenditureTree(workbook, cityName, entityType = 'city') {
  const layout = detectLayout(workbook, entityType);
  const ws = workbook.getWorksheet(layout.sheetName);
  const headers = readSheetHeaders(ws, layout.headerRow);
  const dataRow = findCityRow(ws, layout.dataStart, cityName, layout.entityCol);

  const tree = [];
  for (const col of layout.expFuncCols) {
    const label = headers.get(col);
    if (!label) continue;
    const a = cellNum(dataRow.getCell(col));
    if (!Number.isFinite(a) || a === 0) continue;
    tree.push({ n: label, a });
  }
  tree.sort((x, y) => y.a - x.a);

  // Total from the Total column
  let total = cellNum(dataRow.getCell(layout.expTotalCol));
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Population + County ───────────────────────────────────────────────────────
/**
 * Ohio's largest county is Franklin (~1.36M) and its largest city is Columbus
 * (~915k). A "population" above this cannot be one, and in practice means a money
 * column was read instead.
 */
export const MAX_PLAUSIBLE_POPULATION = 1_500_000;

/**
 * Population for a city from the OI_Demographics tab.
 * Handles both GAAP and CASH/MOD layout offsets.
 * Returns null (not throw) if absent.
 *
 * IMPLAUSIBLE VALUES ARE REJECTED, not written. 18 of the 88 Ohio county rows had
 * been loaded with a money figure in `population` — Ottawa County 106,432,166,
 * Madison County 100,151,375 — because the OI_Demographics column offsets used
 * here do not line up on the county workbooks (auto-memory
 * project_ohio_aos_county_vs_city_layout: county workbooks use a different header
 * row/cols/vocab than cities). Nothing surfaced it, so the bad figures sat in
 * production driving per-capita numbers until they were noticed by eye during
 * v2.20. Returning null keeps the caller's "no population" path — a missing
 * population is recoverable, a wrong one silently misinforms.
 *
 * Repaired by scripts/fixOhioCountyPopulations.mjs (Census Vintage 2024). The
 * underlying county column offsets are still unverified — see the follow-up note
 * in .planning/followups/.
 */
export function cityPopulation(workbook, cityName, entityType = 'city') {
  const layout = detectLayout(workbook, entityType);
  const ws = workbook.getWorksheet('OI_Demographics');
  if (!ws) return null;
  let row;
  try { row = findCityRow(ws, layout.demoDataStart, cityName, layout.demoEntityCol); } catch { return null; }
  const v = cellNum(row.getCell(layout.demoPopCol));
  if (!Number.isFinite(v)) return null;
  if (v < 0 || v > MAX_PLAUSIBLE_POPULATION) {
    console.warn(`  WARNING: implausible population ${v.toLocaleString()} for ${entityType} ` +
      `"${cityName}" (OI_Demographics col ${layout.demoPopCol}) — refusing it. The column ` +
      `offsets are likely wrong for this workbook layout; population left unset.`);
    return null;
  }
  return v;
}

/**
 * County for a city from the OI_Demographics tab.
 * Handles both GAAP and CASH/MOD layout offsets.
 * Returns '' if absent.
 */
export function cityCounty(workbook, cityName, entityType = 'city') {
  const layout = detectLayout(workbook, entityType);
  const ws = workbook.getWorksheet('OI_Demographics');
  if (!ws) return '';
  let row;
  try { row = findCityRow(ws, layout.demoDataStart, cityName, layout.demoEntityCol); } catch { return ''; }
  return cellText(row.getCell(layout.demoCountyCol)) || '';
}

// ── City enumeration (Phase 85) ──────────────────────────────────────────────
/**
 * Enumerate all city names present in the financial tab of a workbook.
 * Works for BOTH GAAP (SOREACIFB_TotalGov) and CASH/MOD (SORDACIFB_TotalGov) layouts —
 * uses detectLayout() to get entityCol/dataStart/revTotalCol/expTotalCol; does NOT hardcode
 * the tab name or offsets.
 *
 * A row is included only when:
 *   1. entityCol has a non-empty cellText (the city name)
 *   2. The row has a finite total in revTotalCol OR expTotalCol (skips blank rows + footers)
 *
 * Returns an array of bare city names (strip "City of " prefix) in sheet order.
 * Mirrors VA enumerateRoster, minus sectioning.
 */
export function enumerateCities(workbook, entityType = 'city') {
  const layout = detectLayout(workbook, entityType);
  const ws = workbook.getWorksheet(layout.sheetName);
  if (!ws) throw new Error(`Sheet ${layout.sheetName} not found`);
  const names = [];
  for (let r = layout.dataStart; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw = cellText(row.getCell(layout.entityCol));
    if (!raw) continue;
    // Require at least one finite total (revenue or expenditure) to skip footer/blank rows
    const revTotal = cellNum(row.getCell(layout.revTotalCol));
    const expTotal = cellNum(row.getCell(layout.expTotalCol));
    if (!Number.isFinite(revTotal) && !Number.isFinite(expTotal)) continue;
    // Bare name: strip "City of " prefix
    const bare = raw.replace(/^city\s+of\s+/i, '').trim();
    if (bare) names.push(bare);
  }
  return names;
}

// ── Manifest lookup (D-05) ────────────────────────────────────────────────────
// Per-entityType cache: { city: <manifest|null>, county: <manifest|null> }
// Separate caches prevent cross-contamination when loading both entity types in the same process.
const _manifestCache = {};

/**
 * Load the manifest JSON for the given entityType.
 * - 'city'   → scripts/ohioAosDatasets.json
 * - 'county' → scripts/ohioAosCountyDatasets.json
 * Caches per entityType so repeated calls are free.
 */
function _loadManifest(entityType = 'city') {
  if (entityType in _manifestCache) return _manifestCache[entityType];
  const filename = entityType === 'county' ? 'ohioAosCountyDatasets.json' : 'ohioAosDatasets.json';
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    _manifestCache[entityType] = JSON.parse(readFileSync(join(dir, filename), 'utf8'));
  } catch {
    _manifestCache[entityType] = null;
  }
  return _manifestCache[entityType];
}

/**
 * Resolve the source_url for a given (fiscalYear, basis, entityType) from the appropriate manifest.
 * - entityType='city'   → scripts/ohioAosDatasets.json   (default; keeps every Phase 85 call unchanged)
 * - entityType='county' → scripts/ohioAosCountyDatasets.json
 * Returns the URL string, or null if no matching entry exists.
 * Satisfies CONTEXT D-05: per-FY+basis direct file URL as source_url.
 *
 * Phase 85 bulk loader uses this to stamp source_url on every row without hand-entering URLs:
 *   const url = resolveSourceUrl(fiscalYear, basis);
 * Phase 86 county loader uses:
 *   const url = resolveSourceUrl(fiscalYear, basis, 'county');
 */
export function resolveSourceUrl(fiscalYear, basis, entityType = 'city') {
  const m = _loadManifest(entityType);
  if (!m) return null;
  const entry = m.datasets.find(
    (d) => d.fiscal_year === Number(fiscalYear) && d.basis.toUpperCase() === String(basis).toUpperCase()
  );
  return entry ? entry.url : null;
}

// ── Supabase write path (mirrors loadVAComparativeReport.js) ─────────────────
let _supabase = null;
export async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env). Use --dry-run for a no-write parse.');
    process.exit(1);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * Read-only never-overwrite guard: returns the conflicting row if a DIFFERENT source owns it.
 * treasury_sync_city_budget is NOT source-safe (auto-memory project_sync_city_budget_not_source_safe).
 */
export async function findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType) {
  const { data, error } = await supabase
    .schema('treasury').from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId).eq('fiscal_year', fiscalYear).eq('dataset_type', datasetType)
    .limit(1);
  if (error) throw new Error(`Budget lookup failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  return existing.data_source && existing.data_source !== DATA_SOURCE_NAME ? existing : null;
}

export async function importDataset(supabase, municipalityId, fiscalYear, datasetType, tree, total, sourceUrl, sourceDate) {
  const conflict = await findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType);
  if (conflict) {
    console.log(`  SKIP ${datasetType} FY${fiscalYear} — existing ${conflict.data_source} data preserved (never-overwrite)`);
    return null;
  }
  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year: fiscalYear,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: tree,
    p_row_count: tree.length,
    p_data_source_name: DATA_SOURCE_NAME,
    p_source_url: sourceUrl,
    p_source_date: sourceDate,
  });
  if (error) { console.error(`  RPC error (${datasetType}): ${error.message}`); return null; }
  return data;
}

/**
 * Build + write one city's operating (expenditure) + revenue datasets.
 * Mirrors importLocality from loadVAComparativeReport.js.
 *
 * opts: { cityName, municipalityName?, fiscalYear, basis, sourceUrl, sourceDate, dryRun }
 *
 * municipalityName (optional): canonical DB name when it differs from the workbook lookup name.
 * Used for county loads where CASH/MOD workbooks use bare names (e.g. "Adams") but the
 * canonical municipality name is "Adams County". cityName is used for workbook row lookups;
 * municipalityName (if provided) is used for treasury_ensure_municipality p_name.
 */
export async function importCity(supabase, workbook, opts) {
  const {
    cityName,
    // municipalityName overrides the DB name when workbook uses a bare/different name.
    // Phase 86 county loads: CASH/MOD workbooks omit " County" suffix; pass
    // municipalityName:"Adams County" while cityName:"Adams" is used for workbook lookups.
    municipalityName = null,
    fiscalYear,
    basis = 'GAAP',
    sourceUrl = null,
    sourceDate = new Date().toISOString().slice(0, 10),
    dryRun = false,
    // entityType defaults to 'city' to preserve all Phase 85 call behavior unchanged.
    // Pass entityType:'county' for county loads (auto-memory project_utah_loader_entity_type_and_display_names:
    // counties MUST write entity_type='county' or a phantom city row is created).
    entityType = 'city',
  } = opts;

  const exp = buildExpenditureTree(workbook, cityName, entityType);
  const rev = buildRevenueTree(workbook, cityName, entityType);
  const population = cityPopulation(workbook, cityName, entityType);
  const county = cityCounty(workbook, cityName, entityType);

  // Canonical name used for DB writes. Falls back to cityName if not overridden.
  const dbName = municipalityName || cityName;

  const summary = {
    cityName: dbName, fiscalYear, basis,
    operatingTotal: exp.total, revenueTotal: rev.total,
    population, county,
    expFunctions: exp.tree.length, revSources: rev.tree.length,
  };

  if (dryRun) return summary;

  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: dbName,
    p_state: 'OH',
    p_entity_type: entityType,
    p_population: population || 0,
  });
  if (munErr) throw new Error(`Municipality error (${dbName}): ${munErr.message}`);

  summary.municipalityId = municipalityId;
  summary.operating = await importDataset(supabase, municipalityId, fiscalYear, 'operating', exp.tree, exp.total, sourceUrl, sourceDate);
  summary.revenue   = await importDataset(supabase, municipalityId, fiscalYear, 'revenue',   rev.tree, rev.total,  sourceUrl, sourceDate);
  return summary;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      file:         { type: 'string' },
      city:         { type: 'string' },
      state:        { type: 'string' },
      fy:           { type: 'string' },
      basis:        { type: 'string' },
      'source-url': { type: 'string' },
      'source-date':{ type: 'string' },
      'dry-run':    { type: 'boolean' },
    },
  });

  if (!values.file || !values.city || !values.fy) {
    console.error('Required: --file <xlsx> --city <name> --fy <YYYY> [--basis GAAP|CASH|MOD] [--dry-run]');
    process.exit(1);
  }

  const fiscalYear = parseInt(values.fy, 10);
  const basis      = (values.basis || 'GAAP').toUpperCase();
  // Auto-resolve source_url from the manifest (D-05); --source-url overrides if provided
  const sourceUrl  = values['source-url'] || resolveSourceUrl(fiscalYear, basis) || null;
  const sourceDate = values['source-date'] || new Date().toISOString().slice(0, 10);
  const dryRun     = values['dry-run'] || false;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(values.file);

  const exp = buildExpenditureTree(wb, values.city);
  const rev = buildRevenueTree(wb, values.city);
  const pop = cityPopulation(wb, values.city);
  const county = cityCounty(wb, values.city);

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

  console.log(`\nOhio AOS Summarized Annual Financial Reports — ${values.city} (OH) FY${fiscalYear}${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  Source: ${DATA_SOURCE_NAME}`);
  console.log(`  Basis: ${basis}`);
  console.log(`  Source URL: ${sourceUrl || '(none)'}`);
  console.log(`  Source date: ${sourceDate}`);
  console.log(`  County: ${county || '(none)'}`);
  console.log(`  Population (OI_Demographics): ${pop == null ? '(none)' : pop.toLocaleString('en-US')}`);
  console.log(`\n  Operating (expenditure) total: ${fmt(exp.total)}  — ${exp.tree.length} functions`);
  for (const n of exp.tree) console.log(`     ${n.n}: ${fmt(n.a)}`);
  console.log(`\n  Revenue total: ${fmt(rev.total)}  — ${rev.tree.length} sources`);
  for (const n of rev.tree) console.log(`     ${n.n}: ${fmt(n.a)}`);

  if (dryRun) { console.log('\nDry-run — no writes.'); return; }

  const supabase = await getSupabase();
  const result = await importCity(supabase, wb, {
    cityName: values.city, fiscalYear, basis, sourceUrl, sourceDate, dryRun: false,
  });
  console.log(`\nImported ${values.city} FY${fiscalYear} (basis: ${basis}):`,
    `operating=${result.operating != null ? 'WRITTEN' : 'SKIPPED'},`,
    `revenue=${result.revenue != null ? 'WRITTEN' : 'SKIPPED'}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
