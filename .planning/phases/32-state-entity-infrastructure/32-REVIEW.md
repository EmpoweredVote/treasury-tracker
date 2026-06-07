---
phase: 32-state-entity-infrastructure
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/EntitySwitcher.tsx
  - src/types/budget.ts
  - supabase/migrations/20260606000000_add_state_entity_type.sql
  - C:/EV-Accounts/backend/src/lib/treasuryService.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This pass covers all four files listed in the phase scope. The prior round of fixes (commits 3df02e3 through a758fec) resolved CR-01 (idempotent migration), CR-02 (entity_type union expansion), and the STATE_LABELS/WR-01/WR-03 label warnings. This pass incorporates review of `C:/EV-Accounts/backend/src/lib/treasuryService.ts`, which was not reviewed previously, and re-examines all four files together.

Three new critical issues were found: a non-null assertion crash in `mapBudget`, a completely non-functional line-items write route, and an incorrect prefix-range boundary character in the linked-transaction scan. Four warnings address a semantic inconsistency between `getCities`/`getCityById`, a repeated filter computation, a multi-query TOCTOU gap, and a missing migration scope comment. Two info items address a missing `nonprofit` label and an encoding artifact.

---

## Critical Issues

### CR-01: Non-null assertion on `ds_url` violates contract when `display_name` is set but `url` is NULL

**File:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts:322-325`
**Issue:** `mapBudget` constructs `data_source_info` when `row.ds_display_name` is truthy, then uses the non-null assertion `row.ds_url!` to populate `url`:

```typescript
data_source_info: row.ds_display_name ? {
  displayName: row.ds_display_name,
  url: row.ds_url!,   // non-null assertion
} : null,
```

The `source_registry` table has no schema-enforced NOT NULL on `url`. If a row has a `display_name` but a NULL `url`, the assertion bypasses TypeScript's null check and `url` is `undefined` at runtime — silently violating the `{ displayName: string; url: string }` return type. Any consumer that interpolates `data_source_info.url` into an anchor `href` will render a broken link with no error.

**Fix:**
```typescript
data_source_info: row.ds_display_name && row.ds_url ? {
  displayName: row.ds_display_name,
  url: row.ds_url,
} : null,
```

---

### CR-02: POST /budgets/:id/line-items passes the budget UUID as `categoryId` — route is completely non-functional

**File:** `C:/EV-Accounts/backend/src/routes/treasury.ts:428`
**Issue:** The handler at `POST /budgets/:id/line-items` calls:

```typescript
const lineItem = await createBudgetLineItem(id, parsed.data);
```

where `id` is `req.params.id` — the **budget** UUID from the route path. `createBudgetLineItem` inserts that value directly as `category_id` in `treasury.budget_line_items`. A budget UUID is never a valid `budget_categories.id`, so the foreign-key constraint will always reject the insert. The comment block at lines 415–426 acknowledges the confusion but incorrectly concludes that using the route `id` as `categoryId` is correct. This route has never successfully created a line item.

**Fix:** Add `categoryId` to the request body schema and pass it to the service:

```typescript
const createBudgetLineItemSchema = z.object({
  categoryId: z.string().uuid(),  // required — must be a valid budget_categories.id
  description: z.string().min(1),
  approvedAmount: z.number().optional().nullable(),
  // ... rest unchanged
});

// In the handler body:
const lineItem = await createBudgetLineItem(parsed.data.categoryId, parsed.data);
```

---

### CR-03: Prefix-range upper bound `}` (ASCII 125) is incorrect — queries return wrong rows for link keys with characters above `|`

**File:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts:744`
**Issue:** The no-alias prefix-range fallback in `getLinkedTransactions` is:

```sql
LOWER(t.link_key) >= $2 AND LOWER(t.link_key) < ($2 || '}')
```

The rationale is that `}` (ASCII 125) is one above `|` (ASCII 124, the pipe separator), so a prefix `fire` bounded by `fire}` should capture `fire|anything`. However, the range also captures `fire~something` (tilde = ASCII 126), `fire` followed by any character with code point 126–255, and any multi-byte UTF-8 sequence starting above `|`. If a link key for a different department ever starts with a prefix that alphabetically falls between `fire|` and `fire}`, it will be included in the wrong department's transaction query, returning incorrect financial data to the UI.

**Fix:** Use an explicit pipe-prefix LIKE match, which is unambiguous:

```typescript
matchWhere = `t.budget_id = $1 AND (LOWER(t.link_key) = $2 OR LOWER(t.link_key) LIKE $2 || '|%')`;
matchParams = [budgetId, linkKey.toLowerCase()];
```

Apply the same fix to both the `summaryRows` query, the `vendorRows` query, and the `txRows` query (all three use `matchWhere`/`matchParams`).

---

## Warnings

### WR-01: `getCities()` and `getCityById()` enforce different data-presence contracts — breaks URL-based navigation

