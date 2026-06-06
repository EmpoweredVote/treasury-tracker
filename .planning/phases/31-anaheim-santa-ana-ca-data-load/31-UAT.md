---
status: complete
phase: 31-anaheim-santa-ana-ca-data-load
source:
  - .planning/phases/31-anaheim-santa-ana-ca-data-load/31-01-SUMMARY.md
  - .planning/phases/31-anaheim-santa-ana-ca-data-load/31-02-SUMMARY.md
  - .planning/phases/31-anaheim-santa-ana-ca-data-load/31-03-SUMMARY.md
  - .planning/phases/31-anaheim-santa-ana-ca-data-load/31-04-SUMMARY.md
started: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. City Picker — Anaheim and Santa Ana appear under California
expected: Open https://treasurytracker.empowered.vote and browse the city/municipality picker. Both "Anaheim" and "Santa Ana" should appear listed under California (CA).
result: pass

### 2. Anaheim operating budget — correct total and department count
expected: Select Anaheim, CA and view the operating budget for FY2025. Total should be approximately $491M ($490,937,159) with 13 departments visible. FY2026 should show approximately $530M ($530,352,785) with 13 departments.
result: pass

### 3. Santa Ana operating budget — correct total and department count
expected: Select Santa Ana, CA and view the operating budget for FY2025. Total should be approximately $407M ($406,773,060) with 16 departments visible. FY2026 should show approximately $424M ($424,230,150) with 16 departments.
result: pass

### 4. Anaheim revenue / Money In tab
expected: On the Anaheim city view, open the Revenue or "Money In" tab. FY2025 should show approximately $649M ($649,457,438) across 12 categories. FY2026 should show approximately $645M ($644,677,022) across 12 categories.
result: pass

### 5. Santa Ana revenue / Money In tab
expected: On the Santa Ana city view, open the Revenue or "Money In" tab. FY2025 should show approximately $407M ($406,527,340) across 9 categories. FY2026 should show approximately $414M ($413,790,950) across 10 categories.
result: pass

### 6. Per-capita figures visible for both cities
expected: On each city's view (Anaheim and Santa Ana), a per-capita ($/resident) figure should be displayed alongside the budget totals. Anaheim population is 344,000; Santa Ana population is 312,000.
result: pass

### 7. Enrichment descriptions visible for top categories
expected: On the Anaheim and Santa Ana city views, top spending departments/categories (e.g., Police, Fire) should display plain-language AI-generated descriptions. Anaheim has 25 enriched categories; Santa Ana has 26.
result: pass

## Summary

total: 7
passed: 7
issues: 0
skipped: 0
pending: 0

## Gaps

[none yet]
