# Phase 3: Webhook Backend - Research

**Researched:** 2026-04-21
**Domain:** GiveButter webhooks + Supabase Edge Functions + PL/pgSQL
**Confidence:** MEDIUM — GiveButter's official webhook docs are sparse and inaccessible via automated fetch; key findings from the help center article + cross-referenced third-party sources

---

## Summary

Phase 3 builds the GiveButter → Supabase Edge Function → Postgres RPC pipeline. Four distinct technical domains required research: (1) GiveButter webhook payload shape and security, (2) Supabase Edge Function patterns for webhook receivers, (3) PL/pgSQL function design for the atomic 3-row update, and (4) the exact `loadEVFinances.js` changes needed.

The GiveButter webhook security model has one significant ambiguity that must be resolved at go-live: their help center article states "verify the Signature header contains the same value as your dashboard secret" — which reads as a raw string comparison rather than a computed HMAC. Third-party sources apply HMAC-SHA256 on top of this, but that may be incorrect for GiveButter specifically. The plan must implement the simpler comparison first and the $1 test donation serves as the verification point.

The Supabase Edge Function patterns are well-established. The critical constraints are: read raw body as `req.text()` before any JSON parsing, deploy with `--no-verify-jwt`, use `SUPABASE_SERVICE_ROLE_KEY` (not anon key) so the function can bypass RLS and write to the `treasury` schema, and pass the schema name in `createClient` options.

**Primary recommendation:** Build the Edge Function to compare the `Signature` header directly against the stored signing secret (string comparison). Wrap the comparison in `timingSafeEqual` regardless. The $1 test will confirm whether this is correct or whether HMAC-SHA256 is required.

---

## Standard Stack

### Core

| Component | Version/Tool | Purpose | Why Standard |
|-----------|-------------|---------|--------------|
| Supabase Edge Function | Deno runtime | Webhook HTTP receiver | Already in stack; deployed via Supabase CLI |
| `@supabase/supabase-js` | v2 (npm or jsr) | Supabase client inside Edge Function | Official client; handles schema routing |
| Deno `crypto.subtle` | Built-in | HMAC or timing-safe comparison | No external dependency; Deno Web Crypto API |
| PL/pgSQL | Postgres native | Atomic 3-row update function | Only way to guarantee atomicity in Supabase JS client |
| Supabase SQL editor | Dashboard tool | Schema migration delivery | Locked decision; avoids GORM risk |

### Supporting

| Component | Version/Tool | Purpose | When to Use |
|-----------|-------------|---------|-------------|
| `supabase` CLI | Latest | Deploy edge functions, set secrets | All deployment steps |
| `Deno.env.get()` | Built-in | Read secrets in Edge Function | Retrieve `GIVEBUTTER_SIGNING_SECRET` |
| `TextEncoder` | Web API built-in | Encode strings for crypto operations | Signature verification |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deno `crypto.subtle` | `https://esm.sh/standardwebhooks@1.0.0` | StandardWebhooks library handles format complexity — only worthwhile if GiveButter uses the Standard Webhooks spec (no evidence it does) |
| Supabase service role | Anon key | Anon key would hit RLS and fail to write to treasury schema; service role required |

**Installation (Edge Function — no npm install; use import map or esm.sh):**
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
// or
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
```

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/
└── functions/
    └── givebutter-webhook/
        └── index.ts        # Edge Function entry point
```

Edge Functions live in `supabase/functions/`. If no `supabase/` directory exists yet, `supabase functions new givebutter-webhook` creates it.

### Pattern 1: Edge Function Webhook Receiver

**What:** Deno HTTP handler that validates GiveButter signature, parses event type, calls Postgres RPC, returns appropriate status.

**When to use:** All webhook receipt. This is the only entry point.

