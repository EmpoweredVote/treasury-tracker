# Phase 30: Fresno + Riverside CA Data Load - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Seed Fresno and Riverside municipality rows (population + data_source rows), write pdfplumber Python extractors for each city, write Node.js processors to load operating + revenue budget data into the DB, run AI enrichment (guarded by $0.10 combined cost gate), and verify both cities are visible in the app with correct totals and per-capita display.

Fresno: General Fund only (~$483M); enterprise funds (~$899M total) excluded at extraction time. FY2020–2026 target depth.

Riverside: General Fund only (~$1.45B/year); RPU electric utility and all other enterprise/proprietary funds excluded at extraction time. Biennial budget — researcher goes as deep as consistent structure allows, preferring ~3 biennials (~6 FYs).

</domain>

<decisions>
## Implementation Decisions

### Fresno FY Depth
- **D-01:** Target FY2020–2026 (6–7 years). Researcher determines how many adopted budget PDFs are available from the Fresno city site with consistent structure and loads as many as available back to FY2020. If format changes significantly before FY2022, stop at FY2022.

### Riverside FY Depth
- **D-02:** Same approach as Oakland — go as deep as consistent structure allows, preferring ~3 biennials (~6 FYs). Researcher determines which biennial PDFs are available from the Riverside city site and how far back the format is compatible.
- **D-03:** Single extractor pass yields both fiscal years from one biennial PDF (same Oakland per-page FY detection pattern). No separate per-year passes required.

### Fund Filter Scope
- **D-04:** Fresno — General Fund only (strict). Filter to rows explicitly labeled as "General Fund" at extraction time. Target total ~$483M. Exclude all enterprise/proprietary funds.
- **D-05:** Riverside — General Fund only (strict). Filter to General Fund rows at extraction time. Excludes RPU (electric utility), Water, Sewer, and all other enterprise/proprietary funds. Target total ~$1.45B/year.
- **D-06:** Filtering happens at extraction time (in the Python extractor) — do not produce enterprise rows at all. This is the established CA city pattern (same as San Jose in Phase 28).

### Revenue Data Strategy
- **D-07:** Best-effort revenue from operating budget PDF — same as Phase 28 D-05. If the operating budget PDF contains a clear revenue / sources-of-funds section, extract and load it. If revenue data is not cleanly available, note it as deferred rather than blocking the phase. Do NOT search for standalone revenue documents unless operating PDF yields nothing.

### Plan Structure
- **D-08:** Four plans:
  - Plan 1: Seed both cities (Fresno + Riverside municipality rows, data_source rows, population)
  - Plan 2: Fresno — write extractor, write processor, dry-run, live-run (operating + revenue)
  - Plan 3: Riverside — write extractor (biennial, per-page FY detection), write processor, dry-run, live-run (operating + revenue)
  - Plan 4: Enrichment for both cities (with $0.10 combined gate) + app spot-check + verify success criteria
- **D-09:** Fresno runs first (Plan 2 before Plan 3). Simpler single-year format establishes the pattern; Riverside's biennial complexity handled once the baseline is working.
- **D-10:** Enrichment cost gate is $0.10 combined (Fresno + Riverside). Estimate before running; stop and ask if expected cost approaches $0.10. Consistent with Phase 28 and Phase 29 practice.

### Claude's Discretion
- Exact number of FY years for each city: researcher determines based on available PDFs with consistent format.
- PDF page extraction approach for Fresno: researcher determines targeted vs. full-document scan based on actual PDF layout.
- Number of biennials for Riverside: researcher determines how many PDFs are available with compatible structure.
- Exact data_source row names: planner determines; must match what processors look up via `treasury_list_source_ids`.
- Whether to use `toFullDollars()` helper: researcher verifies if PDF amounts are in thousands (as with Fremont/San Jose) or full dollars.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §DATA-05 (Fresno), §DATA-06 (Riverside), §ENRICH-01 (Fresno + Riverside), §POPUL-01 (Fresno + Riverside) — success criteria, fund scope, target totals
- `.planning/ROADMAP.md` §Phase 30 — goal, success criteria (6 items), plan structure

### Seeder patterns
- `scripts/seedLongBeachBakersfieldCA.js` — most recent two-city CA seeder; use as primary template for Fresno + Riverside seeder
- `scripts/seedOaklandSanJoseCA.js` — prior two-city seeder; two-city pattern with `upsertMunicipality()`, data_source rows, and inline population values
- `scripts/seedCaliforniaCities.js` — original CA seeder; idempotent `upsertMunicipality()` pattern reference

