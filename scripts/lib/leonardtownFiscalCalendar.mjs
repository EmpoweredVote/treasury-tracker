/**
 * The Town of Leonardtown, MD fiscal calendar — July–June — and the guards that
 * let its January rows be corrected.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── The last of the `DEFAULT 1` population, and a REAL defect ────────────────
 * Maryland was the one state left at the end of this arc that I had flagged as
 * SUSPECT rather than probably-fine, and it is the one that turned out to be
 * genuinely wrong. Washington, Indiana and Colorado were all already correct at 1
 * because their local governments really do run the calendar year (PRs #77, #78).
 * Leonardtown does not: it runs July–June, so its 6 budget rows and 6
 * `data_sources` rows have been asserting a fiscal year six months out.
 *
 * The cause is the same as everywhere else in this arc: `treasury.data_sources`
 * .fiscal_year_start_month was `NOT NULL DEFAULT 1`, `treasury_sync_budget_tree`
 * copies that value onto every budgets row it creates, and no Leonardtown loader
 * ever set it. Nothing failed, because the column moves no dollar — the tie tests
 * passed at $0 with the period wrong by half a year.
 *
 * ── Evidence: the charter itself, plus the town's own budget book ────────────
 * Charter of the Town of Leonardtown, § 703 "Fiscal year", verbatim, from the
 * Maryland General Assembly's official Municipal Charters of Maryland collection:
 *
 *     "The town shall operate on an annual budget. The fiscal year of the town
 *      shall begin on the first day of July in any year and shall end on the last
 *      day of June in the following year. The fiscal year constitutes the tax
 *      year, the budget year, and the accounting year."
 *
 *   https://mgaleg.maryland.gov/Pubs/LegisLegal/Muni-Charters/2022-municipal-charter-leonardtown.pdf
 *
 * Corroborated by the document our own figures were parsed from — "THE
 * COMMISSIONERS OF LEONARDTOWN / APPROVED BUDGET DOCUMENT / FISCAL YEAR 2023",
 * whose every page carries the running header:
 *
 *     "FISCAL YEAR JULY 1, 2022 - JUNE 30, 2023"
 *
 *   https://leonardtown.somd.com/pdf/Budget-FY2023.pdf
 *
 * That header is also what confirms the stored `fiscal_year` labels are
 * END-year: our FY2023 row corresponds to July 2022 – June 2023, which is exactly
 * what a start month of 7 means. The correction changes the period the figures
 * describe without touching the year they are filed under.
 *
 * ⚠ THE CHARTER IS THE GOVERNING INSTRUMENT, AND THIS DOES NOT GENERALISE.
 * Maryland municipal fiscal years come from each town's charter, the same way
 * California's charter cities set their own (Inglewood and Long Beach are both
 * October — PRs #60, #68). So "Maryland municipalities are July–June" is NOT
 * established by anything here; only Leonardtown is. A second Maryland town must
 * be read from its own charter before it can be loaded.
 *
 * ⚠ THE STATE OF MARYLAND IS OUT OF SCOPE, and already correct at 7 (the 2025
 * NASBO State Expenditure Report lists only NY, TX, AL and MI as exceptions to a
 * July 1 start). Its 8 rows are asserted unchanged rather than merely skipped.
 *
 * ⚠ Noted while gathering evidence, NOT fixed here: the FY2025 source URL stored
 * on two `data_sources` rows, https://leonardtown.somd.com/pdf/BudgetFY2025.pdf,
 * now returns 404, and the FY2024 PDF is image-only (pdftotext extracts nothing
 * from it — `column_mapping.pdf_type` already records it as 'scanned'). Neither
 * affects the month; both are separate provenance defects.
 */

/** ⚠ Keyed on (name, state). */
export const ENTITY = { name: 'Leonardtown', state: 'MD' };

/** July 1 start -> 7. */
export const CORRECT_MONTH = 7;

/** The silent column default that produced these rows. */
export const DEFAULT_MONTH = 1;

