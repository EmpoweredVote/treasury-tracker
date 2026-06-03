---
phase: 25-la-county-data-completion-county-city-linking
plan: "03"
subsystem: frontend/components
tags: [county-city-navigation, breadcrumb, CitiesInCountyPanel, App.tsx, react]
dependency_graph:
  requires:
    - 25-02 (county_id FK in municipalities + Municipality TypeScript type)
  provides:
    - src/components/CitiesInCountyPanel.tsx
    - county breadcrumb chip on city pages (D-09)
    - Cities in [County] panel on county pages (D-07, D-08)
    - Fixed breadcrumb render condition for top-level city view
  affects:
    - src/App.tsx (countyEntity useMemo, breadcrumbItems, render condition, panel injection)
decisions:
  - "Forward-port county_id from Plan 02 branch — worktree was based on main (pre-25-02), so county_id was absent from Municipality type; added as Rule 3 fix"
  - "Used municipalities.find() for county lookup — never hardcoded LA County UUID (T-25-08 mitigation)"
  - "Pre-existing posthog-js build failure documented as out-of-scope; tsc --noEmit passes clean"
tech_stack:
  added: []
  patterns:
    - "useMemo-derived countyEntity from municipalities.find(m.id === selectedEntity.county_id)"
    - "Breadcrumb prepend pattern: county item pushed first when countyEntity non-null"
    - "Available now / Coming soon split by available_datasets.length > 0"
key_files:
  created:
    - src/components/CitiesInCountyPanel.tsx
  modified:
    - src/App.tsx
    - src/types/budget.ts
metrics:
  duration: "~30 minutes"
  completed: "2026-06-02"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 3
---

# Phase 25 Plan 03: County-City Bidirectional Navigation Summary

County breadcrumb chip and "Cities in [County]" roster panel wired into the app — city pages show a clickable county chip (even at top level), county pages show budget then a two-section Available now / Coming soon panel of their incorporated cities. No county UUID hardcoded anywhere.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify ev-accounts-api returns county_id | (pre-resolved) | — |
| 2 | Create CitiesInCountyPanel component | 86b0fab | src/components/CitiesInCountyPanel.tsx, src/types/budget.ts |
| 3 | Wire county breadcrumb + panel into App.tsx | 0103c85 | src/App.tsx |
| 4 | Checkpoint: visual verification | — | awaiting user |

## Decisions Made

- **county_id forward-port:** Worktree was branched from `41f6e27` (main), which predates the Plan 02 commits on a parallel worktree branch. `county_id` was absent from `Municipality`. Added it as a Rule 3 deviation (blocking dependency). The change matches exactly what Plan 02 committed (`8ae2087`).
- **No hardcoded UUID:** County entity resolved entirely via `municipalities.find(m => m.id === selectedEntity.county_id)`. Grep confirms `f3db6f9f` does not appear in `src/App.tsx`.
- **Breadcrumb index arithmetic:** Followed PATTERNS.md modified useMemo pattern using `items.length - 1` for the dataset item and `index + items.length - navigationPath.length + index` for navigation path items, so existing drill-down breadcrumbs continue working when county prefix shifts indices.
- **CitiesInCountyPanel guard:** `navigationPath.length === 0 && selectedEntity?.entity_type === 'county'` — panel only appears at top-level county view, not while drilling into categories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forward-ported county_id to Municipality type**
- **Found during:** Task 2 — creating CitiesInCountyPanel, tsc would fail without county_id on Municipality
- **Issue:** Worktree branched from `main` at `41f6e27`, which predates Plan 02's `county_id` addition to `src/types/budget.ts`. The Plan 02 summary confirms `8ae2087` added `county_id?: string | null` to Municipality, but that commit is on the Plan 02 worktree branch, not yet merged to main.
- **Fix:** Added `county_id?: string | null; // UUID reference to parent county municipality row` to the Municipality interface — identical to Plan 02's change.
- **Files modified:** src/types/budget.ts
- **Commit:** 86b0fab (bundled with CitiesInCountyPanel in Task 2 commit)

### Pre-existing Issues (Deferred)

- **posthog-js missing:** `npm run build` fails with `Cannot find module 'posthog-js/react'` in `src/main.tsx`. Pre-dates this plan (confirmed by reverting and re-running build). `npx tsc --noEmit` passes 0 errors. Deferred — out of scope for this plan.

## Verification Results

- `npx tsc --noEmit`: 0 errors
- `npm run build`: fails on pre-existing posthog-js issue (not caused by these changes)
- No hardcoded county UUID in src/App.tsx (grep confirms)
- CitiesInCountyPanel: filter uses `m.county_id === county.id && m.entity_type === 'city'`
- CitiesInCountyPanel: returns null when cities.length === 0 (D-08 / Pitfall 6)
- App.tsx render condition: `(countyEntity != null || breadcrumbItems.length > 2)`
- App.tsx panel guard: `navigationPath.length === 0 && selectedEntity?.entity_type === 'county'`

## Threat Flags

None. All trust boundaries from the plan's threat model were mitigated per task:
- T-25-07 (county_id absent from API): Resolved in Task 1 — field confirmed present
- T-25-08 (hardcoded county id): Mitigated — county resolved via municipalities.find; no UUID in App.tsx
- T-25-09 (empty roster): Mitigated — CitiesInCountyPanel returns null when cities.length === 0

## Self-Check: PASSED

- src/components/CitiesInCountyPanel.tsx: FOUND
- src/App.tsx: modified — FOUND
- src/types/budget.ts: modified — FOUND
- Commit 86b0fab: FOUND
- Commit 0103c85: FOUND
- No hardcoded f3db6f9f in App.tsx: CONFIRMED
