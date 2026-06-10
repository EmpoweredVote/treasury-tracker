---
phase: 39-ma-population-state-budget-and-enrichment
plan: "01"
subsystem: database
tags: [census, population, massachusetts, supabase, node, csv]

# Dependency graph
requires:
  - phase: 38-ma-city-budget-load
    provides: 351 MA municipalities loaded in treasury.municipalities with state='MA'
provides:
  - scripts/loadMAPopulation.js — MA Census 2024 population loader (SUMLEV=061, dynamic DB list)
  - 351 MA municipalities with population > 0 and population_year = 2024
affects: [per-capita display on MA city pages (PlainLanguageSummary.tsx auto-activates)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic DB-driven city list (query state='MA') instead of hardcoded EXPECTED_CITIES array — scalable to 351 cities"
    - "Case-insensitive Census suffix stripping (.replace(/ town$/i, '')) to handle mixed-case Census names"
    - "SUMLEV=061 for MA New England towns (not SUMLEV=162 which would only match 26 incorporated cities)"

key-files:
  created:
    - scripts/loadMAPopulation.js
  modified: []

key-decisions:
  - "SUMLEV=061 for MA: New England towns appear only at SUMLEV=061; using 162 would only load ~26 of 351 cities"
  - "Dynamic DB query instead of hardcoded city list: 351 municipalities cannot be reasonably maintained as a hardcoded array"
  - "Case-insensitive suffix stripping: Census sub-est2024_25.csv uses 'Agawam Town' (title case) at SUMLEV=061, requiring /i flag"

patterns-established:
  - "Pattern: Dynamic MA municipality list via supabase.from('municipalities').select('id,name').eq('state','MA') — returns 351 cities + 1 state entity (352 total)"
  - "Pattern: normalizeCensusName() with case-insensitive suffix + hyphen-to-space + title-case handles all MA Census names"

requirements-completed: [MA-04]

# Metrics
duration: 5min
completed: 2026-06-10
---

# Phase 39 Plan 01: MA Population Load Summary

**Census 2024 population loaded for all 351 MA municipalities via SUMLEV=061 filter, enabling per-capita ($/resident) display on every MA city page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-10T21:51:25Z
- **Completed:** 2026-06-10T21:55:58Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- Created `scripts/loadMAPopulation.js` — full analog of `loadORPopulation.js` with six MA-specific changes
- Loaded 2024 Census population for all 351 MA municipalities (Updated: 351, Skipped: 0, Failed: 0)
- Confirmed idempotence: second run produces Skipped: 351, Failed: 0
- Boston = 673,458 / Worcester = 211,286 / Cambridge = 121,186 / Springfield = 154,888 (all within ±5% sanity ranges)
- Per-capita display now auto-activates on all 351 MA city pages (population > 0 threshold met)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/loadMAPopulation.js** - `b588ef3` (feat)
2. **Task 2: Live-load population for all 351 MA municipalities** - no code commit (data load only; verified via DB query)

**Plan metadata:** (to be committed with this SUMMARY)

## Files Created/Modified

- `scripts/loadMAPopulation.js` — MA Census 2024 population loader: downloads sub-est2024_25.csv, filters SUMLEV=061, normalizes names (case-insensitive suffix + hyphen-to-space + title-case), queries all MA municipalities from DB dynamically, UPDATEs population + population_year=2024 keyed by UUID, idempotent

## Decisions Made

- Used SUMLEV=061 (not 162): MA New England towns only appear at SUMLEV=061; SUMLEV=162 covers only 26 of 351 municipalities
- Dynamic DB query for city list: `SELECT id, name FROM municipalities WHERE state='MA'` (351 rows) rather than hardcoded array
- Case-insensitive suffix stripping discovered necessary during execution: Census uses "Agawam Town" (title case) at SUMLEV=061

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed case-insensitive suffix stripping in normalizeCensusName()**
- **Found during:** Task 1 verification (--dry-run)
- **Issue:** Original plan spec showed lowercase `.replace(/ town$/, '')`. Census sub-est2024_25.csv SUMLEV=061 rows use "Agawam Town" (capital T), "Barnstable Town", etc. — 13 towns were not matching. The case-insensitive `.replace(/ town$/i, '')` was required to strip "Town" (title-case) and "town" (lowercase) variants.
- **Fix:** Changed all three suffix replacements to case-insensitive: `.replace(/ city$/i, '')`, `.replace(/ town$/i, '')`, `.replace(/ village$/i, '')`
- **Files modified:** scripts/loadMAPopulation.js
- **Verification:** Dry-run after fix showed "Would update: 351, Census rows not in DB: 0" (was 338/13 before fix); Manchester By The Sea correctly appears in would-update list
- **Committed in:** b588ef3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Fix was necessary for correctness — without it, 13 towns (including Barnstable, Agawam, Franklin, Weymouth, etc.) would have been skipped. No scope creep.

## Issues Encountered

- DB returns 352 rows for `WHERE state='MA' AND population > 0` because the Massachusetts state entity (`entity_type='state'`) was pre-loaded by `processMA.js` with `population=7029917, population_year=2024`. This is correct and expected — the 351 MA municipality rows (entity_type='city') all have population > 0 as required. The acceptance criterion "expects 351" refers to municipalities, which is satisfied.

## User Setup Required

None — no external service configuration required. The script runs with the existing `SUPABASE_SERVICE_KEY` from `.env`.

## Next Phase Readiness

- All 351 MA city pages now show per-capita ($/resident) figures — PlainLanguageSummary.tsx auto-activates when population > 0
- Plans 02 (MA State Budget Upgrade) and 03 (Universal Category Enrichment) are independent of this plan and can proceed
- `scripts/loadMAPopulation.js` is idempotent — safe to re-run if needed

---
*Phase: 39-ma-population-state-budget-and-enrichment*
*Completed: 2026-06-10*

## Self-Check: PASSED

- `scripts/loadMAPopulation.js` exists: FOUND
- Commit b588ef3 exists: FOUND (git log confirms)
- DB population count 351 municipalities: VERIFIED (352 total - 1 state entity = 351 municipalities)
- Boston population in range: VERIFIED (673,458, within 660K-730K)
- Idempotence: VERIFIED (second run: Skipped: 351, Failed: 0)
