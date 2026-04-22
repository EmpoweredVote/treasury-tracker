---
phase: 03-webhook-backend
plan: 05
subsystem: integration
tags: [givebutter, supabase, edge-functions, webhook, go-live]

requires:
  - phase: 03-04
    provides: Deployed givebutter-webhook Edge Function
  - phase: 03-01
    provides: Schema migration (external_id, source columns)
  - phase: 03-02
    provides: treasury.record_givebutter_donation RPC function

provides:
  - Live GiveButter → Supabase webhook pipeline
  - Go-live validation: all three criteria passed
  - Confirmed payload format for future reference

affects: [phase-04-live-feedback-ui]

tech-stack:
  added: []
  patterns:
    - "GiveButter payload: event field (not type), amount in dollars, Signature header = raw secret"

key-files:
  modified:
    - supabase/functions/givebutter-webhook/index.ts

key-decisions:
  - "GiveButter uses 'event' field not 'type' — corrected during go-live test"
  - "Amount unit is dollars — GiveButter sends 1 for $1 donation"
  - "Signature verification: raw string timingSafeEqual confirmed correct"
  - "Two test rows (sample_tid, bGW8W4biXCnyf9cH) cleaned up manually; live DB has only real donation"

duration: ~45min
completed: 2026-04-22
---

# Phase 3 Plan 05: Go-Live Validation Summary

**GiveButter webhook pipeline live: $1 test donation recorded correctly, idempotency confirmed, both payload ambiguities resolved — Phase 3 complete.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-04-22
- **Tasks:** 4/4
- **Files modified:** 1

## Accomplishments

- Registered GiveButter webhook in dashboard (name: "Treasury Tracker", event: `transaction.succeeded`, URL: `https://kxsdzaojfaibhuzmclfq.supabase.co/functions/v1/givebutter-webhook`)
- Made $1 live test donation — webhook received and processed correctly after fix
- Discovered and corrected two payload format mismatches (event field name, amount unit) — see Deviations
- Real transaction `gWEN4NctLu3pe1rc` from BJ Cantrell ($1.00) is the audit trail anchor
- All three go-live criteria validated: DB row present, category totals updated, idempotency confirmed
- Cleaned up two spurious test rows from development; live DB is production-clean

## Task Commits

1. **Task 1: Webhook registered in GiveButter** — human-action checkpoint (no commit; dashboard action)
2. **Task 2: $1 test donation made** — human-action checkpoint (two donations; second clean)
3. **Task 3: Ambiguities resolved** — `382a0b6` (fix(03-04): correct event field name and amount unit)
4. **Task 4: Go-live criteria validated** — all three pass (see criteria below)

**Task 3 fix commit:** `382a0b6`
**Edge Function creation commit:** `fb94990` (from 03-04)

## Files Created/Modified

- `supabase/functions/givebutter-webhook/index.ts` — Fixed: event field check changed from `type` to `event`; amount passed as dollars (no conversion needed — `amount / 100` removed)

## Go-Live Criteria Results

All three criteria passed on 2026-04-22:

**Criterion 1 — DB row present**
- Query: `SELECT * FROM treasury.budget_line_items WHERE source = 'givebutter_webhook'`
- Result: Row present with `external_id = gWEN4NctLu3pe1rc`, `actual_amount = 1.00`, `source = givebutter_webhook`, `description = "Donation from BJ Cantrell"`
- Status: **PASS**

**Criterion 2 — Category and budget totals updated**
- Give Butter category total: 311.00 (includes $1 test donation)
- Budget total: 1036.51 (reflects $1 addition)
- Status: **PASS**

**Criterion 3 — Idempotency confirmed**
- RPC called twice with same `external_id = gWEN4NctLu3pe1rc`
- Result: exactly 1 row in DB, total unchanged after second call
- Status: **PASS**

## Payload Format — Confirmed Truths

These were previously unconfirmed ambiguities. Resolved via live test:

