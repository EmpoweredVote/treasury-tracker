-- Make the verify gates actually run, on a schedule, inside the database.
--
-- ⚠⚠⚠ WHY NOT GITHUB ACTIONS. Every gate in scripts/verify*.mjs needs database
-- access, and the only credential that reaches these functions is the
-- service-role key — which bypasses RLS entirely. frozen-invariant-watch.yml
-- records the decision not to put one in Actions (it would partly undo PR #90,
-- where the sync key moved into Vault and the service-role fallback was
-- deleted), and disables its own schedule for exactly that reason. So the gates
-- run HERE, where no credential travels and no rows cross the network.
--
-- ── THE PATTERN, copied from run_anon_execute_sweep / assert_last_anon_sweep_ok
--
--   run_X()          SECURITY DEFINER. Computes a verdict, INSERTs it. Never
--                    raises, so one bad week cannot stop the recording.
--   assert_last_X_ok() RAISES when the newest verdict is bad, STALE, or absent.
--                    Scheduled a minute later; the RAISE fails that pg_cron job,
--                    which is what makes the failure visible.
--
-- ⚠⚠ THE STALENESS AND ABSENCE CHECKS ARE THE POINT. A gate that cannot reach
-- its subject must NOT look like a pass — that is the shape this project keeps
-- rediscovering (verify-budget-axes.mjs ran nowhere for three releases). An
-- assert that only checks `ok` goes green forever the moment the runner stops.
--
-- ⚠ WHAT IS DELIBERATELY NOT GATED HERE: the mismatched-totals ratchet in
-- scripts/verifyTotalsTieToTree.mjs. Its baselines live in code ON PURPOSE —
-- paying one down is reviewed in a PR diff, which is how #328, #329 and #330
-- were held to account. Mirroring them into a table would create a second
-- authority that can drift from the first. Only the counters held at ZERO,
-- which need no baseline and no judgement, are gated here.

-- ── 1. Transaction-backed trees ────────────────────────────────────────────
create table if not exists treasury.transaction_tree_runs (
  id                bigserial primary key,
  ran_at            timestamptz not null default now(),
  budgets           int         not null,
  unkeyed_txns      bigint      not null,
  roots_without_key bigint      not null,
  keys_without_root bigint      not null,
  roots_without_txn bigint      not null,
  amount_drift      bigint      not null,
  ok                boolean     not null,
  detail            text        not null
);
alter table treasury.transaction_tree_runs enable row level security;
revoke all on table treasury.transaction_tree_runs from public, anon, authenticated;

create or replace function treasury.run_transaction_tree_check()
returns void
language plpgsql
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
declare
  v_budgets int; v_unkeyed bigint; v_keyless bigint;
  v_no_root bigint; v_no_txn bigint; v_drift bigint;
  v_ok boolean; v_detail text;
begin
  select count(*), coalesce(sum(s.unkeyed_txns),0), coalesce(sum(s.roots_without_key),0),
         coalesce(sum(s.keys_without_root),0), coalesce(sum(s.roots_without_txn),0),
         coalesce(sum(s.amount_drift),0)
    into v_budgets, v_unkeyed, v_keyless, v_no_root, v_no_txn, v_drift
    from treasury.transaction_tree_status() s;

  -- ⚠ ZERO ROWS IS INCONCLUSIVE, NOT CLEAN. If the enrolled-source pattern in
  -- transaction_tree_status() stops matching anything, every sum above is 0 and
  -- the gate would report a perfect pass while checking nothing.
  if v_budgets = 0 then
    v_ok := false;
    v_detail := 'No enrolled budget matched transaction_tree_status(). The gate is checking '
             || 'NOTHING. This is INCONCLUSIVE, not a pass - fix the pattern in the migration.';
  elsif v_unkeyed + v_keyless + v_no_root + v_no_txn + v_drift > 0 then
    v_ok := false;
    v_detail := format(
      'A published tree disagrees with the transactions beneath it across %s budget(s): '
      || '%s transaction(s) with no link_key, %s root(s) with no link_key, %s key(s) with no root, '
      || '%s root(s) with no transactions, %s root(s) whose amount drifted. '
      || 'Fix: node --env-file=.env scripts/rebuildTransactionTree.mjs --municipality McKinney. '
      || 'Do NOT add a baseline - the tree is derived, so this is always fixable.',
      v_budgets, v_unkeyed, v_keyless, v_no_root, v_no_txn, v_drift);
  else
    v_ok := true;
    v_detail := format('%s enrolled budget(s) match their transactions, key for key and cent for cent.', v_budgets);
  end if;

  insert into treasury.transaction_tree_runs
    (budgets, unkeyed_txns, roots_without_key, keys_without_root, roots_without_txn, amount_drift, ok, detail)
  values (v_budgets, v_unkeyed, v_keyless, v_no_root, v_no_txn, v_drift, v_ok, v_detail);
end;
$$;

create or replace function treasury.assert_last_transaction_tree_ok()
returns void
language plpgsql
set search_path to 'treasury', 'pg_catalog'
as $$
declare v_last treasury.transaction_tree_runs%rowtype;
begin
  -- id breaks ties: two runs in one transaction share now(), so ran_at alone
  -- can pick the older, clean row.
  select * into v_last from treasury.transaction_tree_runs order by ran_at desc, id desc limit 1;

  if not found then
    raise exception 'transaction-tree check: no verdict has ever been recorded. INCONCLUSIVE, not a pass.';
  end if;
  if v_last.ran_at < now() - interval '1 hour' then
    raise exception 'transaction-tree check: the newest verdict is from %, not from this run. Check the transaction-tree-daily pg_cron job.',
      v_last.ran_at;
  end if;
  if not v_last.ok then
    raise exception 'transaction-tree check NOT OK (run at %): %', v_last.ran_at, v_last.detail;
  end if;
