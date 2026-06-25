#!/usr/bin/env node
/**
 * Ohio Auditor of State Summarized Annual Financial Reports Loader (v2.8 Phase 84 — OHSRC-01)
 *
 * Parses the Ohio AOS "Summarized Annual Financial Reports" (Hinkle System) all-cities XLSX
 * into the tracker's budget tree for a single city and writes it to Supabase via the
 * existing budget RPCs.
 *
 * Mirrors scripts/loadVAComparativeReport.js (the closest analog): reuses the formula-safe
 * cellNum/cellText helpers, the getSupabase/findConflictingBudget/importDataset write path,
 * and the never-overwrite guard (treasury_sync_city_budget is NOT source-safe — see
 * auto-memory project_sync_city_budget_not_source_safe). Swaps VA's multi-exhibit layout
 * for Ohio's single flat wide table (SOREACIFB_TotalGov): one row per city, columns = categories.
 *
 * Trees (CONTEXT D-01/D-02/D-04/D-04b):
 *   - Revenue ('revenue'): flat 1-level tree of the 12 SOREACIFB revenue source columns
 *       INCLUDING Intergovernmental (D-01); total = "Total" (col 16).
 *   - Expenditure ('operating'): flat 1-level tree of the ~18 expenditure function columns
 *       INCLUDING Capital Outlay, Principal Retirement, Interest & Fiscal Charges,
 *       Bond Issuance Costs (D-02); total = "Total" (col 35).
 *   Both trees are FLAT (D-04): leaf nodes only, no sub-levels.
 *   EXCLUDED (D-04b): Other Financing Sources/Uses and fund-balance lines (cols 36+).
 *
 * SOREACIFB_TotalGov sheet layout (FY2024 GAAP, recon'd):
 *   Row 7 = column headers; data starts row 8.
 *   Col 1: Entity Name ("City of Columbus"), Col 2: County
 *   Cols 3-15: Revenue sources; Col 16: Total Revenues
 *   Cols 17-34: Expenditure functions; Col 35: Total Expenditures
 *   Cols 36+: Other Financing / Fund Balances — EXCLUDED
 *
 * OI_Demographics sheet layout:
 *   Row 4 = column headers; data starts row 5.
 *   Col 1: Entity Name, Col 2: County, Col 3: Population
 *
 * Source stamping (D-05): data_source='Ohio Auditor of State Summarized Annual Financial
 * Reports'; source_url = per-FY+basis direct file URL (--source-url); source_date = fetch date.
 *
 * Usage:
 *   node scripts/loadOhioAOS.js --file <xlsx> --city Columbus --fy 2024 --basis GAAP --dry-run
 *   node scripts/loadOhioAOS.js --file <xlsx> --city Columbus --fy 2024 --basis GAAP --source-url <url>
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

export const DATA_SOURCE_NAME = 'Ohio Auditor of State Summarized Annual Financial Reports';

// ── Revenue column range (inclusive, 1-indexed) ─────────────────────────────
// Cols 3-15 are revenue sources; Col 16 is Total Revenues.
// HEADER ROW is row 7; data starts row 8.
const REVENUE_SOURCE_COLS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const REVENUE_TOTAL_COL = 16;

// ── Expenditure column range (inclusive, 1-indexed) ──────────────────────────
// Cols 17-34 are expenditure functions; Col 35 is Total Expenditures.
// Cols 36+ are Other Financing Sources/Uses and fund-balance lines — EXCLUDED (D-04b).
const EXPENDITURE_FUNC_COLS = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34];
const EXPENDITURE_TOTAL_COL = 35;

// ── Sheet layout constants ───────────────────────────────────────────────────
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
 * Read column headers from the SOREACIFB_TotalGov header row (row 7).
 * Returns a Map from col-index (1-based) to label string.
 */
function readSoreacifbHeaders(ws) {
  const hdr = ws.getRow(SOREACIFB_HEADER_ROW);
  const map = new Map();
  for (let c = 1; c <= ws.columnCount; c++) {
    const label = cellText(hdr.getCell(c));
    if (label) map.set(c, label);
  }
  return map;
}

// ── City-row lookup ──────────────────────────────────────────────────────────
/**
 * Find the data row in a sheet for the given city.
 * Entity names in the XLSX are "City of <Name>"; we match by bare city name.
 * Throws if not found.
 */
function findCityRow(ws, dataStart, cityName) {
  const want = cityName.trim().toLowerCase();
  for (let r = dataStart; r <= ws.rowCount; r++) {
    const nameCell = cellText(ws.getRow(r).getCell(1));
    // Strip "City of " prefix for comparison
    const bare = nameCell.replace(/^city\s+of\s+/i, '').trim().toLowerCase();
    if (bare === want || nameCell.toLowerCase() === want) return ws.getRow(r);
  }
  throw new Error(`City "${cityName}" not found in sheet ${ws.name}`);
}

