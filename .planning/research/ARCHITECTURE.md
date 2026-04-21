# Architecture: GiveButter Webhook → Supabase → Donation Display

**Domain:** Webhook-driven donation ingestion into existing React + Supabase app
**Researched:** 2026-04-20
**Overall confidence:** HIGH (core patterns verified against official docs)

---

## Overview

This document covers the architecture for wiring a real-time donation flow into the existing treasury tracker. The system is: GiveButter campaign → webhook POST → Supabase Edge Function → budget_line_items upsert → frontend re-fetch on load.

No websockets. No polling. No new frontend state library. The flow is deliberately simple.

---

## 1. Schema Changes Required

### 1a. New columns on `budget_line_items`

Two columns needed. Both are nullable so existing CSV-imported rows require no backfill.

```sql
ALTER TABLE treasury.budget_line_items
  ADD COLUMN IF NOT EXISTS source        TEXT    DEFAULT 'csv',
  ADD COLUMN IF NOT EXISTS external_id   TEXT;

-- Unique constraint for deduplication.
-- Scoped to (category_id, external_id) so the same GiveButter transaction
-- cannot appear twice under the same budget category.
CREATE UNIQUE INDEX IF NOT EXISTS budget_line_items_external_id_unique
  ON treasury.budget_line_items (category_id, external_id)
  WHERE external_id IS NOT NULL;
```

**Column semantics:**

| Column | Values | Purpose |
|--------|--------|---------|
| `source` | `'csv'` (default), `'givebutter_webhook'` | Lets the UI or queries distinguish origin; lets the CSV import script skip rows already written by webhook |
| `external_id` | GiveButter transaction `id` (e.g. `'459oGBTylHk8laDF'`) | Idempotency key — `ON CONFLICT DO NOTHING` on this column prevents duplicate writes from webhook retries |

**Why a partial unique index (WHERE external_id IS NOT NULL) instead of a full unique constraint:**
Existing CSV rows have `external_id = NULL`. PostgreSQL treats each NULL as distinct, so a plain unique constraint would not conflict across multiple NULL rows. The partial index correctly ignores NULL rows and only enforces uniqueness for actual webhook-sourced transactions. This is the standard Postgres pattern for nullable idempotency keys.

**Confidence:** HIGH — verified against PostgreSQL documentation and Supabase upsert docs.

---

### 1b. No changes to `budget_categories` or `budgets`

Webhook donations are appended as line items under a pre-existing "Give Butter" subcategory (already created by `loadEVFinances.js` for whatever fiscal year is active). The Edge Function must resolve the correct `category_id` at write time.

The budget hierarchy already handles GiveButter under: `Donations → Give Butter`. The Edge Function will look up the category by name within the current fiscal year's revenue budget.

---

## 2. Supabase Edge Function Structure

### 2a. File location

```
supabase/
  config.toml
  functions/
    givebutter-webhook/
      index.ts
```

The `supabase/` directory does not currently exist in this repo. It must be created.

### 2b. config.toml — disable JWT verification

Webhook endpoints cannot send Supabase JWTs. The function must be publicly reachable by GiveButter's servers.

```toml
[functions.givebutter-webhook]
verify_jwt = false
```

**Confidence:** HIGH — verified in Supabase official docs for function configuration.

### 2c. Edge Function: full handler structure

