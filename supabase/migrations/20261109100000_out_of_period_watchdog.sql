-- Put the out-of-period gate on a schedule, inside the database.
--
-- ⚠⚠⚠ WHY NOT GITHUB ACTIONS — unchanged from 20261104180000: every gate in
-- scripts/verify*.mjs needs the service-role key, which bypasses RLS entirely,
-- and PR #90 deliberately removed that fallback. So the gates run HERE.
--
-- Pattern copied from run_transaction_tree_check / assert_last_transaction_tree_ok:
--   run_X()            SECURITY DEFINER, computes a verdict and INSERTs it.
--                      NEVER raises, so one bad week cannot stop the recording.
--   assert_last_X_ok() RAISES when the newest verdict is bad, stale or absent.
--                      Scheduled a minute later; the RAISE fails that pg_cron
--                      job, which is what makes the failure visible.
--
-- ── ⚠⚠⚠ WHAT THIS CHECK DOES *NOT* DO, AND WHY ────────────────────────────
--
-- It does NOT mirror `scripts/data/outOfPeriodExceptions.mjs` into a table.
-- 20261104180000 already settled that question for the totals ratchet:
--
--     "Its baselines live in code ON PURPOSE — paying one down is reviewed in a
--      PR diff ... Mirroring them into a table would create a second authority
--      that can drift from the first."
--
-- The out-of-period `outRows` baselines are exactly that kind of baseline, and
-- they now carry publisher confirmation that only the CLI gate can obtain —
-- scripts/lib/outOfPeriodPublisher.mjs asks Socrata whether a moved count is
-- real, which Postgres cannot do synchronously. So the authority stays in the
-- repo, and this watchdog asserts only what needs NO baseline and NO judgement.
--
-- ── WHAT IT DOES ASSERT ───────────────────────────────────────────────────
--
--   1. ⚠ THE GATE CAN SEE ITS SUBJECT. `evaluated = 0` means nothing was
--      checked, which must never read as a pass — the shape this project keeps
--      rediscovering.
--   2. ⚠ NO BUDGET IS UNJUDGEABLE. `skipped_no_start_month > 0` means a budget
--      has no fiscal period, so out-of-period rows inside it are invisible.
--      The CLI gate already fails on this; now so does the schedule.
--   3. ⭐⭐ THE SET OF AFFECTED BUDGETS HAS NOT CHANGED. Not the counts — the
--      SET. A budget gaining or losing out-of-period rows is the defect class
--      nobody noticed: West Hollywood FY2017 and FY2018 sat undeclared from the
--      moment they were loaded until someone ran the gate by hand.
--
-- ⭐ KEYED ON THE SET, NOT THE COUNTS, AND THAT IS THE WHOLE DESIGN. West
-- Hollywood's FY2025-26 register is synced weekly and its count climbs by
-- ~1,500 rows a month BY DESIGN; alarming on that would make this a weekly
-- false alarm, and noise is how alarms get ignored. The SET only changes when a
-- year is loaded or a reload repairs one — rare, and exactly when a human
-- should be told.
--
-- ⚠⚠ THE DIGEST ALARM IS ONE-SHOT, AND THAT IS A REAL LIMITATION. A change
-- makes one run NOT OK; the next run compares against the new digest and goes
-- green, because nothing in the database can tell whether a human then declared
-- the budget in the repo. So this is a NOTIFICATION, not a latch. It is the
-- right trade anyway: ev-job-health emails once per failed job, and a latch
-- that could never be cleared from inside Postgres would be permanently red and
-- therefore ignored. ⛔ The authority on whether a budget is declared remains
-- `npm run verify:out-of-period`, which this alarm exists to prompt.

create table if not exists treasury.out_of_period_runs (
  id                bigserial primary key,
  ran_at            timestamptz not null default now(),
  evaluated         bigint      not null,
  skipped           bigint      not null,
  budgets_with_hits int         not null,
  out_rows          bigint      not null,
  -- ⚠ The SUBJECTS themselves, not just their digest, so a person reading a
  -- failure can diff two runs without re-deriving anything.
  subjects          text        not null,
  subject_digest    text        not null,
  ok                boolean     not null,
  detail            text        not null
);
alter table treasury.out_of_period_runs enable row level security;
revoke all on table treasury.out_of_period_runs from public, anon, authenticated;

create or replace function treasury.run_out_of_period_check()
returns void
language plpgsql
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
declare
  v_evaluated bigint; v_skipped bigint;
  v_hits int; v_rows bigint;
  v_subjects text; v_digest text;
  v_prev_digest text; v_prev_subjects text;
  v_ok boolean; v_detail text;
