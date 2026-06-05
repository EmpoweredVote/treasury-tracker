# Phase 29: Long Beach + Bakersfield CA Data Load - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Seed Long Beach and Bakersfield municipality rows (population + data_source rows), write pdfplumber Python extractors for each city (or use bulkLoadBudget.js for Bakersfield if SODA endpoint is confirmed working), write Node.js processors to load operating + revenue budget data into the DB for FY2022–2026, run AI enrichment (guarded by $0.10 combined cost gate), and verify both cities are visible in the app with correct totals and per-capita display.

Port of Long Beach is a separate government entity — excluded entirely. Long Beach enterprise funds (Gas, Refuse, Water, Airport, Harbor) excluded. Target: ~$1.5B General Fund for Long Beach, ~$765M operating for Bakersfield.

</domain>

<decisions>
## Implementation Decisions

### Long Beach FY Convention
- **D-01:** Ending-year convention — Long Beach FY runs Oct 1 – Sep 30; "FY2025" = Oct 2024 – Sep 2025; integer `2025` stored in DB. Matches CA convention used by Sacramento, Oakland, San Jose.
- **D-02:** Non-standard FY period documented in seeder comment only (`// Long Beach FY runs Oct 1 – Sep 30; stored as ending year`). No DB schema change, no UI change. Consistent with how Sacramento FY label normalization was handled.

### Bakersfield Extraction Approach
- **D-03:** Researcher checks the SODA endpoint at `budget.bakersfieldcity.us` first. If a working SODA endpoint exists with clean budget data, use `bulkLoadBudget.js` (zero Python required). Fall back to PDF extraction only if SODA is broken, incomplete, or lacks multi-year history.
- **D-04:** If PDF extraction is needed, use pdfplumber. Consistent with all other CA city extractors in this milestone (Fremont, Oakland, San Jose). Researcher adapts `extractOakland.py` or `extractFremont.py` as a template.

### FY Depth
- **D-05:** Long Beach — target FY2022–2026 (4–5 years). Researcher determines how many adopted budget PDFs are available from Long Beach city site with consistent structure and loads as many as have reliable format. Prefer going back to at least FY2022 if available.
- **D-06:** Bakersfield — same target depth: FY2022–2026. Researcher determines what's available and which years have consistent PDF structure (or consistent SODA data if D-03 yields SODA path).

### Plan Structure
- **D-07:** Four plans:
  - Plan 1: Seed both cities (Long Beach + Bakersfield municipality rows, data_source rows, population)
  - Plan 2: Long Beach — write extractor (or confirm bulkLoadBudget.js if SODA), write processor, dry-run, live-run (operating + revenue)
  - Plan 3: Bakersfield — write extractor or confirm SODA loader, write processor, dry-run, live-run (operating + revenue)
  - Plan 4: Enrichment for both cities (with $0.10 combined gate) + app spot-check + verify success criteria
- **D-08:** Enrichment cost threshold is $0.10 combined (Long Beach + Bakersfield). Estimate before running; stop and ask if expected cost approaches $0.10. Tighter than the project-wide $5 threshold, consistent with Phase 28 practice.

### Claude's Discretion
- Exact number of FY years for each city: researcher determines based on available PDFs / SODA data with consistent format.
- Whether to use SODA vs PDF for Bakersfield: researcher verifies SODA endpoint quality and decides.
- Page-range extraction approach for Long Beach PDFs: researcher picks targeted vs full-document based on actual PDF layout.
- Exact data_source row names: planner determines; must match what processors look up via `treasury_list_source_ids`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §DATA-04 (Long Beach), §DATA-07 (Bakersfield), §ENRICH-01 (LB + BF), §POPUL-01 (LB + BF) — success criteria, fund scope, target totals
- `.planning/ROADMAP.md` §Phase 29 — goal, success criteria (6 items), plan structure

### Seeder patterns
- `scripts/seedOaklandSanJoseCA.js` — most recent CA city seeder; two-city seeder pattern with `upsertMunicipality()`, data_source rows, and inline population values
- `scripts/seedCaliforniaCities.js` — original CA seeder; `upsertMunicipality()` idempotent pattern

### Python extractor patterns
- `scripts/extractOakland.py` — most recent CA pdfplumber extractor; use as primary template for Long Beach (and Bakersfield if PDF needed)
- `scripts/extractFremont.py` — handles operating + revenue in same PDF; use for best-effort revenue approach
- `scripts/extractSanJose.py` — targeted page-range extraction; reference if Long Beach PDF is large

