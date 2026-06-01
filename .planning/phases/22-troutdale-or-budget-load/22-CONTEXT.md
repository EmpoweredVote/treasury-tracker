# Phase 22: Troutdale OR Budget Load - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Troutdale, OR (~17,000 pop) to Treasury Tracker with operating budget, revenue (Money In), per-capita display, and AI-enriched category descriptions. Troutdale is the third-largest incorporated city in Multnomah County, completing the county's major cities alongside Portland (Phase 17) and Gresham (Phases 20–21).

Troutdale is not on Socrata. The implementation will follow the Gresham PDF-extraction pattern: Python extractor (pdfplumber) + Node.js loader + enrichment + Census population.

</domain>

<decisions>
## Implementation Decisions

### Revenue Scope
- **D-01:** Attempt to fold both operating and revenue into Phase 22 in a single phase (Troutdale is small — likely simpler than Gresham). If revenue format turns out to be significantly harder than expected, fallback: ship operating only and note revenue as a follow-up phase. Do not block the phase on revenue.

### FY Depth
- **D-02:** Researcher determines what fiscal years are available and have consistent PDF format. Default to loading as many years as possible (maximize historical depth). If the PDF format changed at some point in history, load only the post-format-change years — do not build a multi-format extractor for earlier formats.

### Phase 23 Readiness (All Funds)
- **D-03:** Researcher assesses whether Troutdale's adopted budget PDF contains the same "Resources and Requirements — All Funds" page as Gresham/Portland. If yes, and if adding All Funds Requirements extraction adds only minimal complexity (flip section gating on an already-parsed page), the researcher should recommend folding it into Phase 22. If it adds significant complexity, defer to Phase 23. No hard requirement to include it — researcher judgment call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gresham OR pipeline (primary template for Troutdale)
- `scripts/extractGresham.py` — pdfplumber text-line parser; primary template for extractTroutdale.py
- `scripts/processGresham.js` — Node.js loader with --revenue flag; primary template for processTroutdale.js
- `scripts/seedGreshamOregon.js` — municipality + data_source seeder; template for seedTroutdaleOregon.js

### Gresham phase summaries (implementation decisions and patterns)
- `.planning/phases/20-gresham-or-budget-load/` — operating budget phase; review PLAN files for seeder/extractor patterns
- `.planning/phases/21-gresham-or-revenue-load/` — revenue phase; extract_revenue() + --mode pattern; review PLAN/SUMMARY files

### Supporting scripts
- `scripts/enrichCategories.js` — enrichment pipeline; reuse as-is with --city Troutdale --state OR --year YYYY
- `scripts/loadORPopulation.js` — Census OR population loader; adapt with Troutdale FIPS/population constant

### Project context
- `.planning/PROJECT.md` — requirements, key decisions, constraints
- `.planning/STATE.md` — current DB coverage (OR cities), known tech debt

### Phase 23 context (for D-03 assessment)
- `.planning/ROADMAP.md` §Phase 23 — All Funds Consistency approach (extract Requirements column, dataset_type='all_funds_requirements')

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extractGresham.py` — text-line parser using pdfplumber; copy and adapt as `extractTroutdale.py`; the `extract_revenue()` + `--mode` flag pattern is the template if revenue is folded in
- `scripts/processGresham.js` — `--revenue` flag, `upsertDataSource()`, `resolvePdfDir()` worktree-safe pattern; copy and adapt as `processTroutdale.js`
- `scripts/seedGreshamOregon.js` — municipality upsert + data_source rows with `fiscal_years` array; copy and adapt as `seedTroutdaleOregon.js`
- `scripts/loadORPopulation.js` — two-constant edit pattern (already added Portland + Gresham); add Troutdale FIPS + population constant
- `scripts/enrichCategories.js` — fully reusable; no changes needed

### Established Patterns
- All OR cities: seed municipality → extractCity.py → processCity.js → enrichCategories.js → loadORPopulation.js → verify in app
- Revenue extraction: add `extract_revenue()` to extractor + `--revenue` / `--mode` flag to loader (Gresham Phase 21 pattern)
- Idempotency: `processCity.js` deletes existing budget rows before re-inserting; enrichment uses name_key upsert
- Security: PDF path from controlled `docs/CityName/` readdir (no user input); spawnSync with args array (no shell injection); maxBuffer 8MB; amount assertion gate on operating totals

### Integration Points
- `treasury.municipalities` — Troutdale row created via seeder
- `treasury.data_sources` — one row per dataset_type per fiscal_year per Troutdale
- `src/components/EntitySwitcher.tsx` — `STATE_LABELS` already has `OR: 'Oregon'` from Phase 17 (no change needed)

</code_context>

<specifics>
## Specific Ideas

- Troutdale is small — operating + revenue may both be in the same PDF. Revenue is expected to be simpler than Portland's Vol 2 situation (which required a separate phase). One-phase approach is preferred.
- If All Funds page exists in the same PDF used for revenue, folding `dataset_type='all_funds_requirements'` into Phase 22 would save a round-trip and simplify Phase 23 scope for Troutdale.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-Troutdale OR Budget Load*
*Context gathered: 2026-06-01*
