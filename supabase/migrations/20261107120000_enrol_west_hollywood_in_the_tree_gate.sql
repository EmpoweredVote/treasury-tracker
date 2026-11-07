-- West Hollywood joins the transaction-tree gate, and an EMPTY PUBLISHED ROW
-- becomes something the gate reports rather than something it fails on.
--
-- ⚠⚠⚠ WHY WEHO WAS MISSING. All eight West Hollywood demand-register years
-- carried correct headlines and ZERO budget_categories: clicking a $167M year
-- returned nothing. The drill-down data was there the whole time — the public
-- API answers `/transactions?link_key=Contracted Services` with $153,087,359.03
-- across 10,120 payments — but with no roots there was nothing for a reader to
-- click. This migration is the gate half of enrolling them; the naming rule is
-- in scripts/lib/transactionTreeSources.mjs and the tree is built by
-- scripts/rebuildTransactionTree.mjs.
--
-- ⚠ The previous `enrolled` CTE matched McKinney alone, so `verify:txn-trees`
-- watched 4 budgets out of the fleet's transaction-backed trees. WeHo makes 12.
-- Frisco still cannot join: its trees carry an "Other Vendors" tail bucket
-- whose link_key has no transactions beneath it by construction, so it would
-- report roots_without_txn > 0 on every year and the gate would cry wolf. That
-- is a real gap, deliberately left for the change that teaches the gate about
-- tail buckets.
--
-- ── ⚠⚠ THE EMPTY PUBLISHED ROW ──────────────────────────────────────────────
--
-- WeHo's FY2018-19 register contains exactly one row that the city published
-- with nothing in it. Fetched from Socrata, `row-kt5z-k7g9.mzuf` returns only
-- the system fields and `retainage: "0"` — no vendor, no amount, no date, no
-- category. TT stores it because the Milledgeville Rule says load what is
-- published, and because dropping it would leave verify:source-row-coverage
-- permanently red at 24,122 of 24,123.
--
-- It has no link_key, so the old `unkeyed` count would have gone to 1 and held
-- this gate red forever on a row carrying $0. But it must not simply be
-- filtered away either: a silent exclusion is how a genuinely lost row would
-- hide. So it is counted SEPARATELY, in its own column, and the JS gate prints
-- it as a notice.
--
-- ⚠ The predicate is deliberately strict and mirrors `isEmptyPublishedRow` in
-- scripts/lib/transactionTree.mjs. A $0 row with a real date or description
-- still counts as unkeyed and still fails: it has content the publisher
-- declined to classify, which is a different thing from having no content.
-- ⚠⚠ `vendor_id` is NOT part of the test, in either place. The loader writes
-- `vendor || "Unknown"`, so every row has a vendor whether the publisher gave
-- one or not — a column that is never empty cannot prove a row is.
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
    select b.id, b.data_source, b.fiscal_year
    from treasury.budgets b
    where b.data_source ~ '^McKinney Check Register FY[0-9]{4}$'
       or b.data_source ~ '^West Hollywood Demand Register FY[0-9]{4}-[0-9]{2}$'
  ),
  -- A row with no key and nothing in it: see the header.
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
         coalesce(a.amount_drift, 0), coalesce(u.n, 0), coalesce(kr.n, 0),
         coalesce(er.n, 0)
  from enrolled e
  left join agg a on a.bid = e.id
  left join unkeyed u on u.budget_id = e.id
  left join keyless_roots kr on kr.budget_id = e.id
  left join empty_rows er on er.budget_id = e.id
  order by 1;
$$;

-- ⚠⚠ The function is recreated, so its grants are too. See the
-- definer_function_public_execute note: CREATE FUNCTION grants EXECUTE to
-- PUBLIC, and that is what the anon role reaching a security-definer gate
-- would mean. Revoke it the same way every other gate in this schema does.
revoke all on function treasury.transaction_tree_status() from public, anon;