### Node.js processor patterns
- `scripts/processOakland.js` — most recent CA processor; orchestrator pattern (`execSync` Python → build tree → `treasury_sync_budget_tree` RPC); `resolvePdfDir()` worktree-safe helper
- `scripts/processFremont.js` — `toFullDollars()` helper (amounts in thousands in PDF); verify whether Long Beach / Bakersfield PDFs also use thousands
- `scripts/processSanJose.js` — reference for SUMMARY / FIVE-YEAR COMPARISON marker handling

### Socrata loader (Bakersfield SODA path)
- `scripts/bulkLoadBudget.js` — generic Socrata SODA loader; supports `fiscal_year_type: 'integer'` and `where_extra`; use if SODA endpoint at `budget.bakersfieldcity.us` is confirmed working

### Enrichment
- `scripts/enrichCategories.js` — run with `--city "Long Beach" --state CA --year YYYY` and `--city Bakersfield --state CA --year YYYY`. Idempotent via `name_key` upsert. **Hard cost gate: estimate before running; stop and ask if combined estimate exceeds $0.10.**

### Established RPC + DB patterns
- `treasury_sync_budget_tree` RPC — called by processors with `p_data_source_id`, `p_fiscal_year`, `p_dataset_type`, `p_total`, `p_tree`, `p_row_count`, `p_triggered_by`
- `treasury_list_source_ids` RPC — looks up data_source rows by name; seeder must create correctly-named rows before processor runs
- `treasury.municipalities` — `upsertMunicipality()` by name + state; Long Beach and Bakersfield rows likely do NOT exist yet

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extractOakland.py` — pdfplumber CA city extractor; adapt for Long Beach (and Bakersfield if needed)
- `scripts/extractFremont.py` — operating + revenue from one PDF; reuse for best-effort revenue
- `scripts/processOakland.js` — `resolvePdfDir()` worktree-safe helper; reuse for both processors
- `scripts/processFremont.js` — `toFullDollars(thousands)` helper; verify if PDF amounts are in thousands
- `scripts/enrichCategories.js` — no changes needed; fully reusable
- `scripts/seedOaklandSanJoseCA.js` — two-city seeder template; adapt for Long Beach + Bakersfield
- `scripts/bulkLoadBudget.js` — Socrata loader; use if Bakersfield SODA endpoint confirmed

### Established Patterns
- Python extractor (pdfplumber) → stdout JSON → Node.js processor (`execSync`) → `treasury_sync_budget_tree` RPC
- `docs/CityName/` directory per city for PDF files (e.g., `docs/Long Beach/`, `docs/Bakersfield/`)
- Idempotency: data_source upserts by name; loader deletes+reinserts via RPC; enrichment uses `name_key` upsert
- County linking: Long Beach (LA County — already linked, Phase 25) and Bakersfield (Kern County — not loaded) — `county_id` behavior: Long Beach may already be in the LA County 88-city list (check); Bakersfield stays NULL

### Integration Points
- `treasury.municipalities` — insert Long Beach and Bakersfield
- `treasury.data_sources` — 4 new rows for operating + revenue for each city (exact names TBD by planner)
- `src/components/EntitySwitcher.tsx` — both cities appear under "California" automatically once municipality rows with `state = 'CA'` have budget data
- Population values: Long Beach ~451K (`population = 451000`), Bakersfield ~417K (`population = 417000`), both `population_year = 2024` from Census `sub-est2024_06.csv`

</code_context>

<specifics>
## Specific Ideas

- Long Beach FY label: ending-year convention; document non-standard Oct–Sep period in seeder comment only — no DB or UI changes.
- Bakersfield: researcher checks SODA at `budget.bakersfieldcity.us` first — if SODA works, no Python extractor needed (use `bulkLoadBudget.js` directly). This could make Bakersfield the fastest plan in the phase.
- Port of Long Beach is a completely separate government entity (~$760M). It must be excluded at extraction time, not filtered in the processor. Extractor must not produce any Port rows.
- Long Beach county_id: check whether Long Beach is already in the Phase 25 LA County 88-city linked list. If so, `county_id` may already be set on existing rows (or seeder handles it).

</specifics>

<deferred>
## Deferred Ideas

- **County linking for Bakersfield (Kern County)** — Kern County government not loaded in DB; `county_id` stays NULL for Bakersfield in this phase.
- **Pre-FY2022 historical data** for Long Beach or Bakersfield — deferred per milestone scope; load what's available with consistent format back to FY2022, stop there.
- **Port of Long Beach data** — separate government entity; explicitly out of scope per REQUIREMENTS.md.

</deferred>

---

*Phase: 29-long-beach-bakersfield-ca-data-load*
*Context gathered: 2026-06-05*
