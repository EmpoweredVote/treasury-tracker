---
status: complete
phase: 33-ca-state-budget-data
source:
  - .planning/phases/33-ca-state-budget-data/33-01-SUMMARY.md
  - .planning/phases/33-ca-state-budget-data/33-02-SUMMARY.md
  - .planning/phases/33-ca-state-budget-data/33-03-SUMMARY.md
started: 2026-06-07T00:00:00Z
updated: 2026-06-07T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. California visible in landing page grid with State Budget badge
expected: Open https://treasurytracker.empowered.vote. In the city/state grid, find the California section. California should appear pinned at the top of that section with a "State Budget" badge (distinct from regular city tiles).
result: pass

### 2. California budget data — ~$228B for FY2025-26
expected: Click the California tile to open the entity view. On the Money Out tab (or default view), the total should show approximately $228 billion for FY2025-26. The figure should be in the $220B–$235B range.
result: pass

### 3. Per-capita figure ~$5,782 for FY2025-26
expected: On the California entity view, a per-capita figure should be visible near the total. It should show approximately $5,782 per resident (±$100 tolerance).
result: pass

### 4. Year selector shows FY2022 through FY2026
expected: On the California entity view, a year selector should offer at least FY2022, FY2023, FY2024, FY2025, and FY2026 as selectable years. Switching years should update the displayed total.
result: pass

### 5. Enrichment descriptions use state-level language
expected: Open any budget category on the California entity view (e.g., Health and Human Services, Education). The enrichment description should reference state-level programs like Medi-Cal, General Fund, or DOF agency groupings — NOT city council, mayor, or municipal language.
result: pass

### 6. State entity does not appear as "Your City" preloaded card
expected: If you have a California address saved in the app (or can set one), the preloaded "Your City" card on the landing page should NOT show California the state entity. It should either show your actual city (e.g., Los Angeles, San Francisco) or no preloaded card. The California state budget tile belongs in the grid, not as a personal city card. (If you have no CA address cookie, skip this test.)
result: pass
notes: CA address in account correctly resolves to Los Angeles City, not the California state entity. WR-03 fix confirmed working.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
