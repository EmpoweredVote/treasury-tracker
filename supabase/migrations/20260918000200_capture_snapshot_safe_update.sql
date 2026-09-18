-- ⚠⚠ `DELETE ... ;` WITHOUT A WHERE CLAUSE FAILS THROUGH THE API.
--
-- treasury.capture_frozen_snapshot() passed its own self-verification and then
-- failed the first time a SCRIPT called it:
--
--     Capture failed: DELETE requires a WHERE clause
--
-- Supabase runs the API roles with pg_safeupdate ("safe mode") loaded, which
-- refuses an unqualified DELETE or UPDATE. A migration's DO block does not hit
-- it, because that runs as the migration role — so the self-test could not have
-- caught this, and no amount of care inside the block would have helped.
--
-- ⭐ THE LESSON WORTH KEEPING: a migration self-test proves the SQL, not the
-- PATH. Anything a script will call through PostgREST has to be called that way
-- once, as a script, before it is believed. That is the only reason this was
-- found within the hour rather than the next time someone needed a capture — at
-- which point it would have been failing in the middle of an incident.
--
-- Two changes:
--   1. `WHERE true` on both deletes — explicit, and honest about intent.
--   2. SECURITY DEFINER, matching every other treasury function a script calls.
--      service_role holds SELECT on these tables, not DELETE/INSERT, so the
--      capture would have failed on the next statement anyway.

CREATE OR REPLACE FUNCTION treasury.capture_frozen_snapshot(p_note text DEFAULT NULL)
RETURNS TABLE (row_count bigint, digest text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $$
DECLARE v_count bigint; v_digest text;
BEGIN
  DELETE FROM treasury.frozen_figure_snapshot WHERE true;

  INSERT INTO treasury.frozen_figure_snapshot (id, total_budget)
  SELECT b.id, b.total_budget
    FROM treasury.budgets b
   WHERE NOT EXISTS (SELECT 1 FROM treasury.frozen_excluded_ids e WHERE e.id = b.id);

  SELECT s.frozen_rows, s.digest INTO v_count, v_digest
    FROM treasury.frozen_invariant_status() s;

  DELETE FROM treasury.frozen_figure_snapshot_meta WHERE true;
  INSERT INTO treasury.frozen_figure_snapshot_meta (row_count, digest, note)
  VALUES (v_count, v_digest, p_note);

  RETURN QUERY SELECT v_count, v_digest;
END $$;

GRANT EXECUTE ON FUNCTION treasury.capture_frozen_snapshot(text) TO service_role;

-- PostgREST only reaches `public`, and npm run frozen:snapshot calls it by RPC.
CREATE OR REPLACE FUNCTION public.capture_frozen_snapshot(p_note text DEFAULT NULL)
RETURNS TABLE (row_count bigint, digest text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $$ SELECT * FROM treasury.capture_frozen_snapshot(p_note); $$;

GRANT EXECUTE ON FUNCTION public.capture_frozen_snapshot(text) TO service_role;

COMMENT ON FUNCTION public.capture_frozen_snapshot(text) IS
  'PostgREST-facing wrapper for treasury.capture_frozen_snapshot(). Called by npm run frozen:snapshot.';
