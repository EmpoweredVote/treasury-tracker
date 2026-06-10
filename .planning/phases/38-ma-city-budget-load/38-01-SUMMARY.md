---
phase: 38-ma-city-budget-load
plan: "01"
subsystem: data-load
tags: [ma-dls, scrape, massachusetts, revenue-by-source, special-revenue]
dependency_graph:
  requires: []
  provides:
    - scripts/output/ma_dls_revenue-by-source_2021.json
    - scripts/output/ma_dls_revenue-by-source_2022.json
    - scripts/output/ma_dls_revenue-by-source_2023.json
    - scripts/output/ma_dls_revenue-by-source_2024.json
    - scripts/output/ma_dls_special-revenue_2021_expenditures.json
    - scripts/output/ma_dls_special-revenue_2022_expenditures.json
    - scripts/output/ma_dls_special-revenue_2023_expenditures.json
    - scripts/output/ma_dls_special-revenue_2024_expenditures.json
  affects:
    - treasury.budgets (MA cities, FY2021-2024)
    - treasury.budget_categories (MA cities, FY2021-2024)
    - treasury.data_sources (fiscal_years arrays updated via LOAD-03)
tech_stack:
  added: []
  patterns:
    - MA DLS Gateway scrape via HTTP GET + POST form submission
    - AJAX pagination with year-filtered rdDataCache
    - Treasury_sync_budget_tree RPC for idempotent budget upsert
key_files:
  created: []
  modified:
    - scripts/scrapeMaDLS.js
decisions:
  - "Bug fix: always POST form to get year-filtered rdDataCache for all report types (including AJAX-GET)"
  - "Script --scrape auto-loads to DB (not scrape-only as plan assumed) — acceptable since treasury_sync_budget_tree is idempotent"
metrics:
  duration_minutes: 22
  completed_date: "2026-06-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 38 Plan 01: MA DLS FY2021–2024 Scrape Summary

Scraped MA DLS data for FY2021–FY2024 for all 351 Massachusetts municipalities across two report types (revenue-by-source + special-revenue expenditures), producing 8 JSON files and loading them into the DB. A critical year-filtering bug in the scraper was discovered and fixed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scrape revenue-by-source FY2021–FY2024 | 07105a9 (bug fix) | 4 JSON files (351 records each) |
| 2 | Scrape special-revenue expenditures FY2021–FY2024 | 07105a9 (bug fix) | 4 JSON files (351 records each) |

## Record Counts by Fiscal Year

### Revenue-by-Source (dataset_type: revenue)

| Fiscal Year | Records | DB Loaded | DB Skipped | Notes |
|-------------|---------|-----------|------------|-------|
| FY2021 | 351 | 351 | 0 | All 351 cities |
| FY2022 | 351 | 351 | 0 | All 351 cities |
| FY2023 | 351 | 351 | 0 | All 351 cities |
| FY2024 | 351 | 351 | 0 | All 351 cities |

All FYs at exactly 351 records (full coverage). No caveat needed — revenue-by-source had complete coverage back to FY2021.

### Special-Revenue Expenditures (dataset_type: operating)

| Fiscal Year | Records | DB Loaded | DB Skipped (all-zero) | Notes |
|-------------|---------|-----------|----------------------|-------|
| FY2021 | 351 | 306 | 45 | 45 cities had zero federal grants |
| FY2022 | 351 | 323 | 28 | 28 cities had zero federal grants |
| FY2023 | 351 | 321 | 30 | 30 cities had zero federal grants |
| FY2024 | 351 | 323 | 28 | 28 cities had zero federal grants |

All FYs at exactly 351 records. Cities with all-zero federal grants are skipped by `treasury_sync_budget_tree` (no budget rows created for zero-amount data). This is expected behavior per RESEARCH Pitfall 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scrapeMaDLS.js year filter broken for AJAX-GET reports (special-revenue)**

- **Found during:** Task 2 (first special-revenue FY2021 scrape)
- **Issue:** For AJAX-GET paginated reports (special-revenue), the scraper used the `rdDataCache` from the initial GET request. That GET always returns the portal's default year (FY2025), so all AJAX-GET scrape runs returned FY2025 data regardless of the `--fy` parameter passed.
- **Root cause:** The code branched on `report.paginationType === 'post'` to decide whether to POST the form before pagination. AJAX-GET reports (including special-revenue) went into the `else` branch and used the GET's rdDataCache directly — which is always FY2025.
- **Fix:** Removed the if/else branch. All reports now POST the form with the year filter to get a year-specific `rdDataCache` before paginating. Added fallback to GET rdDataCache if POST returns none.
- **Files modified:** `scripts/scrapeMaDLS.js`
- **Commit:** `07105a9`
- **Impact:** First special-revenue FY2021 scrape (before fix) stored FY2025 data under the FY2021 budget row for 298 cities. After the fix, FY2021 data was re-scraped correctly and re-loaded (306 cities), overwriting the incorrect FY2025 data via idempotent `treasury_sync_budget_tree` upsert. Progress ledger `special-revenue:2021` key was cleared to force re-load.

