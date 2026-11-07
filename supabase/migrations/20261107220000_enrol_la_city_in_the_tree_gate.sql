-- LA City joins the transaction-tree gate, and the gate learns that a root can
-- be COARSER than a link_key.
--
-- ⚠⚠⚠ WHY THIS IS NOT A ONE-LINE REGEX CHANGE. Every other enrolled source has
-- one root per distinct link_key, so the gate could join `transactions.link_key`
-- straight onto `budget_categories.link_key`. LA cannot: the loader writes
-- `DEPARTMENT|FUND|ACCOUNT` (2,846 distinct keys in FY2025) and the breakdown a
-- reader gets is the 56 DEPARTMENTS. Adding LA to the old join would have
-- reported 2,846 `keys_without_root` and 56 `roots_without_txn` on every run —
-- a gate permanently red on correct data, which is a gate people route around.
--
-- So `enrolled` now carries `key_segments`: how many leading `|` segments of a
-- transaction's link_key make up a ROOT key. 0 means "the whole key" (McKinney,
-- Frisco, West Hollywood); 1 means "the first segment" (LA).
--
-- ⚠ THIS DELIBERATELY RESTATES IN SQL WHAT `keyOf` DOES IN JAVASCRIPT
-- (scripts/lib/transactionTreeSources.mjs). The RPC `transaction_roots` stays
-- generic and groups on the full key — the derivation lives in one reviewed
-- place for BUILDING a tree. But a gate that re-used the builder's own
-- derivation could only ever agree with itself. Two independent statements of
-- the same rule is what makes a divergence visible, which is the entire point
-- of this gate. If you change one, change the other, and the first rebuild
-- after that will say so.
--
-- ⚠⚠ `split_part(key, '|', 1)` is the SAME slice the drill-down can match.
-- The API matches whole `|` segments — measured on FY2025:
--   link_key=GENERAL SERVICES                        -> 150,061 txns
--   link_key=GENERAL SERVICES|GENERAL FUND (GENERAL) -> 125,948 txns
--   link_key=RECREATION                              -> null
-- so a department root resolves to exactly that department's rows.
drop function if exists treasury.transaction_tree_status();

create or replace function treasury.transaction_tree_status()
returns table (
  source              text,
  fiscal_year         int,
  txn_keys            bigint,
  root_keys           bigint,
  keys_without_root   bigint,
  roots_without_txn   bigint,
  amount_drift        bigint,
  unkeyed_txns        bigint,
  roots_without_key   bigint,
  empty_published_rows bigint
)
language sql
security definer
set search_path to 'treasury', 'public'
as $$
  with enrolled as (
    select b.id, b.data_source, b.fiscal_year,
           -- How many leading '|' segments make a ROOT key. 0 = the whole key.
           case when b.data_source = 'LA City Checkbook' then 1 else 0 end as key_segments
    from treasury.budgets b
    where b.data_source ~ '^McKinney Check Register FY[0-9]{4}$'
       or b.data_source ~ '^West Hollywood Demand Register FY[0-9]{4}-[0-9]{2}$'
       or b.data_source = 'LA City Checkbook'
  ),
  -- A row with no key and nothing in it: the publisher published it empty.
  empty_rows as (
    select x.budget_id, count(*) as n
    from treasury.transactions x
    where x.budget_id in (select id from enrolled)
      and x.link_key is null
      and coalesce(x.amount, 0) = 0
      and x.description is null and x.payment_date is null
      and x.payment_method is null and x.payment_number is null
      and x.invoice_number is null and x.fund is null
      and x.expense_category is null and x.department is null and x.program is null
    group by 1
  ),
  -- ⚠⚠ NULL keys are counted SEPARATELY, never folded into the join. In a FULL
  -- OUTER JOIN the two sides are never both null, so a null key inside the join
  -- is indistinguishable from an absent row — and a null key is precisely the
  -- defect being gated. Counting it in the join would have hidden it.
  unkeyed as (
    select x.budget_id, count(*) as n
    from treasury.transactions x
    where x.budget_id in (select id from enrolled)
      and x.link_key is null
      and not (
        coalesce(x.amount, 0) = 0
        and x.description is null and x.payment_date is null
        and x.payment_method is null and x.payment_number is null
        and x.invoice_number is null and x.fund is null
        and x.expense_category is null and x.department is null and x.program is null
      )
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
    select x.budget_id,
           case when e.key_segments = 1 then split_part(x.link_key, '|', 1)
                else x.link_key end as link_key,
           sum(x.amount) as amt
    from treasury.transactions x
    join enrolled e on e.id = x.budget_id
    where x.link_key is not null
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
         coalesce(a.amount_drift, 0), coalesce(u.n, 0), coalesce(kr.n, 0),
         coalesce(er.n, 0)
  from enrolled e
  left join agg a on a.bid = e.id
  left join unkeyed u on u.budget_id = e.id
  left join keyless_roots kr on kr.budget_id = e.id
  left join empty_rows er on er.budget_id = e.id
  order by 1, 2;
$$;

revoke all on function treasury.transaction_tree_status() from public, anon;
