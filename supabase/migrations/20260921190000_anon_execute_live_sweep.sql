-- =============================================================================
-- Live anon-EXECUTE sweep: the control that would actually have caught #74
-- =============================================================================
-- Created 2026-09-21. Follow-up (b) named in
-- 20260921180000_close_detect_forked_entities_anon_execute.sql.
--
-- ── Why a LIVE sweep, when a static CI guard already exists ────────────────
-- tests/definerFunctionGrants.test.mjs reasons about migration TEXT. It cannot
-- see a function created through the Supabase MCP, the SQL editor or the
-- dashboard -- which is exactly how the six functions in watchlist #74 arrived.
-- It is also DEFINER-only, so it missed treasury.detect_forked_entities (#204).
-- Only a live privilege read closes both gaps.
--
-- ── Why it runs INSIDE the database ───────────────────────────────────────
-- Same reason the frozen-figure invariant moved here: a service-role key, which
-- bypasses RLS entirely, must not travel into GitHub Actions (PR #90, and the
-- disabled schedule in frozen-invariant-watch.yml documents the rule). On
-- pg_cron no credential travels and no rows cross the network.
--
-- ⚠⚠ ── THE LESSON THIS DESIGN IS BUILT AROUND ──────────────────────────────
-- On 2026-09-21 the frozen-figure invariant was found to have failed on
-- 2026-09-07, -14 AND -21 -- three consecutive weeks, ok=false each time --
-- with nobody informed. Its pg_cron job fired perfectly and wrote each verdict
-- into treasury.frozen_invariant_runs, which NOTHING in the repo reads, and the
-- workflow that would have opened an issue was disabled for want of a
-- credential. The check worked and reported into a void.
--
-- So this sweep does not merely record a verdict. It is READ on every daily
-- orchestrator run via public.treasury_anon_execute_status(), and
-- scripts/lib/anonExecuteSweep.mjs treats a MISSING or STALE verdict as a
-- failure rather than a pass. A sweep that quietly stops running must not look
-- clean. That rule is unit-tested and was mutation-tested (red when staleness
-- is disabled, green with it).
--
-- ── Scope: all nine exposed schemas, baseline-diffed ──────────────────────
-- Founder decision 2026-09-21. The shared project also serves ev-accounts
-- schemas; rather than exclude them (an exposure nobody watches) or alert on
-- them forever (noise that gets ignored), every currently-exposed function is
-- recorded as an ACCEPTED BASELINE with a written reason, and the sweep alerts
-- only on what is NEW or CHANGED.
--
-- ⚠ Extension-owned functions are EXCLUDED (pg_depend deptype='e'). 932 of the
-- 972 live exposures are pgcrypto/uuid-ossp/pg_trgm/unaccent functions that
-- CREATE EXTENSION installed into `public` and that are governed by the
-- extension, not by us. Including them would bury the 40 that matter. The
-- scanner REPORTS the excluded count so the exclusion cannot silently grow to
-- hide something -- an exclusion you cannot see is an allowlist without a
-- reason.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Part 1 -- close three more treasury-schema twins PR #200 left open
-- =============================================================================
-- The live scan found these immediately, which is the sweep earning its place.
-- Same defect as #204: PR #200 closed the `public` SECURITY DEFINER wrappers
-- but not the treasury-schema implementations behind them. All three are
-- SECURITY INVOKER (so no privilege escalation, and RLS currently blocks what
-- they would do), and all three have no caller that is not service_role
-- (verified in source 2026-09-21):
--   treasury.attach_source_key          -- WRITES a publisher key. Called only
--     from public.treasury_register_source_key, itself service_role-only.
--   treasury.record_givebutter_donation -- WRITES a donation row. Called only
--     by supabase/functions/givebutter-webhook, which builds its client from
--     SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY with db.schema=treasury.
--   treasury.frozen_figure_drift        -- reads. Scripts call the public
--     wrapper (scripts/checkFrozenInvariant.mjs), which #200 already closed.
-- Closed by grant rather than recorded as "accepted" in the baseline below --
-- an allowlist entry over a known hole is just a way to hide it.

REVOKE EXECUTE ON FUNCTION treasury.attach_source_key(uuid, text, text, text)                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION treasury.frozen_figure_drift()                                                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION treasury.record_givebutter_donation(text, uuid, uuid, uuid, text, numeric, date, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION treasury.attach_source_key(uuid, text, text, text)                              TO service_role;
GRANT EXECUTE ON FUNCTION treasury.frozen_figure_drift()                                                  TO service_role;
GRANT EXECUTE ON FUNCTION treasury.record_givebutter_donation(text, uuid, uuid, uuid, text, numeric, date, text) TO service_role;

-- =============================================================================
-- Part 2 -- the scanner
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
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   ORDER BY 1;
$$;

COMMENT ON FUNCTION treasury.anon_executable_functions() IS
  'Every non-extension function in a PostgREST-exposed schema that anon or authenticated can EXECUTE. Extension-owned functions are excluded deliberately; treasury.anon_execute_excluded_extension_count() reports how many, so the exclusion stays visible.';

-- The exclusion must be observable. A silent filter is how a sweep starts
-- reporting "nothing found" while looking at nothing.
CREATE OR REPLACE FUNCTION treasury.anon_execute_excluded_extension_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'civic_spaces', 'connect', 'empower', 'inform',
                       'graphql_public', 'validation_quests', 'treasury', 'civic')
     AND EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
$$;

-- =============================================================================
-- Part 3 -- the accepted baseline
-- =============================================================================
CREATE TABLE IF NOT EXISTS treasury.anon_execute_baseline (
  signature   text PRIMARY KEY,
  reason      text NOT NULL CHECK (btrim(reason) <> ''),
  accepted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE treasury.anon_execute_baseline IS
  'Anon/authenticated-executable functions that are deliberately accepted. reason is NOT NULL and non-blank by CHECK: an accepted exposure with no written reason is just a hidden hole.';

CREATE TABLE IF NOT EXISTS treasury.anon_execute_runs (
  id         bigserial PRIMARY KEY,
  ran_at     timestamptz NOT NULL DEFAULT now(),
  live_count int  NOT NULL,
  new_count  int  NOT NULL,
  gone_count int  NOT NULL,
  ok         boolean NOT NULL,
  detail     text NOT NULL
);

ALTER TABLE treasury.anon_execute_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.anon_execute_runs     ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Part 4 -- the runner
-- =============================================================================
-- Mirrors treasury.run_frozen_invariant_check, including its most important
-- property: name the ACTUAL condition. Reporting one condition for another is
-- how the frozen invariant stopped being read.
CREATE OR REPLACE FUNCTION treasury.run_anon_execute_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = treasury, public, pg_catalog
AS $$
DECLARE
  v_live       int;
  v_new        text[];
  v_gone       text[];
  v_ok         boolean;
  v_detail     text;
  v_baseline_n int;
BEGIN
  SELECT count(*) INTO v_live FROM treasury.anon_executable_functions();
  SELECT count(*) INTO v_baseline_n FROM treasury.anon_execute_baseline;

  SELECT coalesce(array_agg(f.signature ORDER BY f.signature), '{}')
    INTO v_new
    FROM treasury.anon_executable_functions() f
   WHERE NOT EXISTS (SELECT 1 FROM treasury.anon_execute_baseline b WHERE b.signature = f.signature);

  SELECT coalesce(array_agg(b.signature ORDER BY b.signature), '{}')
    INTO v_gone
    FROM treasury.anon_execute_baseline b
   WHERE NOT EXISTS (SELECT 1 FROM treasury.anon_executable_functions() f WHERE f.signature = b.signature);

  -- ⚠ No baseline is INCONCLUSIVE, never a pass -- the same rule
  -- run_frozen_invariant_check applies when it has nothing to compare against.
  IF v_baseline_n = 0 AND v_live = 0 THEN
    v_ok := false;
    v_detail := 'No baseline recorded - nothing to compare against. This is INCONCLUSIVE, not a pass.';

  ELSIF array_length(v_new, 1) > 0 THEN
    v_ok := false;
    v_detail := format(
      'NEW EXPOSURE: %s function(s) are EXECUTE-able by anon or authenticated and are not in the '
      'accepted baseline: %s. Close each with REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC, anon, '
      'authenticated (the grant comes from the PUBLIC default, so revoking anon alone is a no-op). '
      'If one is genuinely meant to be public, add it to treasury.anon_execute_baseline WITH A REASON.',
      array_length(v_new, 1), array_to_string(v_new, ', '));

  ELSIF array_length(v_gone, 1) > 0 THEN
    v_ok := true;
    v_detail := format(
      'BASELINE ENTRY GONE: %s - no longer exposed. This is good news, not a failure. Prune the '
      'row so the baseline keeps meaning something.', array_to_string(v_gone, ', '));

  ELSE
    v_ok := true;
    v_detail := 'unchanged';
  END IF;

  INSERT INTO treasury.anon_execute_runs (live_count, new_count, gone_count, ok, detail)
  VALUES (v_live, coalesce(array_length(v_new, 1), 0), coalesce(array_length(v_gone, 1), 0), v_ok, v_detail);
END;
$$;

-- =============================================================================
-- Part 5 -- the status wrapper the orchestrator reads
-- =============================================================================
-- public.treasury_* because the orchestrator talks exclusively through those
-- wrappers with a default-schema client (supabase.rpc('treasury_...')).
CREATE OR REPLACE FUNCTION public.treasury_anon_execute_status()
RETURNS TABLE (ran_at timestamptz, ok boolean, detail text, live_count int, new_count int, gone_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = treasury, public, pg_catalog
AS $$
  SELECT r.ran_at, r.ok, r.detail, r.live_count, r.new_count, r.gone_count
    FROM treasury.anon_execute_runs r
   ORDER BY r.ran_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.treasury_anon_execute_status() IS
  'Latest anon-EXECUTE sweep verdict. Read by treasury-sync-orchestrator on every daily run. An EMPTY result means the sweep has never run, which scripts/lib/anonExecuteSweep.mjs treats as INCONCLUSIVE, not a pass.';

-- =============================================================================
-- Part 6 -- grants. These objects are INTERNAL: service_role only.
-- =============================================================================
-- ⚠ Dogfooding: every function created above is itself a SECURITY DEFINER
-- function in an exposed schema, so the PUBLIC default applies to it too. If
-- these revokes were forgotten the sweep would report ITSELF as a new exposure
-- on its first run. The post-verify block below asserts it does not.
REVOKE EXECUTE ON FUNCTION treasury.anon_executable_functions()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION treasury.anon_execute_excluded_extension_count()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION treasury.run_anon_execute_sweep()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_anon_execute_status()              FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION treasury.anon_executable_functions()                TO service_role;
GRANT EXECUTE ON FUNCTION treasury.anon_execute_excluded_extension_count()    TO service_role;
GRANT EXECUTE ON FUNCTION treasury.run_anon_execute_sweep()                   TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_anon_execute_status()               TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON treasury.anon_execute_baseline TO service_role;
GRANT SELECT, INSERT                 ON treasury.anon_execute_runs     TO service_role;
GRANT USAGE, SELECT ON SEQUENCE treasury.anon_execute_runs_id_seq      TO service_role;

-- =============================================================================
-- Part 7 -- seed the baseline from the current live state
-- =============================================================================
-- Reasons are DERIVED BY CATEGORY rather than hand-written 37 times, so every
-- entry's justification is auditable and none is a shrug. Anything that fits no
-- category ABORTS the migration below -- an unclassified exposure must be a
-- human decision, never an automatic acceptance.
-- Reads pg_proc directly rather than parsing a signature string back into a
-- regproc: that cast is ambiguous for overloaded functions and would fail or,
-- worse, match the wrong overload.
INSERT INTO treasury.anon_execute_baseline (signature, reason)
SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature,
       CASE
         WHEN p.prorettype = 'trigger'::regtype THEN
           'Trigger function. PostgREST does not expose RETURNS trigger as an RPC and it cannot be '
           'usefully invoked directly; EXECUTE is not checked when a trigger fires. Verified live 2026-09-21.'
         WHEN n.nspname IN ('civic_spaces', 'connect', 'inform', 'empower', 'validation_quests', 'civic') THEN
           'Belongs to ev-accounts, which owns this schema in the shared project (kxsdzaojfaibhuzmclfq). '
           'Governed by that repo, not by treasury-tracker. Recorded as accepted so this sweep alerts on '
           'CHANGE rather than on its mere existence. Verified live 2026-09-21.'
         WHEN n.nspname = 'graphql_public' AND p.proname = 'graphql' THEN
           'Supabase platform GraphQL entrypoint, owned by supabase_admin and intentionally anon-callable.'
         WHEN n.nspname = 'public' AND p.proname = 'f_unaccent' THEN
           'IMMUTABLE wrapper over extensions.unaccent used inside expression indexes. Reads no data and '
           'takes no privileged action; index builds require it to be callable.'
         ELSE NULL
       END AS reason
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname IN ('public', 'civic_spaces', 'connect', 'empower', 'inform',
                     'graphql_public', 'validation_quests', 'treasury', 'civic')
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   AND CASE
         WHEN p.prorettype = 'trigger'::regtype THEN true
         WHEN n.nspname IN ('civic_spaces', 'connect', 'inform', 'empower', 'validation_quests', 'civic') THEN true
         WHEN n.nspname = 'graphql_public' AND p.proname = 'graphql' THEN true
         WHEN n.nspname = 'public' AND p.proname = 'f_unaccent' THEN true
         ELSE false
       END
ON CONFLICT (signature) DO NOTHING;

-- =============================================================================
-- Part 8 -- schedule it
-- =============================================================================
-- Weekly, 20 minutes before the 03:07 daily orchestrator POST, so a fresh
-- verdict is always waiting to be read. CYCLE_DAYS in
-- scripts/lib/anonExecuteSweep.mjs must stay in step with this cadence.
SELECT cron.unschedule('anon-execute-sweep-weekly')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anon-execute-sweep-weekly');

SELECT cron.schedule('anon-execute-sweep-weekly', '47 2 * * 1',
                     $cron$SELECT treasury.run_anon_execute_sweep()$cron$);

-- =============================================================================
-- Post-verify gate -- run the sweep for real and prove it is armed and green.
-- =============================================================================
DO $$
DECLARE
  bad       int := 0;
  v_latest  record;
  v_unclass int;
  v_excl    bigint;
BEGIN
  -- Part 7's CASE must have classified everything. A NULL reason cannot even be
  -- inserted (NOT NULL), so an unclassified row shows up as a live exposure
  -- with no baseline entry -- which the sweep then reports. Check it directly
  -- so the failure names the real cause.
  SELECT count(*) INTO v_unclass
    FROM treasury.anon_executable_functions() f
   WHERE NOT EXISTS (SELECT 1 FROM treasury.anon_execute_baseline b WHERE b.signature = f.signature);
  IF v_unclass > 0 THEN
    bad := bad + 1;
    RAISE WARNING 'UNCLASSIFIED: % live exposure(s) fit no seed category and were not accepted. Classify them by hand.', v_unclass;
  END IF;

  -- The three treasury twins closed in Part 1 must be shut.
  IF has_function_privilege('anon', 'treasury.attach_source_key(uuid, text, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'treasury.frozen_figure_drift()', 'EXECUTE')
     OR has_function_privilege('anon', 'treasury.record_givebutter_donation(text, uuid, uuid, uuid, text, numeric, date, text)', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'a treasury twin from Part 1 is still anon-executable';
  END IF;
  IF NOT has_function_privilege('service_role', 'treasury.record_givebutter_donation(text, uuid, uuid, uuid, text, numeric, date, text)', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'service_role LOST EXECUTE on record_givebutter_donation - the Givebutter webhook would break';
  END IF;

  -- ⚠ Dogfood: the sweep's own functions must not be exposed.
  IF has_function_privilege('anon', 'treasury.run_anon_execute_sweep()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.treasury_anon_execute_status()', 'EXECUTE')
     OR has_function_privilege('anon', 'treasury.anon_executable_functions()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'the sweep exposed ITS OWN functions to anon';
  END IF;

  -- Positive control: the scanner must actually see things. A scanner that
  -- silently matches nothing would report a clean database forever.
  IF (SELECT count(*) FROM treasury.anon_executable_functions()) = 0 THEN
    bad := bad + 1; RAISE WARNING 'the scanner found ZERO exposures, which means it is not looking (positive control failed)';
  END IF;
  SELECT treasury.anon_execute_excluded_extension_count() INTO v_excl;
  IF v_excl = 0 THEN
    bad := bad + 1; RAISE WARNING 'the extension-exclusion counter reads 0, so the exclusion is not being applied as documented';
  END IF;

  -- Run it for real, then read the verdict back.
  PERFORM treasury.run_anon_execute_sweep();
  SELECT * INTO v_latest FROM public.treasury_anon_execute_status();

  IF v_latest IS NULL THEN
    bad := bad + 1; RAISE WARNING 'the sweep ran but recorded no verdict';
  ELSIF NOT v_latest.ok THEN
    bad := bad + 1; RAISE WARNING 'first sweep is NOT ok: %', v_latest.detail;
  END IF;

  -- It must be scheduled, or it is a check nobody runs.
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anon-execute-sweep-weekly' AND active) THEN
    bad := bad + 1; RAISE WARNING 'the weekly sweep is not scheduled or not active';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'anon-execute live sweep migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - sweep armed and green: % live exposures accepted, % extension functions excluded, weekly cron scheduled',
    v_latest.live_count, v_excl;
END $$;
