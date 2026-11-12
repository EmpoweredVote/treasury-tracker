-- A payment or payroll register is not a financial statement, so the audit
-- question does not APPLY to it. That answer is a property of the row's SHAPE
-- (`dataset_type`), not a judgement about any publisher — which is exactly why
-- scripts/stampNotApplicableGrade.mjs answers it from dataset_type and why
-- tests/auditGradeRegistry.test.mjs pins `not_applicable` OUT of the registry:
-- "a registry entry would dress a row-shape fact as a publisher judgement, and
-- would have to be repeated for all 26 salary and transaction sources and every
-- future one."
--
-- ⚠⚠ THE PROBLEM THIS FIXES: that stamper is a ONE-SHOT SWEEP and nothing
-- re-runs it. Measured 2026-11-12, thirteen days after it last ran, 27 of 43
-- `transactions` rows had decayed back to `unknown` — 14 created by the
-- 2026-11-08 load wave and 13 re-written by cron syncs since, every one landing
-- on the column default. The grade did not drift; it was never applied to a row
-- written after the sweep. A sweep that must be remembered is a sweep that will
-- be forgotten, and this is what `verify:provenance` was failing over.
--
-- ⚠ A FILLER, NOT AN OVERRIDE. It acts only when the incoming value is NULL or
-- `unknown` — the two spellings of "nobody said". An explicit grade on one of
-- these rows is left exactly as written, so it can never overwrite a considered
-- answer. Verified live on four cases before shipping: insert-at-default fills,
-- update-back-to-unknown refills, an explicit `audited_gaap` is preserved, and
-- an `operating` row is untouched.
--
-- ⚠ THE LIST IS AN ALLOW-LIST, mirroring NOT_APPLICABLE_DATASET_TYPES in
-- scripts/stampNotApplicableGrade.mjs and SHAPE_ANSWERED_DATASET_TYPES in
-- scripts/lib/provenanceDebt.mjs. Written the other way round — "anything that
-- is not operating or revenue" — a new statement-shaped dataset_type would be
-- claimed by this value the day it was added and would quietly deny that the
-- audit question applies to it.
--
-- The `budgets_graded_rows_need_a_source_url` constraint already exempts
-- `not_applicable` (migration 20261030000000), so this writes nothing that
-- constraint would reject.
--
-- ⚠ If this trigger is ever dropped, `verify:provenance` fails with
-- "N shape-answered row(s) have fallen back to audit_grade='unknown'" and names
-- the families. That check was proved to fire before it shipped.

create or replace function treasury.fill_not_applicable_audit_grade()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if NEW.dataset_type in ('salaries', 'transactions')
     and (NEW.audit_grade is null or NEW.audit_grade = 'unknown') then
    NEW.audit_grade := 'not_applicable';
  end if;
  return NEW;
end;
$function$;

drop trigger if exists budgets_fill_not_applicable_audit_grade on treasury.budgets;

create trigger budgets_fill_not_applicable_audit_grade
  before insert or update on treasury.budgets
  for each row
  execute function treasury.fill_not_applicable_audit_grade();
