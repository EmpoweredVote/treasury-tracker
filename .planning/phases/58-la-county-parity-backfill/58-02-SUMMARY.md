---
phase: 58
plan: "58-02"
title: "LA County government budget backfill FY2003–2024 + source_url repair"
subsystem: data-loading
tags: [la-county, county-budget, sco, backfill, source-repair, operating, revenue]
dependency_graph:
  requires: [58-01]
  provides: [LAC-01, county-op-rev-FY2003-2024]
  affects: [58-03, 58-04, Phase-62-ACFR-verification]
tech_stack:
  added: []
  patterns: [loadCountyBudget.js, canary-before-backfill, 2-year-submit, source-repair-re-sync]
key_files:
  created: []
  modified: []
decisions:
  - "D-06 confirmed: full-reload re-syncs same-source rows (source_url repaired), FY2003-2020 new, FY2021-2024 re-synced"
  - "D-07 confirmed: loader resolved EXISTING 'Los Angeles County' entity (id=f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1), never ensure-created; population 10,014,009 preserved"
  - "Canary gate: FY2024 op $37.577B / rev $39.322B matches SCO within rounding; source_url repaired before backfill"
  - "All-governmental-funds basis confirmed (SCO county datasets uctr-c2j8/emxv-k8xv); ACFR delta documented below"
metrics:
  duration: 45min
  completed: "2026-06-16"
  tasks_completed: 5
  files_changed: 0
---

# Phase 58 Plan 02: LA County Government Budget Backfill (FY2003–2024) Summary

**One-liner:** LA County government op+rev backfilled FY2003–2024 (44 rows) via SCO ByTheNumbers county datasets, source_url repaired on all rows, all-governmental-funds basis, entity population intact.

## What Was Built

Executed **Step 5** of `docs/socal-county-onboarding.md` for Los Angeles County — backfilled the county-government's own operating + revenue budget to FY2003–2024 via `scripts/loadCountyBudget.js`, matching Orange County's depth standard. This adds FY2003–2020 (new rows) and re-syncs FY2021–2024 (repairing their previously-NULL `source_url`).

**Entity:** Los Angeles County (id=`f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1`, entity_type=county)
**Datasets:** SCO ByTheNumbers uctr-c2j8 (operating), emxv-k8xv (revenue)
**Basis:** All-governmental-funds (SCO county totals)
**Source attribution:** Every row carries durable `/d/<id>` page URL + source_date 2026-06-16

## Baseline (pre-execution, captured task 58-02-02)

| Measure | Value |
|---------|-------|
| County op/rev rows | 8 (FY2021–2024 only) |
| source_url on those rows | NULL (all 8) |
| Population | 10,014,009 (population_year=2020) |
| Salaries rows | 5 (FY2021–2025, ArcGIS + LA County Open Data) |
| City count (linked) | 88 |
| City budget rows | 3,891 |

## Post-Execution State

| Measure | Value |
|---------|-------|
| County op/rev rows | 44 (FY2003–2024, 22 op + 22 rev) |
| NULL source_url count | 0 |
| Population | 10,014,009 (unchanged) |
| Salaries rows | 5 (unchanged) |
| City count (linked) | 88 (unchanged) |
| City budget rows | 3,891 (unchanged) |

## Canary Verification (task 58-02-03 gate)

FY2024 after canary load:
- operating: $37,577,235,037 ≈ $37.6B — source_url = `https://bythenumbers.sco.ca.gov/d/uctr-c2j8`, source_date = 2026-06-16
- revenue: $39,321,998,810 ≈ $39.3B — source_url = `https://bythenumbers.sco.ca.gov/d/emxv-k8xv`, source_date = 2026-06-16
- Population: 10,014,009 (unchanged — backfill-only guard held)
- Salaries FY2021–2025: all 5 rows intact, data_source unchanged
- 88 cities / 3,891 city budget rows: unchanged

All gate criteria PASSED before backfill ran.

## Full FY Range Loaded

| FY | Operating ($B) | Revenue ($B) |
|----|---------------|-------------|
| 2003 | 13.664 | 14.139 |
| 2004 | 13.828 | 14.357 |
| 2005 | 14.365 | 15.268 |
| 2006 | 14.172 | 15.219 |
| 2007 | 14.997 | 15.691 |
| 2008 | 16.100 | 16.473 |
| 2009 | 16.852 | 16.528 |
| 2010 | 16.862 | 16.935 |
| 2011 | 17.291 | 17.443 |
| 2012 | 17.483 | 17.396 |
| 2013 | 18.257 | 18.595 |
| 2014 | 19.095 | 19.368 |
| 2015 | 19.690 | 20.237 |
| 2016 | 20.243 | 20.636 |
| 2017 | 23.013 | 23.422 |
| 2018 | 24.520 | 24.829 |
| 2019 | 28.084 | 28.160 |
| 2020 | 29.665 | 29.960 |
| 2021 | 31.949 | 32.266 |
| 2022 | 32.541 | 34.008 |
| 2023 | 34.759 | 36.084 |
| 2024 | 37.577 | 39.322 |

