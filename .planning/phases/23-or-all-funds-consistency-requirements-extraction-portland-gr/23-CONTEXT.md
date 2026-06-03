# Phase 23: OR All Funds Consistency — Requirements Extraction (Portland + Gresham) - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve the Budget / Money In scope mismatch for all three OR cities (Portland, Gresham, Troutdale). Extract the "Requirements" column from the "Resources and Requirements — All Funds" page in each city's adopted budget PDF — the same page already parsed for revenue (Money In). Store as `dataset_type='all_funds_requirements'`. Update the Budget tab to show the All Funds Requirements total as the headline figure, with a gap-explanation label and the existing departmental icicle chart as drill-down detail.

**Problem being solved:** Money In (~$512M Gresham) uses All Funds scope. Budget tab uses departmental operating (~$330M). Side-by-side display creates an apparent $180M windfall that is an accounting artifact, not a real surplus.

**Scope:** Portland (FY2022–FY2026), Gresham (FY2023–FY2026), Troutdale (FY2019–FY2026) — data extraction + DB load + frontend display change. Full end-to-end in one phase.

</domain>

<decisions>
## Implementation Decisions

### UI scope
- **D-01:** Phase 23 is full end-to-end — data pipeline (extract + load + verify) AND frontend changes to display the corrected total. Not data-only.
- **D-02:** The Budget tab headline total replaces the departmental operating figure (~$330M) with the all_funds_requirements total (~$512M). The existing icicle/department breakdown remains and is labeled as a partial breakdown.
- **D-03:** Show a gap-explanation label when all_funds_requirements and departmental operating totals differ. Label should convey that the departmental breakdown accounts for $X of the $Y All Funds total, with the remainder covering debt service, capital, and other non-departmental requirements. Exact wording is planner/implementer discretion.
- **D-04:** The UI change is data-driven and generic — any city/year that has `all_funds_requirements` rows in the DB gets the updated headline and label. No hardcoding of OR cities in the frontend. In practice, only OR cities will have this data after Phase 23.

### Troutdale inclusion
- **D-05:** Phase 23 includes Troutdale. Researcher assesses whether Troutdale's adopted budget PDFs contain the "Resources and Requirements — All Funds" page. If present, fold in Troutdale extraction alongside Portland and Gresham. If the All Funds page is absent or significantly different from Gresham format, defer Troutdale and note as a follow-up.

### FY coverage
- **D-06:** Match all available operating FYs for each city. Portland: FY2022–FY2026 (5 years). Gresham: FY2023–FY2026 (4 years). Troutdale: FY2019–FY2026 (8 years, assuming All Funds page exists across all FYs). The year selector must remain consistent — any FY the user selects should show matching All Funds totals on both Budget and Money In tabs.

### Portland page source
- **D-07:** Researcher determines whether the "Resources and Requirements — All Funds" page appears in Portland's Vol 1 (operating) or Vol 2 (revenue) PDFs. This drives which file `extract_requirements()` targets. If in Vol 1, add to `extract_budget()` flow in `extractPortland.py`. If in Vol 2, add alongside `extract_revenue()` in the same file. ROADMAP suggests same volume as revenue (Vol 2), but researcher must confirm before planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing OR extractors (primary templates)
- `scripts/extractGresham.py` — `extract_revenue()` + section-gating pattern (`in_resources` → flip to `in_requirements` for Phase 23). Primary template for `extract_requirements()`.
- `scripts/extractPortland.py` — `extract_budget()` uses `in_requirements` for departmental data; `extract_revenue()` uses Vol 2. Researcher must open Portland PDF to identify which volume has the All Funds summary page.
- `scripts/extractTroutdale.py` — copy of Gresham pattern; researcher assesses if All Funds page exists.

### Existing OR loaders (primary templates)
- `scripts/processGresham.js` — `--revenue` flag, `upsertDataSource()`, dataset_type switching, SANITY_MAX gating. Template for `--mode requirements` extension.
- `scripts/processPortland.js` — Vol 1 / Vol 2 routing, `PDF_URLS[datasetType]` map. Template for adding `all_funds_requirements` mode.
- `scripts/processTroutdale.js` — Gresham-pattern loader; extend with `--mode requirements` if All Funds page confirmed.

