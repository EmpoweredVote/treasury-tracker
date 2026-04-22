---
phase: 03-webhook-backend
plan: 03
subsystem: database
tags: [supabase, postgres, csv-import, webhook, deduplication]

requires:
  - phase: 02-data-layer-audit
    provides: Deduplication strategy — source column distinguishes csv vs webhook rows

provides:
  - CSV re-import safety: loadEVFinances.js now preserves webhook-sourced rows
  - Source tagging: all CSV line items get source='csv' explicitly

affects: [phase-03-04-edge-function, phase-03-05-go-live]

tech-stack:
  added: []
  patterns:
    - "Source-tagged rows: source='csv' on import, source='givebutter_webhook' on webhook"
    - "Preserve-not-merge: clearExistingBudget skips webhook rows via .neq() filter"

key-files:
  modified:
    - scripts/loadEVFinances.js

key-decisions:
  - "Two targeted changes only — no other modifications to loadEVFinances.js"
  - "The .neq() filter is harmless against rows without a webhook source (safe to deploy any time)"

duration: 1m 26s
completed: 2026-04-21
---

# Phase 03 Plan 03: loadEVFinances Source Tagging Summary

**Two targeted changes enforce CSV re-import safety: source='csv' tagging on all line item inserts + webhook row preservation in clearExistingBudget.**

## Performance

- **Duration:** 1m 26s
- **Started:** 2026-04-22T02:55:03Z
- **Completed:** 2026-04-22T02:56:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `source: 'csv'` to all CSV line item inserts in insertCategories()
- Added `.neq('source', 'givebutter_webhook')` filter to budget_line_items delete in clearExistingBudget()
- CSV re-imports after go-live will no longer delete webhook-sourced donation rows

## Task Commits

1. **Task 1: Add source:'csv' to line item inserts** - `c752b8e` (feat)
2. **Task 2: Preserve webhook rows in clearExistingBudget** - `1e55e93` (feat)

**Plan metadata:** (docs — see below)

## Exact Diffs Applied

### Task 1 — insertCategories items mapping (line 306-320)

**Before:**
```javascript
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
```

**After:**
```javascript
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
  source: 'csv',
}));
```

**Grep confirmation:**
```
320:        source: 'csv',
```

---

### Task 2 — clearExistingBudget delete call (line 255)

**Before:**
```javascript
await supabase.from('budget_line_items').delete().in('category_id', ids);
```

**After:**
```javascript
await supabase
  .from('budget_line_items')
  .delete()
  .in('category_id', ids)
  .neq('source', 'givebutter_webhook');
```

**Grep confirmation:**
```
259:      .neq('source', 'givebutter_webhook');
```

## Files Created/Modified

- `scripts/loadEVFinances.js` — Two targeted edits: source tagging + webhook row preservation

## Decisions Made

None - followed plan as specified. Changes are exactly as defined in the Phase 2 technical contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Go-Live Sequencing Note

These code changes are now merged and ready for go-live sequencing. They are safe to have in main at any time because:
- The `source: 'csv'` field has a DEFAULT on the column (null is acceptable until schema migration runs)
- The `.neq()` filter is harmless against rows that have no webhook source

**Prerequisite before go-live:** Plan 03-01 schema migration must be applied via Supabase SQL editor to add the `source` column and unique partial index.

## Next Phase Readiness

- Plan 03-03 complete. The CSV re-import safety contract from Phase 2 is now enforced in code.
- Plan 03-01 (schema migration) must be applied before go-live.
- Ready for Plan 03-02 (Postgres RPC function) once schema migration is applied.

---
*Phase: 03-webhook-backend*
*Completed: 2026-04-21*