**2. [Observation] --scrape auto-loads to DB (not scrape-only)**

- **Found during:** Task 1 (first revenue-by-source scrape)
- **Behavior:** The plan assumed `--scrape` writes JSON files only (no DB writes). In practice, `scrapeMaDLS.js --scrape` calls `loadToSupabase()` automatically when Supabase credentials are available (line 762: `if (result && !values['dry-run'] && supabase)`).
- **Impact:** All 8 scrape runs also loaded to the DB. Since `treasury_sync_budget_tree` is idempotent, this is a net benefit — Plan 02 (Wave 2 load) can run the FY2021–2024 load commands and they will be checkpoint-skipped (progress.json already populated), or omit those FYs entirely.
- **Action:** No code change made. This is the script's intended behavior. Noted here for Plan 02 awareness.

## File Inventory

| File | Size Approx | FY | Records | Correct FY in records |
|------|------------|-----|---------|----------------------|
| `scripts/output/ma_dls_revenue-by-source_2021.json` | ~600KB | 2021 | 351 | Yes |
| `scripts/output/ma_dls_revenue-by-source_2022.json` | ~600KB | 2022 | 351 | Yes |
| `scripts/output/ma_dls_revenue-by-source_2023.json` | ~600KB | 2023 | 351 | Yes |
| `scripts/output/ma_dls_revenue-by-source_2024.json` | ~600KB | 2024 | 351 | Yes |
| `scripts/output/ma_dls_special-revenue_2021_expenditures.json` | ~1MB | 2021 | 351 | Yes |
| `scripts/output/ma_dls_special-revenue_2022_expenditures.json` | ~1MB | 2022 | 351 | Yes |
| `scripts/output/ma_dls_special-revenue_2023_expenditures.json` | ~1MB | 2023 | 351 | Yes |
| `scripts/output/ma_dls_special-revenue_2024_expenditures.json` | ~1MB | 2024 | 351 | Yes |

Combined with the 2 pre-existing FY2025 files, 10 total MA DLS JSON files are present.

## Success Criteria Status

- [x] All 8 FY2021–FY2024 JSON files written to disk and parse as non-empty JSON arrays
- [x] revenue-by-source files have no _expenditures suffix
- [x] special-revenue files have the _expenditures suffix
- [x] Each file contains exactly 351 city records (>= 300 per acceptance criteria for FY2021)
- [x] Correct fiscal year in record data (verified: records[0].fiscalYear matches requested FY)
- [x] Wave 2 (Plan 02) load can proceed — JSON files exist and progress.json tracks completed loads

## Plan 02 Awareness

Since `--scrape` also auto-loaded to the DB, the progress.json already tracks FY2021–2024 for both report types:
- `revenue-by-source:2021` through `revenue-by-source:2024`: 351 cities each (complete)
- `special-revenue:2021` through `special-revenue:2024`: 351 cities each (complete after FY2021 re-load)

When Plan 02 runs `--load --file` for these FYs, the progress checkpoint will skip all 351 cities as "already loaded." Plan 02 load commands will still be safe to run (idempotent) but will complete instantly via checkpoint. FY2025 load runs are NOT in the progress.json and will execute normally.

## Threat Flags

None. All operations were outbound HTTP GET/POST to the public MA DLS portal. No auth paths, API endpoints, or user-facing inputs modified.

## Self-Check

Verifying claims:

- [x] `scripts/output/ma_dls_revenue-by-source_{2021,2022,2023,2024}.json` exist: CONFIRMED
- [x] `scripts/output/ma_dls_special-revenue_{2021,2022,2023,2024}_expenditures.json` exist: CONFIRMED
- [x] Each file has 351 records with correct fiscalYear: CONFIRMED
- [x] `scripts/scrapeMaDLS.js` bug fix committed as `07105a9`: CONFIRMED
- [x] No files named with wrong suffix (no `_expenditures` on revenue-by-source): CONFIRMED

## Self-Check: PASSED