**Example:**
```typescript
// Source: Supabase official Stripe webhook example (adapted)
// https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/stripe-webhooks

import { createClient } from 'npm:@supabase/supabase-js@2'

const SIGNING_SECRET = Deno.env.get('GIVEBUTTER_SIGNING_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: 'treasury' },
})

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // CRITICAL: read raw body BEFORE any JSON parsing
  const rawBody = await req.text()

  // Signature verification (see Open Questions for algorithm uncertainty)
  const receivedSig = req.headers.get('Signature') ?? ''
  if (!receivedSig || !timingSafeEqual(receivedSig, SIGNING_SECRET)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const event = payload as { type?: string; data?: Record<string, unknown> }

  // Discard unrecognized events silently
  if (event.type !== 'transaction.succeeded') {
    return new Response('OK', { status: 200 })
  }

  const tx = event.data ?? {}
  // ... extract fields, call RPC
  // On DB error → 500 (GiveButter retries)
  // On duplicate (idempotency no-op) → 200
})
```

### Pattern 2: Timing-Safe String Comparison (Deno)

**What:** Compare two strings in constant time to prevent timing attacks.

**When to use:** All signature comparisons, regardless of algorithm.

```typescript
// Source: Deno Web Crypto API (built-in)
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  if (aBytes.length !== bBytes.length) return false
  // crypto.subtle.timingSafeEqual is NOT available in Deno
  // Use manual XOR reduction:
  let result = 0
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i]
  }
  return result === 0
}
```

**Note:** Deno does not expose `crypto.timingSafeEqual` (that is a Node.js API). Use the XOR pattern above or import from esm.sh.

### Pattern 3: Postgres Atomic 3-Row Update (PL/pgSQL)

**What:** Single function that deduplicates and atomically updates 4 rows per donation (1 insert + 3 updates).

**When to use:** Called via `supabase.rpc('record_givebutter_donation', {...})` from the Edge Function. Never called directly from application code.

```sql
-- Source: Phase 2 technical contract + PL/pgSQL standard patterns
CREATE OR REPLACE FUNCTION treasury.record_givebutter_donation(
  p_external_id  TEXT,
  p_leaf_category_id  UUID,   -- Give Butter category (depth=1)
  p_parent_category_id UUID,  -- Donations category (depth=0)
  p_budget_id     UUID,
  p_description   TEXT,
  p_amount        NUMERIC,    -- dollars (confirm with $1 test; may need / 100 if cents)
  p_date          DATE,
  p_vendor        TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Idempotency check: if already processed, return silently
  IF EXISTS (
    SELECT 1 FROM treasury.budget_line_items
    WHERE external_id = p_external_id AND source = 'givebutter_webhook'
  ) THEN
    RETURN;
  END IF;

  -- 1. INSERT line item
  INSERT INTO treasury.budget_line_items
    (category_id, description, approved_amount, actual_amount, vendor, date, external_id, source)
  VALUES
    (p_leaf_category_id, p_description, p_amount, p_amount, p_vendor, p_date,
     p_external_id, 'givebutter_webhook');

  -- 2. UPDATE leaf category (Give Butter, depth=1)
  UPDATE treasury.budget_categories
  SET amount = amount + p_amount
  WHERE id = p_leaf_category_id;

  -- 3. UPDATE parent category (Donations, depth=0)
  UPDATE treasury.budget_categories
  SET amount = amount + p_amount
  WHERE id = p_parent_category_id;

  -- 4. UPDATE budget total
  UPDATE treasury.budgets
  SET total_budget = total_budget + p_amount
  WHERE id = p_budget_id;
END;
$$;
```

**Critical:** The unique partial index `idx_line_items_external_id_source` on `(external_id, source) WHERE external_id IS NOT NULL` provides database-level idempotency enforcement as a second guard (the IF EXISTS check is the first guard).

### Pattern 4: Category ID Resolution in Edge Function

**What:** Look up leaf and parent category UUIDs dynamically from the budget, not hardcoded.

**When to use:** Every webhook call. UUIDs change when `loadEVFinances.js` re-imports.

