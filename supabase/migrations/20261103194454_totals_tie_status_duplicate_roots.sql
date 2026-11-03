-- Add `duplicates` to treasury.totals_tie_status().
--
-- ⚠⚠ WHY THE OLD SHAPE COULD NOT SEE THIS. The function only ever grouped
-- CANDIDATES — rows that are negative, rootless, or fail the tie by more than
-- a dollar. A budget whose tree repeats a LABEL but still sums correctly is
-- none of those, so it never entered the aggregate at all. Ohio's expenditure
-- side carries 13 such rows (`Other` twice, two different amounts, from two
-- different groups) and every run of this gate reported them as fine.
--
-- The 1,763-row revenue cohort was caught ONLY because its duplicate was a
-- VERBATIM repeated column and therefore double-counted into a mismatch. Had
-- the publisher repeated a column carrying a different value, all 1,763 would
-- have tied and this function would have stayed silent on every one of them.
--
-- So `duplicates` is counted over EVERY budget, not over candidates.
--
-- ⚠ Read-only. It changes no figure and moves no frozen row.
-- ⚠ Return type changes, so the old function must be dropped, not replaced.

drop function if exists treasury.totals_tie_status();

create function treasury.totals_tie_status()
returns table (
  source      text,
  candidates  bigint,
  mismatches  bigint,
  negatives   bigint,
  rootless    bigint,
  duplicates  bigint
)
language sql
stable
security definer
set search_path = treasury, public, extensions
as $$
  with roots as (
    select budget_id,
           sum(amount)          as root_sum,
           count(*)             as n_roots,
           count(distinct name) as distinct_root_names
    from treasury.budget_categories
    where parent_id is null
    group by budget_id
  ),
  scored as (
    select split_part(b.data_source, ' —', 1)       as source,
           b.total_budget                           as total,
           coalesce(r.root_sum, 0)                  as root_sum,
           coalesce(r.n_roots, 0)                   as n_roots,
           coalesce(r.distinct_root_names, 0)       as distinct_root_names
    from treasury.budgets b
    left join roots r on r.budget_id = b.id
  )
  select source,
         -- ⚠ The candidate filter is deliberately WIDER than the rule in
         -- scripts/lib/totalsTie.mjs, so the rule stays the single authority:
         -- SQL narrows, JS judges. A one-dollar gap is rounding.
         count(*) filter (where total < 0
                             or n_roots = 0
                             or abs(total - root_sum) > 1)          as candidates,
         count(*) filter (where n_roots > 0
                            and abs(total - root_sum) > 1)          as mismatches,
         count(*) filter (where total < 0)                          as negatives,
         count(*) filter (where n_roots = 0)                        as rootless,
         count(*) filter (where n_roots > distinct_root_names)      as duplicates
  from scored
  group by source
  having count(*) filter (where total < 0
                            or n_roots = 0
                            or abs(total - root_sum) > 1) > 0
      or count(*) filter (where n_roots > distinct_root_names) > 0
  order by 2 desc;
$$;

comment on function treasury.totals_tie_status() is
  'Per-source counts of budgets whose total does not tie to the sum of their '
  'root categories, plus negative totals, rootless rows, and trees that repeat '
  'a root LABEL (counted over every budget, not just candidates, because a '
  'duplicate label can tie perfectly). Read-only; security definer so a '
  'scheduled job needs no elevated caller.';

-- ⛔⛔ CREATE FUNCTION GRANTS EXECUTE TO PUBLIC. Revoking is not optional, and
-- ALTER DEFAULT PRIVILEGES does not cover it here. `npm run verify:grants`
-- sweeps for exactly this.
revoke all on function treasury.totals_tie_status() from public, anon;
