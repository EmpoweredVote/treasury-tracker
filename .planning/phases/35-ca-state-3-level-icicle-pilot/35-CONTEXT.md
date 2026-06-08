# Phase 35: CA State 3-Level Icicle Pilot - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Reload the California state General Fund budget as a genuine N-level tree (depth determined by data, not hardcoded) so the icicle chart drills to 3 levels (DOF Agency → Department → Function) in the live app. No new data sources, no frontend changes. Pure data reshape of the existing LAO Excel pipeline from Phase 33.

</domain>

<decisions>
## Implementation Decisions

### Script Strategy
- **D-01:** Modify `scripts/processCA.js` and `scripts/extractCA.py` **in place** — do not create a new file. No flag-based opt-in.
- **D-02:** The tree builder must be **data-driven (N-level)**, not hardcoded to 3 levels. The depth is determined by how many level columns the extractor provides. For the LAO Excel, that is 3 levels: DOF Agency (col 5) → Department (col 1) → Function (col 2). If a future data source has a 4th column, the loader should handle it without code changes.
- **D-03:** `extractCA.py` must include the `function` field (col 2) in its JSON output. Currently it is tracked in `COLS` but excluded from `rows_out`. Add it.
- **D-04:** `processCA.js` `buildCATree()` must be replaced with a generic N-level tree builder that consumes a column list `[dof_agency, department, function]` and recurses as deep as the data has values.

### Null/Missing Function Handling
- **D-05:** When `function` (col 2) is `None`, blank, or whitespace for a given row, **collapse that row to the department leaf** — it becomes a line item directly under the department node, not under a synthetic child. Do not invent a "General" or "Other" node. Accurate totals take priority over uniform tree depth.

### Reload Scope
- **D-06:** Reload **all 5 fiscal years** (2022, 2023, 2024, 2025, 2026) — same scope as Phase 33. All FYs get consistent 3-level depth.
- **D-07:** Use `treasury_sync_budget_tree` RPC for reload (same as Phase 33). **The planner must verify at plan time** whether the RPC fully replaces existing depth-2 rows (budget_categories at depth 0 and 1) when called with a depth-3 tree for the same `data_source_id` + `fiscal_year`. If the RPC leaves orphaned depth-2 nodes, an explicit DELETE of existing CA budget data is required before reload. Do not assume; verify with a live test or code read of the RPC.
- **D-08:** The existing enrichment rows (for agencies and departments) may be orphaned after reload if node IDs change. The planner must account for this.

### Enrichment
- **D-09:** **Enrich the new function-level (depth-2) nodes** using `scripts/enrichCategories.js` after reload. These are the nodes users see when they drill to level 3 of the icicle — descriptions matter.
- **D-10:** Estimate enrichment cost before running and apply the **$5 API cost gate** (stop and get user approval if estimated cost exceeds $5). Function nodes repeat across departments (e.g., "Medi-Cal" appears under one department), so actual unique node count may be low.
- **D-11:** Check whether `enrichCategories.js` handles depth-2 nodes automatically or requires a flag/change to target the new level.

### Code Quality
- **D-12:** Apply the `processCA.js` SUPABASE_URL hardcoded-fallback fix from Phase 34 code review (WR-04) if not already applied — remove `|| 'https://kxsdzaojfaibhuzmclfq.supabase.co'` fallback and throw on missing env var.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Pipeline (Phase 33)
- `scripts/extractCA.py` — Current extractor: reads `Pivot Table Data` sheet, columns mapped in `COLS` dict. `function` (col 2) is tracked but NOT in `rows_out`. This is the key change needed.
- `scripts/processCA.js` — Current loader: builds 2-level `DOF Agency → Department` tree via `buildCATree()`. Must be replaced with N-level builder. Note: SUPABASE_URL hardcoded fallback needs removal (Phase 34 WR-04 fix).

### Infrastructure (Phase 34)
- `.planning/phases/34-3-level-tree-infrastructure-ev-accounts-api/34-01-SUMMARY.md` — Phase 34 verification confirms `treasury_sync_budget_tree` RPC accepts N-level trees and `getBudgetById` returns arbitrary depth. The TREE-01 test used `Health and Human Services → Dept of Health Care Services → Medi-Cal` — exactly the DOF Agency → Department → Function structure.

### Roadmap
- `.planning/ROADMAP.md` §Phase 35 — Goal, success criteria (ICICLE-01, ICICLE-02, ICICLE-03), and the explicit note: "No frontend changes required — BudgetIcicle.tsx already renders arbitrary depth via navigationPath."

### Enrichment Script
- `scripts/enrichCategories.js` — Must check if it handles depth-2 nodes automatically, or if it needs a flag to target the new level.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extractCA.py` `extract_budget()` — Already reads all columns including `function` (col 2). Only change needed: add `'function': row[COLS['function']]` to `rows_out` dict.
- `scripts/processCA.js` `buildCATree()` — Replace with generic N-level builder. The rest of the script (env loading, Supabase client, sanity band, `loadFiscalYear()`, CLI arg parsing) stays unchanged.
- `scripts/processCA.js` `loadFiscalYear()` — Unchanged. Calls `treasury_sync_budget_tree` with `p_tree` — just needs to receive the deeper tree.

### Established Patterns
- **N-level tree shape:** `{ n: 'name', a: amount, c: [children] }` at every non-leaf level; `{ n: 'name', a: amount, i: [line_items] }` at leaf level. Phase 33 used `i: [{ d: dept, a: amt, aa: null, f: null, e: null }]`. The 3-level version should push line items to the function-level leaf nodes.
- **Sanity band:** `$150B–$300B` per FY for CA GF. Unchanged — 3-level totals should be identical to 2-level totals (same rows, just deeper grouping).
- **Amount scale:** LAO amounts are in THOUSANDS — `processCA.js` multiplies by 1000. Unchanged.
- **FY convention:** `'2025-26'` → `2026` (ending year). Unchanged.

### Integration Points
- `treasury_sync_budget_tree` RPC — The only DB write path. The planner must verify its upsert behavior when depth increases for an existing `data_source_id` + FY combination.
- `BudgetIcicle.tsx` — No changes needed. Renders arbitrary depth via `navigationPath`. Verify visually after reload.

</code_context>

<specifics>
## Specific Ideas

- User's framing: "Eventually, I want us to have as many levels as the data has — our goal is to convey that cleanly and deeply and accurately. I don't want to force 3-level if the data can't support it, but if the data keeps going deeper, I'd like for our icicles to do that as well." → The N-level, data-driven approach directly expresses this goal. The LAO Excel happens to have 3 levels; other future data sources may have more.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 35-ca-state-3-level-icicle-pilot*
*Context gathered: 2026-06-08*
