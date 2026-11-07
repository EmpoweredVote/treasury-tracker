-- Stop using a BATCH number as a row id, and declare the index that made it fatal.
--
-- ⚠⚠⚠ WHAT WENT WRONG. `treasury_sync_transactions` inserts
--   ON CONFLICT (budget_id, source_row_id) WHERE source_row_id IS NOT NULL DO NOTHING
-- so `column_mapping.source_row_id_column` IS the definition of "same row".
-- Two sources named a column that is not a row id at all:
--
--   West Hollywood  "demand"          a demand-register BATCH number
--                                     24,123 published rows carry 22 of them
--   LA City         "transaction_id"  a document number
--                                     6,584,328 rows carry 1,508,282 of them
--
-- One row per batch survived. Measured 2026-11-05 against the publishers' own
-- sums, via their own APIs:
--
--   source                     TT published        publisher's own sum
--   West Hollywood, 9 years    169,689,667.89      1,365,917,958.43
--   LA City FY2024           7,910,824,815.18     11,282,681,551.97
--   LA City FY2025          11,729,532,951.76     13,223,890,843.35
--                                              ----------------------
--   understated by approximately $6.06 BILLION
--
-- West Hollywood's entire municipality held 143 transactions out of the
-- 134,643 that were loaded. FY2018 published $0. FY2023 published
-- $159,946,588.33 above ZERO transactions -- a March total left standing after
-- the rows beneath it were gone, so it merely looked correct.
--
-- ⚠⚠ IT HAPPENED IN FIFTEEN MINUTES AND NOTHING NOTICED. treasury.sync_logs:
--   2026-03-27 21:44  5 pages, 24,123 fetched, 24,123 INSERTED, 0 skipped
--   2026-03-27 21:59  4 pages, 20,000 fetched,     22 INSERTED, 24,101 skipped
-- Between those two runs the UNIQUE index below was created by hand. Every
-- cron run since has logged `success` with rows_inserted 0 / rows_skipped 5000.
--
-- ── ⭐⭐ THE KEY IS MEASURED, NOT CHOSEN ─────────────────────────────────
--
-- No published column is unique, and the collisions are LEGITIMATE rather than
-- export duplication:
--
--   LA    transaction_id|inv_line|inv_dist_line -> 741,984 of 749,295
--   WeHo  demand|check|invoice_number|vendor_code -> 12,794 of 16,342
--
-- LA transaction 134067 is four $4.50 lines numbered inv_line 1-4: genuine
-- detail, not one total repeated on every line (the Frisco #339 shape, which
-- was checked for explicitly before concluding this). A content hash would
-- collapse them -- the McKinney-Tahoes defect in scripts/lib/xlsxRows.mjs.
--
-- Socrata's own system field `:id` is exactly 1:1 -- 16,342 of 16,342 (WeHo
-- 7kgt-b5t8), 749,295 of 749,295 (LA FY2025) -- and belongs to the publisher
-- rather than being derived by TT.
--
-- ⚠ Stability was checked before relying on it: both datasets are APPENDED to,
-- not replaced wholesale. WeHo 5d72-njxw carries 18 distinct `:created_at`
-- values with its oldest rows still at 2025-11-03; LA carries 130, oldest
-- 2024-07-15. A wholesale replace would mint new `:id`s, so
-- `npm run verify:source-row-coverage` watches for exactly that.

-- ── 1. Declare the index that has existed, uncommitted, since 2026-03-27 ──
--
-- ⚠⚠ It is NOT in supabase/migrations/ and never was -- the same uncommitted
-- -dashboard-change pattern as `build_xlsx_budget_categories`. A migration
-- that only exists in production is a migration nobody can review, and this
-- one silently redefined what "the same row" means for every transaction
-- source in the fleet.
create unique index if not exists idx_transactions_source_dedup
  on treasury.transactions (budget_id, source_row_id)
  where source_row_id is not null;

-- ── 2. Point the nine affected sources at Socrata's real row id ──────────
update treasury.data_sources
   set column_mapping = column_mapping || '{"source_row_id_column":":id"}'::jsonb
 where dataset_type = 'transactions'
   and api_type = 'socrata'
   and column_mapping->>'source_row_id_column' in ('demand', 'transaction_id');

-- ── 3. West Hollywood FY2018-19 reads an amount column that does not exist ──
--
-- Dataset by9g-vc9g publishes `amt_paid`; the mapping named `amount_paid`, so
-- every row parsed to 0 and TT published $0 of spending for FY2018. The other
-- seven West Hollywood datasets really do use `amount_paid` -- this one is the
-- odd one out, which is exactly why it was never noticed.
update treasury.data_sources
   set column_mapping = column_mapping || '{"amount_column":"amt_paid"}'::jsonb
 where name = 'West Hollywood Demand Register FY2018-19';

-- ── 4. Refuse to leave the job half done ────────────────────────────────
do $$
declare n bigint;
begin
  select count(*) into n from treasury.data_sources
   where dataset_type = 'transactions' and api_type = 'socrata'
     and column_mapping->>'source_row_id_column' is not null
     and column_mapping->>'source_row_id_column' not like ':%';
  if n > 0 then
    raise exception 'Non-system source_row_id_column still set on % Socrata transaction source(s)', n;
  end if;

  select count(*) into n from treasury.data_sources
   where name = 'West Hollywood Demand Register FY2018-19'
     and column_mapping->>'amount_column' <> 'amt_paid';
  if n > 0 then
    raise exception 'West Hollywood FY2018-19 still reads a non-existent amount column';
  end if;
end $$;
