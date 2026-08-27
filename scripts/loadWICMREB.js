/**
 * Wisconsin DOR CMREB Loader — County and Municipal Revenues and Expenditures
 *
 * Loads revenue-by-source + expenditure-by-function for any Wisconsin
 * municipality or county from the statewide DOR workbook (Bulletin 124).
 *
 * Source: https://www.revenue.wi.gov/SLFReportscotvc/CMREB<YYYY>.xlsx
 *   Free, no auth. One workbook per CALENDAR year (CY2020-CY2024 published).
 *   Four sheets — Cities (190), Villages (417), Towns (1,242), Counties (72).
 *   Flat layout: one row per municipality, categories as COLUMNS.
 *
 * Basis (MAD-06 — state it, never imply otherwise):
 *   - UNAUDITED. These are self-reported Municipal Financial Report (MFR)
 *     filings. The bulletin says so outright: "CMRE data is unaudited."
 *   - ALL GOVERNMENTAL FUNDS — general + capital projects + special revenue +
 *     debt service. NOT General-Fund-only; the source does not separate the GF.
 *     This differs from TT's Tucson/Pima/Oregon cities, which are GF basis.
 *   - CALENDAR YEAR. CY2024 = FY2024, no fiscal-year-end ambiguity.
 *   - Enterprise/internal-service funds are EXCLUDED (they appear as separate
 *     "Propriety Funds" context columns, which this loader does not load).
 *   - Each activity line already INCLUDES capital outlay, so a CMREB function is
 *     not comparable to the same-named function in a city ACFR. See
 *     .planning/phases/135-recon-loader/135-RECON.md.
 *
 * Modelled on scripts/loadOhioAOS.js (same shape of source: statewide XLSX, flat
 * category columns, one row per entity), including its D-04b decision to EXCLUDE
 * Other Financing Sources/Uses — for WI those are "proceeds of long-term debt,
 * inter-fund transfers, proceeds of refunding bonds, and sales of major general
 * fixed assets", which would double-count against the actual revenue/spend.
 *
 * Usage:
 *   node scripts/loadWICMREB.js --file CMREB2024.xlsx --fy 2024 --municipality Madison --dry-run
 *   node scripts/loadWICMREB.js --file CMREB2024.xlsx --fy 2024 --municipality Dane --entity-type county --dry-run
 *   node scripts/loadWICMREB.js --file CMREB2024.xlsx --fy 2024 --all --entity-type city --dry-run
 */

import { parseArgs } from 'node:util';
import { monthForSource } from './lib/loaderFiscalCalendars.mjs';
import ExcelJS from 'exceljs';

export const DATA_SOURCE_NAME =
  'Wisconsin DOR County and Municipal Revenues and Expenditures (unaudited MFR)';

export const SHEET_FOR_ENTITY = {
  city: 'Cities',
  village: 'Villages',
  town: 'Towns',
  county: 'Counties',
};

export function sourceUrlForYear(fiscalYear) {
  // Upper-case CMREB for the XLSX; the PDF bulletin is lower-case. Both verified 200.
  return `https://www.revenue.wi.gov/SLFReportscotvc/CMREB${fiscalYear}.xlsx`;
}

// ── Column map, BY HEADER NAME ────────────────────────────────────────────────
// Resolved by name, never by index: if DOR reorders or renames a column, the
// header assertion below fails loudly instead of silently loading the wrong
// figures. Names are reproduced EXACTLY as published, including the source's own
// typos ("Maintainence", "Road- Related", "Propriety") — do not tidy them.

const REV_TAX = ['General Property Taxes', 'Tax Increments', 'InLieu of Taxes', 'Other Taxes'];
const REV_INTERGOV = ['Federal Aids', 'State Shared Revenues', 'State Highway Aids',
  'All Other State Aids', 'Other Local Govt Aids'];
// These four look like they belong to "Total Miscellaneous Revenues" from their
// position, but they DO NOT — see REV_MISC.
const REV_DIRECT = ['Licenses and Permits', 'Fines, Forfeits and Penalties',
  'Public Charges for Services', 'Intergovernmental Charges for Services'];
