---
phase: 29-long-beach-bakersfield-ca-data-load
plan: 01
subsystem: database
tags: [supabase, seeder, municipalities, data_sources, california, long-beach, bakersfield]

# Dependency graph
requires:
  - phase: 25-la-county-data-completion-county-city-linking
    provides: LA_COUNTY_ID (f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1) and 88-city LA County list
  - phase: 28-oakland-san-jose-ca-data-load
    provides: seedOaklandSanJoseCA.js template pattern for two-city seeder
provides:
  - Long Beach municipality row (CA, pop=451000, county_id=LA_COUNTY_ID)
  - Bakersfield municipality row (CA, pop=417000, county_id=NULL)
  - Four data_source rows anchoring all Long Beach and Bakersfield budget loads
  - Idempotent seeder script for re-run safety
affects:
  - 29-02 (processLongBeach.js depends on Long Beach municipality + data_source rows)
  - 29-03 (processBakersfield.js depends on Bakersfield municipality + data_source rows)
  - 29-04 (enrichCategories.js --city "Long Beach" and --city Bakersfield)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-city seeder pattern: loadEnv → upsertMunicipality × 2 → upsertDataSourceByName × 4 → treasury_list_source_ids verification"
    - "Direct county_id assignment in seeder for cities in already-loaded counties (Long Beach → LA County)"

key-files:
  created:
    - scripts/seedLongBeachBakersfieldCA.js
  modified: []

key-decisions:
  - "Set Long Beach county_id = LA_COUNTY_ID directly in seeder (Long Beach is in Phase 25 88-city list; no re-run of Phase 25 needed)"
  - "Bakersfield county_id stays NULL — Kern County not loaded, deferred per CONTEXT.md"
  - "Document Long Beach non-standard FY (Oct-Sep, ending-year D-01) via seeder comment only — no DB schema change, no UI change (D-02)"

patterns-established:
  - "Pattern: county_id direct-set for cities in already-loaded counties (avoid re-running county-linker)"
  - "Pattern: FY convention doc comment — non-standard FY documented in seeder comment, not schema"

requirements-completed: [POPUL-01]

# Metrics
duration: 8min
completed: 2026-06-05
---

# Phase 29 Plan 01: Long Beach + Bakersfield CA Seeder Summary

**Idempotent two-city seeder creating Long Beach (pop=451K, county_id=LA_COUNTY_ID) and Bakersfield (pop=417K) municipality rows plus four PDF-download data_source anchors verified via treasury_list_source_ids RPC**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-05T16:20:00Z
- **Completed:** 2026-06-05T16:28:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `scripts/seedLongBeachBakersfieldCA.js` modeled exactly on `scripts/seedOaklandSanJoseCA.js`
- Long Beach municipality row upserted with population=451000, population_year=2024, county_id=LA_COUNTY_ID
- Bakersfield municipality row inserted with population=417000, population_year=2024, county_id=NULL
- All four data_source rows inserted and verified via `treasury_list_source_ids` RPC
- Second run confirmed idempotent: all rows show `(updated existing ...)` with no duplicates

## Task Commits

Each task was committed atomically:

1. **Task 1: Write seedLongBeachBakersfieldCA.js (two-city seeder)** - `9260c52` (feat)
2. **Task 2: Re-run idempotency check** - no code changes (verification only; idempotency confirmed by second run output)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `scripts/seedLongBeachBakersfieldCA.js` - Idempotent two-city seeder for Long Beach + Bakersfield municipalities and data_source rows; verified via treasury_list_source_ids RPC

## Decisions Made

- Set Long Beach county_id = LA_COUNTY_ID directly in seeder payload — Long Beach appears in the Phase 25 88-city list (verified `seedLACountyLinks.js` line 63) and the LA County municipality UUID is confirmed at line 36 of that script. Direct-set avoids requiring re-run of the Phase 25 county-linker.
- Bakersfield county_id stays NULL — Kern County is not loaded; deferred per CONTEXT.md.
- FY convention for Long Beach (Oct–Sep fiscal year, stored as ending year, D-01) documented via seeder comment only — no DB schema change, no UI change (D-02).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Long Beach municipality already had a DB row (prior seeder run or Phase 25 county-linker created it); the script correctly updated it in-place with the new population and county_id fields. Bakersfield was a new insert. All four data_source rows were new inserts on the first run and updates on the second run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Long Beach municipality row ready: id=9464eab4-c981-4f28-a677-6b9e6c4b7607, state=CA, population=451000, county_id=LA_COUNTY_ID
- Bakersfield municipality row ready: id=3286b941-d34f-462e-90be-d104ef19693d, state=CA, population=417000, county_id=NULL
- Four data_source rows anchoring Plan 02 (Long Beach processor) and Plan 03 (Bakersfield processor) are present in DB
- Plan 02 (processLongBeach.js) and Plan 03 (processBakersfield.js) can proceed — they use `ensureMunicipality()` which looks up by name+state

## Self-Check

- [x] `scripts/seedLongBeachBakersfieldCA.js` exists
- [x] First run exited 0, printed `OK:` for all four data source names
- [x] Second run exited 0, all rows showed `(updated existing ...)` — idempotency confirmed
- [x] Task 1 commit `9260c52` exists in git log

## Self-Check: PASSED

---
*Phase: 29-long-beach-bakersfield-ca-data-load*
*Completed: 2026-06-05*
