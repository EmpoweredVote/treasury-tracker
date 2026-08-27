/**
 * One implementation of the Socrata `$where` clause every loader needs.
 *
 * ── Why this is shared ──
 *
 * scripts/bulkLoadBudget.js and the treasury-sync edge function each grew their
 * own version, and they supported DIFFERENT subsets of the same column_mapping
 * extensions:
 *
 *              where_extra   fiscal_year_type   skip_fy_filter   date-field note
 *   bulkLoad       yes             yes                no               no
 *   edge fn        NO              NO                yes              yes
 *
 * So San Francisco — whose whole configuration turns on
 * `where_extra: "AND revenue_or_spending='Spending'"`, because one dataset holds
 * both revenue and spending — could be loaded by the script and was structurally
 * unsyncable by the cron. The edge function silently dropped the clause, fetched
 * both directions at once, and produced a meaningless tree. Los Angeles Operating
 * Budget (`AND adopted_budget_amount > 0`) has the same exposure.
 *
 * That is the same two-dialect disease as the column_mapping keys themselves
 * (see scripts/lib/dallasSources.mjs). Fixed the same way: one definition, one
 * set of tests, and the edge function's copy pinned against it by
 * tests/socrataFilter.test.mjs.
 *
 * ── The extensions, in precedence order ──
 *
 *   skip_fy_filter    'true'|true — dataset has NO fiscal-year dimension (one column
 *                     per year instead). No year predicate is emitted at all.
 *   note contains
 *   'date field'      the fiscal-year column is a date → date_extract_y(col)=YYYY
 *   fiscal_year_type  'integer' → col=2025 unquoted. Anything else → col='2025'.
 *   where_extra       appended verbatim, caller supplies the leading AND
 *                     (e.g. "AND revenue_or_spending='Spending'").
 *
 * default_filters.$where, if present, is ANDed in front of all of it.
 */

import { hasYearColumns, yearColumnsCoverageProblem } from './yearColumnMapping.mjs';

/** Drop a leading AND/OR so a fragment can stand alone as the whole clause. */
function stripLeadingConjunction(fragment) {
  return String(fragment).replace(/^\s*(AND|OR)\s+/i, '').trim();
}

/**
 * Build the `$where` value for a source/fiscal-year pair.
 *
 * @param {object} cm              column_mapping
 * @param {number|string} fiscalYear
 * @param {object} [defaultFilters] data_sources.default_filters
 * @returns {string|null} the $where clause, or null when no predicate applies
 */
export function buildSocrataWhere(cm = {}, fiscalYear, defaultFilters = {}) {
  const parts = [];

  const preset = defaultFilters?.$where;
  if (preset) parts.push(String(preset).trim());

  const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
  if (!skipFy) {
    const fyCol = cm.fiscal_year_column || 'fiscal_year';
    const isDateField = typeof cm.note === 'string' && cm.note.includes('date field');
    if (isDateField) {
      parts.push(`date_extract_y(${fyCol})=${fiscalYear}`);
    } else if (cm.fiscal_year_type === 'integer') {
      // Integer columns must NOT be quoted — e.g. LA Revenue vvm4-a2zu.
      parts.push(`${fyCol}=${fiscalYear}`);
    } else {
      parts.push(`${fyCol}='${fiscalYear}'`);
    }
  }

  if (cm.where_extra) {
    // Supplied with its own leading AND. If it is the only predicate, that AND
    // would be a syntax error, so strip it.
    parts.push(parts.length === 0
      ? stripLeadingConjunction(cm.where_extra)
      : String(cm.where_extra).trim());
  }

  if (parts.length === 0) return null;

  // Everything after the first part either already carries its conjunction
  // (where_extra) or needs one (the year predicate).
  return parts.reduce((acc, part) => {
    if (!acc) return part;
    return /^\s*(AND|OR)\s+/i.test(part) ? `${acc} ${part}` : `${acc} AND ${part}`;
  }, '');
}

/**
 * Same thing shaped as the filters object the edge function passes around.
 * @returns {object} `{}` or `{ $where }`
 */
export function buildSocrataFilters(cm = {}, fiscalYear, defaultFilters = {}) {
  const filters = { ...(defaultFilters || {}) };
  const where = buildSocrataWhere(cm, fiscalYear, defaultFilters);
  if (where) filters.$where = where; else delete filters.$where;
  return filters;
}

/**
 * A dataset with no fiscal-year dimension cannot legitimately be loaded for more
 * than one fiscal year: every year would receive the same rows, and — because
 * `amount_column` on those sources names a single hard-coded year
 * (e.g. `_2018_actuals`) — the same figures too.
 *
 * West Hollywood's FY15-18 budget sources were exactly this: skip_fy_filter with
 * `amount_column: "_2018_actuals"` and `fiscal_years: [2015,2016,2017,2018]`. A
 * sync over the last two would file FY2018 actuals under FY2017 as well.
 *
 * ── The one legitimate multi-year case ──
 *
 * `skip_fy_filter` says the dataset has no year DIMENSION; it does not say the
 * dataset holds only one year. Wide-format feeds carry a column per year, and a
 * mapping that declares `year_columns` reads a DIFFERENT column for each fiscal
 * year (see scripts/lib/yearColumnMapping.mjs). Those rows repeat across years
 * by design — they are the line-item definitions — while the money does not.
 * So the refusal lifts exactly when `year_columns` covers every requested year
 * with a distinct amount column, and not otherwise.
 */
export function skipFyFilterMultiYearProblem(cm = {}, fiscalYears = []) {
  const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
  if (!skipFy || fiscalYears.length <= 1) return null;

  if (hasYearColumns(cm)) {
    // Covered cleanly → allowed. Covered badly → say what is wrong with the
    // mapping, rather than the generic "sync one year at a time", which is not
    // the fix for a wide-format source.
    return yearColumnsCoverageProblem(cm, fiscalYears);
  }

  return `skip_fy_filter is set (the dataset has no fiscal-year column) but ${fiscalYears.length} `
       + `fiscal years were requested (${fiscalYears.join(', ')}). Every year would be written the `
       + `same rows${cm.amount_column ? `, all read from '${cm.amount_column}'` : ''}. `
       + `Either sync one explicit fiscal year at a time, or — if the dataset carries a column `
       + `per year — declare column_mapping.year_columns.`;
}