// "Total Miscellaneous Revenues" is NARROWER than its column position implies: it
// sums only these two. Getting this wrong produces equal-and-opposite deltas
// (±$56,381,522 on Madison CY2024) that read as two broken subtotals but are one
// bad grouping. The bulletin's §III.B.8 confirms: "Total Miscellaneous Revenues -
// sum of the two lines above."
const REV_MISC = ['Interest Income', 'Other Revenues'];

const EXP_FUNCTIONS = ['General Government', 'Law Enforcement', 'Fire', 'Ambulance',
  'Other Public Safety', 'Highway Maintainence and Administration', 'Highway Construction',
  'Road- Related Facilities', 'Other Transportation', 'Solid Waste Collection and Disposal',
  'Other Sanitation', 'Health and Human Services', 'Culture and Education',
  'Parks and Recreation', 'Conservation and Development', 'All Other Expenditures'];
const EXP_DEBT = ['Debt Service - Principal Interest', 'Debt Service - Fiscal Changes'];

// Revenue tree leaves, in published order. Special Assessments sits between the
// tax block and the intergovernmental block and is its own leaf.
export const REVENUE_LEAVES = [
  ...REV_TAX, 'Special Assessments', ...REV_INTERGOV, ...REV_DIRECT, ...REV_MISC,
];
// Expenditure tree leaves = the 16 activity functions + the 2 debt-service lines.
// Debt service is included, matching loadOhioAOS.js D-02.
export const EXPENDITURE_LEAVES = [...EXP_FUNCTIONS, ...EXP_DEBT];

const REVENUE_TOTAL_COL     = 'Subtotal-General Revenues';
const EXPENDITURE_TOTAL_COL = 'Sub-total Expenditure';

const IDENTITY_COLS = ['CountyCode', 'MuniCode', 'MuniTypeCode', 'CountyName',
  'Municipality', 'Population'];
const SUBTOTAL_COLS = ['Total Taxes', 'Total Inter Government Revenues',
  'Total Miscellaneous Revenues', 'Subtotal-General Revenues',
  'Total Revenue and Other Financing Sources', 'Sub-total Operation and Capital Expenditure',
  'Total Debt Service', 'Sub-total Expenditure', 'Total Expenditures and Other Financing Uses'];
const EXCLUDED_COLS = ['Other Financing Sources', 'Other Financing Uses',
  'Total General Obligation Debt', 'Propriety Funds - Revenues', 'Propriety Funds - Expenses'];

const ALL_EXPECTED = [...IDENTITY_COLS, ...REVENUE_LEAVES, ...EXPENDITURE_LEAVES,
  ...SUBTOTAL_COLS, ...EXCLUDED_COLS];

// ── Source-rounding registry ──────────────────────────────────────────────────
// {"<mode>|<fy>|<municipality>": exact_delta} for entity-years where the SOURCE's
// own printed subtotal disagrees with the sum of its own printed components.
//
// EMPTY, and that is a finding rather than an oversight: all nine identities were
// re-derived for every row of every sheet in all five published years —
// 9,608 rows × 9 = 86,472 checks, zero failures (2026-07-27). The registry exists
// so a future year that drifts is handled the same exact-delta way as
// CityConfig.source_rounding in lib/acfrGF.py and SOURCE_ROUNDING in
// extractGresham.py — deliberately NOT a tolerance, which would let a real
// mis-parse through.
export const SOURCE_ROUNDING = {};

// ── Cell helpers (same semantics as loadOhioAOS.js) ───────────────────────────
export function cellNum(cell) {
  if (cell == null) return NaN;
  const v = cell.value;
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    return NaN;
  }
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

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

// ── Sheet access ──────────────────────────────────────────────────────────────
export function sheetFor(workbook, entityType) {
  const name = SHEET_FOR_ENTITY[entityType];
  if (!name) throw new Error(`Unknown entity type "${entityType}" (expected one of ${Object.keys(SHEET_FOR_ENTITY).join(', ')})`);
  const ws = workbook.getWorksheet(name);
  if (!ws) throw new Error(`Workbook has no "${name}" sheet — is this a CMREB workbook?`);
  return ws;
}

