# Phase 49: Historical Federal Data Backfill (FY1976–FY2024) - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Load function-lens (OMB Hist 3.2), agency-lens (OMB Hist 4.1/5.1), and receipts-by-source (OMB Hist 2.1) detail for every federal fiscal year **FY1976–FY2024**, plus the FY1976 Transition Quarter. Every row carries source_name / source_url / source_date; each year stores its own visual-vs-official reconciliation disclosure (recomputed per year, not copied from FY2025). $0 API/LLM spend — Claude loads free OMB tables directly; loaders idempotent.

**In scope:** the three lenses per year, per-year disclosures, TQ data + storage, gap-free FY1976–FY2024 coverage.

**Explicitly NOT this phase:**
- YearSelector wiring / making years selectable in the app → **Phase 50**
- Comparability notes (function/agency definition drift, TQ explanation copy) → **Phase 51**
- Re-authoring explainers or program origins per year (year-independent carryover — zero rework)
- FY2025/FY2026 changes (FY2025 stays headline, FY2026 stays FYTD strip)
- Pre-FY1976 detailed trees (OMB by-function detail begins ~FY1976; earlier years stay at the existing 64-yr summary level)

</domain>

<decisions>
## Implementation Decisions

### Tree Depth Across Decades
- **D-01:** Adaptive depth per year. Try account-level (Function→Subfunction→Account, the FY2025 pattern). If a year's account rows won't reconcile to the published OMB total, fall back to function·subfunction depth for that year (from Hist 3.2 / Hist 4.1, which tie by construction). Deepest-available-per-year — never drop a year. Matches the v2.0 ground rule "deeper than 3 where data supports; clarity first" (Chris, 2026-06-12).
- **D-02:** When a year falls back to function·subfunction depth, record a `federal_context_metrics` row noting the reduced depth + reason, so the degradation is honest and Phase 51 can speak to it.

### Transition Quarter (Jul–Sep 1976)
- **D-03:** Store the TQ as its **own distinct, selectable period** (labeled "Transition Quarter (Jul–Sep 1976)"), loaded and sourced like any year, so Phase 50 can expose it in the YearSelector and Phase 51 can explain it. Do NOT fold TQ figures into FY1976 or FY1977 (roadmap constraint: "handle explicitly, don't fold into a fiscal year").

### Money In (Receipts by Source)
- **D-04:** Build the federal receipts-by-source lens **once** here (none exists yet — only `loadFederalMTS.js` FYTD strip + `loadFederalAnnualSummary.js` 64-yr headline). Shape = **major sources, flat**, from OMB Hist 2.1: individual income tax, corporation income tax, social insurance/payroll, excise, estate & gift, customs duties, miscellaneous (~7 buckets). Each figure is a direct Hist 2.1 cell. One clean level — clarity-first, citizen-legible "where money comes from." This shape becomes the template applied to all 49 years and the deficit strip Phase 50 reads against.

### Won't-Reconcile Years (tiered reconciliation ladder)
- **D-05:** Tiered fallback, unifying with D-01:
  1. Account-level won't tie → fall back to function·subfunction (ties to Hist 3.2/4.1 by construction).
  2. Even function·subfunction won't tie within tolerance → **load the year anyway** with a per-year visual-vs-official disclosure capturing the exact gap.
  - No year is ever dropped (satisfies HIST-04 gap-free coverage); every gap is sourced and visible. This is the inverse of FY2025's hard-halt — chosen deliberately because a single stubborn historical year must not block gap-free coverage.

### Carried Forward (v2.0 ground rules — do not re-decide)
- Always-sourced: every line-item row populates source_name / source_url / source_date — zero exceptions, zero model-memory text.
- Reconciliation discipline + per-function/subfunction excluded-net & offsetting-collection disclosure pattern (the Phase 44 `federal_context_metrics` mechanism) carries forward, recomputed per year.
- OMB xlsx downloads require a browser User-Agent (already in the FY2025 loaders).

