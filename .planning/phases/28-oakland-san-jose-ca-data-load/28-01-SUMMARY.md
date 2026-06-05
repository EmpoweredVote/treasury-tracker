---
phase: 28-oakland-san-jose-ca-data-load
plan: 01
subsystem: database
tags: [supabase, nodejs, esmodule, seeder, idempotent, california, oakland, san-jose]

# Dependency graph
requires:
  - phase: 16-california-cities
    provides: upsertMunicipality + upsertDataSourceByName patterns; loadEnv() pattern from seedSacramentoCA.js; treasury_list_source_ids RPC
provides:
  - Oakland municipality row (state=CA, population=444000, population_year=2024, id=aa7c409d-82a7-4f7b-8f5e-4efe76507bd2)
  - San Jose municipality row (state=CA, population=997000, population_year=2024, id=da2ed173-3e28-45de-bd94-369b0f9c5532)
  - "Oakland General Purpose Fund Operating Budget" data_source row (pdf_download, id=4a70fe45-1604-4a4c-a874-3fed4a8fd05c)
  - "Oakland General Purpose Fund Revenue Budget" data_source row (pdf_download, id=12938a6d-da7a-4776-a50d-fef8b37e4c50)
  - "San Jose General Fund Operating Budget" data_source row (pdf_download, id=8015c41a-7978-4371-bb51-cddcf19a5e78)
  - "San Jose General Fund Revenue Budget" data_source row (pdf_download, id=3b2b5e54-9380-4ba5-9b7a-60b7dd0dc214)
affects: [28-02, 28-03, 28-04, processOakland.js, processSanJose.js, treasury_list_source_ids]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - loadEnv() reads ../.env.local then ../.env, sets process.env only if not already set
    - upsertMunicipality() SELECT-then-INSERT/UPDATE by (name, state) — prevents duplicates (Pitfall 7)
    - upsertDataSourceByName() SELECT-then-INSERT/UPDATE by name — idempotent canonical row creation
    - D-06 Oakland fund label invariant: "General Purpose Fund" never "General Fund"

key-files:
  created:
    - scripts/seedOaklandSanJoseCA.js
  modified: []

key-decisions:
  - "Oakland canonical fund label is 'General Purpose Fund' (GPF) — enforced in data_source names and tree node fund field (D-06)"
  - "county_id stays NULL for Oakland (Alameda County) and San Jose (Santa Clara County) — counties not yet loaded in DB (deferred per CONTEXT.md)"
  - "Per-FY pdf_download rows are NOT created here — processors (Plans 02/03) create them internally; seeder creates only canonical named rows"

patterns-established:
  - "Canonical data_source row naming: '{City} {Fund Name} {Operating|Revenue} Budget'"
  - "Oakland data_source dataset_id uses 'gpf' abbreviation: 'oakland-gpf-operating', 'oakland-gpf-revenue'"
  - "San Jose data_source dataset_id: 'sanjose-gf-operating', 'sanjose-gf-revenue'"
  - "Oakland municipality id: aa7c409d-82a7-4f7b-8f5e-4efe76507bd2"
  - "San Jose municipality id: da2ed173-3e28-45de-bd94-369b0f9c5532"

requirements-completed: [POPUL-01, DATA-02, DATA-03]

# Metrics
duration: 8min
completed: 2026-06-04
---

# Phase 28 Plan 01: Oakland + San Jose Seeder Summary

**Idempotent seeder creates Oakland (444K) and San Jose (997K) municipality rows plus four canonically-named pdf_download data_source rows verified via treasury_list_source_ids RPC**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-04T00:00:00Z
- **Completed:** 2026-06-04
- **Tasks:** 2 (1 code task + 1 verification task)
- **Files modified:** 1

## Accomplishments

- Oakland municipality row seeded with population=444000, population_year=2024, state=CA (POPUL-01)
- San Jose municipality row seeded with population=997000, population_year=2024, state=CA (POPUL-01)
- Four data_source rows created with exact canonical names: Oakland GPF operating+revenue, San Jose GF operating+revenue (DATA-02, DATA-03)
- Seeder verified idempotent on second run — all six upserts took the UPDATE branch, no duplicates
- DB queries confirmed exactly one row per municipality and per data_source name with correct values

## Task Commits

Each task was committed atomically:

1. **Task 1: Create seedOaklandSanJoseCA.js with municipality + data_source upserts** - `cf7cce7` (feat)
2. **Task 2: Verify idempotency and DB state via second run** - (no code changes; verification only, covered by Task 1 commit)

**Plan metadata:** (SUMMARY commit — see final_commit)

## Files Created/Modified

- `scripts/seedOaklandSanJoseCA.js` - Idempotent municipality + data_source seeder for Oakland and San Jose; loadEnv(); upsertMunicipality(); upsertDataSourceByName(); treasury_list_source_ids verification

## Decisions Made

- Oakland fund label invariant D-06 applied: all data_source names use "General Purpose Fund", never "General Fund"
- county_id intentionally left NULL for both cities — deferred to a future phase (Alameda County and Santa Clara County not yet loaded)
- Seeder creates only canonical named rows; per-FY pdf_download rows are created by the processors in Plans 02 and 03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Seeder reads credentials from `.env` / `.env.local` automatically.

## Known Stubs

None - this plan creates DB foundation rows; no UI rendering involved.

## Threat Flags

None - no new network endpoints or auth paths introduced. Secret handling matches established pattern (T-28-01: SUPABASE_SERVICE_KEY read via loadEnv(), never logged).

## Next Phase Readiness

- Plans 02 and 03 can now proceed: Oakland and San Jose municipality rows exist with correct IDs
- Four canonical data_source rows exist and are verified via treasury_list_source_ids
- Oakland municipality id: `aa7c409d-82a7-4f7b-8f5e-4efe76507bd2`
- San Jose municipality id: `da2ed173-3e28-45de-bd94-369b0f9c5532`
- processOakland.js should look up data_source by name 'Oakland General Purpose Fund Operating Budget' (and Revenue)
- processSanJose.js should look up data_source by name 'San Jose General Fund Operating Budget' (and Revenue)

---
*Phase: 28-oakland-san-jose-ca-data-load*
*Completed: 2026-06-04*