```typescript
// supabase/functions/givebutter-webhook/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // ── 1. Only accept POST ────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── 2. Read raw body as TEXT before any JSON parsing ───────────────────────
  //    HMAC verification requires the original bytes, not a re-serialized object
  const rawBody = await req.text();

  // ── 3. Verify GiveButter signature ─────────────────────────────────────────
  //    GiveButter sends a `Signature` header containing the signing secret.
  //    NOTE: GiveButter's verification model differs from Stripe.
  //    Their Signature header contains the plain signing secret itself
  //    (not an HMAC digest of the body). Verification = direct string compare.
  //    Source: help.givebutter.com/en/articles/8828428
  const incomingSignature = req.headers.get("Signature") ?? "";
  const signingSecret = Deno.env.get("GIVEBUTTER_SIGNING_SECRET") ?? "";

  if (!signingSecret || incomingSignature !== signingSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ── 4. Parse payload ───────────────────────────────────────────────────────
  let payload: { event: string; data: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  // ── 5. Only handle transaction.succeeded ──────────────────────────────────
  if (payload.event !== "transaction.succeeded") {
    // Acknowledge other event types without processing
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const tx = payload.data;
  const externalId = String(tx.id);             // e.g. "459oGBTylHk8laDF"
  const amountCents = Number(tx.amount ?? 0);   // GiveButter amount is in CENTS
  const amountDollars = amountCents / 100;
  const transactedAt = String(tx.transacted_at ?? tx.created_at ?? new Date().toISOString());
  const donorName = [tx.first_name, tx.last_name].filter(Boolean).join(" ") || "Anonymous";
  const fiscalYear = new Date(transactedAt).getFullYear();

  // ── 6. Supabase client with service role (bypasses RLS for server writes) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "treasury" } }
  );

  // ── 7. Resolve the target budget_category_id ──────────────────────────────
  //    Find the "Give Butter" subcategory under the revenue budget for this year
  const { data: category, error: catErr } = await supabase
    .from("budget_categories")
    .select("id, budget_id, budgets!inner(municipality_id, fiscal_year, dataset_type)")
    .eq("name", "Give Butter")
    .eq("budgets.fiscal_year", fiscalYear)
    .eq("budgets.dataset_type", "revenue")
    .maybeSingle();

  if (catErr || !category) {
    // No matching category found — could be first donation of a new fiscal year
    // Log and return 200 so GiveButter doesn't retry endlessly
    console.error("No Give Butter category for FY", fiscalYear, catErr?.message);
    return new Response(
      JSON.stringify({ ok: false, reason: "category_not_found", fiscalYear }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 8. Upsert line item — idempotent via (category_id, external_id) ───────
  const { error: upsertErr } = await supabase
    .from("budget_line_items")
    .upsert(
      {
        category_id:     category.id,
        description:     `GiveButter donation from ${donorName}`,
        approved_amount: amountDollars,
        actual_amount:   amountDollars,
        vendor:          "GiveButter",
        date:            transactedAt.slice(0, 10), // ISO date YYYY-MM-DD
        payment_method:  String(tx.payment_method ?? tx.method ?? ""),
        fund:            "GiveButter",
        expense_category: "Donations",
        source:          "givebutter_webhook",
        external_id:     externalId,
      },
      { onConflict: "category_id,external_id", ignoreDuplicates: true }
    );

  if (upsertErr) {
    console.error("Upsert failed:", upsertErr.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, externalId }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Key decisions documented in the code:**

| Decision | Rationale |
|----------|-----------|
| Raw body read before JSON.parse | Required for signature header comparison |
| Return 200 on unknown events | GiveButter retries on non-2xx; acknowledge everything |
| Return 200 on category_not_found | Prevents retry storm; log for alerting instead |
| `ignoreDuplicates: true` | Maps to `ON CONFLICT DO NOTHING` — webhook retries are silent no-ops |
| `service_role` key | Webhook write bypasses RLS; this is server-side, not browser |
| Amount in dollars | loadEVFinances.js stores dollars; GiveButter sends cents |

**Confidence:** HIGH for structure; MEDIUM for the GiveButter signature header semantics.

---

### 2d. GiveButter signature verification: what is actually known

GiveButter's official documentation (help.givebutter.com) states:

- A "signing secret" is generated per webhook and shown in the dashboard
- Incoming requests include a `Signature` header
- Verification = check that the header value matches your signing secret

**This is NOT HMAC-SHA256 of the body.** GiveButter's model (as documented) is a shared-secret header comparison, not a body digest. This is simpler but less robust against replay attacks.

One third-party integration guide references a header named `givebutter-signature` (lowercase, hyphenated). The official GiveButter help article names it `Signature` (capitalized). HTTP headers are case-insensitive, but the Edge Function should check both if this is uncertain at implementation time.

**Action item for implementation phase:** Log `req.headers` on the first real webhook delivery in a test environment to confirm the exact header name before hardening the verification.

---

## 3. Donate Button: Linking to GiveButter

### 3a. What URL parameters GiveButter supports

GiveButter supports these URL query parameters for pre-populating checkout:

| Parameter | Effect |
|-----------|--------|
| `amount` | Pre-selects donation amount |
| `frequency` | `monthly`, `quarterly`, `yearly` |
| `fund` | Numeric fund ID |
| `promo` | Promo code |

**There is no `return_url` URL parameter.** GiveButter does not support a post-donation redirect via URL parameter on the campaign page. Verified through official help center docs.

**Confidence:** HIGH — confirmed absence via official URL parameter documentation.

### 3b. Two valid approaches for the donate button

**Option A: External link (simplest, recommended for Phase 1)**

The donate button links directly to the GiveButter campaign page:

```tsx
<a
  href="https://givebutter.com/[campaign-code]"
  target="_blank"
  rel="noopener noreferrer"
  className="..."
>
  Donate
