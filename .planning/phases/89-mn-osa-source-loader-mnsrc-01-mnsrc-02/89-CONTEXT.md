# Phase 89: MN OSA Source + Loader (MNSRC-01, MNSRC-02) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the ONE reusable `exceljs` loader that turns the Minnesota Office of the State Auditor "City/County Finances Report" raw XLSX (`cired_YY_data.xlsx`, `Governmental Funds` sheet) into the tracker's revenue + expenditure trees for any MN entity, prove it against an RCV anchor city, pin the available XLSX fiscal-year range, and **pin + layout-verify the county file** so the bulk phases don't repeat Ohio's late-caught county-layout defect. This is the **de-risk phase — NO bulk load** (all ~853 cities load in Phase 90; all 87 counties in Phase 91).

**In scope (MNSRC-01, MNSRC-02):**
- A reusable parser+loader (`exceljs`) reading the `Governmental Funds` sheet (one row per entity, ~148 columns) and writing one entity's **revenue** (revenue-by-source tree) and **expenditure** (expenditure-by-function tree) into Supabase via the existing budget RPCs, every row durably sourced to osa.state.mn.us.
- A **3-level-where-natural** tree build (see D-01) consuming the workbook's leaf + subtotal columns.
- Per-entity **GAAP/Cash basis from the `GAAPInd` column** (single workbook + flag — NO cross-workbook fallback, unlike Ohio).
- Idempotent + never-overwrite guard (the RPC is not source-safe).
- A dry-run that reproduces **Minneapolis** (latest confirmed FY) — parsed tree sums tie to that row's own `Total Revenues` / `Total Expenditures` — with zero writes, **plus** a dry-run of one small **Cash-basis** city to prove the `GAAPInd` path.
- Determine + document the available XLSX FY range (~2015–latest; FY2023 confirmed downloaded, FY2024 if now published).
- **Pin the county file URL + dry-run-parse ONE county** to verify its layout (header row, columns, vocabulary, `ParentEntityName`/`Population` presence) against the city layout.
- Offline unit tests for the parser (tree build, column mapping, subtotal-vs-leaf de-dup, basis resolution).

**Not in scope:** bulk loading cities (Phase 90); bulk county loads + MN state node + city→county linking (Phase 91); enrichment (Phase 92); verification/ACFR reconciliation/UAT (Phase 93). Enterprise funds (`Enterprise Funds` sheet → MNENT-01), employee/compensation (`Employee Data` sheet → MNSAL-01), pre-2015 CSV/ZIP history (MNHIST-01), townships/special districts (MNTWN-01) — all deferred to v2.
</domain>

<decisions>
## Implementation Decisions

### Tree depth & shape
- **D-01: 3-level where natural (variable depth).** Build as deep as the columns naturally nest; leaves land at different levels.
  - **Revenue:** root → source group → sub-source where columns support it. e.g. Intergovernmental → {Federal Grants, State Grants, County/Local Grants} → grant types (CDBG, Education, Transportation, LGA, County Program Aid, …); Taxes → {Property, Tax Increments, Franchise, Sales, Hotel/Motel, Gambling, Gravel}; Charges for Services → by-function fees (General Govt, Police/Fire Contracts, Street, Sanitation, Library, Park & Rec, Airport, Transit, Cemetery, Other). Groups with no natural sub-structure (Special Assessments, Licenses & Permits, Fines & Forfeits, Interest, Other) stay shallow leaves.
  - **Expenditure:** root → function → sub-function → {current/capital} where natural. e.g. Public Safety → {Police, Fire, Corrections, Ambulance, Other} → {Current, Capital}; Streets & Highways → {Admin, Maintenance, Snow/Ice, Engineering, Lighting, Construction, …}. Functions with only current+capital (Sanitation, Health, Library, Parks & Rec, Housing, Economic Dev, Conservation, Airport, Transit, Cemetery, Education) → function → {Current, Capital}.
