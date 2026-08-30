/**
 * South Carolina RFA — Local Government Finance Report: parsing and tree construction.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * The publisher is the S.C. Revenue and Fiscal Affairs Office. One workbook
 * carries the whole state: 46 county sheets, each wide-format with FY93..FY24
 * across the columns and a six-level indent hierarchy down the left.
 *
 * ⚠ INPUT IS .xlsx, CONVERTED FROM RFA'S LEGACY BIFF8 .xls by
 *   python scripts/tools/xlsToXlsx.py _acfr-work/sc/xls _acfr-work/sc/xlsx --check
 * ExcelJS cannot open BIFF8 at all. Same fetch-stage conversion as Georgia and
 * Pennsylvania.
 *
 * ⚠ THE CONVERSION IS LOSSLESS ONLY AT CENT PRECISION, AND THAT IS ENOUGH.
 * 3,155 of 262,873 county numeric cells differ between the .xls and the .xlsx at
 * float-repr level (52733895.239999995 -> 52733895.23999999, a 5e-9 dollar
 * difference); `--check` tolerates these by design and flags 8 larger ones on the
 * `State Summary` sheet, which nothing here reads. Rounded to 2dp, the whole
 * 269,580-cell workbook agrees except three millage-RATE cells sitting on a
 * rounding tie. Worst absolute delta anywhere: 3.8e-6. So every money value read
 * here is rounded to cents, and that makes the pipeline provably exact rather
 * than merely close.
 *
 * ── ⚠⚠ THE ASTERISK IS THE NON-REPORTING MARKER, AND IT IS EASY TO MISS ──────
 *
 * A year header can read `FY 23*` rather than `FY 23`. Three county sheets carry
 * one (Clarendon FY23/24, Jasper FY23/24, Kershaw FY21). A naive /^FY \d{2}$/
 * SILENTLY DROPS those columns; stripping the asterisk SILENTLY LOADS a year the
 * county never reported. Neither is acceptable, so `parseYearHeader` returns the
 * flag and the loader refuses the year outright.
 *
 * ── ⚠⚠ THE WORKBOOK'S TWO QUALITY SIGNALS CONTRADICT EACH OTHER ─────────────
 *
 * The `County Info` sheet carries a separate Y/N submission matrix, and it does
 * NOT agree with the asterisks — in both directions:
 *
 *   Clarendon, Jasper   sheet stars FY23+FY24   County Info says Y for both
 *   Kershaw             sheet stars FY21        County Info says Y
 *   Allendale           no stars                County Info says N for FY20/21/24
 *   Hampton             no stars                County Info says N for FY22
 *   Orangeburg          no stars                County Info says N for FY21
 *   Williamsburg        no stars                County Info says N for FY22/23/24
 *
 * Neither signal is a superset of the other, so a county-year is trustworthy only
 * when BOTH say it was reported. `reportedYears()` intersects them. This matters
 * far more for the eventual statewide sweep than for the two Knight counties,
 * which are clean on both signals across the whole load window.
 *
 * ⚠ Why it matters at all: before the 2023 edition, a non-reporting county's
 * missing year was BACKFILLED WITH THE PRIOR YEAR'S DATA ("Beginning with the
 * 2023 report, non-reporting counties will no longer have data for the prior FY
 * in place of the current FY data that is missing"). A carried-forward figure
 * presented as an actual is exactly the kind of thing that ties at $0 forever.
 *
 * ── SCOPE: WHY FY2012 IS THE FLOOR ──────────────────────────────────────────
 *
 * The report reaches back to FY93, and the first nineteen years are a DIFFERENT
 * SERIES. From the publisher's own Sources and Notes:
 *
 *   "Beginning with the 2013 report, revenue from bonds and leases is reported at
 *    the county and city levels for FY 2012 and forward. Prior to FY 2012, bonds
 *    and leases were not separately reported and may be included in Miscellaneous
 *    Revenue."
 *   "Total local option sales tax revenue on the county level for FY 2012 and
 *    forward includes revenue from the property tax credit fund and county revenue
 *    fund. Prior to FY 2012, data for the county revenue fund was not captured."
 *
 * Both changes move real money between categories at exactly FY2012. Loading
 * across that boundary would render a category discontinuity as a trend — the
 * session-5 Lake County lesson, which a passing oracle did not catch. FY2012 is
 * therefore the floor, recorded as a decision rather than a default.
 *
 * ── SCOPE: BONDS & LEASES ARE FINANCING SOURCES AND ARE EXCLUDED ────────────
 *
 * From the FY2025 county form instructions, verbatim:
 *   "Bond Revenue (Line 861) — Report all proceeds from general obligation bonds"
 *   "Lease Revenue (Line 862) — Report all proceeds from capital leases"
 *
 * Debt proceeds are not revenue. TT already excludes this class everywhere it has
 * met it: Florida's 384 Debt Proceeds (session 3) and Pennsylvania's financing
 * sources (session 5), and v2.28 exists because Los Angeles counted $4.77B of
 * TRAN borrowing as spending. The published headline is kept alongside so the
 * subset is always visible next to what the publisher printed.
 *
 * ── ⚠ REVENUES AND EXPENDITURES ARE ON DIFFERENT SCOPES, BY CONSTRUCTION ────
 *
 * The submission form collects "(a) General Fund" and "(b) Enterprise Fund"
 * separately on every section, and the published report drops the Utility Sales
 * Revenues block entirely — "Revenue from water, sewer, and power utilities
 * operated by counties and municipalities is not included in this report" — while
 * the expenditure side keeps form line 970, "Public Works (Utility Systems,
 * Public Transit)". Utility operations therefore appear in spending and not in
 * revenue.
 *
 * This is why RFA warns that "using the data in this report to impute a
 * relationship between total revenues and expenditures for local governments is
 * not recommended", and it is why `fund_scope` here is `unknown` rather than
 * `all_funds`: the figures are neither all funds nor the governmental funds, and
 * `unknown` is TT's honest value for not-comparable — the WeHo precedent.
 */

