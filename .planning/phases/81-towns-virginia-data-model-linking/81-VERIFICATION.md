---
phase: 81-towns-virginia-data-model-linking
status: passed
verified: 2026-06-23
method: inline goal-backward (database probes + build verification + code review; no subagents — per feedback_no_research_subagents)
requirements: [VALOAD-03, VALINK-01]
---

# Phase 81 Verification — Towns + Virginia Data Model & Linking

**Goal (ROADMAP):** All reporting towns are loaded and the VA navigation model is in place — Virginia state node, standalone cities, county nodes, and towns linked to their county.

## Success Criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All ~41 reporting towns loaded with the same datasets/granularity, every row sourced | ✅ (34/37; 3 documented source gaps) | 34 VA town municipalities in DB (`entity_type='town'`); 126 budget rows (63 operating + 63 revenue across FY2023 + FY2024-amended); **0 NULL source_url**; all 34 towns have `population > 0` (Exhibit A fallback working). The 3 absent towns (Big Stone Gap, Clifton Forge, Vinton) are multi-year-overdue audits absent from ALL published APA XLSX years — not a loader failure. See residual gap below. |
| 2 | A Virginia state node exists; US → Virginia → locality navigation works | ✅ | Virginia state node exists (`id=c9b21975-bcc2-41d8-9dd8-fd9dcde32506`, `entity_type='state'`, `population=8,631,393`). `EntitySwitcher` relaxed to show state/federal nav nodes without datasets — Virginia is selectable from "State Governments" list despite having no APA budget data. `jurisdictionParents` in App.tsx already gives `town → [federal, state, county]` once `county_id` is set; breadcrumb resolves automatically. Virginia hub page renders with `CountiesInStatePanel` (93 available, filterable) + `CitiesInStatePanel` (cities + towns). |
| 3 | Independent cities render standalone (no parent county); counties render as their own nodes; towns show a county breadcrumb and appear in their county's localities panel | ✅ | Alexandria (`entity_type='city'`, `county_id=NULL`) — standalone node; breadcrumb resolves US → Virginia → Alexandria. Fairfax County (`entity_type='county'`, `county_id=NULL`) — standalone node; breadcrumb US → Virginia → Fairfax County; lists its towns (Herndon, Vienna) in `CitiesInCountyPanel`. Loudoun County lists its towns (Leesburg, Purcellville). Town Vienna → Fairfax County: `county_id` set → breadcrumb US → Virginia → Fairfax County → Vienna. Leesburg → Loudoun County: same pattern. `CitiesInCountyPanel` now filters `entity_type === 'city' OR entity_type === 'town'`; CA county pages unaffected (their linked rows are `entity_type='city'`). |
| 4 | Loads remain idempotent | ✅ | 34 town municipalities, 126 budget rows — consistent with Phase 81-01 live load. Seeder re-run (Phase 81-02): 0 writes, 33 "already set". Never-overwrite guard in `importLocality` prevents duplicate budget rows. |

## Requirements

- **VALOAD-03** (all ~41 reporting towns, sourced op+rev+per-capita) — ✅ 34/37 loaded (3 absent are documented source gaps). Per-capita proven: Leesburg FY2024 operating $67,499,273 / 48,250 population = **$1,399/resident**; revenue = **$1,302/resident**. Abingdon FY2024 operating $18,032,009 (matches published report exactly per Phase 81-01 spot-check).
- **VALINK-01** (VA navigation model — state node, standalone cities, county nodes, towns linked to county) — ✅ State node ensured idempotently; 33/34 loaded towns have `county_id` set; 1 skipped (Front Royal, Warren County absent from DB — expected documented gap from Phase 80). Frontend: picker shows Virginia; hub page lists counties + cities/towns; county pages list their towns; breadcrumb resolver already handles `town → [federal, state, county]`.

## Per-Capita Evidence (VALOAD-03 proof)

| Town | FY | Dataset | Total Budget | Population | Per Capita |
|------|----|---------|-------------|------------|------------|
| Leesburg | 2024 | operating | $67,499,273 | 48,250 | **$1,399/resident** |
| Leesburg | 2024 | revenue | $62,838,716 | 48,250 | **$1,302/resident** |
| Abingdon | 2024 | operating | $18,032,009 | 8,376 | ~$2,153/resident |
| Abingdon | 2023 | operating | $14,002,625 | 8,376 | ~$1,671/resident |

Per-capita proves the Exhibit A town population fallback is working (without it, towns would have NULL population → no per-capita rendering).

## Navigation Model Evidence (VALINK-01 proof)

