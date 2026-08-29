/**
 * Florida DFS LOGERx Annual Financial Report — parsing and tree construction.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Pure functions over an already-open ExcelJS worksheet: no network, no
 * database, no filesystem. Everything here is exercised by
 * tests/floridaDfs.test.mjs against fixtures.
 *
 * ── THE WORKBOOK SHAPE ──────────────────────────────────────────────────────
 *
 * Every public detail report has a single sheet named `output`:
 *
 *   row 1  title, e.g. "Expenditure Details for Fiscal Year 2023, as of ..."
 *   row 2  blank
 *   row 3  column headers
 *   row 4+ data
 *
 * Expenditure columns: Code | Name | Account | Object Code | <12 fund columns>
 * Revenue columns:     Code | Name | Account | Dwelling Type | Fee Type | <12 funds>
 *
 * ⚠ Several fund headers carry TRAILING SPACES in the published file
 * ("Permanent ", "Enterprise  ", "Private Purpose "). Headers are trimmed on
 * read; matching on the raw string silently finds nothing and every fund reads
 * as zero — a defect that would tie at $0 against nothing.
 */

/**
 * The twelve fund columns, grouped by GASB fund category.
 *
 * Governmental funds are the campaign's scope (spec §2.3 excludes enterprise
 * funds "where the source separates them", and this source separates them by
 * column). The other groups are named here because the ORACLE needs them.
 */
export const FUND_GROUPS = {
  governmental: ['General', 'Special Revenue', 'Debt Service', 'Capital Projects', 'Permanent'],
  proprietary: ['Enterprise', 'Internal Service'],
  fiduciary: ['Custodial', 'Pension', 'Trust', 'Private Purpose'],
  componentUnits: ['Component Units'],
};

/** The scope TT loads: `fund_scope = 'total_governmental'`. */
export const GOVERNMENTAL_FUNDS = FUND_GROUPS.governmental;

/**
 * ⚠ The fund set DFS's own `TOTALREVEXPDEBT` report sums — everything EXCEPT
 * the four fiduciary columns.
 *
 * This was not assumed, it was SOLVED. For each of the seven session-3 entities
 * the FY2023 `Total Revenues` and `Total Expenditures` were matched against
 * every possible subset of the twelve fund columns; the smallest subset that
 * reproduces each figure exactly is this one in every case (entities with $0 in
 * Permanent / Enterprise / Internal Service / Component Units match a shorter
 * list, which is the same set with empty columns dropped).
 *
 * This is what makes an independent oracle possible at all: DFS publishes a
 * total computed outside the detail report, and our parse of the detail report
 * must reproduce it to the cent.
 */
export const ORACLE_FUNDS = [
  ...FUND_GROUPS.governmental,
  ...FUND_GROUPS.proprietary,
  ...FUND_GROUPS.componentUnits,
];

/**
 * ⚠⚠ OBJECT CODE 90 IS NOT AN EXPENDITURE, AND IT IS INSIDE THE DFS TOTAL.
 *
 * Florida's Uniform Accounting System Manual defines object 90 "Other Uses" as
 * sub-objects 91–99, of which 91 is "INTRAGOVERNMENTAL TRANSFERS — All monies
 * exchanged within the same governmental entity ... includes 381/581 InterFund
 * Group Transfers as well as 386/586 Intra-Governmental Transfers."
 *
 * The same manual defines the expenditure side, verbatim: "Expenditures are
 * defined in a governmental fund accounting context as all decreases in fund net
 * assets — for current operations, capital outlay or debt service — EXCEPT THOSE
 * ARISING FROM OPERATING AND RESIDUAL EQUITY TRANSFERS TO OTHER FUNDS."
 *
 * So the publisher itself says transfers are not expenditures. Including object
 * 90 would double-count money that is spent once and merely moves between funds
 * — the West Hollywood `fund_scope: 'unknown'` hazard, and the class of error
 * that once let $4.77B of Los Angeles TRAN borrowing read as spending. Ohio's
 * loader excludes Other Financing Uses for exactly this reason (D-04b).
 *
 * ⚠ CONSEQUENCE FOR THE ORACLE: the DFS total INCLUDES object 90, so the loaded
 * tree deliberately does NOT tie to it. The oracle is run over the FULL parse
 * (all object codes, ORACLE_FUNDS) to prove every figure was read correctly; the
 * loaded tree is then a documented subset of an oracled parse. Do not "fix" the
 * oracle by putting object 90 back into the tree.
 */
export const EXCLUDED_OBJECT_CODE = '90';

