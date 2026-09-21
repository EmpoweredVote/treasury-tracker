-- =============================================================================
-- Close anonymous EXECUTE on six new treasury SECURITY DEFINER functions
-- =============================================================================
-- Created 2026-09-21. Source: CTO weekly review 2026-09-21, task
-- ev-cto/tasks/2026-09-21-anon-execute-new-treasury-functions.md.
--
-- Six SECURITY DEFINER functions added 2026-09-16..2026-09-18 (the stable-key
-- loader-identity work and the frozen-figure snapshot) were callable by the
-- `anon` role — the public, unauthenticated role whose publishable key ships
-- inside EV's browser bundles. Three of them WRITE: treasury_ensure_municipality
-- creates a municipality row, treasury_register_source_key attaches a publisher
-- key, and capture_frozen_snapshot DELETEs and re-INSERTs all ~62,587 rows of the
-- frozen-figure localizer snapshot. The other three READ (detect_forked_entities,
-- treasury_frozen_figure_drift, treasury_unkeyed_entities).
--
-- ⚠ IMPORTANT — the grant comes from PUBLIC, not from an explicit anon grant.
-- This is the SAME defect as watchlist #61 (closed 2026-09-10), one class down:
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and `anon` is a member of
-- PUBLIC. Each of the seven creating migrations granted EXECUTE to service_role
-- and to nobody else — the exposure was never intended — but nothing revoked the
-- PUBLIC default. Measured live 2026-09-21 (pg_proc.proacl); all seven rows read
--   {=X/postgres, postgres=X/postgres, service_role=X/postgres}
-- The leading `=X/postgres` is the grant to PUBLIC. So a `REVOKE ... FROM anon,
-- authenticated` ALONE would be a NO-OP — there is no explicit anon grant to
-- remove and the PUBLIC grant would stay. The correct close is to revoke PUBLIC.
--
-- Six functions, SEVEN rows: capture_frozen_snapshot exists as both the public
-- PostgREST-facing wrapper and its treasury-schema implementation, and both are
-- exposed (treasury is a served schema — pgrst.db_schemas, verified 2026-09-21).
--
-- ── `authenticated`: revoked too, deliberately ─────────────────────────────
-- No EV front end calls any of these as a signed-in user. Every caller is a
-- loader/verifier script or Edge Function running as service_role
-- (scripts/lib/ensureMunicipality.mjs, scripts/registerMnOsaEntityKeys.mjs,
-- scripts/checkForkedEntities.mjs, scripts/loadMNOSA.js, scripts/captureFrozen-
-- Snapshot.mjs, scripts/checkFrozenInvariant.mjs — all build the client from
-- SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY and refuse to run without it,
-- verified in source 2026-09-21). So `authenticated` is revoked as well; keeping
-- it would leave these callable by any signed-in account for no reason. This
-- also clears the six from advisor 0029 (authenticated_security_definer_...).
--
-- service_role keeps its own explicit grant, and is re-granted below to be
-- unmistakable. postgres (the owner) is unaffected.
--
-- What is NOT at risk: no user identity, no compass answers, no Connect profile
-- data — every object here is public budget / publisher-identity metadata for
-- Treasury Tracker. This is a data-integrity and defacement risk on EV's public
-- transparency record, not a privacy breach.
--
-- Idempotent: REVOKE/GRANT are declarative. Applies to the shared project
-- kxsdzaojfaibhuzmclfq ("E.V Backend").
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.treasury_ensure_municipality(text, text, text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_register_source_key(text, text, text, text, text)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_frozen_snapshot(text)                                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION treasury.capture_frozen_snapshot(text)                                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_forked_entities()                                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_frozen_figure_drift()                                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_unkeyed_entities(text, text, text)                         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.treasury_ensure_municipality(text, text, text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_register_source_key(text, text, text, text, text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_frozen_snapshot(text)                                       TO service_role;
GRANT EXECUTE ON FUNCTION treasury.capture_frozen_snapshot(text)                                     TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_forked_entities()                                            TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_frozen_figure_drift()                                      TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_unkeyed_entities(text, text, text)                         TO service_role;

-- =============================================================================
-- Post-verify gate — abort the migration if anything is not as intended.
-- =============================================================================
-- This runs live at apply time: anon and authenticated must NOT execute any of
-- the seven; service_role MUST. It is the authoritative live check — the CI
-- guard (tests/definerFunctionGrants.test.mjs) reasons about migration text and
-- cannot see live ACLs, so this DO block is what proves the grant is actually
-- gone in the database it runs against.
DO $$
DECLARE
  fn   text;
  bad  int := 0;
  fns  text[] := ARRAY[
    'public.treasury_ensure_municipality(text, text, text, integer, text, text)',
    'public.treasury_register_source_key(text, text, text, text, text)',
    'public.capture_frozen_snapshot(text)',
    'treasury.capture_frozen_snapshot(text)',
    'public.detect_forked_entities()',
    'public.treasury_frozen_figure_drift()',
    'public.treasury_unkeyed_entities(text, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN
      bad := bad + 1; RAISE WARNING 'anon can still EXECUTE %', fn;
    END IF;
    IF has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      bad := bad + 1; RAISE WARNING 'authenticated can still EXECUTE %', fn;
    END IF;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      bad := bad + 1; RAISE WARNING 'service_role LOST EXECUTE on %', fn;
    END IF;
  END LOOP;

  IF bad > 0 THEN
    RAISE EXCEPTION 'revoke-anon-execute migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK — anon/authenticated EXECUTE revoked on 7 rows (6 treasury SECURITY DEFINER functions); service_role retained';
END $$;
