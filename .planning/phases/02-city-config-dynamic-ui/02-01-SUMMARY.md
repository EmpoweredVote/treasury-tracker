---
phase: 02-city-config-dynamic-ui
plan: 01
subsystem: ui
tags: [react, typescript, config, multi-city, routing]

# Dependency graph
requires:
  - phase: 01-routing-shell-data-namespacing
    provides: CityPage component with slug prop, data loading by city slug
provides:
  - CityConfig TypeScript interface and DatasetId type (src/config/types.ts)
  - Bloomington city config with all required fields (src/config/cities/bloomington.ts)
  - CITY_REGISTRY array with getCityConfig() lookup (src/config/cityRegistry.ts)
  - All UI components reading from config instead of hardcoded strings
affects:
  - 02-02 (phase 2 plan 2 - remaining dynamic UI work if any)
  - 03-data-pipeline
  - 04-la-data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CityConfig interface as single source of truth for per-city values
    - CITY_REGISTRY.map() for dynamic route and card generation
    - isComingSoon flag on config to gate routing and show disabled UI
    - getCityConfig(slug) lookup with post-hooks Navigate guard for unknown slugs

key-files:
  created:
    - src/config/types.ts
    - src/config/cities/bloomington.ts
    - src/config/cityRegistry.ts
  modified:
    - src/pages/CityPage.tsx
    - src/pages/CityPickerPage.tsx
    - src/AppRouter.tsx
    - src/components/datasets/DatasetTabs.tsx

key-decisions:
  - "getCityConfig guard placed after all hooks (not before) to comply with React rules of hooks"
  - "cityConfig.hasTransactions gates LinkedTransactionsPanel rendering — LA gets no transactions UI without data"
  - "LA placeholder included in CITY_REGISTRY with isComingSoon:true so city picker shows it as disabled, but AppRouter filters it out"
  - "availableDatasets prop on DatasetTabs filters DATASETS constant to visibleDatasets — future cities can omit tabs"

patterns-established:
  - "Config-first rendering: CityPage reads all per-city values from cityConfig, never from hardcoded strings"
  - "Registry-driven routing: AppRouter generates routes from CITY_REGISTRY.filter(!isComingSoon).map()"
  - "Graceful unknown-slug: getCityConfig returns undefined, Navigate to / after hooks complete"

requirements-completed: [CITY-01, CITY-02, CITY-03]

# Metrics
duration: 25min
completed: 2026-03-22
---

# Phase 02 Plan 01: City Config Dynamic UI Summary

**CityConfig interface + Bloomington config + CITY_REGISTRY wired to all 7 hardcoded Bloomington locations across CityPage, DatasetTabs, CityPickerPage, and AppRouter**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-22T04:27:37Z
- **Completed:** 2026-03-22T04:52:00Z
- **Tasks:** 2 (+ 1 auto-fix deviation)
- **Files modified:** 7

## Accomplishments

- Created 3 new config files: CityConfig interface with 11 fields, Bloomington config with all correct values, CITY_REGISTRY with LA coming-soon placeholder and getCityConfig() lookup
- Wired all 7 hardcoded Bloomington locations across 4 UI files — no hardcoded city strings remain in the UI layer
- Added hasTransactions gate on LinkedTransactionsPanel so LA city won't accidentally show a broken transactions panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CityConfig type, Bloomington config, and city registry** - `46c04f0` (feat)
2. **Task 2: Wire all 7 hardcoded locations to use city config** - `b40afc9` (feat)
3. **Deviation fix: Move cityConfig guard after hooks** - `9d60a34` (fix)

**Plan metadata:** (committed with this SUMMARY)

## Files Created/Modified

- `src/config/types.ts` - DatasetId union type and CityConfig interface (11 fields)
- `src/config/cities/bloomington.ts` - Bloomington config satisfying CityConfig interface
- `src/config/cityRegistry.ts` - CITY_REGISTRY array, LA placeholder with isComingSoon, getCityConfig() lookup
- `src/pages/CityPage.tsx` - Reads heroImageUrl, heroTitle, availableYears, defaultYear, population, availableDatasets, hasTransactions from cityConfig
- `src/components/datasets/DatasetTabs.tsx` - Added DatasetId import and availableDatasets prop; filters DATASETS to visibleDatasets
- `src/pages/CityPickerPage.tsx` - CITY_REGISTRY.map() replaces hardcoded Bloomington/LA cards
- `src/AppRouter.tsx` - CITY_REGISTRY.filter(!isComingSoon).map() replaces hardcoded /bloomington route

## Decisions Made

- `getCityConfig` guard placed after all hooks (Navigate rendered after displayText assignment) — React rules of hooks requires all hooks before any conditional return
- LA placeholder in CITY_REGISTRY with `isComingSoon: true` shows in city picker as disabled card but is filtered from AppRouter routes
- `cityConfig.hasTransactions` gates LinkedTransactionsPanel — prevents broken transactions UI for cities without transaction data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React rules-of-hooks violation in CityPage**
- **Found during:** Task 2 (CityPage wiring)
- **Issue:** Plan specified `if (!cityConfig) return <Navigate />` before useState hooks, which violates React's rules of hooks (conditional return before hook calls)
- **Fix:** Moved Navigate guard to after all hooks and displayText computation; useState uses optional chaining fallbacks (`cityConfig?.availableDatasets[0] ?? 'operating'`)
- **Files modified:** src/pages/CityPage.tsx
- **Verification:** TypeScript compiles clean, Vite build succeeds
- **Committed in:** `9d60a34` (separate fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential correctness fix. Plan pattern would silently break in React strict mode; optional chaining fallbacks ensure hooks always run with stable values.

## Issues Encountered

- `node_modules/.bin` symlinks not available in WSL for this Windows path — used `node node_modules/typescript/bin/tsc` and `node node_modules/vite/bin/vite.js build` directly. Both passed cleanly.

## Known Stubs

None — all config fields are wired with real Bloomington values. LA placeholder uses `isComingSoon: true` which is intentional (not a rendering stub).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All UI files now read from CityConfig — adding a new city requires only a config file + registry entry
- DatasetTabs filters by availableDatasets — LA can have a subset of tabs when its data lands
- LinkedTransactionsPanel fully gated by hasTransactions flag
- Phase 02 plan 02 (if any) can build on this config system
- Phase 03 (data pipeline) can proceed independently

---
*Phase: 02-city-config-dynamic-ui*
*Completed: 2026-03-22*
