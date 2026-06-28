# 93-02 — MNVER-01 Part B: Source-Chain Audit + Re-derivation + Icicle + State-Node

**Scope:** Full MN cohort (858 cities / 20,414 budget rows + 87 counties / 1,380 rows + 136 universal enrichment rows + 10 state-node rows). Reads via mcp__supabase-local. Production target kxsdzaojfaibhuzmclfq.

---

## Task 1 — Full-cohort source-chain audit — ✅ CLEAN (city/county)

| Check | Result |
|-------|--------|
| city/county rows with NULL source_url/source_date/data_source | **0** |
| state-node rows with NULL source_url | 10 (see Task 4 finding) |
| duplicate (municipality_id, fiscal_year, dataset_type) | **0** |
| orphan budgets (no municipality) / orphan budget_categories (no budget) | **0 / 0** |
| numeric-garbage depth-0 labels cohort-wide (`^-?[0-9]+$`) | **0** |
| universal enrichment rows missing plain_name/description | **0** (all 136 complete) |
| distinct OSA source_urls (city+county) | 20, **all present in `scripts/mnOsaDatasets.json`** (0 unmanaged) |
| fragile-link spot-probe (5 URLs, ranged GET) | all **HTTP 206** (live/durable) |

City + county cohort: **0 NULL / 0 fragile / 0 residue.** The only NULL finding is the 10 state-node rows (Task 4).

## Task 2 — Independent re-derivation from OSA workbooks (the Phase 86 lesson) — ✅ PASS (0 mismatches)

Re-derived straight from the raw OSA workbooks (`cired_23_data.xlsx` col 74 Total Revenues / col 143 Total Expenditures / col 12 PropertyTaxes; `county_21_-data.xlsx` cols 69/139/8) — NOT loader self-report — for 5 entities incl. 1 CASH-basis city + 2 counties. Every figure matches the stored DB value **to the dollar**:

| Entity | Basis | Revenue (raw = stored) | Operating (raw = stored) | PropertyTaxes leaf (raw = stored) |
|--------|-------|------:|------:|------:|
| Minneapolis (city) FY2023 | GAAP | 1,192,133,233 ✓ | 1,193,970,288 ✓ | 476,724,343 ✓ |
| Ada (city) FY2023 | CASH | 2,281,736 ✓ | 2,966,174 ✓ | 470,078 ✓ |
| Afton (city) FY2023 | GAAP | 3,578,395 ✓ | 3,906,964 ✓ | 2,591,827 ✓ |
| Hennepin County FY2021 | GAAP | 1,851,255,583 ✓ | 1,834,835,822 ✓ | 914,752,711 ✓ |
| Ramsey County FY2021 | GAAP | 953,413,837 ✓ | 990,405,870 ✓ | 362,951,166 ✓ |

The Phase 86 column/row-mismapping failure mode is **verified absent** for MN (city + county layouts both correct). All sampled category labels are real text (no numeric garbage).

## Task 3 — Icicle drill-down structural confirmation — ✅ PASS (resolves Ohio flat-source limitation)

Across all **21,794** MN city+county budgets (operating + revenue):
- **100.0%** have depth-1 child categories (21,794 / 21,794)
- **99.8%** have depth-2 child categories (21,760 / 21,794 — the 34 without depth-2 are tiny entities where a function has no sub-breakdown)

The 2-level icicle drill-down is the cohort-wide norm. The MN OSA source resolves the Ohio AOS flat-source limitation ([[project_flat_source_icicle_limitation]]). Sample baseline (Minneapolis FY2023): operating depth 8/17/3, revenue 8/16/14. Live render confirmed in 93-03 UAT.

## Task 4 — State-node source stamp — ⏸ BLOCKED (data-honesty finding; awaiting real-figure source)

**Finding:** The 10 Minnesota state-node "General Fund" rows are NOT real figures with a merely-missing source_url. They are **hardcoded round-number ESTIMATES** from the old all-50-states seed (`scripts/processMN.js`): FY2024 operating = exactly $15,500,000,000, revenue = exactly $15,500,000,000, with round-billion components (Medicaid "$3.0B", State Agency Operations "$1.4B", Bond Debt Service "$0.5B"). Minnesota's actual General Fund is roughly double (MMB Feb-2025 forecast: FY2024-25 biennium revenues = $61.728B ≈ $30.9B/yr).

Stamping these rows with an `mn.gov/mmb` `source_url` would present unsourced estimates as published MMB data — a violation of the ground rule "NEVER create or display unsourced data or text." The Ohio/VA precedent (D-88-04) assumed the rows held real data; for MN the data itself is the problem.

**Decision (Chris, 2026-06-27):** Replace the placeholders with **real MMB figures** (then stamp the real source).

**Resolution (Chris, 2026-06-27): replaced placeholders with real State-ACFR actuals; FY2024 loaded, FY22/23 deferred.**
- Source: **State of Minnesota FY2024 ACFR**, Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances, General Fund column (year ended June 30, 2024). URL: `https://mn.gov/mmb/assets/2024 - Final ACFR with Cover 2024 - accessible_tcm1059-661432.pdf`. source_date 2024-06-30. Figures independently sum-verified to the published totals.
- Loaders `scripts/processMN.js` (operating) + `scripts/processMNRevenue.js` (revenue) rewritten: FY2024 real actuals (depth-1 functions/sources under the GF root), `--fy 2024` default, post-RPC source-stamp (idempotent).
- **Applied to production:** deleted the 8 FY2022/2023/2025/2026 placeholder rows (+48 categories); the FY2024 RPC replaced the FY2024 placeholder; source stamped.
  - State node now: **FY2024 operating $33,534,701,000** (11 functions: General Education $11.92B, Health & Human Services $11.74B, Intergovernmental Aid $2.75B, …) + **FY2024 revenue $34,562,737,000** (12 sources: Individual Income $16.63B, Sales $7.59B, …).
  - **Full MN cohort now 0-NULL source_url/source_date/data_source across ALL entity_types** (cities + counties + state).
  - Idempotent: re-running both loaders leaves totals + source unchanged.
- **FY2022 + FY2023 deferred** (Chris's choice): the full prior-year State ACFR PDFs were not fetchable via CLI; the MMB End-of-Session FBA (`eos23-fba-detail.pdf`, user-provided) is budgetary/forecast basis (not GAAP-actual) + FY2023 is an estimate, so it is NOT basis-compatible with the FY2024 ACFR figure and was not used. FY2022/FY2023 to be added from their full State ACFRs when available.

---

## MNVER-01 Part B Verdict: **PASS** (v2.9 OSA city/county cohort + state-node honesty resolved).
- City + county source chain: durable, complete (0-NULL), residue-free; 20 source URLs all manifest-managed + live.
- Stored figures independently re-derived from the workbooks = exact for 5 entities incl. a CASH-basis city + 2 counties.
- 2-level icicle drill-down confirmed cohort-wide.
- State-node unsourced placeholders **replaced** with real FY2024 State-ACFR actuals (sourced); full cohort now 0-NULL. FY2022/FY2023 deferred to a future ACFR load.
