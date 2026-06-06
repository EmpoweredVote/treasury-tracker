---
phase: 31-anaheim-santa-ana-ca-data-load
plan: 01
subsystem: database
tags: [supabase, nodejs, seeder, municipalities, data_sources, california, anaheim, santa-ana]

# Dependency graph
requires:
  - phase: 30-fresno-riverside-ca-data-load
    provides: seedFresnoRiversideCA.js — canonical two-city seeder pattern copied verbatim
provides:
  - Anaheim, CA municipality row in treasury.municipalities (population=344000, population_year=2024, county_id=NULL)
  - Santa Ana, CA municipality row in treasury.municipalities (population=312000, population_year=2024, county_id=NULL)
  - Four canonical data_source rows verified via treasury_list_source_ids RPC
  - scripts/seedAnaheimSantaAnaCA.js — idempotent two-city seeder
affects:
  - 31-02 (processAnaheim.js looks up Anaheim municipality row and data_source by exact canonical name)
  - 31-03 (processSantaAna.js looks up Santa Ana municipality row and data_source by exact canonical name)
  - 31-04 (enrichCategories.js needs municipality rows to exist for enrichment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-city seeder: upsertMunicipality() + upsertDataSourceByName() + treasury_list_source_ids verification"
    - "loadEnv() reads ../.env.local then ../.env; never logs key values; skips ENOENT silently"
    - "county_id NULL pattern for cities whose county is not yet loaded in the project"

key-files:
  created:
    - scripts/seedAnaheimSantaAnaCA.js
  modified: []

key-decisions:
  - "Population values from Census sub-est2024_06.csv: 344000 for Anaheim, 312000 for Santa Ana — not REQUIREMENTS.md approximations (348K/335K were stale)"
  - "county_id stays NULL for both cities — Orange County not loaded; do not create Orange County municipality row"
  - "Canonical data_source names are the contract between seeder and Plan 02/03 processors — must match character-for-character"

patterns-established:
  - "Phase 31 seeder: exact copy of Phase 30 seedFresnoRiversideCA.js structure with city names swapped"

requirements-completed: [POPUL-02]

# Metrics
duration: 15min
completed: 2026-06-05
---

# Phase 31 Plan 01: Anaheim + Santa Ana CA Seeder Summary

**Anaheim (population=344000) and Santa Ana (population=312000) municipality rows and four canonical data_source rows (GF operating + revenue per city) seeded and verified via treasury_list_source_ids RPC**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-05T22:55:00Z
- **Completed:** 2026-06-05T23:10:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Wrote `scripts/seedAnaheimSantaAnaCA.js` adapted from Phase 30 analog with correct city names, IDs, and Census 2024 population values
- Seeder ran live: both municipality rows inserted, all four canonical data_source rows created, treasury_list_source_ids returned OK for all four names
- Idempotency confirmed: second run showed "updated existing" for all six rows with no duplicates

## Task Commits

Each task was committed atomically:

1. **Task 1: Write scripts/seedAnaheimSantaAnaCA.js (two-city seeder)** - `9d15a87` (feat)
2. **Task 2: Run seeder live + verify all four data_source rows in DB** - DB-only (no file changes; verification output captured in run log)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `scripts/seedAnaheimSantaAnaCA.js` - Idempotent two-city seeder for Anaheim + Santa Ana municipalities and 4 data_source rows

## Decisions Made
- Used Census 2024 annual estimate round numbers (344000 and 312000) matching the sub-est2024_06.csv values, not the REQUIREMENTS.md approximations (348K and 335K) which were pre-Census-release estimates. Per RESEARCH.md Pitfall 5.
- county_id omitted (stays NULL) for both cities: Orange County has not been loaded into the project. Per RESEARCH.md Pitfall 7.
- base_url included on every data_source row (NOT NULL column discovered in Phase 30 Plan 01).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — seeder ran clean on first attempt. Both runs exited 0.

## Seeder Run Output (First Run)

```
Seeding Anaheim + Santa Ana CA (Phase 31) — municipalities + data_sources...

Upserting municipality: Anaheim, CA
  (inserted new municipality row)
  id: 7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5

Upserting municipality: Santa Ana, CA
  (inserted new municipality row)
  id: 2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3

Upserting data_source rows...
  Upserting: Anaheim General Fund Operating Budget
  (inserted new row)
  id=168e3337-ed1e-4621-aefe-322ed00ecb04  api_type=pdf_download  dataset_type=operating

  Upserting: Anaheim General Fund Revenue Budget
  (inserted new row)
  id=c9974b0b-9c28-4855-a9d0-447c122f16e6  api_type=pdf_download  dataset_type=revenue

  Upserting: Santa Ana General Fund Operating Budget
  (inserted new row)
  id=1960192a-eed5-4ccf-aeb9-39e1dbcdcfbf  api_type=pdf_download  dataset_type=operating

  Upserting: Santa Ana General Fund Revenue Budget
  (inserted new row)
  id=e6cd7a62-5a55-48fd-905d-1cc088cc7384  api_type=pdf_download  dataset_type=revenue

Verifying via treasury_list_source_ids RPC...
  OK: Anaheim General Fund Operating Budget (api_type=pdf_download, type=operating)
  OK: Anaheim General Fund Revenue Budget (api_type=pdf_download, type=revenue)
  OK: Santa Ana General Fund Operating Budget (api_type=pdf_download, type=operating)
  OK: Santa Ana General Fund Revenue Budget (api_type=pdf_download, type=revenue)

Done.
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Anaheim and Santa Ana municipality rows are in the DB with correct 2024 population data
- Four canonical data_source rows exist with exact names Plan 02/03 processors will look up
- Municipality IDs captured: Anaheim=7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5, Santa Ana=2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3
- Plan 02 (processAnaheim.js) and Plan 03 (processSantaAna.js) are unblocked — PDFs must be downloaded to docs/Anaheim/ and docs/Santa Ana/ before those plans run

---
*Phase: 31-anaheim-santa-ana-ca-data-load*
*Completed: 2026-06-05*
