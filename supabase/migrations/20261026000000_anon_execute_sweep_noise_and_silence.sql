-- =============================================================================
-- anon-EXECUTE sweep: quiet when nothing is wrong, loud when something is
-- =============================================================================
-- Created 2026-10-26. Task: ev-cto tasks/2026-09-28-anon-execute-sweep-noise-and-silence.md
--
-- ── The noise ──────────────────────────────────────────────────────────────
-- Every weekly run since 2026-09-28 reported ok=false. The "new exposures" were
-- inform.certifications_immutable(), inform.gold_labels_append_only() and (from
-- 2026-10-19) inform.compass_revision_inherit_guidance() -- all RETURNS trigger.
-- Postgres refuses a direct call of a trigger function and PostgREST does not
-- expose them as /rpc endpoints, so they are not an exposure. The 2026-09-21
-- seed already knew this: 21 of its 37 baseline rows are trigger functions,
-- accepted one by one. Accepting each new one by hand is the wrong fix -- the
-- next trigger function fires the same alarm. So the scanner now skips trigger
-- and event_trigger functions, and the 21 baseline rows that only existed to
-- excuse them are pruned (left in place they would report as BASELINE ENTRY
-- GONE on every run).
--
-- ── The silence ────────────────────────────────────────────────────────────
-- run_anon_execute_sweep() writes ok=false and returns normally, so pg_cron
-- records `succeeded` and nothing that watches cron failures can see it. The
-- daily orchestrator logs it with console.error, which nobody reads either.
--
-- A RAISE inside run_anon_execute_sweep() would roll back its own history row.
-- Putting both statements in ONE cron command is not safe either: pg_cron sends
-- the command as a single simple query, which Postgres runs as ONE implicit
-- transaction, so the second statement's error would roll back the first
-- statement's INSERT. Hence a SEPARATE job a minute later that only reads:
--   02:47 anon-execute-sweep-weekly  -> writes the verdict row (unchanged)
--   02:48 anon-execute-sweep-assert  -> RAISEs if that row is not ok, or if
--                                       there is no row from the last hour
-- The freshness rule means a sweep that stopped running also fails the assert
-- job instead of passing on last week's row. A missing verdict is not a pass.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Part 1 -- the scanner skips trigger functions
-- =============================================================================
CREATE OR REPLACE FUNCTION treasury.anon_executable_functions()
RETURNS TABLE (
  signature      text,
  secdef         boolean,
  anon_exec      boolean,
  authed_exec    boolean,
  acl            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         p.prosecdef,
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         COALESCE(p.proacl::text, '(null = built-in default: PUBLIC EXECUTE)')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'civic_spaces', 'connect', 'empower', 'inform',
                       'graphql_public', 'validation_quests', 'treasury', 'civic')
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   ORDER BY 1;
$$;

COMMENT ON FUNCTION treasury.anon_executable_functions() IS
  'Every non-extension, non-trigger function in a PostgREST-exposed schema that anon or authenticated can EXECUTE. Extension-owned functions are excluded deliberately; treasury.anon_execute_excluded_extension_count() reports how many. Trigger and event_trigger functions are excluded because they cannot be called directly or through PostgREST (2026-10-26).';

-- CREATE OR REPLACE keeps the ACL; re-asserted so the static guard sees it.
REVOKE EXECUTE ON FUNCTION treasury.anon_executable_functions() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.anon_executable_functions() TO service_role;

-- =============================================================================
-- Part 2 -- prune the baseline rows that only excused trigger functions
-- =============================================================================
-- Matched on the scanner's own signature text. Not to_regprocedure(): the
-- signature carries argument NAMES ("p_user_id text"), which it rejects.
DELETE FROM treasury.anon_execute_baseline b
 USING pg_proc p
 JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE b.signature = n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
   AND p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype);

