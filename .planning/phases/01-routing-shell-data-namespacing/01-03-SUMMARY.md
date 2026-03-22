---
phase: 01-routing-shell-data-namespacing
plan: 03
subsystem: ui
tags: [react, typescript, error-handling, usestate, useeffect]

# Dependency graph
requires:
  - phase: 01-routing-shell-data-namespacing
    provides: CityPage.tsx with data loading via loadDataset, error UI at line 227 (unreachable before this fix)

provides:
  - Reachable error UI in CityPage when any data fetch fails
  - loadError boolean state separating loading, error, and success paths
  - setLoadError(false) reset on dataset/year change so retries clear error state

affects: [02-city-config-schema, verification-phase-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-way state machine for async data: loading / error / ready — check error BEFORE loading guard"
    - "loadError reset on dependency change (setLoadError(false) at top of second useEffect) prevents stale error after retry"

key-files:
  created: []
  modified:
    - src/pages/CityPage.tsx

key-decisions:
  - "Error state checked before loading guard — if (loadError) at line 220 appears before if (loading || !operatingBudgetData) at line 235; loading guard can no longer trap error path in infinite spinner"
  - "Both useEffect catch blocks set loadError — first useEffect (operating+revenue totals) and second useEffect (active dataset) both call setLoadError(true) so either fetch failure surfaces the error UI"

patterns-established:
  - "Async fetch error handling: loadError state bypasses null-data loading guard"

requirements-completed: [DATA-03]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 01 Plan 03: Fix Unreachable Error State in CityPage Summary

**Added explicit `loadError` boolean state to CityPage.tsx so fetch failures render the error UI instead of an infinite loading spinner**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-22T01:59:44Z
- **Completed:** 2026-03-22T02:07:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `const [loadError, setLoadError] = useState(false)` to CityPage component state
- Both useEffect catch blocks now call `setLoadError(true)` — first useEffect (operating + revenue totals fetch) and second useEffect (active dataset fetch) both surface errors
- `setLoadError(false)` reset added at top of second useEffect so switching year/dataset after an error clears the stale error state
- New `if (loadError)` guard inserted BEFORE the `if (loading || !operatingBudgetData)` loading guard — fetch failures now reach the error UI instead of being trapped in the spinner
- `npm run build` (TypeScript + Vite) passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add loadError state and fix unreachable error UI in CityPage.tsx** - `1c5979e` (fix)
2. **Task 2: Verify error state is reachable via build** - no new files (build verification only; changes were in Task 1)

## Files Created/Modified

- `src/pages/CityPage.tsx` — Added loadError state, setLoadError calls in both catch blocks, setLoadError(false) reset, and if (loadError) guard before loading guard

## Decisions Made

- Used an explicit `loadError` boolean rather than a sentinel value on `operatingBudgetData` — cleaner separation of concerns, no type-widening required
- Inserted `if (loadError)` check at line 220, before the loading guard at line 235 — this is the minimal structural change that makes the existing error UI (lines 244-256) reachable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run build` shell command fails because `tsc` is not on PATH in the WSL environment (node_modules/.bin/ directory absent from PATH). Resolved by invoking `node_modules/typescript/bin/tsc` and `node node_modules/vite/bin/vite.js` directly. Both exit 0 with zero errors and "built in 4m 14s" (slow due to large data files in WSL).

## User Setup Required

None - no external service configuration required.

## Smoke Test Instructions

To verify the error UI is now reachable (human verification of Truth 7):

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:5173/bloomington` — confirm it loads normally
3. Open browser DevTools > Network tab
4. Rename `public/data/bloomington/budget-2025-linked.json` to `budget-2025-linked.json.bak`
5. Also rename `public/data/bloomington/budget-2025.json` to `budget-2025.json.bak`
6. Reload `/bloomington`
7. Confirm within a few seconds the page shows "Unable to load budget data" heading, the message about checking the console, and a "Back to Cities" link — NOT an infinite "Loading data..." spinner
8. Restore both files: rename `.bak` files back to `.json`
9. Reload `/bloomington` — confirm it loads normally again

## Next Phase Readiness

- Phase 01 gap (Criterion 5 / Truth 7) is now closed — CityPage has a reachable error state
- Phase 02 (city config schema) and subsequent phases can proceed
- No blockers introduced

---
*Phase: 01-routing-shell-data-namespacing*
*Completed: 2026-03-22*
