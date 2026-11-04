-- The transaction-tree check was nightly over data that cannot change nightly.
--
-- ⚠⚠ MEASURED 2026-11-04, and the measurement contradicted the comment I had
-- written one migration earlier. That comment said the checks were "ordered
-- after treasury-daily-sync (03:07) so each night's check sees what the sync
-- wrote". The daily sync writes essentially NOTHING:
--
--     daily cron    2 runs/day, 0 successes, 0 rows on almost every day
--     weekly sync   Sunday 04:13 — 4,289 rows on 2026-11-01, 23,468 on 2026-10-25
--
-- The weekly full sync is what moves data. The daily one has written nothing
-- for a fortnight.
--
-- ⚠⚠⚠ AND THE ENROLLED BUDGETS CANNOT BE TOUCHED BY CRON AT ALL. They are
-- McKinney check registers, api_type = 'xlsx_download', and the sync edge
-- function refuses anything that is not socrata. Those four trees change only
-- when a person runs scripts/bulkLoadXLSX.js — which, since #331, rebuilds the
-- tree itself as part of the load.
--
-- So the nightly job was an alarm over static data. An alarm that never has
-- anything to say is how alarms get ignored; this is the same instinct that
-- made jobHealth send nothing on a healthy day. Weekly, an hour after the full
-- sync, is proportionate to how often the thing can actually change.
--
-- ⚠ THE FLEET-WIDE zero-baseline-tie CHECK STAYS DAILY, deliberately. It counts
-- duplicate root labels and negative headline totals over EVERY budget, it is
-- one cheap aggregate, and it is the counter that found both the Ohio and the
-- McKinney defects after each had been invisible for years. Manual loads happen
-- on weekdays — 105 of them on 2026-11-04 alone — and that is exactly when a
-- duplicate label appears. That one earns its frequency.

select cron.unschedule('transaction-tree-daily');
select cron.unschedule('transaction-tree-assert');

-- Sunday 05:12, an hour after treasury-weekly-full-sync (13 4 * * 0).
select cron.schedule('transaction-tree-weekly', '12 5 * * 0', 'select treasury.run_transaction_tree_check()');
select cron.schedule('transaction-tree-assert', '13 5 * * 0', 'select treasury.assert_last_transaction_tree_ok()');

-- ⚠ The staleness window must follow the schedule. Left at 25 hours, a weekly
-- check would report STALE on six days out of seven — a gate that cries wolf
-- six days a week is one people mute.
--
-- The assert's own one-hour window is a different thing and stays as it is: it
-- guards the gap between the runner and the assert sixty seconds later, not the
-- gap between runs.
create or replace function treasury.scheduled_check_status()
returns table (check_name text, ran_at timestamptz, ok boolean, stale boolean, detail text)
language sql
security definer
set search_path to 'treasury', 'pg_catalog'
as $$
  (select 'frozen-invariant'::text, r.ran_at, r.ok, r.ran_at < now() - interval '8 days', r.detail
     from treasury.frozen_invariant_runs r order by r.ran_at desc, r.id desc limit 1)
  union all
  (select 'anon-execute-sweep'::text, r.ran_at, r.ok, r.ran_at < now() - interval '8 days', r.detail
     from treasury.anon_execute_runs r order by r.ran_at desc, r.id desc limit 1)
  union all
  (select 'transaction-trees'::text, r.ran_at, r.ok, r.ran_at < now() - interval '8 days', r.detail
     from treasury.transaction_tree_runs r order by r.ran_at desc, r.id desc limit 1)
  union all
  (select 'zero-baseline-tie'::text, r.ran_at, r.ok, r.ran_at < now() - interval '25 hours', r.detail
     from treasury.zero_baseline_tie_runs r order by r.ran_at desc, r.id desc limit 1)
$$;

revoke all on function treasury.scheduled_check_status() from public, anon;
