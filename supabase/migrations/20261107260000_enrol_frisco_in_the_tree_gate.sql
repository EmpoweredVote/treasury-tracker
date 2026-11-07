-- Frisco joins the transaction-tree gate, and the gate learns about TAIL BUCKETS.
--
-- ⚠⚠⚠ WHY FRISCO WAS THE LAST ONE OUT. Its trees are correct and have been
-- reachable since #352 — they simply could not be GATED, because a vendor-keyed
-- source does not have one root per key. Frisco keeps the 30 largest vendors
-- and gathers every other payee into one bucket, `other-vendors`, which is an
-- aggregate TT computes rather than a key any transaction carries. Against the
-- old join that produced, on every year, on correct data:
--
--     roots_without_txn  1       the bucket matches no transaction key
--     keys_without_root  ~2,400  every un-named vendor has no root of its own
--
-- A gate that cries wolf about correct data is a gate people route around, so
-- Frisco was left unwatched — nine years and $4.7B outside the only check that
-- can see a tree drifting from the transactions beneath it.
--
-- ── THE FIX: FOLD UNNAMED KEYS INTO THE TAIL, THE SAME WAY THE BUILDER DOES ──
--
-- `enrolled` now carries `tail_key`. A transaction key that matches no NAMED
-- root is attributed to that bucket before the join, exactly as
-- `rollUpTransactions` does when it builds the tree. Sources with no tail
-- bucket carry NULL and are completely unaffected — the CASE collapses to the
-- old expression.
--
-- ⭐⭐ THIS IS A STRONGER CHECK THAN IT LOOKS, and it is the reason to do it
-- rather than just exclude the bucket. `amount_drift` now compares the stored
-- `other-vendors` amount against the SUM OF EVERY UN-NAMED VENDOR'S
-- TRANSACTIONS. Measured across all nine years before applying: 31 keys, 31
-- roots, 0 keys_without_root, 0 roots_without_txn, **0 amount_drift**. So the
-- one figure on a Frisco page that TT computed rather than read is now checked
-- to the cent, every run.
--
-- ⚠ `named` deliberately EXCLUDES the tail root itself. Including it would let
-- a transaction keyed `other-vendors` match it directly and escape the fold —
-- and `rollUpTransactions` already refuses that collision when building, so the
-- gate must not quietly accept it.
--
-- 29 budgets are now gated: McKinney 4, West Hollywood 8, LA City 2, Plano 6,
-- Frisco 9. That is every transaction-backed budget that has a breakdown.
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
           case when b.data_source = 'LA City Checkbook'
                  or b.data_source ~ '^Plano Check Register FY[0-9]{4}$'
                then 1 else 0 end as key_segments,
           -- The bucket un-named keys are gathered into, or NULL for a source
           -- with one root per key. Mirrors `tailKey` in transactionTreeSources.mjs.
           case when b.data_source ~ '^Frisco Check Register FY[0-9]{4}$'
                then 'other-vendors' end as tail_key
    from treasury.budgets b
    where b.data_source ~ '^McKinney Check Register FY[0-9]{4}$'
       or b.data_source ~ '^West Hollywood Demand Register FY[0-9]{4}-[0-9]{2}$'
       or b.data_source ~ '^Plano Check Register FY[0-9]{4}$'
       or b.data_source ~ '^Frisco Check Register FY[0-9]{4}$'
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
  -- defect being gated.
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
  keyless_roots as (
    select k.budget_id, count(*) as n
    from treasury.budget_categories k
    where k.parent_id is null and k.budget_id in (select id from enrolled)
      and k.link_key is null
    group by 1
  ),
  -- The NAMED roots — every root except a tail bucket. What a transaction key
  -- must match to avoid being folded into the tail.
  named as (
    select k.budget_id, k.link_key
    from treasury.budget_categories k
    join enrolled e on e.id = k.budget_id
    where k.parent_id is null and k.link_key is not null
      and (e.tail_key is null or k.link_key <> e.tail_key)
  ),
  -- ⚠⚠⚠ GROUP FIRST, FOLD SECOND — THE ORDER IS WORTH 35 SECONDS.
  --
  -- The obvious shape joins each TRANSACTION to `named` and folds as it goes.
  -- Measured, it was a disaster: the planner cannot index a join on a CASE
  -- expression, so it merge-joined on budget_id alone and filtered —
  -- **116,221,521 rows removed by the join filter**, a 199 MB external merge
  -- sort, and 38.2s for this CTE against 9.8s for the un-folded shape.
  --
  -- Grouping first collapses 2.5M transactions to ~30,000 (budget, key) pairs;
  -- the fold then joins THOSE against `named`. Same answer, 1,150,160 rows
  -- removed instead of 116M, and **3.2s** — faster than the shape it replaces,
  -- because the index-only scan survives.
  --
  -- ⚠ This matters beyond tidiness. The gate runs on pg_cron, where
  -- statement_timeout is 120s, and LA City appends every week. A gate that
  -- times out does not report a failure; it reports nothing.
  --
  -- ⚠⚠ THE WHOLE FUNCTION IS STILL ~32s, AND THAT IS NOT THIS CTE. Measured
  -- after the fix: `t` is 3.2s, the two null-key scans are 0.7s together, and
  -- `named`/`c`/`j` are trivial — so roughly 28s is elsewhere and PREDATES
  -- Frisco. It has not been chased down. 32s of a 120s budget on a table that
  -- grows weekly is the next thing to look at here, and the measurement above
  -- is the method: EXPLAIN ANALYZE each CTE rather than guess which is slow.
  t0 as (
    select x.budget_id, x.link_key as raw, sum(x.amount) as amt
    from treasury.transactions x
    where x.budget_id in (select id from enrolled) and x.link_key is not null
    group by 1, 2
  ),
  t as (
    select t0.budget_id,
           case when e.tail_key is not null and n.link_key is null then e.tail_key
                else dk.k end as link_key,
           sum(t0.amt) as amt
    from t0
    join enrolled e on e.id = t0.budget_id
    cross join lateral (
      select case when e.key_segments = 1 then split_part(t0.raw, '|', 1)
                  else t0.raw end as k
    ) dk
    left join named n on n.budget_id = t0.budget_id and n.link_key = dk.k
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
