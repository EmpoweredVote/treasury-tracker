---
phase: 03-webhook-backend
plan: 02
subsystem: database
tags: [postgres, plpgsql, supabase, rpc, atomic-transaction, deduplication]

# Dependency graph
requires:
  - phase: 03-01
    provides: external_id + source columns on budget_line_items; unique partial index (external_id, source)
provides:
  - treasury.record_givebutter_donation() PL/pgSQL function — atomic 4-step donation write with idempotency guard
affects: [03-04-edge-function, 03-05-frontend-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres function as transaction boundary: single supabase.rpc() call guarantees INSERT + 3 UPDATEs atomically"
    - "IF EXISTS idempotency guard as first dedup line, unique partial index as second guard"

key-files:
  created:
    - .planning/phases/03-webhook-backend/postgres-function.sql
  modified: []

key-decisions:
  - "VOID return type — caller only needs success/failure signal, not row data"
  - "Both approved_amount and actual_amount set to p_amount — webhook donations are actual receipts"
  - "source value hardcoded as 'givebutter_webhook' in function body — prevents caller from injecting wrong source"

patterns-established:
  - "RPC pattern: Edge Function resolves UUIDs dynamically, passes them to Postgres function — no hardcoded IDs"

# Metrics
duration: ~3 minutes (Task 1 + checkpoint + Task 2 MCP apply)
completed: 2026-04-22
---

# Phase 3 Plan 02: Postgres RPC Function Summary

**PL/pgSQL atomic donation writer: treasury.record_givebutter_donation with 8-parameter signature, IF EXISTS dedup guard, and 4-step transaction (INSERT + 3 UPDATEs) — confirmed live in Supabase treasury schema**

## Performance

- **Duration:** ~3 minutes
- **Started:** 2026-04-22T03:28:12Z
- **Completed:** 2026-04-22T03:31:02Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 1

## Accomplishments

- SQL file written: `.planning/phases/03-webhook-backend/postgres-function.sql`
- Function signature matches Phase 2 technical contract (8 parameters)
- Idempotency guard: IF EXISTS check on (external_id, source='givebutter_webhook')
- Atomic body: 1 INSERT into budget_line_items + 3 UPDATEs (leaf category, parent category, budget total)
- Function created live in Supabase via MCP tools and verified via information_schema.routines query
- Dry-run test (BEGIN/SELECT/ROLLBACK) confirmed 1 row returned with correct fields — transaction rolled back, no permanent data written

## Task Commits

1. **Task 1: Prepare Postgres function SQL** - `5809bb1` (chore)
2. **Task 2: Create function in Supabase and verify** - applied via Supabase MCP (no code commit — DB-only change)

## Files Created/Modified

- `.planning/phases/03-webhook-backend/postgres-function.sql` — Complete CREATE OR REPLACE FUNCTION SQL with dry-run test block

## Verification Results

### Function existence confirmed

```
routine_name: record_givebutter_donation
routine_schema: treasury
```

### Dry-run UUIDs used (most recent FY revenue budget)

| Variable | UUID |
|---|---|
| budget_id | 441b60a0-a946-44a8-9592-2029e890b072 |
| Give Butter category_id (depth=1) | 0f2c3038-3ce4-4166-9685-75e4fb7bb133 |
| Donations category_id (depth=0) | a9f1086f-40fd-4f18-a0e0-5f2a3d0bd5d5 |

### Dry-run SELECT result (1 row, rolled back)

| Column | Value |
|---|---|
| id | c1693fb5-dadd-426d-b43e-034056e19d5d |
| description | Test donation — dry run |
| actual_amount | 1.00 |
| source | givebutter_webhook |
| external_id | test-external-id-dry-run |

Transaction was rolled back — no permanent data written.

## Decisions Made

- `VOID` return type — caller (Edge Function) only needs success/failure, not row data
- Both `approved_amount` and `actual_amount` set to `p_amount` — webhook donations are actual receipts, not estimates
- `source = 'givebutter_webhook'` hardcoded in function body — prevents caller from injecting an incorrect source value that would break the dedup check

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- UNBLOCKED: `treasury.record_givebutter_donation` exists and is callable
- 03-04 (Edge Function) can now proceed — it will call `supabase.rpc('record_givebutter_donation', {...})` with dynamically resolved UUIDs
- Dynamic UUID resolution pattern confirmed: Edge Function must look up budget_id and category IDs at runtime (not hardcoded)

---
*Phase: 03-webhook-backend*
*Completed: 2026-04-22*
