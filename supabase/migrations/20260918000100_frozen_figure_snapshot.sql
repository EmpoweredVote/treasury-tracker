-- Make the invariant NAME the row it says moved.
--
-- ── ⚠⚠ WHY ────────────────────────────────────────────────────────────────
--
-- `verify:frozen` hashes 62,593 rows into one digest. When that digest moves it
-- proves a figure changed and says nothing about WHICH — and a hash cannot be
-- inverted. Three incidents, three investigations; the third one's row is
-- unrecoverable because nothing kept the per-row values.
--
-- The repo deliberately refused to commit ~62k ids (a ~3 MB permanent git
-- artifact, per scopeBaseline.json's own note). ⭐ That objection is about the
-- REPO. A table is not the repo: it costs nothing to review, nothing to diff,
-- and it is exactly where a per-row comparison belongs.
--
-- ── ⚠⚠ THIS IS A LOCALIZER, NEVER A BASELINE ──────────────────────────────
--
-- `figures_frozen` in scopeBaseline.json stays the invariant, and stays the
-- thing that must never be rewritten to make a check pass. The snapshot below
-- answers ONLY the follow-up question — WHICH row differs from the last capture
-- — and it is captured deliberately, by hand, never by the checker. A check
-- that refreshed its own expectation would agree with any corruption.
--
-- ⚠ The first capture necessarily records the CURRENT, already-drifted values
-- (digest b165549f, not the repo's d7075002). That is honest and useful: from
-- then on, the NEXT movement is named. It does not bless what already moved,
-- because the invariant is still the repo's digest.

CREATE TABLE IF NOT EXISTS treasury.frozen_figure_snapshot (
  id           uuid    PRIMARY KEY,
  total_budget numeric
);

CREATE TABLE IF NOT EXISTS treasury.frozen_figure_snapshot_meta (
  singleton   boolean     PRIMARY KEY DEFAULT true CHECK (singleton),
  captured_at timestamptz NOT NULL DEFAULT now(),
  row_count   bigint      NOT NULL,
  digest      text        NOT NULL,
  note        text
);

COMMENT ON TABLE treasury.frozen_figure_snapshot IS
  'Per-row total_budget for the frozen set as of the last deliberate capture. A LOCALIZER for treasury.frozen_figure_drift(), never a baseline — scopeBaseline.json figures_frozen remains the invariant.';

GRANT SELECT ON treasury.frozen_figure_snapshot TO service_role;
GRANT SELECT ON treasury.frozen_figure_snapshot_meta TO service_role;

-- ── Capture ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION treasury.capture_frozen_snapshot(p_note text DEFAULT NULL)
RETURNS TABLE (row_count bigint, digest text)
LANGUAGE plpgsql
SET search_path TO 'treasury', 'public'
AS $$
DECLARE v_count bigint; v_digest text;
BEGIN
  DELETE FROM treasury.frozen_figure_snapshot;

  INSERT INTO treasury.frozen_figure_snapshot (id, total_budget)
  SELECT b.id, b.total_budget
    FROM treasury.budgets b
   WHERE NOT EXISTS (SELECT 1 FROM treasury.frozen_excluded_ids e WHERE e.id = b.id);

  SELECT s.frozen_rows, s.digest INTO v_count, v_digest
    FROM treasury.frozen_invariant_status() s;

  DELETE FROM treasury.frozen_figure_snapshot_meta;
  INSERT INTO treasury.frozen_figure_snapshot_meta (row_count, digest, note)
  VALUES (v_count, v_digest, p_note);

  RETURN QUERY SELECT v_count, v_digest;
END $$;

COMMENT ON FUNCTION treasury.capture_frozen_snapshot(text) IS
  'Replace the per-row snapshot with the current frozen set. Run DELIBERATELY — after an authorised correction, or once a drift has been explained. Never from a check.';

-- ── The answer the digest cannot give ─────────────────────────────────────
DROP TYPE IF EXISTS treasury.frozen_figure_drift_row CASCADE;
CREATE TYPE treasury.frozen_figure_drift_row AS (
  id              uuid,
  entity          text,
  state           text,
  fiscal_year     bigint,
  dataset_type    text,
  data_source     text,
  snapshot_total  numeric,
  current_total   numeric,
  kind            text,
  changed_at      timestamptz
);

CREATE OR REPLACE FUNCTION treasury.frozen_figure_drift()
RETURNS SETOF treasury.frozen_figure_drift_row
LANGUAGE sql
STABLE
SET search_path TO 'treasury', 'public'
AS $$
  WITH frozen AS (
    SELECT b.id, b.total_budget, b.fiscal_year, b.dataset_type, b.data_source, b.municipality_id
      FROM treasury.budgets b
     WHERE NOT EXISTS (SELECT 1 FROM treasury.frozen_excluded_ids e WHERE e.id = b.id)
  )
  -- A value that moved.
  SELECT f.id, m.name, m.state, f.fiscal_year, f.dataset_type, f.data_source,
         s.total_budget, f.total_budget, 'figure_moved'::text,
         (SELECT max(c.changed_at) FROM treasury.budget_total_changes c WHERE c.budget_id = f.id)
    FROM frozen f
    JOIN treasury.frozen_figure_snapshot s ON s.id = f.id
    LEFT JOIN treasury.municipalities m ON m.id = f.municipality_id
   WHERE f.total_budget IS DISTINCT FROM s.total_budget

  UNION ALL

  -- ⚠ A row that LEFT the frozen set — deleted, or newly excluded. A delete is
  -- exactly as serious as an edit, and counting alone can hide one behind an
  -- arrival.
  SELECT s.id, m.name, m.state, b.fiscal_year, b.dataset_type, b.data_source,
         s.total_budget, b.total_budget, 'left_the_digest'::text, NULL
    FROM treasury.frozen_figure_snapshot s
    LEFT JOIN treasury.budgets b ON b.id = s.id
    LEFT JOIN treasury.municipalities m ON m.id = b.municipality_id
   WHERE NOT EXISTS (SELECT 1 FROM frozen f WHERE f.id = s.id)

  UNION ALL

  -- A row that ARRIVED in the frozen set — created without being registered.
  SELECT f.id, m.name, m.state, f.fiscal_year, f.dataset_type, f.data_source,
         NULL, f.total_budget, 'entered_the_digest'::text,
         (SELECT max(c.changed_at) FROM treasury.budget_total_changes c WHERE c.budget_id = f.id)
    FROM frozen f
    LEFT JOIN treasury.municipalities m ON m.id = f.municipality_id
   WHERE NOT EXISTS (SELECT 1 FROM treasury.frozen_figure_snapshot s WHERE s.id = f.id);
$$;

COMMENT ON FUNCTION treasury.frozen_figure_drift() IS
  'Which rows differ from the last snapshot capture, and how: figure_moved, left_the_digest, entered_the_digest. Empty when the drift predates the capture — which is itself the answer.';

CREATE OR REPLACE FUNCTION public.treasury_frozen_figure_drift()
RETURNS SETOF treasury.frozen_figure_drift_row
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $$ SELECT * FROM treasury.frozen_figure_drift(); $$;

GRANT EXECUTE ON FUNCTION public.treasury_frozen_figure_drift() TO service_role;

-- ── Self-verification ─────────────────────────────────────────────────────
--
-- ⚠ The detector is validated by PERTURBING THE SNAPSHOT, never the data. The
-- established pattern is "rebuild the fault, assert it fires, roll back" — and
-- here the fault can be rebuilt on the copy, so the figures are never touched.
DO $$
DECLARE
  v_count bigint; v_digest text; frozen_count bigint;
  probe_id uuid; probe_total numeric; hits int; bad int := 0;
BEGIN
  SELECT frozen_rows INTO frozen_count FROM treasury.frozen_invariant_status();
  SELECT row_count, digest INTO v_count, v_digest FROM treasury.capture_frozen_snapshot('initial capture — see migration header');

  -- 1. The snapshot covers the whole frozen set...
  IF v_count <> frozen_count OR (SELECT count(*) FROM treasury.frozen_figure_snapshot) <> frozen_count THEN
    bad := bad + 1; RAISE WARNING 'snapshot holds % of % frozen rows',
      (SELECT count(*) FROM treasury.frozen_figure_snapshot), frozen_count;
  END IF;

  -- 2. ...and drift against a fresh capture is EMPTY. A localizer that reports
  -- drift against its own capture would name every row and mean nothing.
  SELECT count(*) INTO hits FROM treasury.frozen_figure_drift();
  IF hits <> 0 THEN
    bad := bad + 1; RAISE WARNING 'a fresh capture already reports % drifted row(s)', hits;
  END IF;

  -- 3. A moved figure is NAMED. Perturb the snapshot copy, not the row.
  SELECT id, total_budget INTO probe_id, probe_total
    FROM treasury.frozen_figure_snapshot WHERE total_budget IS NOT NULL ORDER BY id LIMIT 1;
  UPDATE treasury.frozen_figure_snapshot SET total_budget = probe_total + 1 WHERE id = probe_id;

  SELECT count(*) INTO hits FROM treasury.frozen_figure_drift()
   WHERE id = probe_id AND kind = 'figure_moved'
     AND snapshot_total = probe_total + 1 AND current_total = probe_total;
  IF hits <> 1 THEN
    bad := bad + 1; RAISE WARNING 'a moved figure was not named (got % row(s))', hits;
  END IF;
  UPDATE treasury.frozen_figure_snapshot SET total_budget = probe_total WHERE id = probe_id;

  -- 4. A row that LEFT the digest is named — the shape a count alone can hide.
  DELETE FROM treasury.frozen_figure_snapshot WHERE id = probe_id;
  SELECT count(*) INTO hits FROM treasury.frozen_figure_drift()
   WHERE id = probe_id AND kind = 'entered_the_digest';
  IF hits <> 1 THEN
    bad := bad + 1; RAISE WARNING 'an unregistered arrival was not named (got % row(s))', hits;
  END IF;
  INSERT INTO treasury.frozen_figure_snapshot (id, total_budget) VALUES (probe_id, probe_total);

  -- 5. Back to silence.
  SELECT count(*) INTO hits FROM treasury.frozen_figure_drift();
  IF hits <> 0 THEN
    bad := bad + 1; RAISE WARNING 'the self-test left % drifted row(s) behind', hits;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'frozen_figure_snapshot: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — snapshot covers % rows at digest %; drift names moves, arrivals and departures', v_count, v_digest;
END $$;
