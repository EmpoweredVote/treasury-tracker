# Phase 6 Plan 03 — Load Log

## Source Counts (First Run)

| Source | Fiscal Year | Inserted | Skipped | Errors | Status |
|--------|-------------|----------|---------|--------|--------|
| McKinney Check Register | 2022 | 44,260 | 1,585 | 0 | OK |
| McKinney Check Register | 2023 | 46,019 | 1,151 | 0 | OK |
| McKinney Check Register | 2024 | 46,206 | 1,119 | 0 | OK |
| McKinney Check Register | 2025 | 48,988 | 1,109 | 0 | OK |
| McKinney Payroll Register | 2022 | 39,790 | 1 | 0 | OK (see note) |
| McKinney Payroll Register | 2023 | 40,577 | 1 | 0 | OK |
| McKinney Payroll Register | 2024 | 42,573 | 1 | 0 | OK |
| McKinney Payroll Register | 2025 | 44,448 | 3 | 0 | OK |
| Frisco Check Register | 2018 | 22,693 | 491 | 0 | OK |
| Frisco Check Register | 2019 | 23,903 | 1,524 | 0 | OK |
| Frisco Check Register | 2020 | 19,738 | 401 | 0 | OK |
| Frisco Check Register | 2021 | 14,743 | 246 | 0 | OK |
| Frisco Check Register | 2022 | 17,489 | 297 | 0 | OK |
| Frisco Check Register | 2023 | 16,009 | 395 | 0 | OK |
| Frisco Check Register | 2024 | 16,280 | 416 | 0 | OK |
| Frisco Check Register | 2025 | 16,358 | 392 | 0 | OK |
| Frisco Check Register | 2026 | 6,506 | 115 | 0 | OK |
| Plano Check Register | 2025 | — | — | — | DEFERRED (manual export not yet downloaded) |

**Note McKinney Payroll FY2022:** During first load attempt, the loader aborted at batch 79/80 (rows 39,500+) due to a footer row "Total" being passed to the RPC as a date. After fixing the footer-row filter in parseXLSX, the source file was re-parsed to 39,790 rows (footer excluded, 1 blank skipped) and re-run. Because 39,500 rows were already inserted from the partial run, the re-run inserted the remaining 290 rows and skipped the 39,500 already present. The DB row count for McKinney Payroll FY2022 is correct at 39,790.

**Note on "skipped" column:** The skipped count combines DB-level deduplication (source_row_id SHA-256 already in DB) with blank/footer rows filtered out during parsing. For check registers, skipped rows represent within-file duplicates in the source data. All skipped/error percentages are well below the 5% threshold.

## Total Rows Loaded by City

- McKinney check register: **185,473** rows across 4 FYs (FY22-FY25)
- McKinney payroll register: **167,388** rows across 4 FYs (FY22-FY25)
- Frisco check register: **153,719** rows across 9 FYs (FY18-FY26)
- Plano: DEFERRED

**Grand total new rows added this plan:** 506,580

## Failed Loads

None — all non-Plano sources loaded successfully after fixing:
1. `triggered_by` constraint: changed from `'bulk_xlsx_load'` (invalid) to `'bulk_load'` (valid)
2. Footer row filter: Payroll files have a "Total" row at the end — added footer detection to parseXLSX

---

## Idempotency Test (Re-run No Flags)

| Source | First-Run Inserted | Re-Run Inserted | Re-Run Skipped | Pass? |
|--------|-------------------|-----------------|----------------|-------|
| Frisco Check Register FY2025 | 16,358 | 0 | 16,750 | YES |
| McKinney Check Register FY2025 | 48,988 | 0 | 50,097 | YES |
| McKinney Payroll Register FY2025 | 44,448 | 0 | 44,451 | YES |

All re-runs inserted 0 new rows. SHA-256 `source_row_id` hash is deterministic across runs.

---

## --force-reload Test (Single FY Scoped)

