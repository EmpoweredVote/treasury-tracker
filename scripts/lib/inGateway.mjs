/**
 * Indiana Gateway (IFI / DLGF / SBOA) — Annual Financial Report extracts.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Parses the statewide pipe-delimited AFR downloads into TT budget trees.
 *
 * ── ⚠⚠ THREE REPORTS, THREE COLUMN ORDERS ──────────────────────────────────
 *
 * Gateway's AFR branch serves several reports and they do NOT share a layout:
 *
 *   Detailed Receipts          year|cnty_cd|cnty_description|...
 *   Disbursements by Fund      year|cnty_cd|cnty_description|...   (same)
 *   Disbursements by Fund and
 *     Department               year|cnty_description|cnty_cd|...   (TRANSPOSED)
 *
 * `cnty_cd` and `cnty_description` swap places in the by-department report, and
 * `unit_name` moves too. A positional parser would read a county NAME as a
 * county CODE and still "work". **Everything here is parsed by header name.**
 *
 * ── ⚠⚠ THE BY-DEPARTMENT REPORT IS GENERAL FUND ONLY ────────────────────────
 *
 * "Disbursements by Fund and Department" is NOT the expenditure counterpart of
 * "Detailed Receipts". Gateway's own explainer says departmental detail is
 * provided "for counties (General Fund and Motor Vehicle Highway Fund) and
 * cities and towns (General Fund)" — measured for Fort Wayne FY2023 it carries
 * exactly ONE fund ($129,840,788) against 105 funds and $523,127,046 on the
 * receipts side.
 *
 * Pairing them would have filed General Fund expenditures against all-fund
 * revenues — a 4x scope mismatch that ties against its own subtotals the whole
 * way and is invisible downstream. **This loader uses "Disbursements by Fund"**,
 * which is all-funds and shares the receipts layout.
 *
 * ── ⚠⚠ SETTLEMENT FUNDS ARE EXCLUDED, ON STRUCTURAL EVIDENCE ────────────────
 *
 * Indiana counties collect property tax for EVERY taxing unit in the county and
 * settle it out to them. That flow lands in Gateway `Fund_code` 106000 and is
 * enormous: $9.66 BILLION statewide in FY2023, $799,271,207 for Lake County
 * alone — 50% of its apparent revenue.
 *
 * It is a pass-through, and three independent facts say so:
 *   1. SBOA's own chart-of-accounts guidance — "Settlement Funds: Settlement of
 *      Property Tax, Excise Tax, & Special Assessments … ONLY USED FOR
 *      SETTLEMENT" (Auditors' Funds and Chart of Accounts, NEO 2024, in.gov/sboa).
 *   2. Gateway's own account names — receipts are `General Property Taxes`;
 *      disbursements are `Distributions to Other Governmental Entities`.
 *   3. It nets to nothing: Lake FY2023 took in $799,271,207 and paid out
 *      $799,270,607 — a $600 difference on $799M.
 *
 * ⚠⚠ AND IT IS NOT REPORTED CONSISTENTLY: 60 of 92 counties carry it, 32 do not.
 * Loading it as published would make Lake County appear to raise far more per
 * capita than Allen County purely because of a presentation difference a reader
 * cannot see. Chris's call 2026-08-30: exclude it; leave Payroll Clearing
 * (105100) and Clerk Trust (100006) IN, because the Gateway-code-to-SBOA-class
 * mapping for those is inference rather than the publisher's own word.
 *
 * ⚠⚠ NEITHER CODE ALONE NOR NAME ALONE IS ENOUGH — see `isSettlementFund`.
 * A name-only rule drops Lake's `Settlement` but keeps Allen's `TAX SETTLEMENT`
 * (and wrongly drops `Monsanto Class Action Settlement`). A code-only rule keeps
 * Lake FY2022, which Gateway renumbered from 106000 to 900334. Both failure
 * modes were observed in this corpus, and the second survived 11,283 passing
 * oracle checks. The rule is the usual code OR an exact name match, corroborated
 * per entity-year by `assertSettlementIsPassThrough()`.
 *
 * ── ⚠ `fund_scope` IS READ, NOT INFERRED ────────────────────────────────────
 *
 * Gateway's file-layout documentation defines `ent_id` as "Numeric code for an
 * enterprise" and `ent_name` as "Enterprise name". Governmental activity carries
 * the literal `Governmental Activities`; utilities carry their own names.
 *
 * ⚠ Those names are FREE TEXT and inconsistent — `WATER` / `Water` /
 * `WATER UTILITY`, `WASTEWATER` / `Wastewater`, plus one-off entities like
 * `GSD` (Gary Sanitary District). **Whitelist the exact governmental label.
 * Never blacklist the utilities**, or the next spelling silently becomes
 * governmental revenue.
 */

