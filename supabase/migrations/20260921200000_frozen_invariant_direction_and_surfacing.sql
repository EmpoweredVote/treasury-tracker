-- =============================================================================
-- The frozen invariant: name the RIGHT condition, and be READ
-- =============================================================================
-- Created 2026-09-21, after the invariant was found to have failed on
-- 2026-09-07, 09-14 and 09-21 -- three consecutive weeks -- with nobody told.
--
-- ── What actually went wrong (and it was not the data) ────────────────────
-- `treasury.frozen_invariant_baseline` held 62,654 / 3a48ac28, updated
-- 2026-08-30. The repo had been REBASED THREE TIMES since, by authorised
-- decisions recorded in scopeBaseline.json: v2.35 (62,644 / 332a8fda), v2.36
-- (62,593 / d7075002), v2.37 (62,587 / 60098de6). Nothing propagated those into
-- the database, so the weekly in-DB check compared live reality against a
-- three-rebase-old expectation and reported a violation every Monday.
--
-- The deltas match the rebase notes exactly, which is what makes the diagnosis
-- certain rather than plausible: the 09-07 run's -10 IS v2.35's own note ("ten
-- rows left the digest when the legacy Indiana Gateway vintage was deleted"),
-- and the 09-14 run's -61 lands precisely on v2.36's 62,593.
--
-- Resolved 2026-09-21 WITHOUT a rebase. Two EV rows had entered the digest
-- because the Empowered Vote financials refresh DELETES AND RECREATES its rows
-- with new ids rather than updating in place, so v2.37's exclusion -- which
-- materialises to a static id list -- could not cover them. Re-snapshotting
-- (liveSyncExclusions.mjs --write) removed the two dead ids and added the two
-- new ones, returning the live set to 62,587 / 60098de6: the digest Chris
-- authorised at v2.37. `--set-baseline` then mirrored it, and it refuses to run
-- unless live agrees with the repo, so this could not have become a silent
-- rebase.
--
-- ── Fix 1: the runner reported the WRONG CONDITION ───────────────────────
-- For any row-count mismatch it said:
--   'ROWS NOT REGISTERED: ... A milestone inserted rows without registering
--    them.'
-- The count was -65. It had gone DOWN. Rows had VANISHED, which is the opposite
-- diagnosis, and frozen-invariant-watch.yml's issue text already documents it as
-- a distinct condition ("FROZEN ROWS HAVE VANISHED - a delete is as serious as
-- an edit"). The runner never had that branch.
--
-- This matters more than wording. Reporting one condition for another is the
-- exact failure that file's own rule warns about, and it sends the reader to
-- register rows that were never created while a deletion goes uninvestigated.
--
-- The message logic is extracted into treasury.frozen_verdict(...) so it can be
-- exercised with synthetic inputs -- the post-verify block below drives all five
-- branches. Previously it could only be observed by waiting a week for real
-- data to take one path.
--
-- ── Fix 2: nobody was told ───────────────────────────────────────────────
-- The check worked. Its verdict went into treasury.frozen_invariant_runs, which
-- NOTHING in the repo reads (git grep outside migrations: zero hits), and
-- frozen-invariant-watch.yml's issue-opening schedule is disabled because it
-- would need a service-role key in Actions (PR #90). A verdict nobody reads is
-- not a control.
--
-- public.treasury_frozen_invariant_verdict() exposes the latest run to
-- treasury-sync-orchestrator, which already runs daily and now reads it beside
-- the anon-EXECUTE sweep, under the same rule: a MISSING or STALE verdict is a
-- failure, not a pass.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- Fix 1 -- direction-aware verdict, testable in isolation
-- =============================================================================
CREATE OR REPLACE FUNCTION treasury.frozen_verdict(
  p_rows            bigint,
  p_digest          text,
  p_expected_rows   bigint,
  p_expected_digest text
)
RETURNS TABLE (ok boolean, detail text)
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT
    CASE
      WHEN p_expected_digest IS NULL THEN false
      WHEN p_rows <> p_expected_rows THEN false
      WHEN p_digest <> p_expected_digest THEN false
      ELSE true
    END,
    CASE
      -- ⚠ Nothing to compare against must not look green.
      WHEN p_expected_digest IS NULL THEN
        'No baseline recorded - nothing to compare against. This is INCONCLUSIVE, not a pass.'

      -- ⚠ A DELETE is as serious as an edit, and it is NOT a registration
      -- omission. Sending the reader to register rows that were never created
      -- is how three weeks of this went misdiagnosed.
      WHEN p_rows < p_expected_rows THEN
        format(
          'FROZEN ROWS HAVE VANISHED: %s frozen rows vs %s expected (%s MISSING). Rows have been '
          'DELETED from the frozen set, or the in-database baseline is stale because the repo was '
          'rebased and nothing mirrored it (run scripts/syncFrozenInvariantState.mjs). Check the '
          'baseline against scopeBaseline.json FIRST - a stale mirror looks exactly like a deletion. '
          'This is NOT a milestone forgetting to register rows.',
          p_rows, p_expected_rows, p_expected_rows - p_rows)

      WHEN p_rows > p_expected_rows THEN
        format(
          'ROWS NOT REGISTERED: %s frozen rows vs %s expected (%s unaccounted). A load inserted rows '
          'without registering them. Fix it while you still know what you loaded: '
          'npm run register:rows -- --milestone <name> --match "<entity>". '
          'This is NOT evidence a figure moved.',
          p_rows, p_expected_rows, p_rows - p_expected_rows)

      WHEN p_digest <> p_expected_digest THEN
        format(
          'FIGURE CHANGED: the count reconciles (%s) so a surviving row''s figure moved. Name it with '
          'treasury.frozen_figure_drift(), then, if authorised, record it in the ledger with the value '
          'it replaced. Never regenerate figures_frozen to make this pass.',
          p_rows)

      ELSE 'unchanged'
    END;
$fn$;

COMMENT ON FUNCTION treasury.frozen_verdict(bigint, text, bigint, text) IS
  'Pure verdict for the frozen invariant: names WHICH condition holds, including the vanished-rows case the runner previously misreported as a registration omission. Extracted so all branches can be driven with synthetic inputs.';

-- The runner now delegates the judgement and only does the I/O.
CREATE OR REPLACE FUNCTION treasury.run_frozen_invariant_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = treasury, public, extensions
AS $fn$
DECLARE
  v_rows   bigint;
  v_digest text;
  b        treasury.frozen_invariant_baseline%rowtype;
  v        record;
BEGIN
  SELECT frozen_rows, digest INTO v_rows, v_digest FROM treasury.frozen_invariant_status();
  SELECT * INTO b FROM treasury.frozen_invariant_baseline WHERE singleton;

  SELECT * INTO v FROM treasury.frozen_verdict(v_rows, v_digest, b.frozen_rows, b.digest);

  INSERT INTO treasury.frozen_invariant_runs
    (frozen_rows, digest, expected_rows, expected_digest, ok, detail)
  VALUES (v_rows, v_digest, b.frozen_rows, b.digest, v.ok, v.detail);
END;
$fn$;

-- =============================================================================
-- Fix 2 -- expose the verdict so the daily orchestrator can read it
-- =============================================================================
CREATE OR REPLACE FUNCTION public.treasury_frozen_invariant_verdict()
RETURNS TABLE (ran_at timestamptz, ok boolean, detail text, frozen_rows bigint, expected_rows bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = treasury, public, pg_catalog
AS $fn$
  SELECT r.ran_at, r.ok, r.detail, r.frozen_rows, r.expected_rows
    FROM treasury.frozen_invariant_runs r
   ORDER BY r.ran_at DESC
   LIMIT 1;
$fn$;

COMMENT ON FUNCTION public.treasury_frozen_invariant_verdict() IS
  'Latest frozen-invariant verdict. Read by treasury-sync-orchestrator on every daily run. An EMPTY result means the check has never run, which the orchestrator treats as INCONCLUSIVE, not a pass.';

-- Internal, like everything else in this design.
REVOKE EXECUTE ON FUNCTION treasury.frozen_verdict(bigint, text, bigint, text)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_frozen_invariant_verdict()           FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.frozen_verdict(bigint, text, bigint, text)  TO service_role;
GRANT  EXECUTE ON FUNCTION public.treasury_frozen_invariant_verdict()           TO service_role;

-- ⚠ Re-assert the revoke on the RE-CREATED runner. `CREATE OR REPLACE` above
-- PRESERVES the existing ACL, so live privilege did not change (verified
-- 2026-09-21: anon EXECUTE = false) -- but the standing guard requires a revoke
-- at or after a function's last create, and it is right to: a future migration
-- that creates this function FRESH would reset its ACL to the PUBLIC default and
-- a name-only match would wave it through.
--
-- Caught by tests/definerFunctionGrants.test.mjs on this very migration, which
-- is the two controls showing their complementary value: the LIVE sweep stayed
-- green because nothing is exposed now, while the STATIC guard caught the latent
-- reopening. Neither alone would have said anything.
REVOKE EXECUTE ON FUNCTION treasury.run_frozen_invariant_check() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.run_frozen_invariant_check() TO service_role;

-- =============================================================================
-- Post-verify gate -- drive every branch with synthetic inputs.
-- =============================================================================
DO $blk$
DECLARE
  bad int := 0;
  v   record;
BEGIN
  -- unchanged
  SELECT * INTO v FROM treasury.frozen_verdict(100, 'd', 100, 'd');
  IF NOT v.ok OR v.detail <> 'unchanged' THEN
    bad := bad + 1; RAISE WARNING 'unchanged branch wrong: % / %', v.ok, v.detail;
  END IF;

  -- ⚠ the branch that did not exist: fewer rows than expected
  SELECT * INTO v FROM treasury.frozen_verdict(35, 'd', 100, 'd');
  IF v.ok OR v.detail NOT LIKE 'FROZEN ROWS HAVE VANISHED%' OR v.detail NOT LIKE '%65 MISSING%' THEN
    bad := bad + 1; RAISE WARNING 'vanished branch wrong: % / %', v.ok, v.detail;
  END IF;

  -- more rows than expected
  SELECT * INTO v FROM treasury.frozen_verdict(102, 'd', 100, 'd');
  IF v.ok OR v.detail NOT LIKE 'ROWS NOT REGISTERED%' OR v.detail NOT LIKE '%2 unaccounted%' THEN
    bad := bad + 1; RAISE WARNING 'not-registered branch wrong: % / %', v.ok, v.detail;
  END IF;

  -- count reconciles, digest moved
  SELECT * INTO v FROM treasury.frozen_verdict(100, 'x', 100, 'd');
  IF v.ok OR v.detail NOT LIKE 'FIGURE CHANGED%' THEN
    bad := bad + 1; RAISE WARNING 'figure-changed branch wrong: % / %', v.ok, v.detail;
  END IF;

  -- no baseline
  SELECT * INTO v FROM treasury.frozen_verdict(100, 'd', NULL, NULL);
  IF v.ok OR v.detail NOT LIKE '%INCONCLUSIVE%' THEN
    bad := bad + 1; RAISE WARNING 'no-baseline branch wrong: % / %', v.ok, v.detail;
  END IF;

  -- ⚠ REGRESSION GUARD on the actual misdiagnosis: a negative delta must never
  -- again be reported as a registration omission.
  SELECT * INTO v FROM treasury.frozen_verdict(62589, 'd', 62654, 'd');
  IF v.detail LIKE '%ROWS NOT REGISTERED%' THEN
    bad := bad + 1; RAISE WARNING 'a NEGATIVE delta is still reported as ROWS NOT REGISTERED';
  END IF;

  -- The runner must still work end to end, and must currently be green.
  PERFORM treasury.run_frozen_invariant_check();
  SELECT * INTO v FROM public.treasury_frozen_invariant_verdict();
  IF v IS NULL THEN
    bad := bad + 1; RAISE WARNING 'no verdict recorded';
  ELSIF NOT v.ok THEN
    bad := bad + 1; RAISE WARNING 'frozen invariant is not ok: %', v.detail;
  END IF;

  IF has_function_privilege('anon', 'public.treasury_frozen_invariant_verdict()', 'EXECUTE') THEN
    bad := bad + 1; RAISE WARNING 'the verdict reader is anon-executable';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'frozen invariant direction/surfacing migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - all five verdict branches correct, runner green (% rows), verdict readable by service_role only', v.frozen_rows;
END $blk$;
