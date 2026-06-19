---
phase: 69
slug: utah-city-budgets-load
status: passed
verified: 2026-06-19
method: goal-backward, live DB verification
---

# Phase 69 Verification — Utah City Budgets Load

**Goal:** All 10 Utah cities show operating + revenue for every available fiscal year (all-funds) from Transparent Utah — every figure sourced, with population for per-capita.

**Verdict: PASSED.** All 4 success criteria proven against the live production `treasury.budgets` / `treasury.municipalities` tables.

## Success Criteria

### SC#1 — op+rev for all available FYs, every row sourced ✅
Live query: each of the 10 cities (`Layton City, Lehi City, Ogden City, Orem City, Provo City, Salt Lake City, Sandy City, St. George City, West Jordan City, West Valley City`) has **operating=12, revenue=12** rows for FY2014–FY2025 (no gaps), **0** FY2026 rows, and **0** rows with a wrong/absent source — all `data_source='Transparent Utah'`, `source_url='https://transparent.utah.gov'`. Tree is the D-69-01 `fund1→org1→cat1` 3-level icicle (verified in dry-runs: SLC funds, Ogden fund-type groups).

### SC#2 — per-capita renders (Census population + source year) ✅
Live query: all 10 cities have `population > 0 AND population_year = 2024` (Census Population Estimates vintage 2024, `sub-est2024_49.csv`). 10/10.

### SC#3 — never-overwrite guard leaves custom-source rows unchanged ✅
`findConflictingBudget` guard stayed ON across every load. All 10 cities were all-new (Transparent Utah) — zero different-source SKIPs occurred, and zero pre-existing custom-source rows existed to disturb. Guard logic unit-tested (`neverOverwriteDecision`) and exercised live.

### SC#4 — totals spot-checked for ≥2 cities ✅
- **SLC** (69-01): all-funds operating totals reconciled against the published ACFR — operator-approved (no order-of-magnitude discrepancy; FY-to-FY volatility explained by airport enterprise funds + numbered/unnumbered fund labels, documented).
- **Provo** (69-02): FY2024 operating **$346,484,274.68** and revenue **$285,684,200.65** match the independent 68-03 BigQuery dry-run baseline **penny-exact** (proving the fund-tree refactor changed shape, not aggregation), plus operator ACFR spot-check approved.

## Requirements
- **UCITY-01** (operating + per-capita): satisfied — operating loaded for all 10 cities FY2014–FY2025 + Census population set.
- **UCITY-02** (revenue, durably sourced): satisfied — revenue loaded for all 10 cities FY2014–FY2025, Transparent Utah attribution.

## Locked-decision fidelity
- **D-69-01** fund1→org1→cat1 tree — shipped (`GROUP BY fund1, org1, cat1`, 24/24 unit tests).
- **D-69-02** all-funds basis, no gov/enterprise split — shipped.
- **D-69-03** single Census vintage + population_year, never lower non-zero to 0 — shipped (loader guard).
- **D-69-04** FY2014–FY2025, exclude FY2026, SLC canary first — shipped (0 FY2026 rows).

## Deviations
- **69-03 name mapping:** plan interface assumed stripped DB names (`Layton`); actual DB names carry the full entity_name "City" suffix (`Layton City`). Corrected in `loadUTPopulation.js` via a `DB_NAME` map; documented in 69-03-SUMMARY.md and as a Phase 70+ note. No data impact.

## Checkpoints
Both human-verify ACFR/app checkpoints (69-01 SLC, 69-02 10-city + Provo) approved by the operator.
