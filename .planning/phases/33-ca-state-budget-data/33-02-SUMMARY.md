---
phase: 33-ca-state-budget-data
plan: "02"
subsystem: data
tags: [california, state, extractor, loader, openpyxl, general-fund, lao-excel]
dependency_graph:
  requires: [phase-33-plan-01 (ca-state-municipality-row, ca-lao-gf-operating-data-source)]
  provides: [ca-general-fund-budget-fy2022-2026, extractCA.py, processCA.js]
  affects: [treasury.budgets, treasury.budget_categories, treasury.budget_line_items]
tech_stack:
  added: []
  patterns: [openpyxl-flat-row-extraction, buildCATree-two-level, treasury_sync_budget_tree-canonical-source]
key_files:
  created:
    - scripts/extractCA.py
    - scripts/processCA.js
  modified: []
decisions:
  - "cwd resolution via git rev-parse --git-common-dir for worktree-safe docs/ path — same pattern as processBakersfield.js"
  - "amounts in thousands in Excel; processCA.js multiplies x1000 to get dollars before RPC call"
  - "single canonical data_source row (not per-FY) — Sacramento pattern, not Bakersfield per-FY pattern"
  - "FY2022-2026 loaded (5 years); pre-2022 excluded per LAO trend-comparability caveat"
metrics:
  duration: "25 minutes"
  completed: "2026-06-07"
  tasks_completed: 2
  files_committed: 2
---

# Phase 33 Plan 02: CA General Fund Budget Pipeline Summary

**One-liner:** openpyxl extractor (extractCA.py) + Node.js loader (processCA.js) load 5 fiscal years of California General Fund operating budget ($195B-$233B) as a 2-level DOF Agency -> Department tree via the treasury_sync_budget_tree RPC.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create extractCA.py | 0673789 | scripts/extractCA.py |
| 2 | Create processCA.js, dry-run all FYs, live load FY2022-2026 | b542b19 | scripts/processCA.js |

## Verification Results

### Task 1: extractCA.py
- `python scripts/extractCA.py --fy 2026 --dry-run` → FY2026: 219 rows, ~$228.4B (exact acceptance criterion match)
- `python scripts/extractCA.py --fy 2026 | python -c "import json,sys; rows=json.load(sys.stdin); print(len(rows), sum(r['amount_thousands'] for r in rows))"` → `219 228365858` (matches plan acceptance criteria)
- All 5 FYs without error: FY2022=252 rows, FY2023=256, FY2024=253, FY2025=253, FY2026=219

### Task 2: processCA.js
- `node scripts/processCA.js --dry-run` → All 5 FY totals confirmed in [$150B, $300B]:
  - FY2022: $216.8B, FY2023: $195.2B, FY2024: $205.7B, FY2025: $233.6B, FY2026: $228.4B
- `node scripts/processCA.js` (live load) → exits 0; all 5 FYs inserted:
  - FY2022: 166 rows, FY2023: 171 rows, FY2024: 169 rows, FY2025: 169 rows, FY2026: 157 rows
- Second run (idempotency): exits 0, same row counts — fully idempotent

### DB Verification (confirmed via Supabase client queries)
- `treasury.budgets` WHERE municipality_id='e1007bf5-bac9-4b1c-878e-f6834885f850': **5 rows** (FY2022, 2023, 2024, 2025, 2026)
- `treasury.budget_categories` for those 5 budget IDs: **892 rows** (categories > 0)
- RPC upsert confirmed idempotent on second run

## Success Criteria Check

- [x] 5 fiscal years of CA General Fund budget loaded in DB (FY2022-2026)
- [x] FY2025-26 total is ~$228.4B (not $212B Governor's proposal, not $228M — correct enacted Budget Act figure)
- [x] FY2024-25 total is ~$233.6B (confirmed in both dry-run and DB)
- [x] 2-level tree shape: 12 DOF Agency categories at top level, department breakdown as children
- [x] Both scripts are idempotent — second run exits 0 without errors
- [x] Sanity band ($150B-$300B) enforced before DB write (exits 3 on violation)
- [x] Amounts in dollars (not thousands) in DB — x1000 multiplication confirmed by sanity band passing

## Deviations from Plan

### [Rule 3 - Blocking] LAO Excel missing from docs/California/ — re-downloaded

**Found during:** Start of Task 1 verification

**Issue:** The parallel_execution note stated "docs/California/Historical_Expenditures.xlsx is present (5.4 MB)". The file existed in the directory listing but `ls -la` showed the docs/California/ directory was empty (0 bytes). The Wave 1 seeder presumably ran in a different worktree context where the download succeeded but the file was not persisted to the shared location.

**Fix:** Downloaded the Excel file from `https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx` using curl. File confirmed 5,682,780 bytes (5.4 MB) — same size reported in Wave 1 SUMMARY.

**Impact:** None — file is gitignored per project convention (docs/ directory). Re-download is idempotent.

**Files modified:** docs/California/Historical_Expenditures.xlsx (local only, gitignored — not committed)

## Known Stubs

None. All 5 fiscal years have real data from the official LAO source. Tree is built from actual column values in the Excel, not synthetic data.

## Threat Flags

No new threat surface introduced beyond what was already in the Phase 33 threat model:
- T-33-07 (shell injection): accepted — pyScript path is hardcoded, no user input in execSync call
- T-33-08 (key exposure): mitigated — SUPABASE_SERVICE_KEY loaded via loadEnv(), never logged
- T-33-04/05/06 (data integrity): mitigated — sanity band enforced, General Fund filter in extractCA.py

## Self-Check: PASSED

- scripts/extractCA.py: FOUND
- scripts/processCA.js: FOUND
- Commit 0673789: FOUND (git log confirmed)
- Commit b542b19: FOUND (git log confirmed)
- 5 budget rows in DB: CONFIRMED (FY2022-2026, municipality_id=e1007bf5-bac9-4b1c-878e-f6834885f850)
- 892 budget_category rows in DB: CONFIRMED
- Idempotency: CONFIRMED (second run exits 0)
- 33-02-SUMMARY.md: FOUND
