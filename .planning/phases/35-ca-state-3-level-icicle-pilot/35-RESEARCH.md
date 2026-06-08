# Phase 35: CA State 3-Level Icicle Pilot — Research

**Researched:** 2026-06-08
**Domain:** Data pipeline modification (Python extractor + Node.js loader) — reshape CA state budget from 2-level to N-level tree
**Confidence:** HIGH — all key behavioral questions answered by live DB tests and direct code reads

---

## Summary

Phase 35 is a pure data-reload phase. No frontend changes, no API changes, no database schema changes are needed. The infrastructure from Phases 33 and 34 is complete and confirmed working.

The work is: (1) modify `extractCA.py` to emit the `function` column, (2) replace `buildCATree()` in `processCA.js` with a generic N-level builder that produces `DOF Agency → Department → Function` trees, (3) reload all 5 FYs via the existing `treasury_sync_budget_tree` RPC, and (4) enrich the new depth-2 (function-level) nodes using the existing `enrichCategories.js --depth 2` flag.

**Critical D-07 finding (live tested):** The RPC fully replaces existing tree data when called for a `data_source_id + fiscal_year` that already has rows. On re-call, existing depth-1 leaf nodes (old "Department" leaves) become internal nodes, their old line items are removed, and new depth-2 leaf nodes with new line items are inserted. No orphaned depth-1 nodes remain. No explicit DELETE before reload is required.

**Critical D-08 finding (live tested):** Enrichment rows are keyed by `name_key` (lowercased category name string), not by `budget_categories.id`. Existing 12 CA enrichment rows cover the 12 DOF Agency names — all will survive reload unchanged because DOF Agency names are stable string values. New depth-2 function nodes need new enrichment after reload.

**Primary recommendation:** Modify extractCA.py (add `function` field) and processCA.js (replace `buildCATree` with N-level builder + fix SUPABASE_URL fallback) in one commit, then reload all 5 FYs, then enrich depth-2 nodes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Modify `scripts/processCA.js` and `scripts/extractCA.py` in place — do not create a new file. No flag-based opt-in.
- **D-02:** The tree builder must be data-driven (N-level), not hardcoded to 3 levels. Depth is determined by how many level columns the extractor provides. For the LAO Excel: DOF Agency (col 5) → Department (col 1) → Function (col 2).
- **D-03:** `extractCA.py` must include the `function` field (col 2) in its JSON output. Currently tracked in `COLS` but excluded from `rows_out`.
- **D-04:** `processCA.js` `buildCATree()` must be replaced with a generic N-level tree builder that consumes a column list `[dof_agency, department, function]` and recurses as deep as the data has values.
- **D-05:** When `function` (col 2) is `None`, blank, or whitespace, collapse that row to the department leaf — it becomes a line item directly under the department node. Do not invent a "General" or "Other" node.
- **D-06:** Reload all 5 fiscal years (2022, 2023, 2024, 2025, 2026) — same scope as Phase 33.
- **D-07:** Use `treasury_sync_budget_tree` RPC for reload. Planner must verify upsert behavior. (ANSWERED — see D-07 findings below.)
- **D-08:** Existing enrichment rows may be orphaned after reload if node IDs change. Planner must account for this. (ANSWERED — see D-08 findings below.)
- **D-09:** Enrich the new function-level (depth-2) nodes using `scripts/enrichCategories.js` after reload.
- **D-10:** Estimate enrichment cost before running and apply the $5 API cost gate.
- **D-11:** Check whether `enrichCategories.js` handles depth-2 nodes automatically or requires a flag. (ANSWERED — see D-11 findings below.)
- **D-12:** Apply the `processCA.js` SUPABASE_URL hardcoded-fallback fix (WR-04) if not already applied.

### Claude's Discretion

