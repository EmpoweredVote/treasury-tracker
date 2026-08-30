/**
 * Pennsylvania DCED Municipal Statistics — Annual Audit and Financial Report.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Parses the two STATEWIDE extracts into TT budget trees, and runs the in-file
 * checks. Input is .xlsx converted from DCED's legacy BIFF8 .xls by
 * `scripts/tools/xlsToXlsx.py` — the same fetch-stage conversion session 4 built
 * for Georgia, because ExcelJS cannot open BIFF8 at all.
 *
 * ── ⚠⚠ THE TWO REPORTS ARE DIFFERENT REPORTS ────────────────────────────────
 *
 * `StatewideMuniAfr`   2,572 rows x  71 cols   'Municipality Name'
 * `StatewideCountyAfr`    67 rows x 128 cols   'MUNICIPALITY NAME' (uppercase)
 *
 * They share no column names and cannot share a parser. This is R4 in the
 * campaign spec, and Ohio already burned TT once on exactly this
 * (`project_ohio_aos_county_vs_city_layout`). Verified independently here.
 *
 * ── ⚠⚠ SCOPE DIFFERS BETWEEN THEM, AND IT IS READ NOT INFERRED ──────────────
 *
 * MUNICIPAL is ALL FUNDS. Enterprise activity is folded into `Total Revenues`
 * with line items proving it (Philadelphia carries Water $478,492,062 and Sewer
 * $343,180,320 for FY2023). There is no removable enterprise subtotal, so the
 * campaign's §2.3 enterprise exclusion CANNOT be applied — these rows are
 * all-funds or nothing. Chris's call 2026-08-29: load as published and flag,
 * the WeHo precedent. No derived governmental subtotal, because the six
 * enterprise columns may not exhaust proprietary funds and a confidently wrong
 * "governmental" total is worse than an honest all-funds one.
 *
 * COUNTY is GOVERNMENTAL FUNDS — its columns say so, and it reports Proprietary,
 * Internal Service and Fiduciary funds in separate column blocks that this
 * loader deliberately does not read.
 *
 * ── ⚠⚠ A PUBLISHED SUBTOTAL THAT DOES NOT SUM ITS OWN COLUMNS ───────────────
 *
 * `Governmental Funds- Total Miscellaneous Revenues` (col 30) is NOT the sum of
 * cols 25-29 that sit under it. For Centre County FY2023 the gap is
 * $13,312,294 — exactly `Charges for Service` (col 25), which is a SIBLING of
 * Miscellaneous, not a child, despite appearing above the subtotal.
 *
 * Verified across ALL 63 approved county rows for 2023, zero exceptions:
 *     Total Revenues = Taxes + Intergovernmental + Charges for Service + Misc
 *     Total Miscellaneous = Interest + Rents + Private Contributions + Other
 *
 * Reading the columns positionally — treating everything between the header and
 * the subtotal as its children — misparents $13.3M while the GRAND TOTAL still
 * ties. That is the Georgia lesson in a new shape: a subtotal tie is NECESSARY
 * BUT NOT SUFFICIENT, and here the subtotal itself is the liar.
 *
 * ── ⚠ `Total Taxes Revenues` DISAGREES WITH ITS DETAIL IN 139 OF 2,395 ──────
 *
 * 5.8% of approved 2023 municipal rows have `Total Taxes Revenues` != the sum of
 * the ten tax columns beneath it, while `Total Revenues` still ties (the grand
 * total is built from the SUBTOTAL, not the detail). Neither Philadelphia nor
 * State College is affected in any loaded year — checked, not assumed — but
 * `checkMuni()` asserts it per row so a future year cannot slip through.
 */

import ExcelJS from 'exceljs';

/** Cents-level tolerance. These files are whole dollars; this is float slack. */
const EPS = 0.5;