// ── Revenue tree ─────────────────────────────────────────────────────────────
/**
 * Build the flat revenue tree for a city from SOREACIFB_TotalGov.
 * Returns { tree, total } where tree is [{n, a}] with no children (D-04).
 * Includes Intergovernmental (D-01). Drops zero/blank sources.
 */
export function buildRevenueTree(workbook, cityName) {
  const ws = workbook.getWorksheet('SOREACIFB_TotalGov');
  if (!ws) throw new Error('SOREACIFB_TotalGov sheet missing');
  const headers = readSoreacifbHeaders(ws);
  const dataRow = findCityRow(ws, SOREACIFB_DATA_START, cityName);

  const tree = [];
  for (const col of REVENUE_SOURCE_COLS) {
    const label = headers.get(col);
    if (!label) continue;
    const a = cellNum(dataRow.getCell(col));
    if (!Number.isFinite(a) || a === 0) continue;
    tree.push({ n: label, a });
  }
  tree.sort((x, y) => y.a - x.a);

  // Total from the Total Revenues column
  let total = cellNum(dataRow.getCell(REVENUE_TOTAL_COL));
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Expenditure tree ──────────────────────────────────────────────────────────
/**
 * Build the flat expenditure tree for a city from SOREACIFB_TotalGov.
 * Returns { tree, total } where tree is [{n, a}] with no children (D-04).
 * Includes Capital Outlay, debt-service functions (D-02).
 * Excludes Other Financing Sources/Uses and fund-balance lines (D-04b).
 */
export function buildExpenditureTree(workbook, cityName) {
  const ws = workbook.getWorksheet('SOREACIFB_TotalGov');
  if (!ws) throw new Error('SOREACIFB_TotalGov sheet missing');
  const headers = readSoreacifbHeaders(ws);
  const dataRow = findCityRow(ws, SOREACIFB_DATA_START, cityName);

  const tree = [];
  for (const col of EXPENDITURE_FUNC_COLS) {
    const label = headers.get(col);
    if (!label) continue;
    const a = cellNum(dataRow.getCell(col));
    if (!Number.isFinite(a) || a === 0) continue;
    tree.push({ n: label, a });
  }
  tree.sort((x, y) => y.a - x.a);

  // Total from the Total Expenditures column
  let total = cellNum(dataRow.getCell(EXPENDITURE_TOTAL_COL));
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Population + County ───────────────────────────────────────────────────────
/**
 * Population for a city from the OI_Demographics tab.
 * Returns null (not throw) if absent.
 */
export function cityPopulation(workbook, cityName) {
  const ws = workbook.getWorksheet('OI_Demographics');
  if (!ws) return null;
  let row;
  try { row = findCityRow(ws, OI_DEMO_DATA_START, cityName); } catch { return null; }
  const v = cellNum(row.getCell(3)); // Col 3 = Population
  return Number.isFinite(v) ? v : null;
}

/**
 * County for a city from the OI_Demographics tab.
 * Returns '' if absent.
 */
export function cityCounty(workbook, cityName) {
  const ws = workbook.getWorksheet('OI_Demographics');
  if (!ws) return '';
  let row;
  try { row = findCityRow(ws, OI_DEMO_DATA_START, cityName); } catch { return ''; }
  return cellText(row.getCell(2)) || ''; // Col 2 = County
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
 * opts: { cityName, fiscalYear, basis, sourceUrl, sourceDate, dryRun }
 */
export async function importCity(supabase, workbook, opts) {
  const {
    cityName,
    fiscalYear,
    basis = 'GAAP',
    sourceUrl = null,
    sourceDate = new Date().toISOString().slice(0, 10),
    dryRun = false,
  } = opts;

  const exp = buildExpenditureTree(workbook, cityName);
  const rev = buildRevenueTree(workbook, cityName);
  const population = cityPopulation(workbook, cityName);
  const county = cityCounty(workbook, cityName);

  const summary = {
    cityName, fiscalYear, basis,
    operatingTotal: exp.total, revenueTotal: rev.total,
    population, county,
    expFunctions: exp.tree.length, revSources: rev.tree.length,
  };

  if (dryRun) return summary;

  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: cityName,
    p_state: 'OH',
    p_entity_type: 'city',
    p_population: population || 0,
  });
  if (munErr) throw new Error(`Municipality error (${cityName}): ${munErr.message}`);

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
  const sourceUrl  = values['source-url'] || null;
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