None — all implementation choices are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ICICLE-01 | CA state budget loaded as a genuine 3-level tree (Program Area → Department → Budget Category) using the updated RPC | D-02/D-03/D-04: extractCA.py adds `function` column; processCA.js N-level builder produces `c→c→i` shape; RPC already accepts it (Phase 34 verified). |
| ICICLE-02 | CA state icicle chart renders 3 drill-down levels in the live app (Level 1 → Level 2 → Level 3 navigation works) | BudgetIcicle.tsx already renders arbitrary depth via `navigationPath` — no frontend changes needed. Reload satisfies this automatically. |
| ICICLE-03 | Drilling to Level 3 shows line items in `LineItemsTable` (leaf behavior identical to existing 2-level cities) | RPC confirmed: leaf nodes at depth-2 receive `i` items → stored as `budget_line_items` → returned as `lineItems` by `getBudgetById`. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extract `function` column from Excel | Scripts (Python) | — | extractCA.py already reads col 2; only rows_out dict needs updating |
| Build N-level tree JSON | Scripts (Node.js) | — | processCA.js replaces buildCATree() with generic recursive builder |
| Store 3-level tree in DB | Database / RPC | — | `treasury_sync_budget_tree` already accepts `c→c→i` (Phase 34 verified) |
| Serve 3-level tree to frontend | API / Backend | — | getBudgetById() recursive builder already handles depth-2 (Phase 34 verified) |
| Render 3-level icicle | Browser / Client | — | BudgetIcicle.tsx navigationPath already handles arbitrary depth |
| Enrich depth-2 nodes | Scripts (Node.js) | Claude API | enrichCategories.js with `--depth 2` flag |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openpyxl | installed | Read LAO .xlsx | [VERIFIED: already used since Phase 33] |
| @supabase/supabase-js | installed | Call `treasury_sync_budget_tree` RPC | [VERIFIED: project standard for all loaders] |
| Node.js built-ins (child_process, fs, path, util) | v24.13.0 | Script infrastructure | [VERIFIED: confirmed installed] |
| @anthropic-ai/sdk | installed | Enrichment via Claude Haiku | [VERIFIED: used by enrichCategories.js] |

### No New Packages Needed

Phase 35 requires zero new package installs. All tooling is already present.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All tools are carried from Phase 33.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
LAO Excel (.xlsx)
  docs/California/Historical_Expenditures.xlsx
       |
       v
extractCA.py (MODIFIED)
  - Reads Pivot Table Data sheet (unchanged)
  - Filters Fund == 'General Fund' (unchanged)
  - rows_out now includes 'function': row[COLS['function']]  ← NEW
  - Output shape: { fiscal_year, dof_agency, department, function, amount_thousands }
       |
       v (stdout JSON)
processCA.js (MODIFIED)
  - buildCATree() REPLACED with buildNLevelTree()
  - Columns list: ['dof_agency', 'department', 'function']  ← drives depth
  - D-05 null collapse: if function is null/blank → row is leaf under department
  - Sanity band $150B–$300B (unchanged)
  - SUPABASE_URL fallback hardcode REMOVED (D-12 fix)
       |
       v
treasury_sync_budget_tree RPC (UNCHANGED)
  - Accepts c→c→i shape (verified Phase 34)
  - On re-call for same data_source_id+FY: replaces tree in-place
    (old depth-1 leaf items removed; new depth-2 nodes + items inserted)
       |
       v
treasury.budget_categories (depth 0/1/2) + treasury.budget_line_items (leaf category_id)
       |
       v
enrichCategories.js (UNCHANGED)
  - node scripts/enrichCategories.js --city "California" --state CA --year 2026 --depth 2
  - entity_type='state' → uses state-level framing (already present from Phase 33)
  - Enriches new depth-2 function nodes
       |
       v
treasury.category_enrichment (name_key = "parent_name|function_name" for depth-2 rows)
```

### Recommended File Changes

```
scripts/
├── extractCA.py    MODIFY: add 'function' to rows_out dict
└── processCA.js    MODIFY: replace buildCATree() with buildNLevelTree(); fix SUPABASE_URL
```

### Pattern 1: extractCA.py — Adding function to rows_out

**What:** One-line addition to the `rows_out.append({...})` call. No structural changes.

**Current state (line 121-127):**
```python
rows_out.append({
    'fiscal_year':      fy,
    'dof_agency':       row[COLS['dof_agency']],
    'department':       row[COLS['department']],
    'amount_thousands': row[COLS['amount']],
})
```

**After change:**
```python
rows_out.append({
    'fiscal_year':      fy,
    'dof_agency':       row[COLS['dof_agency']],
    'department':       row[COLS['department']],
    'function':         row[COLS['function']],   # ← ADD THIS (col 2)
    'amount_thousands': row[COLS['amount']],
})
```

Note: `COLS['function'] = 2` is already defined. The `function` field in Excel contains values like `'Local Assistance'`, `'State Operations'`, `'Capital Outlay'` or `None`. Some rows have None/blank for function.

### Pattern 2: processCA.js — N-Level Tree Builder (replaces buildCATree)

**What:** Replace the hardcoded 2-level `buildCATree()` with a recursive N-level builder.
**D-05 handling:** When function is None/blank/whitespace, the row contributes as a line item directly under the department node (not under a synthetic child). This is the "collapse to parent leaf" behavior.

```javascript
// Source: derived from D-02/D-04/D-05 decisions + N-level tree shape from CONTEXT.md
// Replaces buildCATree() entirely

/**
 * Build an N-level tree from flat rows.
 * @param {Array} rows - flat rows from extractCA.py
 * @param {string[]} levelCols - ordered column names for each level, e.g. ['dof_agency','department','function']
 * @returns {Array} N-level tree in treasury_sync_budget_tree shape
 */