- **D-02: Current-expend vs capital-outlay kept as the deepest leaves** wherever both exist (e.g. Public Safety→Police→{Current, Capital}). Surfaces operating-vs-investment — the most granular honest view, consistent with the 3-level choice. (This is the structural difference that makes MN's icicle drill-down work where Ohio's flat source could not — see [[project_flat_source_icicle_limitation]].)
- **D-03: Built-in subtotal columns become parent nodes, NOT additional leaves.** `Total Federal Grants`, `Total State Grants`, `Total Intergovernmental Revenues`, `Total Charges for Services`, `Total Current Expenditures`, `Total Capital Outlay` etc. are the workbook's own roll-ups — use them as the parent/group totals and place the itemized columns beneath them. **Do not sum a subtotal AND its component leaves into the same parent (double-count hazard).** Parse raw-$ columns only; recompute/validate group sums against the workbook subtotal.

### Revenue / expenditure totals
- **D-04: Revenue total INCLUDES Intergovernmental** (state Local Government Aid + federal/county aid) as a labeled top-level group. **Rationale:** MN expenditures are the full governmental-funds total, funded partly by that aid (LGA is a large MN revenue share), so including intergovernmental keeps Money In and Money Out on the same basis and reconciles cleanly. Excluding it (the VA D-02 approach) would imply a false deficit because the MN expenditure comparator is all-governmental-funds, not local-only. **Mirrors Ohio D-01; diverges from VA by design (different basis).**
- **D-05: Use the CORE total lines — `Total Revenues` and `Total Expenditures` — EXCLUDING other financing sources/uses** (bonds issued, short/long-term debt issued, interfund transfers, sale of assets, other financing sources/uses). These are not income/spending in the citizen sense and including them risks double-counting (a bond is borrowed, not earned). Do NOT use `Total Revenues & Other Sources` / `Total Expenditures & Other Uses`. **Mirrors Ohio D-04b.** Cleanest ACFR basis for Phase 93 reconciliation.

