# Phase 44 Context — Core Federal Data Load

**Created:** 2026-06-12 (inline planning). **Goal:** All headline federal data loaded, sourced, queryable: FY2025 actuals (both lenses), first split, multi-decade context, FY2026 FYTD, debt/interest.

## Pipeline reality (verified 2026-06-12)

The live serving path is NOT operating_budgets/revenue_budgets line items. It is:

```
loader → upsert treasury.data_sources row → RPC public.treasury_sync_budget_tree(
  p_data_source_id, p_fiscal_year, p_dataset_type, p_total, p_tree jsonb, p_row_count, p_triggered_by)
→ writes treasury.budgets (metadata; gates getCities visibility) + treasury.budget_categories (tree nodes)
```

- Tree node shape (Phase 35, N-level): `{ n: name, a: amount, c: [children], i: [{d, a, aa, f, e}] }` — RPC accepts mixed `{n,a,c,i}` nodes (A2 verdict in processCA.js).
- Closest analog end-to-end: `scripts/seedCAState.js` + `scripts/processCA.js` (state entity, python-extract → JSON → buildNLevelTree → RPC). MA counties (`loadMACountyBudget.js`) show the flat-tree variant.
- `treasury.budgets.hierarchy` (string[]) labels the tree levels.

## Sourcing attachment point (refinement of Phase 43's INFRA-02)

`budget_categories` has NO sourcing columns, and the RPC doesn't write operating_budgets. Federal source chips therefore attach at **dataset level**, which matches the data's real granularity (one MTS table = one URL + one fetch date for all its categories):

- `data_sources.base_url` = the exact source URL (API query URL or xlsx URL)
- `treasury.budgets.data_source` (registry key) + `data_source_id` + `generated_at` (fetch timestamp)
- The 43-01 `source_url`/`source_date` columns on operating/revenue_budgets stay for line-item pipelines; the federal RPC path doesn't use them. The new federal tables (below) carry per-row source columns.

## Constraints verified

- `data_sources_dataset_type_check`: `operating | revenue | transactions | salaries | all_funds_requirements` — **'federal_agency' must be added** (precedent: 20260602031258 added all_funds_requirements). `treasury.budgets.dataset_type` has no CHECK.
- `api_type` is free-text by convention (ma-dls, pdf_download, socrata, xlsx_download…) — use `fiscal-data-api` (new) and `xlsx_download` (existing).
- Frontend `dataset_type` union (budget.ts) must gain `'federal_agency'`; unknown-type tab behavior must be verified by grep before live load.

## Depth requirement (Chris, 2026-06-12: "I expect the Federal budget to need more than '3 deep' on our icicles. Clarity is our goal.")

Infrastructure verified N-level, no caps: `_treasury_insert_tree` recurses unbounded (`p_depth + 1`), the API serves all depths ordered by depth/sort_order, BudgetIcicle is path-driven (arbitrary drill depth renders correctly), and `buildNLevelTree` is data-driven (D-02). Zero code changes needed for deep trees.

Depth is therefore limited only by **sourced outlays data**:

| Level | Function lens | Agency lens |
|---|---|---|
| 1 | Budget function (~20) | Department (~25) |
| 2 | Subfunction (~75, OMB 3.2) | Bureau (~150, MTS T5 L2) |
| 3 | Account (OMB Public Budget Database outlays file, function-coded, ~4-5k accounts) | Account (MTS T5 L3, ~200/month) |
| 4 | — (program activity exists ONLY as obligations in USAspending — loading it would break outlays-canonical; defer to a labeled future milestone) | T5 L4/L5 where present (~27 rows) |

**HARD RULE:** never graft USAspending obligations under outlay nodes for depth. Depth ends where sourced outlays end, with that boundary disclosed (ground rule 7 — transparency about limits beats fake precision).

## Lens storage decision

- **Function lens (default)** = `dataset_type='operating'` FY2025 — deep tree: Function → Subfunction → Account from the **OMB Public Budget Database outlays file** (single source = single clean source chip; account rows carry function codes). ⚠️ The outlays DB file was NOT verified during recon (only the Historical Tables were) — its loader plan starts with a verify-first task; **fallback** if unusable: Function → Subfunction (2-level) from OMB Hist 3.2 + MTS T9, which ARE verified patterns.
- **Receipts** = `dataset_type='revenue'` FY2025 — MTS T9 receipts section (2-level: Social Insurance subcategories).
- **Agency lens (toggle)** = `dataset_type='federal_agency'` FY2025 — MTS Table 5 parent-walked: Department → Bureau → Account (3+ levels). A second 'operating' dataset for the same FY would collide in available_datasets; a distinct type keeps both lenses queryable and lets Phase 45 toggle between them.

## Negative-amount handling (ground rule: never change the data; transparency about gaps)

MTS T9 includes negative functions some years (Undistributed Offsetting Receipts always; Commerce and Housing Credit sometimes). Icicle trees require positive nodes. Handling: **exclude negative nodes from the tree, store each as a `federal_context_metrics` row** (e.g. `offsetting_receipts_fy2025`), set `p_total` = sum of displayed (positive) nodes, and record the formal total (incl. negatives) in `federal_annual_summary`. Phase 45 MUST disclose the exclusion with the stored figure. Same rule for Table 5 agency lens.

## New tables (44-01 migration; don't fit the budget-tree model)

- `treasury.federal_annual_summary` — one row per FY (1962–2025 actuals only, NO estimate years): receipts, outlays, surplus_or_deficit (raw OMB sign convention), mandatory, discretionary_defense, discretionary_nondefense, net_interest, source_name/source_url/source_date per row. Feeds: landing bands, deficit strip, multi-decade context (DATA-03, DATA-04).
- `treasury.federal_context_metrics` — keyed metric rows (total_public_debt, fytd_outlays, fytd_receipts, fytd_interest_expense, excluded negatives), each with value, as_of_date, label, source_name/source_url/source_date (DATA-05, DATA-07).

## Public-visibility consequence (decided in 43-03, lands here)

The FIRST `treasury.budgets` write for the US entity makes "United States" appear in the production EntitySwitcher immediately, rendering through the default city UI (a correct, sourced 20-function icicle — interim but on-mission). 44-03 carries a **human go/no-go checkpoint** before the first live write.

## Other facts for executors

- Federal `fiscal_year_start_month = 10`.
- FY2025 validation anchors (recon, OMB 1.1): receipts $5,236,421M / outlays $7,011,105M / deficit −$1,774,684M. MTS↔OMB cross-source tolerance: 0.5%.
- OMB 8.1 has merged multi-row headers — locate columns by header TEXT, never by position.
- US population: FETCH from Census PEP at execution (loadMAPopulation.js pattern) — never hardcode from model memory.
- Fiscal Data API: URL-encode `page[size]`; OMB xlsx needs browser User-Agent.
- MTS T5 "Total--" rows appear at mixed levels — walk parent_id; never sum Total-- rows.
- LLM cost this phase: $0 (no enrichment).