| Field | Confirmed Value | Notes |
|-------|----------------|-------|
| Event field name | `event` (not `type`) | GiveButter uses `event` key in payload; `type` is not present |
| Amount unit | Dollars | Real $1 donation sends `amount = 1` (not 100) |
| Signature header | Raw string comparison (`timingSafeEqual`) | Signature header value equals the raw secret; no HMAC-SHA256 needed |

**Signature header name:** `Signature` (capital S, confirmed from delivery log)

## Decisions Made

- GiveButter payload uses `event` field not `type` — initial implementation checked wrong key; corrected in 382a0b6
- Amount unit is dollars — `amount = 1` for a $1 donation; no cents conversion needed; initial code had no division which turned out correct
- Signature is raw string comparison — `timingSafeEqual(sig, SIGNING_SECRET)` is the correct algorithm; HMAC-SHA256 is not used
- Test rows cleaned up manually (sample_tid at $1, bGW8W4biXCnyf9cH at $0.01) — category and budget totals reversed accordingly; live DB is clean with only `gWEN4NctLu3pe1rc`
- Real donation `gWEN4NctLu3pe1rc` ($1.00 from BJ Cantrell, 2026-04-22) is preserved in DB — real donations are never deleted per locked project decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Event field name: `type` → `event`**

- **Found during:** Task 3 (analyzing delivery logs after $1 test)
- **Issue:** The Edge Function checked `payload.type === 'transaction.succeeded'` but GiveButter sends `payload.event` not `payload.type`. This caused every valid webhook to be silently discarded (200 returned but no DB write).
- **Fix:** Changed event check from `if (payload.type !== 'transaction.succeeded')` to `if (payload.event !== 'transaction.succeeded')` in `supabase/functions/givebutter-webhook/index.ts`
- **Files modified:** `supabase/functions/givebutter-webhook/index.ts`
- **Commit:** `382a0b6`

**2. [Rule 2 - Missing Critical] Amount unit confirmed as dollars — no code change required**

- **Found during:** Task 3 (log analysis)
- **Issue:** Pre-go-live, amount unit (cents vs dollars) was flagged as unconfirmed. The plan contained a branch for `amount / 100` if cents were detected.
- **Resolution:** `rawAmount = 1` for the $1 donation — dollars confirmed. No code change needed. Original code was already correct.
- **Documented as:** Confirmed — dollars, no fix applied.

### Test Data Cleanup

During development (prior to the clean test), two spurious rows were inserted:

| external_id | amount | Reason | Action |
|-------------|--------|--------|--------|
| `sample_tid` | $1.00 | Initial function testing with a placeholder ID | Deleted manually via Supabase SQL editor |
| `bGW8W4biXCnyf9cH` | $0.01 | First $1 test donation; event field bug caused amount unit confusion | Deleted manually via Supabase SQL editor |

Category (Give Butter) and budget totals were reversed for each deleted row to restore correct baseline. Final state before audit validation: Give Butter = 310.00, budget total = 1035.51. After $1 test donation: Give Butter = 311.00, budget total = 1036.51.

## Issues Encountered

One delivery failure before fix: the first $1 donation (transaction `bGW8W4biXCnyf9cH`) was processed but the event field bug caused it to be silently discarded. GiveButter delivery log showed 200, but no DB write occurred. The row was from a subsequent manual RPC test, not from the webhook. After applying fix 382a0b6 and redeploying, the second $1 donation (`gWEN4NctLu3pe1rc`) processed correctly end-to-end.

## Next Phase Readiness

Phase 4 (Live Feedback UI) is unblocked:

- Webhook pipeline is live and production-clean
- `budget_categories.amount` is updated atomically on each donation (confirmed by Criterion 2)
- Frontend can poll or re-fetch `budget_categories` to show updated totals
- Phase 4 requirements (UI-04, UI-05, UI-06) are ready to plan

No blockers. No outstanding ambiguities.

---
*Phase: 03-webhook-backend*
*Completed: 2026-04-22*
