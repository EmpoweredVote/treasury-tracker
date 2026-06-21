-- v2.6 Phase 76 (EVVIEW-04): add a manual fundraising goal to the org summary.
-- The goal is a MANUAL value (no GiveButter/live-API pull this milestone, D-01),
-- sourced from the committed file data/ev-sources/goal.json and written by
-- scripts/reconcileEV.js into the single per-(municipality_id, fiscal_year) row.
-- Both columns are nullable: a row with no active goal is valid, and the donor
-- view simply hides the progress bar when goal_amount is null. Amounts in DOLLARS.
-- The ev-accounts API uses SELECT * + ?? null, so these serve automatically once
-- present (no API change required).

ALTER TABLE treasury.org_financial_summary
  ADD COLUMN IF NOT EXISTS goal_amount numeric,
  ADD COLUMN IF NOT EXISTS goal_label  text;

COMMENT ON COLUMN treasury.org_financial_summary.goal_amount IS
  'Active fundraising goal in DOLLARS — manual value from data/ev-sources/goal.json (Phase 76 D-01). Progress = income_net / goal_amount, capped at 100% (D-02/D-03). NULL when no active goal.';
COMMENT ON COLUMN treasury.org_financial_summary.goal_label IS
  'Human label for the active fundraising goal (e.g. campaign / fund name). NULL when no active goal.';
