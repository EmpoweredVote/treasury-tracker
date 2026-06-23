# Phase 80: City + County Loads - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Source:** Authored inline from locked milestone decisions (per feedback_no_research_subagents — no discuss-phase/research subagents). Scope was decided by Chris 2026-06-22 (see 79-VERIFICATION.md "Scope flag").

<domain>
## Phase Boundary

Bulk-load **all 38 Virginia independent cities** and **all 95 counties** into the tracker using the Phase 79 loader (`scripts/loadVAComparativeReport.js`), for the two fiscal years the APA publishes as XLSX (FY2023 + FY2024), idempotently and fully sourced. This is the **bulk-load phase** — the loader and its parser are already built and verified (Phase 79, 7/7 tests, Alexandria FY2024 exact).

**In scope (VALOAD-01, VALOAD-02, VALOAD-04):**
- All 38 cities (§1 of the report; Alexandria…Winchester, incl. Falls Church) loaded with operating (expenditure function→activity) + revenue (source→sub-source) + per-capita, FY2023 and FY2024, every row sourced.
- All 95 counties (§3; Accomack…York) loaded with the same datasets/granularity.
- A batch driver that iterates the report's locality roster (segmenting Cities vs Counties) and calls the existing tree-builders + write path once per (locality, FY, dataset).
- Idempotency proven: re-running changes nothing; the never-overwrite guard protects any richer pre-existing source.

**Not in scope:**
- **Towns (§5, 37 reporting towns)** — Phase 81 (VALOAD-03), together with the Virginia state node + town→county linking (VALINK-01).
- Pre-FY2023 history (PDF-only; out of scope per 79 D-03).
- Enrichment (Phase 82), full source-chain audit + UAT (Phase 83), enterprise/debt/capital/salaries (deferred / not in source).
</domain>

<decisions>
## Implementation Decisions

### Scope / history
- **D-01: History = FY2023 + FY2024 only.** These are the only XLSX years on data.virginia.gov (`scripts/vaApaDatasets.json`); pre-2023 is PDF-only and out of scope (79 D-03). Load all 133 city+county localities × both years. "Deep history FY2015+" is unachievable from the XLSX source and is deferred.
- **D-02: Cities + counties only this phase (133 localities).** Towns deferred to Phase 81 because they also require the data-model decisions (state node + town→county linking, VALINK-01) that Phase 81 owns.

### Roster + locality classification (the key new work)
- **D-03: Derive the roster from the report's own section structure, not a hand-authored list.** Exhibit C (and B, B1, B2, C1–C8, H) lists localities in three numbered sections in a uniform order: **§1 Cities (38) → §3 Counties (95) → §5 Towns (37)**, separated by header/footnote noise rows. The "No." column **resets to 1** at the start of each section. Segment by No.-reset (Exhibit H has NO "Total" delimiter rows, so do **not** rely on "Total" rows for segmentation). Skip rows whose col-1 "No." is non-numeric (section headers like "County of:" / "Town of:", footnotes, "Total", "Grand Total").
- **D-04: Section-aware locality lookup is mandatory (homonym safety).** Virginia has city/county homonyms — **Fairfax, Franklin, Richmond, Roanoke** each exist as BOTH an independent city (§1) and a county (§3) with the same bare name in col 2. The Phase 79 `findLocalityRow` returns the *first* top-down match, so a county lookup by bare name would wrongly return the city's row. The loader/driver MUST constrain the search to the correct section (Cities vs Counties) for every exhibit.

### Storage naming (homonym disambiguation)
- **D-05: Counties stored with the "County" suffix; cities stored bare.** Match the existing project convention (`scripts/loadCountyBudget.js` default DB name = "<county> County"). DB `municipalities.name`: cities = bare report name ("Alexandria", "Fairfax"); counties = "<name> County" ("Accomack County", "Fairfax County"). The XLSX **match name** stays the bare col-2 value; the **display name** is decoupled from the match name. Counties load with `entity_type='county'` (mirrors Utah `--entity-type county` — else a phantom city row is created; auto-memory project_utah_loader_entity_type_and_display_names). Cities load with `entity_type='city'`.

### Idempotency + sourcing (carried from Phase 79)
- **D-06: Idempotent + never-overwrite (VALOAD-04).** Reuse the Phase 79 pre-skip never-overwrite guard: skip any (muni, FY, dataset) already owned by a *different* `data_source` (treasury_sync_city_budget is NOT source-safe — auto-memory project_sync_city_budget_not_source_safe). A second run of the batch loader writes the same trees/totals and changes nothing.
- **D-07: Per-FY sourcing (79 D-05).** Every row: `data_source='Virginia APA Comparative Report'`, `source_url` = that FY's data.virginia.gov dataset/XLSX URL (from `scripts/vaApaDatasets.json`), `source_date` = fetch date.
- **D-08: Per-capita from each FY's own Exhibit H (79 D-04).** Population set per FY from the report's "Population Estimates July <YYYY>"; no fixed vintage across years.

