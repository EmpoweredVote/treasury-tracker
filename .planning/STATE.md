# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Defining requirements for milestone v1.0

## Current Position

Phase: Phase 3 executing — Plans 03-01, 03-02, 03-03 complete; 03-04 at checkpoint
Plan: 03-04 Task 1 complete — Edge Function source written and committed (fb94990)
Status: In progress — 03-04 paused at Task 2 checkpoint (deploy + signing secret)
Last activity: 2026-04-21 — 03-04 Task 1: created supabase/functions/givebutter-webhook/index.ts, all verification checks passed, committed fb94990

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
- treasury.record_givebutter_donation: VOID return, both approved_amount and actual_amount set to p_amount, source hardcoded in function body as 'givebutter_webhook'

### Known Constraints
- Must deduplicate: CSV re-imports should not double-count transactions already written by webhook
- GiveButter return URL must point back to financials.empowered.vote
- Category hierarchy for EV revenue: Donations (depth=0) → Give Butter (depth=1); webhook must update BOTH category amounts + budget total
- Category UUIDs are generated at import time — Edge Function must look up (budget_id, name='Give Butter') and (budget_id, name='Donations') dynamically
- Confirmed live UUIDs (most recent FY revenue budget): budget_id=441b60a0-a946-44a8-9592-2029e890b072, Give Butter category=0f2c3038-3ce4-4166-9685-75e4fb7bb133, Donations category=a9f1086f-40fd-4f18-a0e0-5f2a3d0bd5d5