**File:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts:380-421`
**Issue:** `getCities()` applies `HAVING COUNT(b.id) > 0`, returning only municipalities with at least one budget. `getCityById()` (line 403) performs no such filter — it returns any municipality even if `available_datasets` is empty. When a user navigates via a bookmarked URL, `App.tsx` calls `getCityById` (indirectly via `listMunicipalities` + URL slug match), and can resolve to a municipality with no budget data. The EntitySwitcher's `available_datasets.length > 0` guard (EntitySwitcher.tsx:69) then hides that entity from the dropdown, but the entity is still selected and the budget load will silently fail. The inconsistency means the two APIs have different semantics with no documentation.

**Fix:** Either apply the same budget-presence filter in `getCityById` (return `null` when `available_datasets` is empty), or document the asymmetry clearly in JSDoc and add a guard in the route handler at `GET /cities/:id`.

---

### WR-02: `totalCount` filter in `EntitySwitcher` runs on every render outside `useMemo`

**File:** `src/components/EntitySwitcher.tsx:97`
**Issue:**

```typescript
const totalCount = municipalities.filter(m => m.available_datasets && m.available_datasets.length > 0).length;
```

This iterates the full `municipalities` array on every render of `EntitySwitcher`, including renders triggered by dropdown open/close, keystroke in the search box, hover events on list items, and any parent re-renders. The `grouped` `useMemo` correctly memoizes expensive grouping logic, but `totalCount` is computed outside it. With hundreds of municipalities this is a repeated O(n) traversal on every keystroke.

**Fix:**

```typescript
const totalCount = useMemo(
  () => municipalities.filter(m => m.available_datasets && m.available_datasets.length > 0).length,
  [municipalities]
);
```

---

### WR-03: Three sequential queries in `getLinkedTransactions` run without a database transaction — TOCTOU race possible

**File:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts:749-784`
**Issue:** The summary aggregate query, the top-vendors query, and the preview-transactions query all run against `treasury.transactions` in three separate round trips with no wrapping `BEGIN`/`COMMIT`. Between the summary count (`transaction_count`) and the preview fetch (`txRows`), another process could insert or delete rows. The result is that `summary.transaction_count` may not match the number of rows actually returned, and `hasMore` (line 806) may be wrong. In a low-write scenario this is unlikely to fire, but it is a correctness gap that will produce confusing UI (e.g., "Showing 20 of 0 transactions").

**Fix:** Wrap the three queries in a single pool transaction, or rewrite as one CTE:

```sql
WITH matched AS (
  SELECT t.amount, t.description, t.payment_date, t.payment_method,
         t.invoice_number, t.fund, t.expense_category, t.vendor_id,
         v.name AS vendor_name
  FROM treasury.transactions t
  LEFT JOIN treasury.vendors v ON v.id = t.vendor_id
  WHERE <matchWhere>
),
agg AS (
  SELECT COUNT(*)::int AS transaction_count,
         COALESCE(SUM(amount), 0) AS total_amount,
         COUNT(DISTINCT vendor_id)::int AS vendor_count
  FROM matched
)
SELECT * FROM agg, matched ORDER BY matched.payment_date DESC LIMIT $N
```

---

### WR-04: Migration does not comment on the `budgets.dataset_type` constraint scope

**File:** `supabase/migrations/20260606000000_add_state_entity_type.sql`
**Issue:** The migration expands only `municipalities.entity_type`. The `treasury.budgets.dataset_type` constraint and the `treasury.data_sources.dataset_type` constraint are untouched. A developer reading this migration in the future may assume all state-related DB plumbing was completed here and omit a necessary constraint migration if a state-specific dataset type is later introduced. The migration has no comment explaining this intentional scope boundary.

**Fix:** Add a comment:

```sql
-- NOTE: treasury.budgets.dataset_type and treasury.data_sources.dataset_type
-- are NOT modified here. State governments use the same dataset_type values
-- as other entities ('operating', 'revenue', 'salaries'). If a state-specific
-- dataset_type value is needed in a future phase, add a new migration at that time.
```

---

## Info

### IN-01: `ENTITY_TYPE_LABELS` in `EntitySwitcher.tsx` is missing `nonprofit`

**File:** `src/components/EntitySwitcher.tsx:12-23`
**Issue:** The label map covers 10 entity types but omits `nonprofit`, which is present in the `Municipality.entity_type` union and in the DB CHECK constraint. If a nonprofit entity has a non-state `entity_type` grouping path, its subheader renders the raw string `"nonprofit"` (fallback at line 188). Current production data routes nonprofits through the financials host, so this is not visible today — but it is a latent display defect.

**Fix:**

```typescript
nonprofit: 'Nonprofits',  // add to ENTITY_TYPE_LABELS
```

---

### IN-02: Encoding artifact in `wikiImage.ts` comment at line 94

**File:** `src/utils/wikiImage.ts:94`
**Issue:** The comment `// return early 🔼 state fallback...` contains a garbled/corrupted character (appears as the replacement character `?` or a box in some editors) in place of what was likely an arrow or dash. Not a functional issue.

**Fix:** Replace with plain ASCII: `// return early — state fallback to stateFull would duplicate`.

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
