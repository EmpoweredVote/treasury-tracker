# Roadmap — GiveButter Real-Time Donation Feedback (v1.0)

## Phase 1: Donate Button (COMPLETE)

**Goal:** Donate button visible on financials.empowered.vote, opens GiveButter campaign in new tab.
**Status:** Shipped

Plans:
- [x] Phase 1 complete (pre-GSD planning)

---

## Phase 2: Data Layer Audit (COMPLETE)

**Goal:** Confirm how the frontend reads financial data and define the exact atomic update contract for the webhook backend.
**Status:** Complete — 2026-04-21

Plans:
- [x] 02-01-PLAN.md — Audit pre-aggregation pattern + produce Phase 3 technical contract

---

## Phase 3: Webhook Backend

**Goal:** Build the GiveButter → Supabase Edge Function → Postgres RPC pipeline that atomically writes donation events and updates pre-aggregated budget totals.
**Plans:** 5 plans

Plans:
- [ ] 03-01-PLAN.md — Schema migration: add external_id + source columns + dedup index
- [ ] 03-02-PLAN.md — Postgres RPC function: treasury.record_givebutter_donation
- [ ] 03-03-PLAN.md — loadEVFinances.js: source tagging + webhook row preservation
- [ ] 03-04-PLAN.md — Edge Function: create + deploy givebutter-webhook
- [ ] 03-05-PLAN.md — Go-live: register webhook + $1 test + validate all three criteria

---

## Phase 4: Live Feedback UI

**Goal:** Add window focus listener and animated counter on financials.empowered.vote to re-fetch and display updated revenue when donor returns from GiveButter.
**Plans:** TBD — planned after Phase 3 complete

Plans:
- [ ] TBD (created by /gsd:plan-phase)

---

*Roadmap created: 2026-04-21*
*Last updated: 2026-04-21 — Phase 3 plans written*
