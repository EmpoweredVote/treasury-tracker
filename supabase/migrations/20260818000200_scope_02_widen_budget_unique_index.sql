-- SCOPE-02 Task 9 — let one city-year hold both a published actuals figure and a
-- published budget figure.
--
-- SCOPE-01 deliberately did NOT widen this: nothing then produced a second row,
-- so widening early would have opened a double-count hazard for no benefit. That
-- changed. SCO published all-funds actuals for Fresno FY2020-2024, Riverside and
-- Santa Ana FY2023-2024 and Oakland FY2024, and every one was SKIPPED at load
-- time because a city budget-document row already held the key
-- (bulkLoadStateController.js never-overwrite policy, D-06). Part of the seam is
-- data this index kept out.
--
-- ⚠ ONE-WAY DOOR. From here, any aggregate over treasury.budgets that does not
-- constrain fund_scope and basis can double-count.

DROP INDEX IF EXISTS treasury.idx_budget_municipality_year_type;

CREATE UNIQUE INDEX idx_budget_municipality_year_type
  ON treasury.budgets (municipality_id, fiscal_year, dataset_type, period_label, fund_scope, basis)
  NULLS NOT DISTINCT;