/** Months this corpus can legitimately produce. */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

export const AUTHORITY = 'Charter of the Town of Leonardtown § 703 (Municipal '
  + 'Charters of Maryland, mgaleg.maryland.gov): "The fiscal year of the town shall '
  + 'begin on the first day of July in any year and shall end on the last day of '
  + 'June in the following year." Corroborated by the town\'s own FY2023 Approved '
  + 'Budget Document, whose running header reads "FISCAL YEAR JULY 1, 2022 - '
  + 'JUNE 30, 2023".';

/**
 * In-scope `data_source` labels, enumerated exactly rather than pattern-matched.
 * A future Leonardtown load under a new label must be checked against its own
 * document, not swept in by a prefix nobody validated it against.
 *
 * ⚠ Note the label says "Operating Budget" for BOTH dataset types — the revenue
 * loader reuses the same name string (`processLeonardtownRevenue.js` builds
 * `Leonardtown Operating Budget FY${fy}` with `dataset_type: 'revenue'`). So the
 * three labels below cover all six budget rows, and matching on the label alone
 * cannot distinguish operating from revenue. That is fine here — both halves take
 * the same month — but it is why scope is (entity + label), never label alone.
 */
export const IN_SCOPE = new Set([
  'Leonardtown Operating Budget FY2023',
  'Leonardtown Operating Budget FY2024',
  'Leonardtown Operating Budget FY2025',
]);

/** Measured 2026-08-26, before any write. */
export const BASELINE = {
  budgetRows: 6,
  sourceRows: 6,
  protectedStateRows: 8,
};

function checkMonth(raw) {
  // ⚠ Nullish is rejected BEFORE Number(), which turns both null and '' into 0 —
  // an integer that would sail past the check below and be reported as "stored
  // month 0", blaming a value the column never held.
  if (raw === null || raw === undefined || raw === '') {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  const stored = Number(raw);
  if (!Number.isInteger(stored)) {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  if (stored === CORRECT_MONTH) return { action: 'correct' };
  if (stored !== DEFAULT_MONTH) {
    return { error: `stored month ${stored} is neither ${DEFAULT_MONTH} nor ${CORRECT_MONTH} — `
      + 'something else has written this column and this fix\'s premise no longer holds' };
  }
  return { action: 'update', month: CORRECT_MONTH };
}

function checkEntity(entity) {
  if (!entity || !entity.name || !entity.state) {
    return 'row has no entity {name,state}';
  }
  if (entity.name !== ENTITY.name || entity.state !== ENTITY.state) {
    return `wrong entity reached the update set: ${entity.name}, ${entity.state} `
      + `(expected ${ENTITY.name}, ${ENTITY.state})`;
  }
  return null;
}

/**
 * Classify one `budgets` row. Pure, so every guard is testable without a
 * database. Returns `{ action: 'update', month }`, `{ action: 'correct' }`, or
 * `{ error }` — and an error is always an abort, never a skip.
 */
export function classify(row) {
  const bad = checkEntity(row.entity);
  if (bad) return { error: bad };
  if (!IN_SCOPE.has(row.data_source)) {
    return { error: `out-of-scope data_source: "${row.data_source}"` };
  }
  if (!ALLOWED_MONTHS.has(CORRECT_MONTH)) {
    return { error: `target month ${CORRECT_MONTH} outside allowed set` };
  }
  return checkMonth(row.fiscal_year_start_month);
}

/** Classify one `data_sources` row. Same three labels, matched on `name`. */
export function classifySource(row) {
  const bad = checkEntity(row.entity);
  if (bad) return { error: bad };
  if (row.api_type !== 'pdf_download') {
    return { error: `api_type "${row.api_type}" is not the established Leonardtown family` };
  }
  if (!IN_SCOPE.has(row.name)) {
    return { error: `out-of-scope data_source name: "${row.name}"` };
  }
  return checkMonth(row.fiscal_year_start_month);
}