/** Map header text -> 1-indexed column. Asserts every expected column is present. */
export function headerMap(ws) {
  const map = new Map();
  const header = ws.getRow(1);
  header.eachCell({ includeEmpty: false }, (cell, col) => {
    const t = cellText(cell);
    if (t) map.set(t, col);
  });
  const missing = ALL_EXPECTED.filter((h) => !map.has(h));
  if (missing.length) {
    throw new Error(
      `CMREB layout changed — ${missing.length} expected column(s) not found on sheet "${ws.name}": ` +
      `${missing.join(' | ')}. Re-probe the workbook before loading; do NOT load by index.`);
  }
  return map;
}

/**
 * Every real data row on the sheet.
 * Filters on a non-empty Municipality cell: ExcelJS/openpyxl both report an
 * inflated row count for these workbooks (openpyxl claims max_row 1,851 for a
 * 190-row Cities sheet), so trailing blank padding must be dropped explicitly.
 */
export function dataRows(ws, cols) {
  const out = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (cellText(row.getCell(cols.get('Municipality')))) out.push(row);
  }
  return out;
}

export function findRow(ws, cols, municipality) {
  const want = municipality.trim().toUpperCase();
  const hits = dataRows(ws, cols).filter(
    (r) => cellText(r.getCell(cols.get('Municipality'))).toUpperCase() === want);
  if (!hits.length) throw new Error(`"${municipality}" not found on sheet "${ws.name}"`);
  if (hits.length > 1) {
    // Wisconsin reuses names across county lines (e.g. several towns share a name).
    const counties = hits.map((r) => cellText(r.getCell(cols.get('CountyName')))).join(', ');
    throw new Error(
      `"${municipality}" is ambiguous on sheet "${ws.name}" — ${hits.length} rows ` +
      `(counties: ${counties}). Disambiguate with --county.`);
  }
  return hits[0];
}

export function findRowInCounty(ws, cols, municipality, county) {
  const want = municipality.trim().toUpperCase();
  const wantCounty = county.trim().toUpperCase();
  const hit = dataRows(ws, cols).find(
    (r) => cellText(r.getCell(cols.get('Municipality'))).toUpperCase() === want &&
           cellText(r.getCell(cols.get('CountyName'))).toUpperCase() === wantCounty);
  if (!hit) throw new Error(`"${municipality}" not found in ${county} County on sheet "${ws.name}"`);
  return hit;
}

// ── Tie gate ──────────────────────────────────────────────────────────────────
/**
 * The nine identities the workbook asserts about itself. Each printed subtotal is
 * re-derived from its own components; any mismatch means the row was mis-read or
 * the source changed shape, and the load must not proceed.
 */
export function identities(get) {
  return [
    ['Total Taxes', REV_TAX.reduce((s, c) => s + get(c), 0), get('Total Taxes')],
    ['Total Inter Government Revenues',
      REV_INTERGOV.reduce((s, c) => s + get(c), 0), get('Total Inter Government Revenues')],
    ['Total Miscellaneous Revenues',
      REV_MISC.reduce((s, c) => s + get(c), 0), get('Total Miscellaneous Revenues')],
    ['Subtotal-General Revenues',
      get('Total Taxes') + get('Special Assessments') + get('Total Inter Government Revenues')
      + REV_DIRECT.reduce((s, c) => s + get(c), 0) + get('Total Miscellaneous Revenues'),
      get('Subtotal-General Revenues')],
    ['Total Revenue and Other Financing Sources',
      get('Subtotal-General Revenues') + get('Other Financing Sources'),
      get('Total Revenue and Other Financing Sources')],
    ['Sub-total Operation and Capital Expenditure',
      EXP_FUNCTIONS.reduce((s, c) => s + get(c), 0),
      get('Sub-total Operation and Capital Expenditure')],
    ['Total Debt Service', EXP_DEBT.reduce((s, c) => s + get(c), 0), get('Total Debt Service')],
    ['Sub-total Expenditure',
      get('Sub-total Operation and Capital Expenditure') + get('Total Debt Service'),
      get('Sub-total Expenditure')],
    ['Total Expenditures and Other Financing Uses',
      get('Sub-total Expenditure') + get('Other Financing Uses'),
      get('Total Expenditures and Other Financing Uses')],
  ];
}

