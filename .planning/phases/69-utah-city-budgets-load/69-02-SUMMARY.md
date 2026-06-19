# 69-02 SUMMARY — 9-city sweep + Provo reconciliation (UCITY-01/02)

**Status:** ✅ Complete. All 10 Utah cities now have operating + revenue for FY2014–FY2025, all-funds, fund1→org1→cat1 tree, durably sourced. Provo reconciled (penny-exact vs the independent 68-03 baseline) + operator app spot-check approved. $0.

## Task 1 — 9-city op+rev sweep (UCITY-01/02) ✅

Ran the refactored 69-01 loader (unchanged) for the 9 non-canary cities, all 12 complete FYs (FY2014–FY2025; FY2026 excluded, D-69-04), default types EX,RV:
`Layton City, Lehi City, Ogden City, Orem City, Provo City, Sandy City, St. George City, West Jordan City, West Valley City`. Exact `entity_name` match (no LIKE; decoys like North Ogden / Washington Terrace avoided).

Ogden dry-run pre-check confirmed the fund tree (7 fund-type groups: General Fund, Enterprise, Special Revenue, Capital Projects, Internal Service, Trust & Agency, Permanent). No errors, no SKIPs, no missing-data, no auth failures across the sweep.

DB verification (production `treasury.budgets`) — all 10 UT cities (SLC + these 9):
- **Every city: operating=12, revenue=12** rows (FY2014–FY2025, no gaps).
- **0** rows with wrong/absent source — all `data_source = 'Transparent Utah'`, non-null `source_url`.
- **0** FY2026 rows anywhere.
- Never-overwrite guard active; all cities were all-new (no different-source SKIPs).

## Task 2 — 10-city app spot-check + Provo ACFR (SC#1, SC#4) ✅ approved

**Provo FY2024 cross-check vs the 68-03 dry-run baseline — penny-exact:**
- operating = **$346,484,274.68** = baseline $346,484,274.68 ✅
- revenue   = **$285,684,200.65** = baseline $285,684,200.65 ✅

This proves the D-69-01 refactor changed only the tree *shape*, not the *aggregation* (totals are column-independent). Provo's year-over-year totals are smooth ($213M–$346M operating), confirming SLC's FY-to-FY volatility (69-01) was SLC-specific (airport enterprise funds + numbered/unnumbered fund labels), not a loader defect.

Operator confirmed all 10 cities render in the live app under "Utah" with fund-topped operating icicles, revenue tabs, and Transparent Utah source chips, and that Provo reconciles within explainable tolerance of its published ACFR.

## Requirements

- **UCITY-01 (operating):** satisfied for all 10 cities, FY2014–FY2025, all-funds, durably sourced. Per-capita pending population (69-03).
- **UCITY-02 (revenue):** satisfied for all 10 cities, FY2014–FY2025, durably sourced.
- **SC#4 (≥2-city reconciliation):** SLC (69-01) + Provo (here) both reconciled.

## Next

69-03: build `scripts/loadUTPopulation.js` and set a single Census vintage population + `population_year` for all 10 cities (enables per-capita, SC#2). All 10 municipality rows now exist.