/** Gateway's usual code for Settlement funds — the property-tax pass-through. */
export const SETTLEMENT_FUND_CODE = '106000';

/**
 * ── ⚠⚠ `Fund_code` IS NOT STABLE ACROSS YEARS ──────────────────────────────
 *
 * Lake County's settlement fund is `106000` in every year of the window EXCEPT
 * FY2022, where the SAME fund, with the SAME name and a magnitude sitting neatly
 * between its neighbours ($735,638,546 against $733,654,569 in FY2021 and
 * $799,271,207 in FY2023), is renumbered **900334**.
 *
 * ⚠⚠ A CODE-ONLY RULE MISSED IT AND EVERY ORACLE STILL PASSED. 11,283 of 11,283
 * fund-level checks tied against Cash and Investments while Lake County FY2022
 * carried $735M of pass-through it should not have. The oracle proves the READ;
 * it cannot prove the SCOPE. This is the Georgia lesson — a tie is NECESSARY BUT
 * NOT SUFFICIENT — in its most expensive form yet.
 *
 * Statewide, 19 distinct `Fund_code`s carry a fund named exactly "settlement";
 * $84.9B sits under 106000 and $5.5B under the other eighteen. The renumbering
 * is normal Gateway behaviour, not a Lake County quirk.
 *
 * ⚠ A NAME-ONLY RULE IS ALSO WRONG. The corpus contains `Health Dept Tobacco
 * Settlement`, `Commissioners' Monsanto Class Action Settlement`, `The
 * Assessor's Settlement Fund` and `Excess Monies - Settlement 2001` — all real
 * revenue. Every one is a LONGER name, so an EXACT match is safe where a
 * substring match is not.
 *
 * ⚠ A "disbursements are mostly D703 (Distributions to Other Governmental
 * Entities)" rule was tested and REJECTED as far too broad — it also catches
 * Storm Sewer, Wheel Tax, Airport, Library Bonds and Township Firefighting,
 * which is a much larger exclusion than the one that was agreed.
 *
 * So: the usual code, OR an exact name match. Corroborated per entity-year by
 * `assertSettlementIsPassThrough()`, since a settlement fund's defining property
 * is that what comes in goes straight back out.
 */
const SETTLEMENT_EXACT_NAMES = new Set(['settlement', 'tax settlement']);

export function isSettlementFund(fundCode, fundName) {
  if (String(fundCode).trim() === SETTLEMENT_FUND_CODE) return true;
  return SETTLEMENT_EXACT_NAMES.has(String(fundName ?? '').trim().toLowerCase());
}

/**
 * A settlement fund takes money in and pays it straight back out. Lake County
 * FY2023 received $799,271,207.07 and disbursed $799,270,607.06 — $600 apart on
 * $799M. If an excluded "settlement" fund does NOT behave that way, the
 * identification is wrong and the load must stop rather than quietly remove real
 * money.
 */
export function assertSettlementIsPassThrough(revenue, operating, label, tolerance = 0.02) {
  const r = revenue.settlementTotal;
  const d = operating.settlementTotal;
  const scale = Math.max(Math.abs(r), Math.abs(d));
  if (scale === 0) return { ok: true, r, d, drift: 0 };
  const drift = Math.abs(r - d) / scale;
  if (drift > tolerance) {
    throw new Error(
      `REFUSING ${label}: funds excluded as settlement do not behave as a pass-through — `
      + `received ${r.toFixed(2)}, disbursed ${d.toFixed(2)} (${(drift * 100).toFixed(1)}% apart). `
      + 'Either the identification is wrong or this is not a settlement fund.');
  }
  return { ok: true, r, d, drift };
}