import ExcelJS from 'exceljs';

/** Anchors for the four blocks each county sheet stacks vertically. */
export const BLOCK = Object.freeze({
  COMBINED_REVENUE: 'Total Revenues (School Dist., Counties, Cities, & Special Purpose Districts)',
  SCHOOL_REVENUE: 'Total Revenues (School District only)',
  COUNTY_REVENUE: 'Total Revenues (County only)',
  COUNTY_EXPENDITURE: 'Total Expenditures (County only)',
  CITIES_REVENUE: 'Total Revenues (Cities only)*',
  CITIES_EXPENDITURE: 'Total Expenditures (Cities only)*',
});

/**
 * ⚠⚠ THE CITY BLOCKS ARE AN AGGREGATE OF EVERY MUNICIPALITY IN THE COUNTY, NOT A
 * CITY. The footnote under them reads "*Cities Include: Arcadia Lakes,
 * Blythewood, Columbia, Eastover, and Forest Acres." Reading Columbia out of the
 * Richland sheet would silently hand five governments' money to one of them.
 * This source cannot produce a South Carolina city, and the `Municipal Info`
 * sheet is only a submitted-Y/N matrix, not finance. Nothing here loads them.
 */
export const CITY_BLOCKS_ARE_AGGREGATES = true;

/** The leaf holding bond and capital-lease proceeds, excluded from revenue. */
export const FINANCING_LEAF = 'Bonds & Leases';

/** First fiscal year on a consistent scope basis — see the header. */
export const SC_LOAD_FLOOR = 2012;

/** Sheets that are not counties. */
export const NON_COUNTY_SHEETS = Object.freeze(new Set([
  'About the Report', 'Sources and Notes', 'County Info', 'Municipal Info',
  'Special Purpose District Info', 'State Summary',
]));

const MONEY_DP = 2;

/** Round to cents. See the conversion note in the header. */
export function money(v) {
  const n = num(v);
  return Math.round(n * 10 ** MONEY_DP) / 10 ** MONEY_DP;
}

export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'object' && v.result !== undefined) return num(v.result);
  const s = String(v).replace(/[$,\s]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Refuse Excel error cells. Georgia's extract turned `#REF!` into the number 23
 * on 1,851 cells; xlrd returns the error CODE and a downstream reader cannot tell
 * it from money. Never let one become a figure.
 */
export function assertNotError(value, where) {
  const v = value?.value ?? value;
  if (v && typeof v === 'object' && 'error' in v) {
    throw new Error(`Excel error cell ${JSON.stringify(v.error)} at ${where}`);
  }
  if (typeof v === 'string' && /^#(REF|DIV\/0|VALUE|N\/A|NAME\?|NULL!|NUM!)/.test(v.trim())) {
    throw new Error(`Excel error text ${JSON.stringify(v)} at ${where}`);
  }
  return v;
}

/**
 * Parse a year header cell.
 *
 * `FY 24` -> reported; `FY 24*` -> the publisher's non-reporting marker.
 * Two-digit years pivot at 90: FY93..FY99 are 1990s, FY00.. are 2000s.
 *
 * @returns {{fiscalYear: number, starred: boolean}|null}
 */
export function parseYearHeader(label) {
  const m = /^FY\s*(\d{2})(\*?)$/.exec(String(label ?? '').trim());
  if (!m) return null;
  const yy = Number(m[1]);
  return { fiscalYear: yy >= 90 ? 1900 + yy : 2000 + yy, starred: m[2] === '*' };
}

/** Read every sheet of the converted workbook into plain arrays. */
export async function readWorkbook(path) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const sheets = new Map();
  for (const ws of wb.worksheets) {
    const rows = [];
    ws.eachRow({ includeEmpty: true }, (row, i) => {
      const arr = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        arr[c - 1] = assertNotError(cell, `${path} [${ws.name}] r${i}c${c}`);
      });
      rows[i - 1] = arr;
    });
    sheets.set(ws.name, rows);
  }
  return { path, sheets };
}

