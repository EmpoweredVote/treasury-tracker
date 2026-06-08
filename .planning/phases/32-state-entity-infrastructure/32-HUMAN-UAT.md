---
status: partial
phase: 32-state-entity-infrastructure
source: [32-VERIFICATION.md]
started: 2026-06-06T17:30:00Z
updated: 2026-06-08T13:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Non-state displayName regression
expected: Existing cities still show "Name, ST" format (e.g., "Dallas, TX") in the EntitySwitcher button when selected
result: pass

### 2. STATE GOVERNMENTS visual section
expected: When a state entity exists in the municipalities list, a sticky "STATE GOVERNMENTS" header appears above all state/city groups in the dropdown
result: pass

### 3. City placement regression
expected: Existing cities remain in their state groups (CALIFORNIA, TEXAS, OREGON, etc.) and do NOT appear under STATE GOVERNMENTS
result: issue
reported: "Carver, MA appears in the EntitySwitcher dropdown but shows 'unable to load budget data' when selected — a municipality with no budget data is visible and selectable"
severity: major

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "All municipalities visible in the EntitySwitcher should have loadable budget data, or should not appear in the list"
  status: failed
  reason: "User reported: Carver, MA appears in the EntitySwitcher dropdown but shows 'unable to load budget data' when selected"
  severity: major
  test: 3
  root_cause: "Municipality was seeded via scrapeMaDLS.js --seed without budget data ever being loaded via --load. Backend GET /api/treasury/cities returns all municipalities regardless of data presence. EntitySwitcher does not filter on available_datasets.length."
  artifacts:
    - "src/data/dataLoader.ts (listMunicipalities — no data filter)"
    - "src/components/EntitySwitcher.tsx (filtered list — no available_datasets guard)"
    - "scripts/scrapeMaDLS.js (seed/load decoupling)"
  missing:
    - "Filter in EntitySwitcher or API to exclude municipalities with empty available_datasets"