/**
 * ⚠⚠ REVENUE ACCOUNTS 38x AND 39x ARE NOT REVENUE, AND THEY ARE INSIDE THE
 * DFS TOTAL.
 *
 * The UAS Manual, verbatim:
 *
 *   "38x.xxx OTHER SOURCES — Amounts received by the entity, WHICH ARE NOT
 *    ADDITIONS TO ASSETS OF THE ENTITY AS A WHOLE, although they may be to the
 *    receiving fund. These items include Intra governmental transfers and
 *    reimbursements."
 *
 *   "39x.xxx PROPRIETARY NON-OPERATING SOURCES ... Amounts received by the
 *    entity, which are not additions to assets of the entity as a whole ...
 *    These items include interfund transfers and interfund reimbursements."
 *
 * The 38x block also holds 383.100 Lease Proceeds, 383.200 Installment Purchase
 * Proceeds, **384.000 Debt Proceeds** and **385.000 Proceeds From Refunding
 * Bonds**. Counting borrowing as revenue is precisely the Los Angeles FY2026
 * defect, where $4.77B of TRAN borrowing was published as spending.
 *
 * 392/393 (Extraordinary and Special Items) are genuine gains rather than
 * transfers, but they sit inside the block DFS itself labels non-operating
 * sources; the whole block is excluded so the rule is one line the publisher
 * wrote rather than a hand-curated list of exceptions.
 */
export const EXCLUDED_REVENUE_ACCOUNT_RE = /^3[89]\d/;

/** Sheet name, header row and first data row, shared by every detail report. */
export const SHEET_NAME = 'output';
export const HEADER_ROW = 3;
export const DATA_START_ROW = 4;

/**
 * Coerce a cell to a finite number, or null.
 *
 * The published workbooks store money as integers, but blanks arrive as `''`
 * and a formula cell arrives as `{result: n}`. Anything that is not a finite
 * number becomes null so a caller can tell "absent" from "zero".
 */
export function cellNum(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && 'result' in value) return cellNum(value.result);
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Trimmed text, or '' — never null, so `.startsWith` is always safe. */
export function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object' && 'result' in value) return cellText(value.result);
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((p) => p.text).join('').trim();
  }
  return String(value).trim();
}

/**
 * One cell's VALUE from a row.
 *
 * ⚠ Never pass an ExcelJS `Cell` straight into `cellText`/`cellNum`. A Cell
 * carries a `result` property (undefined unless the cell holds a formula), so
 * `'result' in cell` is TRUE for every cell and the `{result: n}` branch below
 * returns `undefined` — which reads as an empty cell. The first run of this
 * loader parsed 30,189 rows into ZERO rows that way, and the verifier then
 * reported all seven entities as "not filed" and declared itself green. Hence
 * `assertParsed` below.
 */
export function rowValue(row, col) {
  return row.getCell(col).value;
}

/**
 * Read the header row into a Map of trimmed label -> 1-based column index.
 * ⚠ Trimming is load-bearing: three published fund headers have trailing spaces.
 */
export function readHeaders(worksheet) {
  const row = worksheet.getRow(HEADER_ROW);
  const map = new Map();
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const label = cellText(cell.value);
    if (label) map.set(label, col);
  });
  return map;
}

/**
 * Every data row of a detail workbook, as plain objects.
 *
 * A row is kept only when it has an entity `Code`; the title and blank rows have
 * none. Amounts are keyed by trimmed fund name.
 *
 * @returns {{code:string, name:string, account:string, objectCode:string, funds:Object<string,number>}[]}
 */
export function readDetailRows(worksheet) {
  const headers = readHeaders(worksheet);
  const codeCol = headers.get('Code');
  const nameCol = headers.get('Name');
  const acctCol = headers.get('Account');
  const objCol = headers.get('Object Code') ?? null;
  if (!codeCol || !nameCol || !acctCol) {
    throw new Error(`Detail sheet is missing Code/Name/Account headers (saw: ${[...headers.keys()].join(', ')})`);
  }

  const fundCols = [];
  for (const group of Object.values(FUND_GROUPS)) {
    for (const fund of group) {
      const col = headers.get(fund);
      if (col) fundCols.push([fund, col]);
    }
  }
  if (fundCols.length !== 12) {
    throw new Error(`Expected 12 fund columns, found ${fundCols.length}: ${fundCols.map((f) => f[0]).join(', ')}`);
  }

  const out = [];
  for (let r = DATA_START_ROW; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const code = cellText(rowValue(row, codeCol));
    if (!code) continue;
    const funds = {};
    for (const [fund, col] of fundCols) {
      const v = cellNum(rowValue(row, col));
      if (v != null && v !== 0) funds[fund] = v;
    }
    out.push({
      code,
      name: cellText(rowValue(row, nameCol)),
      account: cellText(rowValue(row, acctCol)),
      objectCode: objCol ? cellText(rowValue(row, objCol)) : '',
      funds,
    });
  }
  return out;
}

