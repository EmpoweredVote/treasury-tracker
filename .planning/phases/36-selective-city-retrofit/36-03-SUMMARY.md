---
phase: 36-selective-city-retrofit
plan: 03
subsystem: scripts
tags: [dallas, 3-level-tree, bulkLoadBudget, department_column, WR-04, dry-run, backward-compat]

requires:
  - 36-01 (audit framework + DB verdicts — Dallas retrofit_recommended confirmed)

provides:
  - scripts/buildBudgetTree.mjs (pure tree-builder module, exported for testing)
  - scripts/bulkLoadBudget.js (updated: department_column 3-level path + WR-04 fix)
  - Dallas Operating data_sources.column_mapping with department_column='appropriation'
  - 16-test unit suite for buildBudgetTree (2-level backward-compat + 3-level path)

affects:
  - 36-04 (Dallas live reload — will use 3-level tree built by this plan's loader code)

tech-stack:
  added: []
  patterns:
    - "cm.department_column || null gate in buildBudgetTree — if(deptCol) 3-level path, else 2-level path UNCHANGED"
    - "Extract pure function to .mjs module for unit testability without Supabase init side effects"
    - "node:test framework (Node 24 built-in) for unit tests — no install required"
    - "supabase-js .update() with spread merge for JSONB column_mapping key addition"

key-files:
  created:
    - scripts/buildBudgetTree.mjs
    - scripts/buildBudgetTree.test.mjs
  modified:
    - scripts/bulkLoadBudget.js

key-decisions:
  - "Extract buildBudgetTree to pure module (buildBudgetTree.mjs) for unit testing — avoids Supabase init side effect in tests"
  - "3-level gate: if(deptCol) path completely separate from else 2-level path — zero shared mutation risk (Pitfall 4)"
  - "deptCol = cm.department_column || null — explicit null prevents empty string activating 3-level path"
  - "NONE-service rows group under their appropriation dept via existing cat fallback — no rows dropped (D-06 compliant)"
  - "MCP tools unavailable (known upstream bug) — used supabase-js client spread merge for column_mapping update (functionally equivalent to jsonb_set)"

metrics:
  duration: 7min
  completed: 2026-06-09T16:53:00Z
  tasks: 2
  files_modified: 2
  files_created: 2
---

# Phase 36 Plan 03: Dallas 3-Level Loader Code + Config + Dry-Run Validation Summary

**buildBudgetTree extended with an optional department_column gate for 3-level trees; WR-04 SUPABASE_URL fallback removed; Dallas Operating configured for Department→Service→ObjectGroup; FY2026 dry-run validated at 65 departments, $4.28B total; backward-compat confirmed on Dallas Revenue (32 categories, identical output before/after).**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-06-09T16:53:00Z
- **Tasks:** 2
- **Files modified:** 2
- **Files created:** 2

## Accomplishments

### Task 1: buildBudgetTree 3-level path + WR-04 fix (TDD)

**TDD RED:**
- Created `scripts/buildBudgetTree.test.mjs` with 16 tests across 3 suites
- Import fails (file does not exist) — RED confirmed
- Commit: `c2ff452`

**TDD GREEN:**
- Created `scripts/buildBudgetTree.mjs` — pure exported function module
  - `deptCol = cm.department_column || null` gate above catCol
  - `if (deptCol)` 3-level path: nested Map dept → cat → sub accumulation, then 3-level JSON conversion
  - `else` 2-level path: UNCHANGED from original
  - Null/empty fallbacks: dept→'Unknown', cat→'Unknown', sub→'General' (T-36-06)
  - NONE-service rows group under appropriation dept (D-06 compliant)
  - Descending sort at every level
- Updated `scripts/bulkLoadBudget.js`:
  - Import `buildBudgetTree`, `parseAmount` from `./buildBudgetTree.mjs`
  - Removed duplicate `parseAmount` and `buildBudgetTree` function bodies (~73 lines)
  - **WR-04 fix**: `const SUPABASE_URL = process.env.SUPABASE_URL;` + `if (!SUPABASE_URL) { console.error(...); process.exit(1); }` — NO hardcoded fallback
  - Dry-run output: `childLabel = deptCol ? 'services' : 'subcategories'`
- All 16 tests pass
- Commit: `d8e26ed`

**Test suite summary:**

| Suite | Tests | Result |
|-------|-------|--------|
| 2-level backward-compat | 5 | PASS |
| 3-level department_column path | 9 | PASS |
| Validation (throws on bad cm) | 2 | PASS |
| **Total** | **16** | **ALL PASS** |

### Task 2: Dallas Operating column_mapping + 3-level dry-run validation

**DB update:**
- Found Dallas Operating data_source: `443a5578-568c-4684-8d47-43ef5f10e773`
- Used `supabase-js .update()` with spread merge to add `department_column: 'appropriation'`
- No keys overwritten (T-36-09 mitigation confirmed)
- Verified via `treasury_get_data_source_config` RPC: all 7 keys present

**Final column_mapping state:**
```json
{
  "fund_column": "fundtype",
  "category_column": "service",
  "department_column": "appropriation",
  "fiscal_year_column": "bfy",
  "subcategory_column": "objectgroup",
  "actual_amount_column": "expbfy",
  "approved_amount_column": "budcurr"
}
```

**Dallas Operating FY2026 3-level dry-run results:**

| Metric | Value |
|--------|-------|
| Total Socrata rows | 779 |
| Kept (non-zero) | 759 |
| Dropped (zero-amount) | 20 |
| Tree total | $4,284,452,698 |
| Top-level departments | 65 |
| Mode | `dry_run` — no RPC write |

**Top 3 departments by amount:**
1. Water Utilities DWU: $880,895,629 (10 services)
2. Police Department GF: $758,373,419 (13 services)
3. Debt Service BMS: $491,015,332 (3 services)

Department names confirmed citizen-recognizable (Water/Police/Fire/Parks) — D-05 genuineness test PASS.

## Backward-Compat Baseline (Pitfall 4 Regression Guard)

Dallas Revenue FY2026 dry-run run **before** and **after** changes:

| Metric | Before change | After change | Match? |
|--------|--------------|--------------|--------|
| Total Socrata rows | 626 | 626 | YES |
| Kept rows | 617 | 617 | YES |
| Dropped (zero) | 9 | 9 | YES |
| Tree total | $4,254,327,886 | $4,254,327,886 | YES |
| Top-level categories | 32 | 32 | YES |
| Top node name | Office of Budget and Management Services | Office of Budget and Management Services | YES |

**Backward-compat VERIFIED: zero regression on 2-level source.**

## Dallas Operating FY2026 Total Reconciliation

The research estimate was "~741 non-NONE rows, 67 distinct appropriations". Actual FY2026:
- 759 kept rows (close to ~741 estimate — difference due to 2026 vs. research snapshot FY)
- 65 distinct departments (close to 67 estimate)
- Zero rows dropped unexpectedly — all 779 raw rows accounted for (759 kept + 20 zero-amount)

NONE-service rows (`service='NONE'`) confirmed present in FY2026 data. They grouped under their
`appropriation` department (Debt Service BMS has 3 service children). No rows lost — D-06 compliant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Architecture] Extracted buildBudgetTree to separate module for unit testability**
- **Found during:** Task 1 TDD setup
- **Issue:** `bulkLoadBudget.js` has top-level Supabase init side effects (env var checks, `createClient()`). Importing the function from within the test would trigger these, requiring `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` to be set even for pure unit tests.
- **Fix:** Extracted `buildBudgetTree()` and `parseAmount()` to `scripts/buildBudgetTree.mjs` — a pure module with no side effects. `bulkLoadBudget.js` imports from it. Tests import from it directly.
- **Impact:** Cleaner architecture, fully testable in isolation. The import in `bulkLoadBudget.js` replaces the 73-line duplicate. No behavior change.
- **Files modified:** `scripts/buildBudgetTree.mjs` (new), `scripts/bulkLoadBudget.js` (updated imports)