-- =============================================================================
-- Part 3 -- the assert that makes a failed sweep a failed cron run
-- =============================================================================
CREATE OR REPLACE FUNCTION treasury.assert_last_anon_sweep_ok()
RETURNS void
LANGUAGE plpgsql
SET search_path = treasury, pg_catalog
AS $$
DECLARE
  v_last treasury.anon_execute_runs%ROWTYPE;
BEGIN
  -- id breaks ties: two sweeps in one transaction share now(), so ran_at alone
  -- can pick the older, clean row (caught by the rolled-back prod test).
  SELECT * INTO v_last FROM treasury.anon_execute_runs ORDER BY ran_at DESC, id DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'anon-EXECUTE sweep: no verdict has ever been recorded. INCONCLUSIVE, not a pass.';
  END IF;

  IF v_last.ran_at < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'anon-EXECUTE sweep: the newest verdict is from %, not from this run. Check the anon-execute-sweep-weekly pg_cron job.',
      v_last.ran_at;
  END IF;

  IF NOT v_last.ok THEN
    RAISE EXCEPTION 'anon-EXECUTE sweep NOT OK (run at %): %', v_last.ran_at, v_last.detail;
  END IF;
END;
$$;

COMMENT ON FUNCTION treasury.assert_last_anon_sweep_ok() IS
  'Raises when the newest treasury.anon_execute_runs row is not ok or is over an hour old. Run by the anon-execute-sweep-assert pg_cron job a minute after the sweep, so a failed sweep is a failed cron run.';

-- Without this the sweep would report its own assert as a new exposure.
REVOKE EXECUTE ON FUNCTION treasury.assert_last_anon_sweep_ok() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.assert_last_anon_sweep_ok() TO service_role;

-- =============================================================================
-- Part 4 -- schedule the assert
-- =============================================================================
SELECT cron.unschedule('anon-execute-sweep-assert')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anon-execute-sweep-assert');

SELECT cron.schedule('anon-execute-sweep-assert', '48 2 * * 1',
                     $cron$SELECT treasury.assert_last_anon_sweep_ok()$cron$);

-- =============================================================================
-- Post-verify gate
-- =============================================================================
DO $$
DECLARE
  bad      int := 0;
  v_latest record;
  v_n      int;
BEGIN
  SELECT count(*) INTO v_n
    FROM treasury.anon_executable_functions() f
    JOIN pg_proc p ON true
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE f.signature = n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
     AND p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype);
  IF v_n > 0 THEN
    bad := bad + 1; RAISE WARNING 'the scanner still lists % trigger function(s)', v_n;
  END IF;

  -- Positive control: skipping triggers must not empty the scanner.
  IF (SELECT count(*) FROM treasury.anon_executable_functions()) = 0 THEN
    bad := bad + 1; RAISE WARNING 'the scanner found ZERO exposures, which means it is not looking';
  END IF;

  IF has_function_privilege('anon', 'treasury.assert_last_anon_sweep_ok()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'treasury.assert_last_anon_sweep_ok()', 'EXECUTE')
     OR has_function_privilege('anon', 'treasury.anon_executable_functions()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'the sweep exposed ITS OWN functions to anon/authenticated';
  END IF;

  PERFORM treasury.run_anon_execute_sweep();
  SELECT * INTO v_latest FROM public.treasury_anon_execute_status();
  IF v_latest IS NULL OR NOT v_latest.ok OR v_latest.new_count <> 0 OR v_latest.gone_count <> 0 THEN
    bad := bad + 1; RAISE WARNING 'sweep after the fix is not clean: %', v_latest.detail;
  ELSE
    PERFORM treasury.assert_last_anon_sweep_ok();
  END IF;

  IF (SELECT count(*) FROM cron.job
       WHERE active AND jobname IN ('anon-execute-sweep-weekly', 'anon-execute-sweep-assert')) <> 2 THEN
    bad := bad + 1; RAISE WARNING 'the sweep and assert jobs are not both scheduled and active';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'anon-execute sweep noise/silence migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - sweep clean (% live exposures, 0 new, 0 gone), assert scheduled at 02:48 Mondays',
    v_latest.live_count;
END $$;
