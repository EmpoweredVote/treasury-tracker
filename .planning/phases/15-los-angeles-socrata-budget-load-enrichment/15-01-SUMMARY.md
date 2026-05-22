---
phase: 15-los-angeles-socrata-budget-load-enrichment
plan: 01
subsystem: database
tags: [supabase, nodejs, socrata, municipalities, data_sources, seed, los-angeles, california]

# Dependency graph
requires:
  - phase: 05-socrata-budget-load
    provides: "bulkLoadBudget.js Socrata pipeline that data_sources row will drive"
  - phase: 14-category-enrichment
    provides: "enrichCategories.js pipeline + municipalities schema with population_year column"
provides:
  - "treasury.municipalities row: Los Angeles, CA (id=391bf791-1c1f-424f-a7a5-1b698c79093f)"
  - "treasury.data_sources row: Los Angeles Operating Budget (id=01c50191-831e-4c88-82ef-e62a2e200e2b)"
  - "Control plane for Phase 15-02 bulkLoadBudget.js run"
affects:
  - 15-02 (uses LA municipality_id + data_sources id)
  - 15-03 (uses LA municipality_id for enrichment queries)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Municipality upsert with fallback: lookup by name+state, if not found lookup by dataset_id+municipality_id (handles pre-existing rows with different names)"
    - "data_sources seeder: insert municipality FIRST (FK), then upsert data_sources with resolved id"

key-files:
  created:
    - scripts/seedLADataSources.js
  modified: []

key-decisions:
  - "Pre-existing row 'LA City Budget & Expenditures' (id=01c50191) renamed to 'Los Angeles Operating Budget' — same dataset_id, same municipality_id; upsert updated name in-place"
  - "Revenue dataset 6cbx-e2fd intentionally excluded — only has data through FY2022, 35 summary rows/year (not line items)"
  - "Population hardcoded as 3878704 (Census sub-est2024_6.csv, SUMLEV=162, POPESTIMATE2024) — appropriate per RESEARCH.md for a single CA city"
  - "base_url is controllerdata.lacity.org (NOT data.lacity.org) — LA has two Socrata portals, budget lives on Controller sub-portal"

patterns-established:
  - "Fallback upsert: name lookup → dataset_id+municipality_id lookup → insert — handles renamed prior seeder rows without collision"

# Metrics
duration: 3min
completed: 2026-05-22
---

# Phase 15 Plan 01: Seed Los Angeles Data Sources Summary

**Los Angeles municipality row (3,878,704 pop, 2024) + 'Los Angeles Operating Budget' data_sources row (uyzw-yi8n at controllerdata.lacity.org) seeded with idempotent fallback upsert**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-22T04:03:18Z
- **Completed:** 2026-05-22T04:07:00Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Created `scripts/seedLADataSources.js` (250 lines) — idempotent seeder for LA municipality + data_sources
- Confirmed `treasury.municipalities` row for Los Angeles CA with correct population and year
- Confirmed `treasury.data_sources` row 'Los Angeles Operating Budget' with verified column_mapping
- Verified idempotency: second run exits 0, shows "(updated existing row ...)" for both rows
- Confirmed treasury_list_source_ids RPC returns exactly 1 LA operating budget source

## Key UUIDs (Plan 15-02 and 15-03 will need these)

- **Los Angeles municipality id:** `391bf791-1c1f-424f-a7a5-1b698c79093f`
- **'Los Angeles Operating Budget' data_sources id:** `01c50191-831e-4c88-82ef-e62a2e200e2b`

## Exact column_mapping Written to DB

```json
{
  "fiscal_year_column": "budget_fiscal_year",
  "approved_amount_column": "adopted_budget_amount",
  "actual_amount_column": "total_expenditures",
  "category_column": "department_name",
  "subcategory_column": "fund_name"
}
```

## Idempotency Verification

Second run output (confirming idempotency):