**2. [Rule 3 - Blocking] MCP tools unavailable — used supabase-js client for column_mapping update**
- **Found during:** Task 2 DB update
- **Issue:** Plan specified `mcp__supabase-local__execute_sql` with `jsonb_set`. These MCP tools are unavailable in worktree agent context (known upstream bug anthropics/claude-code#13898).
- **Fix:** Used `supabase-js .update()` with a spread-merge pattern: read current `column_mapping`, spread with `department_column: 'appropriation'`, write back. Functionally equivalent to `jsonb_set` for a single-key add.
- **Verification:** Confirmed via `treasury_get_data_source_config` RPC — all 7 keys present, no keys lost.
- **Impact:** Identical outcome. No risk of key loss (spread merge is safe for script usage).

## Known Stubs

None. Both tasks complete — loader code updated, DB config updated, dry-run validated. No live DB writes per plan spec.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. The `column_mapping` update is a data change to an existing JSONB column. The new `scripts/buildBudgetTree.mjs` is a pure local function module with no network access. No threat flags.

T-36-08 (hardcoded SUPABASE_URL fallback) — **MITIGATED**: WR-04 fix applied. `bulkLoadBudget.js` now fails closed if `SUPABASE_URL` is unset.
T-36-09 (jsonb overwrite) — **MITIGATED**: spread-merge adds single key; all existing keys preserved (verified in acceptance check).
T-36-07 (2-level regression) — **MITIGATED**: Dallas Revenue backward-compat dry-run confirms identical output before/after.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `scripts/buildBudgetTree.mjs` | FOUND |
| `scripts/buildBudgetTree.test.mjs` | FOUND |
| `scripts/bulkLoadBudget.js` (updated) | FOUND |
| Commit `c2ff452` (TDD RED test) | FOUND |
| Commit `d8e26ed` (GREEN implementation) | FOUND |
| `buildBudgetTree.mjs` contains `department_column` | VERIFIED |
| `bulkLoadBudget.js` has NO hardcoded SUPABASE_URL fallback | VERIFIED |
| All 16 unit tests pass | VERIFIED (16/16) |
| Dallas Revenue backward-compat: identical output | VERIFIED |
| Dallas Operating column_mapping has `department_column: 'appropriation'` | VERIFIED (DB query) |
| Dallas Operating FY2026 dry-run shows department nodes | VERIFIED (Police/Water/Debt) |
| No live RPC writes | VERIFIED (dry_run status in output) |