/**
 * Throws unless every identity holds. A delta registered in SOURCE_ROUNDING is
 * accepted only on an EXACT match.
 */
export function assertTies(get, { municipality, fiscalYear }) {
  const failures = [];
  for (const [name, computed, printed] of identities(get)) {
    const delta = computed - printed;
    if (delta === 0) continue;
    const key = `${name}|${fiscalYear}|${municipality}`;
    const accepted = SOURCE_ROUNDING[key];
    if (accepted !== undefined && accepted === delta) {
      console.warn(`  NOTE ${municipality} CY${fiscalYear}: "${name}" printed ${printed.toLocaleString()} ` +
        `vs components ${computed.toLocaleString()} (${delta > 0 ? '+' : ''}${delta.toLocaleString()}) ` +
        `— registered source discrepancy, using the component sum.`);
      continue;
    }
    failures.push(`"${name}": components ${computed.toLocaleString()} vs printed ` +
      `${printed.toLocaleString()} (delta ${delta.toLocaleString()})`);
  }
  if (failures.length) {
    throw new Error(
      `TIE FAILURE ${municipality} CY${fiscalYear} — ${failures.length} of 9 identities broken:\n    ` +
      failures.join('\n    '));
  }
}

// ── Trees ─────────────────────────────────────────────────────────────────────
function buildTree(get, leaves, totalCol) {
  const tree = leaves
    .map((n) => ({ n, a: get(n) }))
    .filter((x) => x.a !== 0)
    .sort((x, y) => y.a - x.a);
  return { tree, total: get(totalCol) };
}

/**
 * Parse one municipality row into both trees. Runs the tie gate first — nothing
 * is returned from a row that does not tie.
 */
export function readEntity(ws, cols, row, fiscalYear) {
  const municipality = cellText(row.getCell(cols.get('Municipality')));
  const get = (name) => {
    const v = cellNum(row.getCell(cols.get(name)));
    return Number.isFinite(v) ? v : 0;
  };
  assertTies(get, { municipality, fiscalYear });

  const revenue     = buildTree(get, REVENUE_LEAVES, REVENUE_TOTAL_COL);
  const expenditure = buildTree(get, EXPENDITURE_LEAVES, EXPENDITURE_TOTAL_COL);

  // Belt-and-braces: the loaded leaves must themselves sum to the total we emit.
  // The identities above already prove this, but they prove it about the SOURCE;
  // this proves it about what we are about to write.
  for (const [label, built] of [['revenue', revenue], ['expenditure', expenditure]]) {
    const sum = built.tree.reduce((s, n) => s + n.a, 0);
    if (sum !== built.total) {
      throw new Error(`${municipality} CY${fiscalYear} ${label}: loaded leaves sum ` +
        `${sum.toLocaleString()} but total is ${built.total.toLocaleString()} ` +
        `(delta ${(sum - built.total).toLocaleString()})`);
    }
  }

  return {
    municipality,
    county:     cellText(row.getCell(cols.get('CountyName'))),
    population: get('Population'),
    fiscalYear,
    revenue,
    expenditure,
  };
}

// ── Database (Phase 136 / MAD-05, MAD-06) ─────────────────────────────────────
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
 * Resolve an already-seeded municipality. Deliberately does NOT create one:
 * seedWisconsinMadison.js owns municipality creation, because a row created here
 * would miss the county link and could land with the wrong entity_type. Qualified
 * by name + state + entity_type — the database already holds "Madison" (MN),
 * "Madison County" (OH) and "Madison County" (VA), so a bare name match is wrong.
 */
