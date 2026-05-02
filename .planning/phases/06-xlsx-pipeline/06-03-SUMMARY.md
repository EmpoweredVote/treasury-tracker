---
phase: 06-xlsx-pipeline
plan: 03
type: execute
status: complete
completed: 2026-05-01
subsystem: loaders
phase_complete: true
---

# 06-03 Summary — Live Load & App Verification

## What Was Done

Executed the live load of all seeded XLSX data sources, verified data in the app, and fixed two post-load issues discovered during verification.

## Tasks Completed

**Task 1 — Live load all XLSX sources:**
- McKinney Check Register FY2022–FY2025: 185,473 rows loaded
- McKinney Payroll Register FY2022–FY2025: 167,388 rows loaded
- Frisco Check Register FY2018–FY2026: 153,719 rows loaded
- Plano: deferred (manual export not yet downloaded — documented in LOAD-LOG)
- Total new rows: 506,580

**Task 2 — Idempotency & force-reload:**
- Re-run of any source produces 0 inserted (SHA-256 source_row_id deduplication confirmed)
- `--force-reload` clears and re-inserts only the targeted fiscal year; other FYs untouched

**Task 3 — App verification (human checkpoint) + post-load fixes:**

Two bugs found and fixed during verification:

1. **`treasury_sync_transactions` dataset_type hardcode** — RPC was writing `dataset_type='transactions'` regardless of data source setting. Fixed via Supabase migration `fix_sync_transactions_use_dataset_type`. Re-loaded all XLSX data to create correct `operating` and `salaries` budgets.

2. **NULL percentages in budget_categories** — Migration `build_xlsx_budget_categories` created categories but didn't populate the `percentage` column. Fixed via migration `fix_xlsx_budget_category_percentages`: `percentage = ROUND((amount / budget.total_budget * 100)::numeric, 4)`.

3. **Department codes as category names** — McKinney's check register only publishes numeric GL codes (e.g., `7777`). Mapped top ~90 codes to human-readable names via migration `rename_mckinney_dept_categories` (derived from top-vendor analysis). Key mappings: Airport & Capital Projects (7777), Water Utilities (8205), Wastewater (8305), Debt Service – GO Bonds (2141), Solid Waste (4405), etc.

4. **Frontend — Salaries tab missing** — `DatasetTabs` didn't render a third card for `salaries` dataset type. Added dynamic `SALARIES_CARD` ("Employees") that appears when `available_datasets` includes `'salaries'`. `App.tsx` updated to pass `salariesTotal`.

## Final DB State

| City | Dataset Type | FY Range | Budgets | Categories |
|------|-------------|----------|---------|------------|
| McKinney | operating | 2022–2025 | 4 | 94–97 dept categories each |
| McKinney | salaries | 2022–2025 | 4 | 51 position-title categories each |
| Frisco | operating | 2018–2026 | 9 | 31 vendor categories each |

## Patterns Confirmed

- SHA-256 full-row hash as `source_row_id` provides deterministic deduplication across re-downloads
- `--force-reload` is scoped to `(data_source_id, fiscal_year)` — safe to re-load individual years
- Budget categories for check register data: department codes (McKinney) or vendor names (Frisco) work as category keys
- `link_key` slugification for salaries: `regexp_replace(lower(actual_position_title), '[^a-z0-9]+', '-', 'g')`

## Key Files

- `.planning/phases/06-xlsx-pipeline/06-03-LOAD-LOG.md` — full per-source counts, idempotency tests, fix documentation
- `scripts/bulkLoadXLSX.js` — XLSX loader (ExcelJS, SHA-256 dedup, batch insert via treasury_sync_transactions)
- `scripts/seedXLSXDataSources.js` — idempotent seeder for all XLSX data_sources rows
- `src/components/datasets/DatasetTabs.tsx` — now renders dynamic Employees tab for salaries data

## Deferred

- **Plano check register** — requires manual XLSX export from checkregister.plano.gov; column mapping TBD after inspecting headers

## App Verification

Human-verified on live site (treasurytracker.empowered.vote) 2026-05-01:
- McKinney FY2025 Money Out: $619.4M across 95 department categories — **approved**
- McKinney FY2025 Employees: $134.0M across 51 position-title categories — **approved**
- Frisco FY2025 Money Out: $807.3M across 31 vendor categories — **approved**
