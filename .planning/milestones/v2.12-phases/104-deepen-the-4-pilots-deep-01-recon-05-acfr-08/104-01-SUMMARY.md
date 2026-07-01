---
phase: 104-deepen-the-4-pilots
plan: "01"
subsystem: data-loaders
tags: [ny, acfr, deepening, dry-run, gaap, millions]
dependency_graph:
  requires: [103-01, 103-02, 103-03]
  provides: [ny-acfr-fy2003-fy2014-dry-run-verified]
  affects: [scripts/processNYAcfr.js, scripts/processNYRevenueAcfr.js]
tech_stack:
  added: []
  patterns: [pdftotext-table-extraction, exact-tie-validate, never-overwrite-deepening]
key_files:
  created:
    - .planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-DEEPEN-GAPLOG.md
  modified:
    - scripts/processNYAcfr.js
    - scripts/processNYRevenueAcfr.js
decisions:
  - "FY2003-FY2012 use older ACFR category names (Social services / Mental hygiene / etc.); FY2013-FY2014 use newer names matching FY2015+ (Education / Public health / etc.) — verbatim ACFR, no normalization"
  - "All 12 added years tied exactly to 0 diff — zero gaps in the FY2003-FY2014 window"
  - "No negative GF categories found in any FY2003-FY2014 year (P2 clamp wired but not triggered)"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  files_changed: 3
---

# Phase 104 Plan 01: NY ACFR FY2003-FY2014 Deepen + Dry-Run Summary

NY General Fund operating + revenue loaders extended backward 12 years to FY2003-FY2024 with exact-tie validation on all added years and zero production DB writes.

## What Was Built

Extended `scripts/processNYAcfr.js` (operating) and `scripts/processNYRevenueAcfr.js` (revenue) from FY2015-FY2024 to FY2003-FY2024 by:

1. Prepending FY2003-FY2014 to the SOURCES year array in both loaders (nyUrl() unchanged — fy<=2021 branch already emits `comprehensive-annual-financial-report-{YYYY}.pdf` correctly).
2. Adding 12 verbatim-transcribed EXPENDITURES blocks to processNYAcfr.js and 12 REVENUE blocks to processNYRevenueAcfr.js, each tied exactly to the printed ACFR General-column total.
3. Extending main() years array and srcPayload.fiscal_years in both loaders to include 2003-2014.
4. Creating 104-DEEPEN-GAPLOG.md recording per-FY dispositions (all LOADED, 0 gaps).

## Per-FY Tie Results (General-column, millions)

| FY | Revenue Total | Exp Total | Rev Diff | Exp Diff | Status |
|----|--------------|-----------|----------|----------|--------|
| FY2003 | 29,250M = $29,250,000,000 | 40,910M = $40,910,000,000 | 0 | 0 | PASS (bookend ✓) |
| FY2004 | 32,489M = $32,489,000,000 | 43,386M = $43,386,000,000 | 0 | 0 | PASS |
| FY2005 | 35,929M = $35,929,000,000 | 45,104M = $45,104,000,000 | 0 | 0 | PASS |
| FY2006 | 41,091M = $41,091,000,000 | 48,321M = $48,321,000,000 | 0 | 0 | PASS |
| FY2007 | 44,259M = $44,259,000,000 | 51,936M = $51,936,000,000 | 0 | 0 | PASS |
| FY2008 | 45,423M = $45,423,000,000 | 54,540M = $54,540,000,000 | 0 | 0 | PASS |
| FY2009 | 40,228M = $40,228,000,000 | 56,630M = $56,630,000,000 | 0 | 0 | PASS |
| FY2010 | 44,883M = $44,883,000,000 | 54,129M = $54,129,000,000 | 0 | 0 | PASS |
| FY2011 | 47,069M = $47,069,000,000 | 55,090M = $55,090,000,000 | 0 | 0 | PASS |
| FY2012 | 48,344M = $48,344,000,000 | 57,911M = $57,911,000,000 | 0 | 0 | PASS |
| FY2013 | 50,798M = $50,798,000,000 | 59,796M = $59,796,000,000 | 0 | 0 | PASS |
| FY2014 | 48,459M = $48,459,000,000 | 59,782M = $59,782,000,000 | 0 | 0 | PASS |

All 12 added years: 0-diff exact tie. **Total added years retained: 12/12. Gaps: 0.**

## UNITS Confirmation

UNITS = 1_000_000 untouched. All revenue/expenditure totals stored as printed-millions × 1,000,000. FY2003 revenue Total = 29,250 (printed millions) × 1,000,000 = $29,250,000,000 ✓

## P2 Clamp (ACFR-08)

No negative General Fund revenue or expenditure categories found in any FY2003-FY2014 year. The `clampForRender()` function is wired in processNYRevenueAcfr.js and will fire if any future restatement introduces a negative line; no label rewrites needed for the added years.

## Category Format Note

FY2003-FY2012 use the older ACFR expenditure category names:
- Local assistance grants: Social services, Education, Mental hygiene, General purpose, Health and environment, Transportation, Criminal justice, Miscellaneous
- Departmental operations: Personal service, Non-personal service, Pension contribution(s), Other fringe benefits

FY2013-FY2014 shifted to the newer format matching FY2015+:
- Local assistance: Education, Public health, Public welfare, Public safety, Transportation, Environment and recreation, Support and regulate business, General government
- State operations: Personal service, Non-personal service, Pension contributions, Other fringe benefits

All names are verbatim from the printed ACFR statement (no normalization).

## Skipped Years

None. All 12 FY2003-FY2014 PDFs resolved (HTTP 200, 1.1-4.0 MB), cleanly extracted with `pdftotext -table`, and tied exactly. See 104-DEEPEN-GAPLOG.md.

## Dry-Run Verification

Both loaders confirmed clean:
- `node scripts/processNYAcfr.js --dry-run` — 22 years (FY2003-FY2024) all PASS
- `node scripts/processNYRevenueAcfr.js --dry-run` — 22 years (FY2003-FY2024) all PASS
- Zero DB writes (no Supabase RPC calls in dry-run mode)
- FY2015-FY2024 entries unchanged (diff shows only additions)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in a single pass since the PDF download, extraction, and transcription naturally preceded the code changes.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 6ed8c51 | feat(104-01): extend NY ACFR loaders to FY2003-FY2024 (12 added years) |
| Task 2 | 8402ff9 | feat(104-01): transcribe + tie-check FY2003-FY2014 NY ACFR GF blocks; zero gaps |

## Self-Check: PASSED

- [x] scripts/processNYAcfr.js contains "2003" ✓
- [x] scripts/processNYRevenueAcfr.js contains "2003" ✓
- [x] scripts/processNYRevenueAcfr.js contains "clampForRender" ✓
- [x] 104-DEEPEN-GAPLOG.md exists ✓
- [x] 104-DEEPEN-GAPLOG.md contains "NY" ✓
- [x] Both --dry-run passes ✓
- [x] FY2003 revenue = $29,250,000,000 ✓
- [x] Commits 6ed8c51 and 8402ff9 exist ✓
- [x] No DB writes (dry-run only) ✓
