/**
 * The publicpay.ca.gov (GCC) reporting calendar, and the guards that let it be
 * written to `treasury.budgets.fiscal_year_start_month` without guessing.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 * `public.treasury_sync_city_budget` INSERTed a literal `7` for
 * `fiscal_year_start_month` (fixed 2026-08-25, PR #61 — but every row it had
 * already created keeps the wrong value). So all 7,682 GCC salaries rows across
 * 482 CA entities assert a July–June fiscal year.
 *
 * They are CALENDAR-year data. Every one of them is wrong.
 *
 * This is the sibling defect deliberately left out of the Inglewood fix (PR #60):
 * writing Inglewood's 16 salaries rows to 10 would have swapped one wrong value
 * for another and hidden the size of this one. See [[project_scope_04_next]].
 *
 * ── Evidence ────────────────────────────────────────────────────────────────
 * SCO, "Government Compensation in California (GCC) reporting instructions",
 * calendar year 2025, read from the PDF itself:
 *
 *   "the Government Compensation in California (GCC) reporting instructions
 *    FOR CALENDAR YEAR 2025"
 *
 *   "The intent of the report is to capture pay and benefit information for
 *    every compensated employee who received a W-2 ... IN CALENDAR YEAR 2025"
 *
 *   "Each row represents an employee who received a W-2 FOR THE CALENDAR YEAR"
 *
 *   "report only the position that the employee held at the end of the
 *    REPORTING CALENDAR YEAR"
 *
 *   https://gcc.sco.ca.gov/Reporting/Instructions/2025_ReportingInstructions.pdf
 *
 * The document contains ZERO occurrences of "fiscal year" — there is no
 * fiscal-year reporting option for an employer to elect. And the report is
 * W-2-based, which is definitionally a calendar year: a W-2 covers January 1 to
 * December 31 regardless of the employer's own fiscal calendar. That is why this
 * value does NOT vary by entity, and why it does not follow the entity's ACFR.
 *
 * Corroborated by our own loader, which knew all along:
 * `scripts/loadCASalaries.js` documents `@param {number} year Calendar year
 * (2009–2024)` and fetches `gcc.sco.ca.gov/RawExport/{YEAR}_City.zip`, passing
 * that same year as `p_fiscal_year`. So a row's `fiscal_year` IS a calendar year
 * running January–December, and its start month is 1.
 *
 * ⚠ This is a per-DATASET fact, not a per-entity one. Inglewood's SCO rows are an
 * October year (its ACFR closes September 30) while these salaries rows are a
 * calendar year, and both are correct simultaneously. Per-entity single-month
 * consistency holds WITHIN a dataset family, never across families — any guard
 * asserting one month per `municipality_id` would flag this and be wrong to.
 */

/** The GCC reporting year runs Jan 1 – Dec 31. */
export const CORRECT_MONTH = 1;

/** The known-wrong value the sync RPC hardcoded. */
export const HARDCODED_MONTH = 7;

/** Months this corpus can legitimately produce. */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * The ONE in-scope `data_source`, matched exactly rather than by pattern.
 *
 * ⚠ Note the EM DASH after "Controller" and the EN DASH-free rest of the string;
 * this label is compared with `===`, so a visually similar hyphen will simply
 * fail to match and the script will report 0 rows rather than write the wrong
 * ones. That is the intended failure direction.
 */
export const IN_SCOPE_SOURCE =
  'CA State Controller — Government Compensation in California (publicpay.ca.gov)';

/** Belt and braces: the label is salaries-only, and we assert it too. */
export const IN_SCOPE_DATASET = 'salaries';

/**
 * Labels that must never be touched by this fix, though they are also
 * `dataset_type='salaries'` and also sit at month 7. Each has its OWN calendar
 * and its own evidence, and none of it is established here:
 *
 *   Transparent Utah    179 rows, 15 entities  (Utah's own FY, not a W-2 year)
 *   LA City Payroll      10 rows,  1 entity
 *   LA County (ArcGIS / Open Data)  5 rows
 *
 * Reaching the update set is an ABORT, not a skip, so widening the scope cannot
 * silently sweep them in.
 */
export const EXCLUDED_SOURCES = [
  'Transparent Utah',
  'LA City Payroll',
  'LA County Open Data - Employee Salaries',
];

/**
 * Rows measured in scope at sweep time (2026-08-25): 7,682 across 482 entities,
 * FY2009–FY2024.
 *
 * ⚠ This is a DRIFT DETECTOR for this one-time sweep, not an invariant. Since
 * PR #61 a new GCC row inherits its month from this family, so once this sweep
 * lands, future loads correctly arrive at 1 and the count grows legitimately.
 * `--verify` therefore asserts the MONTH on every in-scope row and only warns
 * when the count has moved.
 */
export const SWEEP_ROWS = 7682;
export const SWEEP_ENTITIES = 482;

/**
 * Classify one row. Pure, so every guard is testable without a database.
 * Returns `{ action: 'update', month }`, `{ action: 'correct' }`, or `{ error }`
 * — and an error is always an abort, never a skip.
 */
export function classify(row) {
  if (EXCLUDED_SOURCES.includes(row.data_source)) {
    return { error: `excluded source reached the update set: "${row.data_source}"` };
  }
  if (row.data_source !== IN_SCOPE_SOURCE) {
    return { error: `out-of-scope data_source: "${row.data_source}"` };
  }
  if (row.dataset_type !== IN_SCOPE_DATASET) {
    return { error: `expected dataset_type "${IN_SCOPE_DATASET}", got "${row.dataset_type}"` };
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
