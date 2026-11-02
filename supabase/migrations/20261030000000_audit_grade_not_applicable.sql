-- AUDIT-GRADE UI §5.4 — add `not_applicable` to the audit_grade vocabulary,
-- and move the source_url rule that would otherwise reject it.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
--
-- 7,932 rows carry `dataset_type` of `salaries` or `transactions` — a payroll
-- roster or a payments register. Every one of them is `unknown` today, which
-- renders to a reader as "Treasury Tracker has not yet established whether this
-- figure comes from an audited report".
--
-- That is a false confession. Nobody failed to check. An auditor publishes an
-- opinion on FINANCIAL STATEMENTS; a list of what a government paid is not one,
-- so there is no opinion to find and none is missing. Chris's call, 2026-10-30,
-- verbatim: "not_applicable value — salaries aren't financial statements."
--
-- This is issue #198's lesson in a new place: an INAPPLICABLE question is not an
-- UNANSWERED one, and the fix is to gate on the thing that makes it
-- inapplicable rather than on the absence of an answer.
--
-- None of the five existing values can carry it without lying:
--
--   unknown                  means NOBODY HAS LOOKED. There is nothing to look
--                            at. It also distorts every coverage figure Treasury
--                            Tracker publishes, by counting 7,932 rows as a gap
--                            in our checking that no amount of checking closes.
--   self_reported_unaudited  says an audit has not happened YET to a document
--                            audits apply to. It would imply a payroll roster
--                            were an un-audited financial statement.
--   compiled_from_audited    wrong shape entirely; nobody compiled anything.
--   audited_gaap /           assert an opinion that does not exist.
--   audited_ocboa
--
-- ⚠⚠ IT IS NOT A SIXTH RUNG. The five values above answer "how much independent
-- checking stands behind this figure". This one denies that the question
-- applies. It is not weaker than `unknown` — it is off that axis. It is listed
-- LAST so the five assurance values keep their order, not because it ranks
-- below them.
--
-- ⚠⚠ IT IS NEVER REACHABLE FROM THE REGISTRY, and tests/auditGradeRegistry.test.mjs
-- pins that. Every other grade answers "what did the PUBLISHER do" and carries
-- `{document, figures}` evidence for it. This one answers "what KIND of record
-- is this", and the row's own `dataset_type` already says — so it is stamped by
-- scripts/stampNotApplicableGrade.mjs from that column.
--
-- ── WHY THE SECOND CONSTRAINT HAD TO MOVE ────────────────────────────────────
--
-- `budgets_graded_rows_need_a_source_url` (migration 20260828000100) permits a
-- missing source_url ONLY when audit_grade = 'unknown'. Measured in production
-- on 2026-10-30: 7,753 of the 7,932 target rows — 97.7% — have no source_url.
-- 7,682 of those are CA SCO publicpay.ca.gov compensation data. Widening only
-- the vocabulary constraint would therefore have this value rejected on almost
-- exactly the rows it exists for.
--
-- That constraint's own comment states the principle it enforces: it "binds
-- only rows that make a positive claim about assurance". `not_applicable` makes
-- no such claim — it denies that assurance is the right question — and its
-- justification is the row's own `dataset_type`, not an outside document. So it
-- belongs on the exempt side of that rule for the same reason `unknown` does.
--
-- ⚠ The alternative was considered and rejected: back-filling a source_url onto
-- 7,753 payroll rows would invent an evidence trail for a grade that rests on
-- no evidence, which is the failure this constraint exists to prevent.
--
-- ⚠ The rule is UNCHANGED for every value that does claim assurance. A row
-- graded audited_gaap, audited_ocboa, compiled_from_audited or
-- self_reported_unaudited still cannot be written without a non-empty
-- source_url, and scripts/stampAuditGrade.mjs still refuses to attempt one.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────────
--
-- Both statements WIDEN a CHECK. Neither can invalidate a stored row: every
-- currently permitted value and every currently permitted (grade, source_url)
-- pair remains permitted. No row changes and no backfill is performed here —
-- the 7,932 rows are stamped separately, after this lands.

ALTER TABLE treasury.budgets
  DROP CONSTRAINT budgets_audit_grade_check;

ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_audit_grade_check
  CHECK (audit_grade IN (
    'audited_gaap',
    'audited_ocboa',
    'compiled_from_audited',
    'self_reported_unaudited',
    'unknown',
    'not_applicable'
  ));

ALTER TABLE treasury.budgets
  DROP CONSTRAINT budgets_graded_rows_need_a_source_url;

ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_graded_rows_need_a_source_url
  CHECK (
    audit_grade = 'unknown'
    OR audit_grade = 'not_applicable'
    OR (source_url IS NOT NULL AND source_url <> '')
  );
