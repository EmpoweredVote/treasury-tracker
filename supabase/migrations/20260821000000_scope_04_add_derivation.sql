-- SCOPE-04 Task 2 -- a derived figure must declare itself.
--
-- total_governmental ALREADY holds 28,410 PUBLISHED rows (MN OSA 21,794,
-- Ohio AOS 6,616). Writing derived CA rows into the same fund_scope without a
-- discriminator would give a reader one label for two epistemically different
-- things -- Minneapolis published, Modesto computed.
--
-- DEFAULT 'published' is what makes this safe: every existing row gains a true
-- value without being rewritten, so figures_frozen cannot move.
--
-- Pre-migration invariants, measured against the live table 2026-08-21:
--   rows       80,076
--   sum_total  428759421667452.3117849247930625
--   figures_frozen  4cce9d6a8dfe9ac235dfd488f1903243892c7ebc4ac41b17dbd9022bfb068b9a
--                   (79,916 frozen rows; 160 created since v2.24 and excluded)
--
-- ⚠ The plan quoted 79,939 rows and figures_frozen 3bc12db8..., both of which
-- were stale. The invariant had been dead since v2.27 and was repaired in the
-- commit preceding this one -- see scopeBaseline.json `_rebased_at_v2_30` for
-- the full accounting. Do not "restore" the older numbers.
--
-- ⚠ Deliberately NOT added to idx_budget_municipality_year_type. One
-- city-year-dataset must never hold both a published and a derived figure at the
-- same scope; if a state ever publishes TG for a city we also derive, that is a
-- conflict to adjudicate, not a row to duplicate.
--
-- ⚠ Nor does it join the series identity: (fund_scope, basis) still identifies a
-- series uniquely. `derivation` is a property of a series, not a discriminator.
ALTER TABLE treasury.budgets
  ADD COLUMN derivation text NOT NULL DEFAULT 'published';

ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_derivation_check
  CHECK (derivation IN ('published','derived'));
