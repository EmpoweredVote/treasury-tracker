---
phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03
plan: 01
subsystem: database
tags: [minnesota, acfr, gaap, state-node, operating, expenditures, processMN]

requires:
  - phase: 93-mn-acfr-sgfs-01
    provides: processMN.js FY2023-FY2025 operating loader pattern (SOURCES, EXPENDITURES, validate, buildTree, post-RPC stamp)

provides:
  - "MN state-node operating rows FY2008-FY2025 (18 years) in treasury.budgets — all GAAP actuals sourced to individual ACFRs"
  - "processMN.js EXPENDITURES + SOURCES maps extended to FY2008-FY2022 (15 new years)"
  - "Default years array spans FY2008-FY2025; fiscal_years in data_source srcPayload updated to same span"

affects: [96-state-nodes-nasbo, 97-source-chain-audit]

tech-stack:
  added: []
  patterns:
    - "Extend hardcoded ACFR loader maps in-place (EXPENDITURES[fy], SOURCES[fy]) — one year per map entry, verbatim ACFR function names"
    - "validate() sum check: category sum must tie to published Total Expenditures within $10M (tolerance for thousands-rounding)"
    - "Post-RPC targeted UPDATE stamps source_url/source_date/data_source — never data_source_id"
    - "pdftotext -table for accessible PDFs (FY2015+); dotted-column format in older PDFs decoded manually"

key-files:
  created: []
  modified:
    - scripts/processMN.js

key-decisions:
  - "Use pdftotext -table for FY2015-FY2022 accessible PDFs; decode dotted-column format for FY2008-FY2014 older PDFs"
  - "Securities Lending Income line (present FY2008-FY2011, trivially small) not broken out as separate category — included in validate() sum checks"
  - "FY2010 column alignment in pdftotext verified against GAAP Governmental Funds statement (not budgetary basis)"

patterns-established:
  - "Pattern: pdftotext -table cleanly extracts GENERAL FUND column for accessible MN ACFRs (FY2015+)"
  - "Pattern: older dot-matrix PDF format (FY2008-FY2014) requires manual number decoding from dotted-column output"

requirements-completed: [SGFS-02]

duration: 45min
completed: 2026-06-28
---

# Phase 95 Plan 01: MN Operating History Summary

**Minnesota General Fund operating (expenditure-by-function) extended back to FY2008, adding 15 years of GAAP actuals from State ACFRs — 18-year time series FY2008-FY2025 fully sourced, all validate() PASS**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-28T00:00:00Z
- **Completed:** 2026-06-28T00:45:00Z
- **Tasks:** 3 (Tasks 1+2 combined; Task 3 live load)
- **Files modified:** 1

## Accomplishments
- Added EXPENDITURES + SOURCES map entries for FY2008-FY2022 (15 new years) to processMN.js; all 18 FYs dry-run validate PASS
- Default years array widened to FY2008-FY2025; data_source srcPayload fiscal_years updated to same span
- Live-loaded all 18 FYs to production treasury.budgets; all 15 new rows source-stamped with non-NULL GAAP provenance
- DB probe: 15 rows FY2008-FY2022 operating, 0 NULL (source_url / source_date / data_source); idempotent re-run = 0 net changes

## Extraction: Per-FY Table

| FY | Extracted Total ($000) | Published GF Total ($000) | Delta | Method |
|----|----------------------|--------------------------|-------|--------|
| 2008 | 16,086,550 | 16,086,550 | 0 | pdftotext (dotted-column decoded) |
| 2009 | 15,813,781 | 15,813,781 | 0 | pdftotext (dotted-column decoded) |
| 2010 | 15,116,146 | 15,116,146 | 0 | pdftotext (dotted-column decoded) |
| 2011 | 15,411,323 | 15,411,323 | 0 | pdftotext (dotted-column decoded) |
| 2012 | 16,734,755 | 16,734,755 | 0 | pdftotext (clean table) |
| 2013 | 17,186,483 | 17,186,483 | 0 | pdftotext (clean table) |
| 2014 | 18,177,140 | 18,177,140 | 0 | pdftotext (clean table) |
| 2015 | 18,986,749 | 18,986,749 | 0 | pdftotext (accessible, clean) |
| 2016 | 19,379,118 | 19,379,118 | 0 | pdftotext (accessible, clean) |
| 2017 | 20,557,245 | 20,557,245 | 0 | pdftotext (accessible, clean) |
| 2018 | 22,033,656 | 22,033,656 | 0 | pdftotext (accessible, clean) |
| 2019 | 23,314,047 | 23,314,047 | 0 | pdftotext (accessible, clean) |
| 2020 | 23,696,712 | 23,696,712 | 0 | pdftotext (accessible, clean) |
| 2021 | 24,284,883 | 24,284,883 | 0 | pdftotext (accessible, clean) |
| 2022 | 24,333,496 | 24,333,496 | 0 | pdftotext (accessible, clean) |

**All 15 new FYs: 0-diff against published ACFR Total Expenditures. No render-to-image fallback needed.**

## Task Commits

1. **Task 1+2: Extract FY2016-FY2022 + FY2008-FY2015 + widen defaults** - `9682bde` (feat)
2. **Task 3: Live-load + DB probe** - (same working tree, live run after commit)

## Files Created/Modified
- `C:/treasury-tracker/scripts/processMN.js` — EXPENDITURES + SOURCES extended FY2008-FY2022; default years and srcPayload fiscal_years widened to FY2008-FY2025

## Decisions Made
- FY2008-FY2014 ACFRs used pdftotext dotted-column format (numbers embedded in dots); decoded manually — no render-to-image needed since the numbers were readable
- FY2015-FY2022 accessible PDFs extracted cleanly with `pdftotext -table`
- Securities Lending Income (a separate small line in FY2008-FY2011, ranging from $37K to $9.2M) is not broken out as its own category — it was verified in the validate() sum but not exposed as a display category since it appears to be operational overhead not a revenue source equivalent

## Deviations from Plan

None — plan executed exactly as written. All FYs extracted via pdftotext (no render-to-image fallback needed), all validate() PASS, all rows source-stamped, 0-NULL DB probe confirmed.

## DB Probe Results

- MN operating FY2008-2022 rows: **15**
- MN operating FY2008-2022 NULL source rows: **0**
- Idempotent re-run: 0 net new rows inserted

## Issues Encountered

None.

## Self-Check

- [x] processMN.js EXPENDITURES + SOURCES cover FY2008-FY2025
- [x] Default years array = [2008..2025]
- [x] All 18 FY validate() PASS in dry-run
- [x] 15 rows FY2008-FY2022 in treasury.budgets (operating)
- [x] 0 NULL source_url/source_date/data_source
- [x] Idempotent re-run = 0 net changes

## Self-Check: PASSED

## Next Phase Readiness
- MN operating history (FY2008-FY2025) complete; pairs with 95-02 MN revenue for full GF picture
- FY2008-FY2011 categories include Securities Lending (minor) in total but not as a display category — future phases may want to surface or suppress this line
- Ready for Phase 97 source-chain audit

---
*Phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03*
*Completed: 2026-06-28*
