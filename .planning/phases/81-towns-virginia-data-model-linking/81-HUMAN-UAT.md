---
status: partial
phase: 81-towns-virginia-data-model-linking
source: [81-VERIFICATION.md]
started: 2026-06-22
updated: 2026-06-22
---

## Current Test

[awaiting human testing]

## Tests

### 1. Virginia picker and hub navigation
expected: Virginia appears in the "State Governments" section of the entity picker (even though it has no APA budget data). Selecting it reaches the Virginia hub page, which shows a Counties panel (93 filterable counties, filter box present) and a Cities/Towns panel. Clicking a county navigates to that county's page.
result: [pending]

### 2. Town breadcrumb + per-capita
expected: Navigating to a town (e.g. Leesburg) shows a US → Virginia → Loudoun County → Leesburg breadcrumb, the town appears in Loudoun County's localities panel, and per-capita figures render (Leesburg FY2024 operating ≈ $1,399/resident).
result: [pending]

### 3. WR-05 — legacy budget dashboard on Virginia hub (product decision)
expected: The Virginia state node carries 10 pre-v2.7 General Fund budget rows (FY2022-2026, source_url=null) that pre-date this milestone. Because of these, the Virginia hub page renders the budget dashboard (PlainLanguageSummary/DatasetTabs) rather than a directory-only view. Decide: (a) cosmetically acceptable for now and defer to Phase 83's source-chain audit, or (b) extend the `isCountyDirectoryOnly` guard to dataset-less/legacy state hubs before Phase 82.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
