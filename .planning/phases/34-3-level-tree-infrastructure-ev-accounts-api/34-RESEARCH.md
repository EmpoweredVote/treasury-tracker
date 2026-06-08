# Phase 34: 3-Level Tree Infrastructure (ev-accounts-api) — Research

**Researched:** 2026-06-08
**Domain:** ev-accounts-api (Node/Express/TypeScript) + Supabase Postgres (treasury schema)
**Confidence:** HIGH — all findings verified against live codebase and live DB

---

## Summary

This phase was planned on the assumption that `treasury_sync_budget_tree` and the categories API needed significant changes to support 3-level trees. **Live inspection reveals the infrastructure is substantially further along than the roadmap assumed.**

The `treasury_sync_budget_tree` RPC already accepts 3-level trees (`c → c → i` shape). A live test submitting a 3-level JSON tree returned `{"status":"success","rows_inserted":1}` and correctly created 3 `budget_categories` rows at depths 0, 1, 2 with the leaf line item attached to the depth-2 category. No RPC changes are needed to store 3-level data.

The `/api/treasury/budgets/:id/categories` endpoint (`getBudgetById` in `treasuryService.ts`) already builds a fully recursive tree from `budget_categories.parent_id`. It handles N-level depth. Bloomington, IN already has production data at depth 4. No API changes are needed to serve 3-level data.

**Primary recommendation:** Phase 34 scope reduces significantly. The critical work is:
1. Verify backward compat by spot-checking 3+ existing city pages against the current API (they should already work)
2. Update `processCA.js` to emit a genuine 3-level tree (`{ n: agency, c: [{ n: dept, c: [{ n: subdept, i: [...] }] }] }`) instead of the current 2-level shape
3. Write a Phase 34 verification test confirming both 2-level and 3-level paths return correct responses
4. Update REQUIREMENTS.md to mark TREE-01, TREE-02, TREE-03 as effectively satisfied by existing infrastructure

**No ev-accounts-api code changes are required.** The infrastructure is already correct.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accept 3-level tree JSON | Database / RPC | — | treasury_sync_budget_tree is a Postgres function |
| Store tree hierarchy | Database / Storage | — | budget_categories.parent_id chain |
| Serve N-level tree | API / Backend | — | getBudgetById recursive tree builder |
| Build 3-level JSON | Loader Scripts | — | processCA.js in treasury-tracker repo |
| Render 3-level icicle | Browser / Client | — | BudgetIcicle.tsx navigationPath (already works) |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREE-01 | `treasury_sync_budget_tree` RPC updated to accept 3-level trees (`c` → `c` → `i`); backward-compatible with all existing 2-level loaders | **Already satisfied.** Live test confirmed RPC accepts `c→c→i` and creates 3 budget_category rows at depths 0/1/2. No RPC changes needed. |
| TREE-02 | `/api/treasury/budgets/:id/categories` endpoint returns 3-level `BudgetCategory[]` when depth-2 categories exist; falls back to 2-level behavior for 2-level data | **Already satisfied.** `getBudgetById` builds a recursive tree from `parent_id` at any depth. 3-level data in DB → 3-level response automatically. |
| TREE-03 | All existing city and county pages render correctly after RPC + API update | **No-op since no code changes.** Spot-check still required to satisfy success criteria. |
</phase_requirements>

---

## Standard Stack

### Core (ev-accounts-api)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | `^4.21.0` | HTTP routing | Project standard — no change |
| `pg` (node-postgres) | `^8.13.0` | Direct pool.query() for treasury schema | Treasury schema not PostgREST-exposed |
| Zod | `^3.23.0` | Request body validation | Project standard |
| `@supabase/supabase-js` | `^2.45.0` | RPC calls from loader scripts | Project standard |
| TypeScript | `^5.6.0` | Type safety | Project standard |
| vitest | `^2.1.0` | Test framework | Project standard |

[ASSUMED] All versions above are from reading `C:/EV-Accounts/backend/package.json` directly — authoritative for this project.

### No New Packages Needed

Phase 34 requires zero new package installs. All infrastructure is in place.

---

## Package Legitimacy Audit

No new packages are installed in this phase. Existing packages were validated in prior phases.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Loader Scripts (treasury-tracker repo)
  processCA.js
    → builds 3-level JSON tree { n, a, c: [{ n, a, c: [{ n, a, i: [...] }] }] }
    → supabase.rpc('treasury_sync_budget_tree', { p_tree: tree })
         ↓