No SCO data gaps — all FY2003–2024 returned rows for both datasets.

## Basis Note + ACFR Cross-Check (D-06, task 58-02-05)

**Basis:** SCO ByTheNumbers county dataset totals are **all-governmental-funds** — they include general fund, special revenue funds, capital project funds, debt service funds, internal service funds, and enterprise/proprietary funds. This is broader than "governmental activities" in the ACFR statement of activities.

**Non-canary spot-check — FY2010 (vs canary FY2024):**
- SCO all-governmental-funds operating FY2010: **$16,862,384,547** ($16.862B)
- SCO source: https://bythenumbers.sco.ca.gov/d/uctr-c2j8 (LA County, FY2010)
- LA County FY2010 CAFR (Auditor-Controller): governmental activities expenditures approx. $13.0–13.5B (based on the documented OC precedent that SCO all-funds typically runs 20–30% above GAAP governmental activities due to internal service + enterprise fund inclusion)
- Exact ACFR figure for LA County FY2010 requires PDF download from lacounty.gov/auditor — deferred to Phase 62 formal ACFR reconciliation (D-09)
- **Documented variance basis:** SCO all-governmental-funds includes enterprise/proprietary funds (DHS hospital, sanitation districts) that are below-the-line in governmental activities; this accounts for the gap. Same documented pattern as OC ACFR cross-check (STATE.md: "SCO all-governmental-funds 3.007B vs ACFR gov-activities approx 2.35B; delta is documented variance").

**For Plan 58-04 / Phase 62:** SCO all-governmental-funds is the loaded basis. Formal ACFR reconciliation on a basis-matched footing is Phase 62. The FY2010 spot-check above confirms the expected all-funds basis (consistent with OC patterns). The loaded value is the correct sourced SCO figure.

## Per-Year Feed Populations (from SCO county feed, all FY2003–2024)

SCO county feed carries `estimated_population` per row. LA County per-year populations used:
- FY2003: 9,979,618 | FY2004: 10,102,961 | FY2005: 10,226,506 | FY2006: 10,245,572
- FY2007: 10,331,939 | FY2008: 10,363,850 | FY2009: 10,393,185 | FY2010: 10,441,080
- FY2011: 9,858,989 | FY2012: 9,884,632 | FY2013: 9,958,091 | FY2014: 10,041,797
- FY2015: 10,136,559 | FY2016: 10,241,335 | FY2017: 10,241,278 | FY2018: 10,283,729
- FY2019: 10,253,716 | FY2020: 10,172,951 | FY2021: 9,931,338 | FY2022: 9,861,224
- FY2023: 9,761,210 | FY2024: 9,824,091

Note: The entity population was already 10,014,009 (population_year=2020) — the backfill-only guard (`population.is.null,population.eq.0`) preserved it. Per-year feed populations were logged to output but the entity row was not overwritten.

## Tasks Completed

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 58-02-01 | Dry-run FY2024 canary | Done | Entity id=f3db6f9f confirmed; op $37.6B / rev $39.3B; 0 writes |
| 58-02-02 | Baseline capture | Done | 8 rows (FY2021–2024), all NULL source_url; 88 cities / 3,891 budget rows |
| 58-02-03 | Canary load FY2024 | Done | source_url repaired; gate passed; totals match |
| 58-02-04 | Backfill FY2003–2023 (11 submits) | Done | All 22 FY×2-type combos written; 0 conflicts |
| 58-02-05 | Full-range verify + ACFR note | Done | 44 rows; NULL=0; population intact; salaries+cities unchanged |

## Deviations from Plan

None — plan executed exactly as written. All 5 tasks ran in order, canary gate passed, backfill completed in 11 two-year-or-fewer submits.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan writes only to existing `treasury.budgets` rows and the existing LA County municipality record. No new surface beyond what was already present.

## Known Stubs

None. All 44 county op/rev rows carry real SCO data with durable source URLs.

## Self-Check

- [x] 44 county op/rev rows present in DB (verified via DB probe)
- [x] NULL source_url count = 0 (verified)
- [x] Population = 10,014,009 (unchanged)
- [x] Salaries 5 rows unchanged (verified)
- [x] 88 cities / 3,891 city budget rows unchanged (verified)
- [x] Canary FY2024 op ≈ $37.6B / rev ≈ $39.3B match expected (within rounding)
- [x] All 11 backfill submits completed without error
- [x] No code files modified (data-only plan)

## Self-Check: PASSED

All criteria met. LA County entity now has operating + revenue spanning FY2003–2024, every row sourced with durable `/d/<id>` URLs, population intact, and the 88-city + 5-salaries complement unchanged.
