---
phase: 22-troutdale-or-budget-load
plan: 01
subsystem: database
tags: [python, pdfplumber, supabase, oregon, troutdale, pdf-extraction, municipality-seeder]

requires:
  - phase: 21-gresham-or-revenue-load
    provides: extractGresham.py and seedGreshamOregon.js templates used verbatim as copy-adapt base

provides:
  - scripts/extractTroutdale.py — pdfplumber extractor with operating (General Fund) + revenue (All Funds Combined) modes
  - scripts/seedTroutdaleOregon.js — idempotent Troutdale, OR municipality seeder
  - docs/Troutdale/*.pdf — all 8 adopted-budget PDFs downloaded (FY2018-19 through FY2025-26)
  - Troutdale, OR municipality row in DB (id=5acc9a64-6d95-4013-94d8-abf2b714928e, population=15749)

affects: [22-troutdale-or-budget-load plan-02, 22-troutdale-or-budget-load plan-03]

tech-stack:
  added: []
  patterns:
    - "YYYY-YY (dash) fiscal year parsing for Troutdale PDFs — distinct from Gresham/Portland YYYY/YY (slash)"
    - "General Fund page (ACCOUNT 01.00) targeted for operating extraction — Troutdale's All Funds Requirements has categories not departments"
    - "finance_count guard skips duplicate FINANCE row (Finance+InfoSvcs subtotal = dept1 + dept2)"
    - "Standalone $ token handling: strip $ in token clean step before numeric detection"

key-files:
  created:
    - scripts/extractTroutdale.py
    - scripts/seedTroutdaleOregon.js
  modified: []

key-decisions:
  - "Troutdale fiscal year parsing uses YYYY-YY (dash) regex — Gresham slash regex returns 0 matches on Troutdale PDFs"
  - "Operating extraction targets General Fund page (ACCOUNT 01.00), not All Funds — All Funds Requirements has expenditure categories not departments"
  - "All 8 PDFs downloaded successfully (FY2018-19 through FY2025-26) — no download failures"
  - "Population confirmed as 15749 (Census sub-est2024_41.csv, SUMLEV=162, 2024) — not the 17000 estimate in CONTEXT.md"

patterns-established:
  - "Pattern: copy-adapt from Gresham template — change FY regex, page detection, SKIP_ROWS, $ token handling"
  - "Pattern: finance_count guard for duplicate department rows in Troutdale General Fund page"

requirements-completed: []

duration: 7min
completed: 2026-06-01
---

# Phase 22 Plan 01: Troutdale OR Budget Load Foundation Summary

**pdfplumber extractor for Troutdale's General Fund (17 depts, $21.1M) and All Funds revenue (10 cats, $33.7M) with all 8 adopted-budget PDFs downloaded and municipality seeded at population 15749**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-01T23:30:02Z
- **Completed:** 2026-06-01T23:36:59Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Downloaded all 8 Troutdale adopted-budget PDFs (FY2018-19 through FY2025-26) to docs/Troutdale/ — all 8 succeeded (no failures)
- Created extractTroutdale.py with operating mode (17 General Fund departments, $21,128,982 FY2026) and revenue mode (10 All Funds Combined categories, $33,684,123 FY2026)
- Created and ran seedTroutdaleOregon.js — Troutdale, OR municipality row seeded at population 15749, population_year 2024; idempotency confirmed on second run

## PDF Download Results

| FY | Media ID | Filename | Size | Status |
|----|---------|----------|------|--------|
| FY2025-26 | 31436 | fy2025-26.pdf | 2.74 MB | Downloaded |
| FY2024-25 | 26636 | fy2024-25.pdf | 2.24 MB | Downloaded |
| FY2023-24 | 15016 | fy2023-24.pdf | 2.60 MB | Downloaded |
| FY2022-23 | 15021 | fy2022-23.pdf | 2.58 MB | Downloaded |
| FY2021-22 | 15026 | fy2021-22.pdf | 3.22 MB | Downloaded |
| FY2020-21 | 15031 | fy2020-21.pdf | 2.56 MB | Downloaded |
| FY2019-20 | 15036 | fy2019-20.pdf | 2.18 MB | Downloaded |
| FY2018-19 | 15041 | fy2018-19.pdf | 3.71 MB | Downloaded |

All 8 PDFs downloaded successfully. The 4 required FYs (FY2022-23 through FY2025-26) all validated as `%PDF` headers and > 1 MB.

## Extraction Verification (FY2026)

**Operating (--mode operating):**
- Departments: 17 (LEGISLATIVE, JUDICAL, LEGAL, GENERAL GOVERNMENT, ADMINISTRATION, COMMUNITY SERVICES, EXECUTIVE, INFORMATION SERVICES, FINANCE, POLICE OPERATIONS, PD BUILDING OPERATIONS, SOLID WASTE/RECYCLING, FIRE PROTECTION SERVICES, PLANNING, TOURISM & ECONOMIC DEVELOPMENT, PARKS & GREENWAYS, FACILITIES)
- Total: $21,128,982
- Subtotal rows excluded: PUBLIC SAFETY, COMMUNITY DEVELOPMENT, PARKS & FACILITIES
- Duplicate FINANCE row excluded (Finance+InfoSvcs subtotal)

**Revenue (--mode revenue):**
- Categories: 10 (PROPERTY TAXES, OTHER TAXES, REVENUE FROM OTHER AGENCIES, LICENSES & PERMITS, FINES & FORFEITURES, CHARGES FOR CURRENT SERVICES, FRANCHISE FEES, RENT & INTEREST INCOME, OTHER INCOME, TRANSFERS FROM OTHER FUNDS)
- Total: $33,684,123
- BEGINNING FUND BALANCE excluded (prevented ~$81M inflation to correct ~$33.7M)

## Municipality Seed Result

- **Municipality ID:** 5acc9a64-6d95-4013-94d8-abf2b714928e
- **Name:** Troutdale, OR
- **Population:** 15749 (Census sub-est2024_41.csv, SUMLEV=162, 2024)
- **population_year:** 2024
- **Idempotency:** Second run showed "updated existing municipality row" — confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Download Troutdale adopted-budget PDFs** — no commit (docs/ is gitignored; PDFs on disk only)
2. **Task 2: Create extractTroutdale.py** - `61463da` (feat)
3. **Task 3: Create and run seedTroutdaleOregon.js** - `6eed073` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `scripts/extractTroutdale.py` — pdfplumber text-line extractor; operating (General Fund, ACCOUNT 01.00) and revenue (All Funds Combined) modes; YYYY-YY dash FY parsing; finance_count guard; $ token handling
- `scripts/seedTroutdaleOregon.js` — idempotent municipality seeder; Troutdale OR, population 15749, population_year 2024; treasury_list_source_ids verification block

## Decisions Made

- All 8 PDFs downloaded (not just 4 required) — all were available and will allow Plan 02 to probe older FY formats automatically via readdir() discovery
- Population 15749 used (not 17000 estimate from CONTEXT.md) — verified from Census sub-est2024_41.csv

## Deviations from Plan

None — plan executed exactly as written. All 8 PDFs downloaded (no failures), extraction produced exact expected results on first attempt.

## Issues Encountered

- Windows $TEMP path handling: plan verification command used `/tmp/` (Unix path); adapted to use `C:/Users/Chris/AppData/Local/Temp/` for Windows — functional equivalent, no code changes needed

## Known Stubs

None — no stubs created. extractor produces real data from real PDFs.

## Threat Flags

None — no new security surface beyond what the threat model documented.

## Next Phase Readiness

- extractTroutdale.py ready for Plan 02 (processTroutdale.js loader)
- Municipality row seeded at correct population — processTroutdale.js can find it via .eq('name', 'Troutdale').eq('state', 'OR')
- All 8 PDFs on disk — Plan 02 can probe all FYs via readdir() and load as many as pass extraction
- Older FY PDFs (FY2018-19 through FY2021-22) are now on disk for Plan 02 to probe — format compatibility unknown until Plan 02 runs dry-run

---
*Phase: 22-troutdale-or-budget-load*
*Completed: 2026-06-01*