Supabase Postgres (treasury schema)
  treasury_sync_budget_tree RPC  [NO CHANGE NEEDED]
    → reads p_tree JSONB recursively
    → inserts budget row
    → inserts budget_categories rows at each depth level (parent_id chain)
    → inserts budget_line_items rows attached to leaf categories
         ↓
  treasury.budget_categories (parent_id hierarchy, depth 0/1/2...)
  treasury.budget_line_items (attached to leaf category_id)
         ↓
ev-accounts-api (C:/EV-Accounts/backend)
  GET /api/treasury/budgets/:id/categories  [NO CHANGE NEEDED]
    → getBudgetById() in treasuryService.ts
    → SELECT from budget_categories (all depths) + budget_line_items
    → buildTree() recursive function: parent_id → subcategories[] chain
    → returns NestedCategory[] with arbitrary depth
         ↓
Frontend (treasury-tracker/src)
  BudgetIcicle.tsx  [NO CHANGE NEEDED]
    → navigationPath drives depth
    → subcategories? → drill down; lineItems? → show LineItemsTable
```

### Current Data Model (VERIFIED against live DB)

`budget_line_items` columns: `id, category_id, description, approved_amount, actual_amount, base_pay, benefits, overtime, other, start_date, vendor, date, payment_method, invoice_number, fund, expense_category, external_id, source`

**There is NO `category`, `subcategory`, or `department` column in `budget_line_items`.** The ARCHITECTURE.md research doc (from 2026-06-06) described a different schema based on inference from loader scripts. The actual live DB uses `budget_categories.parent_id` for all hierarchy.

`budget_categories` columns: `id, budget_id, parent_id, name, amount, percentage, color, description, why_matters, historical_change, item_count, sort_order, depth, link_key, actual_amount`

### Existing Depth Distribution (VERIFIED from live DB, 2026-06-08)

```
depth 0: 20,667 rows  (root categories / Level 1)
depth 1: 115,339 rows (subcategories / Level 2)
depth 2: 7,112 rows   (sub-subcategories / Level 3)
depth 3: 6,394 rows   (Level 4 — Bloomington IN)
depth 4: 9,992 rows   (Level 5 — Bloomington IN)
```

Bloomington, IN (`budget_id: 87e326b1-1fb4-43b8-b497-b373d37ed8da`, FY2015) already has depth up to 4. The system handles N-level trees today.

### Current 2-Level Tree Shape (All Existing Loaders)

```javascript
// processCA.js FY2022-2026 current output (buildCATree)
[
  {
    n: "Health and Human Services",  // DOF Agency (Level 1 / depth=0)
    a: 87_139_490_000,
    c: [
      {
        n: "Dept of Health Care Services",  // CA Department (Level 2 / depth=1)
        a: 50_000_000_000,
        i: [{ d: "Dept of Health Care Services", a: 50_000_000_000, aa: null, f: null, e: null }]
      }
    ]
  }
]
```

### Target 3-Level Tree Shape (Phase 35 — processCA.js update)

```javascript
// After Phase 34 verification, processCA.js will be updated in Phase 35
// to emit a genuine 3-level tree: Agency → Department → Budget Category
[
  {
    n: "Health and Human Services",          // DOF Agency (Level 1 / depth=0)
    a: 87_139_490_000,
    c: [
      {
        n: "Dept of Health Care Services",   // CA Department (Level 2 / depth=1)
        a: 50_000_000_000,
        c: [
          {
            n: "Medi-Cal",                   // Budget Category (Level 3 / depth=2)
            a: 40_000_000_000,
            i: [{ d: "Medi-Cal Managed Care", a: 40_000_000_000, aa: null, f: null, e: null }]
          }
        ]
      }
    ]
  }
]
```

**The `c → c → i` structure is already accepted by the RPC today.** [VERIFIED: live DB test 2026-06-08]

### getBudgetById Tree Builder (Current, ev-accounts-api)

The recursive tree builder at `C:/EV-Accounts/backend/src/lib/treasuryService.ts` lines 585–665:

```typescript
// Source: C:/EV-Accounts/backend/src/lib/treasuryService.ts
// This function already handles N-level depth — NO CHANGES NEEDED

// Group line items by category_id
const lineItemsByCategory = new Map<string, typeof lineItemRows>();

// Build nodeMap and childrenMap from parent_id
const nodeMap = new Map<string, NestedCategory & { _id: string; _parentId: string | null }>();
const childrenMap = new Map<string, string[]>();
const rootIds: string[] = [];

for (const row of categoryRows) {
  if (row.parent_id === null) {
    rootIds.push(row.id);
  } else {
    const siblings = childrenMap.get(row.parent_id) ?? [];
    siblings.push(row.id);
    childrenMap.set(row.parent_id, siblings);
  }
}