function buildNLevelTree(rows, levelCols) {
  // Recursive helper: build subtree for rows at a given level index
  function buildLevel(rows, levelIdx) {
    if (levelIdx >= levelCols.length) {
      // Leaf: return line items from rows
      return rows.map(r => ({
        d: r[levelCols[levelCols.length - 1]] || r.department || 'Unknown',
        a: (r.amount_thousands || 0) * 1000,
        aa: null, f: null, e: null
      }));
    }

    const col = levelCols[levelIdx];
    const groupMap = new Map();

    for (const row of rows) {
      const key = (row[col] || '').trim();

      // D-05: if this level's value is empty/null, collapse row to parent leaf
      if (!key) {
        const COLLAPSE_KEY = '__collapse__';
        if (!groupMap.has(COLLAPSE_KEY)) groupMap.set(COLLAPSE_KEY, { rows: [], collapse: true });
        groupMap.get(COLLAPSE_KEY).rows.push(row);
        continue;
      }

      if (!groupMap.has(key)) groupMap.set(key, { rows: [], collapse: false });
      groupMap.get(key).rows.push(row);
    }

    const nodes = [];
    let collapseItems = [];

    for (const [key, group] of groupMap) {
      if (group.collapse) {
        // Collapsed rows become line items at THIS level (not a child node)
        for (const r of group.rows) {
          collapseItems.push({
            d: r[levelCols[levelIdx - 1] >= 0 ? levelCols[levelIdx - 1] : col] || col,
            a: (r.amount_thousands || 0) * 1000,
            aa: null, f: null, e: null
          });
        }
        continue;
      }

      const amt = group.rows.reduce((s, r) => s + (r.amount_thousands || 0) * 1000, 0);

      if (levelIdx === levelCols.length - 1) {
        // Last level: leaf node with line items
        const items = group.rows.map(r => ({
          d: key,
          a: (r.amount_thousands || 0) * 1000,
          aa: null, f: null, e: null
        }));
        nodes.push({ n: key, a: amt, i: items });
      } else {
        // Internal level: recurse
        const children = buildLevel(group.rows, levelIdx + 1);

        // Determine if children are items (leaf array) or nodes (branch array)
        if (children.length === 0) continue;

        const isLeafItems = children[0].d !== undefined; // items have 'd' key
        if (isLeafItems) {
          nodes.push({ n: key, a: amt, i: children });
        } else {
          nodes.push({ n: key, a: amt, c: children });
        }
      }
    }

    nodes.sort((a, b) => b.a - a.a);

    // If we have collapse items alongside branch nodes, they become items on the parent
    // The caller handles this via the collapse pattern above
    return nodes;
  }

  return buildLevel(rows, 0);
}

// Usage — replace buildCATree(fyRows) call:
// const LEVEL_COLS = ['dof_agency', 'department', 'function'];
// const tree = buildNLevelTree(fyRows, LEVEL_COLS);
```

**Simpler alternative:** Since the exact collapse behavior is complex to implement recursively, a cleaner approach is a two-pass approach:

```javascript
// Cleaner N-level builder — two-phase approach:
// Phase 1: separate rows with full N levels from rows with only N-1 levels
// Phase 2: build tree, attaching "short" rows as items at their highest complete level

function buildNLevelTree(rows, levelCols) {
  const amtDollars = r => (r.amount_thousands || 0) * 1000;

  function recurse(rows, levelIdx) {
    const col = levelCols[levelIdx];
    const isLastLevel = levelIdx === levelCols.length - 1;

    const grouped = new Map(); // key -> { sum, rows }
    const collapseItems = []; // rows where this level's col is empty

    for (const row of rows) {
      const key = (row[col] ?? '').toString().trim();
      if (!key) {
        // D-05: collapse to parent leaf as line item
        collapseItems.push({ d: row[levelCols[levelIdx - 1]] || 'Unknown', a: amtDollars(row), aa: null, f: null, e: null });
        continue;
      }
      if (!grouped.has(key)) grouped.set(key, { sum: 0, rows: [] });
      grouped.get(key).sum += amtDollars(row);
      grouped.get(key).rows.push(row);
    }

    const nodes = [];
    for (const [key, g] of grouped) {
      if (isLastLevel) {
        const items = g.rows.map(r => ({ d: key, a: amtDollars(r), aa: null, f: null, e: null }));
        nodes.push({ n: key, a: g.sum, i: items });
      } else {
        const children = recurse(g.rows, levelIdx + 1);
        if (!children.length && !collapseItems.length) continue;
        // If all children collapsed to items, make this a leaf
        const hasNodes = children.some(c => c.c || c.i);
        if (!hasNodes) continue;
        nodes.push({ n: key, a: g.sum, c: children });
      }
    }

    // Attach collapsed items to the parent — handled by caller setting i on this node
    // In practice: dept node with some null-function rows gets { n, a, c: [...depth2s], i: [...collapseItems] }
    // But treasury_sync_budget_tree may not accept both c and i on same node.
    // Safe approach: if a dept node has collapse items, append them as a synthetic leaf:
    //   { n: "(General)", a: sum, i: collapseItems }
    // D-05 says "do not invent a 'General' node" — so collapse items fold INTO parent's i if no children,
    // or are DROPPED if the parent has children (accurate totals take priority — explained below).

    nodes.sort((a, b) => b.a - a.a);
    return nodes;
  }

  return recurse(rows, 0);
}
```

**D-05 implementation note:** The cleanest approach that respects D-05 exactly:
- If a department has ONLY null-function rows → that department becomes a leaf node with `i` (line items). It does NOT get `c` children.
- If a department has BOTH some-function rows AND null-function rows → the null-function rows become line items directly on the department node; the some-function rows become depth-2 children. The node has BOTH `c` and `i`.
- **Verify with the planner** whether the RPC accepts a node with both `c` and `i` simultaneously. The current 2-level tree never has this case. If not supported, a safe fallback is to sum null-function rows into the department's amount but omit them from line items (totals remain accurate, some detail is lost).

### Pattern 3: processCA.js — SUPABASE_URL Fix (D-12)

**Current state (line 59):**
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
```

