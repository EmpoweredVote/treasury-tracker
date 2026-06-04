# Phase 26: Sacramento CA Data Load - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Seed Sacramento's municipality row (population + data_source rows), run `loadSacramentoCSV.js` for operating + revenue across the full available history (FY2013–FY2026), run AI enrichment, and verify the city is visible in the app with correct totals and per-capita display.

`loadSacramentoCSV.js` is already written and handles both CSV schemas (older `account_type` col for FY2013–FY2018, newer `ExpenseRevenue` col for FY2019+), operating + revenue filtering, tree building, and the `treasury_sync_budget_tree` RPC. The main work of this phase is the seeder + execution + enrichment.

Note: Sacramento municipality row already exists in the DB (Phase 25 county linker created it and set `county_id` → Sacramento County). Population is currently null and must be set by this phase's seeder.

</domain>

<decisions>
## Implementation Decisions

### FY Range
- **D-01:** Load full available history — FY2013 through FY2026. Consistent with how prior CA cities (LA, SF, SD) loaded all available years. The script already handles both CSV schemas for this full range.

### Seeder
- **D-02:** Write a new `seedSacramentoCA.js` (not extend `seedCaliforniaCities.js`). The seeder must:
  1. Upsert Sacramento municipality with `population = 536000` (2024 Census), `population_year = 2024`
  2. Create "Sacramento Operating Budget" data_source row (dataset_type='operating')
  3. Create "Sacramento Revenue Budget" data_source row (dataset_type='revenue')
  4. Create `source_registry` row for `'open-budget-sacramento'` (used for UI attribution in `loadSacramentoCSV.js` backfill)
  Idempotent via name-based upserts — safe to re-run. Do NOT modify `county_id` (already set by Phase 25).

### Population
- **D-03:** Set `population = 536000`, `population_year = 2024` inline in `seedSacramentoCA.js` — same approach as SF and SD in `seedCaliforniaCities.js`. No separate `loadCAPopulation.js` for this phase.

### Plan Structure
- **D-04:** Two plans:
  - Plan 1: seed + dry-run + live-run `loadSacramentoCSV.js` (FY2013–FY2026, both types)
  - Plan 2: enrichment (`enrichCategories.js`) + app spot-check + verify success criteria

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary loader (already written)
- `scripts/loadSacramentoCSV.js` — the loader for this phase. Reads from Open Budget Sacramento GitHub repo CSVs. Handles both old (`account_type`) and new (`ExpenseRevenue`) CSV schemas. `--dry-run`, `--operating`, `--revenue`, `--fy` flags. Expects "Sacramento Operating Budget" + "Sacramento Revenue Budget" data_source rows and optional `source_registry` row to exist before running.

### Seeder patterns (templates for seedSacramentoCA.js)
- `scripts/seedCaliforniaCities.js` — idempotent upsert pattern for CA municipality + data_source rows. Use as template for seedSacramentoCA.js structure.
- `scripts/seedLACountyLinks.js` — shows Sacramento municipality already exists (queries `OTHER_COUNTY_CITIES.SACRAMENTO` by name, sets county_id). Do NOT overwrite `county_id` in Phase 26 seeder.

### Enrichment
- `scripts/enrichCategories.js` — run with `--city Sacramento --state CA --year YYYY`. Idempotent via `name_key` upsert. Estimated ~$0.06 total across all 7 CA cities in v1.6.

### Phase requirements
- `.planning/REQUIREMENTS.md` §DATA-01, §ENRICH-01 (Sacramento), §POPUL-01 (Sacramento) — success criteria and target FY range.
- `.planning/ROADMAP.md` §Phase 26 — success criteria (5 items including ~$1.6B operating total, ~536K per-capita).

### Established RPC + patterns
- `treasury_sync_budget_tree` RPC — called by `loadSacramentoCSV.js` with `p_data_source_id`, `p_fiscal_year`, `p_dataset_type`, `p_total`, `p_tree`, `p_row_count`, `p_triggered_by`.
- `treasury_list_source_ids` RPC — called by the loader to look up data_source rows by name. Seeder must create "Sacramento Operating Budget" + "Sacramento Revenue Budget" rows before loader is run.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/loadSacramentoCSV.js` — fully implemented; no changes needed. Just run it after seeding.
- `scripts/enrichCategories.js` — fully reusable; no changes needed.
- `scripts/seedCaliforniaCities.js` — use `upsertMunicipality()` and data_source upsert patterns as templates.

### Established Patterns
- Seeder → loader → enrichment → verify: the universal CA data load sequence.
- Idempotency: data_source upserts by name; loader deletes+reinserts via RPC; enrichment uses `name_key` upsert.
- Sacramento municipality row exists — seeder must UPDATE population, NOT re-insert; use the `upsertMunicipality` pattern that selects by `name + state` and updates if found.
- `county_id` on Sacramento was set by Phase 25's `seedLACountyLinks.js` — do not touch it in this phase.

### Integration Points
- `treasury.municipalities` — Sacramento row already exists; seeder updates population.
- `treasury.data_sources` — two new rows ("Sacramento Operating Budget", "Sacramento Revenue Budget") created by seeder.
- `treasury.source_registry` — one new row ("open-budget-sacramento") for UI attribution.
- `treasury.budgets` + `treasury.budget_categories` — populated by `loadSacramentoCSV.js` via `treasury_sync_budget_tree` RPC.
- `src/components/EntitySwitcher.tsx` — Sacramento already seeded with `state = 'CA'`; will appear under "California" group automatically once municipality row has budget data.

</code_context>

<specifics>
## Specific Ideas

- Full FY history (FY2013+) preferred for Sacramento — consistent with how LA/SF/SD were loaded.
- `source_registry` row for open-budget-sacramento should be created so the UI shows attribution text.
- Sacramento municipality row was created by Phase 25 for county_id purposes — verify that `loadSacramentoCSV.js`'s `treasury_list_source_ids` lookup succeeds after seeder runs (i.e., data_source rows are named exactly "Sacramento Operating Budget" and "Sacramento Revenue Budget" as expected by the loader).

</specifics>

<deferred>
## Deferred Ideas

- **`loadCAPopulation.js` reusable Census downloader** — useful for phases 28–30 (Oakland, San Jose, Long Beach, etc.) but out of scope for Phase 26. Planner for Phase 28 should evaluate whether to build it then or keep embedding population inline per city.

</deferred>

---

*Phase: 26-sacramento-ca-data-load*
*Context gathered: 2026-06-04*
