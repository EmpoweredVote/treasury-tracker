---
status: complete
phase: 24-los-angeles-data-refresh
source:
  - 24-01-SUMMARY.md
  - 24-02-SUMMARY.md
  - 24-03-SUMMARY.md
started: 2026-06-03T00:00:00Z
updated: 2026-06-03T00:01:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. LA Revenue FY2025 Total Corrected
expected: Navigate to Los Angeles → Money In → FY2025. Total revenue ≈ $10.2B (previously ~$44.6B due to enterprise-fund actuals bleed). Enterprise-fund departments (Water & Power, Airports, Harbor) should not inflate the figure.
result: pass

### 2. LA Revenue FY2026 Total
expected: Navigate to Los Angeles → Money In → FY2026. Total revenue ≈ $10.1B. No enterprise-fund inflation.
result: pass

### 3. LA Operating Budget FY2025 Approved Total
expected: Navigate to Los Angeles → Money Out (operating budget) → FY2025. Approved total ≈ $19.86B. Enterprise-fund rows with zero adopted amounts are excluded from the count.
result: issue
reported: "Money Out tile shows $9.4B, not $19.86B. Money In shows $10.2B — together ~$19.6B ≈ the DB total, suggesting the summary tile is not reflecting the full loaded budget."
severity: major

### 4. LA Operating Budget 10-Year History Available
expected: Navigate to Los Angeles → operating budget. Fiscal years FY2017 through FY2026 should all be selectable/available. FY2017 should show ~$13.4B approved; FY2018 ~$14.2B. Historical years that previously had no data (FY2017–2020) should now load department-level category trees.
result: pass

### 5. Plain Language Summary Shows Enrichment Description
expected: Navigate to Los Angeles city view. In the Plain Language Summary section, below the bold top-spending-category headline, a paragraph of 2-3 sentences in muted italic text should appear providing plain-language context about that department. The paragraph should be distinct prose (not a repeat of the short headline text).
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Money Out (operating budget) tile for LA FY2025 should show ≈ $19.86B approved total after enterprise-fund exclusion fix"
  status: failed
  reason: "User reported: Money Out tile shows $9.4B, not $19.86B. DB sum of budget_categories = $19.86B but summary tile does not reflect it."
  severity: major
  test: 3
  artifacts: []
  missing: []
