---
phase: 81-towns-virginia-data-model-linking
plan: 01
subsystem: database
tags: [virginia, va, apa, xlsx, exceljs, towns, supabase, batch-loader]

# Dependency graph
requires:
  - phase: 80-city-county-loads
    provides: "Proven batch driver (loadVAComparativeReportBatch.js), importLocality write path, never-overwrite guard, per-FY sourcing, section-scoped homonym-safe lookup, absent-skip handling"
  - phase: 79-va-apa-source-loader
    provides: "loadVAComparativeReport.js (localityPopulation, buildExpenditureTree, buildRevenueTree, findLocalityRowInSection, ENTITY_TYPE_SECTION)"
provides:
  - "34 Virginia town municipalities (entity_type='town') loaded — operating + revenue for FY2024 (30 towns) and FY2023 (33 towns); 3 absent in both years (Big Stone Gap, Clifton Forge, Vinton — multi-year-overdue audits)"
  - "Exhibit A town population fallback: townPopulationFromExhibitA helper reads col 4 (name) + col 2 (population) section-scoped; all 34 loaded towns have non-null population"
  - "Batch driver extended with --entity-type town branch: bare display name, sectionIndex=2, entityType='town'"
  - "18 offline tests passing (12 prior + 6 new): town roster count, Exhibit A population, city/county unchanged, absent=null, bare-name safety, Orange town/county distinct"
  - "0 NULL source_url on 126 town budget rows; uniform data_source='Virginia APA Comparative Report'"
affects:
  - 81-02-state-node-linking
  - 82-enrichment-parity
  - 83-verification-source-chain-audit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhibit A fallback for entity types absent from Exhibit H: col 4 = name, col 2 = population, same No.-reset section-scoping"
    - "Town batch loading via --entity-type town: bare displayName matches matchName (no suffix), sectionIndex=2"
    - "Absent towns (zero op+rev in report) skip cleanly — no phantom municipality, no $0 budget row"

key-files:
  created: []
  modified:
    - "scripts/loadVAComparativeReportBatch.js"
    - "scripts/loadVAComparativeReport.js"
    - "scripts/loadVAComparativeReport.test.mjs"

key-decisions:
  - "Towns stored with BARE display names (no suffix) — zero town/city bare-name collisions; 6 town/county overlaps (Bedford, Culpeper, Orange, Pulaski, Tazewell, Wise) safe because counties carry 'County' suffix (CONTEXT 81 D-02)"
  - "Town population reads from Exhibit A (col 4=name, col 2=population) via fallback when Exhibit H returns null — cities/counties unchanged (Exhibit H primary path) (CONTEXT 81 D-03)"
  - "FY2024 amended workbook + FY2023 published workbook — same XLSX files Phase 80 used; per-FY source_url from vaApaDatasets.json"
  - "3 towns absent in BOTH years (Big Stone Gap, Clifton Forge, Vinton) are documented source gaps; no phantom municipalities created"

patterns-established:
  - "Exhibit A fallback pattern: for entity types lacking Exhibit H rows, scan Exhibit A with section-scoped No.-reset + col-4 name match"

requirements-completed: [VALOAD-03]

# Metrics
duration: 35min
completed: 2026-06-23
---

# Phase 81 Plan 01: Towns Load Summary

**All 37 VA APA reporting towns batch-loaded via extended driver with Exhibit A population fallback — 34 municipalities, 126 budget rows, 0 NULL source_url, per-capita proven for all loaded towns**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-23T03:10:00Z
- **Completed:** 2026-06-23T03:45:00Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments

- Extended `loadVAComparativeReportBatch.js` with a town branch: `--entity-type town` pushes `{matchName: name, displayName: name, entityType: 'town', sectionIndex: 2}` for each of 37 towns; bare names are safe (zero town/city collisions, county overlaps disambiguated by "County" suffix)
- Added Exhibit A population fallback to `localityPopulation`: when Exhibit H returns null (towns have no Exhibit H section), falls through to `townPopulationFromExhibitA` which reads col 4 (name) + col 2 (population) with section-scoped No.-reset; cities/counties unchanged on Exhibit H primary path
- Extended offline tests (18/18 pass): town roster = 37, Leesburg Exhibit A population finite > 0, city/county Exhibit H values unchanged, absent town = null, zero town/city bare-name collisions, Orange town (§2) distinct from Orange County (§1)
- Live-loaded: FY2024-amended = 30 towns loaded / 7 absent; FY2023 = 33 towns loaded / 4 absent; 3 towns absent in both years (Big Stone Gap, Clifton Forge, Vinton — multi-year-overdue audits); idempotent re-run confirmed same counts
- Spot-check: Abingdon FY2024 operating $18,032,009 matches report exactly

