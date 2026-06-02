---
phase: 24-los-angeles-data-refresh
plan: 02
subsystem: database
tags: [supabase, nodejs, socrata, budget-load, los-angeles, california, enterprise-fund-filter, historical-backfill]

# Dependency graph
requires:
  - phase: 24-01
    provides: "24-02-PLAN.md: seeder + loader execution plan for LA operating budget fix"
  - phase: 15-02
    provides: "LA municipality row (id=391bf791) + data_source row (id=01c50191) + treasury_sync_budget_tree RPC"
provides:
  - "scripts/seedLADataSources.js: where_extra='AND adopted_budget_amount > 0' + fiscal_years [2017-2026]"
  - "treasury.data_sources id=01c50191: column_mapping updated with where_extra + fiscal_years=[2017..2026]"
  - "treasury.budgets FY2017-FY2026 operating rows: all 10 years loaded with enterprise-fund exclusion filter"
  - "treasury.budget_categories FY2017-FY2020: department-level trees (48-50 depth-0 categories per year)"
  - "treasury.budgets FY2025: total_budget=$19,855,193,208 (~$19.86B approved); enterprise funds excluded from source"
affects:
  - 24-03 (revenue fix — independent, same municipality)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "where_extra pattern in column_mapping: seedLADataSources.js LA_DATA_SOURCE() now uses where_extra to exclude enterprise funds (WATER AND POWER/AIRPORTS/HARBOR) that have adopted_budget_amount=0"
    - "fiscal_years expansion: seeder idempotent upsert writes expanded array to DB; bulkLoadBudget.js reads from DB, not script"
    - "treasury_sync_budget_tree does NOT write actual_amount to budget_categories — aa values in tree items are not persisted to DB columns; actual_amount is always 0 in budget_categories"
    - "treasury_sync_budget_tree does NOT update data_source_id on existing budget rows — pre-existing rows retain their original data_source_id value; FK repair via re-run does not work"

key-files:
  created: []
  modified:
    - scripts/seedLADataSources.js

key-decisions:
  - "Added where_extra='AND adopted_budget_amount > 0' to exclude enterprise funds (LADWP/Airports/Harbor) that have adopted_budget_amount=0 but large total_expenditures values"
  - "Expanded fiscal_years from [2025,2026] to [2017..2026] to enable 10-year historical load"
  - "Seeder MUST run before loader — bulkLoadBudget.js reads column_mapping from DB via treasury_get_data_source_config, not from script"
  - "FY2017-2020 loaded as new budget rows (data_source_id=null); FY2021-2026 reloaded in-place (data_source_id unchanged from pre-existing 1973cbe0)"

# Metrics
duration: ~30min
completed: 2026-06-02T18:47:53Z
---

# Phase 24 Plan 02: LA Operating Budget Data Fix Summary

**LA Operating Budget seeder updated with enterprise-fund exclusion filter and fiscal_years expanded to FY2017-FY2026; all 10 years reloaded with clean approved totals and department-level category trees**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-02T18:15:00Z
- **Completed:** 2026-06-02T18:47:53Z
- **Tasks:** 2 of 2 (Task 2 has no source commit — loader-only execution)
- **Files modified:** 1 (scripts/seedLADataSources.js)

## Accomplishments

### Task 1: Seeder Update + Re-seed
- Added `where_extra: "AND adopted_budget_amount > 0"` to LA_DATA_SOURCE() column_mapping
- Expanded `fiscal_years: [2025, 2026]` to `[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]`
- Seeder ran successfully (exit 0): DB updated for id=01c50191-831e-4c88-82ef-e62a2e200e2b
- Verified: column_mapping in DB contains `where_extra`, fiscal_years contains 2017..2026

### Task 2: 10-Year Reload
All 10 fiscal years loaded successfully:

| Fiscal Year | Rows Loaded | Approved Total | Depth-0 Categories |
|---|---|---|---|
| FY2017 | 1,367 | $13.39B | 48 |
| FY2018 | 1,516 | $14.20B | 50 |
| FY2019 | 1,524 | $15.13B | 50 |
| FY2020 | 1,571 | $16.24B | 50 |
| FY2021 | 1,477 | $16.17B | 51 |
| FY2022 | 1,605 | $17.45B | 54 |
| FY2023 | 1,605 | $18.16B | 54 |
| FY2024 | 1,630 | $19.97B | 54 |
| FY2025 | 1,525 | $19.86B | 54 |
| FY2026 | 1,490 | $21.43B | 55 |

