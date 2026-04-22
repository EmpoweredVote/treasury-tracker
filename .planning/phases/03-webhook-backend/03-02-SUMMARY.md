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
duration: PENDING (Task 2 not yet complete)
completed: PENDING
---

# Phase 3 Plan 02: Postgres RPC Function Summary

**STATUS: PARTIAL — Task 1 complete, Task 2 (Supabase function creation) pending orchestrator**

**PL/pgSQL atomic donation writer: treasury.record_givebutter_donation with 8-parameter signature, IF EXISTS dedup guard, and 4-step transaction (INSERT + 3 UPDATEs)**

## Performance

- **Duration:** In progress
- **Started:** 2026-04-22T03:28:12Z
- **Completed:** PENDING
- **Tasks:** 1 of 2 complete
- **Files modified:** 1

## Accomplishments

- SQL file written: `.planning/phases/03-webhook-backend/postgres-function.sql`
- Function signature matches Phase 2 technical contract (8 parameters)
- Idempotency guard: IF EXISTS check on (external_id, source='givebutter_webhook')
- Atomic body: 1 INSERT into budget_line_items + 3 UPDATEs (leaf category, parent category, budget total)
- Dry-run test block included with UUID lookup query for safe verification in SQL editor

## Task Commits

1. **Task 1: Prepare Postgres function SQL** - `5809bb1` (chore)
2. **Task 2: Create function in Supabase and verify** - PENDING

## Files Created/Modified

- `.planning/phases/03-webhook-backend/postgres-function.sql` — Complete CREATE OR REPLACE FUNCTION SQL with dry-run test block

## Decisions Made

- `VOID` return type — caller (Edge Function) only needs success/failure, not row data
- Both `approved_amount` and `actual_amount` set to `p_amount` — webhook donations are actual receipts, not estimates
- `source = 'givebutter_webhook'` hardcoded in function body — prevents caller from injecting an incorrect source value that would break the dedup check

## Deviations from Plan

None - plan executed exactly as written for Task 1.

## Issues Encountered

None for Task 1.

## User Setup Required

Task 2 requires applying the SQL via Supabase MCP tools (orchestrator-handled, not manual user action).

## Next Phase Readiness

- BLOCKED on Task 2: function must exist in treasury schema before 03-04 (Edge Function) can call supabase.rpc()
- Once Task 2 is confirmed, 03-04 can proceed immediately

---
*Phase: 03-webhook-backend*
*Completed: PENDING*
