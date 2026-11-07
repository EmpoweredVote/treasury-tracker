-- Roll a transaction-backed budget up IN THE DATABASE instead of in Node.
--
-- ⚠⚠⚠ WHY. `rebuildTransactionTree.mjs` read every transaction of a budget a
-- page at a time to add them up — 48 round trips for McKinney, and it did not
-- finish: all four McKinney registers died with `canceling statement due to
-- statement timeout`. #351 made the vendors join opt-in, which got FY2022 and
-- FY2023 through and left FY2024 still failing. That command is the exact
-- remedy `verify:txn-trees` prints when a tree goes red, so the fleet's
-- largest trees could not be repaired at all.
--
-- ⚠⚠ AND LA CITY MAKES IT UNARGUABLE. FY2025 holds 749,295 transactions —
-- 750 pages. There is no version of page-by-page that builds that tree. LA is
-- $24.5B across two years with no breakdown at all today, so this is the
-- difference between a reader seeing it and not.
--
-- The grouping already existed in SQL: `transaction_tree_status()` does the
-- same `group by link_key` to compare a tree with its transactions. This is
-- that aggregate, exposed so the rebuild can use it. One query, any size.
--
-- ⚠ Returns groups keyed on the FULL link_key, not on whatever axis a source
-- finally shows. A source that rolls up further (LA keys its roots on the
-- DEPARTMENT, the first `|` segment) re-groups these few thousand rows in
-- Node. Keeping the derivation out of SQL means the naming rule and the
-- grouping rule stay in one reviewed place — scripts/lib/transactionTreeSources.mjs
-- — rather than being split across two languages.
--
-- ⚠⚠ THE NULL-KEY GROUP IS RETURNED, NOT FILTERED. An unkeyed row is the
-- defect this whole line of work exists to catch ($79.1M of McKinney spending
-- in a bucket nobody could trace). Dropping it here would hide it from the
-- refusal in `rollUpTransactions`. The caller re-reads those few rows to tell
-- a row the publisher published EMPTY from a row whose key the loader lost.
drop function if exists treasury.transaction_roots(uuid);

create or replace function treasury.transaction_roots(p_budget_id uuid)
returns table (
  link_key    text,
  amount      numeric,
  item_count  bigint,
  vendor_name text
)
language sql
stable
security definer
set search_path to 'treasury', 'public'
as $$
  select t.link_key,
         sum(t.amount)                           as amount,
         count(*)                                as item_count,
         -- ⚠ ONLY MEANINGFUL FOR A VENDOR-KEYED SOURCE, and only Frisco is one.
         -- Frisco's link_key is DERIVED FROM the vendor name
         -- (scripts/lib/vendorKey.mjs), so the relation is 1:1 and min() is
         -- simply that name. For McKinney or LA a key spans thousands of
         -- vendors and this column is arbitrary — their resolvers never read
         -- it, and `needsVendorNames` is what says so.
         min(v.name)                             as vendor_name
  from treasury.transactions t
  left join treasury.vendors v on v.id = t.vendor_id
  where t.budget_id = p_budget_id
  group by t.link_key;
$$;

-- ⚠⚠ CREATE FUNCTION grants EXECUTE to PUBLIC. A security-definer function
-- reachable by `anon` is the exposure `verify:grants` sweeps for — see the
-- definer_function_public_execute note.
revoke all on function treasury.transaction_roots(uuid) from public, anon;
