# Phase 81: Towns + Virginia Data Model & Linking - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Source:** Authored inline from locked milestone decisions + live source/schema/frontend recon (per [[feedback_no_research_subagents]] — no discuss-phase/research subagents). One product fork (VA state-node role) confirmed with Chris 2026-06-22 via AskUserQuestion → "Full hub in picker".

<domain>
## Phase Boundary

Complete the Virginia cohort's **structure**: (1) load all reporting **towns** (§5 of the APA Comparative Report) with the same datasets/granularity as Phase 80's cities+counties, and (2) put the **Virginia navigation model** in place — a Virginia state node, standalone independent cities, standalone county nodes, and towns linked to their parent county — so the app reads **US → Virginia → locality**.

The data loader, parser, RPCs, never-overwrite guard, per-FY sourcing, and section-scoped homonym safety are all **already built and proven** (Phases 79–80). The frontend navigation primitives (`EntitySwitcher` state grouping, `Breadcrumb`, `CitiesInStatePanel`, `CitiesInCountyPanel`, `StatesInFederalPanel`, `county_id` parent linking) **already exist**. This phase adds only: a town branch in the batch driver, a town population fallback, an authored+sourced town→county map, a Virginia state-node seed, and the small frontend touches that make towns/counties reachable from the Virginia hub.

**In scope (VALOAD-03, VALINK-01):**
- All **37 reporting towns** (§5; Abingdon…Wytheville) loaded with operating (expenditure function→activity) + revenue (source→sub-source) + per-capita, FY2023 + FY2024-amended, every row sourced, idempotently.
- A **Virginia state node** (`entity_type='state'`, `state='VA'`, name "Virginia") — a navigation hub, **no budget datasets** (the APA source is local-government-only; there is no VA state budget here).
- **Linking + navigation:** towns carry `county_id` → their parent county municipality row; independent cities stay standalone (`county_id` null); counties stay standalone nodes; the Virginia hub is **selectable from the top-level picker** and lists its cities, counties, and towns; towns show a US→Virginia→County→Town breadcrumb and appear in their county's localities panel.
- Idempotency preserved (re-running any loader/seed changes nothing).

**Not in scope:**
- Enrichment (Phase 82), full source-chain audit + sample-ACFR reconciliation + milestone UAT sign-off (Phase 83).
- Enterprise (Exhibit F), debt (E/G), capital (D), salaries — out of milestone scope / not in source.
- Pre-FY2023 history (PDF-only; out of scope per 79 D-03).
- A VA state-level budget dataset (no such data in the APA source).
</domain>

<decisions>
## Implementation Decisions

