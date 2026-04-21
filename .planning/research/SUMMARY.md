# Research Summary: GiveButter Real-Time Donation Feedback

**Project:** Treasury Tracker
**Domain:** Webhook-driven donation ingestion + post-donation UX
**Researched:** 2026-04-20
**Confidence:** HIGH

---

## Critical Constraints

**1. GiveButter does NOT support a native return_url after donation.**
Confirmed HIGH confidence. The four supported URL params are amount, frequency, fund, and promo. There is no return_url. The return flow must use window focus detection (visibilitychange/focus event) on our side.

**2. GiveButter signature verification is shared-secret header comparison, not HMAC-SHA256.**
The Signature header contains the signing secret itself -- compare directly against GIVEBUTTER_SIGNING_SECRET. Raw body must be read as text before JSON parsing. Verify exact header name on first real test delivery.

**3. budget_line_items needs two new columns for deduplication.**
source (TEXT default csv) and external_id (TEXT nullable). Partial unique index on (category_id, external_id) WHERE external_id IS NOT NULL blocks duplicate webhook writes.

**4. Amount unit conflict: cents vs dollars.**
ARCHITECTURE.md says cents (divide by 100). STACK.md says dollars. Validate with a real $1.00 test donation before go-live. Assume cents until confirmed.

**5. Frontend totals may be pre-aggregated.**
If revenueData reads budget_categories.amount instead of summing line items, a new line item will not update the display. Audit loadBudgetData before Phase 4. If pre-aggregated, Edge Function must also UPDATE budget_categories SET amount = amount + new_amount atomically.

---

## Stack Additions

| Addition | Purpose | Notes |
|----------|---------|-------|
| supabase/functions/givebutter-webhook/index.ts | Receive POST verify signature upsert to DB | New Edge Function; supabase/ dir does not exist yet |
| supabase/config.toml verify_jwt=false | Allow public webhook endpoint | Required; GiveButter has no Supabase JWT |
| GIVEBUTTER_SIGNING_SECRET secret | Signature verification | supabase secrets set |
| SUPABASE_SERVICE_ROLE_KEY secret | Bypass RLS for server-side write | Do not use anon key |
| visibilitychange/focus listener | Trigger re-fetch when donor returns | Attach after donate click; remove after first fire |
| CountUp.js or rAF | Animated counter roll-up | Only fires when ?donated=true param detected |

No new npm packages for Edge Function (Deno Web Crypto built-in). No new frontend packages (supabase-js installed).

---

## Build Order

**Phase 1: Schema migration**
ALTER TABLE treasury.budget_line_items ADD source TEXT DEFAULT csv, ADD external_id TEXT. CREATE UNIQUE INDEX ... WHERE external_id IS NOT NULL. Zero risk -- additive only. Must run before Phase 2.

**Phase 2: Edge Function + webhook registration**
Create supabase/ dir, write index.ts, set secrets, deploy --no-verify-jwt. Register URL in GiveButter for transaction.succeeded. Verify Signature header name with test delivery before hardening.

**Phase 3: Donate button UI**
Secondary-weight button (EV teal border, white fill) in QuickFactsRow linking to GiveButter campaign URL in new tab. Attach focus listener to trigger re-fetch. No URL params needed.

**Phase 4: Aggregation audit + animated feedback**
Audit whether revenueData sums line items or reads budget_categories.amount. Fix if pre-aggregated. Detect ?donated=true on mount, run CountUp (1000ms ease-out), show thank-you banner, CSS pulse on InsightCard (#F5C842 2s fade). Clear param via history.replaceState.

---

## Key Pitfalls

**1. Read raw body before parsing.**
Call req.text() first. Use it for signature check. Then JSON.parse(rawBody). Never verify against a re-serialized object -- key ordering may differ.

**2. Always return HTTP 200 for events you do not handle.**
GiveButter retries on non-2xx. Return {received:true} 200 for unknown events and for category_not_found. Only 5xx for genuine infra failures. Non-compliance causes retry storms and duplicate rows.

**3. Window focus fires on every tab switch.**
Gate the listener: attach only after donate button click, remove after first re-fetch. Or debounce 300ms. Without this every tab switch triggers a Supabase query.

---

## Open Questions

| Question | Impact | Resolution |
|----------|--------|------------|
| Frontend sums line items or reads budget_categories.amount? | HIGH | Audit loadBudgetData before Phase 4 |
| Signature header named Signature or givebutter-signature? | MEDIUM | Log req.headers on first test delivery; check both until confirmed |
| GiveButter amount in cents or dollars? | HIGH | Validate with real $1.00 donation before go-live |
| EV GiveButter campaign code/URL? | LOW | Retrieve from GiveButter dashboard |
| Give Butter subcategory exists for current fiscal year? | MEDIUM | Verify in DB or run loadEVFinances.js before testing |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Edge Function pattern well-documented; no-verify-jwt confirmed |
| Features | HIGH | URL param absence confirmed; UX pattern is clear |
| Architecture | HIGH structure / MEDIUM details | Build order correct; amount unit and header name need live-test validation |
| Pitfalls | HIGH | Dedup and retry patterns standard; focus-listener behavior deterministic |

**Overall:** HIGH for structure and build order. Two MEDIUM details (amount unit, header name) must be validated with a real test webhook. Neither blocks Phases 1-3.

---

## Sources

### Primary (HIGH confidence)
- GiveButter URL parameters: https://help.givebutter.com/en/articles/4868782-how-to-leverage-url-and-html-parameters
- GiveButter webhook events: https://help.givebutter.com/en/articles/8828428-how-to-automate-workflows-and-data-using-webhooks
- GiveButter campaign page config: https://help.givebutter.com/en/articles/3688273-how-to-configure-a-page-campaign
- Supabase Edge Function config: https://supabase.com/docs/guides/functions/function-configuration
- Supabase upsert: https://supabase.com/docs/reference/javascript/upsert

### Secondary (MEDIUM confidence)
- Rollout GiveButter guide: references givebutter-signature header (conflicts with official docs)
- GiveButter Elements donation.complete: confirmed via search excerpt; direct URL 404

### Tertiary (LOW / needs validation)
- Webflow+GiveButter integration: states amount in cents (conflicts with help center sample showing dollars)

---

*Research completed: 2026-04-20*
*Ready for roadmap: yes*