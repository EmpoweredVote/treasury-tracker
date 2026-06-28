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

**Resolution (Chris, 2026-06-27): replaced placeholders with a real 3-year State-ACFR GAAP-actuals series (FY2023–FY2025).**
- Source: **State of Minnesota ACFRs** (user-provided full set, 1997–2025), Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances, **GENERAL FUND column, GAAP basis** (in thousands). Each year stamped to its own ACFR URL + source_date (fiscal year end). All figures independently sum-verified to the published Net Revenues / Total Expenditures.
  - **Basis trap caught:** these ACFRs contain BOTH a GAAP governmental-funds statement and a separate budgetary-basis statement; FY2024 (already loaded) used GAAP, so all years use the **GAAP** GENERAL column for consistency (an early read mistakenly grabbed the budgetary figures for FY2021-23 — corrected).
- Loaders `scripts/processMN.js` (operating) + `scripts/processMNRevenue.js` (revenue) rewritten: FY2023/2024/2025 GAAP actuals (depth-1 functions/sources under the GF root), per-FY `SOURCES` map, post-RPC per-FY source-stamp (idempotent).
- **Applied to production:** deleted the 8 FY2022/2023/2025/2026 placeholder rows (+48 categories); RPC loaded real FY2023/2024/2025; each row stamped with its ACFR source.
  - State node now (GENERAL FUND, GAAP): **FY2023** op $26,646,765,000 / rev $33,466,152,000; **FY2024** op $33,534,701,000 / rev $34,562,737,000; **FY2025** op $35,114,726,000 / rev $35,478,861,000. (11 spending functions + 12 revenue sources per year.)
  - **Full MN cohort now 0-NULL source_url/source_date/data_source across ALL entity_types** (cities + counties + state).
  - Idempotent: re-running both loaders leaves totals + source unchanged.
- **FY2021 + FY2022 deferred:** same ACFRs are on hand, but their expenditure tables need page-image extraction (pdftotext column-jumble) and FY2022 has a negative Investment/Interest line (−$350M, market losses) that complicates the icicle. Can be added later. The user-provided EOS FBA (`eos23-fba-detail.pdf`) was NOT used — budgetary/forecast basis, not GAAP-actual.

---

## MNVER-01 Part B Verdict: **PASS** (v2.9 OSA city/county cohort + state-node honesty resolved).
- City + county source chain: durable, complete (0-NULL), residue-free; 20 source URLs all manifest-managed + live.
- Stored figures independently re-derived from the workbooks = exact for 5 entities incl. a CASH-basis city + 2 counties.
- 2-level icicle drill-down confirmed cohort-wide.
- State-node unsourced placeholders **replaced** with real FY2024 State-ACFR actuals (sourced); full cohort now 0-NULL. FY2022/FY2023 deferred to a future ACFR load.
