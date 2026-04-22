---
phase: 03-webhook-backend
plan: 01
subsystem: database
tags: [postgres, supabase, ddl, schema-migration, deduplication, partial-index]

# Dependency graph
requires:
  - phase: 02-data-layer-audit
    provides: "Confirmed treasury.budget_line_items schema and dedup strategy"
provides:
  - "schema-migration.sql: idempotent DDL for external_id + source columns and partial unique index"
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent DDL via IF NOT EXISTS guards for safe re-execution"
    - "Partial unique index (WHERE external_id IS NOT NULL) for deduplication without affecting CSV rows"

key-files:
  created:
    - .planning/phases/03-webhook-backend/schema-migration.sql
  modified: []

key-decisions:
  - "external_id is nullable TEXT with no default — only webhook rows will have it populated"
  - "source TEXT DEFAULT 'csv' — existing rows auto-backfilled to csv on migration"
  - "Unique partial index on (external_id, source) WHERE external_id IS NOT NULL — CSV rows (external_id=NULL) are excluded from uniqueness constraint"

patterns-established:
  - "Schema changes applied via Supabase SQL editor only (NOT via EV-Backend GORM or migration tooling)"

# Metrics
duration: ~3min (Task 1 only; awaiting human action for Task 2)
completed: 2026-04-22
---

# Phase 3 Plan 01: Schema Migration Summary

**STATUS: PARTIAL — Task 1 complete, Task 2 pending human action in Supabase SQL editor**

**schema-migration.sql prepared with idempotent DDL adding external_id TEXT + source TEXT DEFAULT 'csv' columns and partial unique index idx_line_items_external_id_source to treasury.budget_line_items**

## Performance

- **Duration:** ~3 min (Task 1 only)
- **Started:** 2026-04-22T02:54:33Z
- **Completed:** 2026-04-22T02:57:00Z (partial — checkpoint reached)
- **Tasks:** 1/2 complete
- **Files modified:** 1

## Accomplishments

- Prepared idempotent schema migration SQL with IF NOT EXISTS guards
- Defined partial unique index that enforces deduplication for webhook rows without affecting CSV rows
- Verification queries included in the same file for immediate post-migration confirmation

## Task Commits

1. **Task 1: Prepare schema migration SQL** - `631e628` (chore)
2. **Task 2: Apply migration in Supabase SQL editor** - PENDING (human-action checkpoint)

## Files Created/Modified

- `.planning/phases/03-webhook-backend/schema-migration.sql` - Full migration DDL + verification queries

## Decisions Made

- `external_id` column is nullable with no default — NULL means "originated from CSV import"; only webhook rows will have a value
- `source TEXT DEFAULT 'csv'` ensures all existing rows are backfilled to source='csv' at migration time without a separate UPDATE
- Partial unique index `WHERE external_id IS NOT NULL` means the uniqueness constraint only applies to webhook-originated rows — CSV rows (NULL external_id) are always insertable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Task 2 requires manual execution in the Supabase SQL editor.**

Steps:
1. Open: https://supabase.com/dashboard/project/kxsdzaojfaibhuzmclfq/sql/new
2. Copy the ALTER TABLE + CREATE UNIQUE INDEX block from `.planning/phases/03-webhook-backend/schema-migration.sql`
3. Click "Run" — expect "Success. No rows returned."
4. Run the verification SELECT queries from the same file
5. Confirm results match expected column definitions and index

## Next Phase Readiness

- **Blocked:** Plans 03-02 through 03-05 require these columns to exist in the live database
- **Ready after checkpoint:** Once migration is applied and verified, 03-02 (Postgres RPC function) can proceed immediately — the function references external_id and source directly

---
*Phase: 03-webhook-backend*
*Completed: 2026-04-22 (partial)*
