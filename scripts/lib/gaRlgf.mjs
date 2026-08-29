/**
 * Georgia DCA "Report of Local Government Finances" (RLGF) — pure parser.
 *
 * Scope: the FY2016+ form generation, whose workbooks carry a `LOAD1` sheet.
 * See .planning/GA-RLGF-RECON.md for the recon that chose this source, the
 * publisher's own audit-status wording, and the traps below in full.
 *
 * ── THE CENTRAL DESIGN DECISION: THE PRINTED FORM IS PRIMARY ──
 * VALUES and LABELS both come from the printed Pages 1-4 — the form the
 * government actually filed. `LOAD1`, DCA's own machine extract, is the
 * CORROBORATING read, and disagreements between the two are RECORDED as
 * anomalies rather than resolved silently.
 *
 * ⚠⚠ THIS IS THE INVERSE OF THE OBVIOUS DESIGN, AND IT WAS ARRIVED AT BY
 * MEASUREMENT. LOAD1 looks more authoritative — it is normalised, machine-keyed
 * and published by the same agency. It is also demonstrably broken in places:
 * across the 38-filing corpus, 10 of 18,801 code-keyed comparisons disagree, and
 * every single one is paired 1:1 with an Excel `#REF!` error cell whose
 * neighbour's formula has collapsed and re-pointed a real dollar amount onto the
 * WRONG UCOA account. $29,041,043.53 is misattributed that way and $2,026,961.00
 * of genuine reported amounts vanishes from LOAD1 entirely. The printed detail,
 * by contrast, reconciles to the form's own subtotal and grand-total rows in
 * 1,672 of 1,672 tests.
 *
 * ⚠ LOAD1's `TTL_*` cells are NOT affected — they still agree with the printed
 * subtotals. So a control-total check passes while the line items underneath are
 * misattributed. That is why `checkSectionTotals` alone is not sufficient and
 * the per-code page/extract comparison exists.
 *
 * ⚠ LOAD1 is largely DERIVED from the pages by cell reference (its cells are
 * `tRef3d` formulas pointing at `Page N`), so agreement between the two is NOT
 * independent corroboration — they agree by construction. It is the
 * DISAGREEMENTS that carry information: they mark where the reference broke.
 *
 * ⚠⚠ LOAD1 KEY ORDER IS NOT PAGE ORDER AND NOT SECTION ORDER. In `_R1`,
 * `31_3900D` sits between `31_1320` and `31_1340`, and `TTL_1A` sits after
 * `31_1790` — which is in a different section on the page. Nothing here may be
 * derived positionally; every mapping is by key identity.
 *
 * ⚠⚠ BARE UCOA CODES ARE NOT UNIQUE. `31.3900` labels three different taxes
 * (MOST, O-LOST, MARTA) and `31.4200`/`31.4300` two each. The printed page
 * disambiguates them itself — its code cell reads `31.3900C`, or
 * `31.3500 - Formerly 31.3900A` — so the suffixed key is recoverable from the
 * page text. `parseCodeCell` extracts it; a bare code where LOAD1 has suffixed
 * variants is an error, not a guess.
 */

/**
 * The four object-classification columns every Part V function carries.
 * A function's expenditure is their sum — the form's own Total Part V is the
 * sum of the four column totals, verified against Macon-Bibb FY2023.
 */
export const OBJECT_COLUMNS = Object.freeze(['A', 'B', 'C', 'D']);

/** Sections of Part V, in printed order. Roots of the expenditure tree. */
// ⚠ The object-column subtotal keys are `TTL_5A_A`, not `TTL_5A` + `A`. Getting
// that wrong does not raise: `checkSectionTotals` finds no key and reports the
// section SKIPPED, so all seven expenditure oracles silently stood down while
// reading as a clean run. Hence explicit key lists, and hence the rule that a
// skipped check is reported and counted, never treated as a pass.
const objTotals = (sec) => OBJECT_COLUMNS.map((o) => `TTL_${sec}_${o}`);

export const EXPENDITURE_SECTIONS = Object.freeze([
  { id: '5A', label: 'General Government', totalKeys: objTotals('5A') },
  { id: '5B', label: 'Judicial', totalKeys: objTotals('5B') },
  { id: '5C', label: 'Public Safety', totalKeys: objTotals('5C') },
  { id: '5D', label: 'Public Works', totalKeys: objTotals('5D') },
  { id: '5E', label: 'Health and Welfare', totalKeys: objTotals('5E') },
  { id: '5F', label: 'Culture and Recreation', totalKeys: objTotals('5F') },
  { id: '5G', label: 'Housing and Development', totalKeys: objTotals('5G') },
]);

