-- A transaction-backed tree must agree with the transactions beneath it.
--
-- ⚠⚠⚠ WHY. treasury_sync_transactions writes transactions and recomputes
-- budgets.total_budget; it does NOT touch budget_categories. Those trees were
-- built once by an uncommitted migration (`build_xlsx_budget_categories`), so a
-- --force-reload deletes and rewrites every row underneath a tree that nothing
-- re-derives, and nothing notices when the two drift apart.
--
-- It had already happened. McKinney's $79.1M FY2024 root was keyed `unknown`
-- while the transactions beneath it carried a NULL key, and the live
-- drill-down returned `null` — a nine-figure category a reader could click and
-- get nothing from. No existing gate could see it: the roots summed to the
-- headline, every label was distinct, and no figure had moved.
--
-- Scoped to ENROLLED sources (scripts/lib/transactionTreeSources.mjs). Other
-- transaction sources key their roots on vendor names rather than link_key —
-- Frisco alone would report ~2,400 "missing" keys a year that are not defects.
-- A gate that cries wolf about correct data is a gate people route around.
-- SQL narrows, JS judges: the same split as totals_tie_status().
drop function if exists treasury.transaction_tree_status();

create or replace function treasury.transaction_tree_status()
returns table (
  source            text,
  fiscal_year       int,
  txn_keys          bigint,
  root_keys         bigint,
  keys_without_root bigint,
  roots_without_txn bigint,
  amount_drift      bigint,
  unkeyed_txns      bigint,
  roots_without_key bigint
)
language sql
security definer
set search_path to 'treasury', 'public'
as $$
  with enrolled as (
    select b.id, b.data_source, b.fiscal_year
    from treasury.budgets b
    where b.data_source ~ '^McKinney Check Register FY[0-9]{4}$'
  ),
  -- ⚠⚠ NULL keys are counted SEPARATELY, never folded into the join. In a FULL
  -- OUTER JOIN the two sides are never both null, so a null key inside the join
  -- is indistinguishable from an absent row — and a null key is precisely the
  -- defect being gated. Counting it in the join would have hidden it.
  unkeyed as (
    select x.budget_id, count(*) as n
    from treasury.transactions x
    where x.budget_id in (select id from enrolled) and x.link_key is null
    group by 1
  ),
  -- ⚠ Same for a ROOT with no key: for an enrolled source every root IS a
  -- link_key, and one without is a category nothing can drill into.
  keyless_roots as (
    select k.budget_id, count(*) as n
    from treasury.budget_categories k
    where k.parent_id is null and k.budget_id in (select id from enrolled)
      and k.link_key is null
    group by 1
  ),
  t as (
    select x.budget_id, x.link_key, sum(x.amount) as amt
    from treasury.transactions x
    where x.budget_id in (select id from enrolled) and x.link_key is not null
    group by 1, 2
  ),
  c as (
    select k.budget_id, k.link_key, k.amount
    from treasury.budget_categories k
    where k.parent_id is null and k.budget_id in (select id from enrolled)
      and k.link_key is not null
  ),
  j as (
    select coalesce(t.budget_id, c.budget_id) as bid,
           t.link_key as tk, c.link_key as ck, t.amt, c.amount
    from t full outer join c
      on c.budget_id = t.budget_id and c.link_key = t.link_key
  ),
  agg as (
    select j.bid,
           count(*) filter (where j.tk is not null)                      as txn_keys,
           count(*) filter (where j.ck is not null)                      as root_keys,
           count(*) filter (where j.tk is not null and j.ck is null)     as keys_without_root,
           count(*) filter (where j.ck is not null and j.tk is null)     as roots_without_txn,
           count(*) filter (where j.tk is not null and j.ck is not null
                              and round(j.amt, 2) <> round(j.amount, 2)) as amount_drift
    from j group by 1
  )
  select e.data_source, e.fiscal_year,
         coalesce(a.txn_keys, 0), coalesce(a.root_keys, 0),
         coalesce(a.keys_without_root, 0), coalesce(a.roots_without_txn, 0),
         coalesce(a.amount_drift, 0), coalesce(u.n, 0), coalesce(kr.n, 0)
  from enrolled e
  left join agg a on a.bid = e.id
  left join unkeyed u on u.budget_id = e.id
  left join keyless_roots kr on kr.budget_id = e.id
  order by 1;
$$;

revoke all on function treasury.transaction_tree_status() from public, anon;