/**
 * A detail workbook that parses to ZERO rows is a broken parse, not an empty
 * year — the real files carry 25,000–36,000 rows each.
 *
 * ⚠ This guard exists because the opposite happened. When `readDetailRows`
 * silently returned nothing, the verifier reported every entity as "not filed",
 * counted zero checks, and printed "Oracle green". A gate that passes because it
 * measured nothing is worse than no gate: it is the CA-county `censusGuard()`
 * shape, where silence read as agreement.
 */
export function assertParsed(rows, label) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${label}: parsed 0 data rows — the workbook layout changed or the read is broken`);
  }
  return rows;
}

/** Sum one row's amounts over the named funds. */
export function sumFunds(funds, fundNames) {
  let s = 0;
  for (const f of fundNames) {
    const v = funds[f];
    if (typeof v === 'number') s += v;
  }
  return s;
}

/**
 * The independent oracle figure for one entity: every account, every object
 * code, summed over ORACLE_FUNDS. This is what DFS's `TOTALREVEXPDEBT` report
 * publishes, computed outside the detail report.
 */
export function oracleTotalFor(rows, code) {
  let s = 0;
  for (const r of rows) {
    if (r.code !== code) continue;
    s += sumFunds(r.funds, ORACLE_FUNDS);
  }
  return s;
}

/** `"511.00 - Legislative"` -> `"511.00"`. Returns '' when there is no code. */
export function accountCode(account) {
  const m = /^\s*([0-9][0-9.]*)\s*[-–]/.exec(account);
  return m ? m[1] : '';
}

/** `"90 - Other Uses"` -> `"90"`. Returns '' when there is no code. */
export function objectCodeOf(objectCode) {
  const m = /^\s*([0-9]+)\s*[-–]/.exec(objectCode);
  return m ? m[1] : '';
}

/**
 * The publisher's chart-of-accounts prefix, stripped for display.
 *
 *   "521.00 - Law Enforcement"   -> "Law Enforcement"
 *   "10 - Personnel Services"    -> "Personnel Services"
 *   "369.xxx - Other Misc..."    -> "Other Misc..."   (the `x` placeholders too)
 *
 * ⚠ THIS IS A DELIBERATE EXCEPTION TO TT'S TRANSCRIBE-VERBATIM HABIT, taken by
 * Chris on 2026-08-29. The rule exists because a *rewritten* label can drift from
 * the source it claims to quote; dropping a machine code is not a rewrite — it is
 * deterministic, reversible from the source workbook, and leaves the publisher's
 * own words untouched. It matters because these strings reach reader-facing prose:
 * "The biggest share was 521.00 - Law Enforcement" is not a sentence written for
 * the general public.
 *
 * ⚠ MEASURED, NOT ASSUMED. Across all 14 published years:
 *   - EXPENDITURE (170 distinct function + object labels): **0 collisions**.
 *   - REVENUE (320 distinct account labels): **7 colliding pairs**, every one the
 *     same category filed under two codes — a `.900`/`.xxx` catch-all pair, or two
 *     adjacent codes with identical names:
 *       324.720 / 324.920  Impact Fees - Commercial - Other
 *       324.710 / 324.910  Impact Fees - Residential - Other
 *       319.900 / 319.xxx  Other General Taxes
 *       369.900 / 369.xxx  Other Miscellaneous Revenues
 *       329.500 / 329.xxx  Other Permits, Fees And Special Assessments
 *       335.380 / 335.390  State Revenue Sharing - Other Physical Environment
 *       335.480 / 335.490  State Revenue Sharing - Other Transportation
 *
 * A collision MERGES the two into one node and sums them, which is right on the
 * merits and cannot move a total. It is still reported by the tree builders so a
 * merge is never silent — and **none of the seven session-3 entities triggers
 * one**: no colliding pair co-occurs in the same entity-year with a non-zero
 * governmental amount. The statewide sweep will hit them.
 *
 * ⚠ Every one of the 490 labels carries a code, so this never falls through to
 * the identity branch on real data. It is there so a future label without one is
 * kept whole rather than blanked.
 */
export const ACCOUNT_CODE_PREFIX_RE = /^\s*[0-9][0-9.x]*\s*[-–]\s*(?=\S)/;

export function stripAccountCode(label) {
  if (typeof label !== 'string') return '';
  const out = label.replace(ACCOUNT_CODE_PREFIX_RE, '').trim();
  return out || label.trim();
}

/** True for the interfund/other-uses object code excluded from the tree. */
export function isTransferObject(objectCode) {
  return objectCodeOf(objectCode) === EXCLUDED_OBJECT_CODE;
}

/** True for the 38x/39x "other sources" revenue accounts excluded from the tree. */
export function isTransferRevenueAccount(account) {
  return EXCLUDED_REVENUE_ACCOUNT_RE.test(accountCode(account));
}

/**
 * Build the two-level expenditure tree for one entity.
 *
 * function (`Account`) -> object code, summed over `funds` (default: the
 * governmental funds). Object code 90 is excluded — see EXCLUDED_OBJECT_CODE.
 *
 * Nodes use the nested `{n, a, c: [...]}` shape that `treasury_sync_city_budget`
 * persists (the MN OSA dialect), NOT the flat `{n, a}` Ohio emits.
 *
 * Labels have the publisher's chart-of-accounts prefix stripped for display —
 * see `stripAccountCode`, which records why that is not the same thing as
 * rewriting a label. `merged` reports any two source codes that collapsed onto
 * one display label, so a merge is never silent.
 *
 * @returns {{tree: Array, total: number, excludedTransfers: number, merged: string[]}}
 */
export function buildExpenditureTree(rows, code, funds = GOVERNMENTAL_FUNDS) {
  const byFunction = new Map();
  const rawByDisplay = new Map();
  let excludedTransfers = 0;

  const note = (raw) => {
    const d = stripAccountCode(raw);
    if (!rawByDisplay.has(d)) rawByDisplay.set(d, new Set());
    rawByDisplay.get(d).add(raw);
    return d;
  };

  for (const r of rows) {
    if (r.code !== code) continue;
    const amount = sumFunds(r.funds, funds);
    if (amount === 0) continue;
    if (isTransferObject(r.objectCode)) { excludedTransfers += amount; continue; }
    const fn = note(r.account);
    const obj = note(r.objectCode);
    if (!byFunction.has(fn)) byFunction.set(fn, new Map());
    const objs = byFunction.get(fn);
    objs.set(obj, (objs.get(obj) || 0) + amount);
  }

  const merged = [...rawByDisplay.entries()]
    .filter(([, raws]) => raws.size > 1)
    .map(([d, raws]) => `${d} <- ${[...raws].sort().join(' + ')}`);

  const tree = [];
  let total = 0;
  for (const [fn, objs] of byFunction) {
    const children = [...objs.entries()]
      .map(([n, a]) => ({ n, a }))
      .filter((c) => c.a !== 0)
      .sort((x, y) => y.a - x.a);
    if (children.length === 0) continue;
    const a = children.reduce((s, c) => s + c.a, 0);
    total += a;
    tree.push(children.length === 1 ? { n: fn, a } : { n: fn, a, c: children });
  }
  tree.sort((x, y) => y.a - x.a);
  return { tree, total, excludedTransfers, merged };
}

/**
 * Build the revenue tree for one entity.
 *
 * The revenue report has no object-code column, so this is a FLAT tree of
 * accounts — one node per revenue source. 38x/39x accounts are excluded; see
 * EXCLUDED_REVENUE_ACCOUNT_RE.
 *
 * @returns {{tree: Array, total: number, excludedTransfers: number, merged: string[]}}
 */
export function buildRevenueTree(rows, code, funds = GOVERNMENTAL_FUNDS) {
  const byAccount = new Map();
  const rawByDisplay = new Map();
  let excludedTransfers = 0;

  for (const r of rows) {
    if (r.code !== code) continue;
    const amount = sumFunds(r.funds, funds);
    if (amount === 0) continue;
    if (isTransferRevenueAccount(r.account)) { excludedTransfers += amount; continue; }
    const d = stripAccountCode(r.account);
    if (!rawByDisplay.has(d)) rawByDisplay.set(d, new Set());
    rawByDisplay.get(d).add(r.account);
    byAccount.set(d, (byAccount.get(d) || 0) + amount);
  }

  const tree = [...byAccount.entries()]
    .map(([n, a]) => ({ n, a }))
    .filter((n) => n.a !== 0)
    .sort((x, y) => y.a - x.a);
  const total = tree.reduce((s, n) => s + n.a, 0);
  const merged = [...rawByDisplay.entries()]
    .filter(([, raws]) => raws.size > 1)
    .map(([d, raws]) => `${d} <- ${[...raws].sort().join(' + ')}`);
  return { tree, total, excludedTransfers, merged };
}

// ── The totals report (the oracle) ──────────────────────────────────────────

/**
 * ⚠ `TOTALREVEXPDEBT` IS KEYED BY (Unit Type, Unit Name) AND CARRIES NO ENTITY
 * CODE. Florida has both a `County`/`Palm Beach` and a `City`/`Palm Beach`
 * (the Town of Palm Beach), so the type is not decoration — a name-only join
 * silently swaps a $3.9B county for a $90M town.
 *
 * @returns {Map<string, {revenues:number|null, expenditures:number|null, debt:number|null}>}
 *          keyed `"<Type>|<Name>"`.
 */
export function readTotalsRows(worksheet) {
  const headers = readHeaders(worksheet);
  const typeCol = headers.get('Unit Type');
  const nameCol = headers.get('Unit Name');
  const revCol = headers.get('Total Revenues');
  const expCol = headers.get('Total Expenditures');
  const debtCol = headers.get('Total Debt');
  if (!typeCol || !nameCol || !revCol || !expCol) {
    throw new Error(`Totals sheet is missing expected headers (saw: ${[...headers.keys()].join(', ')})`);
  }
  const map = new Map();
  for (let r = DATA_START_ROW; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const type = cellText(rowValue(row, typeCol));
    const name = cellText(rowValue(row, nameCol));
    if (!type || !name) continue;
    map.set(`${type}|${name}`, {
      revenues: cellNum(rowValue(row, revCol)),
      expenditures: cellNum(rowValue(row, expCol)),
      debt: debtCol ? cellNum(rowValue(row, debtCol)) : null,
    });
  }
  return map;
}

// ── The compliance reports (the audit flag) ─────────────────────────────────

/**
 * Read one compliance workbook into a per-entity audit record.
 *
 * ⚠⚠ BOTH REPORTS MUST BE READ AND UNIONED. `PUBLICCOMPLIANTGOVS` lists only
 * entities that filed within the statutory nine months; a late filer appears in
 * `PUBLICNONCOMPLIANTGOVS` instead — 571 of them in FY2023 — and those rows
 * carry audit dates just the same. Reading only the compliant report would grade
 * every late-but-audited government down to the unaudited branch.
 *
 * @returns {Map<string, {code:string, type:string, name:string, fye:string,
 *                        auditReceived:string, auditCompleted:string}>} keyed by entity code
 */
export function readComplianceRows(worksheet) {
  const headers = readHeaders(worksheet);
  const idCol = headers.get('EntityId');
  const typeCol = headers.get('Type');
  const nameCol = headers.get('Name');
  const fyeCol = headers.get('FYE');
  const arCol = headers.get('Audit Received Date');
  const acCol = headers.get('Audit Completion Date');
  if (!idCol || !nameCol) {
    throw new Error(`Compliance sheet is missing EntityId/Name (saw: ${[...headers.keys()].join(', ')})`);
  }
  const map = new Map();
  for (let r = DATA_START_ROW; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const code = cellText(rowValue(row, idCol));
    if (!code) continue;
    map.set(code, {
      code,
      type: typeCol ? cellText(rowValue(row, typeCol)) : '',
      name: cellText(rowValue(row, nameCol)),
      fye: fyeCol ? cellText(rowValue(row, fyeCol)) : '',
      auditReceived: arCol ? cellText(rowValue(row, arCol)) : '',
      auditCompleted: acCol ? cellText(rowValue(row, acCol)) : '',
    });
  }
  return map;
}

/** Union of the compliant and non-compliant maps; later entries do not overwrite earlier. */
export function mergeCompliance(...maps) {
  const out = new Map();
  for (const m of maps) {
    for (const [k, v] of m) if (!out.has(k)) out.set(k, v);
  }
  return out;
}

/**
 * Did this entity's AFR for this year reconcile against an AUDIT, or against the
 * Auditor General's Data Element Worksheet?
 *
 * DFS reconciles the AFR to "the provided audited financial statements OR Data
 * Element Worksheet" — the DEW branch is taken when no audit was performed. A
 * recorded audit date is the public, per-filing evidence that the first branch
 * applied.
 *
 * ⚠ An entity absent from BOTH compliance reports is `null`, not `false`. "We
 * have no record" is not "there was no audit", and a null must leave the row's
 * grade at `unknown` rather than assert the weaker branch.
 *
 * @returns {boolean|null}
 */
export function hasAuditOnFile(compliance, code) {
  const rec = compliance.get(code);
  if (!rec) return null;
  return Boolean(rec.auditReceived || rec.auditCompleted);
}
