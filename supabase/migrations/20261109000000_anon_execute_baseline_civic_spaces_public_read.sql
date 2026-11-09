-- Accept civic-spaces' four public-read functions into the anon-EXECUTE baseline.
--
-- The 2026-11-09 sweep (anon-execute-sweep-assert) failed with NEW EXPOSURE on
-- four civic_spaces.get_public_* functions. They are anon-callable ON PURPOSE:
-- civic-spaces Phase 18 ("the public square") lets a signed-out visitor read a
-- slice's feed, posts and replies. The grant is civic-spaces migration
-- 20261030000200_public_read_grants ("grant anon USAGE and four EXECUTEs, and
-- nothing else"). The functions are owned and governed by that repo, so the
-- right response here is to record them as accepted, not to revoke them —
-- revoking would break the signed-out pages.
--
-- Signatures are the scanner's own text (treasury.anon_executable_functions()),
-- argument names included; that is the baseline's join key.

INSERT INTO treasury.anon_execute_baseline (signature, reason) VALUES
  ('civic_spaces.get_public_feed(p_slice_type text, p_geoid text, p_limit integer, p_cursor_at timestamp with time zone, p_cursor_id uuid)',
   'Belongs to civic-spaces (Phase 18, the public square): signed-out read of a slice feed. Granted to anon deliberately by civic-spaces migration 20261030000200_public_read_grants. Governed by that repo. Accepted 2026-11-09 so this sweep alerts on CHANGE.'),
  ('civic_spaces.get_public_post(p_post_id uuid)',
   'Belongs to civic-spaces (Phase 18, the public square): signed-out read of one post. Granted to anon deliberately by civic-spaces migration 20261030000200_public_read_grants. Governed by that repo. Accepted 2026-11-09 so this sweep alerts on CHANGE.'),
  ('civic_spaces.get_public_replies(p_post_id uuid, p_limit integer, p_cursor_at timestamp with time zone, p_cursor_id uuid)',
   'Belongs to civic-spaces (Phase 18, the public square): signed-out read of a post''s replies. Granted to anon deliberately by civic-spaces migration 20261030000200_public_read_grants. Governed by that repo. Accepted 2026-11-09 so this sweep alerts on CHANGE.'),
  ('civic_spaces.get_public_slice(p_slice_type text, p_geoid text)',
   'Belongs to civic-spaces (Phase 18, the public square): signed-out read of a slice header. Granted to anon deliberately by civic-spaces migration 20261030000200_public_read_grants. Governed by that repo. Accepted 2026-11-09 so this sweep alerts on CHANGE.')
ON CONFLICT (signature) DO NOTHING;

-- Apply-time check: every row just accepted must match a function the scanner
-- actually reports. A typo here would leave the alarm red AND add a row that
-- reports as BASELINE ENTRY GONE.
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(b.signature, ', ') INTO v_missing
    FROM treasury.anon_execute_baseline b
   WHERE b.signature LIKE 'civic_spaces.get_public_%'
     AND NOT EXISTS (SELECT 1 FROM treasury.anon_executable_functions() f WHERE f.signature = b.signature);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'baseline rows match no live anon-executable function: %', v_missing;
  END IF;
END $$;