/** The label column band. Depth is which of columns 0..5 first carries text. */
const LABEL_COLS = 6;

function labelOf(row) {
  for (let c = 0; c < LABEL_COLS; c += 1) {
    const v = row?.[c];
    const s = v === null || v === undefined ? '' : String(v).trim();
    if (s) return { depth: c, label: s };
  }
  return null;
}

/**
 * Locate the year header row and map fiscal year -> column index.
 *
 * @returns {{headerRow: number, years: Map<number, {col: number, starred: boolean}>}}
 */
export function indexYears(rows, sheetName) {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const years = new Map();
    for (let c = LABEL_COLS; c < row.length; c += 1) {
      const parsed = parseYearHeader(row[c]);
      if (parsed) years.set(parsed.fiscalYear, { col: c, starred: parsed.starred });
    }
    if (years.size >= 20) return { headerRow: r, years };
  }
  throw new Error(`No year header row found on sheet ${sheetName}`);
}

/**
 * Read the `County Info` submission matrix.
 *
 * ⚠ Keys are trimmed: the sheet stores `'Richland '` with a trailing space.
 *
 * @returns {Map<string, Map<number, boolean>>} county -> fy -> submitted
 */
export function readCountyInfo(rows) {
  let headerRow = -1;
  for (let r = 0; r < rows.length; r += 1) {
    if (String(rows[r]?.[0] ?? '').trim() === 'County') { headerRow = r; break; }
  }
  if (headerRow < 0) throw new Error('County Info: no header row');
  const cols = new Map();
  for (let c = 1; c < (rows[headerRow] ?? []).length; c += 1) {
    const parsed = parseYearHeader(String(rows[headerRow][c] ?? '').replace(/FY(\d)/, 'FY $1'));
    if (parsed) cols.set(parsed.fiscalYear, c);
  }
  const out = new Map();
  for (let r = headerRow + 1; r < rows.length; r += 1) {
    const name = String(rows[r]?.[0] ?? '').trim();
    if (!name) continue;
    const per = new Map();
    for (const [fy, c] of cols) per.set(fy, String(rows[r][c] ?? '').trim().toUpperCase() === 'Y');
    out.set(name, per);
  }
  return out;
}

/**
 * The fiscal years a county genuinely reported: the intersection of the two
 * disagreeing signals. See the header.
 *
 * @returns {{reported: number[], starred: number[], notSubmitted: number[]}}
 */
export function reportedYears({ years, countyInfo, county, window }) {
  const starred = [];
  const notSubmitted = [];
  const reported = [];
  const info = countyInfo.get(county.trim());
  for (const fy of window) {
    const y = years.get(fy);
    if (!y) continue;
    const submitted = info ? info.get(fy) : undefined;
    if (y.starred) starred.push(fy);
    if (submitted === false) notSubmitted.push(fy);
    if (!y.starred && submitted !== false) reported.push(fy);
  }
  return { reported, starred, notSubmitted };
}

/**
 * Slice one block out of a county sheet: the anchor row, then every row until the
 * next depth-0 label.
 */
export function sliceBlock(rows, anchor, sheetName) {
  let start = -1;
  for (let r = 0; r < rows.length; r += 1) {
    const l = labelOf(rows[r]);
    if (l && l.depth === 0 && l.label === anchor) { start = r; break; }
  }
  if (start < 0) throw new Error(`Sheet ${sheetName}: block anchor not found: ${anchor}`);
  const body = [];
  for (let r = start + 1; r < rows.length; r += 1) {
    const l = labelOf(rows[r]);
    if (!l) continue;
    if (l.depth === 0) break;
    body.push({ ...l, row: rows[r], rowIndex: r });
  }
  if (!body.length) throw new Error(`Sheet ${sheetName}: block ${anchor} is empty`);
  return { anchorRow: rows[start], anchorIndex: start, body };
}

/**
 * Build one fiscal year's nested tree from a sliced block.
 *
 * Emits the RPC's native shape, `{n, a, c}`, nested as deeply as the publisher
 * nests it. `_treasury_insert_tree` recurses on `c` with no depth limit, so the
 * full three-level hierarchy survives into the icicle instead of being flattened.
 *
 * @param {object} opts
 * @param {Array} opts.body        rows from sliceBlock
 * @param {number} opts.col        the fiscal year's column
 * @param {Set<string>} [opts.exclude] labels dropped from the tree (financing)
 * @returns {{tree: Array, total: number, excluded: Array<{n: string, a: number}>}}
 */
