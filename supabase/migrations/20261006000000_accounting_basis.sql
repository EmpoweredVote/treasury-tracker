-- Phase 2 — HOW a figure was measured, as its own axis.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
--
-- Duvall, WA reports on the cash-basis BARS regulatory framework. Its auditor
-- issues an UNMODIFIED opinion on that basis and an ADVERSE opinion on U.S.
-- GAAP, and states that government-wide statements "are not presented". Its
-- General Fund figure is real, audited and NOT comparable to Redmond's — two
-- King County cities, two different measurements.
--
-- Until now that distinction lived ONLY as text inside `budgets.data_source`
-- ('modified cash basis' vs 'GAAP basis'), matched by regex in
-- scripts/data/auditGradeRegistry.mjs. That is precisely the pattern
-- scripts/lib/fundScope.mjs was written to forbid: "Read a loader's actual
-- input before believing what its source string calls itself." A
-- `special_revenue` fund scope was once added on the strength of a source
-- string and later removed as wrong.
--
-- ⚠⚠ `budgets.basis` CANNOT CARRY THIS. It is
-- CHECK (basis IN ('actual','adopted','unknown')) and means closed-year actual
-- vs adopted budget — a different axis that already earns its keep. A single
-- column cannot answer two questions.
--
-- ⚠⚠ ORTHOGONAL TO `audit_grade` ON PURPOSE. That axis is assurance; this one
-- is measurement. Brown County SD is audited to Government Auditing Standards
-- on a modified cash basis, and an UNAUDITED cash-basis source must also be
-- describable. Deriving measurement from `audited_ocboa` would make that
-- source invisible and would re-encode the confusion the OCBOA migration
-- (20260831000000) was written to escape.
--
-- ⚠ THIS IS NOT A RANKING. `cash` is not a worse `gaap`; it is a different
-- measurement. The reader-facing copy says "different", never "worse", and
-- every graded value shares one colour for the same reason.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────────
--
-- Additive only. Every existing row becomes 'unknown', which is the honest
-- value for a row nobody has adjudicated; no existing value is read or
-- changed, and no backfill is performed here. Same failure direction as
-- fund_scope, basis and audit_grade: NOTHING IS CLASSIFIED BY ABSENCE, and a
-- value is stamped only from evidence carrying the document it was read from.
--
-- ⚠ No bulk 'gaap' backfill, now or later. Assuming GAAP for every unexamined
-- row is the same unevidenced assertion this axis exists to prevent, and it
-- would silently mark ~280k rows with a claim nobody checked.

ALTER TABLE treasury.budgets
  ADD COLUMN accounting_basis text NOT NULL DEFAULT 'unknown'
    CONSTRAINT budgets_accounting_basis_check
      CHECK (accounting_basis IN ('gaap','modified_cash','cash','unknown'));

COMMENT ON COLUMN treasury.budgets.accounting_basis IS
  'How the figure was measured: U.S. GAAP, modified cash, cash, or unknown. '
  'Stamped per source from evidence; unknown until proven. NOT budgets.basis '
  '(actual vs adopted) and NOT audit_grade (assurance, not measurement).';
