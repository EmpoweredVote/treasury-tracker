# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Defining requirements for milestone v1.0

## Current Position

Phase: Phase 3 executing — Plans 03-01, 03-02, 03-03, 03-04 complete; 03-05 pending
Plan: 03-04 complete — Edge Function deployed and confirmed live (fb94990)
Status: In progress — ready to execute 03-05 (GiveButter webhook registration + $1 live test)
Last activity: 2026-04-21 — 03-04 Task 2: deployed givebutter-webhook Edge Function, 401 confirmed for unauthenticated POST, GIVEBUTTER_SIGNING_SECRET stored as Supabase secret

Progress: █████████░  (4/5 plans in Phase 3 complete)

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
- GIVEBUTTER_SIGNING_SECRET stored as Supabase secret (never in source) — --no-verify-jwt deploy flag required
- Dynamic UUID resolution in Edge Function — budget_categories queried by name on each request, never hardcoded

### Known Constraints
- Must deduplicate: CSV re-imports should not double-count transactions already written by webhook
- GiveButter return URL must point back to financials.empowered.vote
- Category hierarchy for EV revenue: Donations (depth=0) → Give Butter (depth=1); webhook must update BOTH category amounts + budget total
- Category UUIDs are generated at import time — Edge Function must look up (budget_id, name='Give Butter') and (budget_id, name='Donations') dynamically
- Confirmed live UUIDs (most recent FY revenue budget): budget_id=441b60a0-a946-44a8-9592-2029e890b072, Give Butter category=0f2c3038-3ce4-4166-9685-75e4fb7bb133, Donations category=a9f1086f-40fd-4f18-a0e0-5f2a3d0bd5d5
- Amount units (cents vs dollars) and signature algorithm (direct vs HMAC-SHA256) remain unconfirmed — $1 live test in 03-05 will resolve both

### Blockers / Concerns
- None blocking — 03-05 is the final plan in Phase 3, requires registering webhook URL in GiveButter dashboard and running a $1 test donation

## Session Continuity

Last session: 2026-04-21
Stopped at: Completed 03-04-PLAN.md (Task 2 deployment confirmed by user)
Resume file: None