### De-risk proof scope
- **D-06: Headline proof = Minneapolis, latest confirmed XLSX FY.** Biggest MN city + longest-running RCV jurisdiction. The dry-run parses Minneapolis's `Governmental Funds` row and its tree sums must tie to that row's own `Total Revenues` / `Total Expenditures` columns (self-consistency gate) with zero writes. Exact latest FY pinned in this phase (FY2023 confirmed downloaded; use FY2024 if now published).
- **D-07: ALSO dry-run one small Cash-basis (`GAAPInd`) city** to prove the basis-flag path + any smaller-entity column quirks BEFORE the Phase 90 bulk (mirrors Ohio's CASH/MOD de-risk). Planner picks a concrete Cash-basis entity from the workbook.

### County de-risk scope
- **D-08: Phase 89 pins the county file URL + dry-run-parses ONE county to verify its layout** (header row, column positions, category vocabulary, presence of `ParentEntityName`/`Population`/`GAAPInd`) against the city layout — then notes any divergences for the parser. **This directly forecloses the Ohio county-layout defect** (county header row/cols/vocab differed from cities and wasn't caught until the Phase 88 re-derivation, forcing a mid-milestone gap-closure — see [[project_ohio_aos_county_vs_city_layout]]). Bulk county load stays in Phase 91 (MNCO-01).

### Claude's Discretion (for researcher + planner)
- **Exact column-index map** for the `Governmental Funds` sheet — wide ~148-col layout; parse raw-$ columns only, recompute derived figures, skip any exceljs `[object Object]` formula-cell artifacts (known VA/Ohio-loader gotcha). Recon's column list (PropertyTaxes…Total Expenditures & Other Uses) is in [[reference_minnesota_osa_finances_report]].
- **Basis handling** — single workbook + `GAAPInd` flag; record the per-entity basis tag (feeds Phase 90 MNCITY-02). No cross-workbook fallback needed (simpler than Ohio).
- **Source attribution** — per-FY direct file URL as `source_url` (`https://www.osa.state.mn.us/media/<slug>/cired_<YY>_data.xlsx` — the `<slug>` differs per file, so scrape the cities/counties landing pages to enumerate; do NOT guess slugs), `data_source` = "Minnesota Office of the State Auditor City/County Finances Report", `source_date` = fetch date.
- **Per-FY manifest file** — a `mnOsaDatasets.json` analog to `ohioAosDatasets.json` / `vaApaDatasets.json` listing the year→workbook URLs (city + county) and the resolved FY range.
- **Per-capita population** — per-year `Population` column on the `municipalities` row (no single fixed vintage — standing project Key Decision).
- **Entity-name matching** — `Entity Name` + `ParentEntityName` (county) columns; `Entity Type` = "City"/county. County entities + the MN state node + city→county linking via `ParentEntityName` carry forward to Phase 91 — Phase 89 only proves the city path + county-layout de-risk.
- **CLI shape** — mirror `loadOhioAOS.js` / `loadVAComparativeReport.js` flags (`--dry-run`, `--fy`, `--entity`/`--city`, `--entity-type` for county, basis is auto from `GAAPInd`); planner decides exact flags.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source (recon'd — read first)
- Auto-memory `reference_minnesota_osa_finances_report` — the v2.9 source of record: confirmed icicle-grade granularity (downloaded + inspected `cired_23_data.xlsx`), the 5-sheet workbook structure (`Governmental Funds` = the 148-col operating+revenue spine; `Enterprise Funds`/`Debt`/`Fund Balance`/`Employee Data` deferred), the full `Governmental Funds` column list (identity + 2-level revenue-by-source + 2-level expenditure-by-function + subtotal columns), the `cired_<YY>_data.xlsx` direct file-URL pattern (per-file `<slug>` → scrape to enumerate), built-in `ParentEntityName`(county)/`Population`/`GAAPInd`. **County file URL still TBD — pin it in this phase (D-08).**

### Loader pattern to mirror (the model)
- `scripts/loadOhioAOS.js` (+ `scripts/loadOhioAOS.test.mjs`, `scripts/loadOhioAOSBatch.js`) — the most recent flat-wide-XLSX→budget-tree loader; column→node map, basis tag, never-overwrite guard, `--dry-run`/`--fy`/`--entity-type`, offline tests, `ohioAosDatasets.json` manifest. Closest analog — swap Ohio's flat 1-level column map for MN's 3-level-where-natural build (D-01/D-02/D-03).
- `scripts/loadVAComparativeReport.js` (+ `.test.mjs`) — `exceljs` parser + `importLocality`, raw-$ column handling, `[object Object]` skip, per-FY source columns; the multi-level-tree reference (VA built function→activity).
- `scripts/loadUtahTransparency.js` (+ `.test.mjs`) — `buildTree(rows, opts)` with configurable tree levels (closest to MN's variable-depth need), `importEntityData()` → `treasury_ensure_municipality` + `treasury_sync_city_budget` RPCs, pre-skip never-overwrite guard, `--entity-type`.
- `scripts/ohioAosDatasets.json` / `scripts/vaApaDatasets.json` — the per-FY dataset-manifest precedent for `mnOsaDatasets.json`.

### Data-model / sourcing facts
- Auto-memory `project_sync_city_budget_not_source_safe` — `treasury_sync_city_budget` OVERWRITES existing (muni,fy,dataset) rows + keeps a stale `data_source` label; the loader MUST keep the pre-skip never-overwrite guard.
- Auto-memory `project_ohio_aos_county_vs_city_layout` — the county-layout lesson driving D-08 (verify county labels + re-derive totals independently; don't trust city layout).
- `treasury.budgets` dataset_type `operating` = expenditure, `revenue` = revenue; every row carries `data_source`/`source_url`/`source_date` (Phase 93 source-chain audit expects 0 NULL/fragile/residue).

### Phase / milestone context
- `.planning/REQUIREMENTS.md` — MNSRC-01/02 (this phase) + the rest of v2.9.
- `.planning/ROADMAP.md` Phase 89 — goal + 4 success criteria.
- `.planning/milestones/v2.8-phases/84-ohio-aos-source-loader/84-CONTEXT.md` — the Ohio equivalent of this phase; near-identical decision shape (note D-04 here mirrors Ohio D-01 on intergovernmental; D-01/D-02 DIVERGE from Ohio's flat 1-level by building 3-level — MN's source supports drill-down).

No external ADRs/specs — requirements + decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadOhioAOS.js` / `loadVAComparativeReport.js` / `loadUtahTransparency.js` — parser + `buildTree`/`importEntity` + never-overwrite guard + offline-test structure; the template for this loader. Main swaps: MN's `Governmental Funds` flat-wide layout + the 3-level-where-natural build (Utah's configurable-level `buildTree` is the closest existing multi-level builder).
- `exceljs` (already installed) — reads the multi-sheet MN workbook (proven across VA/MA/Ohio loaders).
- `treasury_ensure_municipality` + `treasury_sync_city_budget` Supabase RPCs — the write path; `treasury.budgets` operating/revenue datasets.
- `ohioAosDatasets.json` / `vaApaDatasets.json` — manifest pattern for `mnOsaDatasets.json`.

### Established Patterns
- **Never-overwrite guard** — check existing `(muni, fy, dataset_type)` `data_source`; skip if a different/richer source already loaded it.
- **Always-sourced** — every row carries `data_source`/`source_url`/`source_date`.
- **Idempotent loaders** — re-run changes nothing (carries into Phase 90/91 bulk).
- **Per-year population** on the `municipalities` row as the per-capita denominator (no single fixed vintage).
- **Offline unit tests** for pure parser logic before any live write.

### Integration Points
- Writes to `treasury.budgets` (operating = expenditure, revenue = revenue) via the RPCs.
- Population from the `Population` column → `municipalities` row.
- Phase 90 consumes this loader to bulk-load ~853 cities (incl. Cash-basis); Phase 91 adds 87 counties + the MN state node + city→county linking via `ParentEntityName`.

</code_context>

<specifics>
## Specific Ideas

- **Prove-before-bulk gate:** Minneapolis (latest FY) dry-run tree sums MUST tie to the row's own `Total Revenues` / `Total Expenditures` before any write — the explicit de-risk gate for the milestone. Add a small Cash-basis city dry-run alongside it (D-07), and a one-county layout dry-run (D-08).
- The MN AOS labels are already plain-language ("Property Taxes", "Police/Sheriff", "Streets & Highways", "Library", "State Local Government Aid") — keep them human-readable for the icicle; the 3-level groups (Intergovernmental→Federal/State, Public Safety→Police/Fire) ARE what the citizen drills into.
- Minneapolis + St. Paul are the headline RCV anchors that Phase 93 will ACFR-reconcile; proving Minneapolis here pre-stages that.

</specifics>

<deferred>
## Deferred Ideas

- **Enterprise funds (`Enterprise Funds` sheet)** — deferred to v2 (MNENT-01).
- **Employee/compensation data (`Employee Data` sheet)** — Utah-style names-free salaries tree; deferred to v2 (MNSAL-01).
- **Pre-2015 CSV/ZIP history (back to ~2002)** — legacy-format parsing; deferred to v2 (MNHIST-01); document the XLSX floor in this phase.
- **Townships + special districts** — deferred to v2 (MNTWN-01); cities + counties are the v2.9 spine.

None of the above blocks Phase 89.

</deferred>

---

*Phase: 89-mn-osa-source-loader-mnsrc-01-mnsrc-02*
*Context gathered: 2026-06-27*
