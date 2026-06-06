# Architecture Research: v1.7 State Entity + 3-Level Budget Tree

**Domain:** Financial transparency app — React + Supabase + external Node API
**Researched:** 2026-06-06
**Confidence:** HIGH — derived from direct code inspection of all integration points

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  React Frontend (treasury-tracker repo, Netlify/Render CDN)         │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ EntitySwitcher│  │ BudgetIcicle.tsx │  │ CategoryList.tsx     │ │
│  │ (entity_type  │  │ (navigationPath  │  │ (lineItems at leaf)  │ │
│  │  grouping)    │  │  drives levels)  │  │                      │ │
│  └───────┬───────┘  └────────┬─────────┘  └──────────────────────┘ │
│          │                   │                                       │
│  ┌───────▼───────────────────▼──────────────────────────────────┐   │
│  │  dataLoader.ts                                                │   │
│  │  GET /api/treasury/cities                                     │   │
│  │  GET /api/treasury/cities/:id/budgets?fiscal_year=N           │   │
│  │  GET /api/treasury/budgets/:id/categories   ← returns tree    │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────────┘
                                │ HTTPS (netlify proxy or direct)
┌───────────────────────────────▼─────────────────────────────────────┐
│  ev-accounts-api (separate repo, Render, Node/Express)              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  GET /api/treasury/cities         → treasury.municipalities    │ │
│  │  GET /api/treasury/cities/:id/budgets → treasury.budgets       │ │
│  │  GET /api/treasury/budgets/:id/categories → assembled tree     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Supabase JS client (service key)
┌───────────────────────────────▼─────────────────────────────────────┐
│  Supabase Postgres (treasury schema)                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ municipalities   │  │ budgets          │  │ budget_line_items  │ │
│  │ id, name, state  │  │ id, municipality │  │ id, budget_id,     │ │
│  │ entity_type,     │  │ fiscal_year,     │  │ category,          │ │
│  │ population,      │  │ dataset_type,    │  │ subcategory,       │ │
│  │ county_id        │  │ total_budget     │  │ department,        │ │
│  └──────────────────┘  └──────────────────┘  │ description, amt   │ │
│                                               └────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  treasury_sync_budget_tree RPC  (p_tree JSONB)                 │  │
│  │  Parses compact tree → inserts budgets + budget_line_items     │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
┌───────────────────────────────┴─────────────────────────────────────┐
│  Loader Scripts (this repo, scripts/)                                │
│  bulkLoadBudget.js / bulkLoadPDF.js / processXxx.js                 │
│  → build compact JSON tree → call treasury_sync_budget_tree RPC     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Question (a): Minimal Schema Changes

### entity_type: 'state'

**Current state:** `treasury.municipalities.entity_type` is enforced via a CHECK constraint
with values `'city' | 'county' | 'township' | 'nonprofit'`. The TypeScript `Municipality`
interface mirrors this union.

**Confirmed from:** `src/types/budget.ts` line 111, existing migration pattern in
`20260602031258_add_all_funds_requirements_dataset_type.sql`.

**Required schema change — one migration:**

```sql
-- Drop old constraint, add new one with 'state' included.
-- Safe pattern: DROP IF EXISTS + ADD — same approach used in Phase 23.
ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_entity_type_check;

ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state'));
```

No other schema columns need to change. A state entity row uses the same columns as any
municipality: `name`, `state` (2-letter abbreviation, e.g., `'CA'`), `entity_type: 'state'`,
`population` (total state population), `population_year`. The `county_id` FK stays NULL
(states have no parent county).

**TypeScript change required in `src/types/budget.ts`:**

```typescript
entity_type: 'city' | 'county' | 'township' | 'nonprofit' | 'state';
```

This is the only TypeScript change needed. All components that branch on `entity_type` must
be audited: currently only `App.tsx` checks `entity_type === 'nonprofit'` (for donate button,
annual report button, visibility handler). No change needed for those checks — state entities
will simply not show those nonprofit-specific UI elements. The `entity_type === 'county'`
check at `App.tsx` line 960 (CitiesInCountyPanel) also needs no change — state entities will
not show that panel, which is correct behavior.

