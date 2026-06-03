---
phase: 16-california-cities-budget-load
plan: 03
subsystem: database
tags: [supabase, node, seeder, municipalities, data_sources, socrata, csv_download, idempotent]

# Dependency graph
requires:
  - phase: 15-la-socrata-budget-load
    provides: Los Angeles municipality row (id=391bf791) and LA Operating Budget data_source (id=01c50191)
provides:
  - San Francisco municipality row (id=a98fa397, pop=827526, year=2024)
  - San Diego municipality row (id=1ee32637, pop=1404452, year=2024)
  - SF Operating Budget data_source (id=86ba2211, socrata xdgd-c79v, where_extra Spending)
  - SF Revenue Budget data_source (id=663ca6af, socrata xdgd-c79v, where_extra Revenue)
  - SD Operating Budget data_source (id=5548ecff, csv_download seshat.datasd.org)
  - SD Revenue Budget data_source (id=fa69d8ed, csv_download seshat.datasd.org)
  - LA Revenue Budget data_source (id=993fdef9, socrata vvm4-a2zu, fiscal_year_type=integer)
affects:
  - 16-04 live loads (bulkLoadBudget.js + loadSanDiegoCSV.js drive from these rows)
  - 16-05 enrichment (SF and SD municipality ids needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-city seeder pattern: single script seeds multiple municipalities + their data_sources, mirroring seedXLSXDataSources.js"
    - "Lookup-only helper (getExistingMunicipalityId) for Phase 15 LA row — never upserts, exits with error if missing"
    - "Fallback-free upsertDataSourceByName for new sources: dataset_id+municipality_id is not unique when two rows share same dataset (SF Op + Rev both use xdgd-c79v)"

key-files:
  created:
    - scripts/seedCaliforniaCities.js
  modified: []

key-decisions:
  - "Fallback lookup by (dataset_id, municipality_id) REMOVED from this script — SF Op and SF Rev share the same xdgd-c79v + SF municipality_id, so the fallback would collide. Primary name-based lookup is sufficient since all 5 rows are newly created in Phase 16."
  - "SD api_type is csv_download (not socrata) — discriminator used by loadSanDiegoCSV.js"
  - "LA Revenue base_url is controllerdata.lacity.org (NOT data.lacity.org) — two separate Socrata portals (Phase 15 Pitfall #1)"
  - "LA municipality reused via getExistingMunicipalityId lookup only — upsertMunicipality never called for LA"

patterns-established:
  - "getExistingMunicipalityId: lookup-only helper for rows that must already exist from a prior phase — exits with error if not found, never inserts/updates"
  - "seedCaliforniaCities.js: combined seeder for multiple cities; single run creates all municipality + data_sources prerequisites for Phase 16"

# Metrics
duration: ~15min
completed: 2026-05-22
---

# Phase 16 Plan 03: California Cities Seeder Summary

**Idempotent Node.js seeder inserts SF + SD municipalities and 5 data_sources rows (SF Op/Rev, SD Op/Rev, LA Rev) with exact column_mappings for Phase 16 Socrata and CSV live loads**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-22
- **Completed:** 2026-05-22
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `scripts/seedCaliforniaCities.js` — idempotent seeder for all Phase 16 DB prerequisites
- Inserted San Francisco (pop=827,526) and San Diego (pop=1,404,452) municipality rows with 2024 Census populations
- Reused LA municipality (id=391bf791) from Phase 15 without modification
- Inserted 5 data_sources rows with verified column_mappings for bulkLoadBudget.js and loadSanDiegoCSV.js
- Confirmed idempotency: second run shows "updated existing" for all rows, no duplicates

## New DB Rows (UUIDs for downstream plans)

### Municipalities

| City | id | population | population_year |
|------|----|-----------|----------------|
| San Francisco | a98fa397-e459-4a9b-b37c-214d6af275b6 | 827,526 | 2024 |
| San Diego | 1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2 | 1,404,452 | 2024 |
| Los Angeles | 391bf791-1c1f-424f-a7a5-1b698c79093f | 3,878,704 | 2024 (reused, unchanged) |

### Data Sources

| Name | id | api_type | dataset_type |
|------|----|----------|-------------|
| San Francisco Operating Budget | 86ba2211-8730-4d60-b265-869e22902e48 | socrata | operating |
| San Francisco Revenue Budget | 663ca6af-509c-4b44-a964-7df0da3446af | socrata | revenue |
| San Diego Operating Budget | 5548ecff-4197-483d-a324-cec466ce524f | csv_download | operating |
| San Diego Revenue Budget | fa69d8ed-20a6-4a5b-bde8-0224542534c9 | csv_download | revenue |
| Los Angeles Revenue Budget | 993fdef9-9270-4d71-9a8c-b1a4dfaf9c39 | socrata | revenue |

## Column Mappings (verbatim — for Plan 16-04 dry-run sanity check)

### San Francisco Operating Budget
```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "budget",
  "actual_amount_column": null,
  "category_column": "department",
  "subcategory_column": "fund_type",
  "where_extra": "AND revenue_or_spending='Spending'"
}
```
dataset_id: `xdgd-c79v`, base_url: `https://data.sfgov.org`, fiscal_years: [2025, 2026]

### San Francisco Revenue Budget
```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "budget",
  "actual_amount_column": null,
  "category_column": "department",
  "subcategory_column": "fund_type",
  "where_extra": "AND revenue_or_spending='Revenue'"
}
```
dataset_id: `xdgd-c79v`, base_url: `https://data.sfgov.org`, fiscal_years: [2025, 2026]

### San Diego Operating Budget
```json
{
  "fiscal_year_column": "report_fy",
  "approved_amount_column": "amount",
  "actual_amount_column": null,
  "category_column": "dept_name",
  "subcategory_column": "account",
  "account_number_column": "account_number",
  "budget_cycle_column": "budget_cycle",
  "budget_cycle_value": "adopted"
}
```
dataset_id: `budget_operating_datasd`, base_url: `https://seshat.datasd.org/operating_budget/budget_operating_datasd.csv`, fiscal_years: [2025, 2026]

### San Diego Revenue Budget
```json
{
  "fiscal_year_column": "report_fy",
  "approved_amount_column": "amount",
  "actual_amount_column": null,
  "category_column": "dept_name",
  "subcategory_column": "account",
  "account_number_column": "account_number",
  "budget_cycle_column": "budget_cycle",
  "budget_cycle_value": "adopted"
}
```
dataset_id: `budget_operating_datasd`, base_url: `https://seshat.datasd.org/operating_budget/budget_operating_datasd.csv`, fiscal_years: [2025, 2026]

### Los Angeles Revenue Budget
```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "revenue_budget",
  "actual_amount_column": "revenue_collected",
  "category_column": "department_name",
  "subcategory_column": "revenue_source_name",
  "fiscal_year_type": "integer"
}
```
dataset_id: `vvm4-a2zu`, base_url: `https://controllerdata.lacity.org`, fiscal_years: [2025, 2026]

## Task Commits

1. **Task 1: Create seedCaliforniaCities.js** — `65c2799` (feat)

**Plan metadata:** _(pending — this commit)_

## Files Created/Modified

- `scripts/seedCaliforniaCities.js` — Idempotent seeder: 2 municipalities + 5 data_sources for Phase 16 CA live loads

## Decisions Made

- **Removed dataset_id+municipality_id fallback lookup:** The fallback used in `seedLADataSources.js` (to handle pre-existing "LA City Budget & Expenditures" renamed row) causes collisions when two rows legitimately share the same `(dataset_id, municipality_id)`. SF Operating and SF Revenue both use `xdgd-c79v` with the same SF municipality_id; SD Operating and SD Revenue both use `budget_operating_datasd`. For Phase 16, all rows are new (no pre-existing aliases), so the primary name-based lookup is sufficient and the fallback was removed.
- **LA row: lookup-only via getExistingMunicipalityId:** Added a separate helper that finds the existing row and exits with an error if it's missing. This is distinct from `upsertMunicipality` which would overwrite Phase 15 data.
- **SD api_type = csv_download:** Confirmed in 16-RESEARCH.md. `loadSanDiegoCSV.js` (Plan 16-02) uses `api_type === 'csv_download'` as the discriminator. Setting `'socrata'` would cause the loader to skip SD rows.
- **LA Revenue base_url = controllerdata.lacity.org:** NOT `data.lacity.org` — Phase 15 Pitfall #1; two separate Socrata portals with different datasets.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dataset_id+municipality_id fallback from upsertDataSourceByName**

- **Found during:** Task 1 (first run of the script)
- **Issue:** The fallback lookup copied from `seedLADataSources.js` uses `.maybeSingle()` to find a pre-existing row by `(dataset_id, municipality_id)`. When SF Operating was inserted first, the fallback for SF Revenue found it (only 1 row with xdgd-c79v + SF muni_id) and "renamed" it — leaving 1 row instead of 2. Same problem for SD.
- **Fix:** Removed the fallback entirely. Phase 16 has no pre-existing rows to rename; primary name lookup is sufficient. Added a comment explaining why the fallback is omitted.
- **Files modified:** scripts/seedCaliforniaCities.js
- **Verification:** Second run shows "updated existing" for all 5 data_source rows; SQL confirms 6 CA data_sources (not 5 with one overwritten).
- **Committed in:** 65c2799 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was essential for correctness. The fallback-removal is documented in the script with a comment. No scope creep.

## Idempotency Verification

Second run output (abbreviated):
- SF municipality: "(updated existing municipality row a98fa397)"
- SD municipality: "(updated existing municipality row 1ee32637)"
- LA lookup: "id: 391bf791 (reused from Phase 15 — not modified)"
- SF Operating: "(updated existing row 86ba2211)"
- SF Revenue: "(updated existing row 663ca6af)"
- SD Operating: "(updated existing row 5548ecff)"
- SD Revenue: "(updated existing row fa69d8ed)"
- LA Revenue: "(updated existing row 993fdef9)"
- Verification: all 5 OK

## LA Operating Budget Verification (Phase 15 Unchanged)

SQL check confirmed:
- dataset_id: `uyzw-yi8n` (unchanged)
- fiscal_year_column: `budget_fiscal_year` (unchanged)
- category_column: `department_name` (unchanged)

## Issues Encountered

Initial run failed because the `upsertDataSourceByName` fallback lookup (copied from `seedLADataSources.js`) collided when SF Operating and SF Revenue share `(dataset_id='xdgd-c79v', municipality_id=SF)`. The fallback kept ping-ponging the single row between the two names. Fixed by removing the fallback — the scenario it handles (pre-existing row under a different name) does not apply to Phase 16. See Deviations for full detail.

## Next Phase Readiness

- Plan 16-04 (live loads): All data_source ids are ready. `bulkLoadBudget.js` can be invoked for SF (Socrata + where_extra) and LA Revenue (Socrata + integer fiscal year). `loadSanDiegoCSV.js` can be invoked for SD (csv_download).
- Plan 16-05 (enrichment): SF municipality id = `a98fa397`, SD municipality id = `1ee32637`.
- No blockers.

---
*Phase: 16-california-cities-budget-load*
*Completed: 2026-05-22*
