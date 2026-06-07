---
phase: 32-state-entity-infrastructure
fixed_at: 2026-06-07T00:00:00Z
review_path: .planning/phases/32-state-entity-infrastructure/32-REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-06-07T00:00:00Z
**Source review:** `.planning/phases/32-state-entity-infrastructure/32-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 7 (3 Critical, 4 Warning)
- Fixed: 7
- Skipped: 0

Note: CR-01, CR-02, CR-03, WR-01, and WR-03 are in `C:/EV-Accounts/backend` — a separate git
repository. Those commits were made to the `master` branch of that repo. WR-02 and WR-04 are
in this treasury-tracker repository and were committed to `main`.

---

## Fixed Issues

### CR-01: Non-null assertion on `ds_url` in `mapBudget`

**Files modified:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts`
**Commit:** `31e4c4f` (EV-Accounts/backend master)
**Applied fix:** Changed the `data_source_info` guard condition from `row.ds_display_name ?`
to `row.ds_display_name && row.ds_url ?` and removed the `!` non-null assertion on
`row.ds_url`. When `display_name` is set but `url` is NULL, the field now correctly returns
`null` instead of silently producing `undefined` in the `url` property and breaking link
rendering.

---

### CR-02: POST /budgets/:id/line-items passes budget UUID as `categoryId`

**Files modified:** `C:/EV-Accounts/backend/src/routes/treasury.ts`
**Commit:** `90aa95c` (EV-Accounts/backend master)
**Applied fix:** Added `categoryId: z.string().uuid()` as a required field to
`createBudgetLineItemSchema` and changed the handler to call
`createBudgetLineItem(parsed.data.categoryId, parsed.data)` instead of passing the route
param `id` (the budget UUID). Removed the misleading comment block that incorrectly justified
using the budget UUID as a category ID. Also added a route-level comment clarifying that the
`:id` path param is the budget UUID and `categoryId` must be in the request body.

---

### CR-03: Prefix-range upper bound `}` captures wrong rows

**Files modified:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts`
**Commit:** `3d052f3` (EV-Accounts/backend master)
**Applied fix:** Replaced the range query `LOWER(t.link_key) >= $2 AND LOWER(t.link_key) < ($2 || '}')` 
with an explicit match: `(LOWER(t.link_key) = $2 OR LOWER(t.link_key) LIKE $2 || '|%')`.
This unambiguously matches the exact key or any pipe-delimited child key without capturing
keys containing characters at ASCII 125-255 (e.g., `~`). Comment documents the rationale.

---

### WR-01: `getCities()` and `getCityById()` enforce different data-presence contracts

**Files modified:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts`
**Commit:** `6e496fa` (EV-Accounts/backend master)
**Applied fix:** Added `HAVING COUNT(b.id) > 0` to `getCityById`'s SQL query to match the
budget-presence filter that `getCities()` already enforces. Added comprehensive JSDoc
documenting the contract: `getCityById` now returns `null` when the municipality exists but
has no associated budget rows, preventing URL-based navigation from resolving to an entity
that the EntitySwitcher would hide while budget load silently fails.

---

### WR-02: `totalCount` filter runs on every render outside `useMemo`

**Files modified:** `src/components/EntitySwitcher.tsx`
**Commit:** `de47d13` (treasury-tracker main)
**Applied fix:** Wrapped the `totalCount` computation in `useMemo` with `[municipalities]`
as the dependency array. `useMemo` was already imported. The filter now only re-executes
when the municipalities list changes, not on every dropdown toggle, keystroke, or parent
re-render.

---

### WR-03: Three sequential queries in `getLinkedTransactions` with no transaction

**Files modified:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts`
**Commit:** `8a4f9ff` (EV-Accounts/backend master)
**Applied fix:** Wrapped the summary aggregate, top-vendors, and preview-transactions
queries in a `BEGIN`/`COMMIT` transaction using `pool.connect()` to acquire a dedicated
client. The early-return path (empty result) commits before returning null. A `catch`
handler issues `ROLLBACK` and rethrows; the `finally` block calls `client.release()` to
prevent connection leaks. All three queries now see the same point-in-time snapshot.

---

### WR-04: Migration does not comment on the `budgets.dataset_type` constraint scope

**Files modified:** `supabase/migrations/20260606000000_add_state_entity_type.sql`
**Commit:** `4d280e5` (treasury-tracker main)
**Applied fix:** Added a comment block at the top of the migration file explaining that
`treasury.budgets.dataset_type` and `treasury.data_sources.dataset_type` are intentionally
not modified here — state governments use the same dataset_type values as other entities
('operating', 'revenue', 'salaries'). Directs future developers to add a new migration if
a state-specific dataset_type value is ever needed.

---

## Skipped Issues

None — all 7 in-scope findings were fixed successfully.

---

_Fixed: 2026-06-07T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
