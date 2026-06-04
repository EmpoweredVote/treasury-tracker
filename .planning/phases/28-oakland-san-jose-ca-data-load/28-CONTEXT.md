# Phase 28: Oakland + San Jose CA Data Load - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Seed Oakland and San Jose municipality rows (population + data_source rows), write pdfplumber Python extractors for each city, write Node.js processors to load operating + revenue budget data into the DB, run AI enrichment (guarded by $0.10 cost cap), and verify both cities are visible in the app with correct totals and per-capita display.

Zero AI cost for extraction — pdfplumber is pure Python. Enrichment uses Claude Haiku with a hard gate: estimate before running; stop and ask if expected cost exceeds $0.10 for Oakland + San Jose combined.

</domain>

<decisions>
## Implementation Decisions

### Oakland FY Depth
- **D-01:** Load deeper history — researcher determines how many biennial PDFs are available from oaklandca.gov and loads as many as have consistent structure. Prefer going back at least to FY2021 (3 biennials = 6 years) if document formats are compatible.
- **D-02:** Single extractor pass yields both fiscal years from one biennial PDF (not two separate passes with a `--fy` flag). The extractor detects FY per page and emits rows for both FY N and FY N+1. Matches the Portland Vol 1 per-page FY detection pattern.

### San Jose Fund Scope
- **D-03:** General Fund only (~$1.7–1.9B). Filter to the General Fund at extraction time. Do NOT load enterprise funds (Airport, Wastewater, Water). Matches the success criteria and avoids misleading citizens with enterprise fund spending they don't fund directly.
- **D-04:** Researcher determines the PDF page extraction approach (targeted page-range vs. full document scan) based on the actual San Jose budget PDF structure. Researcher also determines FY range based on what's available at sanjoseca.gov and which years have consistent General Fund summary format.

### Revenue Data Strategy
- **D-05:** Best-effort revenue from the operating budget PDF. If the operating budget PDF contains a clear revenue / sources-of-funds section, extract and load it. If a dedicated revenue document exists and is accessible, use it. If neither provides clean revenue data, note it as a deferred item for a future phase rather than blocking this phase.
- **D-06:** Oakland's primary fund is displayed as-is: "General Purpose Fund" (GPF). Do NOT normalize to "General Fund." Use the actual Oakland terminology in data_source names and tree node fund labels.

### API Cost Gate
- **D-07:** Enrichment runs only if the estimated API cost for Oakland + San Jose combined is under $0.10. Before calling `enrichCategories.js`, verify the estimated row count and token cost. If the estimate approaches $0.10, stop and ask before proceeding. Well under the $5 project threshold, but tightened per user preference for this phase.

### Plan Structure
- **D-08:** Four plans:
  - Plan 1: Seed both cities (Oakland + San Jose municipality rows, data_source rows, population)
  - Plan 2: Oakland — write extractor, write processor, dry-run, live-run (operating + revenue)
  - Plan 3: San Jose — write extractor, write processor, dry-run, live-run (operating + revenue)
  - Plan 4: Enrichment for both cities (with $0.10 gate) + app spot-check + verify success criteria

### Claude's Discretion
- Exact FY range for Oakland: researcher determines which biennial PDFs are available and have consistent format.
- Exact FY range for San Jose: researcher determines what's available and which years use a consistent General Fund summary structure.
- PDF page extraction approach for San Jose: researcher picks targeted page-range vs. full-document based on actual PDF layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §DATA-02 (Oakland), §DATA-03 (San Jose), §ENRICH-01 (Oakland + San Jose), §POPUL-01 (Oakland + San Jose) — success criteria, fund scope, and target totals
- `.planning/ROADMAP.md` §Phase 28 — goal, success criteria (6 items), plan structure

### Seeder patterns (templates for Phase 28 seeders)
- `scripts/seedCaliforniaCities.js` — idempotent `upsertMunicipality()` pattern for CA cities; use as template for Oakland + San Jose seeder
- `scripts/seedSacramentoCA.js` — separate-seeder pattern for a single CA city with existing municipality row; Phase 28 should follow this per-city approach (or one combined seeder for both cities — planner decides)

### Python extractor patterns
- `scripts/extractPortland.py` — pdfplumber extractor; per-page FY detection (`detect_fiscal_year()`) matches Oakland biennial approach (D-02); multi-year single-pass model
- `scripts/extractGresham.py` — simpler pdfplumber extractor for reference
- `scripts/extractFremont.py` — CA city pdfplumber extractor; handles both revenues and expenditures in the same PDF (best-effort revenue, D-05)

