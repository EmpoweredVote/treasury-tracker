-- =============================================================================
-- Log every budget insert, so an unregistered row is NAMED, not hunted for
-- =============================================================================
-- Created 2026-11-09, after frozen-invariant-assert failed with
--   ROWS NOT REGISTERED: 62601 frozen rows vs 62587 expected (14 unaccounted)
-- The 14 rows came from five separate load PRs merged on 2026-11-08 (#355
-- #356 #357 #358 #361 #362). Each one skipped `npm run register:rows`. #366
-- registered them by hand, by exact id, after reconstructing which rows they were.
--
-- ── Why a trigger and not a loader helper ─────────────────────────────────
-- Budget rows are written by ~34 Node scripts AND by in-database sync code
-- (treasury_sync_city_budget, treasury_sync_budget_tree). A helper each loader
-- must remember to call is the same "remember to do the step" rule that just
-- failed five times in one day. A trigger sees every insert, whatever wrote it,
-- including loaders that do not exist yet.
--
-- ── What it does ──────────────────────────────────────────────────────────
-- 1. treasury.budget_insert_log    one row per budget id inserted from now on.
-- 2. treasury.unregistered_budget_rows
--                                   logged rows that are in no exclusion list,
--                                   i.e. EXACTLY the rows the invariant is
--                                   counting that nobody registered.
-- 3. run_frozen_invariant_check()   on ROWS NOT REGISTERED, appends who those
--                                   rows are to the verdict, so the alarm names
--                                   the municipality, year and source.
-- 4. registerCreatedRows --pending  (Node side) registers exactly that set,
--                                   still refusing unless it equals the deficit.
--
-- It does not register anything by itself. Registration stays a human
-- decision: a row in the log is a FACT about what was inserted, filing it under
-- a milestone is a JUDGEMENT about whose load it was.
--
-- The log starts empty. Every existing row is either frozen or registered
-- (the invariant reads OK after #366), so nothing needs seeding.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS treasury.budget_insert_log (
  -- ⚠ ON DELETE CASCADE: a row that is loaded and then deleted is not owed a
  -- registration. Without the cascade it would sit in the log forever and the
  -- view would have to filter it out on every read.
  id          uuid PRIMARY KEY REFERENCES treasury.budgets(id) ON DELETE CASCADE,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE treasury.budget_insert_log IS
  'Every treasury.budgets id inserted since 2026-11-09, written by trigger budgets_log_inserts. '
  'Read through treasury.unregistered_budget_rows. Never written by hand.';

-- Default-deny, like every other treasury bookkeeping table. Only
-- service_role / postgres (which bypass RLS) read it.
ALTER TABLE treasury.budget_insert_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON treasury.budget_insert_log FROM PUBLIC, anon, authenticated;
-- ⚠ The view below is security_invoker, so its READER needs SELECT here too.
-- Without this, registerCreatedRows (service_role) got "permission denied for
-- table budget_insert_log" on first live use, 2026-11-09.
GRANT SELECT ON treasury.budget_insert_log TO service_role;

-- Statement-level with a transition table: one INSERT ... SELECT per load
-- statement, not one per row. An upsert that UPDATEs an existing row does not
-- appear in the INSERT transition table, so a re-sync of a frozen row is not
-- mistaken for a new one.
CREATE OR REPLACE FUNCTION treasury.log_budget_inserts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = treasury, public
AS $fn$
BEGIN
  INSERT INTO treasury.budget_insert_log (id)
  SELECT n.id FROM new_rows n
  ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION treasury.log_budget_inserts() IS
  'Trigger body for budgets_log_inserts. SECURITY DEFINER so a loader role needs no grant on the log.';

REVOKE EXECUTE ON FUNCTION treasury.log_budget_inserts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS budgets_log_inserts ON treasury.budgets;
CREATE TRIGGER budgets_log_inserts
  AFTER INSERT ON treasury.budgets
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION treasury.log_budget_inserts();

-- The rows the invariant counts that nobody registered. Same exclusion test as
-- treasury.frozen_invariant_status(), so the two agree by construction.
CREATE OR REPLACE VIEW treasury.unregistered_budget_rows
WITH (security_invoker = true) AS
SELECT b.id,
       l.inserted_at,
       m.name,
       m.state,
       b.fiscal_year,
       b.dataset_type,
       b.data_source
  FROM treasury.budget_insert_log l
  JOIN treasury.budgets b ON b.id = l.id
  LEFT JOIN treasury.municipalities m ON m.id = b.municipality_id
 WHERE NOT EXISTS (SELECT 1 FROM treasury.frozen_excluded_ids e WHERE e.id = b.id);

COMMENT ON VIEW treasury.unregistered_budget_rows IS
  'Budget rows inserted since 2026-11-09 that are in no exclusion list: the rows a ROWS NOT REGISTERED '
  'verdict is counting. Register them with npm run register:rows -- --milestone <name> --pending.';

REVOKE ALL ON treasury.unregistered_budget_rows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON treasury.unregistered_budget_rows TO service_role;

-- One line for the alarm: who the unregistered rows are. Capped at ten groups
-- so a fleet load (a thousand series) cannot bury the verdict.
CREATE OR REPLACE FUNCTION treasury.unregistered_budget_rows_summary()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = treasury, public
AS $fn$
  WITH g AS (
    SELECT format('%s x %s, %s FY%s [%s]',
                  count(*),
                  coalesce(name, '(unknown)'),
                  coalesce(state, '?'),
                  coalesce(fiscal_year::text, '?'),
                  left(coalesce(data_source, '(no source)'), 60)) AS line,
           count(*) AS n,
           min(inserted_at) AS first_at
      FROM treasury.unregistered_budget_rows
     GROUP BY name, state, fiscal_year, left(coalesce(data_source, '(no source)'), 60)
  ), r AS (
    SELECT line, n, row_number() OVER (ORDER BY first_at, line) AS rn, count(*) OVER () AS groups FROM g
  )
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE
    format('%s logged insert(s) unregistered: %s%s',
           sum(n),
           string_agg(line, '; ' ORDER BY rn) FILTER (WHERE rn <= 10),
           CASE WHEN max(groups) > 10 THEN format('; and %s more group(s)', max(groups) - 10) ELSE '' END)
  END
  FROM r;
$fn$;

COMMENT ON FUNCTION treasury.unregistered_budget_rows_summary() IS
  'Human-readable summary of treasury.unregistered_budget_rows for the frozen-invariant verdict. NULL when empty.';

REVOKE EXECUTE ON FUNCTION treasury.unregistered_budget_rows_summary() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.unregistered_budget_rows_summary() TO service_role;

-- The runner: unchanged judgement (treasury.frozen_verdict), plus the names.
CREATE OR REPLACE FUNCTION treasury.run_frozen_invariant_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = treasury, public, extensions
AS $fn$
DECLARE
  v_rows    bigint;
  v_digest  text;
  b         treasury.frozen_invariant_baseline%rowtype;
  v         record;
  v_detail  text;
  v_named   text;
BEGIN
  SELECT frozen_rows, digest INTO v_rows, v_digest FROM treasury.frozen_invariant_status();
  SELECT * INTO b FROM treasury.frozen_invariant_baseline WHERE singleton;
  SELECT * INTO v FROM treasury.frozen_verdict(v_rows, v_digest, b.frozen_rows, b.digest);
  v_detail := v.detail;

  -- ⚠ Only on the TOO-MANY-ROWS branch. A vanished row or a moved figure is a
  -- different condition, and listing recent inserts beside it would send the
  -- reader to the wrong cause.
  IF NOT v.ok AND b.frozen_rows IS NOT NULL AND v_rows > b.frozen_rows THEN
    v_named := treasury.unregistered_budget_rows_summary();
    v_detail := v_detail || CASE
      WHEN v_named IS NULL THEN
        ' NO LOGGED INSERT EXPLAINS IT: the rows predate the insert log (2026-11-09), or were '
        'removed from frozen_excluded_ids. Compare scopeBaseline.json with the mirror first.'
      ELSE
        ' NAMED: ' || v_named || '. Register with: npm run register:rows -- --milestone <name> --pending'
    END;
  END IF;

  INSERT INTO treasury.frozen_invariant_runs
    (frozen_rows, digest, expected_rows, expected_digest, ok, detail)
  VALUES (v_rows, v_digest, b.frozen_rows, b.digest, v.ok, v_detail);
END;
$fn$;

-- Re-assert the revoke on the re-created runner (see 20260921200000 for why
-- CREATE OR REPLACE is not trusted to carry the ACL).
REVOKE EXECUTE ON FUNCTION treasury.run_frozen_invariant_check() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION treasury.run_frozen_invariant_check() TO service_role;

-- =============================================================================
-- Post-verify gate
-- =============================================================================
DO $blk$
DECLARE
  bad       int := 0;
  r         treasury.budgets%rowtype;
  probe_id  uuid := gen_random_uuid();
  logged    boolean;
  listed    boolean;
  named     text;
  v         record;
BEGIN
  -- ── Probe: insert a copy of a real row, observe it, then roll it back ──
  -- The block raises at the end on purpose; the handler swallows ONLY that
  -- raise, so the probe row, its log entry and any side effects are undone.
  -- Results live in plpgsql variables, which a rollback does not touch.
  BEGIN
    SELECT * INTO r FROM treasury.budgets LIMIT 1;
    r.id := probe_id;
    -- unique index is (municipality_id, fiscal_year, dataset_type, period_label, fund_scope, basis)
    r.period_label := 'budget-insert-log-probe-' || probe_id;
    INSERT INTO treasury.budgets SELECT (r).*;

    logged := EXISTS (SELECT 1 FROM treasury.budget_insert_log WHERE id = probe_id);
    listed := EXISTS (SELECT 1 FROM treasury.unregistered_budget_rows WHERE id = probe_id);
    named  := treasury.unregistered_budget_rows_summary();

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'budget_insert_log_probe_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'budget_insert_log_probe_rollback' THEN RAISE; END IF;
  END;

  IF NOT coalesce(logged, false) THEN
    bad := bad + 1; RAISE WARNING 'probe insert was not logged by budgets_log_inserts';
  END IF;
  IF NOT coalesce(listed, false) THEN
    bad := bad + 1; RAISE WARNING 'probe insert did not appear in treasury.unregistered_budget_rows';
  END IF;
  IF named IS NULL OR named NOT LIKE '1 logged insert(s) unregistered:%' THEN
    bad := bad + 1; RAISE WARNING 'summary wrong for one probe row: %', named;
  END IF;

  -- The probe is gone.
  IF EXISTS (SELECT 1 FROM treasury.budgets WHERE id = probe_id)
     OR EXISTS (SELECT 1 FROM treasury.budget_insert_log WHERE id = probe_id) THEN
    bad := bad + 1; RAISE WARNING 'probe row survived the rollback: %', probe_id;
  END IF;

  -- Starts empty, and the invariant is green after #366.
  IF EXISTS (SELECT 1 FROM treasury.unregistered_budget_rows) THEN
    bad := bad + 1; RAISE WARNING 'unregistered_budget_rows is not empty at creation';
  END IF;

  PERFORM treasury.run_frozen_invariant_check();
  SELECT * INTO v FROM public.treasury_frozen_invariant_verdict();
  IF v IS NULL OR NOT v.ok THEN
    bad := bad + 1; RAISE WARNING 'frozen invariant is not ok after this migration: %', v.detail;
  END IF;

  IF has_table_privilege('anon', 'treasury.unregistered_budget_rows', 'SELECT')
     OR has_table_privilege('anon', 'treasury.budget_insert_log', 'SELECT') THEN
    bad := bad + 1; RAISE WARNING 'the insert log or its view is anon-readable';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'budget insert log migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - probe insert logged, listed, named and rolled back; log empty; invariant green (% rows)', v.frozen_rows;
END $blk$;
