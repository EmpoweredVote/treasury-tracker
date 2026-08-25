/**
 * The City of Inglewood, CA fiscal calendar, and the guards that let it be
 * written to `treasury.budgets.fiscal_year_start_month` without guessing.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!` (a CRLF checkout
 * turns `#!/usr/bin/env node\r` into an unresolvable interpreter path and every
 * test in the importing file vanishes behind a position-less SyntaxError).
 *
 * ── The defect this exists to correct ────────────────────────────────────────
 * `public.treasury_sync_city_budget` INSERTs a literal `7` for
 * `fiscal_year_start_month` (it takes no parameter for it), so every row every
 * CA loader has created asserts a July–June fiscal year. Inglewood closes on
 * **September 30**, so its year starts in **October (10)**.
 *
 * SCOPE-04's loader gate asserted `fiscal_year_start_month === 7` and all 7,664
 * rows passed — it validated conformity to the hardcode, not correctness. No
 * arithmetic gate can see this: the column moves no dollar, so every tie test
 * stays at $0 while the period the figures describe is wrong by a quarter.
 *
 * ── Why the month is ASSERTED here, not DERIVED ──────────────────────────────
 * `scripts/fixAcfrFiscalYearStartMonth.mjs` derives the month from each row's
 * own `source_date`, because those loaders stamped it with the fiscal-year END.
 * That method cannot be reused here and must not be: the SCO rows carry
 * `source_date = 2026-06-16`, the date the SCO API was FETCHED. It is neither a
 * month end nor within the row's own fiscal year, so the derivation guards
 * reject it — correctly. Deriving a fiscal calendar from a fetch date would
 * invent one.
 *
 * A hardcode is what caused this defect, so the one replacing it shows its work.
 *
 * ── Evidence ────────────────────────────────────────────────────────────────
 * City of Inglewood ACFR FY2020-2021, cover page, read from the PDF itself:
 *
 *     CITY OF INGLEWOOD, CALIFORNIA
 *     ANNUAL COMPREHENSIVE FINANCIAL REPORT
 *     FOR THE YEAR ENDED SEPTEMBER 30, 2021
 *
 *   https://www.cityofinglewood.org/Archive.aspx?ADID=1037   (live, first-party)
 *   indexed from https://www.cityofinglewood.org/342/Financial-Reports
 *
 * Corroborated twice over: the city's FY2022 single audit report is titled "CITY
 * OF INGLEWOOD, CALIFORNIA SEPTEMBER 30, 2022 SINGLE AUDIT REPORT"
 * (https://www.cityofinglewood.org/Archive.aspx?ADID=1093), and SCOPE-04 found
 * independently that Inglewood's derived figures match a September year exactly.
 *
 * ⚠ Do NOT infer the month from the archive INDEX page. It labels the documents
 * "2020-2021 Inglewood ACFR" and states no month, and that hyphenated form reads
 * as the July–June convention to humans and summarisers alike — a WebFetch of
 * that page during this work confidently answered "likely June 30". The month
 * has to come off the document's own cover page.
 */

/** The entity. Name alone is not enough — see `IN_SCOPE` and guard (a). */
export const ENTITY = { name: 'Inglewood', state: 'CA' };

/** Sep 30 year end -> Oct 1 start -> 10. */
export const CORRECT_MONTH = 10;

/** The known-wrong hardcode this replaces. */
export const HARDCODED_MONTH = 7;

/**
 * Months this corpus can legitimately produce, cross-checked against the 2025
 * NASBO State Expenditure Report in the repo root: Dec 31 -> 1, Mar 31 -> 4,
 * Jun 30 -> 7, Aug 31 -> 9, Sep 30 -> 10.
 */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * In-scope `data_source` labels, enumerated exactly rather than pattern-matched.
 * A future Inglewood load under a new label must be checked against its own
 * document, not swept in by a prefix nobody validated it against.
 */
export const IN_SCOPE = new Set([
  'CA State Controller - Expenditures',
  'CA State Controller - Revenues',
  'Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)',
  'Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)',
]);

/**
 * Labels this fix must never touch.
 *
 * Inglewood's 16 `salaries` rows come from publicpay.ca.gov (Government
 * Compensation in California), which reports by CALENDAR year — the GCC report
 * for the previous calendar year is due each April 30 — so their correct value
 * is 1, neither 10 nor 7. That is a different defect with a different value:
 * 7,682 rows across 482 entities, every one at 7. Fixing one entity's 16 rows
 * here would half-fix a table-wide defect and hide its size, so it is excluded
 * loudly (reaching the update set is an ABORT, not a skip) and logged for its
 * own pass.
 *
 * ⚠ Consequence: Inglewood carries TWO start months afterwards — 10 for its
 * SCO/derived rows, 7 for its salaries rows. A per-entity single-month assertion
 * (the guard `fixAcfrFiscalYearStartMonth.mjs` uses) would flag that, and would
 * be WRONG to. An entity has one fiscal calendar, but a calendar-year
 * compensation dataset genuinely does not share it. Per-entity consistency holds
 * within a dataset family, not across them.
 */
export const EXCLUDED = /publicpay|compensation in california/i;

/**
 * 22 SCO expenditure + 22 SCO revenue (FY2003-FY2024) + 8 + 8 derived Total
 * Governmental (FY2017-FY2024). Checked before any write: if the row set has
 * moved, the scope needs re-reading, not forcing.
 */
export const EXPECTED_ROWS = 60;

/**
 * Classify one row for the fix. Pure, so every guard is testable without a
 * database. Returns `{ action: 'update', month }`, `{ action: 'correct' }`, or
 * `{ error }` — and an error is always an abort, never a skip.
 */
export function classify(row) {
  if (EXCLUDED.test(row.data_source)) {
    return { error: `excluded source reached the update set: "${row.data_source}"` };
  }
  if (!IN_SCOPE.has(row.data_source)) {
    return { error: `out-of-scope data_source: "${row.data_source}"` };
  }
  if (!ALLOWED_MONTHS.has(CORRECT_MONTH)) {
    return { error: `target month ${CORRECT_MONTH} outside allowed set` };
  }
  // ⚠ Nullish is rejected BEFORE Number(), which turns both null and '' into 0 —
  // an integer that would sail past the check below and be reported as "stored
  // month 0", blaming a value the column never held.
  const raw = row.fiscal_year_start_month;
  if (raw === null || raw === undefined || raw === '') {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  const stored = Number(raw);
  if (!Number.isInteger(stored)) {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  if (stored === CORRECT_MONTH) return { action: 'correct' };
  // A third value means something else has been writing this column and this
  // fix's premise no longer holds — stop rather than overwrite it.
  if (stored !== HARDCODED_MONTH) {
    return { error: `stored month ${stored} is neither ${HARDCODED_MONTH} nor ${CORRECT_MONTH}` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}