### Python extractor patterns
- `scripts/extractOakland.py` — most recent CA pdfplumber extractor with biennial (per-page FY detection); use as primary template for Riverside
- `scripts/extractLongBeach.py` — most recent single-year CA extractor; use as primary template for Fresno
- `scripts/extractSanJose.py` — targeted page-range extraction reference; use if Fresno PDF is large
- `scripts/extractFremont.py` — handles operating + revenue in same PDF; reference for best-effort revenue approach (D-07)

### Node.js processor patterns
- `scripts/processOakland.js` — most recent CA processor; orchestrator pattern (`execSync` Python → build tree → `treasury_sync_budget_tree` RPC); `resolvePdfDir()` worktree-safe helper; use as primary template
- `scripts/processLongBeach.js` — most recent single-year CA processor; reference
- `scripts/processFremont.js` — `toFullDollars()` helper (amounts in thousands in PDF); verify whether Fresno/Riverside PDFs also use thousands

### Enrichment
- `scripts/enrichCategories.js` — run with `--city Fresno --state CA --year YYYY` and `--city Riverside --state CA --year YYYY`. Idempotent via `name_key` upsert. **Hard cost gate: estimate before running; stop and ask if combined estimate exceeds $0.10.**

### Established RPC + DB patterns
- `treasury_sync_budget_tree` RPC — called by processors with `p_data_source_id`, `p_fiscal_year`, `p_dataset_type`, `p_total`, `p_tree`, `p_row_count`, `p_triggered_by`
- `treasury_list_source_ids` RPC — looks up data_source rows by name; seeder must create correctly-named rows before processor runs
- `treasury.municipalities` — `upsertMunicipality()` by name + state; Fresno and Riverside rows likely do NOT exist yet

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extractOakland.py` — biennial per-page FY detection; use as primary template for Riverside extractor
- `scripts/extractLongBeach.py` — single-year CA extractor; use as primary template for Fresno extractor
- `scripts/extractFremont.py` — operating + revenue from same PDF; reuse best-effort revenue approach (D-07)
- `scripts/processOakland.js` — `resolvePdfDir()` worktree-safe helper; reuse for both processors
- `scripts/processFremont.js` — `toFullDollars(thousands)` helper; verify if Fresno/Riverside PDFs use thousands
- `scripts/enrichCategories.js` — no changes needed; fully reusable
- `scripts/seedLongBeachBakersfieldCA.js` — two-city seeder template; adapt for Fresno + Riverside

### Established Patterns
- Python extractor (pdfplumber) → stdout JSON → Node.js processor (`execSync`) → `treasury_sync_budget_tree` RPC
- `docs/CityName/` directory per city for PDF files (e.g., `docs/Fresno/`, `docs/Riverside/`)
- Idempotency: data_source upserts by name; loader deletes+reinserts via RPC; enrichment uses `name_key` upsert
- County linking: Fresno (Fresno County) and Riverside (Riverside County) — neither county loaded in DB; `county_id` stays NULL for both cities in this phase
- Extraction-time fund filter: do NOT produce enterprise fund rows; filter in Python extractor, not in Node.js processor

### Integration Points
- `treasury.municipalities` — insert Fresno and Riverside (no pre-existing rows expected)
- `treasury.data_sources` — 4 new rows: "Fresno General Fund Operating Budget", "Fresno General Fund Revenue Budget", "Riverside General Fund Operating Budget", "Riverside General Fund Revenue Budget" (exact names TBD by planner — must match what processor looks up via `treasury_list_source_ids`)
- `src/components/EntitySwitcher.tsx` — both cities appear under "California" automatically once municipality rows with `state = 'CA'` have budget data
- Population values: Fresno ~550K (`population = 550000`), Riverside ~324K (`population = 324000`), both `population_year = 2024` from Census `sub-est2024_06.csv`

</code_context>

<specifics>
## Specific Ideas

- Fresno fund label: "General Fund" throughout — in data_source row names, in tree node fund labels. Do NOT include enterprise fund rows.
- Riverside fund label: "General Fund" — RPU electric utility and all other enterprise/proprietary funds excluded at extraction time, not post-hoc.
- Riverside biennial: same Oakland pattern — single extractor pass detects FY per page and emits rows for both FY N and FY N+1.
- Do NOT confuse Riverside (city) with Riverside County — these are separate entities. City of Riverside only.
- If revenue data is not cleanly present in the operating PDFs, note as deferred and ship operating-only rather than blocking.

</specifics>

<deferred>
## Deferred Ideas

- **County linking for Fresno (Fresno County) + Riverside (Riverside County)** — neither county government is loaded in DB; `county_id` stays NULL for both cities in this phase.
- **Pre-FY2020 historical data for Fresno** — if researcher finds format changed significantly before FY2020, older years are deferred.
- **Older Riverside biennials** — if format changed significantly before the target depth, older biennials are deferred.

</deferred>

---

*Phase: 30-fresno-riverside-ca-data-load*
*Context gathered: 2026-06-05*
