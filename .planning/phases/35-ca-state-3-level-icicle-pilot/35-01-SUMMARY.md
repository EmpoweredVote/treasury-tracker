---
phase: 35-ca-state-3-level-icicle-pilot
plan: "01"
subsystem: database
tags: [discovery, supabase-rpc, treasury-sync-budget-tree, python, openpyxl, california]

requires:
  - phase: 34-3-level-tree-infrastructure-ev-accounts-api
    provides: treasury_sync_budget_tree RPC accepting N-level trees (verified in treasury-3level.test.ts)
  - phase: 33-ca-state-budget-data
    provides: CA data source id e47a4cb5, extractCA.py with COLS['function']=2 defined

provides:
  - A1 CONFIRMED: CA GF FY2026 function distribution (219 rows, 100% non-null, 3 distinct values)
  - A2 VERDICT ACCEPTED: treasury_sync_budget_tree accepts mixed c+i nodes (branch + direct items)
  - D-05 strategy for Plan 02: emit mixed nodes (not the fallback)
  - 35-DISCOVERY.md with all findings, test evidence, and DB cleanup confirmation

affects:
  - 35-02-PLAN: buildNLevelTree collapse handling uses ACCEPTED strategy; mixed nodes safe to emit

tech-stack:
  added: []
  patterns:
    - sentinel-fy-rpc-test: use FY=9998 as sentinel for live RPC tests, query by returned budget_id, cascade-delete for cleanup

key-files:
  created:
    - .planning/phases/35-ca-state-3-level-icicle-pilot/35-DISCOVERY.md
  modified: []

key-decisions:
  - "A2 VERDICT: ACCEPTED — treasury_sync_budget_tree accepts mixed c+i nodes; D-05 can safely emit them"
  - "A1: all CA GF FY2026 rows have non-null function (100%); only 3 distinct values: State Operations, Local Assistance, Capital Outlay"
  - "D-05 strategy: emit mixed nodes for Plan 02 (not fallback drop-items approach)"
  - "rows_inserted from RPC counts line items not categories; 3 categories created but rows_inserted=2 (correct)"

patterns-established:
  - "Sentinel FY discovery test: use FY=9998, call treasury_sync_budget_tree directly (not via processCA.js so sanity band bypassed), query by returned budget_id, cascade-delete via budgets table delete"

requirements-completed: [ICICLE-01]

duration: 35min
completed: 2026-06-08
---

# Phase 35 Plan 01: Discovery — A1 Function Distribution + A2 Mixed-Node RPC Test

**A2 VERDICT ACCEPTED: treasury_sync_budget_tree accepts mixed c+i nodes (branch with both function children and collapsed null-function items), enabling the D-05 emit-mixed-nodes strategy for Plan 02's buildNLevelTree implementation.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-08T22:00:00Z
- **Completed:** 2026-06-08T22:35:40Z
- **Tasks:** 2
- **Files modified:** 1 (created 35-DISCOVERY.md)

## Accomplishments

- Measured A1: CA General Fund FY2026 has 219 rows, all with non-null function values (100%). Only 3 distinct values: `State Operations` (138 rows), `Local Assistance` (66 rows), `Capital Outlay` (15 rows). All are human-readable names (A3 confirmed).
- Resolved A2 via live RPC test: `treasury_sync_budget_tree` accepts a department node with BOTH `c` (function children) AND `i` (collapsed null-function line items). Both items landed in the DB. Verdict: ACCEPTED.
- Decided D-05 implementation strategy for Plan 02: emit mixed nodes. No fallback needed.
- All test infrastructure cleaned up: sentinel FY=9998 budget deleted (0 remaining rows confirmed), temp scripts deleted.

## Task Commits

Each task was committed atomically. Tasks 1 and 2 both contribute to the same output file (35-DISCOVERY.md), so they share one commit:

1. **Task 1: A1 function distribution** + **Task 2: A2 mixed-node test** - `78c57d0` (docs)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `.planning/phases/35-ca-state-3-level-icicle-pilot/35-DISCOVERY.md` - Complete discovery document: A1 distribution data, A2 test tree, RPC response, DB row counts, verdict, D-05 strategy, cleanup confirmation

## Decisions Made

