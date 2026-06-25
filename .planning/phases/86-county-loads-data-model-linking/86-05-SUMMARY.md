---
phase: 86-county-loads-data-model-linking
plan: 05
subsystem: data-loader
tags: [ohio, aos, xlsx, county, reload, linking, verification, gap-closure]

# Dependency graph
requires:
  - phase: 86-county-loads-data-model-linking/86-04
    provides: corrected county layout in detectLayout (entityType='county'), Allen County recovered
provides:
  - All 88 Ohio counties loaded FY2016-2025 with correct text labels and totals
  - Allen County budget data (was wrongly excluded by layout bug)
  - 253/253 OH cities linked to county (Lima + Delphos now link to Allen County)
  - ohioCountyResidual.json corrected (Allen removed; counties=[])
  - 86-VERIFICATION.md corrected with DB-derived evidence
affects:
  - 87 (enrichment — county vocabulary now clean)
  - 88 (verification — all county data authoritative)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delete broken county budgets before reload (never-overwrite guard would skip same-source rows)"
    - "Serial FY-by-FY batch reload: loadOhioAOSBatch --entity-type county for FY2016-2025"
    - "Idempotency: re-run = 0 new rows (never-overwrite guard active)"

key-files:
  created: []
  modified:
    - scripts/ohioCountyResidual.json
    - .planning/phases/86-county-loads-data-model-linking/86-VERIFICATION.md

key-decisions:
  - "Delete before reload: the never-overwrite guard would SKIP the 1,716 existing broken rows; explicit delete is required"
  - "AOS county GAAP workbook has two adjacent columns both headed 'Charges For Services' (cols 11+12); loader reads both faithfully; total_budget from col 16 is authoritative and correct; cosmetic duplicate in category tree is a workbook characteristic, not a loader bug"
  - "FY2025 partial: 76 counties loaded (vs 88 for prior FY) — preliminary workbook, consistent with city loader behavior"
  - "ohioCountyResidual.json: Allen County removed (was a layout bug, not a source gap); counties=[] (all 88 OH counties present)"

# Metrics
duration: 90min
completed: 2026-06-25
---

# Phase 86 Plan 05: Gap Closure — County Data Reload + Re-verification Summary

**Deleted 1,716 broken county budgets, reloaded all 88 Ohio counties FY2016-2025 with correct text labels and totals (Allen County recovered), re-linked 253/253 cities to their county, and independently verified all facts from the DB**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-25
- **Completed:** 2026-06-25
- **Tasks:** 4
- **Files modified:** 2 (ohioCountyResidual.json, 86-VERIFICATION.md)

## Accomplishments

**Task 1 (DB-only — no file changes):** Deleted 1,716 broken OH county AOS budget rows and 20,474 budget_categories (the numeric garbage-label data from the pre-86-04 load). Verified: 0 county AOS budgets remain; 4,880 city budgets and 10 state-node budgets are unchanged; 87 county municipality rows and all county_id values are intact.

**Task 2 (DB-only — no file changes):** Reloaded all 88 Ohio counties across FY2016-2025 using the corrected county layout from plan 86-04. Allen County is now present (20 budget rows FY2016-2025). Results per FY:
- FY2016: 88 counties (GAAP=66, CASH=19, MOD=3), 0 failures
- FY2017: 88 counties (GAAP=65, CASH=19, MOD=4), 0 failures
- FY2018: 88 counties (GAAP=66, CASH=18, MOD=4), 0 failures
- FY2019: 88 counties (GAAP=65, CASH=19, MOD=4), 0 failures
- FY2020: 88 counties (GAAP=65, CASH=19, MOD=4), 0 failures
- FY2021: 88 counties (GAAP=64, CASH=19, MOD=5), 0 failures
- FY2022: 88 counties (GAAP=64, CASH=19, MOD=5), 0 failures
- FY2023: 88 counties (GAAP=64, CASH=20, MOD=4), 0 failures
- FY2024: 88 counties (GAAP=64, CASH=20, MOD=4), 0 failures
- FY2025: 76 counties (GAAP=54, CASH=18, MOD=4), 0 failures (preliminary workbook)
Total: 1,736 budget rows (88×2×9 FY full + 76×2 FY2025)

