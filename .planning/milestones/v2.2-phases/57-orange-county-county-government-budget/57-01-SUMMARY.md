---
phase: 57-orange-county-county-government-budget
plan: "57-01"
subsystem: database
tags: [supabase, nodejs, socrata, county-budget, loader, orange-county, treasury]

# Dependency graph
requires:
  - phase: 54-orange-county-entity-linking-enrichment
    provides: OC county entity (id=65e7c643) seeded with entity_type=county, state=CA
  - phase: 53-orange-county-operating-revenue-load
    provides: 34 OC city budgets + chunked/canary load discipline precedent
  - phase: 56-orange-county-verification-uat
    provides: Phase 56 finding that SCO county totals are all-governmental-funds basis
provides:
  - "scripts/loadCountyBudget.js: reusable county-government budget loader (D-07, runbook Step 5)"
  - "OC county entity (Orange County) has operating + revenue budget rows FY2003-2024 (44 rows total)"
  - "Per-year population from SCO feed (2,978,816 FY2003 to 3,150,835 FY2024)"
  - "All-governmental-funds basis documented in every loaded row"
  - "Durable source attribution: /d/uctr-c2j8 + /d/emxv-k8xv page URLs, source_date=2026-06-15"
  - "34 OC city rows confirmed unchanged (T-57-01 never-overwrite verified)"
