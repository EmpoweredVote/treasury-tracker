# Phase 36: Selective City Retrofit - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Source data audit of 3 pilot cities (Portland, Dallas, San Francisco) — using a reusable framework applicable to all 30+ existing cities — to determine the genuine optimal tree depth for each city. Retrofit any cities where the source genuinely supports deeper structure than currently loaded. No new cities added. No frontend changes.

The driving principle: accurately reflect each city's real budget structure in a way that helps citizens follow their tax dollars — not achieve a fixed depth target.

</domain>

<decisions>
## Implementation Decisions

### Audit Scope & Framework

- **D-01:** Audit all 3 pilot cities (Portland, Dallas, SF) simultaneously, not sequentially. Apply the audit framework to all 3 before deciding what to retrofit.
- **D-02:** The audit produces a **reusable framework** applicable to all 30+ cities — not just the 3 pilots. The framework covers: Socrata cities (which columns to check), PDF cities (what structural cues to look for), and the genuineness tests. It is a durable asset, not a one-time check.
- **D-03:** Per-city audit output includes: recommended tree depth (N), the column/table providing each level, and any extraction blocker. Enough detail for a planner to write a loader change.
- **D-04:** Audit framework lives in TWO places: (1) a markdown doc in `.planning/` as a human-readable guide for engineers loading future cities, and (2) per-city verdict (depth, evidence, status) stored in the DB as the source of truth.

### Genuineness Bar (the "should we add this level?" test)

- **D-05:** A tree level is **genuine** only if it passes BOTH of these tests:
  1. **Citizen-recognizable**: the label names a recognizable organizational unit (department, bureau, program area). It should not be a technical/accounting category that citizens wouldn't recognize.
  2. **Official document test**: the city itself uses this grouping in its published budget documents (table of contents, summary table, org chart). If it's only in a Socrata column that the city never surfaces as a budget structure, it is NOT genuine.
- **D-06:** When a genuine level has incomplete row coverage (e.g., some rows have null at a deeper level), apply the **Phase 35 D-05 pattern**: collapse those rows to the parent leaf node as line items. Do not invent synthetic groupings for blank rows. Partial coverage is fine.
- **D-07:** **No depth cap.** If a city's source genuinely supports 4 levels and both tests pass, load it at 4 levels. N-level, data-driven — consistent with Phase 35 philosophy. The icicle chart already handles arbitrary depth.

### Retrofit Scope

