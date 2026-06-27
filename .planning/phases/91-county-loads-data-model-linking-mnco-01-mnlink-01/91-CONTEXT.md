# Phase 91: County Loads + Data Model & Linking (MNCO-01, MNLINK-01) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning
**Source:** Inline planning (no discuss-phase) — fully specified by ROADMAP + REQUIREMENTS + the Phase 89/90 handoff + the Ohio Phase 86 analog (whose county-layout defect is already foreclosed for MN by Phase 89 D-08). Live DB probed: a "Minnesota" state node already exists; 0 MN counties loaded.

<domain>
## Phase Boundary

Bulk-load all ~87 Minnesota **county** governments (operating + revenue, sourced, per-capita), establish the Minnesota state navigation node, and link every MN city to its parent county via the source `ParentEntityName` column — so the live app renders US → Minnesota → county → city. Reuses the Phase 89 loader + the Phase 90 batch/refresh tooling; reuses the EXISTING frontend (breadcrumb + Cities-in-County panel from Phase 25 / Ohio 86) — no rebuild.

**In scope (MNCO-01, MNLINK-01):**
- Extend the batch tooling for counties (`--entity-type county`) and live-load all counties across the county XLSX range **FY2013–FY2021** (county data lags cities — pinned in Phase 89 `mnOsaDatasets.json`).
- Verify/ensure the **Minnesota state node** (already present, entity_type='state', pop 5,706,494 — do NOT duplicate).
- **City→county linking** via the city file's `ParentEntityName` column (no authored map) → `municipalities.county_id`.
- County source-gap residual documented; no phantom municipalities.
- In-phase verification that the existing frontend renders the MN breadcrumb + Cities-in-County panel.

**Not in scope:** enrichment (Phase 92); ACFR reconciliation + source-chain audit + live UAT (Phase 93); any new frontend components (reuse only).
</domain>

<decisions>
## Implementation Decisions

- **D-01: County FY range = FY2013–FY2021** (the county XLSX availability pinned in Phase 89: `cored_<YY>` FY2013–2017 + `county_<YY>` FY2019–2021; gaps at 2012/2018; FY2022–2023 publish reports only; pre-2013 = legacy `.xls`, out of scope). ~87 counties (workbook has 85–87 rows/yr).
- **D-02: County municipalities stored as "`<Name> County`"** (e.g. "Hennepin County", "Aitkin County"). **Mandatory** because MN has same-named cities AND counties (e.g. Aitkin is both a city and a county) — bare names would collide. Mirrors the Ohio convention. Requires adding a `municipalityName` override to `importEntity` (the county batch passes `entityName="Aitkin"` for the workbook row lookup but `municipalityName="Aitkin County"` for the DB write — Ohio's `importCity` already had this; MN's `importEntity` needs it).
- **D-03: County basis = null/unknown.** County files have NO `GAAPInd` column (Phase 89 D-08) — `entityBasis` returns null for counties; documented, not an error. (No county basis file; the city `mnCityBasis.json` is unaffected.)
- **D-04: City→county linking from the city file's `ParentEntityName` column** (e.g. Minneapolis→"Hennepin"→ "Hennepin County" municipality) — NO authored map (MNLINK-01). `entityCounty(workbook, name, 'city')` already returns ParentEntityName. New `scripts/linkMNCitiesToCounties.js` mirrors `scripts/linkOhioCitiesToCounties.js` but reads ParentEntityName in-row (no separate demographics tab). Idempotent set-if-different; cities whose ParentEntityName has no matching loaded county → link-residual (never a phantom county).
- **D-05: Minnesota state node already EXISTS** (id d4b4897d, name "Minnesota", entity_type='state', pop 5,706,494). VERIFY/ensure it (mirror Ohio verifying its pre-existing node) — do NOT create a duplicate. Counties keep `county_id` NULL (top sub-state tier). Graph: US → Minnesota → "<Name> County" → city.
- **D-06: Per-capita county population** from the county file `Population` column → `municipalities.population`. Run `refreshMNPopulations.js --entity-type county` after the load (same insert-only `ensure_municipality` caveat as Phase 90). NOTE: the refresh must reconcile the workbook name ("Aitkin") with the DB name ("Aitkin County") — a county-suffix fix is needed in `refreshMNPopulations.js`.
- **D-07: Serial, idempotent, source-safe.** Reuse the never-overwrite guard inside `importDataset`; `--entity-type county` writes `entity_type='county'` (no phantom city row); county source_url from `resolveSourceUrl(fy,'county')`; `.env` SUPABASE_SERVICE_KEY sourced.
- **D-08: County source-gap residual → committed `scripts/mnCountyResidual.json`** (analog to `mnCityResidual.json` / `ohioCountyResidual.json`): counties enumerated but with no financial total (expect none); no phantom municipalities.
- **D-09: Frontend = existing components, no rebuild** (breadcrumb + `CitiesInCountyPanel` from Phase 25 / Ohio 86; `ev-accounts-api` already serves `county_id` + state nodes state-agnostically). Phase 91 only verifies the data makes the existing UI render for MN — NO new UI code, NO UI-SPEC. Full visual UAT is Phase 93.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tooling to reuse/extend (Phase 89/90 — proven)
- `scripts/loadMNOSA.js` — `importEntity` (needs a `municipalityName` override added — D-02), `entityCounty` (reads ParentEntityName — the link source), `entityBasis` (null for counties), `resolveSourceUrl(fy,'county')`, never-overwrite guard. Phase 89 proved `--entity-type county` ties on Aitkin/Anoka FY2021.
- `scripts/loadMNOSABatch.js` — city batch driver; **extend** `acquireWorkbook` + the loop for `--entity-type county` (county_url, canonical "<Name> County" via municipalityName). Currently city-only.
- `scripts/refreshMNPopulations.js` — already has `--entity-type county`; **fix** the workbook("Aitkin")↔DB("Aitkin County") name reconciliation (D-06).
- `scripts/mnOsaDatasets.json` — county_url per FY (FY2013–2021); `scripts/mnOsaTreeMap.json` — same tree-map (county-tolerant via label normalization).

