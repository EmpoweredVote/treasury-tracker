---
status: complete
phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr
source: [23-01-SUMMARY.md, 23-02-SUMMARY.md, 23-03-SUMMARY.md, 23-04-SUMMARY.md]
started: 2026-06-03T00:00:00Z
updated: 2026-06-03T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Portland Budget Tab — All Funds Headline
expected: Select Portland, OR. Budget tab (FY2026) headline shows ~$8.6B All Funds Requirements total. A gap-explanation paragraph appears below the main summary sentence showing the All Funds total, the departmental subset, and the remainder.
result: pass

### 2. Gresham Budget Tab — All Funds Headline
expected: Select Gresham, OR. Budget tab (FY2026) headline shows ~$567M (non-operating All Funds Requirements), not ~$331M (operating departmental only). Gap-explanation paragraph visible.
result: pass

### 3. Troutdale Budget Tab — All Funds Headline
expected: Select Troutdale, OR. Budget tab (FY2026) headline shows ~$81M (All Funds Requirements). Gap-explanation paragraph visible.
result: pass
note: "Gap-explanation renders correctly. User flagged that In/Out tab sort order differs from LA — expects Money Out/Money In ordering consistent with LA cities."

### 4. All Funds NOT a Selectable Tab Card
expected: Select any Oregon city. The "All Funds Requirements" dataset does NOT appear as a clickable tab card alongside Budget / Money In. Only the existing tab types (Budget, Money In, etc.) are shown as selectable options.
result: pass

### 5. TX/CA Cities Unchanged — No Gap Label
expected: Select Dallas, TX or Los Angeles, CA. Budget tab shows the normal departmental total with NO gap-explanation paragraph below the summary sentence. The headline total is the operating budget total, same as before Phase 23.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