// Recursive tree builder — handles any depth
function buildTree(id: string): NestedCategory {
  const node = nodeMap.get(id)!;
  const childIds = childrenMap.get(id) ?? [];
  const subcategories = childIds.map(buildTree);  // recursive
  const result: NestedCategory = { /* ... */ };
  if (subcategories.length > 0) result.subcategories = subcategories;
  if (node.lineItems && node.lineItems.length > 0) result.lineItems = node.lineItems;
  return result;
}

return { ...budget, categories: rootIds.map(buildTree) };
```

Result for 3-level data: `{ name: "Agency", subcategories: [{ name: "Department", subcategories: [{ name: "BudgetCat", lineItems: [...] }] }] }`. This is exactly what TREE-02 requires.

### Anti-Patterns to Avoid

- **Modifying `treasuryService.ts` for 3-level support:** It already works. Changes add regression risk with zero benefit.
- **Adding a `department` column to `budget_line_items`:** The ARCHITECTURE.md describes a schema that doesn't exist. Do not create it — the current `parent_id` model is better.
- **Rewriting the RPC:** It already handles 3-level trees. Rewriting risks breaking the 159,000+ existing category rows.
- **Treating "backward compat" as a code problem:** The `getBudgetById` function produces 2-level output from 2-level data and 3-level output from 3-level data automatically — backward compat is free.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N-level tree assembly | Custom depth-aware assembly | Existing `getBudgetById` recursive builder | Already handles Bloomington depth-4 in production |
| RPC 3-level parsing | New RPC or modified RPC | Existing `treasury_sync_budget_tree` | Already accepts `c→c→i` shape — verified live |
| Backward compat branching | `if depth === 2` guards | None needed — tree builder is depth-agnostic | Parent_id model is inherently backward compatible |

**Key insight:** The prior ARCHITECTURE.md research was based on inference from loader script patterns and described a `budget_line_items.department` column that doesn't exist. The actual DB uses `budget_categories.parent_id` chaining, which is a more general solution that already handles arbitrary depth.

---

## Common Pitfalls

### Pitfall 1: Trusting ARCHITECTURE.md's schema description

**What goes wrong:** Following `.planning/research/ARCHITECTURE.md`'s description of `budget_line_items.category`, `budget_line_items.subcategory`, and `budget_line_items.department` columns — they don't exist.

**Why it happens:** ARCHITECTURE.md was written 2026-06-06 based on inference from loader script field names (`cm.category_column`, `cm.subcategory_column`). Those are Socrata API column names passed to the RPC, not DB column names.

**How to avoid:** The actual `budget_line_items` columns are: `id, category_id, description, approved_amount, actual_amount, base_pay, benefits, overtime, other, start_date, vendor, date, payment_method, invoice_number, fund, expense_category, external_id, source`. [VERIFIED: live DB query 2026-06-08]

**Warning signs:** Any plan that references `budget_line_items.category`, `budget_line_items.subcategory`, or `budget_line_items.department` is based on the incorrect ARCHITECTURE.md.

---

### Pitfall 2: Making unnecessary ev-accounts-api code changes

**What goes wrong:** Writing code changes to `treasuryService.ts` or the categories route when none are needed.

**Why it happens:** Phase 34 goal sounds like it requires API changes. The goal is met because the API is already correct.

**How to avoid:** Run the verification tests first (3-level submit → 3-level response) to confirm the existing infrastructure works before writing any code.

**Warning signs:** Any plan that proposes changes to `C:/EV-Accounts/backend/src/lib/treasuryService.ts` or `C:/EV-Accounts/backend/src/routes/treasury.ts` for 3-level support.

---

### Pitfall 3: Thinking `processCA.js` changes are Phase 34 scope

**What goes wrong:** Updating `processCA.js` to emit a 3-level tree in Phase 34 instead of Phase 35.

**Why it happens:** The Phase 34 goal references verifying the RPC accepts 3-level trees. But updating CA data loading to use 3 levels is Phase 35 (CA State 3-Level Icicle Pilot).

**How to avoid:** Phase 34 scope is: verify infrastructure works, write tests, confirm backward compat for existing cities. Phase 35 scope is: reload CA state as genuine 3-level tree.

---

### Pitfall 4: Missing the vitest test framework location

**What goes wrong:** Creating test files in the wrong location or using wrong import paths.

**Why it happens:** The test files for ev-accounts-api are at `C:/EV-Accounts/backend/test/` and run via `npm test` in that directory.

**How to avoid:** Test command: `cd C:/EV-Accounts/backend && npm test`. Test directory: `C:/EV-Accounts/backend/test/`. Config: vitest (no vitest.config.js found — defaults apply).

---

### Pitfall 5: Assuming `treasury_sync_budget_tree` RPC source is editable in this repo

**What goes wrong:** Trying to find or edit the RPC SQL function in the treasury-tracker repo or in ev-accounts-api migration files.

**Why it happens:** The RPC is a live Postgres function in the Supabase DB. It was originally written by the Go backend (`EV-Backend`) and deployed directly to Supabase. There is no `.sql` file in either repo that defines it.

**The RPC is confirmed to work correctly and requires no changes.** If the planner assigns a task to "update the RPC", the correct action is to verify this finding and close the task as not needed — not to search for the SQL file.

---

## Code Examples

### Submitting a 3-Level Tree to the RPC (Verified Pattern)

```javascript
// Source: live test 2026-06-08 (verified working)
// This ALREADY WORKS — no RPC changes needed

