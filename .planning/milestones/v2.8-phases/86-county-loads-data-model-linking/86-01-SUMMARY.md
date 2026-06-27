---
phase: 86-county-loads-data-model-linking
plan: "01"
subsystem: ohio-loader
tags: [ohio, county-loads, entity-type, manifest, dry-run, batch-driver, tests]
dependency_graph:
  requires: [85-02-SUMMARY.md]
  provides: [county-entity-type-threading, ohioAosCountyDatasets.json, --entity-type CLI]
  affects: [scripts/loadOhioAOS.js, scripts/loadOhioAOSBatch.js, scripts/loadOhioAOS.test.mjs]
tech_stack:
  added: []
  patterns: [entity-type-parameterization, per-entityType-manifest-cache, county-dry-run]
key_files:
  created:
    - scripts/ohioAosCountyDatasets.json
  modified:
    - scripts/loadOhioAOS.js
    - scripts/loadOhioAOSBatch.js
    - scripts/loadOhioAOS.test.mjs
decisions:
  - "entityType default='city' in all opts keeps every Phase 85 city call unchanged (zero regression)"
  - "Per-entityType _manifestCache{} map prevents city/county manifest cross-contamination in shared process"
  - "County CASH workbook omits ' County' suffix on entity names (e.g. 'Adams' vs 'Adams County') — different source naming; GAAP workbook consistently uses '<Name> County'; noted for plan 86-02"
  - "All 30 County URLs (FY2016-2025 × GAAP/CASH/MOD) probed HTTP 200 (2026-06-25)"
metrics:
  duration: "7m"
  completed: "2026-06-25"
  tasks: 3
  files_modified: 4
---

# Phase 86 Plan 01: County Loader Extension (entityType + county manifest) Summary

Regression-safe delta to extend the proven Phase 84/85 Ohio AOS loader to handle counties: an `entityType` parameter threads `entity_type='county'` through the Supabase write path (mandatory per auto-memory project_utah_loader_entity_type_and_display_names), a per-entityType manifest cache selects `ohioAosCountyDatasets.json` for counties vs `ohioAosDatasets.json` for cities, and `--entity-type city|county` CLI switch on the batch driver. All 21 tests pass; county dry-run proves 87 counties (63 GAAP + 20 CASH + 4 MOD) process cleanly from the on-disk FY2024 workbook with zero writes and zero failures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Parameterize entityType in write path + manifest resolver | b49916d | scripts/loadOhioAOS.js |
| 2 | Create + probe scripts/ohioAosCountyDatasets.json | 9a46456 | scripts/ohioAosCountyDatasets.json |
| 3 | Add --entity-type to batch driver + county dry-run + tests | 2c5461f | scripts/loadOhioAOSBatch.js, scripts/loadOhioAOS.test.mjs |

## Verification Results

- `node --test scripts/loadOhioAOS.test.mjs` — 21/21 PASS (19 Phase 84/85 city cases + 2 new Phase 86 county cases, zero skips)
- `node scripts/loadOhioAOSBatch.js --fy 2024 --entity-type county --dry-run` — 87 counties processed (63 GAAP + 20 CASH + 4 MOD), Ashland County present, zero failures, zero writes; basis distribution + 5-county OI_Demographics residual printed
- `resolveSourceUrl(2024,'GAAP','county')` → `https://ohioauditor.gov/references/SummarizedAnnualFinancialReports/SummarizedReports/County_2024_GAAP_Summarized.XLSX` (correct)
- Every existing city caller omits `entityType` and behaves identically (no regression)
- `importCity` passes `p_entity_type='county'` when `entityType:'county'` (auto-memory Utah rule honored)

## Dry-Run County Roster (FY2024)

- GAAP counties: 63 (Ashland County, Ashtabula County, Athens County … Franklin County, Cuyahoga County, Hamilton County, Summit County, etc.)
- CASH counties: 20 (Adams, Brown, Champaign, etc. — CASH workbook omits " County" suffix)
- MOD counties: 4 (Darke, Jackson, Perry, Shelby — no population in OI_Demographics)
- OI_Demographics residual: 5 (Allen County, Darke County, Jackson County, Perry County, Shelby County match GAAP-style names but appear as bare names in CASH/MOD workbooks — sourced difference, not phantom data)
- Failures: 0
- Writes: 0

## Deviations from Plan

None — plan executed exactly as written. The CASH/MOD county workbooks name entities without the " County" suffix (e.g. "Adams" not "Adams County") — this is a source-data naming difference noted for plan 86-02's live load consideration. The GAAP workbook (the primary basis for 63 counties) correctly uses "<Name> County" throughout.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. This plan is dry-run only (zero DB writes). The county manifest adds publicly-probed URLs with no auth surface.

## Self-Check: PASSED

- scripts/ohioAosCountyDatasets.json: FOUND
- scripts/loadOhioAOS.js (modified): FOUND
- scripts/loadOhioAOSBatch.js (modified): FOUND
- scripts/loadOhioAOS.test.mjs (modified): FOUND
- Commit b49916d: FOUND (feat(86-01): parameterize entityType)
- Commit 9a46456: FOUND (feat(86-01): add county datasets manifest)
- Commit 2c5461f: FOUND (feat(86-01): add --entity-type county to batch driver)