/**
 * ── ⚠⚠ NON-OPERATING FLOWS, EXCLUDED BY SBOA CODE — NEVER BY NAME ──────────
 *
 * Chris's call 2026-08-30: normalise every Knight row to OPERATING flows, so
 * these entities are comparable with PA counties (whose report already excludes
 * financing sources) and with TT's existing Florida rows (session 3 excluded
 * revenue 38x/39x including 384 Debt Proceeds).
 *
 * Three families, each with the publisher's own label or netting behind it:
 *
 *   transfers    R910 / D704   "Transferred from/to Another Fund" — a within-
 *                              entity movement counted on BOTH sides. FL's
 *                              object code 90 and the GA form's Part X are the
 *                              same exclusion.
 *   interfund
 *     loans      R911 R912 / D705 D706   borrowing between an entity's own funds.
 *   borrowings   R903 R904     tax anticipation warrants and other debt
 *                              proceeds. This is the LA TRAN defect —
 *                              `project_la_city_series_severed`, where $4.77B of
 *                              TRAN borrowing was reported as spending.
 *   investments  R901 / D900   portfolio churn. Gateway itself does not treat
 *                              these as receipts or disbursements: its Cash and
 *                              Investments report is explicitly "net of
 *                              investment transactions".
 *
 * ⚠⚠ MATCH THE CODE, UPPERCASED, NOT THE NAME. Three near-misses proved why:
 *   - `Settlement` (Lake) vs `TAX SETTLEMENT` (Allen) — same Fund_code 106000.
 *   - `Transfer In` vs the actual `Transfers In` (plural) — a name pattern
 *     silently missed $789,783,682.
 *   - **`d704` appears in lowercase** alongside `D704`, worth $455,000. A
 *     case-sensitive code match drops it.
 * And matching names would OVER-exclude too: `R913 Other Receipts` carries
 * locally-described items such as "Wheel Tax Bond Road Improvement" ($4,000,000)
 * and `R503` carries "Bond Maintenance Fee" — neither is debt proceeds, but any
 * rule keyed on "Bond" would have removed both.
 */
export const NON_OPERATING_RECEIPT_CODES = new Set([
  'R901', // Sale of Investments
  'R903', // Proceeds from Tax Anticipation Warrants
  'R904', // Proceeds from Borrowings other than Tax Anticipation Warrants
  'R910', // Transfers In - Transferred from Another Fund
  'R911', // Interfund Loans - Borrowed from Another Fund
  'R912', // Interfund Loans - Repayment from Another Fund
]);

export const NON_OPERATING_DISBURSE_CODES = new Set([
  'D704', // Transfer Out - Transferred To Another Fund
  'D705', // Interfund Loan - Loaned To Another Fund
  'D706', // Interfund Loan - Repaid To Another Fund
  'D900', // Purchase of Investments
]);

/**
 * Codes the CASH AND INVESTMENTS oracle nets out, and only those.
 * ⚠ The oracle must compare like with like: Gateway's `r_bal`/`d_bal` are net of
 * investment transactions but DO include transfers and borrowings. Proving the
 * READ and choosing the SCOPE are two different jobs.
 */
export const INVESTMENT_RECEIPT_CODES = new Set(['R901']);
export const INVESTMENT_DISBURSE_CODES = new Set(['D900']);

/** The exact `ent_name` that means "not an enterprise". Whitelist, never blacklist. */
export const GOVERNMENTAL_ENT_NAME = 'Governmental Activities';

/** Split a pipe-delimited Gateway line. Trailing pipe yields a final empty field. */
export function splitLine(line) {
  const parts = line.split('|');
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/**
 * Build a header-name -> index map.
 * ⚠ Case-insensitive because Gateway is inconsistent about it across reports
 * (`Receipt_Class_Name` vs `class_name`, `Fund_code` vs `fund_code`).
 */
export function headerIndex(headerLine) {
  const ix = new Map();
  splitLine(headerLine).forEach((h, i) => {
    const k = h.trim().toLowerCase();
    if (k && !ix.has(k)) ix.set(k, i);
  });
  return ix;
}

/** Resolve a column, throwing rather than silently reading undefined as 0. */
export function need(ix, ...names) {
  for (const n of names) {
    const k = n.trim().toLowerCase();
    if (ix.has(k)) return ix.get(k);
  }
  throw new Error(`Column not found: ${names.join(' / ')}`);
}

export function money(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) throw new Error(`Non-numeric amount ${JSON.stringify(v)}`);
  return n;
}

export function pad(v, width) {
  return String(v ?? '').trim().padStart(width, '0');
}

/**
 * Stream one Gateway file, calling `onRow(row)` for every data line.
 * Files reach 127 MB, so this reads line-wise rather than into one string.
 */
export async function eachRow(path, onRow) {
  const { createReadStream } = await import('node:fs');
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  let ix = null;
  let n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (ix === null) { ix = headerIndex(line); continue; }
    onRow(splitLine(line), ix);
    n++;
  }
  if (ix === null) throw new Error(`${path} had no header line`);
  return { rows: n, ix };
}

/**
 * Accumulate one entity's figures from a Gateway file.
 *
 * Returns BOTH the loaded subset and the full governmental parse, because the
 * oracle must prove the READ before the subset is trusted — session 3's rule:
 * "Oracle the FULL parse to prove the read; load a documented SUBSET. Never
 * widen the tree to close the gap."
 */
