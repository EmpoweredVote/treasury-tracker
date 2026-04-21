# Technology Stack: GiveButter Webhook Integration

**Project:** Treasury Tracker — Real-time Donation Feedback Milestone
**Researched:** 2026-04-20
**Scope:** GiveButter webhook receiver via Supabase Edge Function + DB write

---

## Recommended Stack

### Webhook Receiver

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Edge Function | Current (Deno 1.x) | Receive GiveButter POST webhooks | Already in stack; --no-verify-jwt for public endpoints; Web Crypto API built-in for HMAC |
| Deno Web Crypto API | Built-in | HMAC-SHA256 signature verification | No external dep; SubtleCrypto is native to Deno runtime |
| supabase-js | npm:@supabase/supabase-js@2 | Write transaction to Postgres | Standard import pattern for Edge Functions |

### Database Write

| Technology | Purpose | Notes |
|------------|---------|-------|
| SUPABASE_SERVICE_ROLE_KEY | Bypass RLS for webhook writes | Webhook is a trusted server process; service_role skips all RLS policies |
| budget_line_items table | Persist donation as a transaction row | Existing table; see field mapping below |

---

## GiveButter Webhook: Complete Technical Reference

### Webhook Event for Donation Completion

**Event name:** `transaction.succeeded`

This is the only event needed. It fires on real-time completed donations. It does NOT fire during CSV imports.

Other events exist but are not in scope: `campaign.created/updated`, `ticket.created`, `contact.created`, `plan.*`, `refund.created`.

### Payload Envelope Structure

```json
{
  "event": "transaction.succeeded",
  "data": {
    "id": "459oGBTylHk8laDF",
    "campaign_id": 39,
    "campaign_code": "ABCDEF",
    "plan_id": null,
    "team_id": null,
    "member_id": null,
    "fund_id": null,
    "fund_code": null,
    "first_name": "John",
    "last_name": "Doe",
    "company": null,
    "email": "john@example.com",
    "phone": "+12674325019",
    "address": {
      "address_1": "N 15th Ave",
      "address_2": "123",
      "city": "Melrose Park",
      "state": "IL",
      "country": "USA",
      "zipcode": "60160"
    },
    "status": "succeeded",
    "payment_method": "card",
    "method": "card",
    "amount": 250,
    "fee": 7.78,
    "fee_covered": 7.78,
    "donated": 250,
    "payout": 250,
    "currency": "USD",
    "transacted_at": "2024-02-01T12:15:20+00:00",
    "created_at": "2024-02-01T12:15:20+00:00",
    "giving_space": {
      "id": 15,
      "name": "John Doe",
      "amount": 250,
      "message": null
    },
    "dedication": null
  }
}
```

**Amount field:** `data.amount` is in **dollars** (not cents). `250` = $250.00 USD.
Confidence: MEDIUM — the official help article and a sample payload from search results both show dollar values, but Webflow integration guide says "cents." Treat as dollars; validate with a test webhook during implementation.

### Fields to Map into budget_line_items

| budget_line_items column | GiveButter payload field | Notes |
|--------------------------|--------------------------|-------|
| `actual_amount` | `data.amount` | Dollar value |
| `description` | `"Donation from {first_name} {last_name}"` | Constructed |
| `vendor` | `data.first_name + " " + data.last_name` | Donor name as vendor |
| `date` | `data.transacted_at` | ISO 8601 timestamp |
| `payment_method` | `data.payment_method` | "card", "bank", etc. |
| `fund` | `data.fund_code` | May be null |
| `category_id` | Hard-coded or config value | No direct mapping; use a "Donations" category |
| `approved_amount` | `data.amount` | Same as actual for donations |
| `expense_category` | `"donation"` | Constant |

### Webhook Authentication: Signature Verification

**Method:** HMAC-SHA256

**Header name:** `Signature` (official GiveButter docs)
Note: Some third-party integration guides use `givebutter-signature`. The official help center article specifies `Signature`. Implement a check of both during development; the actual header will be visible in the first test delivery.

**Algorithm:**
1. Read raw request body as text (do NOT parse JSON first — HMAC is over the raw bytes)
2. Compute: `HMAC-SHA256(raw_body, webhook_signing_secret)`
3. Compare hex digest to the `Signature` header value
4. Reject with 401 if mismatch

**Signing secret location:** GiveButter dashboard → Settings → Developers → Webhooks → click eye icon next to the webhook

**Verification is optional per GiveButter docs, but implement it.** A public Edge Function URL without verification is a trivial injection vector.

### Edge Function Boilerplate