## Task Commits

1. **Task 1: Add town branch to batch work-list builder** - `c9f090f` (feat)
2. **Task 2: Add Exhibit A town population fallback** - `431c508` (feat)
3. **Task 3: Extend offline tests for towns** - `1894203` (test)
4. **Task 4: Live-load FY2023 + FY2024-amended and verify** — no code commit (live data write only)

**Plan metadata:** (see final commit)

## Files Created/Modified

- `scripts/loadVAComparativeReportBatch.js` — town branch added to work-list builder; "towns out of scope" log removed; header comment updated
- `scripts/loadVAComparativeReport.js` — `localityPopulation` extended with Exhibit A fallback; `townPopulationFromExhibitA` helper added (exported)
- `scripts/loadVAComparativeReport.test.mjs` — 6 new town tests added (imports `townPopulationFromExhibitA`)

## Decisions Made

- **Exhibit A fallback shape:** inline fallback in `localityPopulation` + dedicated exported `townPopulationFromExhibitA` helper (smallest change; cities/counties keep Exhibit H primary; helper testable directly)
- **Bare town display names:** confirmed zero collisions with city names; 6 town/county overlaps (Bedford, Culpeper, Orange, Pulaski, Tazewell, Wise) safe because county display names include " County" suffix
- **FY2024-amended workbook:** same amended XLSX Phase 80 adopted (`_va-recon/fy2024-amended.xlsx`); filled late-filers vs. final

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All 37 towns parsed correctly in dry-run, both FY loads succeeded, idempotency confirmed, tests 18/18.

## Absent Towns (documented source gaps)

| Town | FY2024 | FY2023 | Note |
|------|--------|--------|------|
| Big Stone Gap | absent | absent | Multi-year-overdue audit — absent from all published XLSX years |
| Clifton Forge | absent | absent | Multi-year-overdue audit — absent from all published XLSX years |
| Vinton | absent | absent | Multi-year-overdue audit — absent from all published XLSX years |
| Blacksburg | absent | loaded | FY2024 not yet filed at publication |
| Broadway | absent | loaded | FY2024 not yet filed at publication |
| Marion | absent | loaded | FY2024 not yet filed at publication |
| Richlands | loaded | absent | FY2023 not yet filed at publication |
| South Hill | absent | loaded | FY2024 not yet filed at publication |

A future idempotent re-run against a newer amended/FY2025 report will pick these up with no code change.

## Live Verification Results

| Check | Result |
|-------|--------|
| Town municipalities in DB | 34 (37 - 3 absent in both years) |
| Town budget rows total | 126 (63 operating + 63 revenue) |
| NULL source_url | 0 |
| data_source uniform | 100% 'Virginia APA Comparative Report' |
| Towns with population > 0 | 34 / 34 (Exhibit A fallback working) |
| Leesburg FY2024 population | 48,250 |
| Abingdon FY2024 operating total | $18,032,009 (matches report exactly) |
| Idempotent re-run | confirmed (same counts, no duplicates) |

## Next Phase Readiness

Plan 81-02 (state node, town→county linking, navigation) can proceed. All 34 town municipalities are in the DB with `entity_type='town'`, non-null population, and sourced budget rows for FY2023+FY2024. The `county_id` FK is set in the schema — 81-02 will populate it from the authored `data/vaTownCounties.json` map.

## Known Stubs

None.

## Threat Flags

None — this plan only writes to `treasury.budgets` and `treasury.municipalities` via proven RPCs (`treasury_sync_city_budget`, `treasury_ensure_municipality`). No new network endpoints, auth paths, or schema changes.

## Self-Check

- `scripts/loadVAComparativeReportBatch.js` — confirmed modified (town branch + updated log line)
- `scripts/loadVAComparativeReport.js` — confirmed modified (Exhibit A fallback + helper)
- `scripts/loadVAComparativeReport.test.mjs` — confirmed modified (6 new tests)
- Commits: c9f090f, 431c508, 1894203 — all present in git log
- Live: 34 town municipalities, 126 budget rows, 0 NULL source_url, population on all 34 loaded towns

## Self-Check: PASSED