</a>
```

After donating, the user returns to the financials page manually or via the browser back button. The page re-fetches data on load (see Section 4). The webhook fires in the background and the data is live within seconds of the user returning.

**Tradeoff:** User doesn't automatically land back on the financials page. No confirmation experience on our page. Acceptable for Phase 1.

**Option B: GiveButter Elements widget (embedded, more complex)**

GiveButter provides embeddable widgets that allow donations without leaving the page. The JavaScript API exposes a `donation.complete` client-side event:

```javascript
window.Givebutter("addEventListener", window.Givebutter.EVENT.DONATION.COMPLETE, (donationObj) => {
  // User just donated — trigger a data re-fetch here
  refetchData();
});
```

The `sessionId` field on the `donationObj` can be used to verify the transaction is real (cross-reference with GiveButter API). The GiveButter documentation explicitly warns that this client-side event "could be faked by a malicious user."

**Tradeoff:** More complex to embed; requires adding the GiveButter loader script to the page; the `donation.complete` event fires in the browser, not the server — so data refresh can happen immediately without waiting for the webhook to process. However, the source of truth is still the webhook, not this event.

**Recommendation:** Start with Option A (external link). Upgrade to Option B in a later iteration if the user experience of returning to the page and seeing the new total is not sufficient.

---

## 4. Frontend: What Changes Are Needed

### The good news: almost nothing

The existing frontend already fetches data on mount. The EV financials page loads budget data via Supabase queries at component mount time. When a user navigates back to the page (or reloads), the query runs again and picks up the new line item.

**No websockets, no polling, no subscription needed.** The webhook writes the data within seconds of the donation. The user returns to the page (typically 30–60 seconds later). The next fetch includes the new total.

### The one thing that might need checking

The budget totals displayed on the financials page are likely computed from the `budget_categories.amount` column (aggregated at load time from the CSV import). If the frontend reads the pre-aggregated `amount` column from the category rather than summing `budget_line_items.actual_amount` at query time, then inserting a new line item will not change the displayed total until the CSV is re-run.

**Resolution path:** Verify whether the frontend uses the `budget_categories.amount` column or computes totals from line items. If it uses the stored column, the Edge Function must also update that column after upsert. If it computes from line items, no additional work is needed.

This is the most likely hidden complexity in the implementation.

**Confidence:** MEDIUM — architecture is clear but depends on how the existing query aggregates data.

---

## 5. GiveButter Webhook Transaction Payload Reference

Confirmed from official GiveButter documentation. The `transaction.succeeded` event sends:

```json
{
  "event": "transaction.succeeded",
  "data": {
    "id": "459oGBTylHk8laDF",
    "campaign_id": 39,
    "campaign_code": "ABCDEF",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "status": "succeeded",
    "payment_method": "card",
    "method": "card",
    "amount": 250,
    "donated": 250,
    "currency": "USD",
    "transacted_at": "2024-02-01T12:15:20+00:00",
    "created_at": "2024-02-01T12:15:20+00:00",
    "session_id": "945c8292-0b32-45ba-a4c4-9866fc15af07",
    "custom_fields": [],
    "external_id": null
  }
}
```

**Amount unit: cents (integer).** `250` = $2.50. Must divide by 100 before storing in `actual_amount` (which holds dollars based on the CSV import pattern in loadEVFinances.js).

**The `id` field is the GiveButter transaction ID.** This becomes `budget_line_items.external_id`.

---

## 6. Build Order (Phase Dependencies)

Phases must be built in this order because each layer depends on the previous:

```
Phase 1: Schema migration
   ↓ (Edge Function references external_id column)
Phase 2: Supabase Edge Function
   ↓ (Donate button needs the deployed webhook URL for testing)
Phase 3: Donate button UI
   ↓ (Frontend aggregation question must be resolved)