**After fix:**
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }
```

This matches the pattern already used for `SUPABASE_KEY` on the next line (line 61 already does `process.exit(2)` on missing key).

### Anti-Patterns to Avoid

- **Hardcoding depth=3:** D-02 requires N-level. If the LAO adds a 4th column in a future update, no code change should be needed.
- **Creating a synthetic "General" or "Other" function node for null-function rows:** D-05 explicitly forbids this. Null-function rows collapse to parent leaf (department level).
- **Calling enrichCategories.js with default --depth 0:** Default is depth-0 (top-level only). To enrich the new depth-2 function nodes, use `--depth 2`.
- **Assuming enrichment is needed for DOF Agency names:** The 12 existing CA enrichments (depth-0) survive reload unchanged because enrichment is keyed by name string, not by UUID.
- **Expecting the RPC to reject re-calls:** The RPC is idempotent — it reuses the existing `budget_id` and replaces the tree in-place. No explicit DELETE is needed.

---

## Key Research Findings (Answering CONTEXT.md Questions)

### D-07: treasury_sync_budget_tree Upsert Behavior

**VERIFIED by live test (2026-06-08).**

**Behavior:** The RPC fully replaces the existing tree when called for the same `data_source_id + fiscal_year`.

Test protocol:
1. Called RPC with 2-level tree (FY=9997): created budget_id=X, 3 budget_categories (depth 0/1/1), 2 line items on depth-1 nodes.
2. Called RPC again with 3-level tree (same FY=9997, same data_source_id): returned same budget_id=X.
3. After call 2: budget had 6 budget_categories (depth 0/1/1/2/2/2) and 3 line items — all on depth-2 nodes. The original depth-1 line items were removed.

**Conclusion:** The RPC handles the 2-level → 3-level transition correctly without explicit DELETE. Old depth-1 "leaf" items are removed; depth-2 nodes are added. No orphaned rows remain.

**Action for planner:** No explicit DELETE task is needed before the 3-level reload. The RPC handles it.

### D-08: Enrichment Orphan Risk

**VERIFIED by live DB query (2026-06-08).**

**How enrichment rows are linked:** `category_enrichment` has NO FK to `budget_categories.id`. Rows are linked by `name_key` (lowercased category name string) and `municipality_id`. When a budget is reloaded, the new `budget_categories` rows get new UUIDs — but enrichment lookup uses name string matching, not UUID matching.

**Existing CA enrichments (12 rows):**
- All 12 are for the 12 DOF Agency names (depth-0: "health and human services", "k-12 education", etc.)
- These are name-keyed — e.g., `name_key = "health and human services"`
- DOF Agency names in the 3-level reload are IDENTICAL to existing 2-level names (same strings)
- **Result: All 12 existing CA enrichments survive the 3-level reload unchanged.**

**New enrichment needed after reload:**
- New depth-2 function nodes (e.g., "local assistance", "state operations" under each department)
- These have name_keys in the form `"parent_dept_name|function_name"` (based on `saveEnrichment()` code: `parent_name ? normalize(parent)+"|"+normalize(name) : normalize(name)`)
- Currently 0 enrichment rows exist for depth-2 CA nodes
- D-09 requires enriching these after reload

**Action for planner:** No enrichment cleanup task needed. Post-reload, run enrichCategories.js with `--depth 2` to add new function-level enrichments.

### D-11: enrichCategories.js Depth Targeting

**VERIFIED by code read (enrichCategories.js lines 75, 192-205).**

**The `--depth` flag already exists and works as needed:**

```javascript
// Line 75:
const DEPTH = args.depth || '0'; // '0' = top-level only (default), '1' = depth 1, 'all' = all depths