### Frontend files to change
- `src/types/budget.ts` — `dataset_type` union type at line 117 (`'operating' | 'revenue' | 'salaries'`) — add `'all_funds_requirements'`
- `src/App.tsx` — `hasOperating`/`hasRevenue` checks at lines 268–270; add `hasAllFundsRequirements` detection and pass to Budget tab
- `src/components/dashboard/PlainLanguageSummary.tsx` — headline total uses `operatingData.metadata.totalBudget`; needs to prefer `allFundsRequirementsData.metadata.totalBudget` when available, plus gap-explanation label
- `src/data/dataLoader.ts` — dataset lookup at line 58; confirm `all_funds_requirements` flows through without changes or update as needed

### Phase context
- `.planning/ROADMAP.md` §Phase 23 — full goal, problem statement, and approach
- `.planning/phases/21-gresham-or-revenue-load/` — Gresham revenue extraction pattern (what Phase 23 mirrors on the Requirements side)
- `.planning/phases/22-troutdale-or-budget-load/22-CONTEXT.md` — D-03: Troutdale All Funds assessment directive

### Project context
- `.planning/PROJECT.md` — requirements, constraints, key decisions table
- `.planning/STATE.md` — current DB coverage (OR cities FY ranges), known tech debt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extractGresham.py` — `extract_revenue()` already parses the All Funds page with section gating. Phase 23 adds `extract_requirements()` as a sibling function on the same page, flipping `in_resources` → `in_requirements`.
- `scripts/processGresham.js` — `--revenue` flag pattern; extend to `--mode [operating|revenue|requirements]`. `upsertDataSource()` already filters by `dataset_type` to avoid collision.
- `scripts/enrichCategories.js` — fully reusable; no changes expected. May be needed if All Funds Requirements categories need enrichment.

### Established Patterns
- **Section gating:** `in_resources = False` / `in_requirements = False` flags on the same All Funds page; flip the active flag to extract the other column.
- **Mode dispatch:** `datasetType = mode === 'requirements' ? 'all_funds_requirements' : ...` in loaders; consistent with operating/revenue precedent.
- **Idempotency:** Loader deletes existing rows by `dataset_type` + `fiscal_year` before inserting — no duplication risk on re-run.
- **SANITY_MAX gating:** Operating total sanity check is already gated to `mode === 'operating'`; All Funds Requirements will be larger (~$512M Gresham) and must also be excluded from the operating cap.

### Integration Points
- `treasury.data_sources` — one row per `dataset_type='all_funds_requirements'` per fiscal_year per city
- `treasury.budget_nodes` — All Funds Requirements categories stored alongside operating/revenue
- `src/App.tsx` `available_datasets` — auto-discovery already reads `dataset_type`; adding `all_funds_requirements` rows makes them available to the frontend with no schema change
- `src/types/budget.ts` line 117 — union type needs `'all_funds_requirements'` added

</code_context>

<specifics>
## Specific Ideas

- The gap-explanation label should help non-finance citizens. Something like: "This $512M total covers all city funds. The department breakdown below accounts for $330M; the remaining $182M covers debt service, capital projects, and interfund transfers." Planner should design exact wording based on what fields are available.
- The UI change should be backward-compatible — if a city/year has no `all_funds_requirements` data, the Budget tab falls back to the departmental operating total (current behavior unchanged for TX and CA cities).

</specifics>

<deferred>
## Deferred Ideas

- All Funds Requirements enrichment — if the Requirements categories need plain-language descriptions like revenue categories do, run `enrichCategories.js --city ... --mode requirements`. Not explicitly in scope for Phase 23; researcher can recommend if categories are opaque.
- TX and CA cities — All Funds scope mismatch may exist in other cities too. Out of scope for Phase 23 (OR-only). Future phase if pattern proves valuable.
- Portland revenue (Vol 2, fund-level) deferred in Phase 21 — still deferred; Phase 23 is about Requirements extraction only.

</deferred>

---

*Phase: 23-OR All Funds Consistency — Requirements Extraction (Portland + Gresham)*
*Context gathered: 2026-06-02*