```typescript
// supabase/functions/givebutter-webhook/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 1. Read raw body — must be text, not parsed JSON, for HMAC verification
  const rawBody = await req.text();
  const signature = req.headers.get("Signature") ?? req.headers.get("givebutter-signature");

  // 2. Verify HMAC-SHA256 signature
  const secret = Deno.env.get("GIVEBUTTER_WEBHOOK_SECRET")!;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature !== expectedSignature) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 3. Parse event
  const payload = JSON.parse(rawBody);
  if (payload.event !== "transaction.succeeded") {
    // Acknowledge non-target events without processing
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data } = payload;

  // 4. Write to Supabase — use service_role to bypass RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("budget_line_items").insert({
    description: `Donation from ${data.first_name} ${data.last_name}`,
    actual_amount: data.amount,
    approved_amount: data.amount,
    vendor: `${data.first_name} ${data.last_name}`,
    date: data.transacted_at,
    payment_method: data.payment_method,
    fund: data.fund_code ?? null,
    expense_category: "donation",
    // category_id: set to your "Donations" category UUID
  });

  if (error) {
    console.error("DB insert error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Deployment

```bash
# Set secrets (do not commit these)
supabase secrets set GIVEBUTTER_WEBHOOK_SECRET=your_secret_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Deploy without JWT requirement — webhook caller has no Supabase JWT
supabase functions deploy givebutter-webhook --no-verify-jwt
```

**Endpoint URL after deploy:**
`https://<project-ref>.supabase.co/functions/v1/givebutter-webhook`

Register this URL in: GiveButter Dashboard → Settings → Developers → Webhooks → New Webhook → select `transaction.succeeded`.

---

## GiveButter Return URL / Post-Donation Redirect

**Finding: GiveButter does NOT support a configurable redirect URL after donation.** Confidence: HIGH.

Verified across:
- Campaign Page settings (no redirect field)
- Campaign Form settings (no redirect field)
- URL parameter documentation (only: amount, frequency, fund, promo)
- Widget HTML attribute documentation (no redirect/callback attribute)

**What GiveButter does support post-donation:**
- Custom thank-you message in email receipt (per-campaign)
- Donor remains on the GiveButter campaign page after donating

**Implication for roadmap:** The user-sees-updated-total flow cannot rely on a redirect from GiveButter. Two alternative approaches:

| Approach | How It Works | Tradeoff |
|----------|--------------|----------|
| Polled refresh | financials.empowered.vote polls Supabase every N seconds | Simple; slight delay; always-on polling is wasteful |
| Supabase Realtime | Subscribe to INSERT events on budget_line_items from the frontend | Elegant; real-time; adds a frontend subscription to maintain |
| Manual navigation | Donor manually returns to the site after donating | No code; worst UX |

**Recommendation:** Supabase Realtime subscription on `budget_line_items`. The frontend already uses supabase-js; adding `supabase.channel().on('postgres_changes', ...)` is minimal code and delivers true real-time without polling.

---

## Supporting Libraries

| Library | Import | Purpose | Notes |
|---------|--------|---------|-------|
| @supabase/supabase-js@2 | `npm:@supabase/supabase-js@2` | DB writes from Edge Function | Standard Deno npm: import |
| Deno Web Crypto | Built-in | HMAC-SHA256 signature check | No install needed |
| @supabase/supabase-js (frontend) | Already installed | Realtime subscription for live update | Already in stack |

No new npm packages needed for the Edge Function. No new frontend packages needed for Realtime.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Webhook receiver | Supabase Edge Function | Separate Express/Node server | Already in stack; no new infra |
| HMAC library | Deno Web Crypto (built-in) | `https://deno.land/x/hmac` | No external dep needed; SubtleCrypto is stable |
| DB auth | SUPABASE_SERVICE_ROLE_KEY | anon key | anon key subject to RLS; webhook is a trusted server process |
| Real-time update | Supabase Realtime | Polling | Realtime is already a Supabase feature; polling wastes resources |

---

## Sources

- [GiveButter Webhooks Help Center](https://help.givebutter.com/en/articles/8828428-how-to-automate-workflows-and-data-using-webhooks) — event names, payload envelope, Signature header, signing secret
- [GiveButter Transaction Object API Docs](https://docs.givebutter.com/reference/transactions) — transaction schema (partial access)
- [GiveButter URL Parameters](https://help.givebutter.com/en/articles/4868782-how-to-leverage-url-and-html-parameters) — confirmed no redirect_url param (HIGH confidence)
- [GiveButter Page Campaign Config](https://help.givebutter.com/en/articles/3688273-how-to-configure-a-page-campaign) — confirmed no redirect setting (HIGH confidence)
- [GiveButter Form Campaign Config](https://help.givebutter.com/en/articles/3519623-how-to-configure-a-form-campaign) — confirmed no redirect setting (HIGH confidence)
- [Supabase Edge Functions Quickstart](https://supabase.com/docs/guides/functions/quickstart) — --no-verify-jwt pattern, deploy commands
- [Supabase Edge Functions Connect to Postgres](https://supabase.com/docs/guides/functions/connect-to-postgres) — createClient import pattern
- [Supabase Stripe Webhook Example](https://supabase.com/docs/guides/functions/examples/stripe-webhooks) — raw body requirement, Web Crypto pattern
- [Rollout GiveButter Webhook Guide](https://rollout.com/integration-guides/givebutter/quick-guide-to-implementing-webhooks-in-givebutter) — givebutter-signature header example code
- [Webflow + GiveButter Integration](https://webflow.com/integrations/givebutter) — corroborating event list and payload shape
