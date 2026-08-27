/**
 * Per-year amount columns for WIDE-FORMAT budget datasets.
 *
 * ── The shape this exists for ──
 *
 * Most budget feeds are long: one row per line item per year, with a
 * `fiscal_year` column to filter on. A few publishers instead ship one row per
 * line item and a COLUMN PER YEAR:
 *
 *   fund_title | department_title | account_title | _2017_actuals | _2018_actuals |
 *   _2019_actuals | _2020_approved | _2021_recommended
 *
 * West Hollywood publishes all four of its budget datasets this way. There is no
 * fiscal-year dimension to filter on at all, which is what `skip_fy_filter` says.
 *
 * A single `amount_column` cannot express that shape. Before this module the four
 * WeHo sources named ONE year's column and listed four or five in `fiscal_years`,
 * so a sync would have written FY2018's figures under FY2015, FY2016 and FY2017 as
 * well — the same rows AND the same money, four times, under four different years.
 * `skipFyFilterMultiYearProblem` was added to refuse exactly that.
 *
 * `year_columns` is how a source says it honestly:
 *
 *   "year_columns": {
 *     "2017": { "amount_column": "_2017_actuals",  "basis": "actual"  },
 *     "2020": { "amount_column": "_2020_approved", "basis": "adopted" }
 *   }
 *
 * ── Why every entry must declare a basis ──
 *
 * A wide dataset mixes kinds of money in adjacent columns. WeHo's expenditure
 * feed puts three closed-year ACTUALS beside one ADOPTED budget beside one
 * RECOMMENDED figure the council never adopted. They are not the same kind of
 * number — drawing an actual and an adopted budget as consecutive points on one
 * line is the −75% Long Beach cliff that opened SCOPE-02, and `treasury.budgets`
 * carries a `basis` column precisely so the reader is told which they are looking
 * at (see src/data/fundScopeVocabulary.ts — the chip and the "spent"/"budgeted"
 * verb both read it).
 *
 * So `basis` is REQUIRED per year and must be 'actual' or 'adopted'. It cannot be
 * 'unknown': if you know enough to name the column you know what kind of figure it
 * holds. A proposal that was never adopted is neither — the honest thing is to
 * leave that year out of `year_columns`, which is what WeHo's `_2015_proposed`,
 * `_2016_proposed` and `_2021_recommended` columns get.
 *
 * ── Fail loud, never fall back ──
 *
 * If `year_columns` is present and the requested year is missing from it, this
 * THROWS rather than falling back to the top-level `amount_column`. A silent
 * fallback is the original defect wearing a new hat: it would file some other
 * year's figures under the requested one, and the Σ-items == total gate would
 * pass while it did (see project_dallas_zero_total_broken_rollup — a wrong answer
 * that looks like a right one).
 */

/** Basis values `treasury.budgets.basis` accepts for a declared year. */
const DECLARABLE_BASIS = ['actual', 'adopted'];

/** True when a column_mapping uses per-year amount columns. */
export function hasYearColumns(cm = {}) {
  const yc = cm?.year_columns;
  return !!yc && typeof yc === 'object' && !Array.isArray(yc) && Object.keys(yc).length > 0;
}

/** The fiscal years a `year_columns` mapping declares, as numbers, ascending. */
export function declaredYears(cm = {}) {
  if (!hasYearColumns(cm)) return [];
  return Object.keys(cm.year_columns)
    .map((k) => Number(k))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
}

/**
 * Bind a wide-format mapping to one fiscal year.
 *
 * @param {object} cm          column_mapping from data_sources
 * @param {number|string} fiscalYear
 * @param {string} [sourceName] used only in error text
 * @returns {{ cm: object, basis: string|null }}
 *          `cm` is the mapping the tree builders should use — the original when
 *          the source is not wide-format, otherwise a copy with this year's
 *          amount columns bound. `basis` is the year's declared basis, or null
 *          when the source declares none (existing sources: unchanged).
 */
export function resolveYearColumns(cm = {}, fiscalYear, sourceName = 'source') {
  if (!hasYearColumns(cm)) return { cm, basis: null };

  const key = String(fiscalYear);
  const entry = cm.year_columns[key];

  if (!entry) {
    throw new Error(
      `Refusing to sync ${sourceName} FY${fiscalYear}: column_mapping.year_columns is set ` +
      `(this is a wide-format dataset with one column per year) but declares no entry for ` +
      `${key}. Declared years: ${declaredYears(cm).join(', ') || '(none)'}. Falling back to ` +
      `amount_column '${cm.amount_column ?? 'none'}' would file another year's figures under ` +
      `FY${fiscalYear}. Add the year to year_columns, or drop it from fiscal_years.`);
  }

  if (!entry.amount_column) {
    throw new Error(
      `Refusing to sync ${sourceName} FY${fiscalYear}: year_columns["${key}"] has no ` +
      `amount_column, so every row would be read as 0.`);
  }

  if (!DECLARABLE_BASIS.includes(entry.basis)) {
    throw new Error(
      `Refusing to sync ${sourceName} FY${fiscalYear}: year_columns["${key}"].basis is ` +
      `${JSON.stringify(entry.basis ?? null)}, but a declared year must say whether its ` +
      `column holds an ${DECLARABLE_BASIS.join(' or an ')} figure. A wide dataset puts ` +
      `closed-year actuals in the columns next to the adopted budget; storing one as the ` +
      `other is what the basis axis exists to prevent. Figures that are neither — a proposal ` +
      `never adopted — do not belong in year_columns at all.`);
  }

  // Only the keys the year entry names are overridden. Everything else —
  // hierarchy_columns, fund_column, description_column, skip_fy_filter — is the
  // source's, unchanged.
  const bound = { ...cm };
  bound.amount_column = entry.amount_column;

  // ⚠ `actual_amount_column` must be REPLACED, not inherited. WeHo's FY17-21
  // sources carried a top-level `actual_amount_column: "_2019_actuals"` — a single
  // hard-coded year — so without this every year would report FY2019's outturn as
  // its own actual. A year entry that names no actual column has none: null, never
  // the rollup amount (project_sf_inverted_amounts_and_listing_cap).
  if (entry.actual_amount_column) bound.actual_amount_column = entry.actual_amount_column;
  else delete bound.actual_amount_column;

  if (entry.approved_amount_column) bound.approved_amount_column = entry.approved_amount_column;
  else delete bound.approved_amount_column;

  return { cm: bound, basis: entry.basis };
}

/**
 * Why a `year_columns` mapping cannot be trusted across the years requested.
 *
 * Two years pointing at the SAME amount column is the wide-format defect itself:
 * both would be written the same money under different fiscal years.
 *
 * @returns {string|null} the problem, or null when the mapping covers the years cleanly
 */
export function yearColumnsCoverageProblem(cm = {}, fiscalYears = []) {
  if (!hasYearColumns(cm)) return null;

  const missing = fiscalYears.filter((fy) => !cm.year_columns[String(fy)]);
  if (missing.length > 0) {
    return `year_columns declares no entry for ${missing.join(', ')} `
         + `(declared: ${declaredYears(cm).join(', ') || 'none'}).`;
  }

  const seen = new Map();
  for (const fy of fiscalYears) {
    const col = cm.year_columns[String(fy)]?.amount_column;
    if (!col) return `year_columns["${fy}"] has no amount_column.`;
    if (seen.has(col)) {
      return `year_columns maps FY${seen.get(col)} and FY${fy} to the same column `
           + `'${col}', so both years would be written the same figures.`;
    }
    seen.set(col, fy);
  }

  return null;
}
