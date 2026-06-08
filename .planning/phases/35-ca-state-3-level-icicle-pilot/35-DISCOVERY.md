# Phase 35: CA State 3-Level Icicle Pilot — Discovery

**Produced by:** Plan 01 — Resolve Assumptions A1 and A2
**Date:** 2026-06-08
**Purpose:** De-risk Plan 02 by verifying the two unresolved assumptions (A1 and A2) from RESEARCH.md before any code changes are made.

---

## A1 — Function Distribution (FY2026)

**Method:** One-off read-only Python script using openpyxl with `read_only=True, data_only=True`, opening `docs/California/Historical_Expenditures.xlsx`, sheet `Pivot Table Data`. Filtered `Fund == 'General Fund'` and non-null amount for fiscal year string ending `-26` (FY2026). Counted distinct function values (col 2).

**Results:**

| Metric | Value |
|--------|-------|
| Total GF FY2026 rows | 219 |
| Null/blank function rows | 0 |
| Non-null function rows | 219 |
| Non-null fraction | 100.0% |

**Top 20 distinct non-null function values with row counts:**

| Function Value | Row Count |
|----------------|-----------|
| State Operations | 138 |
| Local Assistance | 66 |
| Capital Outlay | 15 |

*(Only 3 distinct values exist in the dataset — all 219 rows have a non-null function)*

**Sample of 5 distinct function values (verbatim — A3 verification):**

1. `'State Operations'`
2. `'Local Assistance'`
3. `'Capital Outlay'`

*(Only 3 distinct values exist)*

**A3 VERDICT:** Values are HUMAN-READABLE NAMES (not numeric budget act codes). The values `State Operations`, `Local Assistance`, and `Capital Outlay` are standard California state budget function categories — directly usable as icicle node labels.

**A1 VERDICT: CONFIRMED**

Non-null function rows = 219/219 = **100.0%** (>= 20% threshold). Every single GF FY2026 row has a non-null function value. The 3rd level is not sparse — it is universally populated. This is stronger than expected.

**Implication for Plan 02:** The D-05 null-function collapse case (department with only null-function rows becoming a leaf) does NOT occur in FY2026. However, the code should still implement D-05 correctly for robustness across all fiscal years (other FYs may differ). The 3-level tree for FY2026 will have no pure-leaf departments — every department will have function children.

**Script:** Temporary Python script (`scripts/_tmp_a1_discovery.py`) was created, run, and deleted. No source files modified.

---

## A2 — Mixed c+i Node RPC Test

**Method:** A throwaway test script (`scripts/_verify-mixed-node-temp.mjs`) was written to:
1. Load env via the same loadEnv idiom used in `processCA.js`
2. Look up the CA data source via `treasury_list_source_ids`
3. Call `treasury_sync_budget_tree` with a sentinel fiscal year of 9998 and a MIXED tree node

**CA data source confirmed:** `e47a4cb5-d69f-4cf5-be10-ada8505296e3` (name: 'California General Fund Operating Budget')

**Exact tree submitted:**

```json
[
  {
    "n": "TEST Agency",
    "a": 300,
    "c": [
      {
        "n": "TEST Department",
        "a": 300,
        "c": [
          {
            "n": "State Operations",
            "a": 100,
            "i": [
              { "d": "State Operations", "a": 100, "aa": null, "f": null, "e": null }
            ]
          }
        ],
        "i": [
          { "d": "General Fund Collapsed", "a": 200, "aa": null, "f": null, "e": null }
        ]
      }
    ]
  }
]
```

The `TEST Department` node has BOTH `c` (one function child: `State Operations`) AND `i` (one collapsed null-function line item: `General Fund Collapsed`). This is the exact mixed-node scenario that occurs under D-05 when a department has both null-function and non-null-function rows.

**RPC response:**

```json
{
  "status": "success",
  "budget_id": "90d5e6a2-0fb2-4a30-b2b6-f4bb3bda97fb",
  "duration_ms": 41.069,
  "rows_fetched": 3,
  "total_budget": 300,
  "rows_inserted": 2
}
```

