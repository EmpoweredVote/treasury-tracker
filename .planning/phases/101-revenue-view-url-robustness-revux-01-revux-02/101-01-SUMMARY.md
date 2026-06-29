---
phase: 101-revenue-view-url-robustness-revux-01-revux-02
plan: 01
subsystem: ui
tags: [react, typescript, routing, url-params, dataset-resolution]

# Dependency graph
requires:
  - phase: 99-california-texas-acfr-upgrade
    provides: CA + TX revenue datasets in available_datasets (Money In auto-enables)
  - phase: 100-new-york-florida-acfr-upgrade
    provides: NY + FL revenue datasets in available_datasets (Money In auto-enables)
provides:
  - Pure resolveEffectiveDataset helper (src/utils/resolveDataset.ts) with two-guard logic
  - Mount deep-link handler hardened against ?dataset=revenue on operating-only nodes
  - handleEntityChange refactored to use the same shared helper (single source of truth)
  - ?dataset=revenue deep-links resolve correctly on both upgraded and NASBO-only nodes
affects:
  - phase-102-verification-source-chain-audit-uat (UAT exercises cases a-d; code already in prod)
  - any future phase touching App.tsx dataset routing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-guard dataset validation: static allow-list first, then year-scoped availability"
    - "Shared pure helper for dataset resolution — caller owns year-filtering"

key-files:
  created:
    - src/utils/resolveDataset.ts
  modified:
    - src/App.tsx

key-decisions:
  - "resolveEffectiveDataset takes the already-filtered types array, NOT the raw entity — caller owns year-filtering, matching the existing availableDatasetTypes derivation"
  - "Static allow-list guard (operating|revenue|salaries) applied BEFORE availability check — rejects garbage URL params without touching entity data"
  - "Mount path computes resolvedYear as a local variable (not from React state) so the dataset availability check uses the correct year before setState is batched"
  - "handleEntityChange filter added: all_funds_requirements + federal_agency excluded from the types array passed to the helper, matching the availableDatasetTypes memo"
  - "No test framework added — plan explicitly forbids it; correctness enforced by tsc typecheck + code-level trace"
  - "REVUX-01 is verification-only — no render gap found; Money In auto-enables from API-served available_datasets"

patterns-established:
  - "resolveEffectiveDataset: reusable for any future path that needs to validate a requested dataset against an entity's year-scoped availability"

requirements-completed: [REVUX-01, REVUX-02]

# Metrics
duration: 8min
completed: 2026-06-29
---

# Phase 101 Plan 01: Revenue View + URL Robustness Summary

**Pure resolveEffectiveDataset helper + App.tsx two-call-site hardening: ?dataset=revenue deep-links now validate against entity availability and fall back to 'operating' on NASBO-only nodes**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-29T22:22:00Z
- **Completed:** 2026-06-29T22:29:15Z
- **Tasks:** 3
- **Files modified:** 2 (src/utils/resolveDataset.ts created, src/App.tsx modified)

## Accomplishments

- Created `src/utils/resolveDataset.ts` — a dependency-free pure helper with three branches (garbage/null→operating, available→kept, unavailable→operating) and JSDoc documenting both security rationale and branch intent
- Hardened the mount deep-link handler: replaced the static-list-only check with `resolveEffectiveDataset(resolvedYearTypes, datasetParam)` using a locally computed `resolvedYear` so availability is checked against the correct year before React batches setState
- Refactored `handleEntityChange` to use the same shared helper (identical behavior, single source of truth; added the `all_funds_requirements`/`federal_agency` exclusion filter to match the `availableDatasetTypes` memo)
- Build (`tsc -b && vite build`) passes clean across all three tasks; dev server boots cleanly (Vite v7.3.2 ready in 1300ms)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the pure resolveEffectiveDataset helper** — `627ea89` (feat)
2. **Task 2: Wire helper into both App.tsx call sites (REVUX-02 fix + no-regression refactor)** — `e8e0131` (feat)
3. **Task 3: Build + dev-app smoke verification** — (no new source changes; verification-only)

**Plan metadata:** (docs commit — included in final gsd commit with STATE.md + ROADMAP.md)

## Files Created/Modified

- `src/utils/resolveDataset.ts` — Pure exported function `resolveEffectiveDataset(availableDatasetTypesForYear: string[], requested: string | null | undefined): DatasetType`; no React/DOM/network imports; three-branch logic with JSDoc
- `src/App.tsx` — Added import; mount deep-link handler rewritten to compute `resolvedYear` locally + call helper; `handleEntityChange` inline `effectiveDataset` replaced with helper call

## Dev-App Smoke Evidence

The automated gate is `npm run build` (tsc + vite), which passed clean for all three tasks. Dev server confirmed booting (`VITE v7.3.2 ready in 1300ms`, port 5180). A code-level trace was performed for all four behavioral cases per plan Task 3 guidance (no headless browser available; full UAT deferred to Phase 102):

### Case (a) — REVUX-01 upgraded: New York FY2024

`availableDatasetTypes` memo (L177-185): API serves `available_datasets` with `{fiscal_year:2024, dataset_type:'revenue'}` for New York (loaded in Phase 100). The memo filters to FY2024, excludes `all_funds_requirements`/`federal_agency` → result includes `'revenue'`.

`DatasetTabs` disable logic: `isDisabled = !available.includes('revenue')` = `!true` = `false` → **Money In card is ENABLED.**

Clicking Money In → `setActiveDataset('revenue')` → main budget load effect → API returns ACFR revenue-by-source tree (≈ $93.9B, Taxes, Personal income, Miscellaneous, etc.). **Code confirms: will render.**

### Case (b) — REVUX-01 operating-only: NASBO state (e.g. Colorado)