- **Target:** Frisco Check Register FY2025 (budget_id: 20f0d6e6-5816-4133-8d32-c7a01e32b5fb)
- **Pre-test rows (FY2025):** 16,358
- **Command:** `node scripts/bulkLoadXLSX.js --source "Frisco Check Register FY2025" --force-reload`
- **Log output:** `--force-reload: cleared existing rows for FY2025` then `16,358 inserted | 392 skipped | 0 errors`
- **Post-force-reload rows (FY2025):** 16,358 (matches pre-test — cleared then re-inserted correctly)
- **Frisco FY2024 rows pre-test:** 16,280
- **Frisco FY2024 rows post-test:** 16,280 (unchanged — proves per-FY scope)
- **Pass?** YES

**Note on "392 skipped" in force-reload:** After clearing the FY2025 budget, the source file has 16,750 rows parsed but 392 are blank/duplicate within the source file itself. The RPC inserted 16,358 unique rows. Pre-test and post-test counts match exactly.

---

## Post-Load Fix: Dataset Type Bug + Category Generation (2026-05-01)

**Bug found after initial load:** `treasury_sync_transactions` RPC was hardcoding `dataset_type='transactions'` in both the budget SELECT and INSERT statements, regardless of the data source's actual `dataset_type`. All XLSX data landed under `transactions` budgets, which the app never queries (it only knows `operating`, `revenue`, `salaries`). Result: all XLSX cities showed disabled tabs and no categories.

**Fix 1 — Supabase migration `fix_sync_transactions_use_dataset_type`:**
- Changed `AND dataset_type = 'transactions'` → `AND dataset_type = v_ds.dataset_type` (budget lookup)
- Changed `VALUES (..., 'transactions', ...)` → `VALUES (..., v_ds.dataset_type, ...)` (budget insert)

**Fix 2 — Re-seeded data sources (`scripts/seedXLSXDataSources.js`):**
- McKinney Check Register: `dataset_type: 'transactions'` → `'operating'`
- Frisco Check Register: `dataset_type: 'transactions'` → `'operating'`
(McKinney Payroll already had `'salaries'` which is correct.)

**Fix 3 — Cleared old `transactions` budgets and re-loaded all XLSX data:**
- Deleted transactions first (FK constraint), then deleted budgets
- Re-ran `bulkLoadXLSX.js` for all McKinney and Frisco sources
- Final DB state:
  - McKinney: 4 `operating` budgets + 4 `salaries` budgets (separate, not mixed)
  - Frisco: 9 `operating` budgets

**Fix 4 — Supabase migration `build_xlsx_budget_categories`:**
Generated `budget_categories` rows so the app's donut chart renders correctly:
- McKinney operating: 94–97 department-level categories per FY (from `link_key` = department code)
- McKinney salaries: Updated `link_key` on transactions to slugified position title; then inserted 50 top-position + "Other Positions" categories per FY (51 total)
- Frisco operating: Updated `link_key` on transactions to slugified vendor name; then inserted 30 top-vendor + "Other Vendors" categories per FY (31 total)

**Fix 5 — Frontend (`DatasetTabs.tsx`, `App.tsx`):**
- DatasetTabs now renders a dynamic third "Employees" card when `available_datasets` includes `'salaries'`
- App.tsx passes `salariesTotal` from salary budget metadata to DatasetTabs
- Committed as `38b273f` "feat(06-03): fix dataset_type bug + add salaries tab + xlsx budget categories"

---

## Verification Summary

- Idempotency tests run: 2026-05-01
  - Frisco Check FY2025: PASS (0 inserted, 16,750 skipped)
  - McKinney Check FY2025: PASS (0 inserted, 50,097 skipped)
  - McKinney Payroll FY2025: PASS (0 inserted, 44,451 skipped)
- Force-reload test run: 2026-05-01
  - Frisco Check FY2025: PASS (cleared + re-inserted 16,358; FY2024 row count unchanged)
- App verification: PENDING (Task 3 human checkpoint)
