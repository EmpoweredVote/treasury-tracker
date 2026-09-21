-- =============================================================================
-- service_role cannot write the budget_total_changes audit row
-- =============================================================================
-- Created 2026-09-21. Found while making the EV loaders update their budget row
-- in place instead of deleting and recreating it.
--
-- ── The defect ────────────────────────────────────────────────────────────
-- treasury.stamp_budget_write_time() (trigger on treasury.budgets, added
-- 2026-09-18 by 20260918022218_stamp_budget_write_time.sql) writes an audit row
-- ONLY on UPDATE:
--
--     IF TG_OP = 'INSERT' THEN ... RETURN NEW; END IF;      -- no audit row
--     IF NEW.total_budget IS DISTINCT FROM OLD.total_budget THEN
--       INSERT INTO treasury.budget_total_changes (...)     -- audit row
--     END IF;
--
-- but treasury.budget_total_changes grants service_role SELECT only:
--
--     postgres=arwdDxtm | anon=r | authenticated=r | ev_api=arwd | service_role=r
--
-- So ANY update of budgets.total_budget performed AS service_role fails with
--     ERROR: permission denied for table budget_total_changes
-- Measured live 2026-09-21 against a scratch fiscal year.
--
-- ⚠ RLS IS NOT THE CAUSE, so adding a policy would not fix it. service_role has
-- rolbypassrls = true (verified). It is the missing INSERT grant.
--
-- ── Why nobody noticed for three days ─────────────────────────────────────
-- Two reasons, and both are the "it only fires on the path nobody took" shape:
--
--  1. public.treasury_sync_city_budget -- which is how essentially every
--     government row is written -- is SECURITY DEFINER, so it runs as postgres
--     and has the grant. The nightly syncs were never affected.
--  2. The EV loaders DELETED the budgets row and INSERTED a replacement, and
--     the trigger writes no audit row on INSERT. The only writer left on the
--     UPDATE path is the live Givebutter webhook.
--
-- ⚠⚠ SO THE GIVEBUTTER DONATION WEBHOOK HAS BEEN BROKEN SINCE 2026-09-18.
-- supabase/functions/givebutter-webhook calls treasury.record_givebutter_donation,
-- which is SECURITY INVOKER (prosecdef = false, verified) and therefore runs as
-- service_role. Its
--     UPDATE treasury.budgets SET total_budget = total_budget + p_amount
-- fires the trigger and fails. A real donation arriving by webhook errors out.
-- This is a live defect found incidentally; it is NOT caused by the in-place
-- loader change, which merely put a second writer on the same path.
--
-- ── The fix ───────────────────────────────────────────────────────────────
-- Grant INSERT only. The table is an append-only audit trail: service_role gets
-- no UPDATE and no DELETE, so it can record a change and never revise one.
-- ev_api already holds arwd. anon and authenticated are untouched and cannot
-- reach it anyway -- they hold only SELECT on treasury.budgets, so they cannot
-- fire the trigger.
--
-- ⚠ Considered and rejected: making stamp_budget_write_time() SECURITY DEFINER
-- so the audit row is written regardless of caller. That would work, but it
-- makes the audit trail writable by anyone who can update budgets, and it adds
-- another SECURITY DEFINER function in an exposed schema for the sweep to carry.
-- The grant is the smaller change, and the failure mode it leaves is LOUD
-- (permission denied), not silent -- a future role that can update budgets but
-- cannot write the audit row fails visibly rather than losing the audit row.
-- -----------------------------------------------------------------------------

GRANT INSERT ON treasury.budget_total_changes TO service_role;

-- ⚠ THE INSERT GRANT ALONE IS NOT ENOUGH. budget_total_changes has a bigserial
-- id, and filling a serial default requires USAGE on its sequence. Without this
-- the very same UPDATE fails one step later with
--     ERROR: permission denied for sequence budget_total_changes_id_seq
-- Caught by this migration's own end-to-end block on the first apply attempt,
-- which is the argument for exercising the real write path rather than asserting
-- on has_table_privilege alone -- the privilege check passed while the write
-- still failed.
GRANT USAGE ON SEQUENCE treasury.budget_total_changes_id_seq TO service_role;

-- =============================================================================
-- Post-verify gate -- prove the write path works AS service_role, and that the
-- audit row is actually produced.
-- =============================================================================
DO $blk$
DECLARE
  bad        int := 0;
  v_muni     uuid;
  v_budget   uuid;
  v_audit_before bigint;
  v_audit_after  bigint;
BEGIN
  IF NOT has_table_privilege('service_role', 'treasury.budget_total_changes', 'INSERT') THEN
    bad := bad + 1; RAISE WARNING 'service_role still cannot INSERT into budget_total_changes';
  END IF;

  -- Append-only: no revising history.
  IF has_table_privilege('service_role', 'treasury.budget_total_changes', 'UPDATE')
     OR has_table_privilege('service_role', 'treasury.budget_total_changes', 'DELETE') THEN
    bad := bad + 1; RAISE WARNING 'service_role can UPDATE/DELETE the audit trail - it must be append-only';
  END IF;

  -- End-to-end on a scratch fiscal year that cannot collide with real data.
  SELECT id INTO v_muni FROM treasury.municipalities WHERE name = 'Empowered Vote';
  IF v_muni IS NULL THEN
    bad := bad + 1; RAISE WARNING 'Empowered Vote municipality not found - cannot run the end-to-end check';
  ELSE
    SELECT count(*) INTO v_audit_before FROM treasury.budget_total_changes;

    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget,
                                  data_source, hierarchy, fiscal_year_start_month)
    VALUES (v_muni, 1901, 'operating', 1.00, 'grant-check scratch', ARRAY['Category'], 1)
    RETURNING id INTO v_budget;

    -- ⚠ The actual failing operation: an UPDATE of total_budget as service_role.
    SET LOCAL ROLE service_role;
    UPDATE treasury.budgets SET total_budget = 2.00 WHERE id = v_budget;
    RESET ROLE;

    SELECT count(*) INTO v_audit_after FROM treasury.budget_total_changes;
    IF v_audit_after <> v_audit_before + 1 THEN
      bad := bad + 1;
      RAISE WARNING 'the audit row was not written: % -> %', v_audit_before, v_audit_after;
    END IF;

    -- ⚠ Clean up unconditionally. A stray budgets row enters the frozen digest
    -- and would turn the invariant red for a reason nobody could trace.
    DELETE FROM treasury.budget_total_changes WHERE budget_id = v_budget;
    DELETE FROM treasury.budgets WHERE id = v_budget;

    IF EXISTS (SELECT 1 FROM treasury.budgets WHERE fiscal_year = 1901) THEN
      bad := bad + 1; RAISE WARNING 'scratch budget row survived cleanup';
    END IF;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'budget_total_changes grant migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - service_role can append to budget_total_changes; UPDATE of total_budget works and is audited; scratch row removed';
END $blk$;
