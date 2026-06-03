# Phase 25: LA County Data Completion + County-City Linking - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix and complete Los Angeles County's budget data (Money In + Money Out) by replacing incorrectly-sourced data with accurate county-government figures, then establish the app's first county-city relational model — a `county_id` FK on municipalities, populated for all LA County cities (and other CA counties we can match), with bidirectional UI navigation: county pages show a city roster, city pages show a breadcrumb back to their county.

**Three sub-goals:**
1. **Data accuracy** — Current LA County operating/revenue data was loaded from city-aggregate datasets (all 88 cities summed), not the county government's own budget. Full clean reload from the correct CA State Controller county datasets (uctr-c2j8 + emxv-k8xv). Fix population = 0. Repair orphaned FY2025 operating (null data_source_id). Load missing FY2025 revenue.
2. **Schema** — Add `county_id UUID REFERENCES treasury.municipalities(id)` to the municipalities table. Seed county rows for LA County (budget loaded), San Diego County, Sacramento County, and Alameda County (linking only — no budget data for those counties in this phase). Set county_id for all matching CA cities.
3. **UI** — County page: budget view + "Cities in [County]" panel (two sections: Available now / Coming soon). City pages: "Los Angeles County →" breadcrumb chip using the existing Breadcrumb component.

</domain>

<decisions>
## Implementation Decisions

### Data reload scope
- **D-01:** Full clean reload — delete all existing LA County `operating` and `revenue` budget rows (and any orphaned data_source rows), then reload FY2021–2025 from the CA State Controller county-government datasets (uctr-c2j8 for operating, emxv-k8xv for revenue). Salaries rows are accurate and must NOT be touched.
- **D-02:** FY2026 — researcher checks the Socrata API for FY2026 county data availability. Include FY2026 if present; cap at FY2025 if not. No preference for one outcome over the other — just be accurate about what's published.
- **D-03:** Population — set `population = 10014009`, `population_year = 2020` (2020 Census figure). Same approach used for all TX and OR municipalities. No need to check a newer vintage for this phase.

### County-city linking scope
- **D-04:** `county_id` is populated for ALL 80+ LA County cities already seeded in the DB — not just those with budget data. The county page should show the full roster of incorporated cities.
- **D-05:** Extend county linking to other CA counties: seed county municipality rows for San Diego County, Sacramento County, and Alameda County (entity_type='county'). Set county_id for San Diego city (→ SD County), Sacramento city (→ Sacramento County), Berkeley and Fremont (→ Alameda County). No budget data loaded for these county rows in this phase — linking only.
- **D-06:** San Francisco is a consolidated city-county government — there is no separate SF County entity. Leave SF's `county_id = null`. Do not create an SF County municipality row.

### County page UI
- **D-07:** County page layout — budget view comes first (same icicle/Money In/Money Out tabs as any entity), followed by a "Cities in [County Name]" panel below the budget. The county is a government entity with its own budget, not just a container.
- **D-08:** City roster panel — two labeled sections: **"Available now"** (cities with budget data, clickable) and **"Coming soon"** (cities without data, listed but not clickable — signals future coverage). Not grayed-out without label, not hidden.
- **D-09:** City → county navigation — add "Los Angeles County →" (or the appropriate county name) as a clickable breadcrumb above the city name when a city has a `county_id` set. Uses the existing `Breadcrumb` component at `src/components/Breadcrumb.tsx` — no new component needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data loaders (primary templates — already built for this phase)
- `scripts/loadLACountyOperating.js` — loads from CA State Controller uctr-c2j8 (county expenditures). Has dry-run flag. Uses `treasury_sync_city_budget` RPC. This is the primary template for 25-01.
- `scripts/loadLACountyRevenue.js` — loads from CA State Controller emxv-k8xv (county revenues). Same RPC pattern. Explicitly notes it replaces city-dataset-loaded data.
- `scripts/loadLACountySalaries.js` — salaries loader; DO NOT modify in this phase.

