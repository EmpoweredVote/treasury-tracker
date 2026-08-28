-- Knight campaign / SRCSTD-01 slice — a figure must declare how much assurance
-- stands behind it.
--
-- WHY THIS COLUMN IS ON `budgets` AND NOT ON `data_sources`:
-- only 984 of 87,880 budget rows (1.1%) carry a data_source_id. The remaining
-- 98.9% are surfaced by ev-accounts assembling data_source_info from the budget
-- row's own data_source / source_url / source_date columns (see src/App.tsx
-- ~line 1411). A grade on the source registry would be invisible for almost
-- everything TT displays.
--
-- It is also correct on the merits: grade is a property of the DOCUMENT a row
-- came from, and it varies BY YEAR within one source name. Madison is the
-- existing proof — audited in some years, unaudited MFR in others. Only a
-- per-row column can say that.
--
-- WHY `NOT NULL DEFAULT 'unknown'` IS SAFE HERE:
-- a default is safe exactly when it is TRUE OF EVERY EXISTING ROW. Nobody has
-- assessed any of the 87,880 rows, so `unknown` is true of all of them — the
-- same property that made derivation's DEFAULT 'published' safe in
-- 20260821000000_scope_04_add_derivation.sql.
--
-- ⚠ This is NOT the FYSM `NOT NULL DEFAULT 1` mistake. That default asserted a
-- fiscal-year start month — a CLAIM about each entity's calendar that nobody had
-- verified, which then read as fact on ~18,700 rows. `unknown` asserts the
-- ABSENCE of an assessment, which is the truth. The distinction is the whole
-- reason this column is safe to default and that one was not.
--
-- ⚠ NOT NULL rather than nullable is deliberate: two ways to spell "no grade"
-- (NULL and 'unknown') would be an ambiguity every consumer has to resolve.
--
-- ⚠ NOT added to any index, and NOT part of series identity. (fund_scope, basis)
-- still identifies a series uniquely; audit_grade is a property of a row's
-- provenance, not a discriminator between series.
--
-- Pre-migration invariants, measured against the live table 2026-08-28:
--   rows       87,880
--   sum_total  431018387516581.0217849947930625
-- This migration touches no money column; both must be identical afterward.
--
-- ⚠ scripts/verify-budget-axes.mjs was ALREADY FAILING its frozen-figure digest
-- before this migration, and not because of it: 154 post-v2.24 rows are absent
-- from the exclusion list, so the hash covers 80,070 rows where it was built
-- from 79,916. Filed as a separate defect — see KNIGHT-COMMUNITIES-PROGRESS.md.
-- Do NOT regenerate figures_frozen to make it pass.

ALTER TABLE treasury.budgets
  ADD COLUMN audit_grade text NOT NULL DEFAULT 'unknown';

ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_audit_grade_check
  CHECK (audit_grade IN (
    'audited_gaap',
    'compiled_from_audited',
    'self_reported_unaudited',
    'unknown'
  ));
