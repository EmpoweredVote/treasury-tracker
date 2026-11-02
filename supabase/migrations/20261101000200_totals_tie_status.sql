-- A headline total must equal the sum of its own root categories.
--
-- ⚠⚠ NOTHING ASSERTED THIS, and on 2026-11-01 one query found 1,765 Ohio AOS
-- rows whose stored total contradicts their own tree — 211 entities, average
-- gap $7.0M — and 13 that publish a NEGATIVE total. The worst, Huber Heights
-- FY2024 operating, reads −$35,461,443 while its only two root categories sum
-- to +$10,483,560. It surfaced while looking at an unrelated $1 budget in
-- Indiana, which is the point: a property everyone assumes and nothing checks
-- is found by accident or not at all.
--
-- ⭐ 100% of those 1,765 carry DUPLICATE ROOT-CATEGORY NAMES — the mechanism,
-- not a coincidence. This function does NOT fix them; it makes them visible
-- and keeps them from growing. See scripts/verifyTotalsTieToTree.mjs.
--
-- ⚠ Read-only. It changes no figure and moves no frozen row.
--
-- Shape copied from treasury.frozen_invariant_status(): a server-side
-- aggregate because the join spans 585,587 budgets and all their categories,
-- which PostgREST cannot express and is far too slow to page client-side.

create or replace function treasury.totals_tie_status()
returns table (
  source      text,
  candidates  bigint,
  mismatches  bigint,
  negatives   bigint,
  rootless    bigint
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
  candidate as (
    -- ⚠ The filter is deliberately WIDER than the rule in
    -- scripts/lib/totalsTie.mjs, so the rule stays the single authority:
    -- SQL narrows, JS judges. A one-dollar gap is rounding, not disagreement.
    select split_part(b.data_source, ' —', 1) as source,
           b.total_budget                     as total,
           coalesce(r.root_sum, 0)            as root_sum,
           coalesce(r.n_roots, 0)             as n_roots
    from treasury.budgets b
    left join roots r on r.budget_id = b.id
    where b.total_budget < 0
       or coalesce(r.n_roots, 0) = 0
       or abs(b.total_budget - coalesce(r.root_sum, 0)) > 1
  )
  select source,
         count(*)                                                        as candidates,
         count(*) filter (where n_roots > 0
                            and abs(total - root_sum) > 1)               as mismatches,
         count(*) filter (where total < 0)                               as negatives,
         count(*) filter (where n_roots = 0)                             as rootless
  from candidate
  group by source
  order by 2 desc;
$$;

comment on function treasury.totals_tie_status() is
  'Per-source counts of budgets whose total does not tie to the sum of their '
  'root categories, plus negative totals and rootless rows. Read-only; '
  'security definer so a scheduled job needs no elevated caller.';

-- ⛔⛔ CREATE FUNCTION GRANTS EXECUTE TO PUBLIC. Revoking is not optional, and
-- ALTER DEFAULT PRIVILEGES does not cover it here. `npm run verify:grants`
-- sweeps for exactly this.
revoke all on function treasury.totals_tie_status() from public, anon;
