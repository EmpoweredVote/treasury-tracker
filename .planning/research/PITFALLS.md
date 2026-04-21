# Pitfalls Research: Webhook Reliability & Deduplication

## Pitfall 1: Webhook fires AFTER user closes GiveButter tab

**Risk:** Medium. GiveButter processes payment, fires webhook, THEN shows confirmation page. User may close GiveButter quickly before webhook is processed.

**Reality check:** Webhook fires server-side immediately after transaction confirmation — before GiveButter even renders its own success screen. By the time user reads the confirmation and closes the tab (5–30 seconds), the Edge Function has long since written to DB.

**Prevention:** No special handling needed. The timing gap is naturally sufficient. If paranoid, add a 500ms delay before re-fetching on window focus.

**Phase:** Phase 1 (architecture decision)

---

## Pitfall 2: Duplicate webhook deliveries (GiveButter retries)

**Risk:** High if not handled. GiveButter retries webhooks on non-200 responses (up to 3x). If Edge Function errors partway through, a retry could create a duplicate transaction.

**Prevention:** Upsert with `onConflict: 'external_id'` — idempotent. Always return 200 after signature verification, even if the DB write fails (log the error, don't retry).

**Phase:** Phase 1 (Edge Function design)

---

## Pitfall 3: CSV re-import double-counts webhook transactions

**Risk:** High without `external_id`. If a monthly CSV export includes a transaction already written by the webhook, a naive upsert would create a duplicate.

**Prevention:** 
- `source` column distinguishes webhook vs CSV rows
- Webhook transactions have `external_id` = GiveButter transaction ID
- CSV import leaves `external_id` NULL
- Unique index on `external_id WHERE NOT NULL` prevents webhook duplicates
- CSV import should check for existing `external_id` match before inserting — OR simply accept that CSV rows and webhook rows co-exist for the same transaction (and deduplicate at query time by `external_id`)

**Best approach:** Before upserting a CSV row, if the row matches a known GiveButter transaction ID (stored in Notes/Description field of CSV), skip it. Otherwise, the simplest fix: update `loadEVFinances.js` to check for existing `external_id` match.

**Phase:** Phase 1 (schema) + Phase 2 (loadEVFinances.js update)

---

## Pitfall 4: Supabase Edge Function cold start latency

**Risk:** Low. First invocation after inactivity may take 300–800ms. Subsequent calls are fast.

**Reality:** Webhook is processed server-side — user never waits on it. The window focus re-fetch adds one more Supabase query (already used in app), not another Edge Function call.

**Prevention:** No action needed. Cold start only affects the webhook processing speed, not user-perceived latency.

**Phase:** Not applicable

---

## Pitfall 5: Window focus fires too eagerly

**Risk:** Medium UX issue. `window focus` fires whenever user switches back from ANY tab — not just after donating. Every tab switch would trigger a re-fetch.

**Prevention:** 
- Re-fetch is cheap (already done on mount) — acceptable to re-fetch on every focus
- Or: only attach the focus listener after donate button is clicked, remove after first fire
- Or: debounce the re-fetch (300ms minimum between fetches)

**Phase:** Phase 2 (frontend implementation)

---

## Pitfall 6: HMAC verification rejects valid webhooks

**Risk:** Medium. Common mistake: verifying HMAC against parsed JSON instead of raw request body. JSON parsing reorders keys, breaking the signature.

**Prevention:** Always read `req.text()` FIRST before parsing. Store raw body string for HMAC, then `JSON.parse()` for data extraction. Never verify against `JSON.stringify(JSON.parse(body))`.

**Phase:** Phase 1 (Edge Function implementation)
