---
phase: 13-richardson-operating-budget
plan: 01
subsystem: data
tags: [xlsx, exceljs, richardson, operating-budget, multi-format]

requires:
  - phase: 10-collin-county
    provides: Richardson municipality row + placeholder data_source rows for FY2025/FY2026
provides:
  - Richardson TX General Fund operating budget FY2018-FY2026 (no FY2023) loaded to DB
  - processRichardsonBudget.js: multi-format XLSX loader handling 4 distinct sheet layouts
  - 8 fiscal years, 658 budget_categories rows, totals $123M-$166M
affects: [future data loads, frontend display for Richardson]

tech-stack:
  added: []
  patterns:
    - "Multi-format XLSX dispatch: format key in FY_CONFIG routes to correct parser"
    - "ExcelJS cellVal helper: handles formula-result objects (.result) alongside plain values"
    - "Old format: use pre-aggregated Total DEPTNAME rows to avoid double-counting sub-dept lines"
    - "New24/25 format: 0110- account prefix filter + orgDesc VLOOKUP formula result extraction"
    - "FY26 format: Fund column string '0110' + separate OrgName column (no formula)"

key-files:
  created:
    - scripts/processRichardsonBudget.js
  modified: []

key-decisions:
  - "FY2023 skipped — no downloadable XLSX available from City of Richardson"
  - "Old format (FY2018-2022): Fund=11 (integer), Total DEPTNAME rows pre-aggregate departments"
  - "Duplicate dept name handling: keep larger of two Total rows (Traffic & Transportation duplicate)"
  - "Transfers out (-767- account codes) excluded from all new-format FYs"
  - "FY26: Convention/Visitors Bureau has $0 budget — skipped by filterZeroOrgs"
  - "Sanity range $100M-$250M covers all 8 FYs with headroom"
  - "actual_amount populated from prior-year actuals column where available"

patterns-established:
  - "FY_CONFIG map: file path + expenseSheet + format + budgetCol + actualsCol + existingDsId"
  - "Upsert logic: existingDsId -> update placeholder; else search by muni+dataset_id+dataset_type"

duration: ~45min (split across two sessions)
completed: 2026-05-22
---

# Phase 13 Plan 01: Richardson Operating Budget Summary

**8-FY Richardson TX General Fund loader built + loaded: $123M (FY2018) to $166M (FY2026) via 4 distinct XLSX layout parsers, 658 budget_categories rows in DB.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-05-22
- **Tasks:** 2 (build script, run load)
- **Files modified:** 1

## Accomplishments

- Built `processRichardsonBudget.js` handling 4 XLSX layouts: old (FY2018-2022), new24 (FY2024), new25 (FY2025), fy26 (FY2026)
- Loaded all 8 available fiscal years (FY2023 unavailable from city)
- All totals pass $100M-$250M sanity check; consistent year-over-year growth
- Updated existing FY2025/FY2026 placeholder data_source rows; created new rows for FY2018-FY2024
- 658 budget_categories rows (depth-0 and depth-1 tree nodes per RPC convention)

## Data Loaded

| FY   | Departments | GF Total        | Per Capita (~120k) |
|------|-------------|-----------------|-------------------|
| 2018 | 41          | $123,172,520    | $1,026             |
| 2019 | 41          | $128,186,363    | $1,068             |
| 2020 | 41          | $131,806,121    | $1,098             |
| 2021 | 41          | $124,428,150    | $1,037             |
| 2022 | 41          | $136,512,431    | $1,138             |
| 2024 | 39          | $162,042,287    | $1,350             |
| 2025 | 39          | $164,355,537    | $1,370             |
| 2026 | 46          | $166,042,367    | $1,384             |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| FY2023 skipped | No downloadable XLSX available on Richardson's budget page |
| Old format uses Total DEPTNAME rows | Pre-aggregated totals avoid double-counting account-level rows |
| Keep larger of duplicate dept rows | Traffic & Transportation appears twice; larger value is the real dept total |
| Transfers-out (-767-) excluded | Cross-fund transfers inflate operating totals |
| Actual amounts from prior-year actuals column | FY2024+: 2 years prior actuals available in same sheet |

## Deviations from Plan

None — plan executed exactly as designed.

## Next Phase Readiness

- Richardson budget data is live in DB; frontend display requires no changes (uses same budget tree RPC)
- Remaining v1.3 work: verify Richardson display on live site
