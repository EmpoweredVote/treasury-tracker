---
phase: 34
plan: "01"
subsystem: ev-accounts-api
tags: [testing, integration, 3-level-tree, vitest, treasury, regression]
dependency_graph:
  requires: []
  provides: [TREE-01, TREE-02, TREE-03-verification-test]
  affects: [C:/EV-Accounts/backend/test/treasury-3level.test.ts]
tech_stack:
  added: []
  patterns: [vitest-live-db-integration, pg-pool-direct-sql, supabase-rpc-call, inline-tree-builder]
key_files:
  created:
    - C:/EV-Accounts/backend/test/treasury-3level.test.ts
  modified: []
decisions:
  - "Use inline tree builder (direct SQL) instead of importing getBudgetById — env.ts calls process.exit(1) at module init if env vars absent; test env does not pre-load dotenv"
  - "Substitute Sacramento CA + Plano TX + Allen TX for TREE-03 — Portland/San Jose have depth-0 only (1-level flat), Dallas already has depth-2 (Unknown category); all three substitutes confirmed max_depth=1 via live query"
  - "Use budgets.municipality_id direct join (not via data_sources) — many budgets have data_source_id=NULL; municipality_id is always populated"
metrics:
  duration: ~70m
  completed_date: "2026-06-08"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 1
---

# Phase 34 Plan 01: 3-Level Tree Infrastructure Verification — Summary

**One-liner:** Integration + regression test proving treasury_sync_budget_tree and getBudgetById already support N-level trees, with TREE-01/02/03 coverage and zero regressions.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Scaffold treasury-3level.test.ts with TREE-01 and TREE-02 | 57a6dd2 (ev-accounts) | Complete |
| 2 | Add TREE-03 backward-compat regression tests + green full suite | 57a6dd2 (ev-accounts) | Complete |
| 3 | Human spot-check 3 city pages + update REQUIREMENTS.md | — | Awaiting human verify |

## What Was Built

`C:/EV-Accounts/backend/test/treasury-3level.test.ts` (356 lines) — a vitest integration + regression test covering:

- **TREE-01**: Calls `supabase.rpc('treasury_sync_budget_tree', ...)` with a 3-level tree (Health and Human Services → Dept of Health Care Services → Medi-Cal, sentinel FY=9999). Asserts the RPC returns `status: 'success'` and that `budget_categories` has exactly one row at each of depths 0, 1, and 2.

