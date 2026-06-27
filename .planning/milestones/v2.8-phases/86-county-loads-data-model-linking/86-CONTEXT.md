# Phase 86 — County Loads + Data Model & Linking — Context

**Phase goal:** Ohio county governments are on the tracker and Ohio is navigable end-to-end — state node, county pages, and city→county links.
**Requirements:** OHCO-01 (county loads), OHLINK-01 (Ohio state node + city→county linking + US→Ohio→county→city breadcrumb + Cities-in-County panel)
**Depends on:** Phase 85 (253 Ohio cities live) + Phase 84 loader/manifest tooling.
**UI:** yes.

This phase mirrors the proven Virginia Phase 81 shape (`.planning/milestones/v2.7-phases/81-towns-virginia-data-model-linking/`): load the remaining entity tier (counties), set the parent-linking FK, and verify the navigation hub renders end-to-end. Almost everything needed already exists — this phase is mostly a small loader delta + a sourced linking pass + frontend verification.

## What's already in place (verified 2026-06-25)

- **County workbooks exist + parse with the EXISTING loader, unchanged.** `County_<YEAR>_<BASIS>_Summarized.XLSX` (GAAP/CASH/MOD, FY2016–2025) all return HTTP 200. The county GAAP workbook has the identical tab structure as cities (`SOREACIFB_TotalGov`, `OI_Demographics`); `detectLayout`, `enumerateCities`, `buildRevenueTree`/`buildExpenditureTree`, `cityPopulation`, `cityCounty` all work on it with no changes. The FY2024 GAAP county workbook enumerates **63 counties** ("Ashland County", "Ashtabula County", …); `cityPopulation("Ashland County")=52447`, `cityCounty("Ashland County")="Ashland"`.
- **`treasury.municipalities.county_id` FK exists** (migration `20260602235505`); the `entity_type` CHECK already allows `'county'` and `'state'` — **no schema migration needed**.
- **The Ohio state node ALREADY exists** — `name="Ohio"`, `entity_type='state'`, `population=11,799,448` (2020 Census), data-less hub. OHLINK-01's state-node requirement is satisfied; this phase only verifies it.
- **The full frontend navigation kit already exists and is wired** (built for MA Phase 25, extended for VA Phase 81): `EntitySwitcher` already shows `entity_type='state'` nodes regardless of data (line ~79 `withData` relaxation); `CitiesInCountyPanel.tsx`, `Breadcrumb.tsx` present; `App.tsx` `jurisdictionParents` already resolves `county_id` → county parent → US→state→county→locality breadcrumb (lines ~559–560). Ohio is structurally identical to the VA cohort, so once counties load + cities link, the UI renders Ohio automatically.

## Implementation Decisions

- **D-01: County FY range = full FY2016–2025**, parity with the Phase 85 city load (Phase 85 D-01). ~63 GAAP counties × up to 10 FY × 2 datasets + CASH/MOD backfill. Idempotent + never-overwrite make re-runs safe.

- **D-02: Counties reuse the entire Phase 84/85 pipeline — the only new code is an `entity_type` parameter + a county manifest.** `importCity` currently hardcodes `p_entity_type: 'city'` (line ~427). Add an `entityType` opt (default `'city'`) threaded to `p_entity_type`. Counties load with `entityType: 'county'` — **mandatory** per auto-memory `project_utah_loader_entity_type_and_display_names` (else a phantom city row is created). The batch driver gets `--entity-type city|county` (default city).

- **D-03: County source_url via a parallel county manifest.** `_loadManifest`/`resolveSourceUrl` currently hardcode `scripts/ohioAosDatasets.json`. Add `scripts/ohioAosCountyDatasets.json` (same shape: `entity_type:"county"`, `url_pattern` for `County_<YEAR>_<BASIS>`, FY2016–2025 × {GAAP,CASH,MOD}, probed HTTP-200, floor 2016) and parameterize `resolveSourceUrl(fy, basis, entityType='city')` + `_loadManifest(entityType)` to select the right file. The city manifest is unchanged.

- **D-04: County display name = the bare source name, which ALREADY carries the " County" suffix** ("Ashland County", "Franklin County"). Counties are standalone nodes — `county_id` stays NULL (they are the top sub-state tier; mirrors VA Phase 80 D-05 + Phase 81 D-07). Per-capita from `OI_Demographics` (D-06 of Phase 85 applies).

- **D-05: City→county linking is SOURCED DIRECTLY from the workbook — no authored map (the key contrast with VA).** Ohio's `OI_Demographics` carries a `County` column; `cityCounty(workbook, cityName)` already returns it (e.g. Columbus→"Franklin"). The linking pass reads each city's County value and sets `municipalities.county_id` → the id of the `"<County> County"` municipality (cityCounty + " County"). Linking is idempotent (set-if-different). Cities whose County value has no matching loaded county municipality are recorded as a link-residual (no crash, no phantom county). VA's `vaTownCounties.json` authored map is NOT needed here.

- **D-06: Linking direction.** Ohio cities are inside counties (unlike VA's independent cities): every Ohio city gets `county_id` set → US→Ohio→County→City breadcrumb. Counties keep `county_id` NULL. The Ohio state node is the hub.

- **D-07: Live writes run SERIALLY on the main tree** with the gitignored `.env` `SUPABASE_SERVICE_KEY` sourced; idempotent + never-overwrite guarded (Phase 85 D-05). A failures log captures per-entity errors without aborting.

- **D-08: County source-gap residual → extend the committed residual record.** Counties present in `OI_Demographics` but absent from every basis workbook are documented (reuse the Phase 85 `ohioCityResidual.json` mechanism or a sibling `ohioCountyResidual.json`) — no phantom municipalities.

- **D-09: Frontend is verify-first, not rebuild.** The components exist and render the VA cohort identically. Plan 86-03 confirms Ohio renders US→Ohio→county→city (state node selectable, county pages show data, city breadcrumb shows its county, Cities-in-County panel lists the county's cities), makes only minimal Ohio-specific touches if a gap surfaces, runs a build/test gate, and produces a HUMAN-UAT doc.

## Reused precedent / anchors

- `scripts/loadOhioAOS.js` (Phase 84) + `scripts/loadOhioAOSBatch.js` (Phase 85) — the loader + batch driver; works on counties unchanged except entity_type + manifest.
- VA `.planning/milestones/v2.7-phases/81-towns-virginia-data-model-linking/` — the data-model/linking/state-node/UI precedent (81-CONTEXT D-06..D-09).
- `supabase/migrations/20260602235505_add_county_id_to_municipalities.sql` — `county_id` FK; `seedMACountyLinks.js` (Phase 25) — the city→county linking precedent.
- Frontend: `src/components/EntitySwitcher.tsx` (state grouping + state-node visibility), `src/components/CitiesInCountyPanel.tsx`, `src/components/Breadcrumb.tsx`, `src/App.tsx` `jurisdictionParents`.
- Auto-memory: `project_utah_loader_entity_type_and_display_names` (--entity-type county mandatory), `project_sync_city_budget_not_source_safe` (never-overwrite guard mandatory), `reference_treasury_budgets_probe_columns` (use `total_budget`/`hierarchy`, not `total`/`tree`).

## Out of scope

- Category enrichment (OHENR-01) — Phase 87.
- Cross-phase source-chain audit + UAT (OHVER-01) — Phase 88.
- Salaries / enterprise funds — not in source (milestone constraints).