Phase 4: Frontend aggregation fix (conditional)
```

### Phase 1: Schema Migration

**Deliverable:** Migration SQL applied to Supabase project.
**Contains:**
- `ALTER TABLE treasury.budget_line_items ADD COLUMN source TEXT DEFAULT 'csv'`
- `ALTER TABLE treasury.budget_line_items ADD COLUMN external_id TEXT`
- `CREATE UNIQUE INDEX budget_line_items_external_id_unique ON treasury.budget_line_items (category_id, external_id) WHERE external_id IS NOT NULL`

**Dependency:** None. Safe to run immediately.
**Risk:** None — additive only, existing rows unaffected.

### Phase 2: Edge Function

**Deliverable:** `supabase/functions/givebutter-webhook/index.ts` deployed and registered in GiveButter dashboard.
**Contains:**
- `supabase init` (creates supabase/ directory and config.toml)
- Edge Function TypeScript code
- `supabase secrets set GIVEBUTTER_SIGNING_SECRET=...`
- `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`
- Deploy: `supabase functions deploy givebutter-webhook`
- Register webhook URL in GiveButter dashboard → subscribe to `transaction.succeeded`

**Dependency:** Phase 1 (schema columns must exist before upsert runs).
**Risk flag:** Verify GiveButter `Signature` header name with a test webhook delivery before go-live.

### Phase 3: Donate Button UI

**Deliverable:** Donate button component on the EV financials page linking to GiveButter.
**Contains:**
- Button or link component with GiveButter campaign URL
- No URL params needed for Phase 1 (external link approach)

**Dependency:** Phase 2 should be live so end-to-end can be tested.
**Risk:** None. This is UI-only.

### Phase 4: Frontend Aggregation Fix (investigate first)

**Deliverable:** Ensure displayed totals reflect newly inserted line items.
**Contains:**
- Audit of how financials page computes totals
- If totals come from `budget_categories.amount`: add category total update logic to the Edge Function
- If totals come from summing `budget_line_items.actual_amount`: no code change needed

**Dependency:** Phase 2 (need to understand what the Edge Function writes).
**Risk:** This is the most likely source of surprise work. Do not skip the audit.

---

## 7. Component Boundaries

| Component | Location | Responsibility |
|-----------|----------|---------------|
| GiveButter campaign page | givebutter.com | Donation checkout, payment processing, webhook dispatch |
| `givebutter-webhook` Edge Function | Supabase | Signature verify, parse, upsert to `budget_line_items` |
| `budget_line_items` table | Supabase Postgres (treasury schema) | Source of truth for individual transactions |
| `budget_categories` table | Supabase Postgres | May need amount updated (see Phase 4 flag) |
| EV Financials page | React frontend | Fetch on mount, display totals — no changes needed if aggregation is live |
| Donate button | React frontend | Link/button to GiveButter campaign URL |

---

## 8. Anti-Patterns to Avoid

### Don't write to `budget_categories.amount` without reading current state

If the Edge Function needs to update the category total, it must do so atomically:

```sql
-- Correct: increment by the new line item amount
UPDATE treasury.budget_categories
SET amount = amount + $new_amount
WHERE id = $category_id;
```

Never: read amount, add in application code, write back. Race condition.

### Don't store GiveButter amount as-is

GiveButter sends `"amount": 250` for a $2.50 donation. The rest of the system stores dollars. Divide by 100 in the Edge Function before insert.

### Don't return 5xx for events you don't handle

GiveButter retries on non-2xx responses. Always return 200 for unknown event types. Only return 5xx for genuine infrastructure failures (Supabase down, etc.).

### Don't use the client-side `donation.complete` event as the write trigger

The `donation.complete` JavaScript event fires in the browser and is unverifiable. The webhook is the authoritative source of truth. The client-side event is useful only for triggering an immediate UI re-fetch (user experience enhancement), not for writing data.

---

## 9. Secrets Required

Three secrets must be set in the Supabase project before the Edge Function is deployed:

| Secret name | Value source |
|-------------|-------------|
| `GIVEBUTTER_SIGNING_SECRET` | GiveButter dashboard → Webhooks → eye icon |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API → service_role key |
| (auto-provided) `SUPABASE_URL` | Available in Edge Function environment by default |

Set via CLI:

```bash
supabase secrets set GIVEBUTTER_SIGNING_SECRET=your_secret_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## 10. Architecture Diagram (Text)

```
[User on financials page]
       │
       │ clicks Donate button
       ▼
[givebutter.com campaign page]
       │
       │ user completes payment
       ▼
[GiveButter backend]
       │
       ├──► POST /functions/v1/givebutter-webhook  (webhook, async)
       │         │
       │         │ Signature header verify
       │         │ Parse JSON body
       │         │ Resolve category_id for FY + "Give Butter"
       │         │ UPSERT budget_line_items ON CONFLICT DO NOTHING
       │         ▼
       │    [Supabase Postgres — treasury schema]
       │
       └──► User navigates back to financials page (manual or back button)
                 │
                 │ page load → fetch budget data
                 ▼
           [Supabase Postgres — treasury schema]
                 │
                 │ returns line items including new donation
                 ▼
           [EV Financials page displays updated total]
```

---

## Sources

- GiveButter webhook documentation: https://help.givebutter.com/en/articles/8828428-how-to-automate-workflows-and-data-using-webhooks (MEDIUM — help center article, not API reference)
- GiveButter URL parameters: https://help.givebutter.com/en/articles/4868782-how-to-leverage-url-and-html-parameters (HIGH — confirms no return_url exists)
- GiveButter donation.complete event: https://docs.givebutter.com/docs/elements-donation-events (MEDIUM — confirmed via search result excerpt; page returned 404 on direct fetch)
- Supabase Edge Function configuration: https://supabase.com/docs/guides/functions/function-configuration (HIGH — official docs, verify_jwt = false pattern)
- Supabase Edge Function quickstart: https://supabase.com/docs/guides/functions/quickstart (HIGH — Deno.serve structure confirmed)
- Supabase upsert with onConflict: https://supabase.com/docs/reference/javascript/upsert (HIGH — official API reference)
- PostgreSQL partial unique index on nullable column: standard Postgres behavior, HIGH confidence
