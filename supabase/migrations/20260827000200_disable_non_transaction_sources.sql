-- Disable two sources that are typed 'transactions' but are not transaction feeds.
--
-- Both surfaced in the first run of scripts/verifySyncHealth.mjs (PR #86) — one as
-- 152 days stale on a 'monthly' schedule, the other as never synced at all — and
-- both had sat enabled and scheduled while being structurally impossible to sync.
--
-- ── Bloomington Public Contracts (ruzy-efni, 5,518 rows) ──
-- A CONTRACT REGISTER: year_and_id, title_of_contract, brief_description,
-- contractor_recipient, url_to_contract_link. No amount. No date. No fiscal year.
-- Its own column_mapping note says so: "Contract-level data, not individual payment
-- transactions. No dollar amounts in this dataset."
--
-- ── LA City Vendor List (5662-zu2k, 51,851 rows) ──
-- A VENDOR LOOKUP: vendor_name, vendor_id, zip, supplier_city, supplier_country,
-- flagged `is_reference_dataset: true`. Nothing in the pipeline consumes reference
-- datasets. Never synced; rows_synced is 0.
--
-- ── Why disable rather than repair ──
--
-- Neither has an amount column, so loading either into treasury.transactions — a
-- table whose entire meaning is "a payment of this many dollars" — would mint
-- thousands of $0 spending-shaped rows. That is the Dallas-$0 defect class:
-- structurally wrong figures that look like data. Making them "work" would be worse
-- than leaving them broken.
--
-- Both also 400 on the fiscal-year filter the sync builds (`$where fiscal_year=…`),
-- since neither dataset has that column and neither mapping sets skip_fy_filter.
-- Verified directly against both APIs on 2026-08-27.
--
-- Left enabled, they would now be attempted every week — PR #85 made them reachable
-- for the first time — and would log an error every time under PR #86. Disabling is
-- the honest state: not "failing", but "not a thing this pipeline can load".
-- Precedent: LA City Revenue and Los Angeles Revenue Budget are already disabled.
--
-- ⚠ NOT a judgement that the data is worthless. Both are good candidates for real
-- features later — a contracts register view, and vendor-name enrichment for the LA
-- City Checkbook. Re-enabling requires a loader that fits the shape, not a flag flip.

UPDATE treasury.data_sources
   SET is_enabled     = false,
       sync_frequency = 'manual',
       sync_status    = 'idle',
       last_error     = 'Disabled 2026-08-27: contract register, not a payment feed — '
                        'no amount or date column, and the fiscal-year filter 400s. '
                        'See migration 20260827000200.'
 WHERE name = 'Bloomington Public Contracts';

UPDATE treasury.data_sources
   SET is_enabled     = false,
       sync_frequency = 'manual',
       sync_status    = 'idle',
       last_error     = 'Disabled 2026-08-27: vendor reference lookup '
                        '(is_reference_dataset), not a transactions feed. No sync path '
                        'consumes reference datasets. See migration 20260827000200.'
 WHERE name = 'LA City Vendor List';