```typescript
// Find the current EV revenue budget
const { data: budget } = await supabase
  .from('budgets')
  .select('id')
  .eq('municipality_id', EV_MUNICIPALITY_ID)
  .eq('dataset_type', 'revenue')
  .order('fiscal_year', { ascending: false })
  .limit(1)
  .single()

const budgetId = budget.id

// Find categories by name and budget
const { data: categories } = await supabase
  .from('budget_categories')
  .select('id, name, depth')
  .eq('budget_id', budgetId)
  .in('name', ['Donations', 'Give Butter'])

const leafCatId = categories.find(c => c.name === 'Give Butter')?.id
const parentCatId = categories.find(c => c.name === 'Donations')?.id
```

**Note:** The EV municipality ID is known from `loadEVFinances.js`: `name = 'Empowered Vote'`. The Edge Function must also look up the municipality ID, or it can be stored as an environment variable after first query.

### Pattern 5: `loadEVFinances.js` Changes

Two targeted changes to the existing `scripts/loadEVFinances.js`:

**Change 1 — Add `source: 'csv'` to line item inserts (in `insertCategories()`, line ~310):**
```javascript
// BEFORE:
const items = cat.lineItems.map(li => ({
  category_id: catRow.id,
  description: li.description,
  approved_amount: li.amount,
  actual_amount: li.amount,
  vendor: li.vendor || null,
  date: li.date || null,
  payment_method: li.paymentMethod || null,
  fund: li.platform || null,
  expense_category: li.expenseCategory || null,
}));

// AFTER (add source field):
const items = cat.lineItems.map(li => ({
  category_id: catRow.id,
  description: li.description,
  approved_amount: li.amount,
  actual_amount: li.amount,
  vendor: li.vendor || null,
  date: li.date || null,
  payment_method: li.paymentMethod || null,
  fund: li.platform || null,
  expense_category: li.expenseCategory || null,
  source: 'csv',      // ADD THIS LINE
}));
```

**Change 2 — Preserve `source='givebutter_webhook'` rows in `clearExistingBudget()` (lines ~253-255):**
```javascript
// BEFORE:
await supabase.from('budget_line_items').delete().in('category_id', ids);

// AFTER (preserve webhook rows):
await supabase.from('budget_line_items')
  .delete()
  .in('category_id', ids)
  .neq('source', 'givebutter_webhook');   // ADD THIS FILTER
```

### Anti-Patterns to Avoid

- **Reading body as JSON first:** `await req.json()` modifies whitespace and formatting, breaking signature verification. Always use `req.text()` first, then `JSON.parse()`.
- **Hardcoded category UUIDs:** UUIDs regenerate on every `loadEVFinances.js` run. Always look up by `(budget_id, name)`.
- **Using anon key for Edge Function Supabase client:** Anon key triggers RLS and will block writes to `treasury` schema. Use `SUPABASE_SERVICE_ROLE_KEY`.
- **Direct table writes from TypeScript:** The atomicity contract requires using `supabase.rpc()`. Direct `from('budget_line_items').insert()` cannot atomically update 3 rows.
- **Forgetting `--no-verify-jwt`:** GiveButter cannot send a Supabase JWT. The Edge Function must be deployed without JWT verification. Without this flag, all webhook POSTs return 401.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-row update | Application-level read-modify-write | `treasury.record_givebutter_donation` Postgres function via `supabase.rpc()` | Supabase JS has no explicit transaction API; only PL/pgSQL guarantees atomicity |
| Idempotency | Custom dedup table | Unique partial index + IF EXISTS check in Postgres function | DB-level enforcement is more reliable than application-level checks |
| Secret storage | Hardcoded constants | `supabase secrets set` CLI command + `Deno.env.get()` | Secrets stored in Supabase dashboard, not in source code |

**Key insight:** Supabase JS client has no `.transaction()` API. Any multi-row atomic operation must live in a Postgres function called via `supabase.rpc()`.

---

## Common Pitfalls