- **D-08:** Retrofit only if genuinely needed. If all 3 pilot cities pass the genuineness test, retrofit all 3 within Phase 36. Do not artificially limit to 1 city — the minimum requirement is 1, but the ceiling is "all that pass."
- **D-09:** Cities whose audit confirms their **current depth is already appropriate** (source doesn't support additional genuine levels): mark as audited/confirmed in the DB with no reload. Record the verdict, don't just skip silently.

### Enrichment During Reload

- **D-10:** When a city's tree depth changes, preserve existing enrichment descriptions by **node name matching** — re-attach existing `budget_categories.description` rows to nodes that share the same name after reload, regardless of depth change (e.g., bureau "Portland Parks & Recreation" keeps its description even if it moves from depth-0 to depth-1).
- **D-11:** Orphaned enrichment rows (existing description has no matching node name after reload): **log but do not delete**. Keep the rows in the DB, emit a warning in the reload script output. A subsequent enrichment run will add fresh descriptions for unmatched nodes.
- **D-12:** Enrich new nodes added by the retrofit (nodes that didn't exist before the depth increase, e.g., new service-area depth-0 nodes). Run `enrichCategories.js` on new nodes as part of Phase 36. Apply the **$5 API cost gate** — estimate before running, stop and get user approval if estimated cost exceeds $5.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` §Phase 36 — Goal, success criteria (RETROFIT-01, RETROFIT-02, RETROFIT-03), critical note about audit-before-code
- `.planning/REQUIREMENTS.md` §RETROFIT — RETROFIT-01/02/03 requirements and out-of-scope items

### Prior Phase Decisions (carry forward)
- `.planning/phases/35-ca-state-3-level-icicle-pilot/35-CONTEXT.md` — D-05 (null collapse pattern), D-09/D-10/D-11 (enrichment handling), N-level data-driven philosophy, $5 cost gate
- `.planning/phases/34-3-level-tree-infrastructure-ev-accounts-api/34-01-SUMMARY.md` — Confirms `treasury_sync_budget_tree` RPC accepts N-level trees; TREE-01 test verified Health → Dept → Program 3-level structure

### City Loaders (candidates for retrofit)
- `scripts/extractPortland.py` — `service_area: ''` in row output, comment "not in this table". Service areas ARE in Vol 1 PDF citywide summary but require a different table extraction than the current bureau subtotal table.
- `scripts/processPortland.js` — Builds depth-0 tree of 34 bureaus, each as a leaf node with a single line item (bureau subtotal). No depth-1.
- `scripts/bulkLoadBudget.js` — Supports `category_column` + `subcategory_column` in `column_mapping`. No `department_column` today. Dallas operating uses `service`+`objectgroup`; revenue uses `department`+`revsource`. Researcher must check if Dallas operating Socrata data has a `department` column above `service`.

### DB State at Start of Phase 36
- Dallas operating FY2026: depth=0 (188 service-area nodes), depth=1 (680 objectgroup nodes) — already 2-level
- Portland operating FY2026: depth=0 (34 bureau nodes), no depth-1 — flat list
- SF operating: unaudited; Socrata likely has `department → program` structure (unconfirmed)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `treasury_sync_budget_tree` RPC — The only DB write path for tree data. N-level tested and confirmed in Phase 34/35. Use for all retrofits.
- `enrichCategories.js` — Already handles depth-2 nodes (proven in Phase 35 CA state function-level enrichment). Check if it needs a flag to target a specific depth or city.
- `scripts/processCA.js` `buildCATree()` (now N-level) — Reference implementation for a data-driven N-level tree builder. Useful pattern for any city needing a new tree builder.

### Established Patterns
- **N-level tree shape:** `{ n, a, c: [{...}] }` at non-leaf levels; `{ n, a, i: [{...}] }` at leaf levels. Branch nodes have `c`, leaf nodes have `i`, never both.
- **Null collapse (D-05/Phase 35):** Rows without a deeper-level value collapse to the parent node as line items — do not invent synthetic nodes.
- **$5 cost gate:** Estimate enrichment API cost before running. Stop and get user approval if estimate exceeds $5.
- **Supabase env:** Use `process.env.SUPABASE_URL` — do NOT use hardcoded fallback URL (Phase 34 code review WR-04 fix already applied in processCA.js; check other city loaders for the same pattern).

### Integration Points
- `BudgetIcicle.tsx` — Already renders arbitrary depth via `navigationPath`. **No frontend changes needed** for any retrofit, regardless of depth.
- `budget_categories` table — `depth`, `parent_id`, `name`, `description` columns. Enrichment is stored in `description`. Node name matching uses `name`.
- `data_sources` table — `column_mapping` JSONB. Socrata city retrofits may only need a `column_mapping` update (no code change) if the source column exists.

</code_context>

<specifics>
## Specific Ideas

- User's framing: "My goal is not to have 2 deep or 3 deep, my goal is to accurately reflect reality in a way that is helpful for other citizens to be able to follow their tax dollars. For some cities that may be 2 deep — for others 4." → The audit framework must produce the **right depth per city**, not a uniform depth target. This is the north star for the genuineness tests.
- "I don't want to provide '4 deep' for a city that can only clearly support 2 or go 2 deep when it's not providing citizens enough granularity to be helpful." → Depth that's too shallow is as much a failure as depth that's synthetic.
- For Socrata cities (Dallas, SF): fastest audit path is checking available columns in the source dataset. If a genuine grouping column exists above the current category_column, it may be a config-only retrofit via `column_mapping` — no code change.

</specifics>

<deferred>
## Deferred Ideas

- **Full retrofit of all 30+ cities**: The audit framework built in this phase enables future phases to apply it systematically. Phase 36 covers only the 3 pilot cities. Broader retrofit is a future milestone.

</deferred>

---

*Phase: 36-selective-city-retrofit*
*Context gathered: 2026-06-09*
