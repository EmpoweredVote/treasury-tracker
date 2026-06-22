# Phase 79: VA APA Source + Loader - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the ONE reusable loader that turns the Virginia APA "Comparative Report of Local Government Revenues and Expenditures" XLSX into the tracker's budget tree for any locality, prove it against Alexandria FY2024, and pin down the available fiscal-year XLSX range. This is the **de-risk phase — no bulk load** (cities/counties/towns load in Phases 80–81).

**In scope (VASRC-01, VASRC-02):**
- A reusable parser+loader (`exceljs`) that reads the APA XLSX and writes one locality's general-government **revenue** (Exhibits B / B-1 / B-2) and **expenditure** (Exhibit C + C-1…C-8) into Supabase via the existing budget RPCs, every row durably sourced.
- A dry-run that reproduces Alexandria FY2024 totals (≈$864M expenditures / ≈$874M local revenue) with zero writes.
- Determine the available XLSX fiscal-year range; document the history floor.
- Offline unit tests for the parser.

**Not in scope:** bulk loading all localities (Phase 80–81); the Virginia state node + linking (Phase 81); enrichment (Phase 82); enterprise activities (Exhibit F), debt (E/G), capital (D), salaries — all out of milestone scope or deferred.
</domain>

<decisions>
## Implementation Decisions

### Tree shape / depth
- **D-01: Expenditure = function→activity, 2-level tree.** Top level = the 8 functions from Exhibit C (General Government Administration, Judicial Administration, Public Safety, Public Works, Health & Human Services, Education, Parks/Recreation/Cultural, Community Development) + Non-Departmental; 2nd level = the activities within each function from the matching sub-exhibit (C-1…C-8). Operating dataset total = Exhibit C **Total Expenditures**.
- **D-02: Revenue = source→sub-source, 2-level tree** (mirror expenditure). Top level = major source (General Property Taxes, Other Local Taxes, Permits/Privilege Fees & Regulatory Licenses, Fines & Forfeitures, Charges for Services, Revenue from Use of Money & Property, Intergovernmental [Exhibit B-1], Miscellaneous); 2nd level = sub-source where the report breaks it out (e.g. General Property Taxes → Real Property, Public Service Corporations, Personal Property, Machinery & Tools, Merchants' Capital, Penalties, Interest). Revenue dataset total = **Total Local Revenue** (+ intergovernmental per B-1 — planner to confirm whether the displayed revenue total is local-only or local+intergovernmental; default: match the report's "Total Local Revenue" headline and add intergovernmental as its own top-level source node).
- A single-child source collapses naturally (no empty 2nd level) — don't force a sub-level where the report gives only a total.

### History floor strategy
- **D-03: XLSX-only; document the floor; NO PDF backfill.** Load every fiscal year published as an XLSX on data.virginia.gov, record the earliest available year as the documented history floor, and stop there. Years that exist only as PDF on apa.virginia.gov are out of scope (PDF extraction would be its own future effort). Confirmed live: FY2024 final + FY2025 draft; Phase 79 determines how far back the XLSX series actually goes (target FY2015+, but **the real floor is whatever the portal publishes as XLSX** — report it honestly).

