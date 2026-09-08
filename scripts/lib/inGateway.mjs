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
 * ACROSS EACH GOVERNMENT'S WHOLE SERIES by
 * `assertSettlementSeriesIsPassThrough()` — not per year, because the December/
 * January settlement straddles the year end.
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
 * So: the usual code, OR an exact name match. Corroborated by
 * `assertSettlementSeriesIsPassThrough()`, since a settlement fund's defining
 * property is that what comes in goes straight back out — measured over the
 * SERIES, since the property-tax settlement crosses the year end.
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
 *
 * ── ⚠⚠ THE IDENTITY HOLDS ACROSS THE SERIES, NOT WITHIN ONE YEAR ────────────
 *
 * This gate was written per entity-year and it refused the statewide load:
 *
 *   REFUSING Greene County FY2024: funds excluded as settlement do not behave as
 *   a pass-through — received 29,101,078.42, disbursed 29,829,410.08 (2.4% apart)
 *
 * The gate was RIGHT to fire and the identification was right too. Property tax
 * is collected in December and settled in January, so a county's settlement fund
 * straddles the year end. Measured over the whole 2011-2025 extract
 * (`scripts/inSettlementSeriesProbe.py`):
 *
 *   county-years reporting a settlement fund   1,219
 *   over the 2% tolerance PER YEAR                38   (3.1%)
 *   counties reporting settlement                 92
 *   over the 2% tolerance PER SERIES               1   (Parke, 2.57%)
 *   city/town-years reporting settlement           0   — this gate only ever
 *                                                       bites counties
 *
 * The 38 come in EQUAL AND OPPOSITE PAIRS across adjacent years — Scott FY2023
 * +9,193,538.46 against FY2024 -9,193,538.46, exactly offsetting; Owen FY2014 /
 * FY2015 $30 apart on $6.26M. Per series, 88 of 92 counties tie within 0.1%.
 *
 * ⚠⚠ This is the $735M `Fund_code` lesson in a second form: READ THE SERIES FOR
 * CONTINUITY. A single-year window cannot see a flow that crosses the year end,
 * and it will keep refusing correct data forever.
 *
 * ── ⚠⚠ WHAT THIS GATE MUST NOT BECOME: THE CASH IDENTITY ────────────────────
 *
 * Parke County's entire residue sits in Gateway's OWN Cash and Investments
 * report as a closing balance, which makes `receipts - disbursements ==
 * cash_bal - beg_cash_inv` look like a stronger, exact replacement for this
 * tolerance. IT IS A TAUTOLOGY. Measured over every governmental county fund
 * (`scripts/inSettlementCashIdentityProbe.py`):
 *
 *   settlement funds  identity holds on 1,212 / 1,212 = 100.00%
 *   ORDINARY funds    identity holds on 175,164 / 176,484 =  99.25%
 *
 * Ordinary revenue satisfies it just as well, so it cannot tell a settlement
 * fund from real money and cannot do this gate's job. The Austin rule: a tie
 * that is necessary but not sufficient. The pass-through property — in equals
 * out — is the only DISCRIMINATING signal, so that is what is asserted here.
 */

/**
 * ── EXACT DECLARED RESIDUES, ONE GOVERNMENT AT A TIME ───────────────────────
 *
 * ⚠⚠ THE FIX IS NOT A WIDER TOLERANCE. 2% -> 3% would admit Parke and silence
 * every future case at the same time. A residue admits exactly one government
 * for exactly one measured, corroborated reason, and anything else still
 * refuses.
 *
 * Keyed `cnty_cd|unit_code` — the key the loader itself uses. NOT the unit name:
 * two governments sharing a name would silently merge into one series.
 *
 * `residue` is disbursed minus received, in dollars, over the whole series.
 */
export const SETTLEMENT_SERIES_RESIDUES = new Map([
  ['61|0000', {
    name: 'PARKE COUNTY',
    residue: -5_221_953.81,
    // in $203,327,806.75 / out $198,105,852.94 over FY2012-2025, drift 2.57%.
    why: 'Parke closed FY2025 still holding the money: it received 18,071,815.85 '
      + 'and disbursed 12,824,664.03, and Gateway\'s own Cash and Investments '
      + 'report — a DIFFERENT report — carries cash_bal 5,247,151.79 for the same '
      + 'fund in the same year, which is that gap to three cents. Every other '
      + 'year of the series ties exactly, and each smaller residue reappears as '
      + 'the next year\'s beg_cash_inv (FY2014\'s 3,471.29 is FY2015\'s opening '
      + 'balance). Undistributed settlement cash, in the publisher\'s own words, '
      + 'not a misidentified fund.',
  }],
]);

/** Fractional drift between the two sides of a pass-through. 0 when both are 0. */
export function settlementDrift(r, d) {
  const scale = Math.max(Math.abs(r), Math.abs(d));
  return scale === 0 ? 0 : Math.abs(r - d) / scale;
}

/**
 * Assert the pass-through identity over a government's WHOLE settlement series.
 *
 * `entry` is `{ countyCode, unitCode, r, d }` — settlement receipts and
 * disbursements summed across every year the extract holds, regardless of which
 * year is being loaded.
 *
 * ⚠ A declared residue is checked whenever one exists, not only when the drift
 * is over tolerance. A registry entry that no longer describes the data is a
 * stale exemption, and the guard-shape lesson from #143 is that a guard nobody
 * re-checks is the one that lets the next defect through. If Parke settles the
 * money in FY2026 this refuses and asks a human to re-measure.
 */