/**
 * Expenditure function codes per section, as printed on Pages 3-4.
 *
 * ⚠ TRANSCRIBED FROM THE FORM, NOT INFERRED — and asserted against LOAD1 at
 * parse time by `crossCheckPageAgainstLoad1`, so a form change fails loudly
 * rather than silently dropping a function.
 *
 * ⚠ Section D deliberately includes the utility functions (4600 Electric, 4700
 * Natural Gas, 4750 Broadband, 4800 Cable). They are Part V functions and the
 * form counts them in Total Part V. Part VI — a SEPARATE table of enterprise
 * SYSTEM EXPENSES — is what this loader excludes. Do not confuse the two.
 */
export const EXPENDITURE_FUNCTIONS = Object.freeze({
  '5A': ['1100', '1300', '1400', '1510', '1530', '1535', '1540', '1545', '1550',
    '1555', '1560', '1565', '1570', '1575', '1580', '1590', '1595'],
  '5B': ['2100', '2150', '2160', '2180', '2200', '2300', '2400', '2450', '2500',
    '2600', '2650', '2700', '2750', '2800'],
  '5C': ['3100', '3200', '3226', '3300', '3326', '3400', '3500', '3600', '3700',
    '3800', '3900', '3910'],
  '5D': ['4100', '4200', '4250', '4300', '4400', '4510', '4520', '4530', '4540',
    '4550', '4560', '4570', '4580', '4585', '4600', '4700', '4750', '4800',
    '4900', '4950', '4960'],
  '5E': ['5100', '5400', '5500', '5600'],
  '5F': ['6100', '6200', '6500'],
  '5G': ['7100', '7200', '7300', '7400', '7500', '7600'],
});

/** Roots of the revenue tree, with the LOAD1 subtotal key that must equal each. */
export const REVENUE_SECTIONS = Object.freeze([
  { id: '1A', label: 'General Property Taxes', totalKeys: ['TTL_1A'] },
  { id: '1B', label: 'General Sales and Use Taxes', totalKeys: ['TTL_1B'] },
  { id: '1C', label: 'Excise or Selective Sales and Use Taxes or Fees', totalKeys: ['TTL_1C'] },
  { id: '1D', label: 'Licenses, Permits, and Fees', totalKeys: ['TTL_1D'] },
  // Part II's total is the three SOURCE-column totals, so it is oracled too —
  // there is no reason for this section to be the one that goes unchecked.
  { id: '2', label: 'Intergovernmental Revenues', totalKeys: ['TTL_2A', 'TTL_2B', 'TTL_2C'] },
  { id: '3A', label: 'Service Charges', totalKeys: ['TTL_3A'] },
  { id: '3B', label: 'Other Revenues', totalKeys: ['TTL_3B'] },
]);

/**
 * Revenue line-item keys per section, as the LOAD1 blocks name them.
 *
 * ⚠ Part II (intergovernmental) keys carry a SOURCE suffix, not an object
 * suffix: `A` = from the State of Georgia, `B` = from other local governments,
 * `C` = from the federal government. Same letters, entirely different meaning
 * from the Part V object columns. They are three separate reported columns and
 * all three are summed into the one Intergovernmental root.
 */
export const REVENUE_ITEMS = Object.freeze({
  '1A': ['31_1100', '31_1110', '31_1120', '31_1190', '31_1200', '31_1300',
    '31_1400', '31_1310', '31_1315', '31_1316', '31_1320', '31_1340',
    '31_1350', '31_1390', '31_9000'],
  '1B': ['31_3100', '31_3200', '31_3300', '31_3400', '31_3900A', '31_3900B',
    '31_3900C', '31_3900D'],
  '1C': ['31_1600', '31_1710', '31_1720', '31_1730', '31_1740', '31_1750',
    '31_1760', '31_1790', '31_4100', '31_4200A', '31_4200B', '31_4300A',
    '31_4300B', '31_4400', '31_4500', '31_6100', '31_6200', '31_6300',
    '31_4900', '31_8000'],
  '1D': ['32_1100', '32_1200', '32_2200', '32_2900', '32_3100', '32_3900', '32_4000'],
  '2': ['33_8000', '33_4000', '33_5200', '33_6000', '33_6101', '33_6102',
    '33_6103', '33_1000', '33_6104', '33_7100', '33_9999'],
  '3A': ['34_1100', '34_1300', '34_1400', '34_2100', '34_2200', '34_2300',
    '34_2500', '34_2510', '34_2600', '34_3000', '34_3200', '34_3300', '34_3900'],
  '3B': ['34_6110', '34_6510', '34_7000', '34_9000', '35_1100', '35_1200',
    '35_1300', '35_1400', '35_1900', '36_1000', '36_2000', '36_3000',
    '37_1000', '38_1000', '38_2000', '38_3000', '39_2000', '39_9999'],
});