// Lines 192-205 (getBudgetCategories query):
if (DEPTH === '0') {
  query = query.is('parent_id', null);
} else if (DEPTH !== 'all') {
  query = query.eq('depth', parseInt(DEPTH));
}
// 'all' = no depth filter
```

**Behavior:**
- Default (`--depth 0`): only enriches `parent_id IS NULL` (depth-0, top-level) nodes
- `--depth 2`: enriches only `depth = 2` nodes (the new function-level nodes)
- `--depth all`: enriches everything regardless of depth

**To enrich new depth-2 nodes:** `node scripts/enrichCategories.js --city "California" --state CA --year 2026 --depth 2`

**No code changes needed to enrichCategories.js.** The `--depth 2` flag routes the query to exactly the new function-level nodes.

### D-03/D-04: extractCA.py and processCA.js Current State

**VERIFIED by code read.**

**extractCA.py:**
- `COLS['function'] = 2` is already defined (line 44)
- `rows_out.append({...})` at lines 121-127 does NOT include `'function'`
- Required change: add one line `'function': row[COLS['function']],` to the dict
- The `function` column contains values like `'Local Assistance'`, `'State Operations'`, `'Capital Outlay'`, or `None`

**processCA.js:**
- `buildCATree()` at lines 140-161 is a 2-level hardcoded builder using `dof_agency` → `department` only
- It does not read `row.function` at all
- The `extractExcel()` function (lines 96-136) and `loadFiscalYear()` (lines 196-211) are unchanged — they just need `buildCATree(fyRows)` replaced with `buildNLevelTree(fyRows, LEVEL_COLS)`

**buildCATree current line-item shape (line 154):**
```javascript
children.push({ n: dept, a: amt, i: [{ d: dept, a: amt, aa: null, f: null, e: null }] });
```
The new builder must push line items to the function-level (depth-2) leaves, not the department-level (depth-1) nodes.

### D-12: SUPABASE_URL Hardcoded Fallback

**VERIFIED by code read (processCA.js line 59).**

The fix from Phase 34 WR-04 is **NOT yet applied**. Line 59 still reads:
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
```

The fallback must be removed and replaced with a throw/exit on missing env var (consistent with the `SUPABASE_KEY` check on the next line).

### Phase 33 and 34 Completeness

**VERIFIED.**

- Phase 33: CA state seeded, 2-level tree loaded for FY2022-2026. DB confirms: 5 operating budgets, 169 categories for FY2026 (12 depth-0, 157 depth-1), 12 enrichment rows for depth-0 agency names.
- Phase 34: `treasury_sync_budget_tree` RPC confirmed to accept 3-level (`c→c→i`) trees. `getBudgetById` confirmed to return N-level trees. Both verified by live tests (treasury-3level.test.ts, all 5 tests pass).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree storage | Custom INSERT/UPDATE logic | `treasury_sync_budget_tree` RPC | RPC handles idempotency, parent_id chaining, percentages, depth assignment atomically |
| Tree serving | Custom query builder | `getBudgetById` in ev-accounts-api | Already handles N-level depth via recursive parent_id traversal |
| Frontend icicle drilling | New navigation logic | `BudgetIcicle.tsx` (no change) | `navigationPath` is already depth-agnostic |
| Enrichment pipeline | New AI pipeline | `enrichCategories.js --depth 2` | `--depth` flag already selects by depth; `entity_type='state'` prompt already present |

**Key insight:** This phase is entirely a data reshape. All infrastructure is in place. The only code work is in the two Python/Node scripts that produce the tree shape.

---

## Current Live DB State (as of 2026-06-08)

| Entity | Current State |
|--------|--------------|
| CA municipality | id=`e1007bf5-bac9-4b1c-878e-f6834885f850`, entity_type='state' |
| CA operating budgets | 5 budgets: FY2022-2026 |
| CA FY2026 categories | 169 rows: 12 depth-0, 157 depth-1 |
| CA FY2026 total | $228,365,858,000 |
| CA enrichments | 12 rows, all depth-0 DOF Agency names |
| CA data source | id=`e47a4cb5-d69f-4cf5-be10-ada8505296e3`, name='California General Fund Operating Budget' |

**After Phase 35 reload, expected state:**
- CA FY2026 categories: ~12 depth-0 + ~157 depth-1 + ~N depth-2 function nodes
- The exact count of function nodes depends on how many distinct function values exist per department (some departments may have only 1-2 function values)
- CA enrichments: 12 existing (depth-0, unchanged) + new depth-2 enrichments after enrichment step

---

## Enrichment Cost Estimate (D-10)