export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'object' && v.result !== undefined) return num(v.result);
  const s = String(v).replace(/[$,\s]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ⚠ AN EXCEL ERROR CELL MUST NEVER BECOME A NUMBER.
 *
 * Georgia's corpus carried 1,851 error cells and xlrd returns the error CODE, so
 * `#REF!` reads as the plausible dollar amount 23, `#DIV/0!` as 7, `#VALUE!` as
 * 15, `#N/A` as 42. The PA 2023 files contain zero error cells — measured — but
 * the guard stays, because "absent today" is not "cannot happen".
 */
export function assertNotError(cell, where) {
  const v = cell?.value ?? cell;
  if (v && typeof v === 'object' && 'error' in v) {
    throw new Error(`Excel error cell ${JSON.stringify(v.error)} at ${where}`);
  }
  if (typeof v === 'string' && /^#(REF|DIV\/0|VALUE|N\/A|NAME\?|NULL!|NUM!)/.test(v.trim())) {
    throw new Error(`Excel error text ${JSON.stringify(v)} at ${where}`);
  }
  return v;
}

/**
 * Normalise a published header for matching.
 * ⚠ DCED's headers contain typos and at least two non-UTF8 bytes that survive
 * conversion as U+FFFD: "Real Eastate Taxes", "Derpeciation", "Inernal",
 * "Descrease", `Proprietary� Funds`, `TL Net Position-� Year End`.
 * Matching on the exact published string is therefore brittle; matching on a
 * normalised form is not. The typos are the PUBLISHER'S and must not be "fixed"
 * in the mapping, or the mapping stops matching the file.
 */
export function normHeader(s) {
  return String(s ?? '')
    .replace(/�/g, ' ')
    .replace(/’/g, "'")
    // ⚠ DCED is inconsistent about the space after its own separator:
    // `Governmental Funds- General Government` but `Governmental Funds-Corrections`,
    // and `Governmental Fund-Revenues` drops the plural entirely. Collapsing
    // space around the dash is what makes one mapping match every column.
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Read a worksheet into `{header: [...], rows: [[...]]}` with error-cell guards. */
export async function readSheet(path) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`No worksheet in ${path}`);
  const header = [];
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row, i) => {
    const arr = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      arr[c - 1] = assertNotError(cell, `${path} r${i}c${c}`);
    });
    if (i === 1) header.push(...arr.map((h) => (h === undefined ? '' : h)));
    else rows.push(arr);
  });
  return { header, rows, path };
}

/** Build a normalised-header -> index map, refusing duplicates. */
export function indexHeader(header) {
  const ix = new Map();
  header.forEach((h, i) => {
    const k = normHeader(h);
    if (!k) return;
    if (ix.has(k)) throw new Error(`Duplicate column ${JSON.stringify(h)}`);
    ix.set(k, i);
  });
  return ix;
}

/**
 * Resolve a column by normalised name.
 * ⚠ Throws rather than returning undefined. A missing column that silently reads
 * as 0 is the WeHo defect — three of four mappings named columns that did not
 * exist and the load still "worked".
 */
export function col(ix, name) {
  const k = normHeader(name);
  if (!ix.has(k)) throw new Error(`Column not found: ${JSON.stringify(name)}`);
  return ix.get(k);
}

// ── MUNICIPAL layout ────────────────────────────────────────────────────────

export const MUNI_REVENUE_TREE = [
  {
    label: 'Taxes',
    subtotal: 'Total Taxes Revenues',
    children: [
      'Real Estate Tax Revenues', 'Earned Income Tax Revenues',
      'Realty Transfer Tax Revenues', 'Local Services Tax Revenues',
      'Per Capita Tax Revenues', 'Occupational Tax Revenues',
      'Business Gross Receipts Tax Revenues',
      'Amusement and Admissions Tax Revenues',
      'Mechanical Device Tax Revenues', 'All Other Taxes Revenues',
    ],
  },
  {
    label: 'Intergovernmental Revenues',
    children: [
      'Intergovernmental Revenues-Federal Government',
      'Intergovernmental Revenues-State Government',
      'Intergovernmental Revenues-Local Government',
    ],
  },
  {
    // ⚠ Sewer/Water/Solid Waste/Electric/Gas/Parking are ENTERPRISE activity.
    // They are kept because the municipal report is all-funds and there is no
    // way to remove them without inventing a total the source does not publish.
    label: 'Charges for Services',
    children: [
      'Sewer Revenues', 'Water Revenues', 'Solid Waste Revenues',
      'Electric System Revenues', 'Gas System Revenues', 'Parking Revenues',
      'Culture and Recreation Revenues', 'Other Charges for Services Revenues',
    ],
  },
  {
    label: 'Licenses, Permits and Franchise Fees',
    children: ['Licenses and Permits Revenues', 'Cable TV Franchise Fees Revenues'],
  },
  { label: 'Fines and Forfeits', children: ['Fines and Forfeits Revenues'] },
  { label: 'Interest, Rents and Royalties', children: ['Interest Rents and Royalties Revenues'] },
  {
    label: 'Contributions and Donations from Private Sectors',
    children: ['Contributions and Donations from Private Sectors Revenues'],
  },
  { label: 'Unclassified Operating Revenues', children: ['Unclassified Operating Revenues'] },
  // ⚠⚠ `Other Financing Sources Revenues` is DELIBERATELY ABSENT — see
  // MUNI_FINANCING_COLUMNS below. It is inside DCED's `Total Revenues`.
];

