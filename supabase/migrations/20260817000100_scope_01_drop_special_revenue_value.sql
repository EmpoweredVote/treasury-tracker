-- SCOPE-01: remove 'special_revenue' from the fund_scope CHECK set.
--
-- Applied 2026-08-17 via mcp__supabase-local__apply_migration.
--
-- WHY IT WAS ADDED, AND WHY IT IS GOING AWAY
--
-- It was added for the MA source string
--   "X — MA DLS Schedule A — Special Revenue Funds"   (1,560 rows, 336 towns)
-- on the strength of that string. The string is wrong. docs/MA/ holds only
-- GenFundExpenditures{2002..2025}.xlsx and GenFundRevenues{2002..2025}.xlsx --
-- no Special Revenue Funds extract was ever loaded -- and the stored figures
-- equal `Total Expenditures` in the General Fund file exactly (Arlington FY2023
-- 191,585,207). The stored category tree is the General Fund expenditure
-- taxonomy, and the label is applied to 300-odd towns in the same fiscal years
-- that 26-51 other towns carry the General Fund label. It is a loader labelling
-- artifact, so no row is or ever was special_revenue.
--
-- Full retraction: docs/superpowers/plans/SCOPE-01-RECON.md §4.4.
--
-- The lesson, recorded because this milestone exists to prevent exactly it: a
-- scope was inferred from a data_source label. That is the one thing the
-- evidence rule forbids, and classify() is built so a registry entry cannot do
-- it -- but a human writing the recon document did it anyway.
--
-- SAFETY: the tally was verified to read `unknown` 79,927 with zero
-- special_revenue rows BEFORE narrowing the constraint, so this cannot fail on
-- existing data. Re-verified afterwards that 'special_revenue' is now rejected
-- with check_violation.

alter table treasury.budgets
  drop constraint budgets_fund_scope_check;

alter table treasury.budgets
  add constraint budgets_fund_scope_check
  check (fund_scope in ('general_fund','total_governmental','all_funds','unknown'));

comment on column treasury.budgets.fund_scope is
  'Which funds this row''s total covers. Classified per data source against an independent document (see scripts/data/fundScopeRegistry.mjs; evidence in docs/superpowers/plans/SCOPE-01-RECON.md). Default unknown so an untaught loader is honestly unclassified rather than silently wrong. Values: general_fund, total_governmental, all_funds, unknown. unknown rows must stay out of cross-entity comparison. NOT in the unique index -- deferred to SCOPE-02, which is what first creates a second-scope row for one city-year.';
