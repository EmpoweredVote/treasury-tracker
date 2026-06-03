# Phase 17: Portland OR Budget Load - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Load Portland, OR municipal budget data into Treasury Tracker so citizens can view operating and/or revenue spending with per-capita context and AI-enriched category descriptions — matching the pattern established for LA, SF, and SD in Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Data Source Format
- **D-01:** Researcher determines the data source format from scratch. Check `opendata.portland.gov` (Socrata) first — if a Socrata dataset exists with compatible structure, use `bulkLoadBudget.js` with no code changes.
- **D-02:** If Portland is NOT on Socrata, build a custom CSV loader following the `loadSanDiegoCSV.js` pattern. PDF pipeline (`bulkLoadPDF.js`) is a last resort. Do not block on Socrata availability.

### Budget Types
- **D-03:** Researcher determines which budget types to include based on data availability. If both operating and revenue are cleanly available, load both (matching the CA cities pattern). If only one is available without significant additional effort, scope to that type and note the other as a follow-up.

### Fiscal Year Depth
- **D-04:** Researcher checks what fiscal years are available in Portland's open data portal and recommends depth based on data quality and consistency. At minimum, target the most recent 1-2 fiscal years. Historical depth is a nice-to-have, not a requirement.

### Population Data
- **D-05:** Use Census Bureau subcounty estimates for Oregon (FIPS code 41, file `sub-est2024_41.csv`). Filter on `SUMLEV=162` (incorporated place) and `STNAME='Oregon'`. 2024 vintage population. Follow the same pattern as `loadTXPopulation.js` and `seedCaliforniaCities.js`.

### Enrichment
- **D-06:** Run `enrichCategories.js` for Portland after budget load — same pattern as all prior cities. Estimate API cost before running per the $5/run threshold rule.

### EntitySwitcher STATE_LABELS
- **D-07:** Add `OR: 'Oregon'` to `STATE_LABELS` in `src/components/EntitySwitcher.tsx` as part of this phase (same cosmetic fix already applied for TX in a prior commit).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior city expansion patterns
- `.planning/phases/16-california-cities-budget-load/16-01-SUMMARY.md` — bulkLoadBudget.js WHERE clause extensions (fiscal_year_type, where_extra)
- `.planning/phases/16-california-cities-budget-load/16-VERIFICATION.md` — verification checklist pattern for new city expansions
- `.planning/phases/15-los-angeles-socrata-budget-load-enrichment/15-01-SUMMARY.md` — Socrata loader seeder pattern

### Loader scripts (read before planning, not just referencing)
- `scripts/bulkLoadBudget.js` — primary Socrata loader; check column_mapping contract
- `scripts/loadSanDiegoCSV.js` — CSV loader fallback pattern
- `scripts/enrichCategories.js` — enrichment pipeline; check --city/--state/--year flags
- `scripts/loadTXPopulation.js` — Census subcounty CSV loader pattern
- `scripts/seedCaliforniaCities.js` — municipality + data_source seeder pattern

### Project context
- `.planning/PROJECT.md` — requirements, key decisions, constraints
- `.planning/STATE.md` — current DB coverage, known tech debt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/bulkLoadBudget.js` — zero code changes needed if Portland is on Socrata; configure via `column_mapping` in the data_source row
- `scripts/loadSanDiegoCSV.js` — copy-and-adapt for a Portland CSV if needed; handles double-quoted CSV, operating/revenue row type detection
- `scripts/enrichCategories.js` — fully reusable; `--city Portland --state OR --year YYYY`
- `scripts/loadTXPopulation.js` — adapt for Oregon by changing state FIPS (48→41) and state name filter
- `scripts/seedCaliforniaCities.js` — template for `seedPortlandOregon.js` (municipality upsert + data_source rows)

### Established Patterns
- All cities follow: seed municipality → seed data_sources → load budget → enrich → load population → verify
- `column_mapping` in `data_sources` drives loader behavior without code changes — `fiscal_year_type`, `where_extra`, `fiscal_year_column` are all opt-in keys
- Enrichment is idempotent via name_key upsert scoped to `municipality_id`
- `treasury_ensure_municipality` RPC handles municipality upsert

### Integration Points
- `src/components/EntitySwitcher.tsx` — add `OR: 'Oregon'` to `STATE_LABELS` (one line, same as TX fix)
- `treasury.municipalities` — Portland row created via seeder script
- `treasury.data_sources` — one row per budget type (operating, revenue) per Portland
- `treasury.budget_categories` + `treasury.category_enrichment` — auto-populated by loader + enrichment scripts

</code_context>

<specifics>
## Specific Ideas

No specific requirements from discussion — open to standard approaches. Researcher has full discretion on data source format selection, budget type scoping, and FY depth based on what Portland's open data portal actually provides.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-Portland OR Budget Load*
*Context gathered: 2026-05-31*