/**
 * Part II labels, transcribed from the printed form.
 *
 * ⚠⚠ THESE CANNOT BE HARVESTED FROM THE PAGE. Six of the eleven Part II lines
 * print the literal placeholder `33.XXXX` in their code cell instead of a code —
 * Solid Waste Grants, Revenues of County Board of Health, Crime and Corrections
 * Grants and Public Welfare Grants all share it. There is no code to join on, so
 * these are transcribed once and asserted against LOAD1's key set at parse time
 * by `checkItemCoverage`, which fails loudly if the form ever adds or renames a
 * line rather than silently dropping its money.
 */
export const INTERGOV_LABELS = Object.freeze({
  '33_8000': 'Payment in Lieu of Taxes',
  '33_4000': 'Local Maintenance Improvement Grants (LMIG)',
  '33_5200': 'Forest Land Protection (FLPA) Grants',
  '33_6000': 'Water/Wastewater Grants',
  '33_6101': 'Solid Waste Grants',
  '33_6102': 'Revenues of County Board of Health',
  '33_6103': 'Crime and Corrections Grants',
  '33_1000': 'Community Development Block Grants',
  '33_6104': 'Public Welfare Grants',
  '33_7100': 'SPLOST Distribution - Municipalities Only',
  '33_9999': 'Other Intergovernmental Revenues',
});

/** Part II source-column suffixes, in printed order. */
export const INTERGOV_SOURCES = Object.freeze([
  { suffix: 'A', label: 'From the State of Georgia' },
  { suffix: 'B', label: 'From other Local Governments' },
  { suffix: 'C', label: 'From the Federal Government' },
]);

/**
 * Geometry of each printed page that carries labels.
 *
 * ⚠⚠ PAGE 3 AND PAGE 4 HOLD THE SAME TABLE AT DIFFERENT COLUMN OFFSETS. The
 * code column is 1 on Page 3 and 2 on Page 4. This is the Ohio
 * county-vs-city-layout lesson occurring INSIDE a single workbook, and it is
 * why the offsets are declared per page rather than assumed uniform.
 */
export const PAGE_GEOMETRY = Object.freeze({
  'Page 1': { labelCol: 0, codeCol: 2 },
  'Page 2': { labelCol: 0, codeCol: 5 },
  'Page 3': { labelCol: 0, codeCol: 1 },
  'Page 4': { labelCol: 0, codeCol: 2 },
});

/**
 * The money columns on each printed page.
 *
 * ⚠⚠ DECLARED EXPLICITLY, NEVER SUMMED BY SCANNING THE ROW. The UCOA code
 * column is numeric on Pages 3 and 4 (it renders as `4,400`), so "add up every
 * number on this line" silently folds the CODE into the money — an error of a
 * few thousand dollars that no total would catch on a large row.
 *
 * ⚠ Page 2 is Part-dependent: Part II reports three SOURCE columns (7/8/9),
 * Part III one (9), and Part IV another (7). Handled by `pageValueColumns`.
 */
export const PAGE_VALUE_COLUMNS = Object.freeze({
  'Page 1': [5],
  'Page 3': [2, 3, 4, 5],
  'Page 4': [3, 4, 5, 6],
});

/** Money columns for a Page 2 row, which depend on the Part it sits in. */
export function pageValueColumns(sheet, part) {
  if (sheet !== 'Page 2') return PAGE_VALUE_COLUMNS[sheet] || [];
  if (/^Part\s+II\b/i.test(part || '')) return [7, 8, 9];
  if (/^Part\s+IV\b/i.test(part || '')) return [7];
  return [9];
}

/**
 * Read every code's amount from the PRINTED PAGES.
 *
 * ⚠⚠ THE PAGE IS PRIMARY, AND LOAD1 IS THE CROSS-CHECK — deliberately the
 * inverse of the obvious design. LOAD1 looks more authoritative (it is DCA's own
 * machine extract) but it is measurably defective: across the 38-filing corpus a
 * stray integer 23 contaminates it in two distinct ways, either DISPLACING a
 * value one key along or being ADDED to it:
 *
 *   Baldwin FY2017     34_2500  LOAD1 = 23             page = 563,954
 *   Macon-Bibb FY2020  3326     LOAD1 = 23             page = 18,130,069.97
 *   Macon-Bibb FY2020  2300     LOAD1 = 3,116,963.15   page = 3,116,940.15  (-23)
 *   Milledgeville FY23 31_4200B LOAD1 = 458,391.85     page = 163,437       (-23)
 *
 * The printed page is the form the government actually filed, and it is the page
 * that reconciles to the printed subtotals. So values are read here, and
 * disagreements with LOAD1 are RECORDED as anomalies rather than resolved
 * silently — see the Milledgeville Rule: flag, never hide.
 */
