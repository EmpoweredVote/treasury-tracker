# Requirements: GiveButter Real-Time Donation Feedback

**Defined:** 2026-04-21
**Core Value:** A donor clicks Donate, gives on GiveButter, and immediately sees their contribution reflected in the live incoming total — closing the "did it matter?" loop instantly.

---

## v1 Requirements

### Phase 1 — Donate Button (SHIPPED ✓)

- ✓ **UI-01**: Donate button visible on financials.empowered.vote for EV nonprofit entity only
- ✓ **UI-02**: Donate button opens GiveButter campaign (givebutter.com/g3e9u9) in a new tab
- ✓ **UI-03**: Button uses secondary visual weight (border style, not filled CTA) — transparency page, not a fundraising page

### Phase 2 — Data Layer Audit (prerequisite)

- [ ] **DATA-01**: Confirm whether frontend reads from pre-aggregated `budget_categories.amount` or sums `budget_line_items.actual_amount` directly (audit `loadBudgetData`)
- [ ] **DATA-02**: If pre-aggregated: define strategy for Edge Function to also update `budget_categories.amount` atomically

### Phase 3 — Webhook Backend

- [ ] **SCH-01**: `budget_line_items` gains `external_id` TEXT column (nullable, unique partial index where not null)
- [ ] **SCH-02**: `budget_line_items` gains `source` TEXT column (default `'csv'`)
- [ ] **SCH-03**: `loadEVFinances.js` sets `source: 'csv'` on all upserts
- [ ] **WH-01**: Supabase Edge Function at `/functions/v1/givebutter-webhook` accepts POST
- [ ] **WH-02**: Edge Function verifies GiveButter signature against raw request body
- [ ] **WH-03**: Edge Function writes `transaction.succeeded` events to `budget_line_items` with `external_id` and `source: 'givebutter_webhook'`
- [ ] **WH-04**: Edge Function is idempotent — upserts on `external_id` conflict (handles GiveButter retries)
- [ ] **WH-05**: GiveButter webhook registered in dashboard pointing to Edge Function URL
- [ ] **WH-06**: Validate amount unit (cents vs dollars) and signature header name with a real $1 test donation before go-live

### Phase 4 — Live Feedback UI

- [ ] **UI-04**: Page re-fetches revenue data when window regains focus after donate tab is closed (listener attached only after donate click, removed after first fire)
- [ ] **UI-05**: Incoming total animates (~1000ms counter) when new data loads on focus-return and total has changed
- [ ] **UI-06**: Brief acknowledgment shown after focus-return detects a higher total

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Patreon / Benevity real-time | Webhook story weaker; CSV import sufficient for those platforms |
| Websocket / Supabase Realtime subscriptions | Redirect-driven focus pattern is simpler and sufficient |
| Admin donation management UI | Different milestone |
| GiveButter return_url redirect | GiveButter does not support this natively |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | ✓ Complete |
| UI-02 | Phase 1 | ✓ Complete |
| UI-03 | Phase 1 | ✓ Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| SCH-01 | Phase 3 | Pending |
| SCH-02 | Phase 3 | Pending |
| SCH-03 | Phase 3 | Pending |
| WH-01 | Phase 3 | Pending |
| WH-02 | Phase 3 | Pending |
| WH-03 | Phase 3 | Pending |
| WH-04 | Phase 3 | Pending |
| WH-05 | Phase 3 | Pending |
| WH-06 | Phase 3 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |

**Coverage:** 17 requirements · 3 complete · 14 pending

---

*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 — Phase 1 shipped (donate button)*