### Pitfall 1: GiveButter Signature Algorithm Ambiguity
**What goes wrong:** GiveButter's official help center says "verify the Signature header contains the same value as your dashboard secret" — implying a raw string comparison. Third-party sources claim HMAC-SHA256. Building HMAC-SHA256 verification when GiveButter actually sends the raw secret as-is (or vice versa) means all webhooks return 401.
**Why it happens:** GiveButter's developer documentation is sparse and partially inaccessible. Their security model is not clearly documented.
**How to avoid:** Implement raw string comparison first (with `timingSafeEqual`). Capture the actual `Signature` header value during the $1 test donation using Supabase Edge Function logs. Compare it against the known signing secret from the dashboard. If they match exactly → raw comparison is correct. If they don't match → try HMAC-SHA256 and document the algorithm.
**Warning signs:** All webhook deliveries returning 401 immediately after go-live.

### Pitfall 2: Amount Unit Unknown Until $1 Test
**What goes wrong:** The Postgres function adds `p_amount` directly to category totals. If GiveButter sends cents (100) when we expect dollars (1.00), every donation inflates the budget 100x.
**Why it happens:** GiveButter's docs say dollars in some places and one search result said cents. Confirmation requires a real event.
**How to avoid:** The $1 test donation is not optional. Log `tx.amount` in the Edge Function. If the logged value is `1` or `1.00` → dollars, pass directly. If `100` → cents, divide by 100 in the Edge Function before passing to the Postgres function. Do not go live without this check.
**Warning signs:** Revenue total shows $100 after a $1 donation.

### Pitfall 3: JWT Verification Not Disabled
**What goes wrong:** GiveButter cannot include a Supabase JWT in its webhook request. Without `--no-verify-jwt`, Supabase rejects all incoming webhook POSTs with 401.
**Why it happens:** Default Edge Function deployment requires JWT auth. Webhook sources are external services.
**How to avoid:** Always deploy with: `supabase functions deploy givebutter-webhook --no-verify-jwt`
**Warning signs:** Supabase Function logs show no requests arriving at all, but GiveButter activity log shows deliveries attempted.

### Pitfall 4: Hardcoded Category UUIDs
**What goes wrong:** If UUIDs are captured at development time and hardcoded, a re-run of `loadEVFinances.js` regenerates them. Webhooks start inserting line items under the wrong (deleted) category UUID, causing FK errors or invisible donations.
**Why it happens:** UUIDs are generated at `loadEVFinances.js` import time; they are not stable identifiers.
**How to avoid:** Edge Function always queries `(budget_id, name='Give Butter')` and `(budget_id, name='Donations')` at request time.
**Warning signs:** FK constraint error on `budget_line_items.category_id`, or donations stored but not appearing on screen.