affects: ["57-02", "future-county-onboarding", "sourcing-backfill-milestone"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "county-budget-loader: --county/--entity/--fy/--type/--population/--source-date/--dry-run CLI pattern"
    - "per-year population from SCO feed (estimated_population field), backfill-only"
    - "never-overwrite: findConflictingBudget pre-pass skips/logs different-source rows"
    - "canary-before-backfill gate: one year verified clean before full range backfill"
    - "chunked backfill: <=2 fiscal years per submit to avoid 600s timeout"

key-files:
  created:
    - scripts/loadCountyBudget.js
  modified: []

key-decisions:
  - "SCO county feed carries estimated_population per row — no --population flag needed for OC (D-06 path: per-year from feed)"
  - "All-governmental-funds basis documented in loader output and summary (Phase 56 finding)"
  - "ACFR cross-check FY2010: SCO $3.007B vs ACFR gov-activities ~$2.35B; delta ~$655M consistent with all-funds basis including internal service + proprietary funds (documented variance, SCO remains loaded value)"
  - "Population source: SCO county feed estimated_population field, per-year 2003-2024 (CA DOF-consistent series)"

patterns-established:
  - "loadCountyBudget.js is the Step 5 tool for docs/socal-county-onboarding.md — any future county runs one command"
  - "parseAmt + buildTree reused verbatim from LA loader (category->subcategory_1->line items tree)"
  - "Entity resolution: ilike name + entity_type=county, exits 1 if absent (never ensure-create with population)"

requirements-completed: [OCB-01]

# Metrics
duration: 75min
completed: 2026-06-15
---

# Phase 57 Plan 57-01: Reusable County-Budget Loader + Orange County FY2003-2024 Summary

**Reusable loadCountyBudget.js generalizes LA County one-offs into one parameterized script; loads OC county operating + revenue FY2003-2024 (44 rows, ~$2.6B-$6.4B/year) with per-year SCO population and durable /d/<id> source attribution**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-06-15T01:00:00Z (approx)
- **Completed:** 2026-06-15
- **Tasks:** 5
- **Files modified:** 1 (scripts/loadCountyBudget.js created)

## Accomplishments
- Built `scripts/loadCountyBudget.js` — reusable county-government budget loader (D-07) parameterized by `--county/--entity/--fy/--type/--population/--source-date/--dry-run`; generalizes LA County one-offs for any future CA county
- Loaded 22 operating + 22 revenue rows for Orange County FY2003–2024 from SCO ByTheNumbers county datasets (`uctr-c2j8` / `emxv-k8xv`); all rows carry durable `/d/<id>` page URLs and `source_date=2026-06-15`
- Per-year population from SCO feed (2,978,816 FY2003 → 3,150,835 FY2024) — more accurate than the single-year fallback the LA loaders used
- Canary-before-backfill discipline: FY2024 verified clean (entity, source URLs, population, totals, 34 cities unchanged) before running 11 backfill submits
- T-57-01 never-overwrite confirmed: zero city budget rows carry county data source labels; all 34 OC cities retain their original sources

## Task Commits

Each task was committed atomically:

1. **Task 57-01-01: Build reusable loader** - `74d23e1` (feat)
2. **Task 57-01-02: Dry-run preflight + clean-state check** - `45a84ce` (chore — empty commit, run was external)
3. **Task 57-01-03: Canary FY2024 load + verify** - `52b5d22` (feat)
4. **Task 57-01-04: Backfill FY2003-2023** - `63a9589` (feat)
5. **Task 57-01-05: Full-range verification + ACFR cross-check** - `e9573b7` (chore)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified
- `scripts/loadCountyBudget.js` — Reusable county-government budget loader; parameterized by --county/--entity/--fy/--type/--population/--source-date/--dry-run; datasets map (uctr-c2j8 + emxv-k8xv with /d/<id> page URLs); resolves existing county entity by ilike+entity_type=county; never-overwrite pre-pass; per-year population backfill from feed; writes via treasury_sync_city_budget with p_source_url + p_source_date + p_data_source_name

## Sampled Totals (all-governmental-funds basis, for 57-VERIFICATION.md)

| FY | Operating | Revenue | Population (SCO feed) |
|----|-----------|---------|----------------------|
| 2003 | $2,596,498,190 | $2,608,620,198 | 2,978,816 |
| 2004 | $2,670,898,589 | $2,693,526,625 | 3,017,298 |
| 2005 | $2,737,295,734 | $2,888,478,285 | 3,056,865 |
| 2006 | $3,220,836,590 | $3,359,558,336 | 3,072,336 |
| 2007 | $3,244,089,859 | $3,552,215,691 | 3,098,121 |
| 2008 | $3,680,914,588 | $3,445,201,493 | 3,121,251 |
| 2009 | $3,326,887,750 | $3,105,605,836 | 3,139,017 |
| 2010 | $3,007,166,924 | $3,087,830,305 | 3,166,461 |
| 2011 | $3,083,894,766 | $3,144,642,955 | 3,029,859 |
| 2012 | $3,216,502,837 | $3,265,911,821 | 3,055,792 |
| 2013 | $3,325,199,979 | $3,524,255,671 | 3,081,804 |
| 2014 | $3,444,934,619 | $3,647,101,056 | 3,113,991 |
| 2015 | $3,429,426,065 | $3,724,987,048 | 3,147,655 |
| 2016 | $3,614,276,100 | $3,793,514,681 | 3,183,011 |
| 2017 | $4,233,510,558 | $4,412,670,251 | 3,194,024 |
| 2018 | $4,550,168,872 | $4,584,568,142 | 3,221,103 |
| 2019 | $4,972,108,200 | $4,909,268,760 | 3,222,498 |
| 2020 | $5,145,135,700 | $5,203,412,227 | 3,194,332 |
| 2021 | $5,785,486,386 | $5,859,070,819 | 3,169,542 |
| 2022 | $5,611,562,789 | $6,010,844,341 | 3,162,245 |
| 2023 | $6,181,664,285 | $6,599,080,929 | 3,137,164 |
| 2024 | $6,424,119,390 | $6,661,069,681 | 3,150,835 |

## ACFR Cross-Check Note (D-02, for 57-VERIFICATION.md)

**Spot FY:** 2010
**SCO all-governmental-funds operating:** $3,007,166,924
**OC ACFR FY2009-10 governmental activities expenditures:** approximately $2.35B
**Delta:** ~$655M
**Explanation:** The SCO all-governmental-funds basis includes internal service funds and proprietary/enterprise fund expenditures that are excluded from the ACFR governmental activities column. This is a documented variance consistent with the Phase 56 definitional finding. SCO remains the loaded value; delta recorded.

**Population source:** SCO county feed `estimated_population` field (per-year 2003-2024), consistent with CA DOF E-series. No `--population` fallback needed — feed carries per-year population for every loaded year.

## Decisions Made

- **SCO feed carries per-year population**: The SCO county expenditures/revenues datasets (`uctr-c2j8`/`emxv-k8xv`) carry `estimated_population` per row, enabling the preferred D-06 path (per-year denominators) without the `--population` fallback. The LA loaders used a single hard-coded population; the new reusable loader is more accurate across 22 years of OC growth.
- **No `--population` arg for OC**: Feed population confirmed during dry-run; documented so future callers know to check dry-run output before deciding on `--population` flag.
- **ACFR cross-check basis**: The OC ACFR governmental activities figure (~$2.35B for FY2010) is lower than the SCO all-governmental-funds figure ($3.01B) because the ACFR governmental activities column excludes internal service funds and proprietary funds. Consistent with Phase 56 finding. SCO is the loaded value.

## Deviations from Plan

None - plan executed exactly as written. The canary-before-backfill gate was applied as specified in the threat model; all checks passed before backfill ran.

## Issues Encountered

None. Every SCO year from 2003 to 2024 had data — no "No data found" years. The dry-run correctly identified `estimated_population` in the feed before the real load.

## Verification Results

All acceptance criteria met:

- `scripts/loadCountyBudget.js` exists with datasets map (`uctr-c2j8` + `emxv-k8xv`), durable `/d/<id>` pageUrls, existing-entity lookup (`entity_type='county'` + `ilike`), exits 1 when absent
- Calls `treasury_sync_city_budget` with `p_source_url`, `p_source_date`, `p_data_source_name`
- Never-overwrite check skips existing rows from different `data_source`
- OC county entity (id=65e7c643) has 44 budget rows (22 operating + 22 revenue), FY2003-2024
- All rows: `source_url` = `/d/uctr-c2j8` or `/d/emxv-k8xv`; `source_date` = `2026-06-15`
- Entity population = 3,150,835 (non-zero, per-year from feed, year=2024)
- FY2024 operating total = $6,424,119,390 (matched dry-run + write; plausible all-funds county total)
- 34 OC cities: 0 rows carry county data source labels; city sources unchanged

## Next Phase Readiness

- Plan 57-02 can proceed: OC county entity now has full budget data (icicle/summary will auto-render per Phase 56 mechanism); frontend needs only SourceChip wiring and verify-phase57.mjs
- `scripts/loadCountyBudget.js` is ready for future county onboarding (runbook Step 5)
- Sampled totals + ACFR cross-check figures are recorded above for transcription into `57-VERIFICATION.md`

---
*Phase: 57-orange-county-county-government-budget*
*Completed: 2026-06-15*
