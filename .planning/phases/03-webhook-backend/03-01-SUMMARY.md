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
  - "external_id TEXT nullable column on treasury.budget_line_items (live in Supabase)"
  - "source TEXT DEFAULT 'csv' column on treasury.budget_line_items (live in Supabase)"
  - "idx_line_items_external_id_source unique partial index WHERE external_id IS NOT NULL (live in Supabase)"
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent DDL via IF NOT EXISTS guards for safe re-execution"
    - "Partial unique index (WHERE external_id IS NOT NULL) for deduplication without affecting CSV rows"
    - "source DEFAULT 'csv' backfills all pre-existing rows at ALTER TABLE time — no separate UPDATE needed"

key-files:
  created:
    - .planning/phases/03-webhook-backend/schema-migration.sql
  modified: []

key-decisions:
  - "external_id is nullable TEXT with no default — only webhook rows will have it populated"
  - "source TEXT DEFAULT 'csv' — existing rows auto-backfilled to csv on migration"
  - "Unique partial index on (external_id, source) WHERE external_id IS NOT NULL — CSV rows (external_id=NULL) are excluded from uniqueness constraint"
  - "Schema changes applied via Supabase SQL editor only (NOT via EV-Backend GORM or migration tooling)"

patterns-established:
  - "Dedup key: external_id (platform transaction ID) + source (platform name e.g. 'givebutter')"
  - "Webhook rows: source='givebutter', external_id=<UUID>; CSV rows: source='csv', external_id=NULL"
  - "Schema changes applied via Supabase SQL editor only (NOT via EV-Backend GORM or migration tooling)"

# Metrics
duration: ~5min (Task 1 automated; Task 2 human-action checkpoint)
completed: 2026-04-21
---

# Phase 3 Plan 01: Schema Migration Summary

**external_id + source deduplication columns and partial unique index applied to live treasury.budget_line_items — webhook idempotency foundation now active in Supabase**

## Performance

- **Duration:** ~5 min (Task 1 automated SQL prep; Task 2 human-action in Supabase SQL editor)
- **Started:** 2026-04-21
- **Completed:** 2026-04-21
- **Tasks:** 2/2 complete
- **Files modified:** 1

## Accomplishments

- Prepared idempotent schema migration SQL (`schema-migration.sql`) with IF NOT EXISTS guards on all DDL
- User applied migration via Supabase SQL editor and ran verification queries
- `external_id TEXT` nullable column confirmed live — receives GiveButter transaction UUIDs from webhook
- `source TEXT DEFAULT 'csv'` column confirmed live — all pre-existing CSV rows automatically backfilled to source='csv'
- `idx_line_items_external_id_source` unique partial index confirmed live with `WHERE (external_id IS NOT NULL)` — DB-level idempotency guard active

## Verification Results

Confirmed via Supabase SQL editor verification query:

| column_name | data_type | column_default | is_nullable |
|-------------|-----------|----------------|-------------|
| external_id | text      | null           | YES         |
| source      | text      | 'csv'::text    | YES         |

Index `idx_line_items_external_id_source` present with `WHERE (external_id IS NOT NULL)`.

## Task Commits

1. **Task 1: Prepare schema migration SQL** - `631e628` (chore)
2. **Task 2: Apply migration in Supabase SQL editor** - human-action (DDL applied live in Supabase; no source code commit)

**Checkpoint commit:** `e139a05` (docs: checkpoint — Task 1 complete, awaiting Supabase migration)

## Files Created/Modified

- `.planning/phases/03-webhook-backend/schema-migration.sql` - Idempotent migration DDL + verification queries

## Decisions Made

- `external_id` column is nullable with no default — NULL means "originated from CSV import"; only webhook rows will have a value
- `source TEXT DEFAULT 'csv'` ensures all existing rows are backfilled to source='csv' at migration time without a separate UPDATE
- Partial unique index `WHERE external_id IS NOT NULL` means the uniqueness constraint only applies to webhook-originated rows — CSV rows (NULL external_id) are always insertable
- Applied via Supabase SQL editor rather than GORM migrations — keeps DDL out of Go application lifecycle and avoids migration state conflicts

## Deviations from Plan

None - plan executed exactly as written. Task 1 automated SQL preparation; Task 2 was the planned human-action checkpoint.

## Issues Encountered

None.

## User Setup Required

Migration was applied manually by the user in the Supabase SQL editor — this was the intended flow for this plan (DDL cannot be automated via CLI for Supabase hosted projects in this stack).

## Next Phase Readiness

- Schema foundation is complete and live — the two dedup columns and partial index are active in the database
- Plan 03-02 (Postgres RPC function `treasury.record_givebutter_donation`) can now proceed — it depends on `external_id` and `source` columns existing
- Plan 03-03 (Edge Function source tagging in `loadEVFinances.js`) was already completed ahead of this migration
- No blockers for the remaining Wave 1 plans

---
*Phase: 03-webhook-backend*
*Completed: 2026-04-21*