export function assertSettlementSeriesIsPassThrough(entry, label, {
  tolerance = 0.02, residues = SETTLEMENT_SERIES_RESIDUES, epsilon = 1.0,
} = {}) {
  const { countyCode, unitCode, r, d } = entry;
  const drift = settlementDrift(r, d);
  const residue = d - r;
  const key = `${countyCode}|${unitCode}`;
  const declared = residues.get(key);

  if (declared) {
    if (Math.abs(residue - declared.residue) > epsilon) {
      throw new Error(
        `REFUSING ${label}: its declared residue no longer matches the data — `
        + `declared ${declared.residue.toFixed(2)}, measured ${residue.toFixed(2)} `
        + `(received ${r.toFixed(2)}, disbursed ${d.toFixed(2)}). `
        + 'Re-measure with scripts/inSettlementSeriesProbe.py and either update '
        + 'the declaration with a reason or remove it. Do NOT widen the tolerance.');
    }
    return { ok: true, r, d, drift, residue, residueDeclared: true };
  }

  if (drift > tolerance) {
    throw new Error(
      `REFUSING ${label}: funds excluded as settlement do not behave as a pass-through `
      + `ACROSS THE SERIES — received ${r.toFixed(2)}, disbursed ${d.toFixed(2)} `
      + `(${(drift * 100).toFixed(1)}% apart). Either the identification is wrong or this `
      + 'is not a settlement fund. A single year straddling the December/January '
      + 'settlement is expected and is reported, not refused; a whole series that does '
      + 'not net out is not.');
  }
  return { ok: true, r, d, drift, residue, residueDeclared: false };
}

/**
 * Accumulate every in-scope government's settlement series while the big files
 * are already being streamed.
 *
 * ⚠⚠ WHY THIS IS NOT JUST A LOOP OVER THE ACCUMULATORS: the loader refuses a
 * 15-year run because 39,600 accumulators over 443 MB exhausts the heap, so the
 * statewide sweep is driven one `--fy` at a time. A series assertion that only
 * saw the loaded year would be the per-year gate wearing a new name. This holds
 * TWO NUMBERS per government-year instead of a tree, so all 660 governments x 15
 * years cost ~10,000 small objects and the pass count does not change.
 *
 * ⚠ Governments with no settlement fund never appear as keys. That is not an
 * omission — measured, 0 of 568 cities and towns report one, so for them the
 * gate is silence rather than a pass, and `result()` says so by absence.
 */
export function makeSettlementSeriesIndex(entities) {
  const inScope = new Map();
  for (const e of entities) inScope.set(`${e.countyCode}|${e.unitCode}`, e);
  const out = new Map();

  return {
    consume(r, ix, kind) {
      const key = `${pad(r[need(ix, 'cnty_cd')], 2)}|${pad(r[need(ix, 'unit_code')], 4)}`;
      const entity = inScope.get(key);
      if (!entity) return;
      // ⚠ Exact whitelist. A utility's settlement is not the government's.
      if (String(r[need(ix, 'ent_name')]).trim() !== GOVERNMENTAL_ENT_NAME) return;
      const fundCode = String(r[need(ix, 'fund_code')]).trim();
      const fundName = String(r[need(ix, 'fund_name')] ?? '');
      // ⚠⚠ The SAME rule the accumulator excludes by — code OR exact name — so
      // the gate measures exactly the money the load removes. Two rules would
      // let the gate bless a set the loader never dropped.
      if (!isSettlementFund(fundCode, fundName)) return;

      const year = String(r[need(ix, 'year')]).trim();
      const amt = money(r[need(ix, 'amount')]);
      let entry = out.get(key);
      if (!entry) {
        entry = {
          countyCode: entity.countyCode, unitCode: entity.unitCode, name: entity.name,
          r: 0, d: 0, byYear: new Map(),
        };
        out.set(key, entry);
      }
      if (!entry.byYear.has(year)) entry.byYear.set(year, { r: 0, d: 0 });
      const side = kind === 'revenue' ? 'r' : 'd';
      entry[side] += amt;
      entry.byYear.get(year)[side] += amt;
    },
    result() { return out; },
  };
}

/**
 * The per-year drift, as a REPORT rather than a gate.
 *
 * ⚠ Demoting the per-year check must not mean deleting the signal. 38 county-
 * years drift over 2% and a reader deserves to see which ones and by how much —
 * the pairs are what show it is a timing difference rather than a bad read.
 *
 * ── ⚠⚠ `oneSided` IS A DIFFERENT FINDING AND IS REPORTED APART ──────────────
 *
 * The December/January timing story is proven by EQUAL AND OPPOSITE pairs in
 * adjacent years. A year carrying money on only ONE side is not that, and
 * conflating them hid the biggest thing in this corpus:
 *
 *   Marion County FY2024   settlement in $0.00   out $71,482,508.88
 *
 * Marion's settlement fund ran $1.05-1.85 BILLION a year from 2011 to 2023. Its
 * FY2024 filing carries a $71.5M fragment, and its NET receipts fall from
 * $1,558,918,179.86 to $607,214,107.07 — a 61% collapse that persists into
 * FY2025, with ~$950M of NON-settlement receipts missing as well. The series
 * gate passes Marion and is right to: the pass-through identity holds. So the
 * one-sided year is the ONLY signal, and it must not read as routine drift.
 */
export function settlementPerYearDrift(entry, { tolerance = 0.02 } = {}) {
  const rows = [];
  for (const [year, { r, d }] of entry.byYear ?? new Map()) {
    const drift = settlementDrift(r, d);
    // ⚠ Exactly one side empty. Both-empty is silence, not a finding.
    const oneSided = (r === 0) !== (d === 0);
    rows.push({ year, r, d, delta: d - r, drift, over: drift > tolerance, oneSided });
  }
  rows.sort((a, b) => String(a.year).localeCompare(String(b.year)));
  return rows;
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