### Town load (VALOAD-03)
- **D-01: Towns reuse the entire Phase 79/80 pipeline; only a work-list branch + a population fallback are new.** The batch driver `enumerateRoster()` ALREADY segments towns (§2/index-2, by "No."-reset; "Total"/"Grand Total" excluded by name). `ENTITY_TYPE_SECTION = { city:0, county:1, town:2 }` and the section-scoped lookup already exist. Add a `town` branch to the work-list builder so `--entity-type town` loads `{ matchName: name, displayName: name, entityType:'town', sectionIndex:2 }` for each town. The CHECK constraint **already allows `'town'`** (migration `20260612100000_add_federal_entity_type.sql`) — **no schema migration needed**.
- **D-02: Towns are stored with BARE display names** ("Abingdon", "Vienna"), `entity_type='town'`. Verified safe: **zero town↔city bare-name collisions**, and the 6 town↔county overlaps (Bedford, Culpeper, Orange, Pulaski, Tazewell, Wise) do NOT collide because counties are stored as "<name> County" (Phase 80 D-05). The XLSX match name = bare col-2 value; section-scoped lookup (§2) keeps towns from resolving to a same-named city/county row.
- **D-03: Town population comes from Exhibit A, NOT Exhibit H.** Exhibit H (Demographic & Tax Data) has **no town section** — `localityPopulation()` returns null for towns (graceful, no abort, but no per-capita). Add a town-population fallback that reads **Exhibit A** (header row 7; locality name in **col 4**; population in **col 2** "Population (Note 1-B)"), section-scoped to §2. This restores per-capita for towns. Cities/counties keep the Exhibit H path unchanged.
- **D-04: FY scope = FY2023 + FY2024-amended** (same as Phase 80 D-01; the only XLSX years; FY2024-amended is the adopted report — fills late-filers, changes no filed figures). Per-FY sourcing carried verbatim (Phase 80 D-07): `data_source='Virginia APA Comparative Report'`, `source_url` from `scripts/vaApaDatasets.json`, `source_date`=fetch date.
- **D-05: Absent towns skip cleanly** (reuse `importLocality`'s absent guard — a town listed with zero op+rev data is not written as $0 nor created as a phantom municipality). Record any absent towns the way Phase 80 recorded its 6 city/county gaps.

### Town → county linking (VALINK-01)
- **D-06: The APA report carries NO town→county column** (verified: Exhibits C and A have only name + financial columns). So the town→county relationship must come from an **authored, committed, sourced lookup** `data/vaTownCounties.json` — a `{ townName → countyDisplayName }` map for all 37 towns, every entry resolving to an existing VA county municipality ("<name> County"). Source it from a free official reference (U.S. Census Bureau place→county relationship data or a Commonwealth of Virginia / Census incorporated-places list); record the source URL + retrieval date in `_meta`. Towns spanning more than one county get their **primary/seat county** with a note. (This honors [[feedback_no_research_subagents]]'s inline-authored-data-file rule + the milestone's durable-sourcing constraint; the mapping is structural metadata, not a financial figure, but is still sourced.)
- **D-07: Linking sets `county_id` on each town's municipality row** → the id of its parent county municipality. `treasury.municipalities.county_id` already exists (migration `20260602235505`). Independent cities keep `county_id` NULL (standalone — VA cities are NOT inside counties, per [[reference_virginia_apa_comparative_report]]). Counties keep `county_id` NULL (they are the top sub-state node). Linking is idempotent (set-if-different; re-running changes nothing).

### Virginia state node + navigation (VALINK-01)
- **D-08: Seed a Virginia state node — navigation hub, no budget data.** `treasury_ensure_municipality` with name "Virginia", `state='VA'`, `entity_type='state'`, population from the 2020/latest Census VA total (sourced). No datasets. Mirrors how CA/MA state nodes exist, but with zero budget rows because the APA source has no state-level budget.
- **D-09: Show data-less state/federal nav nodes in the picker (Chris-confirmed 2026-06-22).** `EntitySwitcher` currently hides any node with no `available_datasets` (the `withData` filter). Relax it so **state/federal navigation nodes are always shown** (they are hubs, not data leaves) while ordinary localities still require data. This makes Virginia selectable from the top-level "State Governments" list → real **US→Virginia→locality** navigation. The breadcrumb resolver (`App.tsx` `jurisdictionParents`) already finds the state node from the full list, and already gives `town → [federal, state, county]` once `county_id` is set — so the breadcrumb works automatically.
- **D-10: The Virginia hub page must surface its cities, counties, AND towns.** `CitiesInStatePanel` already includes towns (filters out only state/federal/county/nonprofit) but **excludes counties**. Add a counties affordance on the state page (a `CountiesInStatePanel`, or a counties section) so all 95 VA counties are reachable from the hub. Update `CitiesInCountyPanel` (currently `entity_type === 'city'` only) to **also include `'town'`**, so a county page lists its towns in the localities panel (VALINK-01: "towns… appear in their county's localities panel").

### Claude's Discretion (for the planner)
- **Population fallback shape:** extend `localityPopulation` with an Exhibit A fallback (when Exhibit H is null), or add a small dedicated `townPopulationFromExhibitA` helper. Prefer the smallest change that keeps cities/counties on the Exhibit H path unchanged and is covered by an offline test.
- **Counties-on-state-page:** a new `CountiesInStatePanel` (mirrors `CitiesInStatePanel`) vs. a counties subsection inside the existing panel. Either is fine; reuse the available/coming-soon + filter-box pattern (95 counties exceed the 24 filter threshold).
- **Town→county source file:** JSON keyed by bare town name → county display name is simplest; include `_meta.source`/`_meta.retrieved`. A few towns (e.g. those split across counties) get the seat county + a per-entry note.
- **Run mechanics:** live writes need the gitignored `.env` SUPABASE_SERVICE_KEY; loaders/seeds run SERIAL on the main tree; `--dry-run` for no-write parse. Reuse the per-FY retry discipline from prior loaders.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The loader + driver to extend (built + proven Phases 79–80 — read first)
- `scripts/loadVAComparativeReportBatch.js` — `enumerateRoster()` already returns `{cities, counties, towns}`; the work-list builder (lines ~100–116) handles city/county and needs a `town` branch; `--entity-type` already accepts a comma list. The "towns out of scope" log line (115) updates this phase.
- `scripts/loadVAComparativeReport.js` — `importLocality`, `localityPopulation` (Exhibit H; **add town/Exhibit-A fallback** — D-03), `ENTITY_TYPE_SECTION` (town:2 exists), `findLocalityRowInSection`, `importDataset` (never-overwrite), `findHeaderRow`, `cellNum`, `cellText`, `headerCells`, `DATA_SOURCE_NAME`.
- `scripts/loadVAComparativeReport.test.mjs` — 12/12 offline tests (7 P79 + 5 P80); extend with town segmentation, town population (Exhibit A), and bare-name safety cases.
- `scripts/vaApaDatasets.json` — FY→{datasetUrl, xlsxUrl}; FY2023 + FY2024(+amended).

### Schema (already in place — no migration needed)
- `supabase/migrations/20260612100000_add_federal_entity_type.sql` — CHECK constraint **already includes `'town'`** (and 'state', 'federal').
- `supabase/migrations/20260602235505_add_county_id_to_municipalities.sql` — `municipalities.county_id` FK (Phase 25 city→county linking precedent + `seedMACountyLinks.js`).

### Frontend navigation primitives (already exist — extend, don't rebuild)
- `src/components/EntitySwitcher.tsx` — `withData` filter (line ~70) **relax for state/federal** (D-09); state grouping at ~73–79.
- `src/components/CitiesInStatePanel.tsx` — already includes towns, excludes counties (D-10).
- `src/components/CitiesInCountyPanel.tsx` — `entity_type === 'city'` only (line 17) → **add 'town'** (D-10).
- `src/components/StatesInFederalPanel.tsx`, `src/components/Breadcrumb.tsx` — patterns to mirror.
- `src/App.tsx` — `jurisdictionParents` (~552–577) already gives `town → [federal, state, county]`; state-page render at ~1290; `CitiesInCountyPanel` usage ~1282.
- `src/types/budget.ts` — `Municipality.county_id?` already typed (line ~149); `entity_type` union (confirm `'town'` present, add if missing).

### Precedent + sourcing facts
- Phase 80 record: `.planning/phases/80-city-county-loads/80-CONTEXT.md`, `80-VERIFICATION.md` (127/133 loaded; 6 documented source gaps; homonym safety proven).
- Auto-memory: [[reference_virginia_apa_comparative_report]] (VA cities are NOT inside counties), [[project_sync_city_budget_not_source_safe]] (never-overwrite guard required), [[reference_category_enrichment_nulls_distinct]] (Phase 82, not here), [[feedback_no_research_subagents]] (inline authoring + sourcing rule).

No external ADRs/specs — decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (almost everything)
- Full Phase 79/80 parse + write path (tree-builders, RPCs, never-overwrite guard, per-FY sourcing, section-scoped homonym-safe lookup, absent-skip). Towns add a work-list branch + population fallback only.
- Full frontend navigation kit: state grouping in the picker, breadcrumb resolver (town → fed+state+county), `CitiesInStatePanel`/`CitiesInCountyPanel`/`StatesInFederalPanel`, `county_id` parent linking + the Phase 25 county-breadcrumb UX.

### Verified source structure (FY2024 recon — `_va-recon/fy2024-comparative-report.xlsx`)
- **37 reporting towns** in §5 (Exhibit C col 2; "Total"/"Grand Total" are noise rows already skipped). Towns also appear in Exhibit A (name col 4, population col 2).
- **Exhibit H has NO town section** (D-03) — town per-capita must come from Exhibit A col 2.
- Town↔city bare-name collisions: **NONE**. Town↔county overlaps (Bedford, Culpeper, Orange, Pulaski, Tazewell, Wise) are disambiguated by the county "County" suffix.

### Integration Points
- Writes via `treasury_ensure_municipality` + `treasury_sync_city_budget`; `county_id` set on the `municipalities` row.
- Phase 82 (enrichment) consumes the town/function categories created here; Phase 83 verifies the full cohort + UAT.
</code_context>

<specifics>
## Specific Ideas
- **Per-capita-for-towns is the must-have proof of D-03:** assert at least one town (e.g. Blacksburg or Leesburg) loads a non-null population from Exhibit A and renders $/resident — not the null that the unmodified Exhibit-H path would yield.
- **Linking proof:** a town (e.g. Vienna → Fairfax County, Leesburg → Loudoun County) shows the full US → Virginia → <County> County → <Town> breadcrumb, and that county's page lists the town in its localities panel.
- **Standalone proof:** an independent city (e.g. Alexandria) shows US → Virginia → Alexandria (no county level); a county (e.g. Fairfax County) shows US → Virginia → Fairfax County and lists its cities + towns.
- **Hub proof:** "Virginia" is selectable in the top-level picker's State Governments list despite carrying no budget data, and its page lists cities, counties, and towns.
- Spot-check a town's FY2024 totals against the published report (one town cross-read).
</specifics>

<deferred>
## Deferred Ideas
- Town/function category enrichment — Phase 82 (VAENR-01).
- Sample-ACFR reconciliation + full-cohort source-chain audit + live-app UAT sign-off — Phase 83 (VAVER-01/02).
- A VA state-level budget dataset — no source exists in the APA report; out of milestone.
- Picking up the 6 absent cities/counties (and any absent towns) from a future amended/FY2025 report — idempotent re-run, no code change (Phase 80 residual gap).
</deferred>

---

*Phase: 81-towns-virginia-data-model-linking*
*Context gathered: 2026-06-22 (inline, no subagents; one product fork confirmed with Chris)*