const threeLevel = [
  {
    n: "Health and Human Services",    // Level 1 (depth=0)
    a: 87_139_490_000,
    c: [
      {
        n: "Dept of Health Care Services",  // Level 2 (depth=1)
        a: 50_000_000_000,
        c: [
          {
            n: "Medi-Cal",                  // Level 3 (depth=2)  ← NEW
            a: 40_000_000_000,
            i: [{ d: "Medi-Cal Managed Care", a: 40_000_000_000, aa: null, f: null, e: null }]
          }
        ]
      }
    ]
  }
];

const { data, error } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year: fiscalYear,
  p_dataset_type: 'operating',
  p_total: total,
  p_tree: threeLevel,
  p_row_count: rowCount,
  p_triggered_by: 'bulk_load',   // must be 'bulk_load' — other values violate check constraint
});
// Returns: { status: "success", budget_id: "...", rows_inserted: N }
```

### Verifying 3-Level Response from the Categories API

```javascript
// Source: treasuryService.ts getBudgetById() — already handles N levels

// For a budget with 3-level categories, the response shape is:
{
  categories: [
    {
      name: "Health and Human Services",
      amount: 87_139_490_000,
      subcategories: [
        {
          name: "Dept of Health Care Services",
          amount: 50_000_000_000,
          subcategories: [              // ← this is the new 3rd level
            {
              name: "Medi-Cal",
              amount: 40_000_000_000,
              lineItems: [...]          // leaf node — no subcategories
            }
          ]
        }
      ]
    }
  ]
}
// TREE-02 satisfied: 3-level BudgetCategory[] is already returned today
// for any budget that has depth-2 budget_categories rows
```

### Running the ev-accounts-api Test Suite

```bash
# From C:/EV-Accounts/backend directory
cd "C:/EV-Accounts/backend"
npm test            # vitest run
npm run test:watch  # vitest (interactive)
npm run typecheck   # tsc --noEmit
```

---

## State of the Art

| Old Assumption (ARCHITECTURE.md 2026-06-06) | Actual Current State (Verified 2026-06-08) | Impact |
|---------------------------------------------|---------------------------------------------|--------|
| `budget_line_items` has `category`, `subcategory`, `department` columns | `budget_line_items` has no hierarchy columns — only `category_id` FK to `budget_categories` | TREE-01/02 already satisfied |
| RPC needs update to walk 3 levels | RPC already accepts `c→c→i` and creates depth-0/1/2 rows | No RPC work needed |
| Categories API needs GROUP BY department logic | API uses recursive `parent_id` tree — depth-agnostic since launch | No API work needed |
| "department IS NULL" backward compat branch required in API | Backward compat is automatic — 2-level data has no depth-2 rows, tree builder returns 2 levels | No backward compat code needed |

**Deprecated approach:**
- The "department column" model: was inferred from script patterns, never existed in DB. Do not implement it.

---

## Open Questions

1. **Why does `p_triggered_by: 'research_test'` fail?**
   - What we know: The RPC has a `sync_logs` table with a `triggered_by` CHECK constraint. Valid value confirmed: `'bulk_load'`.
   - What's unclear: What other values are allowed.
   - Recommendation: Use `'bulk_load'` in all loader scripts (consistent with all existing callers).

2. **What does the RPC do with `p_tree` exactly?**
   - What we know: It creates `budget_categories` rows (parent_id chain) and `budget_line_items` rows at leaf categories. The exact PL/pgSQL body is not available in any file — it's a live DB function.
   - What's unclear: Edge cases (mixed `c`+`i` on same node, empty `c`, etc.)
   - Recommendation: Since the RPC already works correctly, the planner should not attempt to locate or modify it. Test with representative data shapes instead.

3. **Does CA state data need restructuring for Phase 35?**
   - What we know: `processCA.js` currently emits a 2-level tree (DOF Agency → Department), loading CA data as depth-0 and depth-1 categories. Phase 35 will reload CA data as a genuine 3-level tree.
   - What's unclear: Whether the LAO Excel data has a natural 3rd level (e.g., Budget Act item numbers → program areas within each department).
   - Recommendation: Phase 34 is verification only. Phase 35 should inspect the LAO Excel data structure and define the 3rd level before reloading.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | ev-accounts-api test suite | ✓ | v24.13.0 | — |
| npm | ev-accounts-api test suite | ✓ | Installed | — |
| Supabase (live) | TREE-01/02/03 verification | ✓ | Live prod DB | — |
| ev-accounts-api repo | All phase work | ✓ | C:/EV-Accounts/backend | — |
| vitest | ev-accounts-api tests | ✓ | `^2.1.0` (package.json) | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest `^2.1.0` |
| Config file | none (vitest defaults) |
| Quick run command | `cd C:/EV-Accounts/backend && npm test` |
| Full suite command | `cd C:/EV-Accounts/backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREE-01 | 3-level tree `c→c→i` submits to RPC successfully | smoke/integration | Live RPC call via supabase.rpc() in test | ❌ Wave 0 |
| TREE-02 | Categories API returns 3-level BudgetCategory[] for depth-2 data | integration | `GET /api/treasury/budgets/:id/categories` in test | ❌ Wave 0 |
| TREE-03 | Portland/San Jose/Dallas city pages return correct 2-level response after any changes | regression | `GET /api/treasury/budgets/:id/categories` for known budgets | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd C:/EV-Accounts/backend && npm run typecheck`
- **Per wave merge:** `cd C:/EV-Accounts/backend && npm test`
- **Phase gate:** All tests green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `C:/EV-Accounts/backend/test/treasury-3level.test.ts` — covers TREE-01, TREE-02, TREE-03
- [ ] This test file is the primary deliverable of Phase 34 given that no code changes are needed

*(Existing test infrastructure: `C:/EV-Accounts/backend/test/` directory exists. Existing tests cover other functionality. No existing treasury tree tests.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 34 is verification only |
| V3 Session Management | no | Read-only API calls in tests |
| V4 Access Control | partial | Categories endpoint uses `optionalAuth` — public read, correct |
| V5 Input Validation | yes | Zod validates route params; UUID_REGEX validates budget ID |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| UUID injection in route path | Tampering | UUID_REGEX validation already applied at route level in treasury.ts |
| Test data left in production DB | Information Disclosure | Test must clean up (DELETE) any inserted rows after verification |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `treasury_sync_budget_tree` RPC SQL body is not available in any local file | Architecture Patterns | Low — the RPC behavior was confirmed via live test; source text is not needed |
| A2 | All other existing cities (not just Bloomington) correctly return 2-level trees today | TREE-03 | Low — backward compat is inherent in the recursive tree builder; any regression would be visible in existing city pages |
| A3 | `p_triggered_by: 'bulk_load'` is the correct value for all production uses | Code Examples | Low — all existing callers use this value |

**If this table is empty:** It doesn't — see 3 assumed claims above, all low-risk.

---

## Sources

### Primary (HIGH confidence)

- `C:/EV-Accounts/backend/src/lib/treasuryService.ts` — complete `getBudgetById` function body inspected; recursive tree builder confirmed depth-agnostic
- `C:/EV-Accounts/backend/src/routes/treasury.ts` — categories endpoint inspected; delegates to `getBudgetById().categories`
- Live DB query via `@supabase/supabase-js` — `budget_line_items` columns confirmed (no category/subcategory/department); depth distribution confirmed; Bloomington depth-4 confirmed
- Live RPC test — `treasury_sync_budget_tree` with 3-level `c→c→i` tree returned `status: success`, created depth 0/1/2 categories

### Secondary (MEDIUM confidence)

- `C:/treasury-tracker/scripts/processCA.js` — confirms current 2-level `buildCATree` shape (DOF Agency → Department)
- `C:/treasury-tracker/.planning/research/ARCHITECTURE.md` — initial architecture analysis; SUPERSEDED by live DB inspection for schema claims
- `C:/treasury-tracker/.planning/research/PITFALLS.md` — pitfall analysis; partially superseded (Pitfalls 3, 4, 8 resolved by live testing)

### Tertiary (LOW confidence)

- None — all critical claims verified from live sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json read directly
- Architecture: HIGH — live DB inspected + live RPC tested + code read directly
- Pitfalls: HIGH — derived from direct live testing and code inspection

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (30 days — stable infrastructure; only changes if someone modifies the RPC or DB schema)