### Claude's Discretion
- Tolerance thresholds for "won't tie" at each tier (planner/researcher to set, anchored on FY2025's 0.5% reconciliation / thousands-precision net check).
- Whether the three lenses are three separate parameterized loaders or one orchestrator iterating years — implementation choice for the planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 44 loaders to parameterize (the core reuse — currently hardcoded FY=2025)
- `scripts/loadFederalFunctions.js` — function-lens loader (Function→Subfunction→Account), OMB Public Budget Database outlays + Hist 3.2; net-total anchor check; excluded-net & offsetting-collection disclosure metrics. Hardcoded `const FY = 2025` and `OMB_OUTLAYS` anchor — this is what gets iterated across FY1976–FY2024.
- `scripts/loadFederalAgencies.js` — agency-lens loader; same pattern, hardcoded `FY = 2025` / `FY_DATE = '2025-09-30'`.
- `scripts/extractOMBPublicBudgetDB.py` — Python extractor invoked by the function loader; takes `(outlays.xlsx, hist03z2.xlsx, FY)` — already year-parameterized at the CLI.
- `scripts/extractOMBHistorical.py` — historical-tables extractor (Hist 1.1 + Hist 8.1), already multi-year (FY1962→actuals), header-text column location, units read from file. Reference for robust OMB xlsx parsing patterns.
- `scripts/loadFederalMTS.js` — FY2026 FYTD receipts strip (NOT the per-year receipts tree; informs the new Money In loader but is a different source).
- `scripts/loadFederalAnnualSummary.js` — 64-yr headline history in `federal_annual_summary` (already covers FY1962+ at summary level — free carryover, do not rebuild).
- `scripts/auditFederalSources.mjs` — source-chain audit harness (Phase 48: 225 rows / 61 URLs, 61/61 PASS). Reuse to verify the backfilled rows.

### Project specs / requirements
- `.planning/REQUIREMENTS.md` — v2.1 requirements HIST-01..04, CTX-01 (this phase); $0-API hard constraint (Chris, 2026-06-13); Out of Scope table.
- `.planning/PROJECT.md` — federal ground rules, US entity id `0098c405-65e1-426f-8e5f-0fcbe2a900c0`, ev-accounts backend note, source bot-wall caveats.
- `.planning/ROADMAP.md` §"Phase 49" — goal, success criteria, cross-cutting constraints (UA requirement, TQ handling, all-actuals span).

### OMB source tables (free, browser-UA required)
- OMB Historical Tables landing: `https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/` — Hist 2.1 (receipts by source), Hist 3.2 (outlays by function/subfunction), Hist 4.1 / 5.1 (outlays by agency).
- OMB Public Budget Database (account-level outlays): linked from `https://www.whitehouse.gov/omb/information-resources/budget/supplemental-materials/` — the account-level file the function loader already downloads.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`loadFederalFunctions.js` / `loadFederalAgencies.js`**: the entire load path (download w/ browser UA → Python extract → buildTree → `treasury_sync_budget_tree` RPC → disclosure metrics) is reusable; the work is parameterizing `FY` and the anchor, then iterating.
- **`extractOMBPublicBudgetDB.py`**: already accepts the fiscal year as a CLI arg — multi-year extraction is partially solved.
- **`treasury_sync_budget_tree` RPC**: the tree-sync write path used for all entities (city/state/federal); historical years reuse it unchanged.
- **`federal_context_metrics` table + metric_key convention** (e.g. `excluded_..._fyNNNN`, `offsets_within_..._fyNNNN`): the per-year disclosure store — extend with per-year metric keys for FY1976–FY2024 and the new "reduced-depth fallback" note (D-02).
- **`auditFederalSources.mjs`**: ready-made source-chain verifier for the new rows.

### Established Patterns
- **Anchor-then-halt reconciliation**: FY2025 loaders refuse to write unless net total ties to the OMB anchor to the thousands and displayed+excluded reconciles within 0.5%. Phase 49 keeps the *check* but changes the *failure action* per D-05 (tiered fallback instead of hard-halt).
- **Data keyed on integer `fiscal_year`**: budgets/data_sources use an integer FY. The TQ (a 3-month non-year period, D-03) does NOT fit this cleanly.
- **Idempotent upserts**: data_sources upsert by (municipality_id, api_type, dataset_id, dataset_type); budgets pre-deleted per (data_source_id, fiscal_year) before RPC. Per-year loaders must preserve this idempotency.

### Integration Points
- US federal entity: `treasury.municipalities` where name='United States' AND entity_type='federal' (id `0098c405-65e1-426f-8e5f-0fcbe2a900c0`).
- Backend lives in the separate **ev-accounts** repo (Render); data loaded via `scripts/load*Federal*.js`.

</code_context>

<specifics>
## Specific Ideas

- Receipts buckets to mirror Hist 2.1 line labels exactly (D-04): individual income tax, corporation income tax, social insurance and retirement receipts, excise taxes, estate and gift taxes, customs duties, miscellaneous receipts.
- TQ display label: "Transition Quarter (Jul–Sep 1976)".

## Research Flags (for gsd-phase-researcher / gsd-planner — implementation HOW, not user decisions)
- **R-01 (schema):** How to represent the TQ as a selectable non-year period given budgets key on an integer `fiscal_year`. Options to evaluate: a transition-quarter boolean/flag column alongside fiscal_year=1976, vs. a sentinel fiscal_year value, vs. a period-type column. Must let Phase 50's YearSelector render it distinctly without breaking integer-year ordering elsewhere.
- **R-02 (data availability):** Confirm the OMB Public Budget Database outlays file carries clean, function-coded **account-level** rows back to FY1976 (the FY2025 loader's account depth is unproven for 1970s–80s data). Result determines how often D-01's function·subfunction fallback fires.
- **R-03 (receipts source):** Confirm Hist 2.1 column/row layout is stable across the FY1976–FY2024 span for the 7 major-source buckets (units read from file, columns by header text — same robustness as `extractOMBHistorical.py`).
- **R-04 (definition drift):** Note (don't resolve — Phase 51 owns the user-facing copy) where function/agency definitions or agency reorganizations shift across decades, so the per-year source label stays accurate.

</specifics>

<deferred>
## Deferred Ideas

- **Two-level receipts breakdown** (social insurance → Social Security / Medicare / unemployment / other; from Hist 2.4/2.5) — considered and set aside for clarity-first flat view (D-04). Candidate future enhancement if citizens want more receipt detail; coverage thins for oldest years.
- Backfilling the always-sourced standard to city/state data — tracked as FUT-02, future milestone.

None of the above is in Phase 49 scope — discussion stayed within the backfill boundary.

</deferred>

---

*Phase: 49-historical-federal-data-backfill-fy1976-fy2024*
*Context gathered: 2026-06-13*