export function readPageValues(pages) {
  const values = {};
  const labels = {};
  for (const [sheet, geom] of Object.entries(PAGE_GEOMETRY)) {
    const rows = pages[sheet];
    if (!rows) continue;
    let part = null;
    for (const row of rows) {
      const label = cellText(row?.[geom.labelCol]);
      if (PART_RE.test(label)) part = label;
      if (!label || /^total\b/i.test(label)) continue;
      const code = parseCodeCell(row?.[geom.codeCol]);
      if (!code) continue;
      if (code in values) continue; // first printed line for a code wins
      const cols = pageValueColumns(sheet, part);
      values[code] = cols.reduce((a, c) => a + num(row?.[c]), 0);
      labels[code] = label;
    }
  }
  return { values, labels };
}

/**
 * Alias a bare printed code onto the suffixed key LOAD1 uses for it.
 *
 * ⚠ THE FORM PRINTS THE FIRST VARIANT OF A SPLIT LINE WITHOUT ITS SUFFIX.
 * "Alcoholic Beverage Excise Taxes - Beer & Wine" prints `31.4200`, while its
 * sibling prints `31.4250 - Formerly 31.4200B`; LOAD1 keys them `31_4200A` and
 * `31_4200B`. Matching the page literally therefore finds no `31_4200A` at all
 * and DROPS that line's money — $458,391.85 vanished from Milledgeville FY2023
 * section 1C, and the loss was invisible except that the section stopped
 * reconciling to the form's own printed subtotal.
 *
 * Driven by LOAD1's actual key set rather than a hardcoded list, so the same
 * shape is handled wherever else the form splits a line.
 */
export function aliasBareCodes(values, knownKeys) {
  const known = knownKeys instanceof Set ? knownKeys : new Set(knownKeys);
  for (const code of Object.keys(values)) {
    if (known.has(code)) continue;          // the bare code is itself a real key
    if (`${code}A` in values) continue;      // the page already printed the A row
    if (known.has(`${code}A`)) values[`${code}A`] = values[code];
  }
  return values;
}

const PART_RE = /^Part\s+([IVX]+)\b/i;
const SECTION_RE = /^Section\s+([A-G])\b/i;

/**
 * Normalise one cell to a trimmed string.
 * ⚠ The UCOA code column is NUMERIC in places and renders as `4,400` / `4,510`.
 * A float that is a whole number must not become "4400.0", and separators must
 * go, or the code never matches.
 */
export function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

/**
 * Extract the LOAD1 key from a printed code cell.
 *
 * Handles every shape observed in the corpus:
 *   "31.1100"                        -> 31_1100
 *   "31.3900C"                       -> 31_3900C
 *   "31.3500 - Formerly 31.3900A"    -> 31_3500   (the CURRENT code wins)
 *   "34.1100 - Include 34.1110 ..."  -> 34_1100
 *   "3300"                           -> 3300      (expenditure function)
 *   "4,510"                          -> 4510
 *   "33.8000 /\n33.3000"             -> 33_8000   (first code wins)
 *
 * @returns {string|null} the key, or null when the cell holds no code.
 */
export function parseCodeCell(raw) {
  const s = cellText(raw).replace(/,/g, '');
  if (!s) return null;
  // ⚠⚠ "Formerly" WINS. Where the form renumbered a line it prints
  // "31.3500 - Formerly 31.3900A", and LOAD1 still keys it under the OLD code:
  // 31_3900A exists, 31_3500 does not. Taking the leading (current) code — the
  // obvious reading — silently orphans the line and its money. Verified on
  // TSPLOST2 (31.3500/31.3900A) and Distilled Spirits (31.4250/31.4200B).
  const formerly = s.match(/Formerly\s+(\d{2})[._](\d{4})([A-E])?/i);
  if (formerly) return `${formerly[1]}_${formerly[2]}${formerly[3] || ''}`;
  // Revenue/asset style: two digits, separator, four digits, optional suffix.
  const rev = s.match(/^(\d{2})[._](\d{4})([A-E])?/);
  if (rev) return `${rev[1]}_${rev[2]}${rev[3] || ''}`;
  // Expenditure style: a bare four-digit function code.
  const exp = s.match(/^(\d{4})(?:\.0)?(?:\s|$|[^\d])/) || s.match(/^(\d{4})$/);
  if (exp) return exp[1];
  return null;
}

/**
 * Which LOAD1 block each tree section's figures live in.
 *
 * ⚠⚠ THIS SCOPING IS NOT COSMETIC — IT IS A CORRECTNESS REQUIREMENT.
 * LOAD1 keys are unique WITHIN a block and emphatically NOT across blocks.
 * `_E9` (Part X, intergovernmental expenditures) reuses `3200A`, `3326A`,
 * `3500A`, `4200A`, `5100A`, `5400A`, `6100A`, `7500A` … every one of which also
 * names a Part V function in `_E1`-`_E6`. Flattening every block into one map
 * lets Part X overwrite Part V: measured on Macon-Bibb FY2023, that read Part V
 * as $153,772,348 against the form's own $256,276,171 — a 40% undercount that
 * still produced a plausible-looking tree with all 77 functions present.
 * Read each section ONLY from its own block.
 */
