-- The scheduled runner, plus the grants the mirror tables need.
--
-- Split from 20260828000200 because that migration was applied first and this
-- followed; the files mirror the order they actually ran in rather than being
-- collapsed after the fact.

create or replace function treasury.run_frozen_invariant_check()
returns void
language plpgsql
security definer
set search_path = treasury, public, extensions
as $$
declare
  v_rows   bigint;
  v_digest text;
  b        treasury.frozen_invariant_baseline%rowtype;
  v_ok     boolean;
  v_detail text;
begin
  select frozen_rows, digest into v_rows, v_digest from treasury.frozen_invariant_status();
  select * into b from treasury.frozen_invariant_baseline where singleton;

  -- ⚠ No baseline is INCONCLUSIVE, never a pass. A check that cannot compare
  -- against anything must not look green — the same rule sco-fiscal-year-watch.yml
  -- applies when it cannot reach its source.
  if b.digest is null then
    v_ok := false;
    v_detail := 'No baseline recorded - nothing to compare against. This is INCONCLUSIVE, not a pass.';

  -- ⚠ Name the ACTUAL condition. Reporting "a figure moved" for what is really a
  -- milestone forgetting its created-ids file is how this check stopped being read
  -- across v2.27-v2.29, and again after v2.30.
  elsif v_rows <> b.frozen_rows then
    v_ok := false;
    v_detail := format(
      'ROWS NOT REGISTERED: %s frozen rows vs %s expected (%s unaccounted). A milestone '
      'inserted rows without registering them. This is NOT evidence a figure moved.',
      v_rows, b.frozen_rows, v_rows - b.frozen_rows);

  elsif v_digest <> b.digest then
    v_ok := false;
    v_detail := format(
      'FIGURE CHANGED: the count reconciles (%s) so a surviving row''s figure moved. '
      'If authorised, add it to the ledger with the value it replaced.', v_rows);
  else
    v_ok := true;
    v_detail := 'unchanged';
  end if;

  insert into treasury.frozen_invariant_runs
    (frozen_rows, digest, expected_rows, expected_digest, ok, detail)
  values (v_rows, v_digest, b.frozen_rows, b.digest, v_ok, v_detail);
end;
$$;

revoke all on function treasury.run_frozen_invariant_check() from public, anon;

-- ⚠ These mirror tables are INTERNAL. service_role only — never anon or
-- authenticated. Granting them publicly would recreate the open read surface this
-- whole design exists to avoid.
grant select, insert, update, delete on treasury.frozen_excluded_ids to service_role;
grant select, insert, update, delete on treasury.frozen_figure_ledger to service_role;
grant select, insert on treasury.frozen_invariant_runs to service_role;
grant select, insert, update on treasury.frozen_invariant_baseline to service_role;
grant execute on function treasury.frozen_invariant_status() to service_role;
grant execute on function treasury.run_frozen_invariant_check() to service_role;
