-- Disable the `Los Angeles Operating Budget` cron sync (uyzw-yi8n).
--
-- This source re-creates rows that v2.28 (LA-02, PRs #39/#40) deliberately
-- withdrew. On 2026-08-29 at 03:07 UTC the nightly orchestrator cron (cron.job
-- 5, `7 3 * * *`) re-inserted LA operating FY2025 + FY2026:
--
--   804fd360-8d0e-4ed2-ad17-3d4c67ad9e0f  FY2025  $19,340,363,947.28
--   9d9205b9-f920-43c7-9452-a5b958df6e35  FY2026  $20,853,668,993.02
--
-- ── Why those two years, and why it recurs ──
-- The orchestrator syncs `(ds.fiscal_years || [thisYear]).slice(-2)` — the last
-- two declared years. This source declares FY2017-FY2026, so every run targets
-- exactly FY2025 + FY2026, and it will target a new pair each time the array
-- rolls forward. Left enabled it re-creates withdrawn years indefinitely, and
-- always inside somebody else's milestone: this pair was found by Knight session
-- 3's pre-load `verify:frozen`, not by anything watching LA.
--
-- ── Why the data itself should not come back ──
-- uyzw-yi8n is LA's FMS appropriation ledger, not a Money Out figure. FY2026
-- counted $4.77B of Tax Revenue Anticipation Note activity alongside itself —
-- and TRAN proceeds ($1.60B) are borrowing, i.e. money IN, 16.5% of its $28.92B.
-- LA's Money In/Out series is FY2003-2024 `all_funds/actual` from the CA State
-- Controller; the FMS ledger is deliberately absent from the product (LA-02
-- closeout, "Still open" §3). Backups exist at
-- .planning/backups/la-city/la02-withdrawn-rows-fy2021-2026.json.gz if it is
-- ever wanted under an honest label.
--
-- ── Why `is_enabled = false` is a real stop, not a hint ──
-- Verified against the live functions, both layers:
--   * treasury_list_sources() filters `WHERE ds.is_enabled = true`, so the
--     source is never enumerated — including by the weekly `force: true` cron
--     (cron.job 6). `force` bypasses the due-date check, not the listing.
--   * treasury_get_data_source_config() also requires `is_enabled = true`, so
--     even an explicit `data_source_id` call returns no config and logs a
--     failure trace rather than syncing.
--
-- ── Blast radius ──
-- This source has produced exactly 2 rows in treasury.budgets — the pair above.
-- Nothing else reads it. verifySyncHealth.mjs lists via treasury_list_sources,
-- so enabled socrata sources go 22 -> 21 and this one drops out of the report,
-- the same way the 5 sources already disabled did.
--
-- ⚠ SCOPE: this stops the re-creation only. The two rows ALREADY in
-- treasury.budgets are left in place on purpose — deleting them is a separate
-- decision. They are `fund_scope: unknown` / `basis: adopted`, so the
-- non-comparable-scope rules keep them out of the rendered FY2003-2024 SCO
-- series, and they are registered in
-- scripts/data/laOperatingCronDriftCreatedIds.json, so the frozen invariant
-- already excludes them. Nothing is drawn wrong today.
--
-- Precedent for the lever and the note-in-last_error style: migration
-- 20260827000200 (Bloomington Public Contracts, LA City Vendor List).

UPDATE treasury.data_sources
   SET is_enabled     = false,
       sync_frequency = 'manual',
       sync_status    = 'idle',
       last_error     = 'Disabled 2026-08-29: FMS appropriation ledger, not a Money Out '
                        'feed (FY2026 included $4.77B of TRAN activity; proceeds are '
                        'borrowing). Its cron re-created the FY2025/FY2026 rows v2.28 '
                        'withdrew. LA Money Out is CA State Controller FY2003-2024. '
                        'See migration 20260829000000.'
 WHERE name = 'Los Angeles Operating Budget';
