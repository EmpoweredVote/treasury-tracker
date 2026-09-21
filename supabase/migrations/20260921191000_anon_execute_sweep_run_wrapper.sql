-- A public wrapper so the sweep can be re-run through PostgREST.
--
-- Split from 20260921190000_anon_execute_live_sweep.sql because that migration
-- was applied first and this followed; the files mirror the order they actually
-- ran in rather than being collapsed after the fact (same convention as
-- 20260828000300_frozen_invariant_check_runner.sql).
--
-- Why it is needed: treasury.run_anon_execute_sweep() lives in the treasury
-- schema, and scripts/verifyAnonExecute.mjs builds a default-schema PostgREST
-- client like every other script here. Without a public.treasury_* wrapper the
-- `--run` flag could not work, and reading last Monday's verdict right after
-- applying a migration is reading a stale answer by definition — exactly the
-- mistake this whole sweep exists to prevent.
--
-- service_role only, like everything else in this design.

CREATE OR REPLACE FUNCTION public.treasury_run_anon_execute_sweep()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = treasury, public, pg_catalog
AS $fn$
  SELECT treasury.run_anon_execute_sweep();
$fn$;

COMMENT ON FUNCTION public.treasury_run_anon_execute_sweep() IS
  'Re-runs the anon-EXECUTE sweep on demand (npm run verify:grants -- --run). The scheduled path is the pg_cron job anon-execute-sweep-weekly.';

REVOKE EXECUTE ON FUNCTION public.treasury_run_anon_execute_sweep() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.treasury_run_anon_execute_sweep() TO service_role;

-- Post-verify: the wrapper must work, must not be exposed, and must not itself
-- become the sweep's first finding.
DO $blk$
DECLARE bad int := 0; v_ok boolean;
BEGIN
  IF has_function_privilege('anon', 'public.treasury_run_anon_execute_sweep()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.treasury_run_anon_execute_sweep()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'the run wrapper is executable by anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.treasury_run_anon_execute_sweep()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'service_role cannot execute the run wrapper';
  END IF;

  -- Exercise it for real, then confirm the sweep still reads clean - i.e. the
  -- wrapper did not just add an exposure of its own.
  PERFORM public.treasury_run_anon_execute_sweep();
  SELECT ok INTO v_ok FROM public.treasury_anon_execute_status();
  IF NOT v_ok THEN
    bad := bad + 1; RAISE WARNING 'sweep is not ok after adding the run wrapper';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'anon-execute run wrapper migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - public.treasury_run_anon_execute_sweep() available to service_role only; sweep still clean';
END $blk$;
