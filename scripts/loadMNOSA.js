/**
 * Minnesota Office of the State Auditor "City/County Finances Report" Loader (v2.9 Phase 89 — MNSRC-01/02)
 *
 * Parses the MN OSA City/County Finances Report `Governmental Funds` sheet (one row per entity,
 * ~148 columns) into the tracker's budget tree for a single entity (city or county) and writes it
 * to Supabase via the existing budget RPCs.
 *
 * Mirrors scripts/loadOhioAOS.js (the closest analog) for the write path verbatim: getSupabase,
 * findConflictingBudget (never-overwrite guard — treasury_sync_city_budget is NOT source-safe, see
 * auto-memory project_sync_city_budget_not_source_safe), importDataset, resolveSourceUrl-from-manifest,
 * the formula-safe cellNum/cellText readers, --entity-type county handling, parseArgs CLI + --dry-run.
 *
 * THE DECISIVE DIFFERENCE vs Ohio: MN's source supports real drill-down, so the trees are
 * 3-LEVEL-WHERE-NATURAL (D-01/D-02), driven by scripts/mnOsaTreeMap.json (built in Phase 89-01),
 * NOT flat 1-level. OTHER differences: MN is a SINGLE workbook with the accounting basis in a
 * per-row `GAAPInd` column (not separate GAAP/CASH workbooks like Ohio), and the parent county
 * comes from the `ParentEntityName` column (not a separate demographics tab).
 *
 * County-layout divergence (D-08, pinned in 89-01): county files have NO GAAPInd and NO
 * ParentEntityName columns, shifted column positions, extra/junk columns, and label typos vs the
 * city file. This loader matches every column by NORMALIZED label (lowercase, strip non-alphanumeric)
 * + a tiny alias table, and returns null/'' when an identity label is absent — so the SAME code path
 * loads both city and county files. See scripts/mnOsaDatasets.json notes + 89-01-SUMMARY.md.
 *
 * Trees (CONTEXT D-01..D-05):
 *   - Revenue ('revenue'): 3-level-where-natural revenue-by-source. Groups from mnOsaTreeMap.revenue.groups;
 *       subtotal_label columns are the parent/group totals (D-03) with itemized leaves beneath; Intergovernmental
 *       included (D-04). total = the `Total Revenues` column (D-05, EXCLUDES `Total Revenues & Other Sources`).
 *   - Expenditure ('operating'): 3-level-where-natural expenditure-by-function. function -> sub-function ->
 *       {Current, Capital} deepest leaves where both exist (D-02). total = the `Total Expenditures` column
 *       (D-05, EXCLUDES `& Other Uses`). Cross-function rollups (Total Current Expenditures / Total Capital
 *       Outlay / Total Public Safety Capital Outlay) are validation-only, never placed as nodes (D-03).
 *   Double-count guard (D-03): for each group with a subtotal_label, the recomputed child sum is validated
 *       against the workbook subtotal; the subtotal column is the authoritative parent `a`.
 *
 * Source stamping (D-05 / Discretion): data_source='Minnesota Office of the State Auditor City/County
 * Finances Report'; source_url = per-FY city_url/county_url from scripts/mnOsaDatasets.json; source_date = fetch date.
 *
 * Usage:
 *   node scripts/loadMNOSA.js --file <xlsx> --entity Minneapolis --fy 2023 --dry-run
 *   node scripts/loadMNOSA.js --file <xlsx> --entity Aitkin --fy 2021 --entity-type county --dry-run
 *   node scripts/loadMNOSA.js --file <xlsx> --entity Minneapolis --fy 2023            # live write
 */

import { parseArgs } from 'node:util';
import { monthForSource } from './lib/loaderFiscalCalendars.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';

export const DATA_SOURCE_NAME = 'Minnesota Office of the State Auditor City/County Finances Report';
const SHEET_NAME = 'Governmental Funds';
const SUBTOTAL_TOLERANCE = 0.005; // 0.5% — D-03 double-count guard

