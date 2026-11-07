-- Bloomington's 106,578 "Public Contracts" transactions are not public
-- contracts, and must not become selectable.
--
-- ── ⚠⚠⚠ WHAT THE DATA ACTUALLY IS ───────────────────────────────────────────
--
-- It is Bloomington's accounts-payable CHECKBOOK: real vendors (Milestone
-- Contractors LP, Bloomington Public Transportation Corporation), invoice
-- numbers, EFT/Check methods, TIF funds, and department names (HAND, Utilities
-- USB). $653,149,332.19 over FY2015-FY2025. Genuine and valuable.
--
-- It is filed under `Bloomington Public Contracts`, whose data_sources row
-- points at Socrata `ruzy-efni` — a CONTRACTS list of 5,654 rows with NO dollar
-- amounts, no departments and no funds. That dataset cannot have produced these
-- rows, and `data.bloomington.in.gov` publishes no expenditure dataset at all.
--
-- ⭐⭐ ROOT CAUSE, and it was deliberate. scripts/loadBloomingtonCheckbook.js:
--
--     // Use the contracts source as fallback (same municipality)
--     const contracts = sources?.find(s => s.name.includes('Bloomington')
--                                       && s.dataset_type === 'transactions');
--
-- It looks for a source whose name contains "Checkbook", and when it finds none
-- it attributes the rows to whatever other Bloomington transactions source
-- exists. No Checkbook source was ever created, so every row landed on the
-- contracts row. The script also reads a CSV from
-- `.claude/worktrees/agent-a30f27a2/data/payroll-all.csv` — a worktree that no
-- longer exists, named for payroll — and carries its own private CSV splitter
-- with the same inch-mark defect fixed in scripts/lib/xlsxRows.mjs.
--
-- ── ⚠⚠ AND 20% OF THE HEADLINE IS NOT SPENDING ──────────────────────────────
--
-- The rows carry Indiana Gateway chart-of-accounts categories, including
-- REVENUE and BALANCE-SHEET ones:
--
--   FY2024  $81,688,079.37 = $64,584,837.69 disbursements
--                          + $16,735,817.37 Current/Non-Current Assets and
--                            Current/Long Term Liabilities
--                          + $158,970.50 revenue-like
--   FY2025  $77,642,198.06 on the same shape
--
-- ── WHY RENAME RATHER THAN DELETE ───────────────────────────────────────────
--
-- Deleting would lose 106,578 rows that are real and re-usable once the source
-- is identified and the account types separated. The frontend matches dataset
-- types against a static ALLOW-LIST (src/utils/resolveDataset.ts), so an
-- unrecognised type is never offered and nothing breaks — exactly the mechanism
-- used for the VA APA revenue rows in 20260817000200.
--
-- ⚠ Safe because `Bloomington Public Contracts` is `is_enabled = false`: no
-- sync can recreate a `transactions` budget behind this rename. (Contrast
-- Plano, which is live and therefore was re-keyed rather than relabelled.)
--
-- ⚠⚠ RE-LOADING IS BLOCKED, NOT DONE. The Open Finance portal that produced
-- the CSV is not reachable at bloomington.finance.socrata.com,
-- bloomington.openfinance.socrata.com, openfinance.bloomington.in.gov or
-- finance.bloomington.in.gov, and the manual download is gone. Finding the live
-- feed is the next step; this migration only stops the figure reaching readers
-- in the meantime.
--
-- Reverse with:
--   update treasury.budgets set dataset_type = 'transactions'
--    where dataset_type = 'transactions_misattributed_source';
update treasury.budgets b
   set dataset_type = 'transactions_misattributed_source'
  from treasury.municipalities m
 where m.id = b.municipality_id
   and m.name = 'Bloomington' and m.state = 'IN'
   and b.dataset_type = 'transactions'
   and b.data_source = 'Bloomington Public Contracts';

do $$
declare n_left int; n_moved int;
begin
  select count(*) into n_moved from treasury.budgets
   where dataset_type = 'transactions_misattributed_source';
  select count(*) into n_left from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
   where m.name = 'Bloomington' and m.state = 'IN' and b.dataset_type = 'transactions';
  if n_moved <> 11 or n_left <> 0 then
    raise exception 'expected 11 Bloomington budgets relabelled and 0 left, got % and %', n_moved, n_left;
  end if;
end $$;
