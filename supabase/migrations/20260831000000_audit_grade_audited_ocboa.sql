-- Knight session 8 — add `audited_ocboa` to the audit_grade vocabulary.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
--
-- Brown County, South Dakota is audited by the South Dakota Department of
-- Legislative Audit under Government Auditing Standards, and its statements are
-- titled `STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES -
-- MODIFIED CASH BASIS`. Its auditor's report states, verbatim:
--
--   "the financial statements are prepared on the modified cash basis of
--    accounting, which is a basis of accounting other than accounting
--    principles generally accepted in the United States of America"
--
-- The Federal Audit Clearinghouse agrees independently: `gaap_results` is
-- `not_gaap` on every filing.
--
-- None of the four existing values can carry that without lying:
--
--   audited_gaap             matches the value's written definition ("read
--                            directly from a report bearing an independent
--                            auditor's opinion") but its NAME asserts GAAP,
--                            which this document explicitly denies. The
--                            vocabulary's own docstring calls a wrong
--                            `audited_gaap` "a false public claim about a
--                            government's books".
--   unknown                  means NOBODY HAS LOOKED. Somebody did.
--   self_reported_unaudited  denies a real independent audit.
--   compiled_from_audited    wrong shape entirely; nobody compiled anything.
--
-- ⚠ ASSURANCE IS NOT COMPARABILITY. `audited_ocboa` sits directly below
-- `audited_gaap` in the ladder because the ASSURANCE is equivalent while the
-- measurement basis is not. A reader comparing an OCBOA General Fund against a
-- GAAP one is comparing two different things, and this value exists to say so.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────────
--
-- This WIDENS a CHECK constraint. It cannot invalidate an existing row: every
-- currently stored value remains permitted, so no row changes and no backfill
-- is performed. `audit_grade` is not yet surfaced by ev-accounts, so there is no
-- reader-facing change today.
--
-- ⚠ The companion constraint from 20260828000100 still applies unchanged: any
-- non-`unknown` audit_grade requires a source_url on the row. `audited_ocboa`
-- inherits that requirement — evidence is not optional for this value either.

ALTER TABLE treasury.budgets
  DROP CONSTRAINT budgets_audit_grade_check;

ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_audit_grade_check
  CHECK (audit_grade IN (
    'audited_gaap',
    'audited_ocboa',
    'compiled_from_audited',
    'self_reported_unaudited',
    'unknown'
  ));
