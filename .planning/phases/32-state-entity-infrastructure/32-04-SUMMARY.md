---
phase: 32-state-entity-infrastructure
plan: "04"
subsystem: entity-switcher + treasury-service
tags: [uat-gap-fix, entity-switcher, getCities, available_datasets, carver-ma]
dependency_graph:
  requires: [32-03]
  provides: [INFRA-03]
  affects: [EntitySwitcher.tsx, C:/EV-Accounts/backend/src/lib/treasuryService.ts]
tech_stack:
  added: []
  patterns: [HAVING COUNT SQL filter, defensive frontend guard on available_datasets.length]
key_files:
  created: []
  modified:
    - src/components/EntitySwitcher.tsx
    - C:/EV-Accounts/backend/src/lib/treasuryService.ts
decisions:
  - "HAVING COUNT(b.id) > 0 in getCities() is the authoritative fix; frontend guard is a defensive layer against future seed/load drift"
  - "LEFT JOIN preserved — HAVING filter achieves same exclusion without breaking json_agg aggregation structure"
  - "totalCount updated to reflect browsable jurisdictions, not raw including-empty total"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-06"
  tasks: 2
  files: 2
---

# Phase 32 Plan 04: Empty-Dataset Municipality Filter Summary

Fix: municipalities with no budget data (e.g. Carver, MA) excluded from EntitySwitcher dropdown at both the backend SQL layer and the frontend defensive guard layer — closing UAT gap Test 3.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Filter getCities() to municipalities with at least one budget record | 9e7f1a3 (ev-accounts-api) | C:/EV-Accounts/backend/src/lib/treasuryService.ts |
| 2 | Add available_datasets defensive guard in EntitySwitcher useMemo | 12b359f | src/components/EntitySwitcher.tsx |

## What Was Built

**Task 1 — Backend HAVING filter (authoritative fix)**

In `getCities()` in `C:/EV-Accounts/backend/src/lib/treasuryService.ts`, added a single line between `GROUP BY m.id` and `ORDER BY m.name`:

```sql
HAVING COUNT(b.id) > 0
```

This converts the LEFT JOIN result so that only municipalities with at least one row in `treasury.budgets` are returned. Municipalities that were seeded (municipality row exists) but never had budget data loaded (e.g. Carver, MA) are excluded from the API response. The LEFT JOIN and `json_agg` aggregation structure are unchanged. `getCityById()` is not affected — direct UUID lookups continue to return any municipality by ID.

**Task 2 — Frontend defensive guard**

In `src/components/EntitySwitcher.tsx`, inside the `grouped` useMemo, added a `withData` filter step between the text-search filter and the `stateEntities`/`cityEntities` split:

```ts
const withData = filtered.filter(m => m.available_datasets && m.available_datasets.length > 0);
```

`stateEntities` and `cityEntities` now operate on `withData` instead of `filtered`. The `totalCount` line also updated to reflect only municipalities with budget data, keeping the search placeholder count accurate.

## Verification Results

1. Backend HAVING clause present:
   `grep -n "HAVING COUNT" C:/EV-Accounts/backend/src/lib/treasuryService.ts` → 1 match at line 394

2. Backend TypeScript clean (treasuryService.ts):
   `npx tsc --noEmit` in C:/EV-Accounts/backend — 0 errors in treasuryService.ts (2 pre-existing errors in unrelated files: coverageService.ts and stanceResearchCsv.ts)

3. Frontend available_datasets guard present:
   `grep -n "available_datasets" src/components/EntitySwitcher.tsx` → 2 matches (lines 69 and 97)

4. Frontend build clean:
   `npm run build` exits 0 (chunk size warning is pre-existing, unrelated)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both changes are complete and wired; no placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. HAVING filter is read-only query optimization.

## Self-Check: PASSED

- `src/components/EntitySwitcher.tsx` exists and contains `available_datasets` guard at lines 69 and 97
- `C:/EV-Accounts/backend/src/lib/treasuryService.ts` exists and contains `HAVING COUNT(b.id) > 0` at line 394
- Task 1 commit: 9e7f1a3 (ev-accounts-api repo)
- Task 2 commit: 12b359f (treasury-tracker repo)
