---
phase: "03"
plan: "04"
subsystem: webhook-backend
tags: [supabase, edge-function, deno, givebutter, webhook, typescript]

dependency-graph:
  requires: [03-01, 03-02, 03-03]
  provides: [givebutter-webhook-edge-function-source]
  affects: [deploy-step, givebutter-webhook-registration]

tech-stack:
  added: [supabase-edge-functions, deno]
  patterns: [raw-body-before-parse, xor-timing-safe-equal, dynamic-uuid-lookup, atomic-rpc-call]

key-files:
  created:
    - supabase/functions/givebutter-webhook/index.ts
  modified: []

decisions:
  - req.text() used before JSON.parse to ensure raw body is available for signature verification
  - XOR-based timingSafeEqual implemented manually (Deno does not expose crypto.timingSafeEqual)
  - SUPABASE_SERVICE_ROLE_KEY used (not anon key) to bypass RLS on treasury schema
  - Dynamic lookup of category UUIDs by name — never hardcoded, safe after loadEVFinances.js re-import
  - --no-verify-jwt deploy flag required — GiveButter cannot provide a Supabase JWT

metrics:
  duration: "< 5 minutes"
  completed: "2026-04-21"
  tasks-completed: 1
  tasks-total: 2
  status: checkpoint — awaiting deployment
---

# Phase 3 Plan 04: givebutter-webhook Edge Function Summary

**One-liner:** Deno Edge Function that verifies GiveButter webhook signatures and calls treasury.record_givebutter_donation RPC atomically.

## Status

**PARTIAL — Task 1 complete, paused at Task 2 checkpoint.**

Task 2 (store signing secret + deploy) requires the GiveButter signing secret from the orchestrator.

## Tasks Executed

### Task 1: Create Edge Function source file — COMPLETE

Commit: `fb94990`

Created `supabase/functions/givebutter-webhook/index.ts` (146 lines).

Key implementation details:
- `req.text()` captures raw body before `JSON.parse` — required for future HMAC signature verification
- XOR-loop `timingSafeEqual` avoids timing oracle on signature comparison
- `SUPABASE_SERVICE_ROLE_KEY` used so Supabase JS client can write to `treasury` schema with RLS bypassed
- Municipality → budget → categories resolved dynamically on every request
- `transaction.succeeded` is the only processed event type; all others return `200 OK` silently
- Logs `rawAmount` and `signatureHeader` for the $1 live test diagnostic

### Task 2: Store signing secret and deploy — PENDING CHECKPOINT

Blocked: requires GiveButter signing secret value and CLI deployment by orchestrator.

## Deviations from Plan

None — Task 1 executed exactly as specified.

## Next Step

Orchestrator resumes with:
1. GiveButter signing secret → `supabase secrets set GIVEBUTTER_SIGNING_SECRET=<value>`
2. Deploy command: `supabase functions deploy givebutter-webhook --no-verify-jwt`
3. Register webhook URL in GiveButter dashboard