export function buildTree({ body, col, exclude = new Set() }) {
  const roots = [];
  const stack = [];
  const excluded = [];

  for (const item of body) {
    const node = { n: item.label, a: money(item.row?.[col]) };
    const depth = item.depth; // 1..5 within a block

    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].node : null;

    if (exclude.has(item.label)) {
      // ⚠⚠ AN EXCLUDED LEAF MUST BE SUBTRACTED FROM EVERY ANCESTOR, NOT JUST
      // UNLINKED. Each node's amount is READ from the sheet rather than summed
      // from its children, so removing `Bonds & Leases` without reducing
      // `Licenses, Fees, Charges, & Bonds` and `Revenues from Local Sources`
      // leaves the financing money sitting in the parents — the tree still adds
      // up to the publisher's headline and the exclusion silently does nothing.
      // Pennsylvania did this subtraction at the root because its financing
      // column was top-level; here the leaf is three deep, so it propagates.
      for (const s of stack) {
        if (!s.dropped) s.node.a = round2(s.node.a - node.a);
      }
      excluded.push({ n: item.label, a: node.a, parent: parent ? parent.n : null });
      stack.push({ depth, node, dropped: true });
      continue;
    }
    // A node under a dropped ancestor is dropped with it.
    if (stack.some((s) => s.dropped)) {
      stack.push({ depth, node, dropped: true });
      continue;
    }

    if (parent) (parent.c ||= []).push(node);
    else roots.push(node);
    stack.push({ depth, node, dropped: false });
  }

  pruneEmpty(roots);
  assertSiblingNamesUnique(roots, []);
  const total = round2(roots.reduce((s, n) => s + n.a, 0));
  return { tree: roots, total, excluded };
}

function round2(n) { return Math.round(n * 100) / 100; }

/** Drop `c: []` so a leaf is a leaf. */
function pruneEmpty(nodes) {
  for (const n of nodes) {
    if (n.c && n.c.length === 0) delete n.c;
    else if (n.c) pruneEmpty(n.c);
  }
}

/**
 * ⚠ `budget_categories.link_key` is the lowercased node name joined to its
 * ancestors by `|`, so two siblings sharing a name collide into one key and the
 * icicle silently merges them. Assert rather than discover it in the UI.
 */
export function assertSiblingNamesUnique(nodes, path) {
  const seen = new Set();
  for (const n of nodes) {
    const key = n.n.trim().toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate sibling category "${n.n}" under ${path.join(' > ') || '(root)'}`);
    }
    seen.add(key);
    if (n.c) assertSiblingNamesUnique(n.c, [...path, n.n]);
  }
}

/**
 * In-file consistency checks for one built tree.
 *
 * ⚠ These prove the READ, never the SCOPE — session 5's headline lesson, where
 * 11,283 of 11,283 fund checks passed over a $735M scope error. They are
 * necessary and they are not sufficient; the independent oracle lives in
 * scripts/verifyScRfa.mjs.
 *
 * @returns {Array<{id: string, kind: string, expected: number, actual: number, diff: number, ok: boolean}>}
 */
export function checkTree({
  tree, publishedTotal, subsetTotal, excludedTotal = 0, label, tolerance = 0.01,
}) {
  const checks = [];
  const add = (id, kind, expected, actual) => {
    const diff = round2(actual - expected);
    checks.push({ id, kind, expected, actual, diff, ok: Math.abs(diff) <= tolerance });
  };

  // Every parent equals the sum of its children, at every depth.
  const walk = (nodes, path) => {
    for (const n of nodes) {
      if (n.c?.length) {
        add(`${label}:${[...path, n.n].join('>')}`, 'parent=Σchildren',
          round2(n.a), round2(n.c.reduce((s, k) => s + k.a, 0)));
        walk(n.c, [...path, n.n]);
      }
    }
  };
  walk(tree, []);

  // The roots sum to the subset total we intend to load.
  add(`${label}:roots`, 'Σroots=loadedTotal', round2(subsetTotal),
    round2(tree.reduce((s, n) => s + n.a, 0)));

  // ⚠ The loaded tree DELIBERATELY does not equal the publisher's headline — it
  // drops financing sources. So the check that matters is that the subset plus
  // exactly what we removed returns the printed figure. Never widen the tree to
  // close this gap; that is how Florida's object-90 lesson was learned.
  if (publishedTotal !== undefined) {
    add(`${label}:published`, 'subset+excluded=published',
      round2(publishedTotal), round2(subsetTotal + excludedTotal));
  }
  return checks;
}