// ── Cell helpers (reused verbatim from loadOhioAOS.js / loadVAComparativeReport.js) ──
/** Raw numeric value of a cell; handles exceljs formula objects ({result}). NaN if non-numeric. */
export function cellNum(cell) {
  if (cell == null) return NaN;
  const v = cell.value;
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    return NaN; // formula w/o cached numeric result, richText, [object Object] — never a raw-$ value
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

// ── Tree-map (D-01/D-02/D-03 hierarchy spec from Phase 89-01) ────────────────
let _treeMap = null;
function treeMap() {
  if (_treeMap) return _treeMap;
  const dir = dirname(fileURLToPath(import.meta.url));
  _treeMap = JSON.parse(readFileSync(join(dir, 'mnOsaTreeMap.json'), 'utf8'));
  return _treeMap;
}

/**
 * Normalize a column label for matching: lowercase, strip all non-alphanumeric, then apply
 * label_aliases (handles genuine cross-file typos like city "Ecenomic" vs county "Economic").
 * This is what makes ONE code path load both city + county files despite spacing/case/typo
 * divergences (D-08): e.g. "Conservation of Natural" and "Conservation ofNatural" both
 * normalize to "conservationofnatural...".
 */
export function normalizeLabel(label) {
  let k = String(label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = treeMap().label_aliases || {};
  if (aliases[k]) k = aliases[k];
  return k;
}

// ── Header → column index map (label-driven; never hardcoded indices — D-08) ──
/** Map normalized-label → 1-based column index from the sheet header row. */
function headerIndex(ws, headerRow) {
  const hdr = ws.getRow(headerRow);
  const map = new Map();
  for (let c = 1; c <= ws.columnCount; c++) {
    const k = normalizeLabel(cellText(hdr.getCell(c)));
    if (k && !map.has(k)) map.set(k, c);
  }
  return map;
}

/** Resolve a label to its column index via the normalized header map, or null if absent. */
function colOf(headerMap, label) {
  const c = headerMap.get(normalizeLabel(label));
  return c == null ? null : c;
}

/** Numeric value of a labeled column in a data row, or NaN if the column is absent. */
function valOf(dataRow, headerMap, label) {
  const c = colOf(headerMap, label);
  if (c == null) return NaN;
  return cellNum(dataRow.getCell(c));
}

// ── Entity-row lookup (match by the Entity Name column) ──────────────────────
function getSheet(workbook) {
  const ws = workbook.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in workbook`);
  return ws;
}

/**
 * Find the data row for an entity by the `Entity Name` column (case/space-insensitive).
 * Throws if not found.
 */
function findEntityRow(ws, headerMap, entityName) {
  const tm = treeMap();
  const nameCol = colOf(headerMap, tm.identity_labels.entity_name);
  if (nameCol == null) throw new Error('No "Entity Name" column found');
  const want = normalizeLabel(entityName);
  const dataStart = tm.data_start_row || 2;
  for (let r = dataStart; r <= ws.rowCount; r++) {
    if (normalizeLabel(cellText(ws.getRow(r).getCell(nameCol))) === want) return ws.getRow(r);
  }
  throw new Error(`Entity "${entityName}" not found in sheet ${ws.name} (Entity Name column ${nameCol})`);
}

// ── Tree builders (3-level-where-natural, label-driven, D-01/D-02/D-03) ───────
/** Sum a list of leaf labels into [{n,a}] leaves (drops zero/blank/absent), and the running sum. */
function buildLeaves(dataRow, headerMap, labels) {
  const nodes = [];
  let sum = 0;
  for (const label of labels) {
    const a = valOf(dataRow, headerMap, label);
    if (!Number.isFinite(a) || a === 0) continue;
    nodes.push({ n: label, a });
    sum += a;
  }
  nodes.sort((x, y) => y.a - x.a);
  return { nodes, sum };
}

/** Assert a recomputed child sum ties to the workbook subtotal within tolerance (D-03 double-count guard). */
function assertSubtotal(groupName, childSum, subtotalVal) {
  if (!Number.isFinite(subtotalVal) || subtotalVal === 0) return; // no subtotal to check against
  const denom = Math.abs(subtotalVal) || 1;
  const drift = Math.abs(childSum - subtotalVal) / denom;
  if (drift > SUBTOTAL_TOLERANCE) {
    throw new Error(
      `D-03 double-count guard FAILED for "${groupName}": children sum ${Math.round(childSum)} ` +
      `vs workbook subtotal ${Math.round(subtotalVal)} (drift ${(drift * 100).toFixed(2)}% > ${SUBTOTAL_TOLERANCE * 100}%)`
    );
  }
}

/**
 * Build the 3-level-where-natural revenue tree.
 * Returns { tree, total } where tree is [{n,a,c?}] (variable depth; leaves {n,a}).
 * Includes Intergovernmental (D-04). total = `Total Revenues` column (D-05).
 */
export function buildRevenueTree(workbook, entityName, entityType = 'city') {
  const tm = treeMap();
  const ws = getSheet(workbook);
  const headerMap = headerIndex(ws, tm.header_row || 1);
  const dataRow = findEntityRow(ws, headerMap, entityName);

  const tree = [];
  for (const group of tm.revenue.groups) {
    let node;
    if (group.children) {
      // Group with sub-groups (e.g. Intergovernmental -> Federal/State/County-Local).
      const children = [];
      let groupSum = 0;
      for (const child of group.children) {
        const { nodes, sum } = buildLeaves(dataRow, headerMap, child.leaves || []);
        if (child.subtotal_label) {
          const sub = valOf(dataRow, headerMap, child.subtotal_label);
          assertSubtotal(child.n, sum, sub);
        }
        if (nodes.length === 0) continue;
        children.push({ n: child.n, a: sum, c: nodes });
        groupSum += sum;
      }
      if (children.length === 0) continue;
      if (group.subtotal_label) {
        const sub = valOf(dataRow, headerMap, group.subtotal_label);
        assertSubtotal(group.n, groupSum, sub);
      }
      children.sort((x, y) => y.a - x.a);
      node = { n: group.n, a: groupSum, c: children };
    } else {
      // Flat group: sum its leaves. Single-leaf groups collapse to a {n,a} leaf.
      const { nodes, sum } = buildLeaves(dataRow, headerMap, group.leaves || []);
      if (nodes.length === 0) continue;
      if (group.subtotal_label) {
        const sub = valOf(dataRow, headerMap, group.subtotal_label);
        assertSubtotal(group.n, sum, sub);
      }
      node = nodes.length === 1 && nodes[0].n === group.n
        ? { n: group.n, a: sum }
        : { n: group.n, a: sum, c: nodes };
    }
    tree.push(node);
  }
  tree.sort((x, y) => y.a - x.a);

  let total = valOf(dataRow, headerMap, tm.revenue.total_label);
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

/**
 * Build the 3-level-where-natural expenditure tree.
 * Returns { tree, total }. function -> {Current,Capital} deepest leaves where both exist (D-02).
 * total = `Total Expenditures` column (D-05). Cross-function rollups never placed (D-03).
 */
export function buildExpenditureTree(workbook, entityName, entityType = 'city') {
  const tm = treeMap();
  const ws = getSheet(workbook);
  const headerMap = headerIndex(ws, tm.header_row || 1);
  const dataRow = findEntityRow(ws, headerMap, entityName);

  const tree = [];
  for (const fn of tm.expenditure.functions) {
    let node;
    if (fn.current_label || fn.capital_label) {
      // function -> {Current, Capital}
      const children = [];
      let fnSum = 0;
      const cur = valOf(dataRow, headerMap, fn.current_label);
      if (Number.isFinite(cur) && cur !== 0) { children.push({ n: 'Current', a: cur }); fnSum += cur; }
      const cap = valOf(dataRow, headerMap, fn.capital_label);
      if (Number.isFinite(cap) && cap !== 0) { children.push({ n: 'Capital', a: cap }); fnSum += cap; }
      if (children.length === 0) continue;
      node = children.length === 1 ? { n: fn.n, a: fnSum } : { n: fn.n, a: fnSum, c: children };
    } else if (fn.children) {
      // function -> sub-function -> {Current, Capital}  (e.g. Public Safety, General Government)
      const children = [];
      let fnSum = 0;
      for (const sub of fn.children) {
        if (sub.leaves) {
          const { nodes, sum } = buildLeaves(dataRow, headerMap, sub.leaves);
          if (nodes.length === 0) continue;
          children.push(nodes.length === 1 ? { n: sub.n, a: sum } : { n: sub.n, a: sum, c: nodes });
          fnSum += sum;
        } else {
          const subChildren = [];
          let subSum = 0;
          const cur = valOf(dataRow, headerMap, sub.current_label);
          if (Number.isFinite(cur) && cur !== 0) { subChildren.push({ n: 'Current', a: cur }); subSum += cur; }
          const cap = valOf(dataRow, headerMap, sub.capital_label);
          if (Number.isFinite(cap) && cap !== 0) { subChildren.push({ n: 'Capital', a: cap }); subSum += cap; }
          if (subChildren.length === 0) continue;
          children.push(subChildren.length === 1 ? { n: sub.n, a: subSum } : { n: sub.n, a: subSum, c: subChildren });
          fnSum += subSum;
        }
      }
      if (children.length === 0) continue;
      children.sort((x, y) => y.a - x.a);
      node = { n: fn.n, a: fnSum, c: children };
    } else {
      // Flat function: sum its leaves.
      const { nodes, sum } = buildLeaves(dataRow, headerMap, fn.leaves || []);
      if (nodes.length === 0) continue;
      node = { n: fn.n, a: sum, c: nodes };
    }
    tree.push(node);
  }
  tree.sort((x, y) => y.a - x.a);

  let total = valOf(dataRow, headerMap, tm.expenditure.total_label);
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Identity reads (label-driven; tolerate absent columns on county files — D-08) ──
/** Per-capita population from the `Population` column. null if absent. */
export function entityPopulation(workbook, entityName, entityType = 'city') {
  const tm = treeMap();
  const ws = getSheet(workbook);
  const headerMap = headerIndex(ws, tm.header_row || 1);
  const row = findEntityRow(ws, headerMap, entityName);
  const v = valOf(row, headerMap, tm.identity_labels.population);
  return Number.isFinite(v) ? v : null;
}

/** Parent county from the `ParentEntityName` column. '' if absent (counties have no parent — D-08). */
export function entityCounty(workbook, entityName, entityType = 'city') {
  const tm = treeMap();
  const ws = getSheet(workbook);
  const headerMap = headerIndex(ws, tm.header_row || 1);
  const row = findEntityRow(ws, headerMap, entityName);
  const c = colOf(headerMap, tm.identity_labels.parent_entity_name);
  if (c == null) return '';
  return cellText(row.getCell(c)) || '';
}

/**
 * Accounting basis from the per-row `GAAPInd` column (D-07): 'GAAP' | 'Cash'.
 * Returns null when the column is absent (county files have no GAAPInd — D-08).
 */
export function entityBasis(workbook, entityName, entityType = 'city') {
  const tm = treeMap();
  const ws = getSheet(workbook);
  const headerMap = headerIndex(ws, tm.header_row || 1);
  const row = findEntityRow(ws, headerMap, entityName);
  const c = colOf(headerMap, tm.identity_labels.gaap_ind);
  if (c == null) return null;
  const raw = cellText(row.getCell(c));
  if (!raw) return null;
  if (/cash/i.test(raw)) return 'Cash';
  if (/gaap/i.test(raw)) return 'GAAP';
  // Numeric GAAPInd encoding (FY2016/2020/2021/2022): Excel boolean TRUE(-1 or 1)=GAAP, FALSE(0)=Cash.
  if (raw === '-1' || raw === '1') return 'GAAP';
  if (raw === '0') return 'Cash';
  return null; // unrecognized / blank → unknown (no GAAPInd column years also return null above)
}

// ── Roster enumeration (Phase 90 — bulk load) ────────────────────────────────
/**
 * Enumerate every entity name present in the `Governmental Funds` sheet (roster helper).
 * Includes a row only when the `Entity Name` is non-empty AND the row has a finite, non-zero
 * `Total Revenues` OR `Total Expenditures` (skips blank rows and any footer/total rows).
 * Label-driven (via the tree-map), so it works for BOTH the city and county layouts.
 * Returns an array of names in sheet order (deduped by normalized key). Mirrors Ohio's
 * enumerateCities, minus the layout/precedence machinery (MN has one sheet, header row 1).
 */
export function enumerateEntities(workbook, entityType = 'city') {
  const tm = treeMap();
  const ws = getSheet(workbook);
  const headerMap = headerIndex(ws, tm.header_row || 1);
  const nameCol = colOf(headerMap, tm.identity_labels.entity_name);
  if (nameCol == null) throw new Error('No "Entity Name" column found');
  const dataStart = tm.data_start_row || 2;
  const names = [];
  const seen = new Set();
  for (let r = dataStart; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = cellText(row.getCell(nameCol));
    if (!name) continue;
    const rev = valOf(row, headerMap, tm.revenue.total_label);
    const exp = valOf(row, headerMap, tm.expenditure.total_label);
    const hasFinancials = (Number.isFinite(rev) && rev !== 0) || (Number.isFinite(exp) && exp !== 0);
    if (!hasFinancials) continue;
    const key = normalizeLabel(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

// ── Manifest lookup (D-05) ───────────────────────────────────────────────────
let _manifest = null;
function loadManifest() {
  if (_manifest !== null) return _manifest;
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    _manifest = JSON.parse(readFileSync(join(dir, 'mnOsaDatasets.json'), 'utf8'));
  } catch {
    _manifest = null;
  }
  return _manifest;
}

/**
 * Resolve the source_url for a (fiscalYear, entityType) from scripts/mnOsaDatasets.json.
 * entityType 'city' -> city_url; 'county' -> county_url. Returns null if no matching entry.
 */
export function resolveSourceUrl(fiscalYear, entityType = 'city') {
  const m = loadManifest();
  if (!m) return null;
  const entry = m.datasets.find((d) => d.fiscal_year === Number(fiscalYear));
  if (!entry) return null;
  return entityType === 'county' ? (entry.county_url || null) : (entry.city_url || null);
}

// ── Supabase write path (mirrors loadOhioAOS.js verbatim) ────────────────────
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
    // Minn. Stat. § 471.696 puts every MN city and town on the calendar year, and
    // the OSA's own county report is "For the Year Ended December 31". Month 1.
    p_fiscal_year_start_month: monthForSource(DATA_SOURCE_NAME),
  });
  if (error) { console.error(`  RPC error (${datasetType}): ${error.message}`); return null; }
  return data;
}

/**
 * Build + write one entity's operating (expenditure) + revenue datasets.
 * opts: { entityName, municipalityName?, fiscalYear, sourceUrl, sourceDate, dryRun, entityType }
 * entityType 'county' writes entity_type='county' (auto-memory project_utah_loader_entity_type_and_display_names:
 * else a phantom city row is created).
 * municipalityName (optional): canonical DB name when it differs from the workbook lookup name.
 * Used for county loads where the workbook Entity Name is bare ("Aitkin") but the canonical
 * municipality name is "Aitkin County" (MN has same-named cities + counties — Phase 91 D-02).
 * entityName is the workbook row-lookup key; municipalityName (if set) is the treasury_ensure_municipality p_name.
 */
export async function importEntity(supabase, workbook, opts) {
  const {
    entityName,
    municipalityName = null,
    fiscalYear,
    sourceUrl = null,
    sourceDate = new Date().toISOString().slice(0, 10),
    dryRun = false,
    entityType = 'city',
  } = opts;

  const exp = buildExpenditureTree(workbook, entityName, entityType);
  const rev = buildRevenueTree(workbook, entityName, entityType);
  const population = entityPopulation(workbook, entityName, entityType);
  const county = entityCounty(workbook, entityName, entityType);
  const basis = entityBasis(workbook, entityName, entityType);

  // Canonical DB name (falls back to the workbook lookup name when not overridden).
  const dbName = municipalityName || entityName;

  const summary = {
    entityName: dbName, fiscalYear, basis, entityType,
    operatingTotal: exp.total, revenueTotal: rev.total,
    population, county,
    expFunctions: exp.tree.length, revGroups: rev.tree.length,
  };

  if (dryRun) return summary;

  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: dbName,
    p_state: 'MN',
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
const fmt = (n) => (Number.isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : '(n/a)');

function printTree(nodes, depth = 0) {
  for (const n of nodes) {
    console.log('     ' + '  '.repeat(depth) + `${n.n}: ${fmt(n.a)}`);
    if (n.c) printTree(n.c, depth + 1);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      file:          { type: 'string' },
      entity:        { type: 'string' },
      city:          { type: 'string' }, // alias for --entity
      fy:            { type: 'string' },
      'entity-type': { type: 'string' },
      'source-url':  { type: 'string' },
      'source-date': { type: 'string' },
      'dry-run':     { type: 'boolean' },
    },
  });

  const entity = values.entity || values.city;
  if (!values.file || !entity || !values.fy) {
    console.error('Required: --file <xlsx> --entity <name> --fy <YYYY> [--entity-type city|county] [--dry-run]');
    process.exit(1);
  }

  const fiscalYear = parseInt(values.fy, 10);
  const entityType = (values['entity-type'] || 'city').toLowerCase();
  const sourceUrl  = values['source-url'] || resolveSourceUrl(fiscalYear, entityType) || null;
  const sourceDate = values['source-date'] || new Date().toISOString().slice(0, 10);
  const dryRun     = values['dry-run'] || false;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(values.file);

  const exp = buildExpenditureTree(wb, entity, entityType);
  const rev = buildRevenueTree(wb, entity, entityType);
  const pop = entityPopulation(wb, entity, entityType);
  const county = entityCounty(wb, entity, entityType);
  const basis = entityBasis(wb, entity, entityType);

  console.log(`\nMN OSA City/County Finances Report — ${entity} (MN, ${entityType}) FY${fiscalYear}${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  Source: ${DATA_SOURCE_NAME}`);
  console.log(`  Basis (GAAPInd): ${basis == null ? '(none — no GAAPInd column)' : basis}`);
  console.log(`  Source URL: ${sourceUrl || '(none)'}`);
  console.log(`  Source date: ${sourceDate}`);
  console.log(`  Parent county (ParentEntityName): ${county || '(none)'}`);
  console.log(`  Population: ${pop == null ? '(none)' : pop.toLocaleString('en-US')}`);
  console.log(`\n  Revenue total: ${fmt(rev.total)}  — ${rev.tree.length} top-level groups`);
  printTree(rev.tree);
  console.log(`\n  Operating (expenditure) total: ${fmt(exp.total)}  — ${exp.tree.length} functions`);
  printTree(exp.tree);

  if (dryRun) { console.log('\nDry-run — no writes.'); return; }

  const supabase = await getSupabase();
  const result = await importEntity(supabase, wb, {
    entityName: entity, fiscalYear, sourceUrl, sourceDate, dryRun: false, entityType,
  });
  console.log(`\nImported ${entity} FY${fiscalYear} (basis: ${result.basis ?? 'n/a'}):`,
    `operating=${result.operating != null ? 'WRITTEN' : 'SKIPPED'},`,
    `revenue=${result.revenue != null ? 'WRITTEN' : 'SKIPPED'}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
