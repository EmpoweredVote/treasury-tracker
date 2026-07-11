---
phase: 129-data-model-load-enrichment
plan: "01"
subsystem: database
tags: [supabase, postgres, municipalities, census, arizona, tucson, pima-county]

# Dependency graph
requires:
  - phase: 128-recon-extractor
    provides: locked FY2015-FY2024 window + extractTucson.py (not consumed by this plan, but the milestone's prerequisite recon)
provides:
  - Tucson city municipality row (AZ, population 554013 / 2024)
  - Pima County navigation node (AZ, population 1080149 / 2024)
  - Tucson.county_id -> Pima County.id link (US -> Arizona -> Pima County -> Tucson breadcrumb)
affects: [129-02-load, 129-03-enrichment, 130-verification-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single idempotent seeder script covering both a city upsert and a county reuse-or-create + link, built incrementally task-by-task in the same file (seedTucsonArizona.js)"

key-files:
  created: [scripts/seedTucsonArizona.js]
  modified: []

key-decisions:
  - "Pinned real Census Vintage 2024 figures via direct curl to www2.census.gov CSV datasets (co-est2024-alldata.csv, sub-est2024.csv) rather than the ~542,000/~1,063,000 placeholders in planning docs — Tucson city POPESTIMATE2024=554013 (STATE=04, PLACE=77000), Pima County POPESTIMATE2024=1080149 (STATE=04, COUNTY=019)"
  - "Pima County created via treasury_ensure_municipality with the real population directly (not 0), then explicitly re-set population+population_year every run as a safety net since the RPC's population_year handling is unverified"
  - "Task 1 and Task 2 committed as separate atomic commits against the same file (task 1 = Tucson upsert only; task 2 = extends with Pima County + link), matching the plan's task boundaries"

patterns-established:
  - "seedGreshamOregon.js upsert pattern + seedCountyLinks.js reuse-or-create/NULL-or-same-guard pattern combined in one seeder file for a one-off city+county pair"

requirements-completed: [TUC-03, TUC-04]

# Metrics
duration: 35min
completed: 2026-07-10
---

# Phase 129 Plan 01: Data model — Tucson city + Pima County navigation node Summary

**Idempotent seeder (`scripts/seedTucsonArizona.js`) creates Tucson (AZ, pop 554,013) + Pima County nav node (AZ, pop 1,080,149) and links them via `county_id`, both pinned to real Census Vintage 2024 estimates fetched live from www2.census.gov.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-10T16:29:40Z
- **Completed:** 2026-07-10T17:05:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 1 (scripts/seedTucsonArizona.js)

## Accomplishments
- Tucson city municipality seeded (AZ, population 554,013 / 2024) via an idempotent select-by-name+state upsert
- Pima County navigation node seeded (AZ, population 1,080,149 / 2024) via `treasury_ensure_municipality`, reused (not duplicated) on re-run
- Tucson linked to Pima County via `county_id`, with a NULL-or-same guard that never silently repoints a city already linked elsewhere
- Full `US -> Arizona -> Pima County -> Tucson` chain confirmed live in the DB
- Both real 2024 Census population figures pinned from live-fetched Census Bureau source CSVs (not the planning docs' rounded placeholders)
- Idempotency proven: script run twice, second run took the update/reuse/already-linked branches with 0 net change; still 0 `data_source` rows after both runs

## Task Commits

Each task was committed atomically:

1. **Task 129-01-01: Tucson city upsert** - `3911281` (feat)
2. **Task 129-01-02: Pima County nav node + link** - `33f0bf1` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/seedTucsonArizona.js` - Idempotent seeder: Tucson city upsert (task 1) extended with Pima County reuse-or-create + county_id link (task 2). No `data_source` rows created (owned by `processTucson.js`, Phase 129-02).

## Decisions Made
- **Population figures pinned via live Census API/CSV fetch, not invented or left at planning-doc placeholders.** The plan/context docs cited approximate values (~542,000 for Tucson, ~1,063,000 for Pima County — those were Vintage 2023 figures). No `WebFetch`/`WebSearch` tool was available in this environment, so the Bash tool's outbound network access was used to `curl` the Census Bureau's public Vintage 2024 datasets directly:
  - `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv` → Tucson city, AZ (SUMLEV=162, STATE=04, PLACE=77000): POPESTIMATE2024 = **554,013**
  - `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv` → Pima County, AZ (STATE=04, COUNTY=019): POPESTIMATE2024 = **1,080,149**
  These are the actual pinned 2024 vintage values, sourced in code comments per the plan's requirement to never invent a number.
- Pima County was created via `treasury_ensure_municipality` with the real population passed directly (rather than the `seedCountyLinks.js` convention of seeding 0 and backfilling), then the population + `population_year=2024` are explicitly re-asserted on every run as a safety net, since the RPC's handling of `population_year` was not independently verified.
- Task 1 and Task 2 were implemented and committed as two separate atomic commits against the same file, mirroring the plan's task decomposition (each task's acceptance criteria were independently run and verified before committing).

## Deviations from Plan

None - plan executed exactly as written. The only judgment call was the population-sourcing method above (Rule 2/blocking-issue class: the plan required a real pinned Census figure but provided no local file or exact number — resolved by fetching the authoritative live Census dataset directly, matching the plan's explicit "note the source in a comment" instruction).

## Issues Encountered
- No `WebFetch`/`WebSearch` tool was available in this executor's toolset to look up the exact Census figures. Resolved by using the Bash tool's outbound network access to `curl` the Census Bureau's own public CSV datasets directly — a more authoritative source than a search result would have been, and one that yields the exact same file the `seedGreshamOregon.js` precedent (Gresham's `sub-est2024_41.csv`) was pinned from.

## User Setup Required

None - no external service configuration required. (Required `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` were already present in the project's existing `.env`.)

## Next Phase Readiness
- Tucson (city, id `e97d7a75-7a27-4b21-ac5e-667b16930a8f`) and Pima County (county, id `b799043e-28f6-4229-9480-8d6b7e329d26`) are both live in `treasury.municipalities`, linked via `county_id`, ready for Plan 129-02 (`processTucson.js`) to load GF operating + revenue data against the Tucson municipality id.
- No blockers. No schema change, no budget rows, no `data_source` rows were created by this plan (as required — those are Plan 129-02's responsibility).

---
*Phase: 129-data-model-load-enrichment*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: scripts/seedTucsonArizona.js
- FOUND: commit 3911281 (Task 129-01-01)
- FOUND: commit 33f0bf1 (Task 129-01-02)
