---
status: complete
phase: 35-ca-state-3-level-icicle-pilot
source:
  - .planning/phases/35-ca-state-3-level-icicle-pilot/35-02-SUMMARY.md
  - .planning/phases/35-ca-state-3-level-icicle-pilot/35-03-SUMMARY.md
started: 2026-06-08T00:00:00Z
updated: 2026-06-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. CA 3-level icicle renders
expected: |
  Open https://treasurytracker.empowered.vote and navigate to California (State Budget).
  The icicle chart should show 3 levels of depth:
    - Level 1 (top): DOF Agency segments (12 agencies, e.g. "K-12 Education", "Health and Human Services")
    - Level 2 (middle): Department segments nested under each Agency
    - Level 3 (bottom): Function segments (Local Assistance, State Operations, Capital Outlay) nested under each Department
  Previously this chart only showed 2 levels — the new Function level at the bottom is the key change.
result: pass

### 2. Function-level drill opens line items
expected: |
  With California open, click into a DOF Agency, then click a Department, then click a Function node
  (e.g. "Local Assistance" or "State Operations"). The LineItemsTable should open showing the individual
  budget line items for that Function. The line items should correspond to the specific
  Agency → Department → Function path you drilled into.
result: pass

### 3. All 5 fiscal years show 3-level structure
expected: |
  With California open, use the fiscal year selector to switch between FY2022, FY2023, FY2024,
  FY2025, and FY2026. Each year should display the 3-level icicle (Agency → Department → Function).
  The FY2026 total should be approximately $228 billion. Earlier years should be in the
  $195B–$234B range.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
