# Phase 35: CA State 3-Level Icicle Pilot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 35-ca-state-3-level-icicle-pilot
**Areas discussed:** Script strategy, Null function handling, Reload scope + delete strategy, Enrichment for 3rd level

---

## Script Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Modify processCA.js in place | Change buildCATree() to always build 3 levels. Simpler, no new file to maintain. | |
| Add a --3level flag to processCA.js | Keep 2-level as default, add --3level flag to opt in. | |
| New processCA3Level.js | Preserve original 2-level script untouched. Clean separation but two scripts to maintain. | |

**User's choice:** Free-text — "Eventually, I want us to have as many levels as the data has - our goal is to convey that cleanly and deeply and accurately. I don't want to force 3-level if that data can't support it, but if the data keeps going deeper, I'd like for our icicles to do that as well."

**Notes:** This reframed the question entirely — not 2-level vs 3-level, but N-level, data-driven depth. Decision: modify processCA.js in place with a generic N-level tree builder. For the LAO Excel, that produces 3 levels (DOF Agency → Department → Function). The system should naturally handle deeper data if it becomes available.

---

## Null Function Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse to dept leaf — no synthetic node | Rows with no function treated as dept-level line items. Accurate totals. | ✓ |
| Group under a synthetic 'General' node | Create a 'General' child node under the dept. Introduces invented category names. | |
| Skip null-function rows | Drop rows where function is null. Totals won't match LAO source. | |

**User's choice:** Collapse to dept leaf — no synthetic node (Recommended)

**Notes:** Accuracy over uniform tree depth. Rows with no function value become line items directly under the department node.

---

## Reload Scope + Delete Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 FYs: 2022–2026 | Same scope as Phase 33. All years get consistent 3-level depth. | ✓ |
| Latest 2 FYs only: 2025–2026 | Faster reload but creates depth inconsistency across years. | |

**FY scope choice:** All 5 FYs: 2022–2026 (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete existing CA budget rows, then reload | RPC upsert overwrites existing rows. Planner must verify RPC handles depth change cleanly. | ✓ |
| Explicit DELETE before reload | Manually delete all budget_categories/line_items for CA data_source first. Safer but more destructive. | |
| Check RPC upsert behavior first (checkpoint) | Let planner decide based on code/live test. | |

**Delete strategy choice:** Delete existing CA budget rows, then reload (Recommended)

**Notes:** Planner must verify whether treasury_sync_budget_tree fully replaces existing depth-2 rows when called with a depth-3 tree for the same data_source_id + fiscal_year. If orphaned nodes remain, an explicit DELETE is required first.

---

## Enrichment for 3rd Level

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — enrich 3rd level after reload | Run enrichCategories.js for new function nodes. Estimate cost; $5 gate applies. | ✓ |
| Skip for now, defer to Phase 36 | Load without enrichment. Users see raw function names. Phase 36 adds enrichment. | |
| Enrich only if existing script handles new depth automatically | Run as-is, see if depth-2 nodes are picked up. Defer if not. | |

**User's choice:** Yes — enrich 3rd level after reload (Recommended)

**Notes:** Descriptions at the 3rd level make the icicle meaningful when users drill down. Cost gate ($5) applies before running. Check whether enrichCategories.js handles depth-2 nodes automatically or requires a change.

---

## Claude's Discretion

None — all major decisions were made by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