begin
  select c.evaluated, c.skipped_no_start_month
    into v_evaluated, v_skipped
    from treasury.out_of_period_coverage() c;

  -- ⚠ One stable line per affected budget, ordered, so the digest depends on
  -- the SET and never on the order rows happen to come back in.
  select count(*), coalesce(sum(s.out_rows), 0),
         coalesce(string_agg(format('%s, %s FY%s', s.municipality, s.state, s.fiscal_year),
                             E'\n' order by s.municipality, s.state, s.fiscal_year), '')
    into v_hits, v_rows, v_subjects
    from treasury.out_of_period_transaction_status() s;

  v_digest := md5(v_subjects);

  select r.subject_digest, r.subjects
    into v_prev_digest, v_prev_subjects
    from treasury.out_of_period_runs r
   order by r.ran_at desc, r.id desc
   limit 1;

  if v_evaluated = 0 then
    -- ⚠⚠ INCONCLUSIVE, NOT CLEAN. If no budget can be evaluated, every number
    -- above is zero and this would otherwise report a perfect pass.
    v_ok := false;
    v_detail := 'out_of_period_coverage() evaluated NO budget at all. The gate is checking '
             || 'NOTHING. This is INCONCLUSIVE, not a pass.';

  elsif v_skipped > 0 then
    v_ok := false;
    v_detail := format(
      '%s transaction budget(s) have no fiscal_year_start_month, so their period is unknown '
      || 'and any out-of-period row inside them is invisible to this gate. Unjudgeable is not '
      || 'clean.', v_skipped);

  elsif v_prev_digest is null then
    -- First ever run: there is nothing to compare against, and inventing a
    -- baseline here would be the second authority this check exists to avoid.
    v_ok := true;
    v_detail := format(
      'First recorded verdict. %s budget(s) hold %s out-of-period row(s) across %s evaluated. '
      || 'Recorded as the set to compare future runs against; whether each is DECLARED is '
      || 'verify:out-of-period''s question, not this one.', v_hits, v_rows, v_evaluated);

  elsif v_prev_digest <> v_digest then
    v_ok := false;
    v_detail := format(
      'THE SET OF BUDGETS HOLDING OUT-OF-PERIOD ROWS HAS CHANGED (%s now, %s rows). A budget '
      || 'gaining or losing them is the defect class that went unnoticed before: West Hollywood '
      || 'FY2017 and FY2018 sat undeclared from the moment they were loaded. Run '
      || '`npm run verify:out-of-period` — it is the authority on whether each is declared, and '
      || 'it asks the publishers. ⚠ This alarm is ONE-SHOT: the next run compares against the '
      || 'new set and will go green whether or not anything was declared.'
      || E'\n\n--- was ---\n%s\n\n--- now ---\n%s',
      v_hits, v_rows, v_prev_subjects, v_subjects);

  else
    v_ok := true;
    v_detail := format(
      'Unchanged: the same %s budget(s) hold out-of-period rows across %s evaluated, now %s '
      || 'row(s). ⚠ Counts are NOT asserted here — West Hollywood FY2025-26 is synced weekly '
      || 'and climbs by design; verify:out-of-period confirms a moved count against the '
      || 'publisher.', v_hits, v_evaluated, v_rows);
  end if;

  insert into treasury.out_of_period_runs
    (evaluated, skipped, budgets_with_hits, out_rows, subjects, subject_digest, ok, detail)
  values
    (v_evaluated, v_skipped, v_hits, v_rows, v_subjects, v_digest, v_ok, v_detail);
end;
$$;

create or replace function treasury.assert_last_out_of_period_ok()
returns void
language plpgsql
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
declare v_last treasury.out_of_period_runs%rowtype;
begin
  -- id breaks ties: two runs in one transaction share now(), so ran_at alone
  -- can pick the older, clean row.
  select * into v_last from treasury.out_of_period_runs order by ran_at desc, id desc limit 1;

  if not found then
    raise exception 'out-of-period check: no verdict has ever been recorded. INCONCLUSIVE, not a pass.';
  end if;
  -- ⚠ Against THIS run, not against the cadence. The assert fires a minute
  -- after the runner, so anything older means the runner did not run.
  if v_last.ran_at < now() - interval '1 hour' then
    raise exception 'out-of-period check: the newest verdict is from %, not from this run. Check the out-of-period-weekly pg_cron job.',
      v_last.ran_at;
  end if;
  if not v_last.ok then
    raise exception 'out-of-period check NOT OK (run at %): %', v_last.ran_at, v_last.detail;
  end if;
end;
$$;

revoke all on function treasury.run_out_of_period_check() from public, anon, authenticated;
revoke all on function treasury.assert_last_out_of_period_ok() from public, anon, authenticated;

-- ── Surface it beside the others ───────────────────────────────────────────
--
-- ⚠ `stale` is per check, against its OWN schedule — 8 days for a weekly job,
-- matching frozen-invariant and anon-execute-sweep.
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
  union all
  (select 'out-of-period'::text, r.ran_at, r.ok, r.ran_at < now() - interval '8 days', r.detail
     from treasury.out_of_period_runs r order by r.ran_at desc, r.id desc limit 1)
$$;

revoke all on function treasury.scheduled_check_status() from public, anon;

-- ── The schedule ───────────────────────────────────────────────────────────
--
-- ⚠ The assert runs ONE MINUTE AFTER the runner, never in the same job. A
-- runner that raised would roll back its own INSERT, leaving no verdict to read
-- and no record that anything was wrong — the failure would erase its own
-- evidence.
--
-- ⚠⚠ WEEKLY, SUNDAY 05:40, AND THE ORDER MATTERS. treasury-weekly-full-sync
-- runs Sunday 04:13 and is what actually moves data (the daily sync writes
-- almost nothing — 2 runs a day, 0 rows on most days, per
-- 20261104190000_right_size_transaction_tree_cadence.sql). transaction-tree
-- runs Sunday 05:12. This goes after both, so each week's verdict sees what the
-- sync wrote and does not race the tree rebuild.
--
-- ⚠ Weekly, not daily: the SET of affected budgets changes only when a year is
-- loaded, and a manual load is followed by a manual gate run anyway. A daily
-- alarm over a set that moves a few times a month is noise.
select cron.schedule('out-of-period-weekly', '40 5 * * 0', 'select treasury.run_out_of_period_check()');
select cron.schedule('out-of-period-assert', '41 5 * * 0', 'select treasury.assert_last_out_of_period_ok()');
