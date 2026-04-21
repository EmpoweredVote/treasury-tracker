---
phase: 02-data-layer-audit
plan: 01
completed: 2026-04-21
subsystem: data-layer
tags: [postgres, supabase, edge-functions, budget_categories, budget_line_items, aggregation, deduplication]

requires:
  - phase: 01-donate-button
    provides: Donate button UI shipped; GiveButter campaign link live on EV financials page

provides:
  - DATA-01 answer: frontend reads pre-aggregated budget_categories.amount — no runtime aggregation
  - DATA-02 answer: webhook must atomically update 3 rows per donation (leaf category + parent category + budget total)
  - Concrete Phase 3 technical contract (schema columns, Postgres function signature, dedup strategy)
  - Documented CSV re-import risk with mitigation strategy

affects: [phase-03-webhook-backend]

tech-stack:
  added: []
  modified: []
  patterns:
    - "Pre-aggregated amounts pattern: category.amount and budgets.total_budget are stored at import time, never computed at runtime"
    - "Atomic multi-row update via Postgres function (supabase.rpc) — not application-level read-modify-write"
    - "Source-tagged rows pattern: source TEXT column distinguishes csv vs webhook rows for safe re-import"

key-files:
  created:
    - .planning/phases/02-data-layer-audit/02-01-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "Frontend reads pre-aggregated budget_categories.amount — no runtime aggregation"
  - "Webhook must update 3 rows atomically per donation (leaf category + parent category + budget total)"
  - "Use Postgres function treasury.record_givebutter_donation via supabase.rpc() — encapsulates dedup check and atomic multi-row update"
  - "Add external_id TEXT + source TEXT columns to budget_line_items via Supabase SQL editor (skip EV-Backend GORM)"
  - "loadEVFinances.js must preserve source='webhook' rows during clearExistingBudget"

patterns-established:
  - "Audit-before-build: research phase answers empirical questions from codebase, then plan phase distills into durable contract"

duration: 15min
---

# Phase 2 Plan 1: Data Layer Audit Summary

**Codebase audit confirms frontend reads pre-aggregated amounts exclusively — webhook must atomically update 3 rows per donation (leaf category + parent category + budget total) via a Postgres function.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-21T21:58:21Z
- **Completed:** 2026-04-21
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Confirmed DATA-01: frontend reads `budget_categories.amount` directly from Postgres — no SQL SUM() or JS aggregation at runtime
- Confirmed DATA-02: webhook must update 3 rows atomically; defined the Postgres function strategy and signature
- Produced unambiguous Phase 3 technical contract with schema columns, index, function signature, and dedup approach

## DATA-01 Answer

The frontend reads `budget_categories.amount` directly from Postgres in every display path — it never sums `budget_line_items.actual_amount` at runtime. Three components confirm this pattern: `CategoryList.tsx` reads `category.amount` (line 173) for the formatted currency display; `DatasetTabs.tsx` reads the `revenueTotal` prop sourced from `revenueData.metadata.totalBudget`; and `PlainLanguageSummary.tsx` displays the same `totalBudget` value. The `budget.total_budget` column on the `budgets` table is also pre-aggregated — set at import time by `loadEVFinances.js` and served as-is by the Go API without recomputation. The Go API's `GetBudgetCategories` handler queries `budget_categories ORDER BY depth, sort_order` and returns `.Amount` directly from the DB column. **Conclusion:** the webhook cannot rely on "the UI will sum line items for us" — it must update the pre-aggregated columns itself.

## DATA-02 Answer

Because the frontend reads only pre-aggregated columns, the Phase 3 Edge Function MUST update 3 rows per successful donation in a single Postgres transaction:

1. **INSERT** into `treasury.budget_line_items` (with `external_id`, `source='webhook'`)
2. **UPDATE** `treasury.budget_categories SET amount = amount + $delta` for the **leaf category** (Give Butter, depth=1)
3. **UPDATE** `treasury.budget_categories SET amount = amount + $delta` for the **parent category** (Donations, depth=0)
4. **UPDATE** `treasury.budgets SET total_budget = total_budget + $delta`

The EV revenue hierarchy has depth=2 (Donations → Give Butter), so 2 category rows + 1 budget row = **3 updates total** per donation. Failing to update any of these three means the donor's contribution is invisible on-screen despite being stored as a line item. The atomic update must use `amount = amount + $delta` (not read-then-write) to be safe under concurrent webhook delivery.

## Phase 3 Technical Contract

Phase 3 must implement each of the following:

- [ ] **Schema:** Add `external_id TEXT` (nullable) to `treasury.budget_line_items`
- [ ] **Schema:** Add `source TEXT DEFAULT 'csv'` to `treasury.budget_line_items`
- [ ] **Schema:** Add unique partial index `idx_line_items_external_id_source` on `(external_id, source) WHERE external_id IS NOT NULL`
- [ ] **Schema delivery:** Apply all schema changes via Supabase SQL editor — NOT via EV-Backend GORM AutoMigrate (Go API never writes webhook rows; no need to update the Go model)
- [ ] **Postgres function:** Create `treasury.record_givebutter_donation(p_external_id, p_leaf_category_id, p_parent_category_id, p_budget_id, p_description, p_amount, p_date, p_vendor)` encapsulating dedup check + 3-row atomic update
- [ ] **Edge Function:** Call `supabase.rpc('record_givebutter_donation', {...})` — no direct table writes from TypeScript
- [ ] **loadEVFinances.js:** Set `source: 'csv'` on every line item upsert
- [ ] **loadEVFinances.js:** Modify `clearExistingBudget()` to preserve rows where `source = 'webhook'` before deleting
- [ ] **Category ID resolution:** Look up by `(budget_id, name)` — find "Donations" (depth=0) and "Give Butter" (depth=1) dynamically; UUIDs are generated at import time and are not stable constants

## Deduplication Strategy

Two-layer dedup protects against both webhook retries and CSV re-imports:

**Layer 1 — Webhook retries:** The Postgres function checks `external_id + source='webhook'` existence before insert. On conflict, the function returns immediately with no changes — idempotent no-op. The unique partial index `idx_line_items_external_id_source WHERE external_id IS NOT NULL` provides database-level enforcement as a second guard.

**Layer 2 — CSV re-imports:** `clearExistingBudget()` is modified to skip rows where `source = 'webhook'` before deleting line items. CSV line items get `source='csv'` and `external_id=NULL` on every import, so they are distinct from webhook rows and cannot conflict with the unique partial index.

## Open Questions Deferred to Phase 3

1. **GiveButter webhook payload shape** — Is the payment ID in the payload stable enough to use as `external_id`? Phase 3 research must inspect the actual GiveButter webhook documentation and confirm the field name (expected: transaction ID or payment ID).
2. **Signature verification** — Exact GiveButter signature header name and HMAC algorithm are unconfirmed. Phase 3 must read GiveButter webhook docs and verify with a test event.
3. **Amount unit** — Whether GiveButter sends amounts in cents (integer) or dollars (decimal) must be confirmed via a real $1 test donation before go-live. This affects the delta calculation in the Postgres function.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write 02-01-SUMMARY.md capturing audit findings and Phase 3 contract** — see git log
2. **Task 2: Update REQUIREMENTS.md — mark DATA-01 and DATA-02 complete** — see git log
3. **Task 3: Update STATE.md — record Phase 2 decisions and advance position** — see git log

## Files Created/Modified

- `.planning/phases/02-data-layer-audit/02-01-SUMMARY.md` — This file; canonical Phase 2 audit summary and Phase 3 contract
- `.planning/REQUIREMENTS.md` — DATA-01 and DATA-02 marked complete with inline findings
- `.planning/STATE.md` — Current position advanced to Phase 3 ready; 5 new decisions recorded

## Decisions Made

- Postgres function approach chosen over application-level multi-statement execution — Supabase JS client has no explicit transaction API; RPC is the only way to guarantee atomicity
- Schema changes via SQL editor (not GORM) — Go API does not write webhook rows, so updating the Go model adds deployment risk with no benefit
- Preserve-not-merge strategy for `clearExistingBudget` — simpler than per-row dedup during import; webhook rows are identified by `source='webhook'`

## Deviations from Plan

None — plan executed exactly as written. This was a documentation-only phase with no application code changes.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Phase 3 will require Supabase SQL editor access to apply schema changes.

## Source References

This summary distills findings from:

- `.planning/phases/02-data-layer-audit/02-RESEARCH.md` — primary research artifact with full codebase inspection notes, code excerpts, pitfall analysis, and open questions
- `src/data/dataLoader.ts` — `loadBudgetData()` and `transformAPIResponse()` — confirmed no runtime aggregation
- `src/components/CategoryList.tsx` — line 173 confirms `category.amount` read directly
- `scripts/loadEVFinances.js` — `clearExistingBudget()` risk and amount pre-aggregation at import time

## Next Phase Readiness

Phase 3 has an unambiguous technical contract. No blockers. Open questions (payload shape, signature header, amount unit) are Phase 3 research targets, not blockers to beginning Phase 3 planning.

---
*Phase: 02-data-layer-audit*
*Completed: 2026-04-21*
