# Phase 2: Data Layer Audit - Research

**Researched:** 2026-04-21
**Domain:** Supabase Postgres schema, Go API data flow, React data consumption
**Confidence:** HIGH — all findings are from direct codebase inspection, no speculation

---

## Summary

This research directly answers DATA-01 and DATA-02 by reading the actual code.

**DATA-01 ANSWER: The frontend reads pre-aggregated `budget_categories.amount` directly — it never sums `budget_line_items.actual_amount`.** The category `amount` column is computed at import time by the loader scripts, stored in Postgres, served by the Go API, and displayed as-received by the React frontend. No runtime aggregation happens in either SQL or JavaScript.

**DATA-02 ANSWER: The Edge Function webhook writer MUST update `budget_categories.amount` atomically.** Since the frontend reads only `budget_categories.amount` for all totals and display, adding a line item row without updating the parent category amounts will produce no visible change on-screen. The safest strategy is a Postgres transaction that inserts the `budget_line_items` row and then increments the affected category's `amount` (and all ancestor categories up the tree) using `UPDATE ... SET amount = amount + $delta WHERE id = $cat_id`.

**Primary recommendation:** Insert new GiveButter line item row + UPDATE all ancestor category amounts in a single Postgres transaction from the Supabase Edge Function. Do NOT use a trigger for this — the webhook must control the amount delta explicitly to support deduplication.

---

## Architecture Patterns

### Confirmed Data Flow (HIGH confidence — read directly from source)

```
CSV / GiveButter webhook
        |
        v
loadEVFinances.js (or Edge Function)
  - builds JS tree: { categories: [{name, amount, subcategories, lineItems}] }
  - amount = sum of all lineItems under that category (computed in JS)
        |
        v
Supabase Postgres (treasury schema)
  treasury.budget_categories.amount   <-- PRE-AGGREGATED, stored at import
  treasury.budget_line_items.actual_amount  <-- individual transaction rows
        |
        v
Go API (EV-Backend) — GET /api/treasury/budgets/:id/categories
  - Queries budget_categories ORDER BY depth, sort_order
  - Preloads LineItems for each category
  - Builds tree in Go (buildCategoryTree)
  - Returns BudgetCategory[] JSON with .amount fields populated from DB column
        |
        v
React frontend (dataLoader.ts → transformAPIResponse)
  - Receives categories[] as-is
  - Stores in budgetData.categories
        |
        v
Display
  - CategoryList.tsx: displays category.amount directly (no computation)
  - DatasetTabs.tsx: displays revenueData.metadata.totalBudget directly
  - PlainLanguageSummary.tsx: displays revenueData.metadata.totalBudget directly
  - BudgetIcicle / BudgetSunburst: reads category.amount for bar widths
```

### Key Finding: No Client-Side Aggregation (HIGH confidence)

The frontend NEVER sums `lineItems[].actualAmount` to produce totals. It reads `category.amount` as the display value in every component. Specifically:

- `CategoryList.tsx` line 173: `formatCurrency(isPastYear && category.actualAmount != null ? category.actualAmount : category.amount)`
- `DatasetTabs.tsx`: receives `revenueTotal` prop sourced from `revenueData.metadata.totalBudget`
- `App.tsx` line 697: passes `totalBudget={budgetData.metadata.totalBudget}` to visualizations
- `budgetData.metadata.totalBudget` maps to `budget.total_budget` in Postgres

### Key Finding: totalBudget on budgets Table (HIGH confidence)

There are TWO pre-aggregated amount fields:
1. `treasury.budget_categories.amount` — per-category total
2. `treasury.budgets.total_budget` — overall budget total

Both are set at import time. A webhook writing a new donation must update both.

### Key Finding: Category Tree is Hierarchical (HIGH confidence)

`budget_categories` has a `parent_id` self-reference. The Go API builds the tree client-side. For the EV revenue budget, the hierarchy is:

```
Donations (top, depth=0)  → amount = sum of subcategory amounts
  Give Butter (depth=1)   → amount = sum of all GiveButter lineItems
    [lineItems]
```

A new GiveButter donation must increment:
- The specific leaf/sub category (`Give Butter`, depth=1) `.amount`
- The parent category (`Donations`, depth=0) `.amount`
- The budget's `total_budget`