CO's `available_datasets` contains only `operating`. `availableDatasetTypes` → `['operating']`.

`DatasetTabs`: `!['operating'].includes('revenue')` = `true` → **Money In card is DISABLED** (honest). No broken view.

### Case (c) — REVUX-02 upgraded deep-link: `?entity=new-york-ny&dataset=revenue&year=2024`

```
entityParam='new-york-ny', yearParam='2024', datasetParam='revenue'
entityYears includes 2024 → resolvedYear='2024'
resolvedYearTypes = ['operating','revenue']  (NY FY2024 has both)
resolveEffectiveDataset(['operating','revenue'], 'revenue'):
  Branch 1: 'revenue' in ['operating','revenue','salaries'] → PASS
  Branch 2: ['operating','revenue'].includes('revenue') → true → return 'revenue'
setActiveDataset('revenue')  → lands directly on revenue view ✓
```

### Case (d) — REVUX-02 operating-only deep-link: `?entity=colorado-co&dataset=revenue`

```
entityParam='colorado-co', datasetParam='revenue', no yearParam
resolvedYear = String(operatingYears[0])  (most recent CO operating year)
resolvedYearTypes = ['operating']  (CO has no revenue)
resolveEffectiveDataset(['operating'], 'revenue'):
  Branch 1: 'revenue' in SWITCHABLE_DATASETS → PASS
  Branch 2: ['operating'].includes('revenue') → false → NOT branch 2
  Branch 3: return 'operating'
setActiveDataset('operating')  → falls back to operating, NO disabled-but-active empty card ✓
```

### handleEntityChange no-regression trace

Old inline: `entityDatasets.includes(activeDataset) ? activeDataset : 'operating'`

New helper call: `resolveEffectiveDataset(entityDatasets, activeDataset)` where `activeDataset` is always one of `'operating'|'revenue'|'salaries'` (typed `DatasetType`).

- `activeDataset='operating'` → branch 2 returns `'operating'` (always in the list)
- `activeDataset='revenue'`, entity has revenue → branch 2 returns `'revenue'`
- `activeDataset='revenue'`, entity has no revenue → branch 3 returns `'operating'`
- `activeDataset='salaries'`, entity has salaries → branch 2 returns `'salaries'`

Behavior is identical to the pre-refactor inline. The added `filter(t => t !== 'all_funds_requirements' && t !== 'federal_agency')` only removes types never in `DatasetType` — no matchable value is dropped.

**What was verified:** Build (tsc typecheck + vite bundle) clean; dev server boots; all four behavioral cases confirmed correct by code-level trace.

**What requires live UAT:** Visual rendering of FL FY2022 clamp labels ("net loss — shown at 0"), exact $93.9B figure on NY, and D-03 flat-tree no-drill behavior — deferred to Phase 102 per plan.

## Decisions Made

- **Resolved year as local variable:** The mount path previously set `selectedYear` via three separate `setSelectedYear` calls in an if/else chain, then read `selectedYear` for the dataset check. But React batches state — the new `selectedYear` would not be visible synchronously. Fix: compute `resolvedYear` as a plain `const` from the same logic, call `setSelectedYear(resolvedYear)` once, then derive `resolvedYearTypes` from `resolvedYear` directly. This is provably correct.
- **all_funds_requirements + federal_agency filter added in handleEntityChange:** The original inline check did not exclude these system dataset types. Adding the filter makes `handleEntityChange` consistent with the `availableDatasetTypes` memo. This is safe: `activeDataset` is typed `DatasetType = 'operating'|'revenue'|'salaries'` so these internal types would never match anyway — but the filter makes the intent explicit and matches the helper's contract.
- **REVUX-01 is verification-only:** No render gap found by code inspection. The `DatasetTabs` disable logic is purely `!available.includes(id)` where `available` comes from the API's `available_datasets`. Revenue auto-enables on the four upgraded nodes with no frontend code change.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 implemented the helper and both call sites as specified. Task 3 is verification-only; no render gap was found requiring a REVUX-01 code fix.

## Issues Encountered

None.

## Threat Model Coverage

Both T-101-01 and T-101-02 mitigations are implemented:
- **T-101-01 (Tampering — garbage ?dataset= params):** The static allow-list guard in branch 1 of `resolveEffectiveDataset` rejects any value not in `['operating','revenue','salaries']` → normalised to `'operating'` before state is set. Value is only ever used as a keyed enum, never rendered as HTML.
- **T-101-02 (UX DoS — disabled-but-active empty view):** The availability check in branch 3 falls back to `'operating'` when the requested dataset is not available for the resolved year — prevents the empty/broken revenue view on NASBO-only nodes.

## Known Stubs

None — no placeholder data, no hardcoded empty values, no TODO/FIXME in the files modified.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The helper is a pure in-process function; all data flow is existing API → client state.

## Self-Check: PASSED

- `src/utils/resolveDataset.ts` exists: FOUND
- `src/App.tsx` modified with import + two call sites: FOUND (verified by reading lines 29-30, 215-235, 408-414)
- Commit `627ea89` (Task 1): FOUND
- Commit `e8e0131` (Task 2): FOUND
- Build passes clean: CONFIRMED (tsc -b && vite build, exit 0, "built in 6.58s")

## Next Phase Readiness

Phase 102 (Verification + Source-Chain Audit + UAT) is ready to start:
- Money In card auto-enables on CA/TX/NY/FL (data-driven, API-served)
- `?dataset=revenue` deep-links resolve correctly on all node types
- Normal navigation (entity/year/dataset switching) is unchanged
- Code is committed and on `main`; build is green

---
*Phase: 101-revenue-view-url-robustness-revux-01-revux-02*
*Completed: 2026-06-29*