### Pitfall 5: `clearExistingBudget` Deletes Webhook Rows
**What goes wrong:** Without the `neq('source', 'givebutter_webhook')` filter, every `loadEVFinances.js` run deletes all webhook-sourced line items and subtracts nothing from the pre-aggregated category amounts (the delete skips the Postgres function's reversal logic). The budget totals drift.
**Why it happens:** The original `clearExistingBudget` does a blanket delete of all line items in the budget's categories.
**How to avoid:** Apply Change 2 in `loadEVFinances.js` before the first `loadEVFinances.js` run after go-live. Code review is sufficient validation per the locked deployment order.
**Warning signs:** Donations visible on site, then disappear after next CSV import.

---

## Code Examples

### Schema Migration SQL

```sql
-- Source: Phase 2 technical contract
-- Apply via Supabase SQL editor

ALTER TABLE treasury.budget_line_items
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'csv';

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_items_external_id_source
  ON treasury.budget_line_items (external_id, source)
  WHERE external_id IS NOT NULL;
```

### Deploy Edge Function (CLI)

```bash
# Link project (one-time)
supabase link --project-ref kxsdzaojfaibhuzmclfq

# Set the signing secret from GiveButter dashboard
supabase secrets set GIVEBUTTER_SIGNING_SECRET=<secret-from-dashboard>

# Deploy without JWT verification (REQUIRED for external webhooks)
supabase functions deploy givebutter-webhook --no-verify-jwt
```

### Supabase Client in Edge Function (service role, treasury schema)

```typescript
// Source: Supabase official patterns + supabase-js docs
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { db: { schema: 'treasury' } }
)
```

### Call Postgres RPC from Edge Function

```typescript
// Source: Supabase JS reference docs
const { error } = await supabase.rpc('record_givebutter_donation', {
  p_external_id: tx.id,
  p_leaf_category_id: leafCatId,
  p_parent_category_id: parentCatId,
  p_budget_id: budgetId,
  p_description: tx.first_name
    ? `Donation from ${tx.first_name} ${tx.last_name ?? ''}`.trim()
    : 'GiveButter donation',
  p_amount: tx.amount,   // confirm unit with $1 test
  p_date: tx.transacted_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  p_vendor: 'GiveButter',
})

if (error) {
  console.error('RPC error:', error)
  return new Response('Internal Server Error', { status: 500 })
}
```

### GiveButter Dashboard: Register Webhook

Path: **Settings → Developers → Webhooks → New webhook**

Fields:
- Name: `Treasury Tracker`
- Webhook URL: `https://kxsdzaojfaibhuzmclfq.supabase.co/functions/v1/givebutter-webhook`
- Events: `transaction.succeeded`

---

## GiveButter Webhook Payload — Known Fields

Based on the GiveButter help center (MEDIUM confidence — official source, limited detail):

| Field | Type | Notes |
|-------|------|-------|
| `type` | string | Event type, e.g. `"transaction.succeeded"` |
| `data` | object | Transaction object nested here (or may be top-level — confirm with $1 test) |
| `data.id` | string | Transaction ID — use as `external_id` (format like `"459oGBTylHk8laDF"`) |
| `data.amount` | number | Donation amount — **unit unconfirmed (dollars or cents)** |
| `data.campaign_id` | string | GiveButter campaign identifier |
| `data.first_name` | string | Donor first name |
| `data.last_name` | string | Donor last name |
| `data.email` | string | Donor email |
| `data.transacted_at` | string | ISO timestamp of transaction |
| `data.status` | string | e.g. `"succeeded"` |

**The `data.id` field is the stable transaction identifier to use as `external_id`.** This is a GiveButter-assigned transaction ID (not a payment processor ID).

**Critical unknowns to confirm via $1 test:**
1. Whether payload wraps in `{ type, data }` or is flat
2. Whether `data.amount` is dollars or cents
3. Whether the `Signature` header is the raw secret or HMAC-SHA256 of the body

---

## GiveButter Signature Verification — Ambiguity

**MEDIUM confidence — conflicting sources**

The GiveButter help center states (direct quote): "Review your code to see if the webhook request received contains a header called **Signature**. This should contain the **same value** in your dashboard."

This language reads as: GiveButter sends the signing secret itself as the `Signature` header value. Verification = direct string comparison.

However, third-party integration guides apply HMAC-SHA256 to GiveButter, treating it like other platforms.

**Recommended implementation strategy:**
1. Implement direct `timingSafeEqual(receivedSig, SIGNING_SECRET)` comparison first
2. During $1 test, log the `Signature` header value
3. If it matches the dashboard secret character-for-character → raw comparison confirmed
4. If it does not match → implement HMAC-SHA256: `HMAC_SHA256(body, secret)` → hex encode → compare

The Edge Function code should be written to make swapping the comparison trivial (single function call).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Deploy edge functions via Supabase dashboard UI | Deploy via `supabase functions deploy` CLI | Supabase CLI v1+ | CLI is the only way to reliably set `--no-verify-jwt` |
| `import ... from 'https://esm.sh/...'` | `import ... from 'npm:...'` | Supabase Deno runtime ~2024 | `npm:` prefix is the current standard for npm packages in Deno edge functions |
| `SUPABASE_PUBLISHABLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase JS v2+ | Published key enforces RLS; service role bypasses — required for webhook writes |

---

## Open Questions

1. **GiveButter `Signature` header: raw secret or HMAC-SHA256?**
   - What we know: Header name is `Signature`. Official docs suggest raw comparison. Third parties suggest HMAC-SHA256.
   - What's unclear: Which interpretation is correct.
   - Recommendation: Implement raw comparison first. Capture header value in $1 test logs. Resolve empirically.

2. **GiveButter `data.amount` unit: dollars or cents?**
   - What we know: One official source says dollars (250 = $250). One search result AI summary said cents. Conflicting.
   - What's unclear: Which is correct.
   - Recommendation: The $1 test is the definitive answer. Log `tx.data.amount` during the test. If `1` → dollars. If `100` → cents (divide by 100 before passing to Postgres function).

3. **GiveButter webhook payload envelope shape**
   - What we know: Event type is `transaction.succeeded`. Transaction fields include `id`, `amount`, `first_name`, `last_name`, `email`, `transacted_at`, `campaign_id`.
   - What's unclear: Whether the payload is `{ type, data: {...transaction...} }` or `{ type, ...transaction }` (flat) or another shape.
   - Recommendation: In the $1 test, log the entire raw body. Parse shape from the actual payload.

4. **Municipality ID for dynamic category lookup**
   - What we know: `loadEVFinances.js` queries/creates a municipality with `name='Empowered Vote'`. The ID is not known at build time.
   - What's unclear: Whether to look it up at every webhook request or store as an env var.
   - Recommendation: Query it once in the Edge Function on each request (or cache in module-level variable since Deno Edge Functions may reuse the module between requests). The extra query costs ~1ms on a warm function.

5. **Supabase project ref for CLI linking**
   - What we know: `SUPABASE_URL` = `https://kxsdzaojfaibhuzmclfq.supabase.co`
   - Recommendation: Project ref = `kxsdzaojfaibhuzmclfq`. Use `supabase link --project-ref kxsdzaojfaibhuzmclfq`.

---

## Sources

### Primary (HIGH confidence)
- `scripts/loadEVFinances.js` — codebase read; exact `clearExistingBudget()` and `insertCategories()` code for change specification
- `.planning/phases/02-data-layer-audit/02-01-SUMMARY.md` — Phase 2 technical contract; Postgres function signature, schema requirements, dedup strategy
- `https://supabase.com/docs/guides/functions/quickstart` — Edge Function creation, `--no-verify-jwt` flag, deployment pattern
- `https://supabase.com/docs/guides/functions/secrets` — Secret storage via `supabase secrets set`, `Deno.env.get()`
- `https://supabase.com/docs/guides/functions/deploy` — Deployment commands, JWT verification flag

### Secondary (MEDIUM confidence)
- `https://help.givebutter.com/en/articles/8828428-how-to-automate-workflows-and-data-using-webhooks` — Official GiveButter help; event types, `Signature` header name, signing secret UI location, dashboard registration path
- `https://docs.deno.com/examples/hmac_generate_verify/` — Deno HMAC generation pattern; confirmed `crypto.subtle.importKey`, `crypto.subtle.sign` API

### Tertiary (LOW confidence)
- Multiple WebSearch results — GiveButter amount unit (conflicting: dollars vs cents), HMAC algorithm for GiveButter signature (conflicting with official docs)
- `https://www.svix.com/blog/receive-webhooks-with-supabase-edge-functions/` — Supabase Edge Function webhook patterns; confirmed `req.text()` raw body requirement; `--no-verify-jwt` for external sources

---

## Metadata

**Confidence breakdown:**
- GiveButter payload shape: MEDIUM — official help center accessible; field names confirmed; envelope shape unconfirmed
- GiveButter signature algorithm: LOW — official docs ambiguous; $1 test required to resolve
- GiveButter amount unit: LOW — conflicting sources; $1 test required
- Supabase Edge Function patterns: HIGH — official docs accessible; confirmed patterns
- PL/pgSQL function design: HIGH — standard Postgres; Phase 2 contract defines signature
- `loadEVFinances.js` changes: HIGH — codebase read; exact line numbers known

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (Supabase stable); 2026-04-28 (GiveButter docs — re-verify before go-live if more than 1 week passes)
