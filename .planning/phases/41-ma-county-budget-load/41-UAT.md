---
status: complete
phase: 41-ma-county-budget-load
source:
  - .planning/phases/41-ma-county-budget-load/41-01-SUMMARY.md
  - .planning/phases/41-ma-county-budget-load/41-02-SUMMARY.md
started: 2026-06-11T19:00:00Z
updated: 2026-06-11T19:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Plymouth County — Money Out tab active
expected: Open Plymouth County page in the app. Money Out tab is present and shows FY2025 operating budget data (~$11.87M with department line items).
result: pass

### 2. Barnstable County — Money Out tab active
expected: Open Barnstable County page. Money Out tab is present and shows FY2025 operating budget data (~$24.75M). Categories: Salaries, Operating Expenses, Fringe Benefits, Capital.
result: pass

### 3. Norfolk County — Money Out tab active
expected: Open Norfolk County page. Money Out tab is present and shows FY2026 operating budget data (~$37.82M, includes Agricultural High School). Department rows visible.
result: pass

### 4. Bristol County — Money Out tab active
expected: Open Bristol County page. Money Out tab is present and shows FY2025 operating budget data (~$34.39M, includes Agricultural School ~$19.1M). Department rows visible.
result: pass

### 5. Dukes County — Money Out tab active
expected: Open Dukes County page. Money Out tab is present and shows FY2024 operating budget data (~$2.02M). Department rows for County Operations + Registry of Deeds.
result: pass

### 6. EntitySwitcher — counties under Massachusetts
expected: Open the entity switcher in the app. "Massachusetts" should have a "Counties" sub-section (or similar grouping) listing all 5 MA counties: Barnstable, Bristol, Dukes, Norfolk, Plymouth.
result: pass

### 7. City bleed check — MA city has no county budget data
expected: Open a MA city page (e.g., Boston). The city's own budget data should display normally. No county-level budget entries should appear mixed into the city's data.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
