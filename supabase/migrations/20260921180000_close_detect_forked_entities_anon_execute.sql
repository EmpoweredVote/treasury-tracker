-- =============================================================================
-- Close treasury.detect_forked_entities(), the schema twin PR #200 missed,
-- and record a MEASURED negative result about the defect class behind #61/#74.
-- =============================================================================
-- Created 2026-09-21, immediately after PR #200
-- (20260921000000_revoke_anon_execute_new_treasury_definer_functions.sql).
--
-- ── Part 1: the function PR #200 missed ────────────────────────────────────
-- treasury.detect_forked_entities() is still anon-EXECUTE-able. PR #200
-- correctly found that capture_frozen_snapshot exists in BOTH public and
-- treasury and revoked both rows, but did not run the same schema-twin sweep
-- for detect_forked_entities.
--
-- Severity is low and the reason matters: it is SECURITY INVOKER, not DEFINER,
-- so there is no privilege escalation, and anon measurably gets 0 rows from it
-- today (verified 2026-09-21 via SET LOCAL ROLE anon). But it returns 0 rows
-- ONLY because treasury.municipalities happens to carry RLS-enabled-with-zero-
-- policies. treasury.budgets, which the same query joins, carries
-- `budgets: public read` USING (true). If municipalities ever gets that same
-- policy -- plausible; municipality names are public data and a future
-- contributor has every reason to add it -- this function begins answering
-- anonymous callers with internal duplicate-entity review state. Worse, its
-- `NOT EXISTS` exclusion against the (still denied) municipality_fork_reviews
-- table would silently stop applying, so the output would also be wrong.
--
-- Close it by grant rather than leave it resting on a neighbouring table's RLS.
--
-- ── Part 2: MEASURED NEGATIVE RESULT -- do not retry this ──────────────────
-- ⛔ `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
--    DOES NOT WORK on this Supabase instance. Do not add it and assume it holds.
--
-- The intent was to fix the class at the source: CREATE FUNCTION grants EXECUTE
-- to PUBLIC by default, so every new function lands exposed unless something
-- revokes it. The documented control is a default-privilege revoke. Measured
-- 2026-09-21, as role postgres, across THREE separate committed transactions:
--
--   1. ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA treasury
--        REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;          -- succeeds, no error
--   2. SELECT defaclacl FROM pg_default_acl ...  -> {service_role=X/postgres}
--        i.e. UNCHANGED. No PUBLIC-suppression is recorded in the catalog.
--   3. CREATE FUNCTION treasury._acl_probe2() ...
--      -> proacl {=X/postgres,postgres=X/postgres,service_role=X/postgres}
--      -> has_function_privilege('anon', ...) = TRUE
--
-- Same result in `public`, and same result in a brand-new empty schema with no
-- pre-existing default-ACL entry. The June control (ev-accounts migration
-- 20260616194832_secure_default_function_execute_privileges) is additive: its
-- GRANT to service_role does land on new functions, which is why service_role=X
-- appears above -- but the built-in PUBLIC default is applied independently and
-- the revoke never takes. That control has therefore never prevented this class.
--
-- The other database-level route, an event trigger on CREATE FUNCTION, is also
-- unavailable: this project's `postgres` role is NOT a superuser
-- (pg_roles.rolsuper = false, verified 2026-09-21) and event triggers require
-- superuser.
--
-- ⚠ CONSEQUENCE -- the static CI guard is the ONLY control standing between us
-- and the next instance of this defect. tests/definerFunctionGrants.test.mjs
-- reasons about migration TEXT; it cannot see a function created through the
-- Supabase MCP, the SQL editor or the dashboard, which is how the six functions
-- in #74 arrived. Two follow-ups are therefore open, NOT closed by this file:
--   (a) extend the guard to SECURITY INVOKER functions in served schemas --
--       this file's Part 1 is exactly the case the DEFINER-only guard missed;
--   (b) add a periodic LIVE privilege sweep (a script run against prod, not CI,
--       since this repo deliberately keeps no DB credential in GitHub Actions
--       -- PR #90) that fails on any anon-executable function in public/treasury
--       outside an explicit allowlist.
--
-- Idempotent: REVOKE/GRANT are declarative.
-- Applies to the shared project kxsdzaojfaibhuzmclfq ("E.V Backend").
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION treasury.detect_forked_entities() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.detect_forked_entities() TO service_role;

-- =============================================================================
-- Post-verify gate -- live, at apply time.
-- =============================================================================
DO $$
DECLARE
  bad int := 0;
BEGIN
  IF has_function_privilege('anon', 'treasury.detect_forked_entities()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'anon can still EXECUTE treasury.detect_forked_entities()';
  END IF;
  IF has_function_privilege('authenticated', 'treasury.detect_forked_entities()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'authenticated can still EXECUTE treasury.detect_forked_entities()';
  END IF;
  IF NOT has_function_privilege('service_role', 'treasury.detect_forked_entities()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'service_role LOST EXECUTE on treasury.detect_forked_entities()';
  END IF;

  -- Regression check: the seven rows closed by PR #200 must still be closed.
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef
         AND n.nspname IN ('public','treasury')
         AND p.proname IN ('treasury_ensure_municipality','treasury_register_source_key',
                           'capture_frozen_snapshot','detect_forked_entities',
                           'treasury_frozen_figure_drift','treasury_unkeyed_entities')
         AND has_function_privilege('anon', p.oid, 'EXECUTE')) > 0 THEN
    bad := bad + 1; RAISE WARNING 'PR #200 regressed -- an anon-executable SECURITY DEFINER function is back';
  END IF;

  -- No probe function from the 2026-09-21 default-privilege investigation may survive.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('_acl_probe_tmp','_acl_probe2')) THEN
    bad := bad + 1; RAISE WARNING 'an ACL probe function was left behind';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'detect_forked_entities revoke migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK -- treasury.detect_forked_entities() closed to anon/authenticated; PR #200 rows still closed; no probes left behind';
END $$;