### DB patterns
- `.planning/phases/24-los-angeles-data-refresh/24-02-PLAN.md` — operating reload plan for LA City; identical RPC + clear + reload pattern applies here for LA County.
- `.planning/phases/22-troutdale-or-budget-load/` — population seeding pattern (`population_year = 2020`) used for all prior cities.

### Schema
- `src/types/budget.ts` line 111 — `entity_type: 'city' | 'county' | 'township' | 'nonprofit'` — county already a valid type; no change needed.
- `src/components/Breadcrumb.tsx` — existing component; `items: { label, onClick? }[]`. City pages pass a new item for county context when `municipality.county_id` is set.
- `src/components/EntitySwitcher.tsx` line 13 — `county: 'Counties'` group label already exists; counties render in their own group in the entity list.
- `src/api/municipalities.ts` — `ListMunicipalities` API response shape; `county_id` field must be added to the `Municipality` type in `src/types/budget.ts` and the API response when populated.

### Phase context
- `.planning/ROADMAP.md` §Phase 25 — goal, key data facts, plan breakdown.

### CA city seed list (for county_id population)
- `scripts/seedCaliforniaCities.js` — existing seeder; reference for which cities are in DB and their IDs. Planner should cross-reference against a list of LA County incorporated cities to identify which municipalities get county_id set.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Breadcrumb.tsx` — generic `{ label, onClick? }[]` component. City pages already use (or can use) it. Extend the breadcrumb items array with county when `municipality.county_id != null` — zero component changes needed.
- `scripts/loadLACountyOperating.js` + `scripts/loadLACountyRevenue.js` — scripts exist and work. Main task is extending fiscal year range and ensuring data_source rows are created properly.
- `treasury_sync_city_budget` Supabase RPC — established upsert pattern; handles total, tree, data_source_id. Same pattern used in Phases 15, 16, 20, 21, 22, 24.

### Established Patterns
- Clean-delete-reload: Phase 24 operating fix pattern (delete stale rows by municipality_id + dataset_type, then upsert fresh). Apply same pattern for LA County.
- Population seeding: direct `UPDATE treasury.municipalities SET population = X, population_year = Y WHERE id = Z`.
- Migration via MCP tool: `mcp__supabase-local__apply_migration` for all DDL (county_id FK column).
- County entity display: `EntitySwitcher` already segments by `entity_type` — counties appear in their own "Counties" group with no changes.

### Integration Points
- `src/App.tsx` — entity selection logic; `municipality.county_id` will be available after API update; use it to conditionally render the county breadcrumb.
- `ListMunicipalities` API (Supabase edge function or RPC) — must return `county_id` in the municipality payload for the frontend to use it. Researcher confirms whether this is an edge function or direct RPC and what changes are needed.
- County page "Cities in County" panel: new component needed (e.g., `CitiesInCountyPanel`). Researcher identifies the right place to inject it in the entity view layout.

</code_context>

<specifics>
## Specific Ideas

- The "Cities in [County]" panel should have two explicitly labeled sections: **"Available now"** and **"Coming soon"** — not just greyed-out items without a label.
- County breadcrumb on city pages: the label should be the county name (e.g., "Los Angeles County"), not a generic "County" label, and must be clickable to navigate to the county entity.
- The phase is the first time a county entity has real budget data AND UI prominence — make sure LA County's population ($10M residents) and per-capita figures render correctly in `PlainLanguageSummary`.

</specifics>

<deferred>
## Deferred Ideas

- **Loading budget data for non-LA County counties** (San Diego County, Sacramento County, Alameda County) — this phase only links cities to those counties via county_id; loading county government budgets for SD/Sacramento/Alameda is a future phase.
- **Texas county linking** (Collin County, Dallas County) — same county_id pattern could apply; deferred until TX county budget data is in scope.
- **Oregon county linking** (Multnomah County — Portland/Gresham/Troutdale) — same pattern; deferred.
- **Multi-county cities** — some cities span county lines; the single county_id FK doesn't model this. Not a problem for any city currently in the DB; deferred if it ever becomes relevant.

</deferred>

---

*Phase: 25-la-county-data-completion-county-city-linking*
*Context gathered: 2026-06-02*