export const SECTION_BLOCKS = Object.freeze({
  '5A': ['_E1'], '5B': ['_E2'], '5C': ['_E3'], '5D': ['_E4', '_E5'],
  '5E': ['_E6'], '5F': ['_E6'], '5G': ['_E6'],
  '1A': ['_R1'], '1B': ['_R1'], '1C': ['_R1'], '1D': ['_R1'],
  '2': ['_R2'], '3A': ['_R2'], '3B': ['_R3'],
});

/** Build a lookup restricted to the named blocks. */
export function scopedLookup(blocks, names) {
  const map = {};
  for (const n of names) Object.assign(map, blocks[n] || {});
  return map;
}

/**
 * Parse a `LOAD1` sheet into `{ blocks, flat }`.
 *
 * LOAD1 is a stack of blocks. Each begins with a marker row whose first cell is
 * `_R1`/`_E1`/`_LOG1`..., then a header row starting `CICOID`, then exactly one
 * value row. Keys are unique across the whole sheet except where a block
 * repeats one, so `flat` is built last-wins per block and `blocks` keeps the
 * per-block view for callers that need it.
 *
 * @param {Array<Array<*>>} rows zero-indexed grid
 */
export function parseLoad1(rows) {
  const blocks = {};
  const flat = {};
  let marker = null;
  for (let r = 0; r < rows.length; r++) {
    const first = cellText(rows[r]?.[0]);
    if (/^_[A-Z]+\d*$/.test(first)) { marker = first; continue; }
    if (first !== 'CICOID') continue;
    const header = rows[r] || [];
    const values = rows[r + 1] || [];
    const block = {};
    for (let c = 0; c < header.length; c++) {
      const key = cellText(header[c]);
      if (!key) continue;
      block[key] = values[c] ?? null;
    }
    const name = marker || `_BLOCK${r}`;
    blocks[name] = block;
    Object.assign(flat, block);
    marker = null;
  }
  return { blocks, flat };
}

/**
 * Excel error values, as `scripts/tools/xlsToXlsx.py` writes them.
 *
 * ⚠⚠ THESE ARE NOT ZERO AND NOT MISSING-BY-ACCIDENT — they are a BROKEN FORMULA
 * in the publisher's own extract, and DCA's LOAD1 sheet is full of them: 1,851
 * error cells across 37 of the 58 GA workbooks. Ten of them sit inside the
 * loaded trees, and every one marks a place where a cell reference collapsed and
 * displaced a real dollar amount onto the wrong account code.
 *
 * ⚠ In the raw .xls an error cell's "value" is its error CODE, so a naive reader
 * sees `#REF!` as the integer **23**, `#DIV/0!` as 7, `#VALUE!` as 15 and `#N/A`
 * as 42 — small, plausible dollar amounts. That is exactly how this defect hid.
 */
const EXCEL_ERROR = /^#(REF!|VALUE!|DIV\/0!|NAME\?|NUM!|N\/A|NULL!|ERR\d+)$/;

export function isErrorValue(v) {
  return typeof v === 'string' && EXCEL_ERROR.test(v.trim());
}

/** True only when a key exists AND carries a usable number. */
export function hasNumber(scope, key) {
  return key in scope && !isErrorValue(scope[key]);
}

/**
 * Coerce a LOAD1 cell to a number. Blank/non-numeric becomes 0.
 * ⚠ An Excel error returns NaN, deliberately: it must propagate loudly rather
 * than pass as a zero that quietly shrinks a total.
 */
export function num(v) {
  if (isErrorValue(v)) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[$,\s]/g, '');
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Read the `_LOG1` metadata block.
 *
 * ⚠⚠ `Audited` IS DIRTY. Observed values across 38 filings: "YES", "NO", "Yes",
 * "No", and 0.0. A blank or 0 means the entity DID NOT ANSWER, which is not the
 * same as "No" and must never be coerced to it — an early label-scraping pass
 * did exactly that and mis-read a blank as NO.
 *
 * ⚠ `FYEmonth` can be the unfilled placeholder string "MONTH" (Baldwin FY2020).
 * It is returned as-is; resolving the month is the caller's job, because the
 * FAC census is the better source when the field is a placeholder.
 */
