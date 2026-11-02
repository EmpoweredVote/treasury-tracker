-- Un-hide the VA APA revenue rows: revenue_local_only -> revenue.
--
-- Applied 2026-11-03 via mcp__supabase-local__apply_migration.
-- Reverses 20260817000200_hide_va_apa_revenue_rows.sql, whose stated condition
-- for reversal has now been met.
--
-- WHY THEY WERE HIDDEN, AND WHY THEY ARE COMING BACK
--
-- The 304 rows held Exhibit B "Total LOCAL Revenue" and deliberately EXCLUDED
-- Exhibit B-1 intergovernmental aid, so they were not a whole-revenue figure:
-- measured against the stored expenditures they ran from 59.6% (Newport News)
-- and 60.0% (Richmond) up to 102.3% (Loudoun) and 101.2% (Alexandria). The
-- spread was the signature of the missing aid, not noise. Presenting that as
-- "Money In" understated revenue by up to ~40% for the localities most
-- dependent on state education aid, and no fund_scope label could fix it --
-- it was incomplete, not unclassified.
--
-- The hide was explicitly conditional. 20260817000200 says the relabel "is
-- reversible with the single statement at the bottom of this file", and
-- STATE.md recorded the condition verbatim: "restore `revenue` once B1 lands."
-- B-1 has now landed: scripts/loadVAComparativeReport.js reads Exhibit B-1 and
-- publishes Exhibit A's own "Total Revenue".
--
-- ⚠⚠ THE ORDER MATTERS AND THIS MIGRATION MUST RUN *FIRST*, BEFORE THE LOAD.
-- treasury_sync_city_budget finds its target on
--   (municipality_id, fiscal_year, dataset_type, fund_scope, basis)
-- so with the rows still labelled `revenue_local_only`, a loader writing
-- `revenue` would match nothing, take the INSERT branch, and leave 304 stale
-- rows beside 304 new ones. Relabelling first means the load UPDATES IN PLACE
-- and every row keeps its id -- which is what lets the frozen-figure ledger
-- work at all, since the ledger is keyed on id.
--
-- ⚠ This statement alone moves NO figure. figures_frozen is sha256 over
-- (id | total_budget); dataset_type is not in it, and no total changes here.
-- The figures move in the load that follows, and scripts/data/figureChanges.json
-- carries all 304 pre-load values so 62,587 / 60098de6 keeps verifying.
--
-- VERIFIED BEFORE APPLYING
--   304 rows revenue_local_only, 304 distinct ids, 0 already 'revenue'
--   304 VA 'operating' rows, untouched by this statement
--   all 304 are INSIDE the frozen set (0 excluded, 0 already in the ledger)
--   all 304 tie to Exhibit A "Total Revenue" at exactly $0 under the new reader

update treasury.budgets
   set dataset_type = 'revenue'
 where data_source  = 'Virginia APA Comparative Report'
   and dataset_type = 'revenue_local_only';

-- To reverse:
--   update treasury.budgets
--      set dataset_type = 'revenue_local_only'
--    where data_source  = 'Virginia APA Comparative Report'
--      and dataset_type = 'revenue';
-- ⚠ Reversing the LABEL does not reverse the FIGURES. If this is being undone
-- because the B-1 load was wrong, the figures must be restored from
-- scripts/data/figureChanges.json, which holds each row's pre-B-1 total.
