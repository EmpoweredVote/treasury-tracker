---
phase: 96-remaining-states-sgfs-04
plan: "01"
subsystem: state-gf-loader
tags: [nasbo, state-gf, provenance, taxonomy, tests]
dependency_graph:
  requires: []
  provides: [2025-SER-provenance, fy-end-lookup-AL-MI-TX-NY, alabama-checksum-tests]
  affects: [scripts/loadStateGF.mjs, scripts/loadStateGF.test.mjs]
tech_stack:
  added: []
  patterns: [nasbo-6-function-taxonomy, fy-end-mmdd-lookup]
key_files:
  modified:
    - scripts/loadStateGF.mjs
    - scripts/loadStateGF.test.mjs
decisions:
  - "2025 SER replaces 2024 SER as the provenance source; FY2023+FY2024 actuals window"
  - "6-function taxonomy (PA merged into All Other) is the structure for all Phase 96 cohort entries"
  - "GA FY2023 entry remains unchanged (2024 SER, 7-function)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 96 Plan 01: 2025 SER Provenance + FY-End Expansion + Alabama Tests Summary

Infrastructure update to `loadStateGF.mjs` pointing it at the 2025 NASBO SER edition (FY2023+FY2024 actuals), expanding FY_END_MMDD for 4 non-June-30 cohort states, documenting the 6-function taxonomy, and locking it with offline Alabama checksum tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update NASBO provenance + FY_END_MMDD + taxonomy comment | fc2bc52 | scripts/loadStateGF.mjs |
| 2 | Add Alabama FY2023+FY2024 checksum tests | 5e429a3 | scripts/loadStateGF.test.mjs |

## What Was Built

### Task 1 — scripts/loadStateGF.mjs

**NASBO_SER updated:**
- `url` now points at `2025_NASBO_State_Expenditure_Report_S.pdf` (2025 SER); the 2024 SER URL is gone
- `edition` = `"2025 State Expenditure Report (actual FY2023, FY2024)"`

**FY_END_MMDD expanded from 1 to 5 keys:**
```
GA: '06-30'  (existing)
AL: '09-30'  (Oct 1 → Sep 30)
MI: '09-30'  (Oct 1 → Sep 30)
TX: '08-31'  (Sep 1 → Aug 31)
NY: '03-31'  (Apr 1 → Mar 31)
```

**Taxonomy comment added** documenting the 2025 SER 6-function structure:
- Elementary & Secondary Education, Higher Education, Medicaid, Corrections, Transportation, All Other
- Notes that Public Assistance was folded into All Other starting with the 2025 SER (NASBO 2025 SER p.490)
- Notes that GA FY2023 (2024 SER) retains 7-function structure — do NOT modify

**GA STATES entry: byte-unchanged** — still 7 categories including `{ name: 'Public Assistance', total: 0 }`.

**Locked helpers unchanged:** `buildOperatingTree`, `validateAgainstControl`, `dataSourceLabel`, `sourceDate`, the RPC call, the post-RPC source-stamp UPDATE.

### Task 2 — scripts/loadStateGF.test.mjs

Four new tests added:

| Test | Result |
|------|--------|
| validateAgainstControl: Alabama FY2023 — 0-diff checksum | PASS |
| validateAgainstControl: Alabama FY2024 — 0-diff checksum | PASS |
| sourceDate: AL FY-end = 09-30 (non-June-30) | PASS |
| Alabama 6-function taxonomy has no Public Assistance line | PASS |

Alabama figures (inline, not from STATES — Alabama added in Plan 03):
- FY2023: controlTotalGF = 13,764,000,000; sum = 13,764,000,000; diff = 0 (0.000%)
- FY2024: controlTotalGF = 13,511,000,000; sum = 13,511,000,000; diff = 0 (0.000%)

Full suite result: **14/14 pass** (10 existing + 4 new).

## Test Run Result

```
node --test scripts/loadStateGF.test.mjs
tests 14 | pass 14 | fail 0
```

## Deviations from Plan

None — plan executed exactly as written.

The taxonomy comment update also touched the file header (line about "7 functional categories" in the Basis description, and the inline STATES comment) to be consistent with the 6-function structure documentation. This is a strictly additive comment update — no behavior changed.

## Known Stubs

None. This plan is infrastructure only; no data entries, no DB writes.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Constants updated; no new trust boundaries.

## Self-Check

- [x] `scripts/loadStateGF.mjs` exists and contains `2025_NASBO_State_Expenditure_Report_S.pdf`
- [x] `scripts/loadStateGF.test.mjs` exists and contains "Alabama"
- [x] Commits fc2bc52 and 5e429a3 exist in git log
- [x] `node --test scripts/loadStateGF.test.mjs` → 14/14 pass
- [x] FY_END_MMDD has exactly GA/AL/MI/TX/NY (5 keys)
- [x] GA STATES entry unchanged (7 categories, Public Assistance = 0)
- [x] 2024 SER URL absent from loadStateGF.mjs

## Self-Check: PASSED