**Task 3:** Re-ran `linkOhioCitiesToCounties.js`. Lima + Delphos now link to Allen County (the Allen County municipality is now in the DB). Result: 253/253 OH cities linked (up from 251/253). Idempotency confirmed: second run = 0 changes. Rewrote `scripts/ohioCountyResidual.json` — Allen County removed; `counties: []` (no genuinely absent counties; all 88 OH counties are in the DB and workbooks).

**Task 4:** Independent DB re-verification (all probes passed):
- 0 numeric depth-0 county category labels (original defect is gone)
- Franklin County FY2024 revenue=$1,811,422,000 (col 16) / operating=$1,913,193,000 (col 32) — both match workbook exactly
- 88/88 county municipalities present; 0 phantom city rows from county load
- 253/253 OH cities with county_id; Lima→Allen County and Delphos→Allen County verified
- 0 NULL source_url, 0 NULL data_source on county rows
- Idempotency: re-run FY2024 = 0 new rows
- 86-VERIFICATION.md corrected to reflect the accurate final state

## Task Commits

1. **Tasks 1-3: Delete, reload, re-link** - `94e1ea4` (feat) — ohioCountyResidual.json
2. **Task 4: DB re-verification + corrected 86-VERIFICATION.md** - `9e47424` (feat)

## Files Created/Modified

- `scripts/ohioCountyResidual.json` — Allen County removed; `counties: []`; updated note explains the layout bug and final state
- `.planning/phases/86-county-loads-data-model-linking/86-VERIFICATION.md` — superseded banner replaced with corrected PASS verdict for OHCO-01 + OHLINK-01 with DB-derived evidence

## Decisions Made

- Delete before reload: the never-overwrite guard would SKIP the 1,716 existing broken rows (same municipality_id + data_source + fiscal_year + dataset_type). An explicit `DELETE WHERE municipality_id IN (...) AND data_source='Ohio AOS ...'` is required before re-running the batch loader.
- The AOS county GAAP workbook has two adjacent columns both headed "Charges For Services" (cols 11 and 12). Both are read by the loader, creating a duplicate category in the revenue tree. The `total_budget` is always read from col 16 directly (not summed from categories) and is correct. This is a workbook characteristic, not a loader bug.
- FY2025 county partial: 76/88 counties in the preliminary workbook — consistent with city FY2025 behavior (196/244 cities). Not a defect.

## Deviations from Plan

### Workbook Characteristic (Informational)

**1. [Informational] County GAAP workbook has duplicate "Charges For Services" header columns**
- **Found during:** Task 4 independent verification
- **Issue:** The county GAAP workbook has cols 11 and 12 both headed "Charges For Services" (distinct sub-categories in the AOS layout but indistinguishable by header text). The loader creates two identically-named leaf categories for the revenue tree.
- **Impact on correctness:** None — `total_budget` is read from col 16 directly and is correct ($1,811,422,000 for Franklin County FY2024, matching the workbook). The duplicate appears in the visual tree only.
- **Fix:** Not applied — this is an AOS workbook structural characteristic. A name disambiguator would need domain knowledge about what the two columns represent.
- **Documented in:** 86-VERIFICATION.md under "Known workbook characteristic"

---

**Total deviations:** 1 informational (zero impact on data correctness or plan goals)

## Known Stubs

None. All tasks completed against production DB. County data is fully loaded and independently verified.

## Threat Flags

None. No new network endpoints, auth paths, schema changes, or trust-boundary modifications. DB writes use the existing Supabase service key pattern.

## Self-Check

**Files exist:**
- `C:\treasury-tracker\scripts\ohioCountyResidual.json` — contains `"counties": []`
- `C:\treasury-tracker\.planning\phases\86-county-loads-data-model-linking\86-VERIFICATION.md` — contains "Corrected verdict (2026-06-25, plan 86-05)"

**Commits exist:**
- `94e1ea4` — Tasks 1-3 commit
- `9e47424` — Task 4 commit

**DB state confirmed:**
- 1,736 OH county AOS budget rows
- 88 county municipalities (including Allen County)
- 253/253 OH cities with county_id set
- 0 numeric depth-0 category labels

## Self-Check: PASSED

All files present, commits verified, DB state matches expectations.

## Next Phase Readiness

Phase 87 (enrichment) can now proceed. All 88 counties have text-labeled budgets with correct totals, every figure sourced, and all 253 cities linked to their county. The enrichment vocabulary (county names, category names) is clean and accurate.
