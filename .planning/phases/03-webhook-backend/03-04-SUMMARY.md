---
phase: "03"
plan: "04"
subsystem: webhook-backend
tags: [supabase, edge-function, deno, givebutter, webhook, typescript]

dependency-graph:
  requires: [03-01, 03-02, 03-03]
  provides: [givebutter-webhook-edge-function-deployed]
  affects: [givebutter-webhook-registration, go-live]

tech-stack:
  added: [supabase-edge-functions, deno]
  patterns: [raw-body-before-parse, xor-timing-safe-equal, dynamic-uuid-lookup, atomic-rpc-call, no-verify-jwt-deploy]

key-files:
  created:
    - supabase/functions/givebutter-webhook/index.ts
  modified: []

key-decisions:
  - "req.text() used before JSON.parse to ensure raw body is available for signature verification"
  - "XOR-based timingSafeEqual implemented manually (Deno does not expose crypto.timingSafeEqual)"
  - "SUPABASE_SERVICE_ROLE_KEY used (not anon key) to bypass RLS on treasury schema"
  - "Dynamic lookup of category UUIDs by name — never hardcoded, safe after loadEVFinances.js re-import"
  - "--no-verify-jwt deploy flag required — GiveButter cannot provide a Supabase JWT"
  - "GIVEBUTTER_SIGNING_SECRET stored as Supabase secret (not in source code)"

patterns-established:
  - "Supabase Edge Function deploy: supabase functions deploy <name> --no-verify-jwt"
  - "Secrets stored via: supabase secrets set KEY=value (never in source)"

duration: ~30min
completed: 2026-04-21
---

# Phase 3 Plan 04: givebutter-webhook Edge Function Summary

**Deno Edge Function deployed to Supabase that verifies GiveButter webhook signatures and calls treasury.record_givebutter_donation RPC atomically — live at https://kxsdzaojfaibhuzmclfq.supabase.co/functions/v1/givebutter-webhook**

## Performance

- **Duration:** ~30 min (across two sessions: source authoring + deployment)
- **Completed:** 2026-04-21
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Created `supabase/functions/givebutter-webhook/index.ts` (146 lines) implementing full webhook receiver
- Deployed Edge Function to Supabase project kxsdzaojfaibhuzmclfq with `--no-verify-jwt` flag
- Stored `GIVEBUTTER_SIGNING_SECRET` as a Supabase secret (never in source code)
- Confirmed live: unauthenticated POST returns 401 (auth gate working correctly)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Edge Function source file** - `fb94990` (feat)
2. **Task 2: Store signing secret and deploy Edge Function** - human-action checkpoint (deployed externally)

**Plan metadata:** TBD (docs: complete plan — this commit)

## Files Created/Modified

- `supabase/functions/givebutter-webhook/index.ts` - Deno Edge Function: signature verification, event filtering, dynamic category UUID lookup, RPC call to treasury.record_givebutter_donation

## Deployment Details

- **Function URL:** `https://kxsdzaojfaibhuzmclfq.supabase.co/functions/v1/givebutter-webhook`
- **Dashboard:** `https://supabase.com/dashboard/project/kxsdzaojfaibhuzmclfq/functions`
- **Deploy flags:** `--no-verify-jwt` (required — GiveButter cannot supply a Supabase JWT)
- **Auth test:** `curl -X POST <url>` with no Signature header → **401** (confirmed live)
- **Secret:** `GIVEBUTTER_SIGNING_SECRET` stored via `supabase secrets set` (not in source)

## Decisions Made

- `req.text()` before `JSON.parse` — raw body captured first; required for current direct-comparison signature verification and trivial to swap to HMAC-SHA256 if needed after $1 live test
- XOR `timingSafeEqual` manual implementation — Deno does not expose `crypto.timingSafeEqual` (Node-only API)
- Service role key used — anon key cannot bypass RLS on `treasury` schema
- Dynamic UUID resolution — `budget_categories` queried by name on each request, never hardcoded
- `--no-verify-jwt` deploy — GiveButter webhooks arrive without a Supabase JWT; function uses its own signature verification instead
- Signing secret stored as Supabase secret — keeps credentials out of source code and git history

## Deviations from Plan

None — plan executed exactly as written. Task 2 was a human-action checkpoint handled by the user deploying directly.

## Authentication Gates

During execution, Task 2 required Supabase CLI deployment and GiveButter signing secret retrieval:

1. User retrieved `GIVEBUTTER_SIGNING_SECRET` from GiveButter dashboard
2. User ran `supabase secrets set GIVEBUTTER_SIGNING_SECRET=<value>`
3. User ran `supabase functions deploy givebutter-webhook --no-verify-jwt`
4. Confirmed: function live, 401 returned for unauthenticated POST

## Issues Encountered

None — Edge Function source passed all verification checks on first authoring. Deployment confirmed successful on first attempt.

## Next Phase Readiness

Plan 03-05 (GiveButter webhook registration + $1 live test) can now proceed:
- Function URL confirmed: `https://kxsdzaojfaibhuzmclfq.supabase.co/functions/v1/givebutter-webhook`
- Function reachable and rejecting unauthenticated requests correctly
- Remaining unconfirmed items (intentional — to be resolved during $1 test):
  - Amount units (cents vs dollars in `tx.amount`)
  - Signature algorithm (direct string comparison vs HMAC-SHA256)
- Function logs available at Supabase dashboard for $1 test diagnostics

---
*Phase: 03-webhook-backend*
*Completed: 2026-04-21*
