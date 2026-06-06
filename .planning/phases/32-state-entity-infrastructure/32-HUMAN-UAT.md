---
status: partial
phase: 32-state-entity-infrastructure
source: [32-VERIFICATION.md]
started: 2026-06-06T17:30:00Z
updated: 2026-06-06T17:30:00Z
---

## Current Test

[awaiting human testing — best performed after Phase 33 inserts the CA state municipality row]

## Tests

### 1. Non-state displayName regression
expected: Existing cities still show "Name, ST" format (e.g., "Dallas, TX") in the EntitySwitcher button when selected
result: [pending]

### 2. STATE GOVERNMENTS visual section
expected: When a state entity exists in the municipalities list, a sticky "STATE GOVERNMENTS" header appears above all state/city groups in the dropdown
result: [pending]

### 3. City placement regression
expected: Existing cities remain in their state groups (CALIFORNIA, TEXAS, OREGON, etc.) and do NOT appear under STATE GOVERNMENTS
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