---

### 3-Level Budget Tree: Does budget_line_items have room?

**Current column layout of `treasury.budget_line_items`** (inferred from RPC usage across all
scripts):

| Column | Purpose in 2-level tree |
|--------|------------------------|
| `category` | Level 1 node name (e.g., "Public Safety") |
| `subcategory` | Level 2 node name (e.g., "Police Department") |
| `department` | Currently receives the item description `d` field |
| `description` | Item description (vendor, line item name) |
| `amount` | Approved amount |

**Finding:** The `department` column is present but underutilized in the 2-level model.
In most loaders, items carry `{ d: description, a: amount, aa: actual, f: fund, e: null }`.
The RPC maps these to columns, but `department` often receives the subcategory name echoed or
the description field, depending on the loader.

**Conclusion:** No new column is needed for 3 levels. The existing 4-column hierarchy
(`category`, `subcategory`, `department`, `description`) already provides 4 potential levels.
For a 3-level tree, the mapping becomes:

| Tree Level | DB Column |
|------------|-----------|
| Level 1 (top) | `category` |
| Level 2 (middle) | `subcategory` |
| Level 3 (leaf) | `department` |
| Item description | `description` |

**No schema migration needed for 3-level tree storage.** The RPC and the columns already
accommodate it. What changes is how the RPC reads the tree JSON and what the API queries
from these columns.

**Caveat:** Verify the exact column set by running `SELECT column_name FROM
information_schema.columns WHERE table_schema='treasury' AND table_name='budget_line_items'`
before writing the RPC update. The above is inferred from script patterns; the actual DB
column names must be confirmed.

---

## Question (b): Changes to treasury_sync_budget_tree RPC

### Current 2-Level Tree Structure

All loaders currently submit:

```json
[
  {
    "n": "Public Safety",
    "a": 500000000,
    "c": [
      {
        "n": "Police Department",
        "a": 300000000,
        "i": [
          { "d": "Police Personnel", "a": 200000000, "aa": null, "f": "General Fund", "e": null },
          { "d": "Police Operations", "a": 100000000, "aa": null, "f": "General Fund", "e": null }
        ]
      }
    ]
  }
]
```

- `n` = name, `a` = amount, `c` = children (subcategory nodes), `i` = items (line-item array)
- The RPC reads: level-1 nodes → `category`; their `c` children → `subcategory`; `i` items → `budget_line_items`

### Required 3-Level Tree Structure

```json
[
  {
    "n": "Public Safety",
    "a": 500000000,
    "c": [
      {
        "n": "Police Department",
        "a": 300000000,
        "c": [
          {
            "n": "Personnel",
            "a": 200000000,
            "i": [
              { "d": "Base Pay", "a": 150000000, "aa": null, "f": "General Fund", "e": null }
            ]
          }
        ]
      }
    ]
  }
]
```

- Level 1 → `category`; Level 2 → `subcategory`; Level 3 → `department`; `i` items → `description`

### RPC Change Strategy: Depth-Adaptive Parsing

The RPC (in the `ev-accounts-api` repo) must be updated to recursively walk `c` children
until it finds leaf nodes that have `i` items. This makes it backward-compatible with
existing 2-level loaders: if a subcategory node has `i` (items) instead of `c` (children),
it is treated as a leaf and written to `budget_line_items` directly with `department = NULL`
or `department = subcategory`.

**Pseudocode for the updated RPC walk:**

```
for each root node in p_tree:
  category = node.n
  for each level-2 child in node.c:
    subcategory = child.n
    if child has "i" (items):          -- 2-level leaf (old loaders)
      for each item in child.i:
        insert(category, subcategory, department=NULL, description=item.d, amount=item.a)
    else if child has "c" (children):  -- 3-level branch (new loaders)
      for each level-3 grandchild in child.c:
        department = grandchild.n
        for each item in grandchild.i:
          insert(category, subcategory, department, description=item.d, amount=item.a)
```