### The model to mirror (Ohio Phase 86)
- `scripts/linkOhioCitiesToCounties.js` — the city→county `county_id` linker (set-if-different idempotent, link-residual, no phantom county). MN version reads `ParentEntityName` in-row instead of the OI_Demographics tab.
- `.planning/milestones/v2.8-phases/86-county-loads-data-model-linking/` (86-02 county load + linking; 86-03 frontend verification) — the plan shape. (86-04/05 were Ohio's county-layout gap-closure — N/A for MN, foreclosed by Phase 89 D-08.)
- `scripts/seedMACountyLinks.js` / `seedLACountyLinks.js` — earlier county_id linking precedents; the `municipalities.county_id` FK + `entity_type` CHECK('county','state') already exist (Phase 25/32).

### Data-model / sourcing facts
- Auto-memory `project_sync_city_budget_not_source_safe` — never-overwrite guard mandatory (inside `importDataset`).
- Auto-memory `feedback_supabase_migration_mcp` — prefer `mcp__supabase-local` execute_sql for read-only DB probes.
- Auto-memory `reference_treasury_budgets_probe_columns` — use `total_budget`/`hierarchy` column names (NOT `total`/`tree`) for budget probes.
- Auto-memory `project_utah_loader_entity_type_and_display_names` — county loads MUST write `entity_type='county'` (else phantom city row).
- `.planning/phases/90-.../90-02-SUMMARY.md` + `90-VERIFICATION.md` — Phase 90 outcome (858 cities, the population-vintage + GAAPInd-encoding findings).
- `.planning/REQUIREMENTS.md` — MNCO-01/MNLINK-01. `.planning/ROADMAP.md` Phase 91 — goal + 3 success criteria.
</canonical_refs>

<specifics>
## Specific Ideas
- Spot-check anchor: a Hennepin/Ramsey county read-back + Minneapolis.county_id → "Hennepin County"; Saint Paul.county_id → "Ramsey County".
- The 5 RCV anchor cities span Hennepin (Minneapolis, St. Louis Park, Bloomington, Minnetonka) + Ramsey (Saint Paul) — both counties should load + link.
- Idempotency: a second county-load + link run creates 0 new municipalities and changes 0 county_id values.
</specifics>

<deferred>
## Deferred Ideas
- Enrichment → Phase 92.
- ACFR reconciliation + source-chain audit + live UAT → Phase 93.
- County data for FY2022–2023 (not published as XLSX) — document the FY2021 ceiling; revisit if OSA publishes.

None blocks Phase 91.
</deferred>

---

*Phase: 91-county-loads-data-model-linking-mnco-01-mnlink-01*
*Context gathered: 2026-06-27 (inline)*
