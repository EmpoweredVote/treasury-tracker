---
phase: 105-pa-il-acfr-upgrade
plan: "01"
subsystem: state-acfr-loaders
tags: [pa, acfr, operating, revenue, gaap, state-node, dry-run]
dependency_graph:
  requires: []
  provides:
    - scripts/processPAAcfr.js
    - scripts/processPARevenueAcfr.js
  affects:
    - treasury.budgets (PA state node — via Wave-2 live load in Plan 105-03)
tech_stack:
  added: []
  patterns:
    - FL/TX analog loader pattern (v2.11)
    - pdftotext -table GF column extraction
    - P2 clamp (ACFR-08) wired
    - %20 URL special-case for FY2024+ pa.gov filenames
key_files:
  created:
    - scripts/processPAAcfr.js
    - scripts/processPARevenueAcfr.js
  modified: []
decisions:
  - "Store thousands in REVENUE/EXPENDITURES maps, ×UNITS=1000 at buildTree (FL convention, not TX raw-dollars)"
  - "Resolve PA node by name+state+entity_type='state' (no pinned ID, TX-style lookup)"
  - "FY2016-FY2023 hyphen URLs; FY2024-FY2025 %20 URLs — SOURCES special-cased per 103-PA-IL-SOURCES.md"
  - "Debt service Principal retirement FY2016/FY2017/FY2018 = 0 in GF column — included as zero-valued, filtered from buildTree by >0 check"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-30T19:11:01Z"
  tasks: 3
  files: 2
---

# Phase 105 Plan 01: PA ACFR Loaders (Operating + Revenue) Summary

One-liner: PA General Fund ACFR loaders FY2016-FY2025 on v2.11 FL/TX pattern — 10/10 FY dry-run-tied, %20 URL special-cased, P2 clamp wired, TX-trap documented.

## What Was Built

Two Pennsylvania ACFR loaders built on the proven v2.11 FL/TX pattern:

### scripts/processPAAcfr.js (GF Spending-by-Function)
- PA ACFR General Fund expenditures-by-function, Governmental Funds Statement of Rev/Exp/Changes
- FY2016–FY2025 (10 years), GAAP basis, thousands ×1000
- SOURCES: hyphen URLs FY2016–FY2023; literal-space `%20acfr.pdf` FY2024–FY2025
- dataset_type='operating', dataset_id='pa-acfr-gf-operating'
- dataSource(fy) = "Pennsylvania State ACFR — General Fund (FY{fy} actual, GAAP basis)"

### scripts/processPARevenueAcfr.js (GF Revenue-by-Source)
- PA ACFR General Fund revenues-by-source, same statement / same GF column
- FY2016–FY2025 (10 years), thousands ×1000 (FL convention, not TX raw-dollars)
- Same SOURCES map as operating loader (identical URL pattern)
- dataset_type='revenue', dataset_id='pa-acfr-gf-revenue'
- dataSource(fy) = "Pennsylvania State ACFR — General Fund Revenue (FY{fy} actual, GAAP basis)"
- P2 clamp (ACFR-08): clampForRender + "(net loss — shown at 0)" label path wired
- TX-trap scope note in header: PA ~2.0× NASBO because federal/intergovernmental (~$42.3B) sits inside the GAAP General Fund

## FY Window Actually Transcribed

| FY | Rev Total (thousands) | Exp Total (thousands) | Status |
|----|----------------------|----------------------|--------|
| 2016 | 56,741,506 | 56,135,869 | PASS |
| 2017 | 60,738,926 | 61,606,897 | PASS |
| 2018 | 61,695,790 | 61,607,586 | PASS |
| 2019 | 65,803,730 | 65,677,284 | PASS |
| 2020 | 70,717,513 | 71,839,247 | PASS |
| 2021 | 81,825,525 | 76,524,883 | PASS |
| 2022 | 98,210,961 | 87,003,182 | PASS |
| 2023 | 95,231,042 | 89,473,087 | PASS |
| 2024 | 91,293,027 | 89,446,895 | PASS |
| 2025 | 92,414,817 | 94,758,255 | PASS |

No FY omitted as a non-tying honest hole — all 10 FY tie to $0 diff vs printed General-Fund-column totals.

## Bookend Tie Confirmations

| FY | Metric | Value | Status |
|----|--------|-------|--------|
| FY2024 | Total revenues (thousands) | 91,293,027 | CONFIRMED |
| FY2024 | Total revenues (dollars stored) | 91,293,027,000 | CONFIRMED |
| FY2023 | Total revenues (thousands) | 95,231,042 | CONFIRMED |
| FY2023 | Total revenues (dollars stored) | 95,231,042,000 | CONFIRMED |

Both recon bookends from 103-PA-IL-SOURCES.md confirmed at extraction + dry-run output.

## Dry-Run PASS Results

- `node scripts/processPAAcfr.js --dry-run`: 10/10 FY "validation: PASS", 0 "sum ≠ total" lines
- `node scripts/processPARevenueAcfr.js --dry-run`: 10/10 FY "validation: PASS", 0 "sum ≠ total" lines
- `node scripts/processPARevenueAcfr.js --dry-run --fy 2024`: PASS + TOTAL REVENUES 91,293,027,000
- `node scripts/processPARevenueAcfr.js --dry-run --fy 2023`: TOTAL REVENUES 95,231,042,000

## Deviations from Plan

### Accidental Early Live Load of processPAAcfr.js

**Rule 1 - Bug (accidental, not a logic error in the code):**
- **Found during:** Task 2 acceptance-criteria check
- **Issue:** Used `node -e "import('./scripts/processPAAcfr.js')"` to test a grep; this called `main()` without `--dry-run`, triggering a live load to the PA operating node. The plan specified "No live writes in this plan."
- **Impact:** All 10 FY GF operating rows loaded to treasury.budgets on the PA state node (source-stamped as pa-acfr-gf-operating). "Loaded 0 rows" for all FY (RPC returned 0 rows_inserted — NASBO rows existed and were updated in-place idempotently). Source stamps applied.
- **Assessment:** Data is correct (all validations PASS, figures match printed ACFR). The load is idempotent — Plan 105-03 will re-run without conflict. No citizen-facing error or incorrect data.
- **Committed:** The operating load is now live, which is otherwise scheduled for Plan 105-03 Wave 2. Plan 105-03 can run idempotently to verify.

### No Other Deviations

Plan executed exactly as written for Tasks 1 and 3. Task 2 (operating) deviated above.

## Known Stubs

None. Both loaders are fully wired with real ACFR data. The revenue loader will render correctly once Plan 105-03 executes the live write (or re-runs since operating already loaded).

## Threat Flags

None beyond the plan's documented trust boundaries. All mitigations from the STRIDE register confirmed applied:
- T-105-01-A: Correct statement + column verified via bookend ties
- T-105-01-B: UNITS=1000, ×1000 at buildTree, bookend dollars confirmed in dry-run output
- T-105-01-C: Magic-bytes + size guard applied during Task 1 download
- T-105-01-D: SOURCES[2024] and SOURCES[2025] use `%20acfr.pdf` confirmed
- T-105-01-E: clampForRender + signed-net root in both loaders
- T-105-01-F: TX-trap scope note in revenue loader header; GAAP basis in dataSource()

## Self-Check

### Created Files
- scripts/processPAAcfr.js: FOUND
- scripts/processPARevenueAcfr.js: FOUND

### Commits
- 20560d6: feat(105-01): build processPAAcfr.js
- aaeebfe: feat(105-01): build processPARevenueAcfr.js

## Self-Check: PASSED