export async function resolveMunicipality(supabase, name, entityType) {
  const { data, error } = await supabase
    .schema('treasury').from('municipalities')
    .select('id, name, state, entity_type, population')
    .eq('state', 'WI').eq('entity_type', entityType).ilike('name', name).maybeSingle();
  if (error) throw new Error(`Municipality lookup failed for ${name} (${entityType}): ${error.message}`);
  if (!data) {
    throw new Error(`"${name}, WI" (${entityType}) is not seeded. ` +
      `Run scripts/seedWisconsinMadison.js first — this loader never creates municipalities.`);
  }
  return data;
}

/**
 * Never-overwrite pre-skip guard. treasury_sync_city_budget itself is NOT
 * source-safe (auto-memory project_sync_city_budget_not_source_safe: it
 * overwrites an existing (muni, fy, dataset) row and keeps the stale
 * data_source label), so the refusal has to happen here, before the call.
 */
export async function findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType) {
  const { data, error } = await supabase
    .schema('treasury').from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId).eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType).limit(1);
  if (error) throw new Error(`Budget lookup failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  return existing.data_source && existing.data_source !== DATA_SOURCE_NAME ? existing : null;
}

export async function importDataset(supabase, municipalityId, fiscalYear, datasetType,
                                    tree, total, sourceUrl, sourceDate) {
  const conflict = await findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType);
  if (conflict) {
    console.log(`    SKIP ${datasetType} CY${fiscalYear} — existing "${conflict.data_source}" ` +
      `data preserved (never-overwrite)`);
    return { skipped: true };
  }
  const { error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id:  municipalityId,
    p_fiscal_year:      fiscalYear,
    p_dataset_type:     datasetType,
    p_total:            total,
    p_tree:             tree,
    p_row_count:        tree.length,
    p_data_source_name: DATA_SOURCE_NAME,
    p_source_url:       sourceUrl,
    p_source_date:      sourceDate,
    // Wisconsin municipalities run the calendar year (MAD-06). This loader used
    // to post-stamp the column to work around the RPC's hardcoded 7; the RPC is
    // now told directly, and that stamp becomes a no-op assertion rather than a
    // correction.
    p_fiscal_year_start_month: monthForSource(DATA_SOURCE_NAME),
  });
  if (error) throw new Error(`RPC error (${datasetType} CY${fiscalYear}): ${error.message}`);

  // MAD-06: Wisconsin municipalities run on a CALENDAR year, so the fiscal year
  // starts in January. The RPC does not take this, and the column's dominant
  // value across the table is 7 (Jul-Jun), which would be wrong here and would
  // mislabel every period. Set it explicitly rather than inheriting a default.
  const { error: fyErr } = await supabase
    .schema('treasury').from('budgets')
    .update({ fiscal_year_start_month: 1 })
    .eq('municipality_id', municipalityId).eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType);
  if (fyErr) throw new Error(`Calendar-year stamp failed (${datasetType} CY${fiscalYear}): ${fyErr.message}`);

  return { skipped: false };
}

/** Write one entity-year: revenue + operating. */
export async function importEntityYear(supabase, entity, entityType, sourceDate) {
  const muni = await resolveMunicipality(supabase, entity.municipality, entityType);
  const sourceUrl = sourceUrlForYear(entity.fiscalYear);
  const rev = await importDataset(supabase, muni.id, entity.fiscalYear, 'revenue',
    entity.revenue.tree, entity.revenue.total, sourceUrl, sourceDate);
  const exp = await importDataset(supabase, muni.id, entity.fiscalYear, 'operating',
    entity.expenditure.tree, entity.expenditure.total, sourceUrl, sourceDate);
  return { municipalityId: muni.id, revenue: rev, operating: exp };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      file:            { type: 'string' },
      fy:              { type: 'string' },
      municipality:    { type: 'string' },
      county:          { type: 'string' },
      'entity-type':   { type: 'string', default: 'city' },
      'db-name':       { type: 'string' },
      all:             { type: 'boolean', default: false },
      'dry-run':       { type: 'boolean', default: false },
      quiet:           { type: 'boolean', default: false },
    },
    strict: false,
  });

  if (!opts.file || !opts.fy) {
    console.error('Usage: --file <CMREB2024.xlsx> --fy <2024> [--municipality <name> | --all] ' +
      '[--county <name>] [--entity-type city|village|town|county] [--dry-run]');
    process.exit(2);
  }
  const fiscalYear = Number(opts.fy);
  const entityType = opts['entity-type'];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(opts.file);
  const ws = sheetFor(workbook, entityType);
  const cols = headerMap(ws);

  let rows;
  if (opts.all) {
    rows = dataRows(ws, cols);
  } else if (opts.municipality) {
    rows = [opts.county
      ? findRowInCounty(ws, cols, opts.municipality, opts.county)
      : findRow(ws, cols, opts.municipality)];
  } else {
    console.error('Pass --municipality <name> or --all');
    process.exit(2);
  }

  console.log(`WI CMREB loader — ${ws.name} sheet, CY${fiscalYear}, ${rows.length} entit${rows.length === 1 ? 'y' : 'ies'}` +
    `${opts['dry-run'] ? ' (dry-run)' : ''}`);
  console.log(`Source: ${sourceUrlForYear(fiscalYear)}`);
  console.log(`Basis:  all governmental funds · calendar year · UNAUDITED self-reported MFR\n`);

  // Parse and validate EVERY row before writing anything. A tie failure anywhere
  // aborts the whole run, so a partially-loaded set cannot result from a source
  // that turned out to be mis-shaped.
  const parsed = [];
  const failures = [];
  for (const row of rows) {
    try {
      parsed.push(readEntity(ws, cols, row, fiscalYear));
    } catch (err) {
      failures.push(err.message);
      console.error(`  FAIL ${err.message}`);
    }
  }

  for (const e of parsed) {
    if (opts.quiet) continue;
    console.log(`  ${e.municipality} (${e.county} County) pop ${e.population.toLocaleString()}`);
    console.log(`    revenue     $${e.revenue.total.toLocaleString()} across ${e.revenue.tree.length} sources`);
    console.log(`    expenditure $${e.expenditure.total.toLocaleString()} across ${e.expenditure.tree.length} functions`);
    if (parsed.length === 1) {
      for (const n of e.revenue.tree) console.log(`      [rev] ${n.n}: $${n.a.toLocaleString()}`);
      for (const n of e.expenditure.tree) console.log(`      [exp] ${n.n}: $${n.a.toLocaleString()}`);
    }
  }

  console.log(`\n${parsed.length}/${rows.length} entities tie all 9 identities and sum to their emitted totals.`);
  if (failures.length) {
    console.error(`${failures.length} FAILED — refusing to load anything until these are understood.`);
    process.exit(1);
  }

  if (opts['dry-run']) {
    console.log('[dry-run] no writes performed.');
    return;
  }

  // source_date is the period the row describes, not today: these are calendar-year
  // figures, so the year end. Same convention as processGresham.js.
  const sourceDate = `${fiscalYear}-12-31`;
  const supabase = await getSupabase();
  console.log(`\nLoading (source_date=${sourceDate}, data_source="${DATA_SOURCE_NAME}"):`);
  let wrote = 0, skipped = 0;
  for (const e of parsed) {
    // The workbook prints bare county names ("DANE") where the canonical DB name
    // is "Dane County" — same situation as the Ohio CASH/MOD county loads.
    const dbName = opts['db-name']
      ?? (entityType === 'county' ? `${titleCase(e.municipality)} County` : titleCase(e.municipality));
    console.log(`  ${dbName}:`);
    const res = await importEntityYear(supabase, { ...e, municipality: dbName }, entityType, sourceDate);
    for (const k of ['revenue', 'operating']) {
      if (res[k].skipped) skipped++; else wrote++;
    }
  }
  console.log(`\nDone. ${wrote} dataset(s) written, ${skipped} skipped by the never-overwrite guard.`);
}

/** "MADISON" -> "Madison"; "DE FOREST" -> "De Forest". Workbook names are upper-case. */
export function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) main().catch((e) => { console.error('Fatal:', e.message); process.exit(2); });
