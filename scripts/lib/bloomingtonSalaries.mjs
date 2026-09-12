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

/**
 * Years the publisher dates as closed but which are NOT comparable, declared
 * individually with the measurement behind them.
 *
 * ⚠⚠ FY2001'S AS-OF DATE IS 2001-12-31, so `isClosedYearAsOf` passes and cannot
 * catch it. Only a comparison against the next year can, and it is unambiguous:
 * across 168 department+title groups with IDENTICAL headcounts, FY2001 is a
 * median 0.629 of FY2002 and 90% of those groups fall between 0.55 and 0.75 —
 * while FY2002/FY2003 and FY2003/FY2004 sit at 0.956 and 0.958 with 2% and 4%
 * in that band. A whole senior staff does not take a 37% pay cut; that is
 * roughly 7.5 months of a year, and the `Conversion` job title sitting at the
 * top of FY2001 points at a payroll-system cutover mid-year.
 *
 * Loading it would plant a false +47% step at the very start of the series.
 */
export const BLOOMINGTON_PARTIAL_YEARS = Object.freeze([
  {
    year: 2001,
    reason: 'Partial year (~7.5 months). Median ratio to FY2002 is 0.629 across 168 '
      + 'department+title groups with identical headcounts, 90% within 0.55-0.75, against '
      + '0.956 and 0.958 for the two following year-pairs. Measured 2026-09-12.',
  },
]);

/**
 * Should TT publish this fiscal year at all?
 *
 * Two independent reasons not to, and they catch different things: the
 * publisher's own as-of date catches the OPEN year, and the declared list above
 * catches a year the publisher dates as closed but which is not comparable.
 */
export function shouldPublishYear(fiscalYear, asOfDate) {
  const partial = BLOOMINGTON_PARTIAL_YEARS.find((p) => p.year === Number(fiscalYear));
  if (partial) return { publish: false, reason: partial.reason };
  if (!isClosedYearAsOf(asOfDate, fiscalYear)) {
    return {
      publish: false,
      reason: `not closed — as-of ${asOfDate}; the publisher calls the current year a `
        + 'PREDICTED compensation, and every closed year is dated 31 December of itself',
    };
  }
  return { publish: true, reason: 'closed year, dated 31 December of itself' };
}
