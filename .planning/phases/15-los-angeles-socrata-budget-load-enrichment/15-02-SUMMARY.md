---
phase: 15-los-angeles-socrata-budget-load-enrichment
plan: 02
subsystem: database
tags: [supabase, nodejs, socrata, budget-load, los-angeles, california, treasury-sync-budget-tree, idempotency]

# Dependency graph
requires:
  - phase: 15-01
    provides: "LA municipality row (id=391bf791) + Los Angeles Operating Budget data_sources row (id=01c50191)"
  - phase: 05-socrata-budget-load
    provides: "bulkLoadBudget.js generic Socrata loader + treasury_sync_budget_tree RPC"
provides:
  - "treasury.budgets FY2025 operating row for LA: id=5a85c4a6-456f-49ba-af63-771dd0dde3a5, total_budget=$19,855,424,569"
  - "treasury.budgets FY2026 operating row for LA: id=c24fec94-e886-4c47-ab1d-2cd7a505c4d1, total_budget=$21,431,295,120"
  - "treasury.budget_categories: 558 rows for FY2025 (58 depth-0, 500 depth-1), 442 rows for FY2026 (56 depth-0, 386 depth-1)"
  - "Idempotency confirmed: FY2025 re-run produces identical total_budget and category counts"
affects:
  - 15-03 (enrichment will use these budget_ids and municipality_id)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "treasury.budgets schema uses total_budget (not total_amount) and has no row_count column — plan's SQL queries used wrong column names; actual data verified via Supabase JS client"
    - "treasury_sync_budget_tree RPC updates existing budget rows by municipality_id+fiscal_year+dataset_type (not by data_source_id); budget rows may retain old data_source string but totals and categories are replaced"

key-files:
  created: []
  modified: []

key-decisions:
  - "No files modified — plan 15-02 is pure loader execution + DB verification"
  - "budget.total_budget (not total_amount) confirmed as actual column name — matches actual DB schema"
  - "treasury_sync_budget_tree RPC matches budget rows by municipality_id+fiscal_year+dataset_type; pre-existing LA budget rows from data.lacity.org were updated in-place with correct totals and new category trees"
  - "Revenue rows for LA exist from pre-existing CA State Controller and Socrata sources — these are NOT created by our loader; zero revenue rows exist for our data_source_id (01c50191)"

patterns-established:
  - "Socrata loader verification: confirm via JS client with db.schema='treasury' option; Supabase CLI local connection fails for remote DB"

# Metrics
duration: 5min
completed: 2026-05-22
---

# Phase 15 Plan 02: Load LA Operating Budgets Summary

**LA Operating Budget FY2025 ($19.8B, 58 departments) and FY2026 ($21.4B, 59 departments) loaded via bulkLoadBudget.js with idempotency confirmed on re-run**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-22T16:50:50Z
- **Completed:** 2026-05-22T16:56:48Z
- **Tasks:** 2 of 2
- **Files modified:** 0 (loader execution only — no source file changes)

## Accomplishments

- Confirmed `bulkLoadBudget.js --list` discovers 'Los Angeles Operating Budget (operating) — FYs: 2025, 2026'
- Dry-runs confirmed exact match to RESEARCH.md verified counts: FY2025=3,786 rows/$19.8B, FY2026=3,306 rows/$21.4B
- Live loads completed: FY2025 (3,056 line items inserted), FY2026 (2,517 line items inserted)
- DB verified: both budget rows have correct totals and >= 50 top-level (depth-0) categories
- Idempotency confirmed: FY2025 re-run produced identical total_budget and category counts

## Final DB State

### Query 1 — LA Operating Budget Rows

| fiscal_year | dataset_type | total_budget | budget_id |
|---|---|---|---|
| 2025 | operating | $19,855,424,569 | 5a85c4a6-456f-49ba-af63-771dd0dde3a5 |
| 2026 | operating | $21,431,295,120 | c24fec94-e886-4c47-ab1d-2cd7a505c4d1 |

**Note:** `total_budget` is the actual column name in treasury.budgets (the plan referred to it as `total_amount` — see Schema Difference below). No `row_count` column exists in this table.

### Query 2 — Category Trees

| fiscal_year | depth-0 (departments) | depth-1 (subcategories) | total_category_rows |
|---|---|---|---|
| 2025 | 58 | 500 | 558 |
| 2026 | 56 | 386 | 442 |

Both years: >= 50 top-level categories (>= 50 threshold). Subcategories > 0. Total > 100.

