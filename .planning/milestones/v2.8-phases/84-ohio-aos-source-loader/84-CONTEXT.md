# Phase 84: Ohio AOS Source + Loader - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the ONE reusable `exceljs` loader that turns the Ohio Auditor of State "Summarized Annual Financial Reports" (Hinkle System) all-cities XLSX into the tracker's revenue + expenditure trees for any city, prove it against Columbus FY2024, and pin down the available fiscal-year XLSX range. This is the **de-risk phase — no bulk load** (all ~235 cities load in Phase 85).

**In scope (OHSRC-01, OHSRC-02):**
- A reusable parser+loader (`exceljs`) reading the `SOREACIFB_TotalGov` tab (governmental funds) and writing one city's **revenue** (12 sources) and **expenditure** (~18 functions) into Supabase via the existing budget RPCs, every row durably sourced to ohioauditor.gov.
- GAAP workbook resolves as primary + CASH/MOD-basis workbooks as fallback for non-GAAP filers; the per-row/dataset **basis tag** (GAAP/CASH/MOD) is recorded (feeds Phase 85 OHCITY-02 mixed-basis-per-city tracking).
- Idempotent + never-overwrite guard (the RPC is not source-safe).
- A dry-run that reproduces Columbus FY2024 totals (Total Revenues ≈$2.166B, Income Taxes ≈$1.145B, Police ≈$810M) with zero writes, **plus** a dry-run parse of one CASH- or MOD-basis city to prove the fallback path.
- Determine the available XLSX fiscal-year range (recon: 2016–2025 .XLSX; 2013–2015 older .XLS); document the floor.
- Offline unit tests for the parser (tree build, column mapping, basis resolution).

**Not in scope:** bulk loading all cities (Phase 85); county loads + the Ohio state node + city→county linking (Phase 86); enrichment (Phase 87); verification/ACFR reconciliation/UAT (Phase 88). Enterprise funds (`SONP_*`/`SOREACINP_*`), salaries (not in source), townships/villages/libraries/schools — all out of milestone scope or deferred to v2.
</domain>

<decisions>
## Implementation Decisions

### Revenue tree + "Money In" total
- **D-01: Revenue total INCLUDES Intergovernmental — all 12 SOREACIFB sources = the statement "Total Revenues".** Top-level sources: Property Taxes, Income Taxes, PILOT, Special Assessments, **Intergovernmental**, Interest, Licenses/Permits, Fines/Forfeitures, Rentals, Charges For Services, Contributions/Donations, Other. Intergovernmental (state/federal aid) renders as one labeled source node — transparent, not hidden. **Rationale:** Ohio's expenditures are the FULL governmental-funds statement total (funded partly by that aid), so including intergovernmental keeps Money In and Money Out on the same basis and reconciles to `SOA_Gov`. Excluding it (the VA approach) would imply a false DEFICIT here — the inverse of VA's false-surplus concern, because VA's expenditure comparator was local-only. **This diverges from the VA D-02 decision by design; the basis differs.**

### Expenditure tree + "Money Out" total
- **D-02: Money Out = full SOREACIFB "Total Expenditures" line.** ~18 function nodes INCLUDING Capital Outlay and debt service (Principal Retirement, Interest/Fiscal Charges, Bond Issuance) and Intergovernmental expenditures. Matches the published statement total exactly → cleanest ACFR/`SOA_Gov` reconciliation, and consistent with the all-governmental-funds basis used for CA/Utah/VA. Capital Outlay + debt service surface as their own labeled function nodes (not stripped, not hidden).

