-- Give San Francisco the treasury-sync edge-function dialect so the cron can load it.
--
-- SF was the last budget source that only the repo script could load. Two reasons,
-- both now removed:
--
--   1. dataset xdgd-c79v holds BOTH revenue and spending in one table, split by
--      `where_extra: "AND revenue_or_spending='Spending'"`. The edge function
--      ignored where_extra entirely — it now shares scripts/lib/socrataFilter.mjs.
--   2. its column_mapping carried only the repo dialect (category_column /
--      subcategory_column / approved_amount_column), so the edge builder fell back
--      to ["department_name","fund_name","account_name"] and "total_budget", none of
--      which exist — every level keyed to "Unknown" and every amount to 0. That
--      tripped the zero-total guard from PR #83, which is why SF has been reading
--      sync_status 'error' since 2026-08-27 rather than silently writing zeros.
--
-- Both dialects must describe the SAME tree — department > fund_type — exactly as
-- for Dallas in scripts/lib/dallasSources.mjs. The stored hierarchy confirms that
-- shape: 53 departments at depth 0 and ~102 department/fund pairs at depth 1 for
-- FY2025 operating.
--
-- actual_amount_column is deliberately left unset: xdgd-c79v publishes an adopted
-- budget and no actuals. The edge builder now maps
-- approved := approved_amount_column ?? amount_column and actual := actual_amount_column
-- ?? NULL, so line items get approved_amount = budget and actual_amount = NULL —
-- matching what bulkLoadBudget.js already writes.

UPDATE treasury.data_sources
   SET column_mapping = column_mapping
         || jsonb_build_object(
              'hierarchy_columns', jsonb_build_array('department', 'fund_type'),
              'amount_column', 'budget'
            ),
       updated_at = now()
 WHERE name IN ('San Francisco Operating Budget', 'San Francisco Revenue Budget');
