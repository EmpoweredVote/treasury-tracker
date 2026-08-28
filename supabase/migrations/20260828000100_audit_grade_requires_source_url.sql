-- A grade must be traceable to the document that justified it.
--
-- Spec §3.5 requires evidence for every non-`unknown` audit_grade, recorded in
-- two places: a source_url ON THE ROW, and a citation in the progress file. This
-- constraint enforces the first half structurally.
--
-- WHY A CONSTRAINT AND NOT A TEST:
-- the plan called for a vitest guard asserting "no graded row lacks a
-- source_url". That is not possible in this repo — the vitest suite NEVER
-- touches the database (zero tests call createClient; CI runs `npm test` with no
-- credentials). The only existing home for a DB invariant is
-- scripts/verify-budget-axes.mjs, which nothing runs automatically and which was
-- found broken on 2026-08-28 after an unknown period of silent failure.
--
-- A CHECK constraint is strictly stronger than either: it holds on EVERY write
-- path — the sync RPCs, every present and future loader, and manual SQL — and it
-- cannot be bypassed by a loader that forgets to stamp, or by a harness nobody
-- runs. This is the lesson of the sourceChipTypes.ts comment applied to data:
-- a guard whose failure is invisible is not a guard.
--
-- ⚠ An ungraded row is unconstrained. `unknown` means nobody has looked, and a
-- row nobody has assessed has no obligation to cite anything. The constraint
-- binds only rows that make a positive claim about assurance.
--
-- Safe to add now: all 87,880 rows are `unknown`, so the constraint is
-- satisfied by the entire table at creation time.
ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_graded_rows_need_a_source_url
  CHECK (
    audit_grade = 'unknown'
    OR (source_url IS NOT NULL AND source_url <> '')
  );
