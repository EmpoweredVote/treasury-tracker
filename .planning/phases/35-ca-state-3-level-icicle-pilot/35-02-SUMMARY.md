---
phase: 35-ca-state-3-level-icicle-pilot
plan: "02"
subsystem: database
tags: [python, nodejs, california, data-pipeline, tree-builder, n-level, icicle, lao]

requires:
  - phase: 35-ca-state-3-level-icicle-pilot/35-01
    provides: "A2 VERDICT ACCEPTED (mixed c+i nodes safe); D-05 strategy decided (emit mixed nodes)"
  - phase: 33-ca-state-budget-data
    provides: "CA data source e47a4cb5, extractCA.py with COLS['function']=2, baseline $228,365,858,000 FY2026 total"

provides:
  - "extractCA.py emits function field (col 2) in every row — 'Local Assistance', 'State Operations', 'Capital Outlay', or None"
  - "processCA.js buildNLevelTree: recursive N-level data-driven tree builder with LEVEL_COLS constant"
  - "SUPABASE_URL hardcoded fallback removed; script exits(2) on missing env var (D-12)"
  - "Dry-run confirmed: all 5 FYs produce genuine 3-level trees with totals unchanged from Phase 33"

affects:
  - 35-03-PLAN: live reload can now proceed; uses these modified scripts as-is

tech-stack:
  added: []
  patterns:
    - "buildNLevelTree(rows, levelCols): recursive two-pass N-level builder; returns {nodes, collapseItems} internally, unwraps at root level"
    - "D-05 mixed-node emit: departments with null-function rows AND non-null-function rows produce {n, a, c: [function children], i: [collapsed items]}"
    - "LEVEL_COLS constant drives tree depth — add 4th entry for 4-level tree, zero code changes"

key-files:
  created: []
  modified:
    - scripts/extractCA.py
    - scripts/processCA.js

key-decisions:
  - "D-05 implemented as ACCEPTED strategy: mixed nodes ({n, a, c, i}) emitted for depts with both null and non-null function rows; A2 ACCEPTED confirmed in Plan 01"
  - "buildNLevelTree uses recursive {nodes, collapseItems} return contract at internal levels, unwrapped to nodes[] at root"
  - "LEVEL_COLS constant positioned after sanity band block; comment documents 4th-level extensibility"
  - "FY2026 total preserved exactly: $228,365,858,000 (diff $0 vs Phase 33 baseline)"

patterns-established:
  - "N-level tree builder pattern: recurse(rows, levelIdx) groups by levelCols[levelIdx], separates null-key rows into collapseItems, builds mixed c+i nodes when needed"

requirements-completed: [ICICLE-01]

duration: 25min
completed: 2026-06-08
---

# Phase 35 Plan 02: N-Level Tree Builder + SUPABASE_URL Fix

**buildNLevelTree replaces hardcoded 2-level buildCATree in processCA.js, adding function as the 3rd tree level driven by a LEVEL_COLS constant; extractCA.py now emits the function column; all 5 FYs confirmed 3-level with totals unchanged.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-08T22:37:00Z
- **Completed:** 2026-06-08T23:02:00Z
- **Tasks:** 3 (Tasks 1 and 2 committed; Task 3 is dry-run validation with no source edits)
- **Files modified:** 2

## Accomplishments

- Added `'function': row[COLS['function']]` to `extractCA.py` rows_out dict between `department` and `amount_thousands`; updated module docstring and return-shape comment to reflect 3-level hierarchy.
- Replaced `buildCATree()` in `processCA.js` with recursive `buildNLevelTree(rows, levelCols)` driven by `LEVEL_COLS = ['dof_agency', 'department', 'function']`; implemented D-05 mixed-node strategy (A2 ACCEPTED); removed hardcoded SUPABASE_URL fallback (D-12).
- Dry-run confirmed: all 5 FYs produce genuine 3-level trees; FY2026 total $228,365,858,000 exactly matches Phase 33 baseline (diff $0); all FYs inside the $150B-$300B sanity band; depth-2 nodes present in every FY.

## Task Commits

Each task was committed atomically:

1. **Task 1: extractCA.py — emit the function column (D-03)** - `d6c1176` (feat)
2. **Task 2: processCA.js — replace buildCATree with buildNLevelTree + fix SUPABASE_URL** - `3026ddd` (feat)
3. **Task 3: Dry-run validation** — no source edits required; all checks passed

## Files Created/Modified

- `scripts/extractCA.py` — Added `'function': row[COLS['function']]` to rows_out; updated docstring and return-shape comment to mention Function third level
- `scripts/processCA.js` — Replaced buildCATree with buildNLevelTree; added LEVEL_COLS constant; removed hardcoded SUPABASE_URL fallback; updated header JSDoc to 3-level shape

