-- When a budget row is written, and what its figure used to be.
--
-- ── ⚠⚠ WHY: THREE INCIDENTS, THREE TIMES UNABLE TO NAME THE ROW ───────────
--
-- The frozen-figure invariant has now moved three times (v2.35, v2.36, and the
-- 2026-09-08→14 window). Each time it proved a figure moved and could not say
-- WHICH. v2.36 found its row only because a single Sunday cron was the only
-- write in a two-day window; the third incident had six days and several
-- writers, and its row is UNRECOVERABLE from this database.
--
-- The reason is measurable, and it is not subtle:
--
--     treasury.budgets.updated_at is populated on 9 of 287,017 rows
--     treasury_sync_city_budget  — the string 'updated_at' appears 0 times
--     treasury_sync_budget_tree  — 0 times
--     no trigger set it; budget_line_items has no timestamps at all
--     Postgres log retention is 24 hours
--
-- So every write in TT was untimestamped, and every overwritten figure was
-- gone without trace. ⭐ This migration closes both halves: WHEN a row was
-- written, and WHAT ITS TOTAL WAS BEFORE.
--
-- ⚠ A TRIGGER, NOT AN EDIT TO THE TWO RPCs. The RPCs are not the only writers
-- — 16 direct-insert sites, migrations, and hand-run SQL all reach this table.
-- A rule that each writer must remember is a rule that drifts; the trigger
-- cannot be bypassed by a writer that did not know about it.

ALTER TABLE treasury.budgets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE treasury.budgets ALTER COLUMN updated_at SET DEFAULT now();

-- ── The figure history the invariant has always needed ────────────────────
--
-- Only `total_budget` is recorded, because that is the column the frozen
-- digest hashes. One row per ACTUAL change: an idempotent re-sync that writes
-- the same number writes nothing here, so the table stays small and every row
-- in it is a real movement.
CREATE TABLE IF NOT EXISTS treasury.budget_total_changes (
  id          bigserial   PRIMARY KEY,
  budget_id   uuid        NOT NULL,
  old_total   numeric,
  new_total   numeric,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text        NOT NULL DEFAULT current_user
);

CREATE INDEX IF NOT EXISTS budget_total_changes_budget_idx
  ON treasury.budget_total_changes (budget_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS budget_total_changes_when_idx
  ON treasury.budget_total_changes (changed_at DESC);

COMMENT ON TABLE treasury.budget_total_changes IS
  'Every change to a budget row''s total_budget, with the value it replaced. Written by the budgets_stamp_write_time trigger. This is what lets a moved frozen figure be named — and its old value recovered for the figure-change ledger — instead of being lost.';

-- ⚠ NOT anon-readable, and never written by hand: it is a record of what the
-- database did, not a place to record what someone meant.
GRANT SELECT ON treasury.budget_total_changes TO service_role;

CREATE OR REPLACE FUNCTION treasury.stamp_budget_write_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'treasury', 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := coalesce(NEW.created_at, now());
    NEW.updated_at := coalesce(NEW.updated_at, now());
    RETURN NEW;
  END IF;

  -- ⚠ Only a REAL change is stamped. The nightly syncs rewrite thousands of
  -- rows with identical values; stamping those would spray fresh timestamps
  -- across the table every night and drown the one signal this exists to give.
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  NEW.updated_at := now();

  IF NEW.total_budget IS DISTINCT FROM OLD.total_budget THEN
    INSERT INTO treasury.budget_total_changes (budget_id, old_total, new_total)
    VALUES (OLD.id, OLD.total_budget, NEW.total_budget);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS budgets_stamp_write_time ON treasury.budgets;
CREATE TRIGGER budgets_stamp_write_time
  BEFORE INSERT OR UPDATE ON treasury.budgets
  FOR EACH ROW EXECUTE FUNCTION treasury.stamp_budget_write_time();

-- ── Self-verification ─────────────────────────────────────────────────────
--
-- ⚠ The probe writes to a row that is EXCLUDED from the frozen digest, and
-- restores its value in the same block. Even so, it is written so that the
-- digest could not move even if the restore failed: the value is set to
-- itself, then to itself again.
DO $$
DECLARE
  probe_id uuid; probe_total numeric; stamped timestamptz;
  changes_before int; changes_after int; bad int := 0;
  digest_before text; digest_after text;
BEGIN
  SELECT digest INTO digest_before FROM treasury.frozen_invariant_status();
  SELECT count(*) INTO changes_before FROM treasury.budget_total_changes;

  SELECT b.id, b.total_budget INTO probe_id, probe_total
    FROM treasury.budgets b
    JOIN treasury.frozen_excluded_ids e ON e.id = b.id
   WHERE b.total_budget IS NOT NULL
   ORDER BY b.id LIMIT 1;

  -- 1. A no-op write stamps NOTHING. This is the property that keeps the
  -- signal readable through nightly idempotent re-syncs.
  UPDATE treasury.budgets SET total_budget = probe_total WHERE id = probe_id;
  SELECT updated_at INTO stamped FROM treasury.budgets WHERE id = probe_id;
  IF stamped IS NOT NULL AND stamped > now() - interval '1 minute' THEN
    bad := bad + 1; RAISE WARNING 'a no-op write stamped updated_at';
  END IF;
  SELECT count(*) INTO changes_after FROM treasury.budget_total_changes;
  IF changes_after <> changes_before THEN
    bad := bad + 1; RAISE WARNING 'a no-op write logged a figure change';
  END IF;

  -- 2. A REAL change stamps the time AND records the value it replaced.
  UPDATE treasury.budgets SET total_budget = probe_total + 1 WHERE id = probe_id;
  SELECT updated_at INTO stamped FROM treasury.budgets WHERE id = probe_id;
  IF stamped IS NULL OR stamped < now() - interval '1 minute' THEN
    bad := bad + 1; RAISE WARNING 'a real change did NOT stamp updated_at';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM treasury.budget_total_changes
     WHERE budget_id = probe_id AND old_total = probe_total AND new_total = probe_total + 1
  ) THEN
    bad := bad + 1; RAISE WARNING 'a real change did NOT record the old value';
  END IF;

  -- Restore, and delete the probe's own history rows.
  UPDATE treasury.budgets SET total_budget = probe_total WHERE id = probe_id;
  DELETE FROM treasury.budget_total_changes WHERE budget_id = probe_id;

  IF (SELECT total_budget FROM treasury.budgets WHERE id = probe_id) IS DISTINCT FROM probe_total THEN
    bad := bad + 1; RAISE WARNING 'the probe did not restore the value it changed';
  END IF;

  SELECT count(*) INTO changes_after FROM treasury.budget_total_changes;
  IF changes_after <> changes_before THEN
    bad := bad + 1; RAISE WARNING 'self-test left % history row(s) behind', changes_after - changes_before;
  END IF;

  -- 3. ⚠⚠ THE ONE THAT MATTERS: the digest is byte-identical either side.
  SELECT digest INTO digest_after FROM treasury.frozen_invariant_status();
  IF digest_after IS DISTINCT FROM digest_before THEN
    bad := bad + 1;
    RAISE WARNING 'THE SELF-TEST MOVED THE FROZEN DIGEST: % -> %', digest_before, digest_after;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'stamp_budget_write_time: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — real changes stamp and record their old value, no-ops do neither, digest unmoved';
END $$;
