-- One place to read every scheduled gate's newest verdict, and the schedule
-- that produces them.
--
-- ⚠⚠ A VERDICT NOBODY CAN READ IS MOST OF THE WAY BACK TO A GATE THAT DOES NOT
-- RUN. The runs tables are revoked from anon and authenticated and PostgREST
-- cannot reach them, so without this function the only way to see a result is a
-- SQL console. `npm run verify:watchdogs` reads this.

create or replace function treasury.scheduled_check_status()
returns table (check_name text, ran_at timestamptz, ok boolean, stale boolean, detail text)
language sql
security definer
set search_path to 'treasury', 'pg_catalog'
as $$
  -- ⚠ `stale` is per check, against its OWN schedule. A single shared window
  -- would either nag about the weekly invariant or excuse a dead daily job.
  -- Boundaries verified: a daily verdict is clean at 24h and stale at 26h; the
  -- weekly one is clean at 7d and stale at 9d.
  (select 'frozen-invariant'::text, r.ran_at, r.ok, r.ran_at < now() - interval '8 days', r.detail
     from treasury.frozen_invariant_runs r order by r.ran_at desc, r.id desc limit 1)
  union all
  (select 'anon-execute-sweep'::text, r.ran_at, r.ok, r.ran_at < now() - interval '8 days', r.detail
     from treasury.anon_execute_runs r order by r.ran_at desc, r.id desc limit 1)
  union all
  (select 'transaction-trees'::text, r.ran_at, r.ok, r.ran_at < now() - interval '25 hours', r.detail
     from treasury.transaction_tree_runs r order by r.ran_at desc, r.id desc limit 1)
  union all
  (select 'zero-baseline-tie'::text, r.ran_at, r.ok, r.ran_at < now() - interval '25 hours', r.detail
     from treasury.zero_baseline_tie_runs r order by r.ran_at desc, r.id desc limit 1)
$$;

revoke all on function treasury.scheduled_check_status() from public, anon;

-- ── The schedule ───────────────────────────────────────────────────────────
--
-- ⚠ Each assert runs ONE MINUTE AFTER its runner, never in the same job. A
-- runner that raised would roll back its own INSERT, leaving no verdict to read
-- and no record that anything was wrong — the failure would erase its own
-- evidence. The runner records; the assert, separately, raises.
--
-- ⚠⚠ SUPERSEDED by *_right_size_transaction_tree_cadence.sql, and the claim
-- below was WRONG. "Ordered after treasury-daily-sync (03:07) so each night's
-- check sees what the sync wrote" assumed the daily sync writes something. It
-- does not: 2 runs a day, 0 successes, 0 rows on almost every day. The WEEKLY
-- full sync (Sunday 04:13) is what moves data. transaction-tree is now weekly
-- at Sunday 05:12; zero-baseline-tie stays daily because manual loads happen on
-- weekdays and that is when a duplicate label appears.
--
-- cron.schedule() upserts by job name, so re-running this migration re-points
-- an existing job rather than creating a duplicate.
select cron.schedule('transaction-tree-daily',   '12 3 * * *', 'select treasury.run_transaction_tree_check()');
select cron.schedule('transaction-tree-assert',  '13 3 * * *', 'select treasury.assert_last_transaction_tree_ok()');
select cron.schedule('zero-baseline-tie-daily',  '22 3 * * *', 'select treasury.run_zero_baseline_tie_check()');
select cron.schedule('zero-baseline-tie-assert', '23 3 * * *', 'select treasury.assert_last_zero_baseline_tie_ok()');

-- ⚠⚠ The assert the frozen invariant never had. run_frozen_invariant_check()
-- has recorded a verdict every Monday since 2026-08-28 and NOTHING HAS EVER
-- RAISED ON A BAD ONE — the anon sweep got its assert half, this did not. Ten
-- minutes after the existing frozen-invariant-weekly job at 06:23.
select cron.schedule('frozen-invariant-assert',  '33 6 * * 1', 'select treasury.assert_last_frozen_invariant_ok()');