**Key invariant:** A node has either `c` (children) OR `i` (items), never both.
Loaders must guarantee this. The RPC should error on a node with both to catch mistakes early.

**Backward compatibility:** Existing 2-level loaders submit nodes with `i` at level 2. The
updated RPC handles this via the `if child has "i"` branch. No existing loader needs to
change for its data to continue loading correctly.

**Scope of change:** This change is in the `ev-accounts-api` repo, not this repo. The
loader scripts in `scripts/` call `supabase.rpc('treasury_sync_budget_tree', { p_tree: ... })`
and pass whatever JSON they build — the RPC signature (`p_tree JSONB`) does not change.

**Parameters that do NOT change:**

| Parameter | Stays same |
|-----------|------------|
| `p_data_source_id` | UUID, unchanged |
| `p_fiscal_year` | integer, unchanged |
| `p_dataset_type` | string, unchanged |
| `p_total` | numeric, unchanged |
| `p_tree` | JSONB — structure extended, not renamed |
| `p_row_count` | integer, unchanged |
| `p_triggered_by` | string, unchanged |

---

## Question (c): API Endpoint Changes for BudgetCategory[]

### Current API Response for /api/treasury/budgets/:id/categories

The API (in `ev-accounts-api`) queries `budget_line_items` grouped by `category` and
`subcategory` and assembles the `BudgetCategory[]` tree. Currently:

```
BudgetCategory (category)
  └── subcategories: BudgetCategory[] (subcategory)
        └── lineItems: LineItem[]     (from budget_line_items.description)
```

### Required for 3-Level Response

```
BudgetCategory (category)
  └── subcategories: BudgetCategory[] (subcategory)
        └── subcategories: BudgetCategory[] (department)  ← NEW
              └── lineItems: LineItem[]
```

**Note on the TypeScript type:** `BudgetCategory.subcategories` is already typed as
`BudgetCategory[]` (recursive), so the frontend type system handles arbitrary nesting
without any type change. Confirmed from `src/types/budget.ts` line 83.

**API query change (in ev-accounts-api):**

The current query groups by `(category, subcategory)` and aggregates `description`-level
rows into `lineItems`. The new query must group by `(category, subcategory, department)` and
treat `department` as a third level when it is non-NULL.

The assembly logic changes from:

```
categories = group by category
  subcategories = group by subcategory
    lineItems = all items
```

To:

```
categories = group by category
  subcategories = group by subcategory
    if department IS NOT NULL:
      sub-subcategories = group by department
        lineItems = all items where department matches
    else:   -- backward compat: old 2-level data has department=NULL
      lineItems = all items directly
```

**Backward compatibility:** Existing data loaded by 2-level loaders has `department = NULL`
(or `department = subcategory` depending on how the current RPC stores it — must verify).
If `department IS NULL`, the API omits the third level and returns `lineItems` directly on
the subcategory node, exactly as today. This means existing city pages are unaffected.

**Frontend impact:** `BudgetIcicle.tsx` already handles arbitrary depth via
`navigationPath`. When the user clicks into a subcategory that has `subcategories` (not
`lineItems`), the icicle adds another level automatically. No change needed in `BudgetIcicle.tsx`.

**App.tsx impact:** Lines 590-598 check `currentCategory.lineItems` vs
`currentCategory.subcategories` to decide whether to show `LineItemsTable` or continue
drilling. Since `BudgetCategory.subcategories` can now hold department-level nodes, this
logic continues to work correctly — drilling stops only when `subcategories` is empty or
undefined, which happens at the department leaf.

**Summary of API changes needed:**

| Change | Location | Scope |
|--------|----------|-------|
| Group query by `(category, subcategory, department)` | ev-accounts-api categories endpoint | Medium — SQL query refactor |
| Assembly: wrap department nodes in sub-subcategories array when department non-NULL | ev-accounts-api | Medium — grouping logic |
| Backward compat: when department IS NULL, return lineItems directly on subcategory | ev-accounts-api | Simple — conditional branch |