export function readLog1(flat) {
  const raw = (k) => cellText(flat[k]);
  const auditedRaw = raw('Audited');
  let audited = null; // null === not stated
  if (/^yes$/i.test(auditedRaw)) audited = true;
  else if (/^no$/i.test(auditedRaw)) audited = false;

  const monthsRaw = flat.MosRptd;
  return {
    government: raw('Government'),
    fyEndMonthText: raw('FYEmonth'),
    fyEndMonth: monthFromEndText(raw('FYEmonth')),
    monthsReported: monthsRaw === null || monthsRaw === undefined ? null : num(monthsRaw),
    monthChanged: /^yes$/i.test(raw('MoChng')),
    audited,
    auditedRaw,
  };
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/**
 * "June 30" (fiscal year END) -> 7 (fiscal year START month).
 * ⚠ Returns null for the "MONTH" placeholder and anything unrecognised. It must
 * never fall back to a default: `project_fysm_column_default_one_defect` is the
 * whole story of a fiscal month that defaulted rather than admitted ignorance.
 */
export function monthFromEndText(text) {
  const s = cellText(text).toLowerCase();
  const idx = MONTH_NAMES.findIndex((m) => s.startsWith(m));
  if (idx === -1) return null;
  return (idx + 1) % 12 + 1; // end month -> next month is the start
}

/**
 * Harvest `{code -> label}` from the printed pages, resetting the section
 * tracker on every Part boundary.
 *
 * ⚠⚠ THE RESET IS LOAD-BEARING. Without it the tracker carries
 * "Section B -- OTHER REVENUES" across into Part IV and mislabels 17 enterprise
 * line items as governmental revenue — found in recon, on real data.
 *
 * @param {Object<string, Array<Array<*>>>} pages sheet name -> grid
 * @returns {{labels: Object<string,string>, parts: Object<string,string>}}
 */
export function harvestLabels(pages) {
  const labels = {};
  const parts = {};
  for (const [name, geom] of Object.entries(PAGE_GEOMETRY)) {
    const rows = pages[name];
    if (!rows) continue;
    let part = null;
    let section = null;
    for (const row of rows) {
      const label = cellText(row?.[geom.labelCol]);
      if (PART_RE.test(label)) { part = label; section = null; }
      else if (SECTION_RE.test(label)) { section = label; }
      if (!label || /^total\b/i.test(label)) continue;
      const code = parseCodeCell(row?.[geom.codeCol]);
      if (!code) continue;
      // First label wins: a code repeated later on the page is the same line.
      if (!(code in labels)) {
        labels[code] = label;
        parts[code] = section || part || '';
      }
    }
  }
  return { labels, parts };
}

/**
 * THE INDEPENDENT READ CHECK.
 *
 * For every code this loader maps, compare the value printed on the page against
 * the value LOAD1 reports for the same code. They are two different
 * representations of the same filing, produced by DCA's own form logic, so they
 * must agree — and a label/value offset in the page reader breaks the agreement
 * for the shifted rows.
 *
 * @returns {Array<{code:string,page:number,load1:number}>} disagreements
 */
export function crossCheckPageAgainstLoad1(pages, flat, keysFor) {
  const bad = [];
  let checked = 0;
  for (const [name, geom] of Object.entries(PAGE_GEOMETRY)) {
    const rows = pages[name];
    if (!rows) continue;
    for (const row of rows) {
      const label = cellText(row?.[geom.labelCol]);
      if (!label || /^total\b/i.test(label)) continue;
      const code = parseCodeCell(row?.[geom.codeCol]);
      if (!code) continue;
      // Every numeric cell printed on this line. Which COLUMN a figure sits in
      // varies by Part (II uses three source columns, III one, IV another), and
      // Page 3/Page 4 are offset from each other — so the check is "the LOAD1
      // figure for this code is printed ON THIS LINE", not "in this column".
      // That is offset-proof in the only direction that matters: a page reader
      // that welds a label to the wrong row reads a DIFFERENT line's numbers,
      // and the right figure then appears nowhere on it.
      const printed = row
        .map((v) => (typeof v === 'number' ? v : null))
        .filter((v) => v !== null);
      for (const key of keysFor(code)) {
        if (!(key in flat)) continue;
        const loadVal = num(flat[key]);
        checked++;
        if (loadVal === 0) continue; // a zero is unfalsifiable: every blank matches
        if (!printed.some((p) => Math.abs(p - loadVal) <= 0.005)) {
          bad.push({ code: key, load1: loadVal, sheet: name, label });
        }
      }
    }
  }
  return { bad, checked };
}

/**
 * Build the expenditure tree (Part V) from a LOAD1 flat map.
 * Leaf amount = the four object columns summed.
 */
export function buildExpenditureTree(blocks, labels, pageValues, anomalies = []) {
  const roots = [];
  for (const section of EXPENDITURE_SECTIONS) {
    const scope = scopedLookup(blocks, SECTION_BLOCKS[section.id]);
    const items = [];
    for (const fn of EXPENDITURE_FUNCTIONS[section.id]) {
      const onPage = fn in pageValues;
      let load = 0;
      let inLoad1 = false;
      let errored = false;
      for (const obj of OBJECT_COLUMNS) {
        const key = `${fn}${obj}`;
        // hasNumber, not `in`: a #REF! key EXISTS but carries no value. Counting
        // it as present would let a broken formula stand in for the form.
        if (isErrorValue(scope[key])) { errored = true; continue; }
        if (hasNumber(scope, key)) { inLoad1 = true; load += num(scope[key]); }
      }
      if (!onPage && !inLoad1) continue;
      // The printed form is authoritative; LOAD1 is the corroborating read.
      const amount = onPage ? pageValues[fn] : load;
      if (onPage && (errored || (inLoad1 && Math.abs(pageValues[fn] - load) > 0.005))) {
        anomalies.push({
          kind: errored ? 'extract_cell_is_excel_error' : 'extract_disagrees_with_form',
          section: section.id, code: fn, label: labels[fn] || fn,
          form: pageValues[fn],
          extract: errored ? null : load,
          delta: errored ? null : load - pageValues[fn],
        });
      }
      items.push({ code: fn, label: labels[fn] || fn, amount });
    }
    const amount = items.reduce((a, i) => a + i.amount, 0);
    roots.push({ id: section.id, label: section.label, amount, items });
  }
  return { roots, total: roots.reduce((a, r) => a + r.amount, 0) };
}

/**
 * Build the Part II (intergovernmental) leaves FROM THE PRINTED PAGE.
 *
 * ⚠⚠ THIS IS THE ONE SECTION LOAD1 CANNOT BE TRUSTED FOR. DCA's own extract
 * misaligns the `_R2` C column on some filings: on Macon-Bibb FY2023 the key
 * `33_6103C` carries CDBG's $3,778,314, `33_1000C` carries a stray integer 23,
 * and Crime and Corrections' $793,967 is absent from the block entirely — so the
 * items undershoot DCA's own `TTL_2C` by $793,944. Measured across the corpus:
 * 35 of 38 filings tie, and 3 (Macon-Bibb FY2021, FY2022, FY2023) do not.
 * The PRINTED PAGE ties on all of them.
 *
 * Only the page cross-check found this. It is the standing argument for reading
 * a source twice by different routes rather than trusting one machine extract
 * because it looks authoritative.
 *
 * ⚠ Part II lines print the placeholder `33.XXXX` instead of a code, so these
 * leaves are keyed by their own printed label. That is safe HERE and only here:
 * the label and its three figures come from THE SAME ROW, so no cross-row join
 * exists to slip. The three column sums are still required to equal `TTL_2A/B/C`.
 */
export function buildIntergovFromPage(pages, blocks, valueCols = [7, 8, 9]) {
  const rows = pages['Page 2'] || [];
  const items = [];
  let inPart2 = false;
  for (const row of rows) {
    const label = cellText(row?.[0]);
    if (/^Part\s+II\b/i.test(label)) { inPart2 = true; continue; }
    if (!inPart2) continue;
    if (/^Total Part II\b/i.test(label)) break;
    if (!label || /^PURPOSE\b/i.test(label)) continue;
    const amounts = valueCols.map((c) => num(row?.[c]));
    const amount = amounts.reduce((a, b) => a + b, 0);
    if (amount === 0) continue;
    items.push({ code: null, label, amount, bySource: amounts });
  }
  const r2 = blocks._R2 || {};
  const expected = INTERGOV_SOURCES.map(({ suffix }) => num(r2[`TTL_2${suffix}`]));
  const actual = valueCols.map((_, i) => items.reduce((a, it) => a + it.bySource[i], 0));
  const columnsTie = expected.every((e, i) => Math.abs(e - actual[i]) <= 0.005);
  return { items, expected, actual, columnsTie };
}

/** Build the revenue tree (Parts I-III). Part IV (enterprise) is excluded. */
export function buildRevenueTree(blocks, labels, pages, pageValues, anomalies = []) {
  const roots = [];
  for (const section of REVENUE_SECTIONS) {
    let items;
    if (section.id === '2') {
      // Part II prints `33.XXXX` placeholders instead of codes, so it is read
      // row-wise from the page — see buildIntergovFromPage.
      items = buildIntergovFromPage(pages, blocks).items
        .map(({ code, label, amount }) => ({ code, label, amount }));
    } else {
      const scope = scopedLookup(blocks, SECTION_BLOCKS[section.id]);
      items = [];
      for (const key of REVENUE_ITEMS[section.id]) {
        const onPage = key in pageValues;
        const errored = isErrorValue(scope[key]);
        const inLoad1 = hasNumber(scope, key);
        if (!onPage && !inLoad1) continue;
        const load = inLoad1 ? num(scope[key]) : 0;
        const amount = onPage ? pageValues[key] : load;
        if (onPage && (errored || (inLoad1 && Math.abs(pageValues[key] - load) > 0.005))) {
          anomalies.push({
            kind: errored ? 'extract_cell_is_excel_error' : 'extract_disagrees_with_form',
            section: section.id, code: key, label: labels[key] || key,
            form: pageValues[key],
            extract: errored ? null : load,
            delta: errored ? null : load - pageValues[key],
          });
        }
        items.push({ code: key, label: labels[key] || key, amount });
      }
    }
    const amount = items.reduce((a, i) => a + i.amount, 0);
    roots.push({ id: section.id, label: section.label, amount, items });
  }
  return { roots, total: roots.reduce((a, r) => a + r.amount, 0) };
}

/**
 * Oracle: every section root must equal the publisher's OWN printed subtotal.
 *
 * This is the §5.2 rule — a check external to the write path. `total = sum of
 * items` would be tautological; `total = DCA's own TTL_* cell` is not.
 *
 * ⚠ Sections whose `total` key is null (Part II) are skipped here and covered by
 * the page cross-check instead. A skipped check must be REPORTED, never counted
 * as a pass — session 3's zero-row parse reported itself green.
 */
export function checkSectionTotals(tree, blocks, sections) {
  const checks = [];
  for (const section of sections) {
    const root = tree.roots.find((r) => r.id === section.id);
    if (!root) continue;
    const scope = scopedLookup(blocks, SECTION_BLOCKS[section.id]);
    let expected = 0;
    let found = 0;
    let errored = null;
    for (const key of section.totalKeys) {
      if (isErrorValue(scope[key])) { errored = key; break; }
      if (key in scope) { found++; expected += num(scope[key]); }
    }
    if (errored) {
      // ⚠ Reported, never counted as a pass. A subtotal cell that is #REF! means
      // the oracle CANNOT run for this section, which is a different and louder
      // thing than the section being fine.
      checks.push({ id: section.id, skipped: true, reason: `subtotal ${errored} is an Excel error cell` });
      continue;
    }
    if (!found) {
      checks.push({ id: section.id, skipped: true, reason: `none of ${section.totalKeys.join('/')} present` });
      continue;
    }
    checks.push({
      id: section.id,
      expected,
      actual: root.amount,
      ok: Math.abs(expected - root.amount) <= 0.005,
    });
  }
  return checks;
}

/**
 * Oracle the PART-level rollups, not just the sections.
 *
 * Section checks alone would miss a form whose sections each tie but whose Part
 * total does not equal their sum. Cheap, and one level further up the form's own
 * arithmetic than the section subtotals.
 *
 * ⚠ `TTL_OSR` ("Own Source Revenues") is Part I + Part III ONLY — it excludes
 * Part II intergovernmental by the form's own definition. Treating it as the
 * revenue grand total would understate every entity by its state and federal
 * money.
 */
export function checkPartTotals(tree, blocks) {
  const r1 = blocks._R1 || {};
  const r3 = blocks._R3 || {};
  const amt = (id) => tree.roots.find((r) => r.id === id)?.amount ?? 0;
  const checks = [];
  const part1 = amt('1A') + amt('1B') + amt('1C') + amt('1D');
  const part3 = amt('3A') + amt('3B');
  if ('TTL_Part1' in r1) {
    checks.push({ id: 'Part I', expected: num(r1.TTL_Part1), actual: part1,
      ok: Math.abs(num(r1.TTL_Part1) - part1) <= 0.005 });
  }
  if ('TTL_Part3' in r3) {
    checks.push({ id: 'Part III', expected: num(r3.TTL_Part3), actual: part3,
      ok: Math.abs(num(r3.TTL_Part3) - part3) <= 0.005 });
  }
  if ('TTL_OSR' in r3) {
    checks.push({ id: 'Own Source (I+III)', expected: num(r3.TTL_OSR), actual: part1 + part3,
      ok: Math.abs(num(r3.TTL_OSR) - (part1 + part3)) <= 0.005 });
  }
  return checks;
}

/**
 * Assert the transcribed item lists still cover the form.
 *
 * Every money-bearing key in a section's block must be either mapped by this
 * module or explicitly known-and-excluded. A form that adds a line would
 * otherwise just drop it — money vanishing with every gate still green, which is
 * the failure shape session 3 shipped against.
 *
 * @returns {Array<{section:string,key:string,amount:number}>} unmapped keys holding money
 */
export function checkItemCoverage(blocks, sections, itemsFor, suffixes) {
  const orphans = [];
  for (const section of sections) {
    const scope = scopedLookup(blocks, SECTION_BLOCKS[section.id]);
    const mapped = new Set();
    for (const item of itemsFor(section.id)) {
      mapped.add(item);
      for (const s of suffixes) mapped.add(`${item}${s}`);
    }
    for (const [key, raw] of Object.entries(scope)) {
      if (mapped.has(key)) continue;
      if (key === 'CICOID' || key === 'Fyear') continue;
      if (key.startsWith('TTL_') || key.startsWith('TTl_')) continue;
      if (isErrorValue(raw)) continue; // an error cell holds no money to map
      const amount = num(raw);
      if (amount === 0 || Number.isNaN(amount)) continue;
      orphans.push({ section: section.id, key, amount });
    }
  }
  return orphans;
}
