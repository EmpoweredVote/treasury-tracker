-- SCOPE-01 Task 3: record which funds each budgets row's total covers.
--
-- Applied 2026-08-17 via mcp__supabase-local__apply_migration.
--
-- Strictly additive:
--   * every existing row becomes 'unknown', which is the honest starting state;
--   * no figure changes -- the pre/post sha256 over
--     (municipality_id, fiscal_year, dataset_type, period_label, total_budget)
--     is identical at dd0e38c3929962b327d422248bdae674d7d4f7fa0897dc5349bf2aaab2cce9eb
--     across all 79,927 rows;
--   * the unique index is deliberately NOT widened. Nothing creates a
--     second-scope row for one city-year until SCOPE-02, so widening now would
--     open a double-count hazard for no benefit.
--
-- The default of 'unknown' is the safety property: a loader that has not been
-- taught about scope produces an honestly unclassified row rather than a
-- silently wrong one.
--
-- Evidence of record: docs/superpowers/plans/SCOPE-01-RECON.md
-- Registry:          scripts/data/fundScopeRegistry.mjs

alter table treasury.budgets
  add column fund_scope text not null default 'unknown';

alter table treasury.budgets
  add constraint budgets_fund_scope_check
  check (fund_scope in ('general_fund','total_governmental','all_funds','special_revenue','unknown'));

comment on column treasury.budgets.fund_scope is
  'Which funds this row''s total covers. Classified per data source against an independent document (see scripts/data/fundScopeRegistry.mjs; evidence in docs/superpowers/plans/SCOPE-01-RECON.md). Default unknown so an untaught loader is honestly unclassified rather than silently wrong. Values: general_fund, total_governmental, all_funds, special_revenue, unknown. special_revenue is a fund SLICE (MA DLS Schedule A), not a whole-entity total -- it and unknown must both stay out of cross-entity comparison; a filter written as <> ''unknown'' is a bug. NOT in the unique index -- deferred to SCOPE-02, which is what first creates a second-scope row for one city-year.';