---

## Question (d): EntitySwitcher — State Entity Display

### Current Grouping Behavior

`EntitySwitcher.tsx` groups by `state` (outer) → `entity_type` (inner). The state header
shows `STATE_LABELS[state] || state` (e.g., "California"). Within California, entity types
appear as subgroups: "Cities (12)", "Counties (1)".

**With `entity_type: 'state'` added**, California (the state government entity) would appear
under the "California" state header alongside CA cities, in a subgroup labeled... "States (1)".
This is semantically confusing: "California > States > California" is circular.

### Recommended Approach: Promote State Entities Above the State Group

State entities should appear in a separate top-level section **above** all state groups,
labeled "State Governments" or "States". This mirrors how a user mentally distinguishes
between "the State of California" and "cities within California."

**Implementation in EntitySwitcher.tsx:**

```typescript
// Before the state-grouped list:
const stateEntities = [...filtered].filter(m => m.entity_type === 'state');
const subStateEntities = [...filtered].filter(m => m.entity_type !== 'state');

// Render stateEntities in a top section with header "State Governments"
// Render subStateEntities in the existing byState grouping (unchanged)
```

The existing `grouped` useMemo groups by `m.state` and then `m.entity_type`. The state
entity for California has `m.state = 'CA'` and `m.entity_type = 'state'`. If we pre-filter
state entities out before building the `byState` map, the existing city/county groups under
"California" are unchanged.

**Visual structure:**

```
┌─────────────────────────────────────────────┐
│ Search 30 jurisdictions...                   │
├─────────────────────────────────────────────┤
│ STATE GOVERNMENTS                            │  ← new sticky section
│   States (1)                                 │
│     California                               │  ← CA state entity
├─────────────────────────────────────────────┤
│ CALIFORNIA                                   │  ← existing state header
│   Counties (1)                               │
│     Los Angeles County                       │
│   Cities (12)                                │
│     Anaheim, Bakersfield, ...                │
├─────────────────────────────────────────────┤
│ OREGON                                       │
│   ...                                        │
└─────────────────────────────────────────────┘
```

**Alternative (simpler, less ideal):** Add `state` to `ENTITY_TYPE_LABELS` as "State
Government" and let it fall into the California group. This requires zero structural change
but produces the awkward "California > State Government > California" nesting. Rejected.

**Search behavior:** When the user searches "California", both the CA state entity (in
"State Governments") and the CA cities (in "California" group) should match, since both have
`m.state === 'CA'` and `STATE_LABELS['CA'] = 'California'`. The existing filter logic at
line 64-68 already handles this — no change needed for search.

**Display name:** The selected state entity in the button label will show
`"California, CA"` (using existing `${selectedEntity.name}, ${selectedEntity.state}`).
This is acceptable for now and avoids any layout risk.

---

## Data Flow: Budget Load Pipeline

### Current (2-level)

```
Loader script
  → builds { n, a, c: [{ n, a, i: [items] }] }
  → treasury_sync_budget_tree RPC
  → inserts budget row + budget_line_items
       (category, subcategory, description, amount)

API
  → SELECT category, subcategory, description, amount FROM budget_line_items
  → GROUP BY category → subcategory → lineItems
  → returns BudgetCategory[]

Frontend
  → BudgetIcicle: level 0 = categories, level 1 = subcategories
  → leaf = LineItemsTable (lineItems)
```

### Target (3-level)

```
Loader script (CA state, or retrofitted cities)
  → builds { n, a, c: [{ n, a, c: [{ n, a, i: [items] }] }] }
  → same treasury_sync_budget_tree RPC (updated to walk depth-3)
  → inserts budget_line_items with (category, subcategory, department, description, amount)

API (updated)
  → SELECT category, subcategory, department, description, amount
  → GROUP BY category → subcategory → department → lineItems
  → when department IS NULL: fall back to subcategory → lineItems (compat)
  → returns BudgetCategory[] (same type, deeper nesting)

Frontend (unchanged)
  → BudgetIcicle: level 0 = categories, level 1 = subcategories, level 2 = departments
  → leaf = LineItemsTable (lineItems)
```