- **A2 VERDICT: ACCEPTED** — The RPC stores items on branch nodes that also have children. The `rows_inserted` count in the RPC response counts line items (2), not categories (3 were created). This is the correct behavior.
- **D-05 strategy for Plan 02:** "Emit mixed nodes: a department with both null-function rows and non-null-function rows produces `{ n, a, c: [function children], i: [collapsed null-function line items] }`."
- **A1 implication:** For FY2026, every row has a non-null function, so the mixed-node case won't arise in practice for FY2026. But other FYs may have null-function rows, so mixed-node handling is still necessary for correctness.
- **Sentinel FY cleanup pattern:** The RPC returns a `budget_id`. That budget_id may not match a query by `data_source_id + fiscal_year` alone (the RPC may reuse existing budgets). Always delete by the returned `budget_id` after confirming `fiscal_year = 9998`. Also verify by querying `data_source_id + fiscal_year = 9998` to catch any edge cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] budget query by data_source_id+FY returned empty results despite successful RPC call**

- **Found during:** Task 2 (A2 mixed-node test)
- **Issue:** Initial budget query used `data_source_id = CA_DATA_SOURCE_ID AND fiscal_year = 9998`. The first run returned 0 budgets even though the RPC returned `status: success` and `budget_id`. Investigation revealed the RPC was storing the budget successfully but the query needed to use the returned `budget_id` directly, not filter by data_source_id+FY (the budget row had `data_source_id = null` in the DB — the RPC may not propagate data_source_id to the budgets table).
- **Fix:** Changed the verification query to query `budget_categories` directly by the `budget_id` returned from the RPC. Also fixed the `budget_line_items` column name (`amount` → `approved_amount`, as verified by schema inspection).
- **Files modified:** Only the temporary test script (deleted after use)
- **Verification:** Re-run with corrected queries confirmed A2 ACCEPTED: 3 categories + 2 line items in DB
- **Committed in:** Not committed (temp script only; result documented in 35-DISCOVERY.md)

---

**Total deviations:** 1 auto-fixed (Rule 1 — query bug in temp test script)
**Impact on plan:** Fix was contained to the throwaway test script. The DISCOVERY.md findings are fully accurate. No scope creep.

## Issues Encountered

- `budget_line_items.amount` column does not exist — the correct column is `approved_amount`. This only affected the temp test script (not any source scripts). Discovered by querying the schema directly.
- The RPC's returned `budget_id` for the sentinel call matched a budget with `data_source_id = null` — meaning the budget row itself does not store the `data_source_id` reliably. For cleanup, always use the RPC-returned `budget_id`, not a `data_source_id + fiscal_year` filter.

## User Setup Required

None — no external service configuration required. This was a pure discovery plan.

## Next Phase Readiness

Plan 02 can proceed immediately with full confidence:

- **A2 ACCEPTED** → `buildNLevelTree()` can safely emit mixed nodes (departments with both `c` children and `i` items). No fallback implementation needed.
- **A1 CONFIRMED** → All FY2026 rows have non-null function values. The 3 function values are human-readable names usable directly as icicle node labels.
- **D-05 strategy is decided** → "Emit mixed nodes" strategy written into 35-DISCOVERY.md `## D-05 Strategy Decision` section. Plan 02 executor should read that section before implementing `buildNLevelTree()`.
- **No source scripts were modified** → `extractCA.py` and `processCA.js` are untouched; Plan 02 starts from the clean baseline.

## Known Stubs

None. This is a pure discovery plan — no application code was written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The sentinel RPC test accessed the existing `treasury_sync_budget_tree` RPC and `treasury.*` tables — all already exposed. T-35-01 mitigation was implemented (sentinel FY9998 deleted, verified 0 rows). T-35-02 mitigation was implemented (no hardcoded keys; temp script deleted).

## Self-Check: PASSED

- [x] `.planning/phases/35-ca-state-3-level-icicle-pilot/35-DISCOVERY.md` exists
- [x] `## A1 — Function Distribution (FY2026)` section present
- [x] `## A2 — Mixed c+i Node RPC Test` section present
- [x] `## D-05 Strategy Decision` section present
- [x] `A2 VERDICT: ACCEPTED` line present
- [x] Commit `78c57d0` exists (verified below)
- [x] `scripts/extractCA.py` unmodified
- [x] `scripts/processCA.js` unmodified
- [x] No temp scripts in `scripts/` directory
- [x] Sentinel FY9998 budget deleted (0 rows confirmed during test run)

---
*Phase: 35-ca-state-3-level-icicle-pilot*
*Completed: 2026-06-08*
