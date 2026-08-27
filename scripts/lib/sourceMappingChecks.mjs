/**
 * Static checks on a data source's column_mapping — problems you can see without
 * fetching a single row.
 *
 * ── Why ──
 *
 * Two sources sat enabled on a 'monthly' schedule that could never have synced,
 * and nothing said so until the health report in PR #86:
 *
 *   Bloomington Public Contracts — a 5,518-row CONTRACT REGISTER. Its own mapping
 *     note reads "Contract-level data, not individual payment transactions. No
 *     dollar amounts in this dataset." Typed as `transactions` anyway.
 *   LA City Vendor List — a 51,851-row VENDOR LOOKUP (name/id/zip/city), flagged
 *     `is_reference_dataset: true`. Also typed as `transactions`. Nothing in the
 *     pipeline knows what a reference dataset is.
 *
 * Neither has an amount column. Loading either into treasury.transactions — a
 * table whose whole meaning is "a payment of this many dollars" — would mint
 * thousands of $0 spending-shaped rows. That is the same defect class as the
 * Dallas $0 total: a figure that is structurally wrong while looking like data.
 *
 * Both also 400 on the fiscal-year filter the sync builds, because neither
 * dataset has a fiscal_year column and neither mapping sets `skip_fy_filter`.
 *
 * ⚠ The rule: a source that CANNOT work should say so before it is scheduled,
 * not fail quietly once a week forever.
 */

import { hasYearColumns, yearColumnsCoverageProblem } from './yearColumnMapping.mjs';

/**
 * @param {object} source  { dataset_type, column_mapping, fiscal_years }
 * @returns {Array<{code: string, detail: string, fatal: boolean}>}
 */
export function mappingProblems(source) {
  if (!source) return [];
  // ⚠ Absent and empty are NOT the same thing, and conflating them is how this
  // module first reported every source as broken: treasury_list_sources does not
  // return column_mapping, so `source.column_mapping` was undefined everywhere and
  // every check failed "correctly" against {}. A caller that has not loaded the
  // mapping must be told, not quietly given a confident wrong answer.
  if (!('column_mapping' in source)) {
    throw new Error(
      'mappingProblems() requires column_mapping on the source. It is absent — note '
      + 'that treasury_list_sources does not return it, so fetch it from '
      + 'treasury.data_sources. Pass column_mapping: {} to check a genuinely empty mapping.');
  }
  const problems = [];
  const cm = source.column_mapping || {};
  const type = source.dataset_type;

  if (cm.is_reference_dataset === true || cm.is_reference_dataset === 'true') {
    problems.push({
      code: 'reference_dataset_not_syncable',
      detail: 'column_mapping sets is_reference_dataset — a lookup table, not a '
            + 'time series. No sync path consumes reference datasets, so scheduling '
            + 'this source can only ever fail or write meaningless rows.',
      fatal: true,
    });
  }

  if (type === 'transactions') {
    if (!cm.amount_column) {
      problems.push({
        code: 'transactions_without_amount',
        detail: 'dataset_type is transactions but column_mapping has no amount_column. '
              + 'Every row would land in treasury.transactions with amount 0 — '
              + '$0 rows that read as spending.',
        fatal: true,
      });
    }
    if (!cm.date_column) {
      problems.push({
        code: 'transactions_without_date',
        detail: 'dataset_type is transactions but column_mapping has no date_column, '
              + 'so payment_date would be NULL on every row.',
        fatal: false,
      });
    }
  }

  if ((type === 'operating' || type === 'revenue')) {
    // ⚠ A WIDE-FORMAT source names its amount column per fiscal year in
    // `year_columns` and has no top-level `amount_column` at all — deliberately, so
    // there is no second source of truth to drift (scripts/lib/yearColumnMapping.mjs).
    // Without this clause West Hollywood's four budget sources, which load correctly,
    // would each be reported as a FATAL mapping problem. Calling a working source
    // broken is the same failure as calling a broken one healthy, and this checker
    // has done it before.
    const wideFormat = hasYearColumns(cm);
    const hasEdgeDialect = Array.isArray(cm.hierarchy_columns) && (!!cm.amount_column || wideFormat);
    const hasRepoDialect = (!!cm.category_column && !!cm.approved_amount_column)
      || (!!cm.category_column && wideFormat);
    if (!hasEdgeDialect && !hasRepoDialect) {
      problems.push({
        code: 'budget_mapping_incomplete',
        detail: 'neither loader dialect is satisfied: the treasury-sync edge function '
              + 'needs hierarchy_columns + amount_column (or year_columns), and '
              + 'scripts/buildBudgetTree.mjs needs category_column + approved_amount_column.',
        fatal: true,
      });
    }

    // A wide-format mapping that does not cover its own fiscal_years cannot sync the
    // years it claims — resolveYearColumns throws rather than reading the wrong column.
    if (wideFormat) {
      const coverage = yearColumnsCoverageProblem(cm, source.fiscal_years || []);
      if (coverage) {
        problems.push({
          code: 'year_columns_coverage',
          detail: `column_mapping.year_columns does not cover fiscal_years: ${coverage}`,
          fatal: true,
        });
      }
    }
  }

  return problems;
}

/** True when the mapping makes a successful sync impossible. */
export function isUnsyncable(source) {
  return mappingProblems(source).some((p) => p.fatal);
}