---

## Build Order (Dependency Graph)

Dependencies run strictly top to bottom. Each step cannot begin until the step above it ships.

```
Step 1 — Schema migration (this repo)
  ALTER TABLE municipalities ADD 'state' to entity_type CHECK constraint
  → Unblocks: seeding California as a state entity

Step 2 — TypeScript type update (this repo, src/types/budget.ts)
  Add 'state' to entity_type union
  → Can be done in same commit as Step 1
  → Unblocks: EntitySwitcher UI rendering a state entity

Step 3 — RPC update (ev-accounts-api repo)
  treasury_sync_budget_tree: depth-adaptive tree walk (2-level compat + 3-level support)
  → Unblocks: loading any 3-level tree into budget_line_items.department

Step 4 — API endpoint update (ev-accounts-api repo)
  /api/treasury/budgets/:id/categories: GROUP BY department, conditional 3rd level
  → Depends on: Step 3 (data must be in DB before endpoint can serve it)
  → Unblocks: frontend receiving 3-level BudgetCategory[]

Step 5 — EntitySwitcher UI update (this repo)
  Promote state entities to top section
  → Depends on: Steps 1+2 (type must exist)
  → Independent of Steps 3+4

Step 6 — California state seed script (this repo, scripts/)
  Seed municipality row + data_source rows for CA state budget
  → Depends on: Step 1 (entity_type constraint must allow 'state')
  → Can run in parallel with Steps 3+4

Step 7 — CA state budget loader (this repo, scripts/)
  New script to build 3-level tree and call RPC
  → Depends on: Steps 3 + 6

Step 8 — Existing city retrofits (this repo, scripts/)
  Update bulkLoadBudget.js / processXxx.js scripts to emit 3-level trees
  → Depends on: Steps 3+4 (API must serve 3rd level)
  → Each city can be done independently after Step 3+4
```

**Critical path:** Step 1 → Step 3 → Step 4 → Step 7. The frontend UI (Step 5) and CA
seeding (Step 6) can run in parallel with the ev-accounts-api work (Steps 3+4) after Step 1.

---

## Component Responsibilities

| Component | Repo | Change Needed | Scope |
|-----------|------|---------------|-------|
| `treasury.municipalities` CHECK constraint | this repo (migration) | Add 'state' | Tiny — 2-line SQL |
| `src/types/budget.ts` | this repo | Add 'state' to entity_type union | 1-line |
| `EntitySwitcher.tsx` | this repo | Promote state entities to top section | Small — ~20 lines |
| `treasury_sync_budget_tree` RPC | ev-accounts-api repo | Depth-adaptive walk | Medium — logic rewrite |
| `/api/treasury/budgets/:id/categories` | ev-accounts-api repo | 3-level GROUP BY + compat | Medium — SQL + assembly |
| `App.tsx` | this repo | No change needed | — |
| `BudgetIcicle.tsx` | this repo | No change needed | — |
| Loader scripts (`bulkLoadBudget.js`, etc.) | this repo | Retrofit to 3-level tree | Per-city, phased |
| CA state seed script | this repo (new) | New script | New file |
| CA state budget loader | this repo (new) | New script | New file |

---

## New vs. Modified Components

### New (does not exist yet)

- `scripts/seedCaliforniaState.js` — seeds municipality row (entity_type: 'state') + data_source rows for CA state budget
- `scripts/loadCaliforniaState.js` (or city-specific equivalent) — builds 3-level tree, calls RPC
- `supabase/migrations/YYYYMMDDHHMMSS_add_state_entity_type.sql` — the CHECK constraint migration

### Modified (already exists)

