---
phase: 57-orange-county-county-government-budget
plan: "57-02"
subsystem: frontend + verification
tags: [react, typescript, verification, orange-county, county-budget, source-chip]

# Dependency graph
requires:
  - phase: 57-01
    provides: OC county entity (id=65e7c643) with 44 budget rows + durable source attribution
provides:
  - "src/App.tsx: county-scoped SourceChip block (D-03) — separate from federal block, guarded by dataSourceInfo non-null"
  - "scripts/verify-phase57.mjs: DB probe — exit 0, 7/7 PASS (OCB-01/02 coverage + source attribution + population + exact total + city non-overwrite + REQUIREMENTS traceability)"
  - ".planning/phases/57-orange-county-county-government-budget/57-VERIFICATION.md: coverage, all-governmental-funds basis, ACFR cross-check FY2010, population source, verify result, UAT checklist"
  - ".planning/REQUIREMENTS.md: OCB-01 + OCB-02 both [x] Complete"
affects: ["phase-57-uat", "sourcing-backfill-milestone", "ev-accounts-data-source-info"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "county-scoped SourceChip: minimal separate block in App.tsx guarded by entity_type==='county' AND dataSourceInfo non-null — prevents federal regression (D-03, T-57-02)"
    - "verify-phase57.mjs: Node ESM PostgREST probe mirroring verify-phase56.mjs pattern (env load, pass/fail tracking, native https, Accept-Profile: treasury, HEAD count + GET rows)"

key-files:
  created:
    - scripts/verify-phase57.mjs
    - .planning/phases/57-orange-county-county-government-budget/57-VERIFICATION.md
  modified:
    - src/App.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "County SourceChip block added as SEPARATE block from federal-only block (~945-985) — federal block carries Lens/Scale toggles; widening it would have rendered those on the county page (regression)"
  - "SourceChip currently dormant: production EV-Accounts API returns data_source_info=null for non-federal rows (data_source_id FK to source_registry is null for county/city rows); no blank chip shipped — follow-up recorded"
  - "datasetUrl || url source priority used (not the federal url || datasetUrl swap) — ensures the chip will link to the durable /d/<id> page when EV-Accounts follow-up ships"
  - "verify-phase57.mjs: 7 automatable gaps (operating coverage, revenue coverage, durable source_url+source_date, population>0, FY2024 exact-match total, city non-overwrite, REQUIREMENTS [x])"

# Metrics
duration: 35min
completed: 2026-06-15
---

# Phase 57 Plan 57-02: Render the OC County Budget (SourceChip) + Verify + Document Summary

**County-scoped SourceChip block added to App.tsx (separate from federal controls); verify-phase57.mjs exits 0 (7/7 PASS); 57-VERIFICATION.md documents all-governmental-funds basis + ACFR cross-check + UAT checklist; OCB-01/02 marked complete**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-16T01:45:00Z (approx)
- **Completed:** 2026-06-16T02:21:45Z
- **Tasks:** 3
- **Files created:** 2, modified: 2

## Accomplishments

- Added a minimal county-scoped SourceChip render block in `src/App.tsx` (after line 985, after the federal block's closing `)}`) — guarded by `entity_type === 'county' && budgetData.metadata.dataSourceInfo`. The existing federal-only block (~945-985, with Lens/Scale toggles) is byte-for-byte unchanged.
- Confirmed via production API that `data_source_info` is null for the OC county (and all non-federal entities) — the API populates this field only via the `data_source_id` FK to `source_registry`, used exclusively by federal rows. The county chip is wired and waiting; it is dormant (no blank chip ships).
- Created `scripts/verify-phase57.mjs` — Node ESM DB probe mirroring `verify-phase56.mjs`; asserts 7 automatable gaps; exit 0 confirmed on production DB.
- Wrote `57-VERIFICATION.md` documenting: FY coverage, all-governmental-funds basis, durable source URLs + fetch date, per-year population source (SCO feed), ACFR cross-check FY2010 (SCO $3.007B vs ACFR ~$2.35B; delta ~$655M = documented variance), probe result (7/7 PASS), and UAT checklist for Chris.
- Updated `REQUIREMENTS.md`: OCB-02 changed from `[ ]` to `[x]`; traceability row `Pending` → `Complete`. Both OCB-01 and OCB-02 are now `[x]`.

## Task Commits

Each task committed atomically:

1. **Task 57-02-01: County SourceChip block in App.tsx** — `d13f8cf` (feat)
2. **Task 57-02-02: verify-phase57.mjs** — `a5b3e4c` (feat)
3. **Task 57-02-03: 57-VERIFICATION.md + REQUIREMENTS.md updates** — `ea1e910` (docs)

## Files Created/Modified

- `src/App.tsx` — added county-scoped SourceChip render block (20 lines); federal block untouched
- `scripts/verify-phase57.mjs` — 361-line Node ESM DB probe; 7 assertions; exit 0
- `.planning/phases/57-orange-county-county-government-budget/57-VERIFICATION.md` — coverage, basis, ACFR cross-check, population source, probe result, UAT checklist
- `.planning/REQUIREMENTS.md` — OCB-02 [x]; traceability Complete

## Deviations from Plan

### Auto-fixed Issues

None.

### Deviation: SourceChip is dormant (EV-Accounts API follow-up required)

**Type:** Discovery (documented, not a code error)
**Found during:** Task 57-02-01 (production API check)
**Issue:** The plan expected `data_source_info` to be non-null for the OC county budget rows once `source_url`/`source_date` are set. The production EV-Accounts API (`/api/treasury/cities/{id}/budgets`) returns `data_source_info: null` for all non-federal budget rows. This is because the API populates `data_source_info` only via the `data_source_id` FK → `source_registry` JOIN — a pattern used exclusively for federal rows. County/city rows use `source_url`, `source_date`, and `data_source` columns which the API does NOT currently use to construct a `data_source_info` object.
**Action:** Per the critical context directive ("if the production API returns null data_source_info for the OC county, DO NOT ship a blank chip — record an EV-Accounts follow-up"), the chip block is committed but dormant. The `dataSourceInfo` guard prevents any blank chip from rendering.
**Follow-up:** EV-Accounts API needs to construct `data_source_info` from `source_url`/`source_date`/`data_source` when `data_source_id` is null. When that change ships, the county SourceChip will auto-render with zero additional frontend work.
**Files modified:** `src/App.tsx` (chip code committed with TODO comment)

## Known Stubs

None. The SourceChip code is complete and correct — it is dormant by design (waiting for EV-Accounts API change), not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The App.tsx change is a read-only render path (no new API calls, no state mutations). The verify-phase57.mjs script reads from PostgREST with read-only service key (no writes).

## Verification Results

All acceptance criteria met:

- `src/App.tsx` contains SourceChip render guarded by `entity_type === 'county'` AND `budgetData.metadata.dataSourceInfo`, separate from the federal block
- That render uses the `datasetUrl || url` source priority
- The existing `entity_type === 'federal'` block is byte-for-byte unchanged
- Production API confirmed: `data_source_info` is null for OC county → chip is dormant, EV-Accounts follow-up recorded in 57-VERIFICATION.md — NO blank chip shipped
- `npx tsc --noEmit`: 0 errors
- `scripts/verify-phase57.mjs` exists, runs via `node scripts/verify-phase57.mjs`, exits 0
- 57-02-01 through 57-02-07: all 7 PASS
- `57-VERIFICATION.md` states all-governmental-funds basis, durable source URLs + fetch date, population source + values, ACFR cross-check, UAT checklist with sign-off line
- `REQUIREMENTS.md` OCB-01 and OCB-02 both `[x]`; traceability rows `Complete`

## EV-Accounts Follow-Up (Logged)

**File:** `C:/EV-Accounts/ACCOUNTS-FEATURE-REQUEST.md` (pattern — actual entry to be added by operator if desired)
**Needed:** The `getCityBudgets()` handler (or equivalent) in EV-Accounts backend (`backend/src/lib/treasuryService.ts` or similar) should construct a `data_source_info` object from `source_url`, `source_date`, and `data_source` columns when `data_source_id` is null. Shape needed:
```json
{
  "displayName": "<data_source column value>",
  "url": "<source_url column value>",
  "datasetUrl": "<source_url column value>",
  "fetchedAt": "<source_date column value>"
}
```
This would make the county SourceChip render automatically and would also benefit the 34 OC cities (which also have `source_url`/`source_date` set from Phase 53).

## Self-Check

Files created check:
- `scripts/verify-phase57.mjs`: exists (committed a5b3e4c)
- `.planning/phases/57-orange-county-county-government-budget/57-VERIFICATION.md`: exists (committed ea1e910)
- `src/App.tsx` county block: committed d13f8cf
- `.planning/REQUIREMENTS.md` OCB-02 [x]: committed ea1e910

Commits exist:
- d13f8cf: feat(57-02): add county SourceChip block in App.tsx
- a5b3e4c: feat(57-02): add verify-phase57.mjs DB probe
- ea1e910: docs(57-02): write 57-VERIFICATION.md and mark OCB-01/02 complete

## Self-Check: PASSED