/**
 * ── ⚠⚠ FINANCING FLOWS, EXCLUDED SO THE CAMPAIGN STAYS COMPARABLE ──────────
 *
 * DCED's MUNICIPAL `Total Revenues` INCLUDES `Other Financing Sources` — 14.5%
 * of the total for both Philadelphia ($1,785,924,110) and State College
 * ($9,713,196) in FY2023. DCED's COUNTY report does NOT: there, interfund
 * transfers, proceeds from long-term debt, refunds of bonds and sales of capital
 * assets sit in a separate block outside `Governmental Funds- Total Revenues`.
 *
 * So the publisher itself defines the county series as operating-only and the
 * municipal series as operating-plus-financing. Loading both as published would
 * ship two incomparable scopes in one session, and neither would match TT's
 * existing Florida rows, where session 3 excluded revenue 38x/39x including 384
 * Debt Proceeds.
 *
 * Chris's call 2026-08-30: normalise everything to OPERATING flows. For the
 * municipal report that is one clean column on each side, so the exclusion is
 * exact and reversible rather than an estimate.
 *
 * ⚠ The operating total is therefore `published total - financing column`, and
 * `checkRow()` asserts the remaining tree sums to exactly that. The published
 * headline is never discarded silently — it is the thing the check is against.
 */
export const MUNI_FINANCING_COLUMNS = {
  revenue: 'Other Financing Sources Revenues',
  operating: 'Other Financing Uses Expenditures',
};

export const MUNI_EXPENDITURE_TREE = [
  { label: 'General Government', children: ['General Government Expenditures'] },
  {
    label: 'Public Safety',
    children: [
      'Police Expenditures', 'Fire Expenditures',
      'UCC and Code Enforcement Expenditures', 'Other Public Safety Expenditures',
    ],
  },
  { label: 'Health and Human Services', children: ['Health and Human Services Expenditures'] },
  {
    label: 'Public Works',
    children: [
      'Public Works-Highways and Streets Expenditures', 'Sewer Expenditures',
      'Water Expenditures', 'Solid Waste Expenditures',
      'Electrical System Expenditures', 'Gas System Expenditures',
      'Other Public Works Expenditures',
    ],
  },
  {
    label: 'Culture and Recreation',
    children: ['Culture and Recreation Expenditures', 'Libraries Expenditures'],
  },
  { label: 'Community Development', children: ['Community Development Expenditures'] },
  { label: 'Debt Service', children: ['Debt Service Expenditures'] },
  { label: 'Other Expenditures', children: ['Other Expenditures'] },
  { label: 'Unclassified Operating Expenditures', children: ['Unclassified Operating Expenditures'] },
  // ⚠⚠ `Other Financing Uses Expenditures` DELIBERATELY ABSENT — see
  // MUNI_FINANCING_COLUMNS.
];

// ── COUNTY layout ───────────────────────────────────────────────────────────

const G = 'Governmental Funds- ';