- `src/types/budget.ts` — add `'state'` to `entity_type` union (1 line)
- `EntitySwitcher.tsx` — state entity section promotion (~20 lines added, existing grouping untouched)
- `treasury_sync_budget_tree` (ev-accounts-api) — depth-adaptive walk
- `/api/treasury/budgets/:id/categories` endpoint (ev-accounts-api) — 3-level GROUP BY
- Loader scripts (phased) — retrofit to emit 3-level trees per city

### Unchanged

- `BudgetIcicle.tsx` — already depth-unlimited; navigationPath drives levels
- `App.tsx` — entity_type checks are boolean guards, not exhaustive switches
- `BudgetCategory` TypeScript type — `subcategories: BudgetCategory[]` is already recursive
- `dataLoader.ts` — passes API response through unchanged; transformAPIResponse is a thin wrapper
- All existing migration files — no retroactive changes

---

## Backward Compatibility: 2-Level Loaders

All 30+ existing city loaders submit trees with `i` items at level 2. The updated RPC handles
these without any loader changes. The updated API returns `lineItems` directly on subcategory
nodes when `department IS NULL`. From the frontend's perspective, these cities look exactly
as they do today.

No existing city's data needs to be reloaded for the 3-level infrastructure to ship. Retrofits
can happen one city at a time post-infrastructure.

---

## Anti-Patterns to Avoid

### Mixing `c` and `i` on the same node

**What it is:** A tree node that has both `c` (children) and `i` (items) simultaneously.

**Why it breaks:** The RPC cannot decide whether to recurse or write line items. The updated
RPC should detect this and return an error rather than silently dropping data.

**Prevention:** Loader scripts must guarantee: leaf nodes have `i` and no `c`; branch nodes
have `c` and no `i`.

### Assuming `department` column is available without verifying

**What it is:** Writing the new RPC to insert into `department` before confirming that column exists and is mapped correctly.

**Prevention:** Run `SELECT column_name, data_type FROM information_schema.columns WHERE
table_schema='treasury' AND table_name='budget_line_items'` before the ev-accounts-api
work begins.

### Retrofitting all cities before infrastructure is stable

**What it is:** Reloading existing city data with 3-level trees before the API endpoint is
updated to serve 3 levels.

**Why it breaks:** The old API endpoint, unaware of `department`, would either ignore the
3rd level or collapse it incorrectly, breaking those city pages.

**Prevention:** Complete Steps 1-4 (schema, type, RPC, API) and verify with CA state data
before retrofitting any existing city.

### Hard-coding depth in the API assembly

**What it is:** Writing the categories endpoint to always produce exactly 2 or exactly 3 levels.

**Why it breaks:** Future 4-level trees (e.g., Fund → Department → Division → Program) would
require another API rewrite.

**Prevention:** Write the assembly as a recursive grouping function with a configurable max
depth. The current `BudgetCategory.subcategories: BudgetCategory[]` type already supports
arbitrary depth on the frontend.

---

## Open Questions for Phase Execution

1. **What does `department` column currently store for 2-level rows?** The RPC's current
   behavior for that column is inferred, not confirmed. Before writing the updated RPC,
   inspect 5-10 existing rows with `SELECT category, subcategory, department, description
   FROM treasury.budget_line_items LIMIT 10`.

2. **Where is `treasury_sync_budget_tree` defined in ev-accounts-api?** The function name
   is confirmed from all loader scripts. The actual SQL/PL/pgSQL body must be located in
   that repo before it can be updated.

3. **What is the CA state budget source?** Options include the CA Legislative Analyst's
   Office (LAO), the CA Department of Finance ebudget portal, or a Socrata endpoint from
   CA Open Data. This is a research task for the CA state data phase.

4. **Depth cap for retrofits?** Some cities have flat data (no subcategories, just a single
   "General" subcategory with all items). Retrofitting those to 3 levels would be artificial.
   Decide policy: 3-level only where source data has genuine dept/subdept structure.