export function makeAccumulator({ entity, year, kind }) {
  const isReceipts = kind === 'revenue';
  const tree = new Map();      // class -> Map(name -> amount)
  // ⚠ byFund holds the CASH-COMPARABLE parse (full, less investment codes) so it
  // can be checked against Gateway's own `r_bal`/`d_bal`, which are net of
  // investment transactions. It is the ORACLE's number, not the loaded number.
  const byFund = new Map();
  const nonOperating = new Map(); // code -> amount, reported so nothing is silent
  let subsetTotal = 0;
  let fullTotal = 0;
  let settlementTotal = 0;
  let rows = 0;

  const dropCodes = isReceipts ? NON_OPERATING_RECEIPT_CODES : NON_OPERATING_DISBURSE_CODES;
  const investCodes = isReceipts ? INVESTMENT_RECEIPT_CODES : INVESTMENT_DISBURSE_CODES;
  const codeField = isReceipts ? 'receipt_code' : 'disburse_code';

  return {
    consume(r, ix) {
      if (String(r[need(ix, 'year')]).trim() !== String(year)) return;
      if (pad(r[need(ix, 'cnty_cd')], 2) !== entity.countyCode) return;
      if (pad(r[need(ix, 'unit_code')], 4) !== entity.unitCode) return;
      // ⚠ Exact whitelist. See the header note on free-text enterprise names.
      if (String(r[need(ix, 'ent_name')]).trim() !== GOVERNMENTAL_ENT_NAME) return;

      const amt = money(r[need(ix, 'amount')]);
      const fundCode = String(r[need(ix, 'fund_code')]).trim();
      const fundNo = String(r[need(ix, 'unit_fund_number')] ?? '').trim();
      // ⚠⚠ UPPERCASE. `d704` exists alongside `D704`.
      const code = String(r[need(ix, codeField)]).trim().toUpperCase();

      rows++;
      fullTotal += amt;
      if (!investCodes.has(code)) {
        const fk = `${fundCode}|${fundNo}`;
        byFund.set(fk, (byFund.get(fk) ?? 0) + amt);
      }

      const fundName = String(r[need(ix, 'fund_name')] ?? '');
      if (isSettlementFund(fundCode, fundName)) { settlementTotal += amt; return; }
      if (dropCodes.has(code)) {
        nonOperating.set(code, (nonOperating.get(code) ?? 0) + amt);
        return;
      }

      subsetTotal += amt;
      const cls = String(r[need(ix, isReceipts ? 'receipt_class_name' : 'class_name')]).trim()
        || 'Unclassified';
      const leaf = String(r[need(ix, isReceipts ? 'receipt_name' : 'disburse_name')]).trim()
        || 'Unclassified';
      if (!tree.has(cls)) tree.set(cls, new Map());
      const kids = tree.get(cls);
      kids.set(leaf, (kids.get(leaf) ?? 0) + amt);
    },
    result() {
      return { tree, byFund, subsetTotal, fullTotal, settlementTotal, nonOperating, rows };
    },
  };
}

/** Convert the accumulator's nested Maps to the `{n, a, c}` shape the RPC wants. */
export function toTree(map) {
  const roots = [];
  for (const [cls, kids] of map) {
    const children = [...kids]
      .filter(([, a]) => a !== 0)
      .map(([n, a]) => ({ n, a }))
      .sort((x, y) => y.a - x.a);
    const amount = children.reduce((a, k) => a + k.a, 0);
    if (amount === 0 && children.length === 0) continue;
    roots.push(children.length > 1 ? { n: cls, a: amount, c: children } : { n: cls, a: amount });
  }
  return roots.sort((x, y) => y.a - x.a);
}

/**
 * ⚠⚠ A GATE THAT CAN MEASURE NOTHING MUST FAIL, NOT PASS.
 *
 * Session 3's loader passed ExcelJS Cell objects where values were expected, 30,189
 * rows parsed to nothing, the verifier counted 0 checks and printed "Oracle
 * green". Every accumulator here is asserted to have seen rows before its
 * numbers are believed.
 */
export function assertParsed(res, label) {
  if (!res || res.rows === 0) {
    throw new Error(`REFUSING ${label}: parsed 0 rows. Nothing was measured, so nothing is verified.`);
  }
  if (res.fullTotal === 0) {
    throw new Error(`REFUSING ${label}: parsed ${res.rows} rows totalling $0.`);
  }
  return res;
}