### Tree shape / depth
- **D-04: Flat 1-level trees** — revenue = 12 source leaves under a root; expenditure = ~18 function leaves under a root. The SOREACIFB columns ARE the categories, so there is **no VA-style function→activity sub-level** (the transform is column→node, simpler than CA/Utah/VA's nested feeds).
- **D-04b: Exclude Other Financing Sources/Uses (transfers, bond/note proceeds, sale of assets) and fund-balance lines** from both trees — they are neither income nor spending in the citizen sense and would risk double-counting against the revenue/expenditure totals.

### De-risk proof scope
- **D-03: Prove Columbus FY2024 GAAP + one CASH/MOD-basis city** (user deferred to recommendation). Columbus GAAP is the headline proof (Total Rev ≈$2.166B, Income Taxes ≈$1.145B, Police ≈$810M, pop 913,985 from `OI_Demographics`). The CASH/MOD parse de-risks the NEW fallback path (smaller workbook shape + per-row basis tag) before the Phase 85 bulk, instead of discovering surprises mid-load. Planner picks a concrete CASH- or MOD-basis city from the smaller workbooks.

### Claude's Discretion (for researcher + planner)
- **Exact column-index map for `SOREACIFB_TotalGov`** — wide headers with possible merged cells / interleaved columns; parse the **raw-$ columns only** and recompute any derived figures. Ignore exceljs `[object Object]` formula-cell artifacts (a known VA-loader gotcha).
- **Source attribution** — mirror VA's D-05: per-FY+basis direct file URL as `source_url` (`https://ohioauditor.gov/references/SummarizedAnnualFinancialReports/SummarizedReports/City_<YEAR>_<BASIS>_Summarized.XLSX` — static, durable), `data_source` = "Ohio Auditor of State Summarized Annual Financial Reports", `source_date` = fetch date.
- **Per-FY+basis manifest file** — an `ohioAosDatasets.json` analog to `vaApaDatasets.json` listing the year×basis workbook URLs and the resolved FY range.
- **Per-capita population** — per-year `OI_Demographics` population on the `municipalities` row (same mechanism as VA Exhibit H / TX/OR/Utah loaders); do not apply a single fixed vintage across years (standing project Key Decision — false trends).
- **City-name → `municipalities` matching** — `SOREACIFB`/`OI_Demographics` carry city names (e.g. "Columbus"); cities are `entity_type='city'`. County (`OI_Demographics` has a `County` column) and the Ohio state node carry forward to Phase 86 — Phase 84 only proves the city path.
- **CLI shape** — mirror `loadVAComparativeReport.js` / `loadUtahTransparency.js` flags (`--dry-run`, `--fy`, `--city`/`--entity`, a `--basis` selector); planner decides exact flags.
- **Workbook fetch** — recon discovered the static file links by POSTing `entitytype=City` to the AOS page; the direct file-URL pattern is the durable fetch path (no auth). Verify the GAAP URL still resolves live at plan/research time and pull a fresh Columbus row.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source (recon'd — read first)
- Auto-memory `reference_ohio_aos_financial_data` — verified icicle-grade granularity (Columbus FY2024), the multi-tab workbook structure (`SOREACIFB_TotalGov` = the operating+revenue spine, `SOA_Gov` = full-accrual cross-check, `OI_Demographics` = population + `County` column, enterprise/`BS_*`/`LTOAYE` tabs), the direct `City_<YEAR>_<BASIS>_Summarized.XLSX` download pattern (BASIS ∈ {GAAP, MOD, CASH}; 2016–2025 .XLSX), GAAP=235 cities vs sparse MOD/CASH, and the loader implication (flat wide table → column→node map, reuse `treasury_sync_city_budget` RPC + never-overwrite guard).

### Loader pattern to mirror (the model)
- `scripts/loadVAComparativeReport.js` (+ `scripts/loadVAComparativeReport.test.mjs`) — the most recent `exceljs` XLSX→budget-tree loader: parser + `importLocality`, raw-$ column handling, `[object Object]` skip, per-FY source columns, never-overwrite guard, `--dry-run`, offline tests. Closest analog; swap the VA exhibit layout for the Ohio `SOREACIFB_TotalGov` flat-column layout.
- `scripts/loadUtahTransparency.js` (+ `.test.mjs`) — `buildTree(rows, opts)` (configurable tree levels), `importEntityData()` → `treasury_ensure_municipality` + `treasury_sync_city_budget` RPCs, the pre-skip never-overwrite guard, `--entity-type` flag (carries to Phase 86 counties), 23-test offline structure.
- `scripts/vaApaDatasets.json` — the per-FY dataset-manifest precedent for the `ohioAosDatasets.json` analog.

### Data-model / sourcing facts
- Auto-memory `project_sync_city_budget_not_source_safe` — `treasury_sync_city_budget` OVERWRITES existing (muni,fy,dataset) rows and keeps a stale `data_source` label; the loader MUST keep the pre-skip never-overwrite guard.
- Reuse the budget-tree shape + `data_source` / `source_url` / `source_date` columns every loader uses; `treasury.budgets` dataset_type `operating` = expenditure, `revenue` = revenue. Phase 88's source-chain audit expects 0 NULL/fragile/residue.

### Phase / milestone context
- `.planning/REQUIREMENTS.md` — OHSRC-01/02 (this phase) + the rest of v2.8.
- `.planning/ROADMAP.md` Phase 84 — goal + 4 success criteria.
- `.planning/milestones/v2.7-phases/79-va-apa-source-loader/79-CONTEXT.md` — the VA equivalent of this phase; near-identical decision shape (note D-01 here intentionally INVERTS VA's intergovernmental decision — see rationale).

No external ADRs/specs — requirements + decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadVAComparativeReport.js` / `loadUtahTransparency.js` — parser + `buildTree`/`importLocality` + never-overwrite guard + offline-test structure; the template for this loader (the only real swap is the XLSX layout: Ohio is a flat wide table vs VA's exhibit sheets / Utah's BQ feed).
- `exceljs` (`^4.4.0`, already installed) — reads the multi-tab Ohio workbook; proven to parse complex workbooks cleanly across VA + MA loaders.
- `treasury_ensure_municipality` + `treasury_sync_city_budget` Supabase RPCs — the write path; `treasury.budgets` operating/revenue datasets.
- `vaApaDatasets.json` — manifest pattern for year×basis workbook URLs.

### Established Patterns
- **Never-overwrite guard** — check existing `(muni, fy, dataset_type)` `data_source` and skip if a different/richer source already loaded it.
- **Always-sourced** — every row carries `data_source` / `source_url` / `source_date`.
- **Idempotent loaders** — re-run changes nothing (carries into Phase 85 bulk).
- **Per-year population** on the `municipalities` row as the per-capita denominator (no single fixed vintage).
- **Offline unit tests** for pure parser logic before any live write.

### Integration Points
- Writes to `treasury.budgets` (operating = expenditure, revenue = revenue) via the RPCs.
- Population from `OI_Demographics` → `municipalities` row.
- Phase 85 consumes this loader to bulk-load ~235 cities (incl. CASH/MOD fallback); Phase 86 adds counties + the Ohio state node + city→county linking via the `County` column.

</code_context>

<specifics>
## Specific Ideas

- **Prove-before-bulk gate:** Columbus FY2024 GAAP dry-run must reproduce Total Revenues ≈$2.166B / Income Taxes ≈$1.145B / Police ≈$810M (recon-verified) before any write — the explicit de-risk gate for the whole milestone. Add a CASH/MOD city dry-run alongside it to prove the fallback parser.
- The 12 revenue sources and ~18 expenditure functions ARE the icicle the citizen sees — keep the labels human-readable (the AOS labels are already plain-language: "Income Taxes", "Police", "Public Works", etc.).
- `SOA_Gov` (full-accrual gov-wide Statement of Activities) is in the same workbook — note it now as the built-in ACFR-basis cross-check that Phase 88 will use for reconciliation.

</specifics>

<deferred>
## Deferred Ideas

- **Enterprise funds (Water/Sewer/Electric/Landfill — `SONP_*`/`SOREACINP_*` tabs)** — deferred to v2 (OHENT-01).
- **Townships, villages, libraries, school districts** — deferred to v2 (OHTWN-01); cities + counties are the v2.8 spine.
- **OhioCheckbook transaction-level spending** (checkbook.ohio.gov) — voluntary/partial coverage; possible later enrichment layer, not the backbone.
- **Pre-2016 history (older .XLS / summarized PDFs back to ~2007)** — out of scope; document the XLSX floor (D-03 analog to VA's PDF-backfill deferral).

None of the above blocks Phase 84.

</deferred>

---

*Phase: 84-ohio-aos-source-loader*
*Context gathered: 2026-06-24*
