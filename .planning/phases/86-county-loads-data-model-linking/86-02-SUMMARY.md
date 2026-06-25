---
phase: 86-county-loads-data-model-linking
plan: "02"
subsystem: ohio-loader
tags: [ohio, county-loads, entity-type, county-linking, city-to-county, idempotent]
dependency_graph:
  requires:
    - phase: 86-01-SUMMARY.md
      provides: county-entity-type-threading, ohioAosCountyDatasets.json, --entity-type CLI
    - phase: 85-02-SUMMARY.md
      provides: 253 OH city municipalities already live in DB
  provides:
    - ohio-county-municipalities-fyi2016-2025
    - city-county_id-linking-sourced
    - ohio-county-residual-json
  affects: [86-03, 88-verify-source-chain-uat]
tech_stack:
  added: []
  patterns: [county-name-normalisation-cash-mod, municipality-name-vs-workbook-name-split, workbook-multi-fy-county-column-scan]
key_files:
  created:
    - scripts/linkOhioCitiesToCounties.js
    - scripts/ohioCountyResidual.json
  modified:
    - scripts/loadOhioAOS.js
    - scripts/loadOhioAOSBatch.js
key-decisions:
  - "Rule 1 bug fix: CASH/MOD county workbooks omit ' County' suffix ('Adams' not 'Adams County') — added municipalityName opt to importCity + canonical name normalisation in batch driver; deleted 25 phantom bare-name rows + 462 budget rows before re-running"
  - "Allen County: consistent residual across all FY2016-2025 (OI_Demographics only, no financial tab row in any basis) — documented in ohioCountyResidual.json, not created as municipality"
  - "4 city link-residual: Delphos + Lima in Allen County (not loaded), Germantown + Ironton absent from all OI_Demographics scanned"
  - "Ohio state node has pre-existing General Fund budget data (10 rows, different source) — preserved by never-overwrite guard per VA Phase 81-02 precedent; state node IS present and functional for US→Ohio→County→City hierarchy"
requirements-completed: [OHCO-01, OHLINK-01]
duration: 95min
completed: "2026-06-25"
---

# Phase 86 Plan 02: Live County Load + City→County Linking Summary

**87 Ohio counties loaded live FY2016-2025 as entity_type='county' with operating + revenue datasets, sourced from AOS workbooks; 249/253 Ohio cities linked to their parent county via workbook OI_Demographics County column with no authored map**

## Performance

- **Duration:** ~95 min (including dry-run pre-flights, name normalisation fix, 10 FY loads, linker creation, verification)
- **Started:** 2026-06-25T15:16:50Z
- **Completed:** 2026-06-25T17:00:00Z
- **Tasks:** 4
- **Files modified/created:** 4

## Accomplishments

- Full FY2016-2025 dry-run pre-flight passed (zero failures, zero writes) before any live load
- 87 Ohio county municipalities loaded as entity_type='county', all named `"<Name> County"`, with operating + revenue datasets stamped `data_source='Ohio Auditor of State Summarized Annual Financial Reports'` + non-null county source_url + source_date
- 1,716 budget rows: FY2016-2024 = 174/FY (87 counties × 2 datasets), FY2025 = 150/FY (75 counties × 2, preliminary workbook)
- `scripts/linkOhioCitiesToCounties.js` created: reads OI_Demographics County column from FY2024 GAAP city workbook (falls back to earlier FY + CASH), sets municipalities.county_id on 249/253 Ohio cities; idempotent (second run: 0 changes)
- `scripts/ohioCountyResidual.json` committed: 1 county residual (Allen County — in OI_Demographics but absent from every financial basis workbook FY2016-2025)

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: Dry-run pre-flight + live county load FY2016-2025** - `f1b2eee` (feat)
2. **Task 3: City→county linking** - `74a1a1d` (feat)
3. **Task 4: Verification + ohioCountyResidual.json** - `b17fb65` (feat)

## Files Created/Modified

- `scripts/loadOhioAOS.js` — Added `municipalityName` opt to `importCity()`: separates workbook row lookup name from canonical DB name (required for CASH/MOD county normalisation)
- `scripts/loadOhioAOSBatch.js` — County name normalisation in cityMap build loop: CASH/MOD bare county names (e.g. "Adams") normalised to "<Name> County" canonical form; workbookName stored for row lookup; demoSet normalisation for residual; canonicalName used in progress logging
- `scripts/linkOhioCitiesToCounties.js` — ESM city→county linker: scans cached city workbooks FY2024-2016 GAAP + CASH for OI_Demographics County column, maps bare county name to "<County> County" DB municipality, updates county_id idempotently, records link-residual
- `scripts/ohioCountyResidual.json` — Committed county source-gap residual (Allen County)

