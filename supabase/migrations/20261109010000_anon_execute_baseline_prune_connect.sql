-- Prune three anon-EXECUTE baseline rows that no longer excuse anything.
--
-- ev-accounts migration CA_0349_revoke_definer_function_execute revoked
-- anon/authenticated EXECUTE on these connect.* functions (ACL is now
-- postgres + service_role only). The sweep has reported them as
-- "BASELINE ENTRY GONE" since. That is good news, but left in place the rows
-- repeat the note every week and would silently re-excuse the functions if a
-- later grant re-exposed them. Removing them means a re-exposure alarms.

DELETE FROM treasury.anon_execute_baseline b
 WHERE b.signature IN (
   'connect.calculate_level(p_total_xp bigint)',
   'connect.gen_referral_code()',
   'connect.get_xp_leaderboard(p_window text, p_limit integer)'
 )
   AND NOT EXISTS (SELECT 1 FROM treasury.anon_executable_functions() f WHERE f.signature = b.signature);

-- Apply-time check: nothing is left in the baseline that the scanner no
-- longer reports.
DO $$
DECLARE v_gone text;
BEGIN
  SELECT string_agg(b.signature, ', ') INTO v_gone
    FROM treasury.anon_execute_baseline b
   WHERE NOT EXISTS (SELECT 1 FROM treasury.anon_executable_functions() f WHERE f.signature = b.signature);
  IF v_gone IS NOT NULL THEN
    RAISE EXCEPTION 'baseline still holds entries no longer exposed: %', v_gone;
  END IF;
END $$;