### Per-capita population
- **D-04: Per-year population estimate from each FY's Exhibit H.** Use that fiscal year's own "Population Estimates July" figure (Exhibit H) as the per-capita denominator — matches the FY and gives honest trends. Do NOT apply a single fixed vintage across years (the project's standing Key Decision: a single vintage creates false per-capita trends for fast-changing localities). Census 2020 is available in Exhibit H as a secondary reference only.

### Source attribution
- **D-05: Per-FY dataset/file URL as `source_url`, `data_source` = "Virginia APA Comparative Report".** Each row links to the specific data.virginia.gov dataset (or its direct XLSX resource URL) for that fiscal year; `source_date` = fetch date. Most specific, strongest for the Phase 83 source-chain audit. (This is more specific than Utah's bare-domain bar — the per-FY file is itself durable on the CKAN portal.)

### Claude's Discretion (for the planner)
- **Exact column-index map per exhibit** — the headers are wide with merged cells and interleaved raw-$ / per-capita / percent columns; parse the **raw-$ columns only** and recompute any derived figures. Some derived cells are `[object Object]` formula objects in exceljs — ignore them.
- **Locality-name → `municipalities` matching** — Exhibit col 2 carries bare names ("Alexandria", "Falls Church"); the loader maps to the DB entity. Independent cities are `entity_type='city'`; Phase 79 only proves the city path (Alexandria). County/town `entity_type` handling carries forward to Phases 80–81 (mirror the Utah `--entity-type` flag).
- **CLI shape** — mirror `loadUtahTransparency.js` flags (`--dry-run`, per-locality/per-FY selection); planner decides exact flags.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source (recon'd — read first)
- Auto-memory `reference_virginia_apa_comparative_report` — verified granularity, the 19-sheet Exhibit A–H structure, CKAN API + direct file URL, loader caveats (merged headers, raw-$ vs derived, `[object Object]` cells), independent-city note, both target cities confirmed.
- FY2024 XLSX direct URL: `https://data.virginia.gov/dataset/5545748d-4746-4437-9f2d-636410e206b5/resource/90a9af12-5771-41ec-8424-b93163ddf80d/download/fy2024-comparative-report.xlsx`. CKAN API: `https://data.virginia.gov/api/3/action/package_show?id=<dataset-slug>`. Local recon sample: `_va-recon/fy2024-comparative-report.xlsx` (gitignored).

### Loader pattern to mirror (the model)
- `scripts/loadUtahTransparency.js` — the closest analog: `buildTree(rows, opts)` (configurable tree levels), `importEntityData()` → `treasury_ensure_municipality` + `treasury_sync_city_budget` RPCs, the **pre-skip never-overwrite guard** (`neverOverwriteDecision` on existing `data_source`), per-FY source columns, `--dry-run`. Swap its BigQuery fetch for an `exceljs` XLSX parse.
- `scripts/bulkLoadXLSX.js`, `scripts/loadMaGFExcel.js`, `scripts/processRichardsonBudget.js` — existing `exceljs`-based XLSX parsing precedents (column-map dispatcher style).

### Data-model / sourcing facts
- Auto-memory `project_sync_city_budget_not_source_safe` — `treasury_sync_city_budget` RPC OVERWRITES existing (muni,fy,dataset) rows and keeps a stale `data_source` label; the loader MUST keep the pre-skip never-overwrite guard (as the Utah loader does).
- Reuse the budget-tree shape and the `data_source` / `source_url` / `source_date` columns already used by every loader.

### Phase / milestone context
- `.planning/REQUIREMENTS.md` — VASRC-01/02 (this phase) + the rest of v2.7.
- `.planning/ROADMAP.md` Phase 79 — goal + 4 success criteria.

No external ADRs/specs — requirements + decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadUtahTransparency.js` — `buildTree` + `importEntityData` + never-overwrite guard + offline unit-test structure; the template for this loader (BQ fetch → XLSX parse is the only real swap).
- `exceljs` (project dependency, already installed) — used to read the XLSX; confirmed it parses the 19-sheet workbook cleanly in recon.
- `treasury_ensure_municipality` + `treasury_sync_city_budget` Supabase RPCs — the write path every loader uses.

### Established Patterns
- **Never-overwrite guard** — check existing `(muni, fy, dataset_type)` `data_source` and skip if a different/richer source already loaded it (the RPC itself is not source-safe).
- **Always-sourced** — every row carries `data_source` / `source_url` / `source_date`; Phase 83's source-chain audit expects 0 NULL/fragile/residue.
- **Idempotent loaders** — re-run changes nothing (VALOAD-04 carries this into Phase 80).
- **Offline unit tests** for pure parser logic (tree build, column mapping) before any live write — mirrors the Utah 23-test approach.

### Integration Points
- Writes to `treasury.budgets` (dataset_type `operating` = expenditure, `revenue` = revenue) via the RPCs.
- Population: per-year Exhibit H figure stored on the `municipalities` row (per-capita denominator) — same mechanism as TX/OR/Utah population loaders.
- Phase 80 consumes this loader to bulk-load 38 cities + 95 counties; Phase 81 adds towns + the Virginia state node + linking.
</code_context>

<specifics>
## Specific Ideas

- **Prove-before-bulk:** Alexandria FY2024 dry-run must reproduce ≈$864M expenditures / ≈$874M local revenue (the recon-verified figures) before any write — the explicit de-risk gate for the whole milestone.
- The 8 expenditure functions and their C-1…C-8 activity sub-exhibits ARE the icicle the citizen sees — keep the function labels human-readable (the report's labels are already plain-language: "Public Safety", "Education", etc.).
</specifics>

<deferred>
## Deferred Ideas

- **PDF backfill for pre-XLSX fiscal years** — out of scope (D-03); a possible future effort if deeper history is wanted.
- **Enterprise activities (Exhibit F — water/sewer/utilities)** — deferred to a future milestone (VAENT-01).
- **Debt & debt-service (Exhibits E/G) and capital projects (Exhibit D)** — deferred (VADEBT-01 / VACAP-01).
- **Salaries/compensation** — not in this source; out of scope for v2.7.

None of the above blocks Phase 79.
</deferred>

---

*Phase: 79-va-apa-source-loader*
*Context gathered: 2026-06-22*