**Estimate:** Depth-2 function nodes in the LAO Excel are function categories within departments. The LAO Excel has 3 known function values: `Local Assistance`, `State Operations`, `Capital Outlay` (plus possibly null). Not every department has all 3. Estimated unique function nodes: ~100-200 across all departments.

- Unique function name_keys for CA: ~100-200 (many departments share the same function names, but enrichment is keyed by `parent_name|function_name` so they are unique per parent)
- At $0.0002/call via Claude Haiku: 100 × $0.0002 = **$0.02**, 200 × $0.0002 = **$0.04**
- Well under the $5 threshold — no approval needed

**Dry-run first:** Run `node scripts/enrichCategories.js --city "California" --state CA --year 2026 --depth 2 --dry-run` to confirm exact count before live run.

---

## Common Pitfalls

### Pitfall 1: Nodes with Both `c` and `i` (Mixed Branch/Leaf)

**What goes wrong:** If the N-level builder emits a department node with BOTH `c` (sub-function children) AND `i` (collapsed null-function line items), the RPC may not handle this case correctly (it was not tested with mixed nodes in Phase 34).

**Why it happens:** Some departments have rows with null `function` (collapsing to department leaf per D-05) AND rows with non-null `function` (creating depth-2 children).

**How to avoid:** Before building the mixed-node tree, verify the RPC accepts `{ n, a, c: [...], i: [...] }` via a targeted test. If the RPC rejects it, use the fallback: sum null-function rows into the department's amount but omit them as separate line items (accurate totals, slightly less granular display).

**Warning signs:** RPC returns an error or `rows_inserted: 0` for a specific department. Check that department for mixed function/null rows.

### Pitfall 2: Function Values Vary by Fiscal Year

**What goes wrong:** Depth-2 nodes have different names across FYs (e.g., "Local Assistance" in FY2025 but "Community Programs" in FY2024), causing tree inconsistency in the year selector.

**Why it happens:** Budget restructuring can rename function categories over time.

**How to avoid:** Run `extractCA.py` in dry-run mode with all 5 FYs and inspect the function column values for each year before loading. This is a discovery step, not a blocker — the N-level builder handles inconsistency gracefully (each FY tree is independent).

**Warning signs:** Year selector shows different Level 3 categories for different years — this is expected and acceptable if the data genuinely changed.

### Pitfall 3: enrichCategories.js Default Depth Enriches Wrong Nodes

**What goes wrong:** Running `enrichCategories.js --city "California" --state CA` without `--depth 2` enriches depth-0 nodes only. The new depth-2 nodes get no enrichment.

**Why it happens:** Default `DEPTH = '0'` targets `parent_id IS NULL` (top-level). The 12 existing depth-0 enrichments are already present, so the script finds nothing new to enrich and exits cleanly — giving a false impression of success.

**How to avoid:** Always specify `--depth 2` for the post-reload enrichment run. Verify by checking `SELECT count(*) FROM treasury.category_enrichment WHERE municipality_id = 'e1007bf5...' AND name_key LIKE '%|%'` — enriched depth-2 nodes have `parent|child` name_keys containing `|`.

### Pitfall 4: Tree Sanity Band Still Valid

**What goes wrong:** Expecting the total to change after reload. The sanity band check ($150B–$300B) will still pass because the 3-level tree sums to the same total as the 2-level tree — same rows, just deeper grouping.

**Why it happens:** Confusion between structural change and data change.

**How to avoid:** The sanity check is a feature, not a bug. After reload, the total should be identical to the pre-reload total. Any discrepancy means the N-level builder is double-counting or missing rows.

### Pitfall 5: Running extractCA.py Standalone Without processCA.js Context

**What goes wrong:** Running `python scripts/extractCA.py --fy 2026` from a directory other than the repo root — fails with "XLSX file not found" because `XLSX_PATH = 'docs/California/Historical_Expenditures.xlsx'` is relative.

**Why it happens:** processCA.js sets `cwd: mainRoot` when spawning Python. Running Python directly uses the shell's cwd.

**How to avoid:** Run from repo root, or use `node scripts/processCA.js --dry-run` which handles the cwd via `resolveMainRoot()`.

---

## Code Examples

### extractCA.py: After Change

```python
# Source: extractCA.py lines 121-127 (modified per D-03)
rows_out.append({
    'fiscal_year':      fy,
    'dof_agency':       row[COLS['dof_agency']],
    'department':       row[COLS['department']],
    'function':         row[COLS['function']],    # ← ADDED
    'amount_thousands': row[COLS['amount']],
})
```

### processCA.js: LEVEL_COLS and Usage

```javascript
// Source: D-02 decision — N-level, data-driven
const LEVEL_COLS = ['dof_agency', 'department', 'function'];

// Replace buildCATree(fyRows) with:
const tree = buildNLevelTree(fyRows, LEVEL_COLS);
```

