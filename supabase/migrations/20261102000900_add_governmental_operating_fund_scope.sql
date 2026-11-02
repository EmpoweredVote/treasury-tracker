-- Add 'governmental_operating' to the fund_scope CHECK set.
--
-- Applied 2026-11-02 via mcp__supabase-local__apply_migration.
--
-- WHY A FIFTH VALUE
--
-- The Virginia APA Comparative Report publishes a scope that none of the four
-- existing values names. Its own "Notes to the Comparative Report" (a separate
-- per-year document, published alongside the data workbook) defines it:
--
--   "This report presents local government operations for the general government
--    and enterprise activities."                                     (Note 1.A)
--   "Maintenance and Operation Expenditures - Summary total of expenditures for
--    the operation of general government."                           (Note 2, Exhibit A)
--
-- General government there means the eight functions' OPERATING activity.
-- Capital projects (Exhibit D), debt service (Exhibit E) and enterprise
-- (Exhibit F) are each reported separately and are excluded from it.
--
--   NOT total_governmental -- Exhibits D and E are governmental-fund outflows
--   that the label would assert are included. Measured, Virginia Beach FY2024:
--     Exhibit C Total Expenditures      2,081,891,529   <- the figure we load
--     Exhibit D capital applications      373,043,369   <- excluded
--     Exhibit E debt service total        206,580,579   <- excluded
--   The excluded pair is 27.8% of the loaded figure. Labelling these rows
--   total_governmental would overstate what they cover by that much.
--
--   NOT general_fund -- the school operating fund is INSIDE the scope. Virginia
--   Beach FY2024 carries 1,074,966,505 of Education expenditure (Exhibit C-6)
--   in the same total as general administration, and Note 2 (Exhibit E) states
--   "School fund transfers are included as transfers from general government".
--
-- ⚠ IT IS NOT ADDED TO NON_COMPARABLE_SCOPES, deliberately. The 161 Virginia
-- localities share one publisher and one set of definitions, so they ARE
-- comparable with each other. `areComparable()` already keeps them apart from
-- every other scope by requiring the scopes to be EQUAL. Declaring them
-- incomparable without evidence is the same error as declaring them comparable
-- without evidence. See the long note in scripts/lib/fundScope.mjs.
--
-- SAFETY: this WIDENS the constraint, so it cannot fail on existing data -- the
-- opposite direction from 20260817000100, which narrowed it and therefore had to
-- verify the tally first. No existing row changes value here; the 608 Virginia
-- rows are stamped separately, after this lands.

alter table treasury.budgets
  drop constraint budgets_fund_scope_check;

alter table treasury.budgets
  add constraint budgets_fund_scope_check
  check (fund_scope in
    ('general_fund','governmental_operating','total_governmental','all_funds','unknown'));

comment on column treasury.budgets.fund_scope is
  'Which funds this row''s total covers. Classified per data source against an independent document (see scripts/data/fundScopeRegistry.mjs; evidence in docs/superpowers/plans/SCOPE-01-RECON.md). Default unknown so an untaught loader is honestly unclassified rather than silently wrong. Values: general_fund, governmental_operating, total_governmental, all_funds, unknown. governmental_operating is the publisher-defined operating scope that excludes capital projects and debt service funds (VA APA Comparative Report). unknown rows must stay out of cross-entity comparison. NOT in the unique index -- deferred to SCOPE-02, which is what first creates a second-scope row for one city-year.';