No error. Status = "success". `rows_inserted: 2` = 2 line items inserted.

**Post-call DB row counts:**

After the RPC call, querying `budget_categories` and `budget_line_items` for budget `90d5e6a2...`:

**budget_categories (3 rows):**

| name | depth | parent_id |
|------|-------|-----------|
| TEST Agency | 0 | null |
| TEST Department | 1 | TEST Agency id |
| State Operations | 2 | TEST Department id |

**budget_line_items (2 rows):**

| description | category_id | approved_amount |
|-------------|-------------|-----------------|
| State Operations | State Operations cat (depth 2) | null |
| General Fund Collapsed | TEST Department cat (depth 1) | null |

Both items landed. The `General Fund Collapsed` item is directly on the `TEST Department` node (depth 1) — it is a line item on a branch node that also has children. The `State Operations` item is on the depth-2 leaf node.

**Verdict analysis:**

- `State Operations` category at depth 2: FOUND (child node created)
- `State Operations` line item on depth-2 leaf: FOUND
- `General Fund Collapsed` line item on `TEST Department` (depth-1 branch): FOUND
- Mixed c+i node fully accepted: YES

**A2 VERDICT: ACCEPTED**

The `treasury_sync_budget_tree` RPC accepts a node with BOTH `c` (children) AND `i` (line items) simultaneously. Both the function child and the collapsed line item are stored. The `rows_inserted: 2` confirms 2 line items were written (one on the depth-2 leaf, one on the depth-1 branch).

**Sentinel FY9998 cleanup:**

After capturing results, budget `90d5e6a2-0fb2-4a30-b2b6-f4bb3bda97fb` (FY=9998) was deleted. Cascade removed its budget_categories and budget_line_items.

Verification query: `SELECT count(*) FROM treasury.budgets WHERE data_source_id = 'e47a4cb5-d69f-4cf5-be10-ada8505296e3' AND fiscal_year = 9998` returned **0 rows**.

Sentinel FY9998 budget confirmed deleted.

**Temp script:** `scripts/_verify-mixed-node-temp.mjs` was created, run, and deleted. No source files modified.

---

## D-05 Strategy Decision

**Based on A2 VERDICT: ACCEPTED**, the D-05 implementation strategy for Plan 02 is:

**Emit mixed nodes:** a department with both null-function rows and non-null-function rows produces `{ n, a, c: [function children], i: [collapsed null-function line items] }`.

The RPC fully supports this structure. The department's `c` array contains depth-2 function child nodes (each with their own `i` line items). The department's `i` array contains the collapsed line items for null-function rows — these line items appear directly on the department node (a branch node), alongside its children.

### Plan 02 implementation rules:

1. **If a department has ONLY non-null-function rows** → emit a pure branch: `{ n: dept, a: total, c: [function children] }`
2. **If a department has ONLY null-function rows** → emit a pure leaf: `{ n: dept, a: total, i: [line items] }`
3. **If a department has BOTH null-function AND non-null-function rows** → emit a mixed node: `{ n: dept, a: total, c: [function children], i: [collapsed items] }`

This is safe because A2 is CONFIRMED ACCEPTED. The RPC stores items on branch nodes without error.

### Additional context from A1:

For FY2026, case 3 (mixed nodes) will not occur because all 219 rows have non-null function values (A1 = 100% non-null). All departments will be pure branch nodes (case 1). However, other fiscal years may have null-function rows, so the mixed-node implementation remains necessary for correctness across FY2022-2025.

---

## Verification

- No source scripts modified: `git diff --stat scripts/extractCA.py scripts/processCA.js` shows no changes
- No temp scripts remain: `scripts/_tmp_a1_discovery.py` and `scripts/_verify-mixed-node-temp.mjs` deleted
- Sentinel FY9998 budget: confirmed deleted (0 rows in treasury.budgets for CA data_source_id + FY=9998)