```
Seeding Los Angeles municipality + data_sources rows...

Upserting municipality: Los Angeles, CA
  (updated existing municipality row 391bf791-1c1f-424f-a7a5-1b698c79093f)
  id: 391bf791-1c1f-424f-a7a5-1b698c79093f

Upserting data_source: Los Angeles Operating Budget
  (updated existing row 01c50191-831e-4c88-82ef-e62a2e200e2b)
  id:           01c50191-831e-4c88-82ef-e62a2e200e2b
  api_type:     socrata
  dataset_type: operating
  dataset_id:   uyzw-yi8n
  fiscal_years: [2025,2026]

Verifying via treasury_list_source_ids RPC...
  Verification: treasury_list_source_ids returns 1 Los Angeles operating budget source.
  - Los Angeles Operating Budget (operating) id=01c50191-831e-4c88-82ef-e62a2e200e2b

Done.
```

## Revenue Data Sources

NO revenue data_sources row was created for Los Angeles.

Revenue dataset `6cbx-e2fd` is unsuitable:
- Only has data through FY2022 (no FY2025 or FY2026)
- Only 35 summary rows per year (not line items)
- Confirmed excluded per 15-RESEARCH.md Pitfall #3

Grep confirms: `grep -c "6cbx-e2fd" scripts/seedLADataSources.js` = 1 occurrence (in the header comment explaining the exclusion).

## Task Commits

1. **Task 1: Create seedLADataSources.js** - `e1bfa85` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `scripts/seedLADataSources.js` — New 250-line idempotent seeder for LA municipality + operating budget data_sources row

## Decisions Made

- Pre-existing row 'LA City Budget & Expenditures' found in DB (seeded during 15-RESEARCH.md investigation). Script's fallback upsert path (by dataset_id + municipality_id) renamed it to 'Los Angeles Operating Budget' and updated column_mapping in-place. The existing id `01c50191-831e-4c88-82ef-e62a2e200e2b` is preserved.
- Revenue dataset 6cbx-e2fd intentionally excluded (RESEARCH.md Pitfall #3)
- base_url `https://controllerdata.lacity.org` confirmed (NOT data.lacity.org)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added dataset_id+municipality_id fallback upsert to handle pre-existing row**

- **Found during:** Task 1 (first run of seedLADataSources.js)
- **Issue:** A row named "LA City Budget & Expenditures" already existed in `treasury.data_sources` with the same `dataset_id=uyzw-yi8n` and `municipality_id`. The unique constraint `idx_data_sources_unique_dataset` prevents inserting a second row with the same dataset_id+municipality_id. The name-lookup returned null (different name), so the code attempted an INSERT which hit the constraint.
- **Fix:** Added a fallback lookup by `dataset_id` + `municipality_id` in `upsertDataSourceByName()`. If the name lookup finds nothing but the dataset_id+municipality_id lookup finds an existing row, it updates that row in-place (renaming it to the canonical name). This makes the script fully idempotent even when prior exploratory seeding used a different name.
- **Files modified:** `scripts/seedLADataSources.js`
- **Verification:** Script runs twice cleanly; second run shows "(updated existing row 01c50191-831e-4c88-82ef-e62a2e200e2b)"; DB confirms name="Los Angeles Operating Budget"
- **Committed in:** `e1bfa85`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for idempotency. No scope creep. The fallback upsert pattern is a useful addition to the seeder — protects against future name discrepancies.

## Issues Encountered

Pre-existing "LA City Budget & Expenditures" row caused an insert collision on first attempt. Resolved by adding a fallback lookup path. See Deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- LA municipality id `391bf791-1c1f-424f-a7a5-1b698c79093f` ready for Plan 15-02
- LA data_sources id `01c50191-831e-4c88-82ef-e62a2e200e2b` ready for Plan 15-02 dry-run and load
- `bulkLoadBudget.js --source "Los Angeles" --dry-run --fy 2025` can now be run immediately
- No blockers for Plan 15-02

---
*Phase: 15-los-angeles-socrata-budget-load-enrichment*
*Completed: 2026-05-22*