### Inherited parser behavior (79 deviations — keep)
- Revenue total = **Total Local Revenue** (local only; intergovernmental Exhibit B-1 excluded — including it implies a false surplus vs expenditures).
- **Education degrades to a leaf** for localities absent from Exhibit C6 (dependent/separate school divisions); function total stays correct.
- Single-child top-level nodes collapse.

### Claude's Discretion (for the planner)
- **Batch driver vs. extend loader:** build a thin batch driver (`scripts/loadVAComparativeReportBatch.js` or similar) that opens each FY workbook **once**, segments the roster, and loops the existing exported tree-builders + write path — rather than re-reading the workbook 133× via the single-locality CLI. Keep the proven single-locality loader intact.
- **Where section-awareness lives:** either add a `section`/`entityType` parameter to the Phase 79 lookup (`findLocalityRow` → section-scoped) and export an `importLocality(...)` helper, or replicate the write path in the driver. Prefer one shared write path.
- **XLSX acquisition:** download both FY XLSX from the manifest URLs into a gitignored working dir (`_va-recon/`), or accept `--file` per FY. Mirror how Phase 79 obtained the FY2024 sample.
- **Run mechanics:** live writes need the gitignored `.env` SUPABASE_SERVICE_KEY; loaders run SERIAL on the main tree. `--dry-run` for a no-write parse of the whole roster.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The loader to iterate (built + verified in Phase 79 — read first)
- `scripts/loadVAComparativeReport.js` — exports `buildExpenditureTree(wb, name)`, `buildRevenueTree(wb, name)`, `localityPopulation(wb, name)`, `cellNum`, `cellText`, `DATA_SOURCE_NAME`; internal `findHeaderRow`, `findLocalityRow`, `extractNodeCols`, `importDataset`, `findConflictingBudget`, `getSupabase`. **Note `findLocalityRow` is global top-down → needs section scoping for counties (D-04).**
- `scripts/loadVAComparativeReport.test.mjs` — 7/7 offline tests; extend with section/homonym/naming cases.
- `scripts/vaApaDatasets.json` — FY→{datasetUrl, xlsxUrl}; floor FY2023; FY2024 final.

### Phase 79 record
- `.planning/phases/79-va-apa-source-loader/79-CONTEXT.md` (D-01…D-05), `79-VERIFICATION.md` (scope flag + the FY2023-2024 resolution + Alexandria exact totals).

### County naming + entity-type precedent
- `scripts/loadCountyBudget.js` — `--entity` default "<county> County"; counties are `entity_type='county'`, name matched ilike.
- Auto-memory `project_utah_loader_entity_type_and_display_names` — `--entity-type county` required or a phantom city row is created; DB display-name vs source-match-name decoupling.

### Sourcing / data-model facts
- Auto-memory `project_sync_city_budget_not_source_safe`, `reference_virginia_apa_comparative_report`.

No external ADRs/specs — decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The entire Phase 79 loader + write path (RPCs + never-overwrite guard + sourcing) — Phase 80 only adds roster segmentation + a batch loop + county naming/entity-type.
- `exceljs` (installed). The FY2024 workbook is 19 sheets (Table of Contents, Exhibit A, B, B1, B2, C, C1–C8, D, E, F, G, H).

### Verified report structure (FY2024 sample _va-recon/fy2024-comparative-report.xlsx)
- Exhibit C header row 5; Exhibit B header row 6; Exhibit H header row 5 (variable — `findHeaderRow` already scans for "No.").
- Sections by No.-reset: §1 = 38 cities (Alexandria…Winchester), §3 = 95 counties (Accomack…York), §5 = 37 towns (Abingdon…Wytheville). §2/§4 are header/footnote noise.
- Exhibit H has **no** "Total" delimiter rows → segment by No.-reset only.

### Integration Points
- Writes to `treasury.budgets` (operating + revenue) via `treasury_ensure_municipality` + `treasury_sync_city_budget`; population onto the `municipalities` row.
- Phase 81 consumes the same roster/driver for towns + adds the Virginia state node + linking.
</code_context>

<specifics>
## Specific Ideas
- **Homonym regression test is the must-have proof:** assert Fairfax County totals ≠ City of Fairfax totals, and Richmond (county) ≠ Richmond (city, the capital). If section-awareness is wrong, these silently collide.
- **Spot-check gate (SC#4):** Alexandria FY2024 op $863,578,347 / rev $874,230,660 (exact, from 79); plus one county FY2024 total cross-read against the published report.
- Keep function labels human-readable (they already are: "Public Safety", "Education", …) — these are the citizen-facing icicle.
</specifics>

<deferred>
## Deferred Ideas
- Towns + Virginia state node + town→county linking — Phase 81 (VALOAD-03, VALINK-01).
- Enterprise (Exhibit F), debt (E/G), capital (D), salaries — out of milestone scope.
- All-sources revenue view (adding Exhibit B-1 intergovernmental) — future.
</deferred>

---

*Phase: 80-city-county-loads*
*Context gathered: 2026-06-22 (inline, no subagents)*
