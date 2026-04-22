# Phase 3: Webhook Backend - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend infrastructure that receives GiveButter donation webhook events, verifies signatures, and atomically updates pre-aggregated budget totals in Postgres. This phase is backend-only — schema migrations, a Postgres RPC function, a Supabase Edge Function, and a loadEVFinances.js update. No UI changes. Phase 4 handles the live feedback UI.

</domain>

<decisions>
## Implementation Decisions

### Failure handling
- Invalid/missing HMAC signature → return **401 Unauthorized** — GiveButter treats this as a permanent failure and does NOT retry (correct behavior; retrying a bad signature won't help)
- DB/RPC error (transient failure) → return **500 Internal Server Error** — GiveButter retries; our idempotency layer handles duplicate delivery safely
- Unrecognized event types (anything other than `transaction.succeeded`) → return **200 OK** and discard silently — no retry, no noise
- Already-processed duplicate (idempotency no-op) → return **200 OK** — success from GiveButter's perspective

### Observability
- Supabase Edge Function logs only — no dead-letter table, no active alerting
- Verify a real donation worked: UI check first (Give Butter total went up), DB query if uncertain (check `budget_line_items` for the row)
- Monitoring cadence: eventual — catch failures on next site visit; active alerting not needed at current donation volume

### Test donation protocol
- Execution: real $1 donation to the live EV GiveButter campaign after Edge Function is deployed
- Who: user (campaign admin) runs the test
- Test data: leave the $1 row in the DB and totals — it's a real donation, let it count
- Go-live success criteria (all three must pass):
  1. UI total on financials.empowered.vote went up by $1
  2. `budget_line_items` row present with correct `external_id` and `source='givebutter_webhook'`
  3. Retry test: re-send the same event via GiveButter dashboard — total must NOT go up again (idempotency confirmed)

### Go-live sequencing
- Schema migration (add `external_id` + `source` columns): apply to live DB anytime — adding nullable columns is non-blocking DDL, no downtime or maintenance window needed
- `loadEVFinances.js` changes: validate by code review only — the two changes (field assignment + WHERE clause) are simple enough to verify by reading the diff
- GiveButter dashboard registration: **last step** — register the webhook URL only after Edge Function is deployed and $1 test is ready; no real events arrive until registration

### Deployment order (locked)
1. Apply schema changes via Supabase SQL editor
2. Create `treasury.record_givebutter_donation` Postgres function
3. Deploy Supabase Edge Function (`givebutter-webhook`)
4. Merge `loadEVFinances.js` update
5. Register webhook URL in GiveButter dashboard
6. Run $1 test donation + validate all three success criteria

### Claude's Discretion
- Exact HMAC algorithm and signature header name — confirm from GiveButter docs during research
- Postgres function parameter names and types — follow Phase 2 contract signature; researcher can finalize
- Edge Function secret storage — Supabase environment variable (standard approach)
- Amount unit (cents vs dollars) — confirm via $1 test; Postgres function must handle whichever format GiveButter sends

</decisions>

<specifics>
## Specific Ideas

- The $1 test donation amount unit confirmation is a required pre-condition for go-live, not a nice-to-have — the Postgres function delta calculation depends on knowing the unit
- "Both — UI first, DB query if uncertain" is the verification pattern for all donation events, not just the test

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-webhook-backend*
*Context gathered: 2026-04-21*
