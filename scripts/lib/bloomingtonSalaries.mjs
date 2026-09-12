/**
 * Bloomington salaries — the two rules its stored rows broke.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── ⚠⚠ A ROW'S LABEL IS NOT EVIDENCE OF WHICH FEED SET ITS VALUE ───────────
 *
 * `treasury_sync_city_budget` finds its row by (municipality, fiscal_year,
 * dataset_type, fund_scope, basis) and its update path sets ONLY `total_budget`,
 * `source_url` and `source_date`. It rewrites the VALUE every Sunday and never
 * touches `data_source` or `hierarchy`.
 *
 * So Bloomington FY2021-FY2025 kept `data/checkbook-all.csv` — a path on
 * somebody's disk, shown to a reader as the provenance of the figure — while the
 * numbers had long since come from Socrata `fcnf-g862`. The same mechanism is
 * why correcting those two columns is safe: the weekly sync cannot undo it.
 * See reference_frozen_figure_invariant, which states the general rule.
 */

/**
 * Does this `data_source` name a file on a disk rather than a publisher?
 *
 * ⚠ A URL IS NOT A PATH. LA County's salaries row is labelled with an ArcGIS
 * FeatureServer URL — provenance a reader can actually follow. A rule that
 * cannot tell the two apart would rewrite a row that is already correct, which
 * is the "a declared exception that names nothing" failure in reverse.
 */
export function isFilesystemPathLabel(dataSource) {
  if (typeof dataSource !== 'string' || dataSource.trim() === '') return false;
  const s = dataSource.trim();
  if (/https?:\/\//i.test(s)) return false;          // a URL names an endpoint
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;        // C:\work\payroll.csv
  if (/^\.{1,2}[\\/]/.test(s)) return true;          // ./exports/…  ../…
  // A slash-separated path ending in a data-file extension.
  return /[\\/]/.test(s) && /\.(csv|tsv|xlsx?|json|txt|pdf|zip)$/i.test(s);
}

/**
 * Is this row a CLOSED year, by the publisher's own signal?
 *
 * Bloomington's Annual Compensation dataset carries `asofdate` per row, and says
 * in its own description:
 *
 *   "For past years, the compensation would be as reported to the IRS with an
 *    effective date of the last day of the year. All data within the current
 *    year is a PREDICTED compensation and may not reflect what the compensation
 *    will be by the end of the year. Previous years reflect what compensation
 *    was actually earned."
 *
 * Every closed year in the file is dated `YYYY-12-31`; the open one carries the
 * date it was last refreshed (2026-09-11 when this was written, and it moves
 * nightly). So "did this year close?" is read off the publisher rather than
 * guessed from a threshold here.
 *
 * ⚠ The year must MATCH. An `asofdate` belonging to a different year is not
 * evidence that this one closed.
 */
export function isClosedYearAsOf(asOfDate, fiscalYear) {
  if (typeof asOfDate !== 'string' || !Number.isInteger(Number(fiscalYear))) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(asOfDate.trim());
  if (!m) return false;
  const [, y, mo, d] = m;
  return Number(y) === Number(fiscalYear) && mo === '12' && d === '31';
}