### processCA.js: SUPABASE_URL Fix

```javascript
// Source: D-12 decision + WR-04 from Phase 34 code review
// BEFORE (line 59):
// const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
// AFTER:
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }
```

### Dry-Run Verification Commands

```bash
# Step 1: Verify extractor sees function column
python scripts/extractCA.py --fy 2026 --dry-run
# Should show: 219 rows, ~$228.4B total (same as Phase 33)

# Step 2: Verify tree builder produces 3-level output
node scripts/processCA.js --dry-run --fy 2026
# Should show: 12 agencies, with departments and functions listed

# Step 3: Live reload (all 5 FYs)
node scripts/processCA.js --fy 2022 --fy 2023 --fy 2024 --fy 2025 --fy 2026
# Each FY should show rows_inserted > 169 (more than the 2-level count)

# Step 4: Enrichment dry-run
node scripts/enrichCategories.js --city "California" --state CA --year 2026 --depth 2 --dry-run
# Should show N categories to enrich (N > 0)

# Step 5: Live enrichment
node scripts/enrichCategories.js --city "California" --state CA --year 2026 --depth 2
```

### Post-Reload DB Verification

```sql
-- Verify 3-level tree exists for CA FY2026
SELECT depth, count(*) as cnt
FROM treasury.budget_categories bc
JOIN treasury.budgets b ON b.id = bc.budget_id
JOIN treasury.municipalities m ON m.id = b.municipality_id
WHERE m.name = 'California' AND b.fiscal_year = 2026 AND b.dataset_type = 'operating'
GROUP BY depth ORDER BY depth;
-- Expected: depth 0 (12), depth 1 (~157), depth 2 (> 0)

-- Verify enrichment after enrichment step
SELECT count(*) FROM treasury.category_enrichment
WHERE municipality_id = 'e1007bf5-bac9-4b1c-878e-f6834885f850'
AND name_key LIKE '%|%';
-- Expected: > 0 (depth-2 enrichments have parent|child name_keys)
```

---

## State of the Art

| Old Approach (Phase 33) | New Approach (Phase 35) | Impact |
|-------------------------|-------------------------|--------|
| `extractCA.py` emits `{dof_agency, department, amount_thousands}` | Emits `{dof_agency, department, function, amount_thousands}` | Enables 3rd level |
| `buildCATree()` hardcodes 2-level Agency→Dept | `buildNLevelTree()` recurses N levels from column list | Future 4th level requires zero code changes |
| Depth-1 departments are leaf nodes with `i` | Depth-1 departments are branch nodes with `c`; depth-2 functions are new leaves with `i` | 3 icicle drill levels |
| 12 CA enrichments at depth-0 only | 12 depth-0 enrichments + new depth-2 function enrichments | Enriched descriptions at level 3 |
| SUPABASE_URL has hardcoded fallback | SUPABASE_URL throws on missing (no fallback) | Security fix: no accidental prod URL hardcode |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The LAO Excel `function` column (col 2) has distinct non-null values for a meaningful fraction of CA GF rows (not null for all rows) | D-03 finding | If nearly all rows have null function, the 3-level tree degenerates to 2-level — no visual improvement. Should be verified by dry-run inspection before loading. |
| A2 | The RPC accepts department nodes with BOTH `c` (function children) AND `i` (collapsed null-function items) on the same node | D-05 handling | If RPC rejects mixed nodes, the builder must drop null-function line items or handle them differently. Mitigation: test with a small mixed case before full reload. |
| A3 | The function values in the LAO Excel are human-readable names (not numeric codes) | Code Examples | If function values are numeric budget act codes, depth-2 enrichment descriptions would need a different context. Verify in dry-run. |

---

## Open Questions

1. **How many distinct function values exist per department in FY2026?**
   - What we know: LAO Excel has function column with values like Local Assistance, State Operations, Capital Outlay. Not every row has a non-null value.
   - What's unclear: The exact distribution (how many dept × function combos have data).
   - Recommendation: Run `python scripts/extractCA.py --fy 2026 | python -c "import json,sys,collections; rows=json.load(sys.stdin); print(collections.Counter(r['function'] for r in rows if r.get('function')).most_common(20))"` as a discovery step in Wave 0.

2. **Can the RPC accept a node with both `c` and `i` simultaneously?**
   - What we know: The RPC was tested with pure `c→c→i` trees in Phase 34. Mixed nodes were not tested.
   - What's unclear: Whether the RPC's PL/pgSQL body handles a node that has both `c` and `i` arrays.
   - Recommendation: Add a targeted test in Wave 0 (before the full reload) with a 1-agency, 1-dept, 1-null-function-item + 1-function-child tree to verify. If it fails, implement the fallback (drop null-function items from line items, add their amounts to the department total only).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | extractCA.py | confirmed | Python 3.14.0 | — |
