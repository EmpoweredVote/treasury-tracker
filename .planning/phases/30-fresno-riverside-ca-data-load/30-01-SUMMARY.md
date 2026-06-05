---
phase: 30-fresno-riverside-ca-data-load
plan: 01
subsystem: database
tags: [supabase, seeder, municipalities, data_sources, california, fresno, riverside]

# Dependency graph
requires: []
provides:
  - Fresno municipality row (id=95476f5f, state=CA, population=550000, population_year=2024)
  - Riverside municipality row (id=c17b6fbe, state=CA, population=324000, population_year=2024)
  - Four canonical data_source rows for Fresno + Riverside (GF operating + revenue each)
  - scripts/seedFresnoRiversideCA.js — idempotent two-city seeder
affects:
  - 30-02 (processFresno.js looks up data_source by canonical name via treasury_list_source_ids)
  - 30-03 (processRiverside.js looks up data_source by canonical name via treasury_list_source_ids)
  - 30-04 (enrichment for both cities uses municipality rows)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-city CA seeder pattern (adapted from seedLongBeachBakersfieldCA.js)
    - base_url required on data_source rows (NOT NULL constraint)

key-files:
  created:
    - scripts/seedFresnoRiversideCA.js
  modified: []

key-decisions:
  - "base_url is NOT NULL on data_sources table — added official city budget page URLs for Fresno and Riverside"
  - "county_id stays NULL for both cities — neither Fresno County nor Riverside County is loaded in this phase"
  - "Seeder seeds City of Riverside (pop 324000), not Riverside County (pop ~2.4M)"

patterns-established:
  - "data_sources.base_url must be set even for pdf_download rows — NOT NULL constraint"

requirements-completed: [POPUL-01]

# Metrics
duration: 15min
completed: 2026-06-05
---

# Phase 30 Plan 01: Fresno + Riverside CA Seed Summary

**Fresno (pop 550K) and Riverside (pop 324K) municipality rows + four canonical pdf_download data_source rows seeded and verified in DB via treasury_list_source_ids RPC**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fresno, CA municipality row inserted (id=95476f5f-e652-4674-95c7-b86d2e83ee6f, population=550000)
- Riverside, CA municipality row inserted (id=c17b6fbe-947f-4e7d-9186-b1e65e5d5197, population=324000)
- Four data_source rows seeded with exact canonical names required by Plan 02/03 processors
- All four verified via treasury_list_source_ids RPC (4 OK lines, exits 0)
- Seeder confirmed idempotent (second run shows "updated existing" for all rows)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write scripts/seedFresnoRiversideCA.js** - `a07bc3a` (feat)
2. **Task 2: Run seeder live + fix base_url + verify DB** - `0a7ac12` (fix)

## Files Created/Modified
- `scripts/seedFresnoRiversideCA.js` - Idempotent two-city seeder for Fresno + Riverside (municipalities and 4 data_source rows)

## Decisions Made
- Added `base_url` field to all four data_source rows — the `data_sources.base_url` column has a NOT NULL constraint that is not documented in the plan (auto-fixed per Rule 1)
- Used official city budget page URLs: `https://www.fresno.gov/finance/city-budget/` for Fresno and `https://www.riversideca.gov/finance/budget` for Riverside

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added required base_url field to data_source rows**
- **Found during:** Task 2 (Run the seeder live)
- **Issue:** `data_sources.base_url` has a NOT NULL constraint; plan specified four data_source fields but omitted `base_url`, causing seeder to exit 1 with "null value in column base_url violates not-null constraint"
- **Fix:** Added `base_url` to each of the four data_source objects using official city budget page URLs (Fresno: fresno.gov/finance/city-budget/, Riverside: riversideca.gov/finance/budget)
- **Files modified:** scripts/seedFresnoRiversideCA.js
- **Verification:** Seeder re-run exits 0 with four OK lines; second run shows "updated existing" (idempotent)
- **Committed in:** `0a7ac12` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix for NOT NULL constraint)
**Impact on plan:** Auto-fix necessary for DB correctness. base_url values follow established CA seeder pattern (Oakland, San Jose, Long Beach all set base_url). No scope creep.

## Issues Encountered
- `data_sources.base_url` NOT NULL constraint not documented in plan or PATTERNS.md; discovered at first live run. Auto-fixed per Rule 1.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fresno municipality row ready for Plan 02 (processFresno.js)
- Riverside municipality row ready for Plan 03 (processRiverside.js)
- All four data_source canonical names verified in DB — processors can look them up via treasury_list_source_ids
- No blockers

## Known Stubs
None — this plan creates infrastructure (DB rows) only; no UI-facing data stubs.

## Threat Flags
None — no new network endpoints, auth paths, or trust boundary changes introduced. Service-role key loaded via loadEnv() pattern, never logged (T-30-01 mitigated).

---
*Phase: 30-fresno-riverside-ca-data-load*
*Completed: 2026-06-05*
