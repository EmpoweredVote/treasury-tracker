/**
 * Dallas, TX Socrata budget sources — single source of truth for the two
 * treasury.data_sources rows, extracted so the mapping can be unit-tested.
 *
 * ── Why this file exists ────────────────────────────────────────────────
 * TWO different loaders read `data_sources.column_mapping`, and they use
 * DIFFERENT key names for the same concepts:
 *
 *   scripts/bulkLoadBudget.js  (via scripts/buildBudgetTree.mjs)
 *     department_column > category_column > subcategory_column
 *     approved_amount_column
 *
 *   supabase/functions/treasury-sync  (the Deno edge function, run by cron)
 *     hierarchy_columns: [level0, level1, level2]
 *     amount_column
 *
 * Dallas was configured in the FIRST dialect but is actually loaded by the
 * SECOND. Every hierarchy lookup missed, so the edge function keyed every
 * level to the literal string "Unknown" and read every amount as 0 — it
 * wrote a $0 total over $4.3B of otherwise-correct line items, and the
 * weekly sync cron re-wrote those zeros every Sunday while logging success.
 *
 * Both dialects are therefore defined here and MUST describe the same tree.
 * dallasSources.test.mjs enforces that; do not let them drift.
 */

// Dallas municipality_id (confirmed via quick task 001)
export const DALLAS_MUNICIPALITY_ID = '17ce5baf-277d-41c9-a3f6-2e44f9def106';

// Dallas fiscal year starts Oct 1. PR #69 dropped the column DEFAULT and made
// this NOT NULL, so an INSERT that omits it now fails loudly.
export const DALLAS_FISCAL_YEAR_START_MONTH = 10;

/**
 * Levels are ordered outermost → innermost, matching how the icicle renders:
 *   operating: appropriation (68) > service (192) > objectgroup (9)
 *   revenue:   fundtype (6)      > department (34) > revsource (444)
 * Distinct counts are FY2026, measured against the live API on 2026-08-26.
 */
export const DALLAS_SOURCES = [
  {
    name: 'Dallas Operating Budget',
    api_type: 'socrata',
    dataset_type: 'operating',
    base_url: 'https://www.dallasopendata.com',
    dataset_id: 'e2fs-y4nb',
    column_mapping: {
      fiscal_year_column: 'bfy',
      // repo-loader dialect (scripts/buildBudgetTree.mjs)
      department_column: 'appropriation',
      category_column: 'service',
      subcategory_column: 'objectgroup',
      approved_amount_column: 'budcurr',
      actual_amount_column: 'expbfy',
      fund_column: 'fundtype',
      // edge-function dialect (supabase/functions/treasury-sync)
      hierarchy_columns: ['appropriation', 'service', 'objectgroup'],
      amount_column: 'budcurr',
    },
    fiscal_years: [2025, 2026],
    fiscal_year_start_month: DALLAS_FISCAL_YEAR_START_MONTH,
    municipality_id: DALLAS_MUNICIPALITY_ID,
  },
  {
    name: 'Dallas Revenue Budget',
    api_type: 'socrata',
    dataset_type: 'revenue',
    base_url: 'https://www.dallasopendata.com',
    dataset_id: 'rtn4-pmj9',
    column_mapping: {
      fiscal_year_column: 'bfy',
      // repo-loader dialect (scripts/buildBudgetTree.mjs)
      department_column: 'fundtype',
      category_column: 'department',
      subcategory_column: 'revsource',
      approved_amount_column: 'budcurr',
      actual_amount_column: 'revbfy',
      fund_column: 'fundtype',
      // edge-function dialect (supabase/functions/treasury-sync)
      hierarchy_columns: ['fundtype', 'department', 'revsource'],
      amount_column: 'budcurr',
    },
    fiscal_years: [2025, 2026],
    fiscal_year_start_month: DALLAS_FISCAL_YEAR_START_MONTH,
    municipality_id: DALLAS_MUNICIPALITY_ID,
  },
];

/**
 * Public Socrata landing page for a dataset — written to budgets.source_url so
 * the provenance of a loaded row is recorded on the row itself, not only on
 * data_sources (whose base_url is just the portal root).
 */
export function dallasDatasetUrl(datasetId) {
  return `https://www.dallasopendata.com/d/${datasetId}`;
}

/**
 * The hierarchy the edge function will build, derived from the repo-dialect keys.
 * Exported so the test can assert the two dialects agree rather than restating
 * the column names a third time.
 */
export function repoDialectHierarchy(cm) {
  return [cm.department_column, cm.category_column, cm.subcategory_column].filter(Boolean);
}