| openpyxl | extractCA.py | confirmed | installed | — |
| Node.js | processCA.js, enrichCategories.js | confirmed | v24.13.0 | — |
| @supabase/supabase-js | processCA.js | confirmed | installed | — |
| @anthropic-ai/sdk | enrichCategories.js | confirmed | installed | — |
| SUPABASE_URL | processCA.js | confirmed | in .env | — |
| SUPABASE_SERVICE_KEY | processCA.js | confirmed | in .env | — |
| ANTHROPIC_API_KEY | enrichCategories.js | assumed | — | Stop if missing |
| docs/California/Historical_Expenditures.xlsx | extractCA.py | confirmed (Phase 33) | present | — |
| Live Supabase DB | all writes | confirmed | kxsdzaojfaibhuzmclfq | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (data loading phase — dry-run + DB verification) |
| Config file | none |
| Quick run command | `node scripts/processCA.js --dry-run --fy 2026` |
| Full suite command | `node scripts/processCA.js --dry-run` (all 5 FYs) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ICICLE-01 | CA 3-level tree loaded into DB | smoke | `SELECT depth, count(*) FROM treasury.budget_categories bc JOIN treasury.budgets b ON b.id=bc.budget_id WHERE b.fiscal_year=2026 GROUP BY depth` — must show depth=2 rows | ❌ Wave 0 SQL verification |
| ICICLE-02 | CA icicle renders 3 levels in live app | manual/e2e | Human spot-check at treasurytracker.empowered.vote/California | ❌ Manual |
| ICICLE-03 | Drilling to Level 3 shows LineItemsTable | manual/e2e | Human spot-check: click to level 3, verify table appears | ❌ Manual |

### Sampling Rate
- **Per task commit:** `node scripts/processCA.js --dry-run --fy 2026`
- **Per wave merge:** Full dry-run all 5 FYs + DB depth distribution query
- **Phase gate:** Human spot-check of live app (ICICLE-02, ICICLE-03) before VERIFICATION.md

### Wave 0 Gaps
- [ ] Discovery query: count distinct function values per dept to validate A1
- [ ] Mixed-node RPC test: verify RPC accepts `{c:[...], i:[...]}` on same node (resolves A2)
- [ ] `scripts/extractCA.py` — add `function` field to rows_out
- [ ] `scripts/processCA.js` — replace buildCATree + fix SUPABASE_URL

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Admin scripts only |
| V3 Session Management | no | No session in scripts |
| V4 Access Control | no | Service role key from .env |
| V5 Input Validation | yes | Sanity band on totals ($150B–$300B); script path hardcoded |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SUPABASE_URL hardcoded fallback exposes production URL | Information Disclosure | D-12 fix: remove fallback, throw on missing env var |
| Python shell injection via Excel path | Tampering | XLSX_PATH is hardcoded constant, not user input (T-33-07 mitigation already present) |

---

## Sources

### Primary (HIGH confidence)

- Direct code read: `C:/treasury-tracker/scripts/extractCA.py` (lines 39-50, 121-127) — COLS dict, rows_out shape
- Direct code read: `C:/treasury-tracker/scripts/processCA.js` (lines 59-62, 140-161) — SUPABASE_URL fallback, buildCATree
- Direct code read: `C:/treasury-tracker/scripts/enrichCategories.js` (lines 75, 192-205) — DEPTH flag, getBudgetCategories query
- Live DB test (2026-06-08): treasury_sync_budget_tree upsert behavior — 2-level then 3-level for same FY; confirmed in-place tree replacement
- Live DB query (2026-06-08): category_enrichment table — name_key structure, CA enrichment count (12 rows, all depth-0)
- Live DB query (2026-06-08): CA budget_categories — depth distribution (12 depth-0, 157 depth-1 for FY2026)
- `C:/treasury-tracker/.planning/phases/34-3-level-tree-infrastructure-ev-accounts-api/34-01-SUMMARY.md` — Phase 34 verification test results
- `C:/treasury-tracker/.planning/phases/34-3-level-tree-infrastructure-ev-accounts-api/34-RESEARCH.md` — RPC behavior analysis

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions D-01 through D-12 — locked implementation choices from user discussion

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- D-07 RPC upsert behavior: HIGH — live tested with sentinel FY
- D-08 enrichment survival: HIGH — live queried name_key structure
- D-11 enrichCategories depth flag: HIGH — code read confirms --depth 2 works
- D-03/D-04 script changes: HIGH — code read confirms exact change needed
- D-12 SUPABASE_URL fix: HIGH — code read confirms unfixed at line 59
- A1 function null prevalence: LOW — not measured, needs dry-run discovery
- A2 mixed node RPC support: LOW — not tested, needs targeted Wave 0 test

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (stable infrastructure; only changes if DB schema or scripts are modified)
