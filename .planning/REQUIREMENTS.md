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

- [x] **DATA-01**: Confirmed — frontend reads pre-aggregated `budget_categories.amount` directly; no runtime aggregation. See `.planning/phases/02-data-layer-audit/02-01-SUMMARY.md`.
- [x] **DATA-02**: Strategy defined — Edge Function calls Postgres RPC `treasury.record_givebutter_donation` that atomically updates 3 rows. See `.planning/phases/02-data-layer-audit/02-01-SUMMARY.md`.

### Phase 3 — Webhook Backend

- [x] **SCH-01**: `budget_line_items` gains `external_id` TEXT column (nullable, unique partial index where not null)
- [x] **SCH-02**: `budget_line_items` gains `source` TEXT column (default `'csv'`)
- [x] **SCH-03**: `loadEVFinances.js` sets `source: 'csv'` on all upserts
- [x] **WH-01**: Supabase Edge Function at `/functions/v1/givebutter-webhook` accepts POST
- [x] **WH-02**: Edge Function verifies GiveButter signature against raw request body
- [x] **WH-03**: Edge Function writes `transaction.succeeded` events to `budget_line_items` with `external_id` and `source: 'givebutter_webhook'`
- [x] **WH-04**: Edge Function is idempotent — upserts on `external_id` conflict (handles GiveButter retries)
- [x] **WH-05**: GiveButter webhook registered in dashboard pointing to Edge Function URL
- [x] **WH-06**: Validate amount unit (cents vs dollars) and signature header name with a real $1 test donation before go-live

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
| DATA-01 | Phase 2 | ✓ Complete |
| DATA-02 | Phase 2 | ✓ Complete |
| SCH-01 | Phase 3 | Complete |
| SCH-02 | Phase 3 | Complete |
| SCH-03 | Phase 3 | Complete |
| WH-01 | Phase 3 | Complete |
| WH-02 | Phase 3 | Complete |
| WH-03 | Phase 3 | Complete |
| WH-04 | Phase 3 | Complete |
| WH-05 | Phase 3 | Complete |
| WH-06 | Phase 3 | Complete |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |

**Coverage:** 17 requirements · 14 complete · 3 pending

---

*Requirements defined: 2026-04-21*
*Last updated: 2026-04-22 — Phase 3 complete (SCH-01–03, WH-01–06 all confirmed via $1 live test)*