**FY2025 filter behavior confirmed:** 1,525 rows loaded (vs 3,786 without filter) — enterprise-fund rows with adopted_budget_amount=0 excluded. Approved total unchanged at ~$19.9B.

**FY2017-2020 department trees:** 48-50 depth-0 categories per year — historical trees now present (previously NULL hierarchy).

## DB State After Load

| Criterion | Status | Detail |
|---|---|---|
| FY2025 approved total ~$19.9B | PASS | $19,855,193,208 |
| FY2025 filtered rows | PASS | 1,525 rows (was 3,786) |
| FY2017-2020 >= 40 depth-0 categories | PASS | 48-50 per year |
| FY2026 approved total ~$21.4B | PASS | $21,431,295,120 |
| FY2021-2024 nonzero actuals | DEFERRED | RPC limitation (see Deviations) |
| FY2025 actuals ~$16.0B | DEFERRED | RPC limitation (see Deviations) |
| Orphaned FK 1973cbe0 repaired | DEFERRED | source_registry constraint (see Deviations) |

## Deviations from Plan

### Architectural Finding 1: treasury_sync_budget_tree Does Not Write actual_amount

**Found during:** Task 2 DB verification
**Expectation:** "FY2021-2024 budget_categories have nonzero aa (actuals) for top departments"
**Actual behavior:** `treasury_sync_budget_tree` does not store `aa` (actual amount) from the tree payload into `budget_categories.actual_amount`. Test confirmed: `{ d: 'sub', a: 50, aa: 45 }` item → `actual_amount=0` in DB.
**Impact:** `actual_amount` in `budget_categories` is 0 for ALL years, regardless of filter. The enterprise-fund actuals ($43.5B concern) never existed in the DB.
**What WAS fixed:** The enterprise-fund rows are now excluded from the source. When/if the RPC is updated to support actual amounts, the filtered data will produce clean actuals. The `where_extra` filter is correctly placed preventatively.
**Rule 4 disposition:** Modifying `treasury_sync_budget_tree` to write actual_amount values requires an RPC schema change (new DB migration). This is an architectural change — deferred to a future phase.

### Architectural Finding 2: treasury_sync_budget_tree Does Not Repair data_source_id

**Found during:** Task 2 DB verification
**Expectation:** Re-running the loader would repair orphaned FK from 1973cbe0 to 01c50191
**Actual behavior:** The RPC matches budget rows by `(municipality_id, fiscal_year, dataset_type)` and rebuilds categories but does NOT update `data_source_id`. Pre-existing rows retain their original data_source_id.
**Additional constraint:** Direct SQL update of `data_source_id` to `01c50191` fails with FK constraint violation: `Key (data_source_id)=(01c50191...) is not present in table "source_registry"`. The `source_registry` table (not directly accessible via PostgREST) is the FK parent, and `01c50191` is not registered there.
**Impact:** FY2021-2026 budget rows still reference `data_source_id=1973cbe0-33ab-46cb-bdc1-cdd875ca8471` (orphaned). FY2017-2020 new rows have `data_source_id=null`. Per Milestone v1.4 audit: `data_source_id` is cosmetic — no query path depends on it.
**Rule 4 disposition:** Repairing the FK requires registering `01c50191` in `source_registry` — architectural change deferred.

## Known Stubs

None — no stubs in modified files.

## Threat Flags

None — seeder changes only affect column_mapping in a single data_source row; no new endpoints or auth paths.

## Self-Check

Checking created files and commits...

- scripts/seedLADataSources.js: MODIFIED (where_extra added, fiscal_years expanded)
- commit 20b4763 (Task 1): PRESENT
- Task 2: no source commit (loader-only, per Phase 15 precedent)
- .planning/phases/24-los-angeles-data-refresh/24-02-SUMMARY.md: PRESENT (this file)

## Self-Check: PASSED
