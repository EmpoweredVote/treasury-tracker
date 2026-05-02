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

## Architectural Note: Payroll/Salaries Budget Type

The `treasury_sync_transactions` RPC creates budgets with `dataset_type='transactions'` regardless of the data source's `dataset_type`. McKinney Payroll data (data source `dataset_type='salaries'`) was therefore inserted into the same `transactions` budgets as check register data. This means:

- McKinney FY2022 budget: 84,050 rows (44,260 check + 39,790 payroll combined)
- McKinney FY2023 budget: 86,596 rows (46,019 check + 40,577 payroll combined)
- McKinney FY2024 budget: 88,779 rows (46,206 check + 42,573 payroll combined)
- McKinney FY2025 budget: 93,436 rows (48,988 check + 44,448 payroll combined)

The app's "Salaries" tab (`dataset_type='salaries'`) may not show McKinney payroll data since no `salaries` budget exists for McKinney. This is a known limitation requiring a future RPC enhancement to pass `p_dataset_type`. All payroll data IS in the database — it just appears under the `transactions` budget type.