end;
$$;

-- ── 2. The tie counters that are held at ZERO ──────────────────────────────
create table if not exists treasury.zero_baseline_tie_runs (
  id          bigserial primary key,
  ran_at      timestamptz not null default now(),
  sources     int         not null,
  duplicates  bigint      not null,
  negatives   bigint      not null,
  ok          boolean     not null,
  detail      text        not null
);
alter table treasury.zero_baseline_tie_runs enable row level security;
revoke all on table treasury.zero_baseline_tie_runs from public, anon, authenticated;

create or replace function treasury.run_zero_baseline_tie_check()
returns void
language plpgsql
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
declare
  v_sources int; v_dup bigint; v_neg bigint; v_ok boolean; v_detail text; v_worst text;
begin
  select count(*), coalesce(sum(s.duplicates),0), coalesce(sum(s.negatives),0)
    into v_sources, v_dup, v_neg
    from treasury.totals_tie_status() s;

  if v_sources = 0 then
    v_ok := false;
    v_detail := 'totals_tie_status() returned no rows at all. The gate is checking NOTHING. '
             || 'INCONCLUSIVE, not a pass.';
  elsif v_dup + v_neg > 0 then
    select string_agg(format('%s (dup %s, neg %s)', s.source, s.duplicates, s.negatives), '; '
                      order by s.duplicates + s.negatives desc)
      into v_worst
      from treasury.totals_tie_status() s
     where s.duplicates > 0 or s.negatives > 0;
    v_ok := false;
    v_detail := format(
      '%s duplicate root label(s) and %s negative headline total(s) across the fleet: %s. '
      || 'A breakdown that shows the reader one label twice can still tie to the dollar. '
      || 'Fix the loader; do NOT raise a baseline, and do NOT deduplicate by appending a code.',
      v_dup, v_neg, v_worst);
  else
    v_ok := true;
    v_detail := format('%s source(s) examined; 0 duplicate root labels, 0 negative totals.', v_sources);
  end if;

  insert into treasury.zero_baseline_tie_runs (sources, duplicates, negatives, ok, detail)
  values (v_sources, v_dup, v_neg, v_ok, v_detail);
end;
$$;

create or replace function treasury.assert_last_zero_baseline_tie_ok()
returns void
language plpgsql
set search_path to 'treasury', 'pg_catalog'
as $$
declare v_last treasury.zero_baseline_tie_runs%rowtype;
begin
  select * into v_last from treasury.zero_baseline_tie_runs order by ran_at desc, id desc limit 1;
  if not found then
    raise exception 'zero-baseline tie check: no verdict has ever been recorded. INCONCLUSIVE, not a pass.';
  end if;
  if v_last.ran_at < now() - interval '1 hour' then
    raise exception 'zero-baseline tie check: the newest verdict is from %, not from this run. Check the zero-baseline-tie-daily pg_cron job.',
      v_last.ran_at;
  end if;
  if not v_last.ok then
    raise exception 'zero-baseline tie check NOT OK (run at %): %', v_last.ran_at, v_last.detail;
  end if;
end;
$$;

-- ── 3. The assert the frozen invariant never had ───────────────────────────
--
-- ⚠⚠ run_frozen_invariant_check() has recorded a verdict weekly since
-- 2026-08-28 and NOTHING HAS EVER RAISED ON A BAD ONE. The anon sweep got its
-- assert half; this one did not. A failing invariant would have written
-- `ok = false` into treasury.frozen_invariant_runs and sat there unread — the
-- same silence the workflow was built to end, one layer further in.
create or replace function treasury.assert_last_frozen_invariant_ok()
returns void
language plpgsql
set search_path to 'treasury', 'pg_catalog'
as $$
declare v_last treasury.frozen_invariant_runs%rowtype;
begin
  select * into v_last from treasury.frozen_invariant_runs order by ran_at desc, id desc limit 1;
  if not found then
    raise exception 'frozen invariant: no verdict has ever been recorded. INCONCLUSIVE, not a pass.';
  end if;
  -- ⚠ WEEKLY job, so the window is a week and a day — not the one hour used
  -- above. Too tight a window would fail every day in between and train people
  -- to ignore it.
  if v_last.ran_at < now() - interval '8 days' then
    raise exception 'frozen invariant: the newest verdict is from %, over 8 days old. The frozen-invariant-weekly pg_cron job has stopped.',
      v_last.ran_at;
  end if;
  if not v_last.ok then
    raise exception 'frozen invariant NOT OK (run at %): %. Never regenerate figures_frozen to make this pass.',
      v_last.ran_at, v_last.detail;
  end if;
end;
$$;

revoke all on function treasury.run_transaction_tree_check()          from public, anon;
revoke all on function treasury.assert_last_transaction_tree_ok()     from public, anon;
revoke all on function treasury.run_zero_baseline_tie_check()         from public, anon;
revoke all on function treasury.assert_last_zero_baseline_tie_ok()    from public, anon;
revoke all on function treasury.assert_last_frozen_invariant_ok()     from public, anon;