- **TREE-02**: Fetches `budget_categories` and `budget_line_items` via direct `pg.Pool` queries (inline tree builder mirroring `getBudgetById`'s `buildTree`). Asserts the 3-level shape: `root → subcategories[0] → subcategories[0] → lineItems` with correct names at each level and no `subcategories` on the leaf node.

- **TREE-03 (x3)**: Read-only queries on Sacramento CA, Plano TX, and Allen TX — each confirms `root.subcategories` exists (Level 2 present) and `root.subcategories[0].subcategories` is `undefined` (no depth-2, correct 2-level backward compat shape).

- **Cleanup (T-34-01)**: `afterAll` issues `DELETE FROM treasury.budgets WHERE id = testBudgetId`; FK cascade removes `budget_categories` and `budget_line_items`. Sentinel FY=9999 makes leaked rows identifiable. Post-run: zero FY=9999 rows confirmed.

## Test Results

```
treasury-3level.test.ts: 5/5 passed

Full suite: 18 failed / 432 passed (identical to pre-existing baseline; no regressions)
Pre-existing failures (not caused by this plan):
  - compass auth enforcement tests (5 failures)
  - gems tests (2 failures)
  - treasury-cities SSL config (2 failures)
  - coordinateLeakage architecture tests (2 failures)
  - stanceResearchCsv module resolution (suite-level fail)
  - ctcCivicSpaces/other integration tests (7 failures)
```

## Checkpoint (Task 3): Awaiting Human Verification

The live city page spot-check and REQUIREMENTS.md update are gated on human approval. After approval:

1. Update `.planning/REQUIREMENTS.md`:
   - Change `- [ ] **TREE-01**` to `- [x] **TREE-01**` (and TREE-02, TREE-03)
   - Add note: `(satisfied by existing infrastructure + treasury-3level.test.ts, Phase 34)`
   - Change `Traceability` table Status for TREE-01/02/03 from `Pending` to `Complete`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TREE-03 city substitution — Portland/San Jose/Dallas did not match expected 2-level shape**
- **Found during:** Task 2
- **Issue:** The plan targeted Portland OR, San Jose CA, Dallas TX as known 2-level cities. Live inspection showed:
  - Portland OR: all fiscal years have only depth-0 categories (flat list, no parent_id hierarchy — 1-level)
  - San Jose CA: all fiscal years have only depth-0 categories (flat list — 1-level)
  - Dallas TX: all fiscal years already have depths 0, 1, AND 2 ("Unknown" category at each depth — 3-level data)
- **Fix:** Substituted Sacramento CA, Plano TX, Allen TX — all confirmed `max_depth=1` via live query `SELECT max(bc.depth::int) FROM treasury.budget_categories bc JOIN treasury.budgets b ON b.id = bc.budget_id JOIN treasury.municipalities m ON m.id = b.municipality_id WHERE m.name = '...'`
- **Files modified:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts`
- **Commit:** 57a6dd2 (ev-accounts)
- **Note:** The substitution is explicitly sanctioned by the plan ("If a city has no operating budget row, substitute another confirmed 2-level city from STATE.md's seeded list").

**2. [Rule 3 - Blocking] Fallback to inline tree builder for TREE-02 — getBudgetById import blocked by env.ts**
- **Found during:** Task 1
- **Issue:** Importing `getBudgetById` from `@backend/lib/treasuryService.ts` would have triggered `env.ts`'s `process.exit(1)` at module initialization if env vars were absent. The test environment does not pre-load dotenv (confirmed by running existing arcgis test which also fails with "password authentication failed for user 'Chris'" when env is not loaded).
- **Fix:** Used the explicitly sanctioned fallback: "fall back to verifying TREE-02 via the recursive `parent_id` shape using direct SQL (build the tree in-test)." Implemented `buildTreeFromRows()` mirroring `treasuryService.ts:buildTree()` exactly.
- **Files modified:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts`
- **Commit:** 57a6dd2 (ev-accounts)

**3. [Rule 1 - Bug] budgets join via municipality_id directly, not through data_sources**
- **Found during:** Task 2
- **Issue:** Original TREE-03 queries joined `budgets → data_sources → municipalities`. Live inspection showed `data_source_id` is NULL on many budget rows (confirmed: Portland, San Jose, Dallas all have `data_source_id: null`). The correct join path is `budgets.municipality_id → municipalities.id` directly.
- **Fix:** Updated queries to use `JOIN treasury.municipalities m ON m.id = b.municipality_id` with `b.dataset_type` filter directly.
- **Commit:** 57a6dd2 (ev-accounts)

## Known Stubs

None. The test file is a pure verification test with no data stubs.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The test file accesses the existing `treasury.*` schema and `treasury_sync_budget_tree` RPC — both already exposed. T-34-01 and T-34-02 mitigations are implemented.

## Self-Check

- [x] `C:/EV-Accounts/backend/test/treasury-3level.test.ts` exists (356 lines)
- [x] `treasury_sync_budget_tree` string present in test file (3 occurrences)
- [x] Commit 57a6dd2 exists in ev-accounts repo master branch
- [x] Post-run: `SELECT count(*) FROM treasury.budgets WHERE fiscal_year = 9999` returns 0 (cleanup confirmed)
- [x] Full suite: 18 failures are pre-existing (identical before and after our changes)

## Self-Check: PASSED
