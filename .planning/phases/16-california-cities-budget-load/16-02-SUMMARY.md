---
phase: 16-california-cities-budget-load
plan: 02
subsystem: data-loading
tags: [node, csv, san-diego, seshat, budget, socrata-alternative, fetch]

# Dependency graph
requires:
  - phase: 16-01
    provides: Extended bulkLoadBudget.js and data_sources seeder patterns for CA cities
provides:
  - scripts/loadSanDiegoCSV.js — San Diego seshat.datasd.org CSV budget loader (operating + revenue split by account prefix)
  - Live CSV schema validation: confirmed header columns and FY25 row counts
  - FY26 schema drift finding: budget_cycle is empty for FY26 rows (Plan 16-03 must accommodate)
affects: [16-03, 16-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSV download + in-memory quote-aware parser (no npm deps) for static city data portals"
    - "Single CSV download cached across all (source, fy) pairs to avoid re-fetching"
    - "2-digit report_fy matching: String(fiscalYear).slice(-2) converts 4-digit CLI arg to 2-digit CSV value"
    - "Account-prefix split: 4xxxxx=revenue, 5xxxxx=operating — both in one SD CSV file"

key-files:
  created:
    - scripts/loadSanDiegoCSV.js
  modified: []

key-decisions:
  - "FY26 budget_cycle column is empty in the live CSV (all FY26 rows have blank cycle). FY25 uses 'adopted'/'proposed' correctly. Plan 16-03 must decide: either set fiscal_years=[2025] only, or add a special case in filterSanDiegoRows to treat blank cycle as 'adopted' for future FYs."
  - "SD CSV is fully double-quoted — naive split(',') leaves quotes in column names. The quote-aware parseCSV function in loadSanDiegoCSV.js handles this correctly."
  - "CSV has 548,811 data rows covering FY2011-FY2026 — downloading once and caching is essential."

patterns-established:
  - "csv_download api_type: loadSanDiegoCSV.js is the reference implementation for non-Socrata cities with static CSV exports"
  - "filterSanDiegoRows reads cycle/fy/account column names from column_mapping so seeder controls field mapping"

# Metrics
duration: 15min
completed: 2026-05-22
---

# Phase 16 Plan 02: San Diego CSV Loader Summary

**loadSanDiegoCSV.js built with quote-aware CSV parser, account-prefix revenue/expense split, and 2-digit FY matching; live CSV probe confirms FY25 has 33,436 adopted rows but FY26 budget_cycle is blank (schema drift from RESEARCH.md)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-23T00:21:44Z
- **Completed:** 2026-05-23T00:36:00Z
- **Tasks:** 2 (Task 1: create file; Task 2: CSV sanity probe — verification only)
- **Files modified:** 1 created

## Accomplishments

- Created `scripts/loadSanDiegoCSV.js` (288 lines) — the SD equivalent of `bulkLoadBudget.js` for the seshat.datasd.org CSV format
- `--list` exits 0 with empty source list (SD sources not yet seeded — expected at this stage)
- Confirmed live CSV is fully double-quoted; quote-aware `parseCSV()` handles this correctly
- Ran full CSV sanity probe: 548,811 rows, FY2011–FY2026, confirmed FY25 adopted data with both 4xxxxx (revenue) and 5xxxxx (operating) account prefixes
- Discovered FY26 schema drift: `budget_cycle` column is blank for all FY26 rows — surfaced for Plan 16-03 decision

## Task Commits

1. **Task 1: Create loadSanDiegoCSV.js** — `6cbffa5` (feat)
2. **Task 2: CSV sanity probe** — verification only, no commit (runtime check)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `scripts/loadSanDiegoCSV.js` — San Diego CSV budget loader, 288 lines

## Live CSV Probe Results

### Header Columns Confirmed

```
amount, report_fy, budget_cycle, fund_type, fund_number, dept_name, funds_center_number, account, account_number
```

All required columns present: `report_fy` (idx 1), `budget_cycle` (idx 2), `dept_name` (idx 5), `account` (idx 7), `account_number` (idx 8), `amount` (idx 0).

Note: The CSV is fully double-quoted — every field including headers is wrapped in `"..."`. The naive `split(',')` probe from the plan spec returned `"report_fy"` (with quotes), causing a false "MISSING REQUIRED COLUMN" error. The quote-aware `parseCSV()` in `loadSanDiegoCSV.js` handles this correctly.

### FY25 + FY26 Adopted Row Counts by Account Prefix

| Key | Row Count |
|-----|-----------|
| `25\|adopted\|4` | 1,098 |
| `25\|adopted\|5` | 32,338 |
| **FY25 adopted total** | **33,436** |
| `26\|adopted\|4` | 0 |
| `26\|adopted\|5` | 0 |
| **FY26 adopted total** | **0** |

FY26 rows DO exist (32,596 total) but all have an **empty `budget_cycle` field** — the column is blank, not `'proposed'` or `'adopted'`. The `filterSanDiegoRows` function filters by `budget_cycle === 'adopted'`, so FY26 rows are currently excluded.

### All FY|cycle Row Counts (Full Picture)

| FY|cycle | Rows |
|---------|------|
| 11\|adopted | 31,369 |
| 12\|adopted | 29,986 |
| ... | ... |
| 24\|adopted | 32,518 |
| 24\|proposed | 32,453 |
| 25\|adopted | 33,436 |
| 25\|proposed | 33,426 |
| **26\|(blank)** | **32,596** |

## Decisions Made

- **FY26 blank budget_cycle:** The SD CSV does not label FY26 rows with `'adopted'` — they have an empty cycle field. This is schema drift from what RESEARCH.md assumed. Plan 16-03 must choose one of:
  - Option A: Set `fiscal_years: [2025]` only for both SD data_sources rows (simplest — avoids blank-cycle handling)
  - Option B: Add `budget_cycle_value: ''` (empty string) to column_mapping so `filterSanDiegoRows` treats blank cycle as the match value for FY26
  - Recommendation: **Option A** for Plan 16-03 — load FY2025 only, revisit FY26 when SD publishes the adopted FY26 budget with a proper cycle label

- **No additional npm deps needed:** The quote-aware inline `parseCSV()` handles SD's fully-quoted CSV format correctly.

## Deviations from Plan

### Auto-fixed Issues

None — the loader was created exactly per spec.

### Schema Drift Finding (informational — not a code fix)

**FY26 budget_cycle is blank in the live CSV**
- **Found during:** Task 2 (CSV sanity probe)
- **Issue:** 16-RESEARCH.md documented that `budget_cycle` distinguishes adopted from proposed. For FY2025 this is true (`adopted`/`proposed`). For FY2026, all 32,596 rows have an empty `budget_cycle` — the SD city portal hasn't labeled the FY26 data with a cycle tag yet.
- **Impact on loadSanDiegoCSV.js:** None — the loader is correct as written. The filter `budget_cycle === 'adopted'` will return 0 rows for FY26, which is the safe/correct behavior until SD labels the data.
- **Action required in Plan 16-03:** Seed `fiscal_years: [2025]` (not `[2025, 2026]`) for both SD data_sources rows, OR add a blank-cycle accommodation.

---

**Total deviations:** 0 code deviations — plan executed exactly as written.
**Schema drift:** FY26 budget_cycle is blank — documented for Plan 16-03 decision.

## Issues Encountered

- The plan's verification probe script used naive `split(',')` on the header line, which fails because all SD CSV fields are double-quoted (e.g., `"report_fy"` not `report_fy`). Resolved by using the quote-aware `parseLine()` function inline. The actual `loadSanDiegoCSV.js` `parseCSV()` handles this correctly — this was only an issue in the inline probe script.

## Next Phase Readiness

- `scripts/loadSanDiegoCSV.js` is complete and ready for Plan 16-03 to seed the SD `data_sources` rows
- **Plan 16-03 action required:** Decide on FY26 handling. Recommendation: seed `fiscal_years: [2025]` only until SD labels FY26 rows with a budget_cycle value
- FY25 SD operating budget: 32,338 rows with 5xxxxx account prefix
- FY25 SD revenue: 1,098 rows with 4xxxxx account prefix
- Both will load correctly once Plan 16-03 seeds the `csv_download` data_sources rows

---
*Phase: 16-california-cities-budget-load*
*Completed: 2026-05-22*