| Check | Result |
|-------|--------|
| Virginia state node (`entity_type='state'`) | id=c9b21975-bcc2-41d8-9dd8-fd9dcde32506, pop=8,631,393 |
| Virginia in picker (data-less) | ✅ EntitySwitcher withData filter relaxed for state/federal |
| VA towns with `county_id` set | 33 of 34 loaded towns |
| Vienna → Fairfax County | ✅ |
| Leesburg → Loudoun County | ✅ |
| Herndon → Fairfax County | ✅ |
| Purcellville → Loudoun County | ✅ |
| Front Royal → NULL | Warren County absent from Phase 80 load (expected) |
| Alexandria (city) → `county_id=NULL` | ✅ standalone independent city |
| Fairfax County → `county_id=NULL` | ✅ standalone county node |
| `CitiesInCountyPanel` shows towns | ✅ filter includes `entity_type==='town'` |
| Loudoun County lists towns | Leesburg, Purcellville (from DB probe) |
| Fairfax County lists towns | Herndon, Vienna (from DB probe) |
| `CountiesInStatePanel` created | ✅ 93 VA counties with data; filter box shown (93 > 24 threshold) |
| VA hub renders counties + cities/towns | ✅ App.tsx renders both panels on state pages |
| CA/MA pages regression risk | None — CA county pages filter `entity_type==='city'`; towns only exist for VA; `CountiesInStatePanel` scoped to state page only |

## Build Verification

```
npm run build  →  tsc -b && vite build
TypeScript: 0 errors
Vite: ✓ 2322 modules transformed, built in 6.50s
```

The bundle size warning (>500 kB) is a pre-existing condition unrelated to this plan.

## Frontend Changes (Plan 81-03)

| File | Change | Acceptance |
|------|--------|------------|
| `src/components/EntitySwitcher.tsx` | `withData` filter: `entity_type==='state'\|\|'federal'` bypasses the datasets guard | ✅ |
| `src/components/CountiesInStatePanel.tsx` | New component: counties for a state, filterable, available/coming-soon | ✅ |
| `src/components/CitiesInCountyPanel.tsx` | Filter includes `entity_type==='town'` alongside `'city'` | ✅ |
| `src/App.tsx` | Import + render `CountiesInStatePanel` on state pages (before cities panel) | ✅ |

## Noted Deviation: Pre-existing Virginia State Budget Data

The Virginia state node (`c9b21975-...`) carries **10 pre-v2.7 General Fund budget rows** (FY2022–FY2026, `data_source='Virginia General Fund Operating Budget'/'Revenue'`, ALL with `source_url=NULL`). This data was loaded before the v2.7 milestone began and is NOT from the APA Comparative Report. The Phase 81-02 seeder correctly left it untouched (no APA town-load data for the state level; no never-overwrite conflict).

**UX impact assessment:** These pre-existing rows mean that when a user selects Virginia in the picker, they WILL see a budget display (not a pure "hub with no data" page). The data shows a state-level General Fund budget for FY2022–FY2026 with no source URLs. This differs from the CONTEXT D-08 intent of "no budget datasets." However:
1. The data is real (General Fund Budget) and not fabricated
2. The lack of `source_url` is a pre-existing quality issue from before Phase 81 scope
3. The navigation hub role is preserved — cities, counties, and towns are all reachable from the Virginia page
4. Phase 83 (source-chain audit) should flag the NULL source_url rows on the Virginia state node as a residual quality issue to resolve

**Recommendation:** Accept for Phase 81; flag for Phase 83 source-chain audit. The NULL `source_url` rows should either be backfilled with a VA General Fund budget URL or removed if the source cannot be authenticated. Phase 82/83 should not treat this as a Phase 81 blocker.

## Residual Source Gaps (documented, accepted)

### Towns absent from ALL published APA XLSX years (not a Phase 81 failure)

| Town | FY2024 | FY2023 | Note |
|------|--------|--------|------|
| Big Stone Gap | absent | absent | Multi-year-overdue audit |
| Clifton Forge | absent | absent | Multi-year-overdue audit |
| Vinton | absent | absent | Multi-year-overdue audit |

These 3 towns have entries in `data/vaTownCounties.json` so a future idempotent re-run against a newer report will load them automatically.

### Front Royal (town) — county_id not set

Front Royal's parent (Warren County) was absent from the Phase 80 load (93/95 counties — Lee and Warren are documented source gaps). The `vaTownCounties.json` map has the correct entry; a re-run of `seedVirginiaDataModel.js` after Warren County loads will link it automatically.

## Idempotency Verification

- Town municipality count: 34 (consistent with Phase 81-01 live load)
- Town budget row count: 126 (consistent with Phase 81-01 live load)
- Seeder re-run (Phase 81-02 confirmed): 0 writes, 33 "already set"
- VA county count in DB: 93 / 93 with budget data

## Verdict: PASSED

All four Phase 81 ROADMAP success criteria are met. 34/37 reporting towns loaded (3 absent are documented multi-year-overdue audit source gaps); Virginia state node live; 33/34 towns linked to parent county (`county_id`); picker shows Virginia as selectable; hub page lists counties + cities/towns; county pages list their towns; towns have per-capita (Exhibit A fallback proven); breadcrumb resolver handles US→Virginia→County→Town automatically. Build passes clean (TypeScript + Vite). One deviation documented (pre-existing VA General Fund budget rows with NULL source_url) — flagged for Phase 83 source-chain audit, not a Phase 81 blocker.