### Key Finding: Current Schema Has No external_id or source Columns (HIGH confidence)

Reading `/c/EV-Backend/internal/treasury/models.go` (the authoritative schema source via GORM):

```go
type BudgetLineItem struct {
  ID             uuid.UUID
  CategoryID     uuid.UUID
  Description    string
  ApprovedAmount float64
  ActualAmount   float64
  // Salary-specific
  BasePay, Benefits, Overtime, Other *float64
  StartDate *string
  // Transaction-specific
  Vendor, Date, PaymentMethod, InvoiceNumber, Fund, ExpenseCategory *string
}
```

There is NO `external_id`, NO `source`, NO `platform` column in the Go model. The loader script uses the `fund` column (maps to `platform` in the JS object) to store the payment platform (`Give Butter`, `Patreon`, etc.), but this is free-text, not a deduplication key.

**Adding `external_id` (GiveButter payment ID) and `source` columns to `budget_line_items` is safe** as long as:
1. Both columns are nullable (existing rows have no external ID)
2. A unique index on `(external_id, source)` WHERE `external_id IS NOT NULL` prevents duplicate webhook inserts
3. The Go model in EV-Backend is updated to include the new columns (GORM AutoMigrate will add them)
4. The loadEVFinances.js import script is updated to set `external_id = NULL, source = 'csv'` for CSV imports (so CSV re-imports don't conflict with webhook rows)

### Key Finding: loadEVFinances.js Clears and Rebuilds Entire Budget (HIGH confidence)

From `scripts/loadEVFinances.js`, the `clearExistingBudget` function:
1. Finds the existing budget by (municipality_id, fiscal_year, dataset_type)
2. Deletes ALL line items under that budget's categories
3. Deletes ALL categories for that budget
4. Deletes the budget record itself
5. Then re-imports from scratch

**This is the deduplication risk**: if a GiveButter webhook writes a new row, and then someone re-runs `loadEVFinances.js`, ALL webhook-written rows will be deleted and the donation will be re-imported from the CSV (if it appears there) or lost.

**The fix strategy:** Before clearing, the script must preserve webhook-sourced rows (`source = 'webhook'`), OR use `external_id` deduplication to skip CSV rows that were already written by webhook.

---

## Standard Stack

### Core (already in use — no new installs needed)

| Component | Version/Location | Purpose |
|-----------|-----------------|---------|
| `@supabase/supabase-js` | ^2.100.1 (package.json) | Direct Supabase client in Node scripts |
| `treasury.budget_categories` | Postgres table | Pre-aggregated category amounts |
| `treasury.budget_line_items` | Postgres table | Individual transaction rows |
| Go GORM models | `/c/EV-Backend/internal/treasury/models.go` | Schema source of truth |
| Supabase Edge Functions | Phase 3 target | Webhook receiver |

### For New Columns (Phase 3 dependency)

No new npm packages needed. Schema changes only:
```sql
ALTER TABLE treasury.budget_line_items
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'csv';

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_items_external_id_source
  ON treasury.budget_line_items (external_id, source)
  WHERE external_id IS NOT NULL;
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deduplication | Custom "check if row exists" query | Postgres unique partial index on (external_id, source) | Single index handles concurrent inserts atomically |
| Atomic amount update | Application-level read-modify-write | `UPDATE ... SET amount = amount + $delta` in same transaction | Prevents race conditions between concurrent webhooks |
| Category tree traversal to find ancestors | Recursive JS/Go code | Walk `parent_id` chain in a single CTE: `WITH RECURSIVE ancestors AS (...)` | One query vs N queries |

**Key insight:** The amount aggregation problem is already solved in Postgres — use `UPDATE ... SET amount = amount + delta` not "recompute from sum of lineItems" which would require reading all sibling rows.

---

## Common Pitfalls

### Pitfall 1: Updating Only the Leaf Category Amount

**What goes wrong:** Webhook inserts a $100 GiveButter donation, updates only `Give Butter` category amount from $500 to $600. The `Donations` parent still shows $500. The `DatasetTabs` total and `PlainLanguageSummary` still show the old `budgets.total_budget`.

**Why it happens:** The tree has 3 layers that all need updating: leaf category, parent category, and budget total.

**How to avoid:** In the Edge Function transaction:
1. `INSERT INTO budget_line_items ...`
2. `UPDATE budget_categories SET amount = amount + $delta WHERE id = $leaf_category_id`
3. `UPDATE budget_categories SET amount = amount + $delta WHERE id = $parent_category_id`
4. `UPDATE budgets SET total_budget = total_budget + $delta WHERE id = $budget_id`

**Warning signs:** Revenue total in DatasetTabs doesn't change after webhook fires.

### Pitfall 2: CSV Re-import Destroying Webhook Rows

**What goes wrong:** Someone re-runs `loadEVFinances.js` after a webhook has written new donation rows. `clearExistingBudget()` deletes ALL line items and categories. The webhook-written row disappears from the database.

**Why it happens:** `clearExistingBudget` is a full delete, not a merge.

**How to avoid:** Either:
- Option A: Modify `loadEVFinances.js` to skip rows with `source = 'webhook'` (preserve them, don't delete)
- Option B: Modify `loadEVFinances.js` to check `external_id` and skip lines already in DB
- Option C (simplest for v1): `loadEVFinances.js` becomes authoritative for past data only; webhook-only data for current in-progress year is not re-imported by script

**Warning signs:** Live donation total drops after next CSV import.

### Pitfall 3: Race Condition on Concurrent Webhooks

**What goes wrong:** Two GiveButter webhooks fire at the same time. Both read `amount = $500`. Both try to set `amount = $600`. Result is $600, not $700.

**Why it happens:** Read-then-write in application code is not atomic.

**How to avoid:** Use `UPDATE ... SET amount = amount + $delta` — Postgres row-level locking handles concurrency. Never do: read current amount → add delta → write new amount.

### Pitfall 4: Finding the Right Category ID for "Give Butter"

**What goes wrong:** Edge Function doesn't know which `budget_categories.id` corresponds to the "Give Butter" subcategory for the current year's revenue budget.

**Why it happens:** Category IDs are UUIDs generated at import time, not stable constants.

**How to avoid:** Look up category by `(budget_id, name)` where budget_id is found by `(municipality_id, fiscal_year, dataset_type='revenue')`. Or store the category ID in a config table/environment variable after each import.

---

## Code Examples

### Confirmed: How loadEVFinances.js Sets Category Amounts

```javascript
// Source: /c/treasury-tracker/scripts/loadEVFinances.js — buildTree()
// Amount is summed from raw rows IN JAVASCRIPT before DB insert
const topAmount = Object.values(subs).reduce(
  (s, rs) => s + rs.reduce((ss, r) => ss + Math.abs(parseAmount(r.Amount)), 0), 0
);
// Then stored directly:
await supabase.from('budget_categories').insert({
  amount: cat.amount,  // pre-computed, not SUM() in Postgres
  ...
})
```

### Confirmed: How Go API Serves Category Amounts

```go
// Source: /c/EV-Backend/internal/treasury/handlers.go — GetBudgetCategories
var categories []BudgetCategory
db.DB.Where("budget_id = ?", budgetID).
  Order("depth ASC, sort_order ASC").
  Preload("LineItems").
  Find(&categories)
// Returns categories[].Amount directly from DB column — no SQL aggregation
```

### Confirmed: How Frontend Displays Amount

```typescript
// Source: /c/treasury-tracker/src/components/CategoryList.tsx line 173
formatCurrency(isPastYear && category.actualAmount != null
  ? category.actualAmount
  : category.amount)  // reads category.amount directly, never sums lineItems
```

### Recommended: Atomic Update Pattern for Edge Function

```typescript
// Supabase Edge Function pattern (to be implemented in Phase 3)
// Run all 4 ops in one RPC or sequential awaits (Supabase doesn't expose explicit transactions
// from JS client — use a Postgres function via supabase.rpc())

// RECOMMENDED: Create a Postgres function in Supabase SQL editor:
/*
CREATE OR REPLACE FUNCTION treasury.record_givebutter_donation(
  p_external_id TEXT,
  p_leaf_category_id UUID,
  p_parent_category_id UUID,
  p_budget_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_date DATE,
  p_vendor TEXT
) RETURNS void AS $$
BEGIN
  -- Deduplication check
  IF EXISTS (SELECT 1 FROM treasury.budget_line_items
             WHERE external_id = p_external_id AND source = 'webhook') THEN
    RETURN; -- idempotent no-op
  END IF;

  INSERT INTO treasury.budget_line_items
    (category_id, description, approved_amount, actual_amount,
     vendor, date, external_id, source)
  VALUES
    (p_leaf_category_id, p_description, p_amount, p_amount,
     p_vendor, p_date, p_external_id, 'webhook');

  UPDATE treasury.budget_categories
    SET amount = amount + p_amount
    WHERE id IN (p_leaf_category_id, p_parent_category_id);

  UPDATE treasury.budgets
    SET total_budget = total_budget + p_amount
    WHERE id = p_budget_id;
END;
$$ LANGUAGE plpgsql;
*/
```

---

## State of the Art

| Old Pattern | Current Pattern | Impact |
|-------------|-----------------|--------|
| `loadEVFinances.js` writes CSV data directly to Supabase | Same, but will need `external_id`/`source` columns added | Backward compatible — new columns are nullable |
| No deduplication key | Add `external_id + source` unique partial index | Enables idempotent webhook inserts |
| Category amounts computed in JS at import time only | Same, but webhook must also update them | Must update 3 rows per donation: leaf cat, parent cat, budget |

---

## Open Questions

1. **Does the Go model need to be updated before schema changes?**
   - What we know: GORM AutoMigrate adds new columns when the struct is updated. But EV-Backend is a separate repo deployed on Render.
   - What's unclear: Is there a way to add the columns via Supabase SQL editor (bypassing GORM) for Phase 3 without touching EV-Backend?
   - Recommendation: Add columns via Supabase SQL editor directly. The Go model doesn't need to know about `external_id`/`source` since the Go API never writes webhook rows — only the Edge Function does.

2. **How deep is the EV revenue category tree?**
   - What we know: From `loadEVFinances.js` `classifyIncome()`, the tree is: `Donations (depth 0)` → `Give Butter (depth 1)` → `[lineItems]`. So 2 levels plus the budget row = 3 updates.
   - What's unclear: Whether there's a third level for individual donations within Give Butter.
   - Recommendation: Assume 2-level tree (leaf + 1 parent) for now. The Postgres function can accept both IDs as parameters.

3. **What is the GiveButter webhook payload shape?**
   - What we know: This is researched in Phase 3 (Webhook Backend). Phase 2 only needs to know what columns to store.
   - What's unclear: Whether GiveButter sends a stable transaction ID usable as `external_id`.
   - Recommendation: Phase 3 research will confirm. Plan for `external_id = givebutter_payment_id` (string, not UUID).

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `/c/treasury-tracker/src/data/dataLoader.ts` — `loadBudgetData()` implementation
- `/c/treasury-tracker/src/components/CategoryList.tsx` — amount display logic
- `/c/treasury-tracker/src/components/datasets/DatasetTabs.tsx` — totalBudget display
- `/c/treasury-tracker/src/App.tsx` — how `totalBudget` prop flows to visualizations
- `/c/EV-Backend/internal/treasury/models.go` — authoritative Postgres schema (GORM struct)
- `/c/EV-Backend/internal/treasury/handlers.go` — `GetBudgetCategories` query logic
- `/c/treasury-tracker/scripts/loadEVFinances.js` — how amounts are computed and stored

### No External Sources Required
This phase was answered entirely from codebase inspection. No library docs or WebSearch were needed — the questions were empirical, not conceptual.

---

## Metadata

**Confidence breakdown:**
- DATA-01 (how frontend reads amounts): HIGH — read the actual component code
- DATA-02 (what Edge Function must update): HIGH — traced the full data path
- Schema columns needed: HIGH — read the GORM struct directly
- CSV re-import risk: HIGH — read `clearExistingBudget()` implementation
- Recommended atomic update strategy: HIGH — standard Postgres pattern, verified fits the data model

**Research date:** 2026-04-21
**Valid until:** Until EV-Backend schema changes (stable — no changes in flight)