### Node.js processor patterns
- `scripts/processPortland.js` — orchestrator: `execSync` Python extractor → build tree → `treasury_sync_budget_tree` RPC; worktree-safe PDF path resolution pattern
- `scripts/processFremont.js` — CA city processor pattern; handles `toFullDollars()` conversion (amounts in thousands in PDF); builds operating + revenue trees from one extraction

### Enrichment
- `scripts/enrichCategories.js` — run with `--city Oakland --state CA --year YYYY` and `--city "San Jose" --state CA --year YYYY`. Idempotent via `name_key` upsert. **Hard cost gate: estimate before running; stop and ask if combined Oakland + San Jose estimate exceeds $0.10.**

### Established RPC + DB patterns
- `treasury_sync_budget_tree` RPC — called by processors with `p_data_source_id`, `p_fiscal_year`, `p_dataset_type`, `p_total`, `p_tree`, `p_row_count`, `p_triggered_by`
- `treasury_list_source_ids` RPC — looks up data_source rows by name; seeder must create correctly-named data_source rows before processor runs
- `treasury.municipalities` — `upsertMunicipality()` by name + state; Oakland and San Jose rows likely do NOT exist yet (unlike Sacramento which was pre-created by Phase 25)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extractPortland.py` — multi-year biennial FY detection; reuse `parse_fy()` / `detect_fiscal_year()` logic for Oakland's biennial format
- `scripts/extractFremont.py` — same-PDF operating + revenue extraction; reuse for best-effort revenue approach (D-05)
- `scripts/processPortland.js` — worktree-safe `resolvePdfDir()` helper; reuse for Oakland + San Jose processors
- `scripts/processFremont.js` — `toFullDollars(thousands)` helper (PDF values in thousands); verify whether Oakland/SJ PDFs also use thousands
- `scripts/enrichCategories.js` — no changes needed; fully reusable
- `scripts/seedCaliforniaCities.js` — `upsertMunicipality()` — no changes needed; use as template

### Established Patterns
- Python extractor (pdfplumber) → stdout JSON → Node.js processor (`execSync`) → `treasury_sync_budget_tree` RPC
- `docs/CityName/` directory per city for PDF files (e.g., `docs/Portland/`, `docs/Fremont/`)
- Idempotency: data_source upserts by name; loader deletes+reinserts via RPC; enrichment uses `name_key` upsert
- County linking: Oakland (Alameda County) and San Jose (Santa Clara County) counties NOT loaded — `county_id` stays NULL for both cities in this phase

### Integration Points
- `treasury.municipalities` — insert Oakland and San Jose (no pre-existing rows expected)
- `treasury.data_sources` — 4 new rows: "Oakland General Purpose Fund Operating Budget", "Oakland General Purpose Fund Revenue Budget", "San Jose General Fund Operating Budget", "San Jose General Fund Revenue Budget" (exact names TBD by planner — must match what processor looks up via `treasury_list_source_ids`)
- `src/components/EntitySwitcher.tsx` — both cities appear under "California" automatically once municipality rows with `state = 'CA'` have budget data
- Population values: Oakland ~444K (`population = 444000`), San Jose ~997K (`population = 997000`), both `population_year = 2024` from Census `sub-est2024_06.csv`

</code_context>

<specifics>
## Specific Ideas

- Oakland's fund must be called "General Purpose Fund" throughout — in data_source row names, in tree node fund labels, in any documentation. Do NOT call it "General Fund."
- Enrichment cost gate is $0.10 (not the project-wide $5.00) — tighter threshold per user preference for this phase.
- pdfplumber is the only extraction tool for this phase. No Claude Haiku vision pipeline, no Socrata API, no CSV downloads.
- If revenue data is not cleanly available in the operating budget PDFs, note it as deferred (per D-05) and ship the phase with operating-only rather than blocking.

</specifics>

<deferred>
## Deferred Ideas

- **County linking for Oakland (Alameda County) + San Jose (Santa Clara County)** — future phase; those county governments not yet loaded in the DB
- **`loadCAPopulation.js` reusable Census downloader** — suggested in Phase 26 context; still deferred; Phase 28 embeds population values inline in the seeder per the established pattern
- **Older Oakland biennials (pre-FY2021)** — if researcher finds that format changed significantly before FY2021, older years are a deferred item

</deferred>

---

*Phase: 28-oakland-san-jose-ca-data-load*
*Context gathered: 2026-06-04*