export const COUNTY_REVENUE_TREE = [
  {
    label: 'Taxes',
    subtotal: `${G}Total Taxes`,
    children: [
      // ⚠ "Real Eastate" is the PUBLISHER'S typo. Do not correct it.
      `${G}Real Eastate Taxes`, `${G}Hotel Taxes`, `${G}Per Capita`,
      `${G}Occupation`, `${G}Sales`, `${G}Other`,
    ],
  },
  {
    label: 'Intergovernmental Revenues',
    subtotal: `${G}Total Intergov't Revenues`,
    children: [
      `${G}Intergovernmental Revenues- Federal`,
      `${G}Intergovernmental Revenues- State`,
      `${G}Intergovernmental Revenues- Local Government Units`,
      `${G}Intergovernmental Revenues- Combination`,
    ],
  },
  // ⚠⚠ A SIBLING OF MISCELLANEOUS, NOT A CHILD — see the header block.
  { label: 'Charges for Service', children: [`${G}Charges for Service`] },
  {
    label: 'Miscellaneous Revenues',
    subtotal: `${G}Total Miscellaneous Revenues`,
    children: [
      `${G}Interest Earnings`, `${G}Rents`,
      `${G}Private Contributions and Donations`,
      `${G}Other Miscellaneous Revenues`,
    ],
  },
];

export const COUNTY_EXPENDITURE_TREE = [
  {
    label: 'General Government',
    children: [`${G}General Government- Administrative`, `${G}General Government- Judicial`],
  },
  { label: 'Public Safety', children: [`${G}Public Safety`] },
  { label: 'Corrections', children: [`${G}Corrections`] },
  { label: 'Highway and Streets', children: [`${G}Highway and Streets`] },
  { label: 'Sanitation', children: [`${G}Sanitation`] },
  { label: 'Health and Welfare', children: [`${G}Health and Welfare`] },
  { label: 'Culture and Recreation', children: [`${G}Culture- Recreation`] },
  { label: 'Conservation', children: [`${G}Conservation`] },
  {
    label: 'Community and Economic Development',
    children: [
      `${G}Community/Urban Redevelopment and Housing`,
      `${G}Economic Development and Assistance`,
      `${G}Economic Opportunity`,
    ],
  },
  { label: 'Debt Service', children: [`${G}Debt Service`] },
  { label: 'Capital Outlay', children: [`${G}Capital Outlay`] },
  { label: 'Other Expenditures', children: [`${G}Other Expenditures`] },
];

/**
 * Build a `{n, a, c}` tree from a spec and a row.
 * A child worth 0 is dropped; a parent whose children are all 0 and whose own
 * amount is 0 is dropped. Nothing is invented.
 */
export function buildTree(spec, row, ix) {
  const roots = [];
  let total = 0;
  const checks = [];
  for (const node of spec) {
    const kids = node.children
      .map((name) => ({ n: prettyLabel(name), a: num(row[col(ix, name)]) }))
      .filter((k) => k.a !== 0);
    const sum = kids.reduce((a, k) => a + k.a, 0);
    let amount = sum;
    if (node.subtotal) {
      const published = num(row[col(ix, node.subtotal)]);
      checks.push({ id: node.label, expected: published, actual: sum, diff: published - sum });
      // ⚠ The PUBLISHED subtotal is authoritative for the parent, because the
      // grand total is built from it. A detail/subtotal disagreement is REPORTED
      // (and refused by the caller), never silently papered over.
      amount = published;
    }
    if (amount === 0 && kids.length === 0) continue;
    total += amount;
    roots.push(kids.length > 1 ? { n: node.label, a: amount, c: kids }
      : { n: node.label, a: amount });
  }
  return { roots, total, checks };
}

/** Strip the publisher's suffixes so the UI shows a human label. */
export function prettyLabel(name) {
  return String(name)
    .replace(/^Governmental Funds-\s*/i, '')
    .replace(/\s+(Revenues|Expenditures)$/i, '')
    .replace(/�/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when DCED marks the filing approved. Blank means NOT FILED. */
export function isApproved(status) {
  return String(status ?? '').trim().toUpperCase() === 'A';
}

/**
 * Run every in-file check for one row and return them all.
 * ⚠ Returns the checks; it does not decide. The loader refuses on any failure —
 * a gate that can measure nothing must fail, not pass (session 3).
 */
export function checkRow({ tree, publishedTotal, label }) {
  const out = tree.checks.map((c) => ({ ...c, ok: Math.abs(c.diff) <= EPS, kind: 'subtotal' }));
  out.push({
    id: `${label} total`, kind: 'total',
    expected: publishedTotal, actual: tree.total,
    diff: publishedTotal - tree.total,
    ok: Math.abs(publishedTotal - tree.total) <= EPS,
  });
  return out;
}

export { EPS };
