---
phase: 81-towns-virginia-data-model-linking
plan: 03
subsystem: frontend
tags: [virginia, va, navigation, entity-switcher, counties-panel, towns, ui]

# Dependency graph
requires:
  - phase: 81-02
    provides: "Virginia state node (entity_type='state'), 33 VA towns with county_id set"
  - phase: 81-01
    provides: "34 VA town municipalities (entity_type='town') with budget data"
provides:
  - "EntitySwitcher shows Virginia (data-less state nav node) in State Governments picker section"
  - "CountiesInStatePanel: new component that lists a state's counties with filter box; renders on all state hub pages"
  - "CitiesInCountyPanel: updated filter includes entity_type='town' alongside 'city' — VA county pages list their towns"
  - "App.tsx: CountiesInStatePanel rendered on state pages; all 93 VA counties reachable from Virginia hub"
  - "81-VERIFICATION.md: all four Phase 81 ROADMAP success criteria documented as PASSED"
affects:
  - 82-enrichment-parity
  - 83-verification-source-chain-audit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-less nav node pattern: state/federal entities bypass the withData guard in EntitySwitcher (hub nodes ≠ data leaves)"
    - "CountiesInStatePanel mirrors CitiesInStatePanel pattern: available/coming-soon split, filter box above threshold=24"
    - "County panel rendered before cities panel on state hub pages"

key-files:
  created:
    - "src/components/CountiesInStatePanel.tsx"
    - ".planning/phases/81-towns-virginia-data-model-linking/81-VERIFICATION.md"
  modified:
    - "src/components/EntitySwitcher.tsx"
    - "src/components/CitiesInCountyPanel.tsx"
    - "src/App.tsx"

key-decisions:
  - "State/federal nav nodes bypass withData guard (D-09 confirmed): hub nodes are not data leaves; totalCount unchanged so headline number stays accurate"
  - "CountiesInStatePanel is a new standalone component (not a subsection of CitiesInStatePanel) — clean separation of concerns; CitiesInStatePanel's towns+cities logic is unchanged"
  - "Counties panel rendered before cities panel on state hub: structural (counties → cities → towns) matches the VA hierarchy intuition"
  - "CitiesInCountyPanel comment updated from 'cities only' to reflect the new 'city|town' dual inclusion"

# Metrics
duration: 35min
completed: 2026-06-23
---

# Phase 81 Plan 03: Navigation UI — Virginia Hub, County Picker, Towns in County Summary

**Four surgical frontend edits + 81-VERIFICATION.md: Virginia is selectable in the picker; its hub page lists all counties (filterable) + cities/towns; county pages show linked towns; build passes clean**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 4
- **Files modified/created:** 5 (3 modified, 2 created)

## Accomplishments

- **EntitySwitcher.tsx**: relaxed `withData` filter — state/federal nav nodes always shown regardless of `available_datasets`; ordinary localities still require data; `totalCount` (headline number) unchanged
- **CountiesInStatePanel.tsx** (new): mirrors `CitiesInStatePanel` but filters `entity_type === 'county'` for the state; available/coming-soon split; filter box shown when counties > 24 (VA has 95 total, 93 with data); dark-mode styles consistent with all other panels
- **App.tsx**: imports `CountiesInStatePanel`; renders it before `CitiesInStatePanel` in the `navigationPath.length===0 && entity_type==='state'` block — all state hub pages now show counties panel + cities/towns panel
- **CitiesInCountyPanel.tsx**: filter broadened to `entity_type === 'city' || entity_type === 'town'` — VA county pages (Loudoun, Fairfax) now list their towns alongside cities; CA/MA county pages unaffected
- **81-VERIFICATION.md**: all four Phase 81 ROADMAP success criteria documented as PASSED with concrete evidence (per-capita values, DB row counts, navigation checks, build status); pre-existing Virginia state budget deviation documented for Phase 83

## Task Commits

1. **Task 1: Show data-less state/federal nav nodes in the picker** — `96b2b75` (feat)
2. **Task 2: Add CountiesInStatePanel + render on state hub page** — `d9018af` (feat)
3. **Task 3: Include towns in CitiesInCountyPanel** — `018a768` (feat)
4. **Task 4: 81-VERIFICATION.md — all four success criteria PASSED** — `4babcc3` (docs)

## Files Created/Modified

- `src/components/EntitySwitcher.tsx` — withData filter relaxed for state/federal entity types
- `src/components/CountiesInStatePanel.tsx` — new: counties panel for state hub pages
- `src/components/CitiesInCountyPanel.tsx` — filter: city OR town
- `src/App.tsx` — import + render CountiesInStatePanel on state pages
- `.planning/phases/81-towns-virginia-data-model-linking/81-VERIFICATION.md` — phase verification, PASSED

## Decisions Made

- **withData relaxation scope:** only state/federal — town/city/county/etc. still require data. `totalCount` kept on the original `available_datasets.length > 0` filter so the "N jurisdictions with data" headline is not inflated by nav-hub nodes.
- **CountiesInStatePanel as separate component:** simplest; citiesInStatePanel's filter excludes counties already; adding a parallel panel keeps code readable and avoids coupling two distinct data shapes.
- **Counties rendered first on state hub:** structural order (counties are the intermediate VA navigation level between state and cities/towns); consistent with "US → Virginia → County → Town" hierarchy.

## Deviations from Plan

None — plan executed exactly as written. All four tasks completed; all acceptance criteria satisfied; build passes clean.

## Build Verification

```
npm run build
TypeScript: 0 errors (tsc -b)
Vite: ✓ 2322 modules transformed, built in 6.50s
```

## Virginia Navigation Model — Final Verification Summary

| Check | Result |
|-------|--------|
| Virginia selectable in picker (data-less) | PASS — withData filter relaxed |
| VA hub shows counties panel | PASS — CountiesInStatePanel, 93 available + filter box |
| VA hub shows cities+towns panel | PASS — CitiesInStatePanel unchanged (already includes towns) |
| VA county (Loudoun) lists towns (Leesburg, Purcellville) | PASS — CitiesInCountyPanel filter updated |
| VA county (Fairfax) lists towns (Herndon, Vienna) | PASS — county_id set in 81-02 |
| Town → county breadcrumb (Vienna → Fairfax County) | PASS — jurisdictionParents already handles town→county |
| Alexandria (city) standalone | PASS — county_id=NULL |
| Fairfax County standalone | PASS — county_id=NULL |
| CA/MA county pages regression | PASS — no towns linked to CA/MA counties |
| Build passes | PASS — 0 TS errors, clean Vite build |

## Known Stubs

None.

## Threat Flags

None — this plan only modifies frontend React components (filter logic, new component) and writes a verification document. No new network endpoints, auth paths, schema changes, or trust-boundary modifications.

## Self-Check

- `src/components/EntitySwitcher.tsx` — confirmed modified (withData filter includes state/federal bypass)
- `src/components/CountiesInStatePanel.tsx` — confirmed created (116 lines)
- `src/components/CitiesInCountyPanel.tsx` — confirmed modified (entity_type town filter added)
- `src/App.tsx` — confirmed modified (import + render CountiesInStatePanel)
- `.planning/phases/81-towns-virginia-data-model-linking/81-VERIFICATION.md` — confirmed created
- Commits: 96b2b75, d9018af, 018a768, 4babcc3 — all present in git log

## Self-Check: PASSED
