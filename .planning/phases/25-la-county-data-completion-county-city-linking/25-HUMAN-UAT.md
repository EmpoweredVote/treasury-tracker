---
status: partial
phase: 25-la-county-data-completion-county-city-linking
source: [25-VERIFICATION.md]
started: 2026-06-02T00:00:00Z
updated: 2026-06-02T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. County breadcrumb chip renders on LA city page and navigates to LA County
expected: Navigating to any LA County city (e.g. Santa Monica, Pasadena) shows a "Los Angeles County →" chip in the breadcrumb bar; clicking it navigates to the LA County entity page
result: [pending]

### 2. CitiesInCountyPanel renders on county page with correct Available now / Coming soon split
expected: The LA County entity page shows a "Cities in Los Angeles County" panel below the budget data; cities with budget data appear as clickable buttons ("Available now"), others as non-clickable spans ("Coming soon")
result: [pending]

### 3. San Francisco shows no county chip
expected: Navigating to San Francisco shows NO county breadcrumb chip (SF has county_id = null as a consolidated city-county)
result: [pending]

### 4. LA County per-capita display uses correct ~10M population
expected: The PlainLanguageSummary or per-capita figures for LA County reflect population 10,014,009 (2020 Census), not 0 or an incorrect value
result: [pending]

### 5. ev-accounts-api returns county_id in municipality response
expected: The API endpoint returns county_id as a non-null UUID for LA County cities; this is the critical path — if absent, the breadcrumb chip will never render regardless of frontend code
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
