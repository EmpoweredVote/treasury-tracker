-- Move the frozen-figure invariant INSIDE the database.
--
-- WHY: the check previously required a service-role key in GitHub Actions — a
-- credential that bypasses RLS entirely, which would partly undo PR #90 (sync key
-- moved to Vault, service-role fallback deleted). The alternative considered was
-- publishing read-only views to `anon`, rejected because an uncapped public read
-- surface is a cost/abuse loop, and this project has been burned by exactly that
-- (a live per-entity BigQuery pattern once ran ~$132/day).
--
-- Computing it here means NO credential travels anywhere, there is NO public
-- surface, and — a bonus that cuts existing cost — the harness no longer pulls
-- 87,880 rows across the network on every run. One row comes back instead.
--
-- ⚠ THE DIGEST MUST MATCH THE JS IMPLEMENTATION BYTE FOR BYTE.
-- scripts/lib/scopeVerify.mjs does:
--     sha256( rows.filter(not excluded)
--                 .map(r => `${r.id}|${old ?? r.total_budget ?? '~'}`)
--                 .sort()
--                 .join('\n') )
-- Two details make SQL agree with it:
--   1. ORDER BY ... COLLATE "C" — JavaScript's Array.sort() compares code units,
--      not locale rules. A locale collation here would order differently and
--      produce a different hash for identical data.
--   2. total_budget::text — the JS side fetches it as text precisely because
--      PostgREST's JSON encoding drops numeric scale on some rows. Casting in
--      SQL preserves the same digits.
-- scripts/syncFrozenInvariantState.mjs proves the two agree against live data on every run.

create table if not exists treasury.frozen_excluded_ids (
  id          uuid primary key,
  source_file text not null,
  synced_at   timestamptz not null default now()
);
comment on table treasury.frozen_excluded_ids is
  'Rows created after the freeze, mirrored from scopeBaseline.json excluded_ids_files. '
  'Synced by scripts/syncFrozenInvariantState.mjs — the repo JSON stays the source of truth.';

create table if not exists treasury.frozen_figure_ledger (
  id          uuid primary key,
  old_value   text not null,
  why         text not null,
  source_file text not null,
  synced_at   timestamptz not null default now()
);
comment on table treasury.frozen_figure_ledger is
  'Authorised figure corrections: the value a frozen row held BEFORE an approved fix. '
  'The digest hashes old_value, so a recorded correction leaves it unchanged while an '
  'unrecorded one still moves it.';

-- The invariant itself. Returns what the harness needs to judge, and nothing else.
create or replace function treasury.frozen_invariant_status()
returns table (frozen_rows bigint, digest text)
language sql
stable
security definer
set search_path = treasury, public, extensions
as $$
  with frozen as (
    select b.id,
           coalesce(l.old_value, b.total_budget::text, '~') as value
    from treasury.budgets b
    left join treasury.frozen_figure_ledger l on l.id = b.id
    where not exists (select 1 from treasury.frozen_excluded_ids e where e.id = b.id)
  ),
  lines as (
    select (id::text || '|' || value) as line from frozen
  )
  select count(*)::bigint,
         encode(
           extensions.digest(
             coalesce(string_agg(line, E'\n' order by line collate "C"), ''),
             'sha256'),
           'hex')
  from lines;
$$;

comment on function treasury.frozen_invariant_status() is
  'Row count and sha256 digest of the frozen figure set. Mirrors frozenIdDigest() in '
  'scripts/lib/scopeVerify.mjs; parity is proven on every run by syncFrozenInvariantState.mjs. '
  'security definer so a scheduled job needs no elevated caller.';

revoke all on function treasury.frozen_invariant_status() from public, anon;

-- A durable record of every scheduled run, so a failure is visible after the fact
-- rather than living only in a log nobody opens.
create table if not exists treasury.frozen_invariant_runs (
  ran_at       timestamptz primary key default now(),
  frozen_rows  bigint  not null,
  digest       text    not null,
  expected_rows bigint,
  expected_digest text,
  ok           boolean not null,
  detail       text
);
comment on table treasury.frozen_invariant_runs is
  'One row per scheduled invariant check. `ok=false` means the count or the digest '
  'moved — read `detail`, and see reference_frozen_figure_invariant before acting.';

-- The expected values live in the DB so the scheduled job is self-contained.
create table if not exists treasury.frozen_invariant_baseline (
  singleton    boolean primary key default true check (singleton),
  frozen_rows  bigint not null,
  digest       text   not null,
  updated_at   timestamptz not null default now(),
  note         text
);