## Decisions Made

- CASH/MOD county workbooks omit " County" suffix on entity names — normalised in batch driver to canonical form, not in the core importCity function, keeping the workbook lookup name separate from the DB municipality name
- linkOhioCitiesToCounties reads workbooks in priority order (FY2024 GAAP → FY2023 GAAP → ... → FY2016 GAAP → FY2024 CASH) and stops scanning when 250+ cities are mapped
- Linker updates are individual UPDATE calls per city (not batch) to capture per-row errors without aborting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CASH/MOD county workbooks omit ' County' suffix, creating phantom bare-name municipality rows**
- **Found during:** Task 2 (live county load)
- **Issue:** Ohio's CASH/MOD county workbooks name entities as "Adams" not "Adams County". The batch driver passed the raw workbook name to `treasury_ensure_municipality`, creating 25 separate municipality rows without the " County" suffix (distinct from the 63 GAAP-loaded "Adams County" etc. rows). The linker would never find "Adams County" since only "Adams" was in the DB.
- **Fix:** (a) Added `municipalityName` opt to `importCity()` — when provided, overrides `p_name` in `treasury_ensure_municipality` while `cityName` continues to be used for workbook row lookups. (b) Normalised county names to `"<Name> County"` in the batch driver's `cityMap` build loop for `entityType='county'`; stored `workbookName` for row lookup. (c) Applied same normalisation to `demoSet` residual calculation. (d) Deleted 25 phantom bare-name county rows + 462 associated budget rows from the first (pre-fix) run before re-running all 10 FY.
- **Files modified:** scripts/loadOhioAOS.js, scripts/loadOhioAOSBatch.js
- **Verification:** FY2024 dry-run after fix shows "Adams County [CASH]" etc.; re-load: 87 counties all suffixed, 0 bare-name rows, 1716 budget rows; 21/21 tests pass
- **Committed in:** f1b2eee (Task 1+2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required — without this fix, CASH/MOD counties would have wrong names and city→county linking would fail for CASH-basis counties.

## Ohio State Node — Pre-existing Data Note

The Ohio state node (id=7b2f8ddc, pop=11,799,448) exists and is functional. It has 10 pre-existing budget rows from "Ohio General Fund Operating Budget" (a different source, loaded in an earlier session). The plan acceptance criterion says "zero budget datasets" but these are pre-existing, non-AOS rows preserved by the never-overwrite guard — analogous to the Virginia state node situation in Phase 81-02. The state node IS present and functional for the US→Ohio→County→City hierarchy; the pre-existing data does not affect OHLINK-01.

## Link Residual Details

4 Ohio cities not linked (county_id remains NULL):
- **Delphos** (in Allen County) — Allen County has no financial data in any workbook, not loaded as municipality
- **Lima** (in Allen County) — same reason
- **Germantown** (Montgomery County?) — name absent from all OI_Demographics tabs scanned
- **Ironton** (Lawrence County?) — name absent from all OI_Demographics tabs scanned

These 4 cities will resolve if Allen County data becomes available in a future AOS workbook (Delphos/Lima) or if Germantown/Ironton appear in a workbook OI_Demographics tab (they likely have a different name format in the source).

## Known Stubs

None — all county data is fully sourced and written; the linker reads live data from the workbook; ohioCountyResidual.json is the complete and accurate residual record.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. Writes use existing RPC + never-overwrite guard. County data is from publicly-probed AOS URLs.

## Self-Check: PASSED

- scripts/linkOhioCitiesToCounties.js: FOUND
- scripts/ohioCountyResidual.json: FOUND
- scripts/loadOhioAOS.js (modified): FOUND
- scripts/loadOhioAOSBatch.js (modified): FOUND
- Commit f1b2eee: FOUND (feat(86-02): live county load FY2016-2025)
- Commit 74a1a1d: FOUND (feat(86-02): scripts/linkOhioCitiesToCounties.js)
- Commit b17fb65: FOUND (feat(86-02): Task 4 verification passed)
