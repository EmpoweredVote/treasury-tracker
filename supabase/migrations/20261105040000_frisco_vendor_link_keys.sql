-- Restore the vendor link keys every Frisco reload silently erased.
--
-- ⚠⚠⚠ WHAT WENT WRONG, AND IT IS THE UNFINISHED HALF OF #336 AND #339.
--
-- `treasury_sync_transactions` writes transactions and recomputes
-- `budgets.total_budget`. It does NOT touch `budget_categories`. The trees
-- over those transactions were built once by an uncommitted migration, and
-- that migration keyed Frisco's roots on the VENDOR NAME.
--
-- The loader never reproduced that key. buildBatch computed
-- linkKey([department, fund, expense_category]) -- three columns Frisco's
-- column_mapping does not have -- so every Frisco reload wrote link_key NULL
-- on every row. The tree above then had nothing to be rebuilt FROM, and
-- rebuildTransactionTree.mjs refuses an unkeyed roll-up by design.
--
-- So when #336 removed the publisher TOTAL row and #339 collapsed the
-- repeated allocation rows, the HEADLINES were corrected and the TREES were
-- left holding the old figures:
--
--     FY      headline        tree root sum     ratio   phantom "Unknown"
--     2018   379,429,772.10   2,163,355,443.22  5.70x   1,081,755,767.17
--     2019   365,021,764.02   1,985,695,981.21  5.44x   1,001,344,551.22
--     2022   439,872,909.11     879,807,220.41  2.00x     439,934,311.30
--
-- ⚠⚠ THAT PHANTOM ROOT IS THE TOTAL ROW ITSELF -- a single item, $2.52
-- BILLION across the three years, still clickable in the live drill-down
-- after the headline above it had been repaired. FY2026 is worse in a
-- different way: it has NO tree at all, 0 roots under a $937,588,136.05
-- headline.
--
-- ── ⭐⭐ THE KEY RULE IS MEASURED, NOT CHOSEN ─────────────────────────────
--
-- Candidate rules were run against the five Frisco years no reload touched,
-- and this is the one that reproduced the stored keys EXACTLY:
--
--     FY2020 2,210 · FY2021 1,685 · FY2023 2,246 · FY2024 2,337 · FY2025 2,414
--     = 10,892 distinct keys, 10,892 matches, 0 differences.
--
-- ⚠ Both details matter and both came out of that measurement:
--   * the NAME is whitespace-trimmed FIRST  ("A TO T LAMPS INC    " ->
--     a-to-t-lamps-inc, " CORD B SMITH" -> cord-b-smith)
--   * the KEY is NOT dash-trimmed ("A&M MAINTENANCE SERVICES, INC." ->
--     a-m-maintenance-services-inc-, WITH the trailing dash)
--
-- Trimming that dash looks tidier and would re-key 50 vendors in FY2020
-- alone, which would stop a no-change rebuild being a no-op -- the property
-- that makes drift detectable at all.
--
-- ⚠ Mirrored in JS by scripts/lib/vendorKey.mjs, which the loader now uses so
-- the next reload writes the key instead of erasing it.
--
-- ⚠ ONLY NULL KEYS ARE WRITTEN. The five intact years are not touched, so
-- this cannot rewrite a key that is already correct.

update treasury.transactions t
   set link_key = regexp_replace(lower(trim(v.name)), '[^a-z0-9]+', '-', 'g')
  from treasury.vendors v, treasury.budgets b
 where v.id = t.vendor_id
   and b.id = t.budget_id
   and b.data_source like 'Frisco Check Register FY%'
   and t.link_key is null
   and trim(coalesce(v.name, '')) <> '';

-- ⚠⚠ Refuse to leave the job half done. Any Frisco transaction still unkeyed
-- would be refused by the roll-up later, in a place much further from the
-- cause than here.
do $$
declare n bigint;
begin
  select count(*) into n
    from treasury.transactions t
    join treasury.budgets b on b.id = t.budget_id
   where b.data_source like 'Frisco Check Register FY%'
     and t.link_key is null;
  if n > 0 then
    raise exception 'Frisco still has % transaction(s) with no link_key after the backfill', n;
  end if;
end $$;