### Query 3 — Revenue Rows from Our Source

`revenue_rows = 0` from data_source_id `01c50191-831e-4c88-82ef-e62a2e200e2b`

Pre-existing revenue rows exist for LA from other sources (CA State Controller, data.lacity.org) — these were NOT created by this plan and are unaffected.

### Idempotency Verification

FY2025 re-run (third total invocation):
- **total_budget:** 19,855,424,569 — IDENTICAL to first load
- **depth-0 categories:** 58 — IDENTICAL
- **depth-1 categories:** 500 — IDENTICAL
- **total_category_rows:** 558 — IDENTICAL

Idempotency confirmed. `treasury_sync_budget_tree` uses clear-and-rebuild semantics.

## Key UUIDs for Plan 15-03

- **LA municipality_id:** `391bf791-1c1f-424f-a7a5-1b698c79093f`
- **FY2025 budget_id:** `5a85c4a6-456f-49ba-af63-771dd0dde3a5`
- **FY2026 budget_id:** `c24fec94-e886-4c47-ab1d-2cd7a505c4d1`
- **LA data_sources id:** `01c50191-831e-4c88-82ef-e62a2e200e2b`

## Task Commits

No source files were modified by either task — the plan runs an existing loader against live Socrata data and verifies DB state. Per commit rules, per-task commits are skipped when nothing was staged.

**Plan metadata:** (docs commit below)

## Files Created/Modified

None — this plan is pure loader execution + DB verification. No scripts modified.

## Decisions Made

- `treasury.budgets` schema uses `total_budget` (not `total_amount` as the plan's SQL queries assumed). The plan's Query 1 and Query 2 templates reference `total_amount` and `row_count` which do not exist. Actual verification was done via the Supabase JS client which reveals the true column names. This is a documentation gap only — data is correct.
- `treasury_sync_budget_tree` RPC matches budget rows by municipality_id+fiscal_year+dataset_type, NOT by data_source_id. Pre-existing LA budget rows from prior work had their `total_budget` and `budget_categories` replaced in-place by our run. The `data_source` string field on the budget row retained its old value ("Socrata: https://data.lacity.org") but the category data is from our new run.
- Revenue rows for LA exist from pre-existing sources — these are completely unaffected by our operating-only loader.

## Deviations from Plan

### Schema Difference (Observation Only — not a bug)

The plan's verification SQL queries reference column `total_amount` and `row_count` on `treasury.budgets`. The actual schema has `total_budget` (not `total_amount`) and no `row_count` column. This caused the SQL template in the plan to fail if run verbatim, but was detected immediately during verification via the JS client. All data was verified correctly using the actual column name `total_budget`.

- **Detected:** During Task 2 DB verification (first attempt with wrong column name)
- **Impact:** No data impact — data landed correctly; only the plan's suggested SQL queries used wrong column names
- **Fix:** Verified using Supabase JS client with `.select('*')` to discover actual schema, then queried with correct column name
- **Recommendation for Plan 15-03:** Use `total_budget` not `total_amount` in any SQL queries for treasury.budgets

---

**Total deviations:** 0 auto-fix deviations; 1 schema observation (plan SQL templates reference wrong column names — data correct)
**Impact on plan:** All must-haves satisfied. Schema difference does not affect data correctness.

## Issues Encountered

- Supabase CLI `db query` fails (cannot connect to remote DB via local CLI). All DB verification used Supabase JS client with `{ db: { schema: 'treasury' } }` option — this is the correct approach per project memory.
- Treasury.budgets has `total_budget` not `total_amount`. Initial attempts to select by column name failed; resolved by querying `*` first to discover schema.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- LA FY2025 and FY2026 operating budget categories are loaded and ready for enrichment
- Plan 15-03 (enrichment) can run immediately: `node scripts/enrichCategories.js --city "Los Angeles" --state "CA" --dry-run`
- FY2025 budget_id `5a85c4a6-456f-49ba-af63-771dd0dde3a5` needed for enrichment verification queries
- FY2026 budget_id `c24fec94-e886-4c47-ab1d-2cd7a505c4d1` needed for enrichment verification queries
- 58 unique department_names (FY2025) await enrichment — estimated cost ~$0.12 (well under $5 threshold)
- Reminder: use `--year 2026` flag for FY2026 enrichment or run FY2025 only (same departments, idempotent)

---
*Phase: 15-los-angeles-socrata-budget-load-enrichment*
*Completed: 2026-05-22*
