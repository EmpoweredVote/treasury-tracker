# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Defining requirements for milestone v1.0

## Current Position

Phase: Phase 3 executing — Plan 03-01 (Schema Migration) at checkpoint
Plan: 03-01 partial — Task 1 complete, Task 2 awaiting human action in Supabase SQL editor
Status: Checkpoint: human-action — migration SQL prepared, awaiting user to run in Supabase dashboard
Last activity: 2026-04-22 — 03-01 Task 1 complete (schema-migration.sql prepared, commit 631e628)

## Accumulated Context

### Decisions
- Redirect-driven flow chosen over websockets — simpler, webhook fires before redirect completes
- GiveButter only for v1 real-time — best webhook support among the three platforms
- Supabase Edge Functions as webhook receiver — already in stack
- Frontend reads pre-aggregated budget_categories.amount — webhook MUST update pre-aggregated columns
- Atomic 3-row update per donation: INSERT budget_line_items + UPDATE leaf category amount + UPDATE parent category amount + UPDATE budgets.total_budget
- Use Postgres function treasury.record_givebutter_donation via supabase.rpc() — encapsulates dedup check and atomic multi-row update
- Schema changes applied via Supabase SQL editor (NOT via EV-Backend GORM) — Go API never writes webhook rows
- Dedup via unique partial index on (external_id, source) WHERE external_id IS NOT NULL; loadEVFinances.js preserves source='webhook' rows on clearExistingBudget

### Known Constraints
- Must deduplicate: CSV re-imports should not double-count transactions already written by webhook
- GiveButter return URL must point back to financials.empowered.vote
- Category hierarchy for EV revenue: Donations (depth=0) → Give Butter (depth=1); webhook must update BOTH category amounts + budget total
- Category UUIDs are generated at import time — Edge Function must look up (budget_id, name='Give Butter') and (budget_id, name='Donations') dynamically