## Decisions Made

- **D-05 mixed-node emit (A2 ACCEPTED):** The `recurse()` function separates null-function rows into `collapseItems` at each level. When a dept group has both `children` (non-null function rows) and `deepCollapse` (null-function rows from the deeper recursion call), the node is emitted as `{ n, a, c: children, i: deepCollapse }`. A dept with only null-function rows becomes `{ n, a, i: deepCollapse }`. No synthetic "General" node is created (D-05 requirement honored).
- **Internal return contract:** `recurse()` returns `{ nodes, collapseItems }` at internal levels so the parent can attach collapse items to the correct node level. At the root call, only `nodes` is unwrapped.
- **LEVEL_COLS placement:** Positioned after the sanity band constants block, before `resolveMainRoot()`, with a comment explaining that adding a 4th entry requires zero further code changes.

## Dry-Run Validation Results

| FY | Rows | Total | In Band | Depth-2 | Example Depth-2 Path |
|----|------|-------|---------|---------|----------------------|
| 2022 | 252 | $216,784,797,000 | YES | YES | K-12 Education → Department of Education → Local Assistance |
| 2023 | 256 | $195,189,253,000 | YES | YES | K-12 Education → Department of Education → Local Assistance |
| 2024 | 253 | $205,670,467,000 | YES | YES | Health and Human Services → State Dept of Health Care Services → Local Assistance |
| 2025 | 253 | $233,577,316,000 | YES | YES | K-12 Education → Department of Education → Local Assistance |
| 2026 | 219 | $228,365,858,000 | YES | YES | Health and Human Services → State Dept of Health Care Services → Local Assistance |

**FY2026 total preservation:** $228,365,858,000 (diff $0 vs Phase 33 baseline $228,365,858,000 — exact match).

**Null-function rows:** 0 across all 5 FYs. The LAO Excel contains no null-function rows in the GF filter for FY2022-FY2026. The mixed-node D-05 logic is correct and tested (via the Plan 01 A2 sentinel test), but will not trigger in practice for the current dataset.

## Deviations from Plan

None — plan executed exactly as written. The verification check in Task 2 against `buildCATree(` in a regex matched the comment "Replaces the former 2-level buildCATree" which initially had `buildCATree()` in it. Fixed the comment text to remove the `(` reference — this is a micro-fixup in the same task, not a deviation.

## Issues Encountered

- The plan's Task 2 automated verify regex `/buildCATree\(/` matched a comment line that originally read "Replaces buildCATree()." Updated the comment to "Replaces the former 2-level buildCATree." to avoid the false positive. No functional change.

## User Setup Required

None — this plan makes no DB writes and requires no external service configuration. The dry-run validates scripts only.

## Next Phase Readiness

Plan 03 can proceed immediately:
- `extractCA.py` emits the `function` field (D-03 done)
- `processCA.js` uses `buildNLevelTree` with `LEVEL_COLS` (D-02/D-04 done)
- D-05 mixed-node strategy implemented per A2 ACCEPTED verdict (D-05 done)
- SUPABASE_URL hardcoded fallback removed (D-12 done)
- Dry-run confirms 3-level tree with totals preserved for all 5 FYs
- Plan 03: live reload of FY2022-2026 using `node scripts/processCA.js` (no --dry-run)

## Known Stubs

None. The scripts are complete implementations, not stubs. No placeholder data flows to the UI in this plan (no DB writes occurred).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

**T-35-04 mitigated (D-12):** The string `kxsdzaojfaibhuzmclfq` has been removed from `processCA.js`. A missing `SUPABASE_URL` now causes exit(2) with a clear error message, preventing accidental connection to a hardcoded production URL.

**T-35-05 mitigated:** FY2026 dry-run confirms total = $228,365,858,000 (diff $0 vs Phase 33); all FYs in $150B-$300B sanity band. No double-counting or dropped rows in `buildNLevelTree`.

## Self-Check: PASSED

- [x] `scripts/extractCA.py` modified: `row[COLS['function']]` present in rows_out
- [x] `scripts/processCA.js` modified: `buildNLevelTree` defined; `LEVEL_COLS` constant present; no `kxsdzaojfaibhuzmclfq`; no `buildCATree(` call
- [x] Commit `d6c1176` exists (Task 1)
- [x] Commit `3026ddd` exists (Task 2)
- [x] No temp scripts in `scripts/` directory (`git status` shows clean)
- [x] FY2026 total $228,365,858,000 (exact match to Phase 33)
- [x] All 5 FYs have depth-2 nodes confirmed by verification script
- [x] All 5 FYs inside $150B-$300B sanity band

---
*Phase: 35-ca-state-3-level-icicle-pilot*
*Completed: 2026-06-08*
