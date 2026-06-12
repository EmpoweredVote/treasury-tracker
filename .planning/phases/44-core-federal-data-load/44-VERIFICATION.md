# Phase 44 Verification — Core Federal Data Load

**Date:** 2026-06-12. All queries run against the live DB; all source URLs fetched live this session.
**Checkpoint state:** GO (Chris, 2026-06-12, recorded in 44-03-SUMMARY) — all FY2025 datasets loaded live and publicly visible.

## Per-requirement results

| Req | Status | Evidence |
|---|---|---|
| DATA-01 (function lens, max sourced depth) | **PASS** | dataset_type='operating' FY2025, budget `10a2cb09…`: depth 0=18 functions / 1=61 subfunctions / 2=1,613 accounts + 2,108 line items. Source: OMB Public Budget Database outlays file (sums to OMB 1.1 outlays EXACTLY); function titles sourced from Hist 3.2. Reconciliation identity 0.0000% ($7,532.2B displayed + −$521.1B excluded = $7,011.1B official). |
| DATA-02 (FY2025 receipts) | **PASS** | dataset_type='revenue' FY2025: 7 roots + 3 children, total $5,234,616,386,315.43 (MTS T9 @ 2025-09-30); 0.034% vs OMB anchor. |
| DATA-03 (BEA split multi-year) | **PASS** | federal_annual_summary: mandatory/discretionary_defense/discretionary_nondefense/net_interest populated for ALL 64 years (1962–2025), per-year identity mandatory+def+nondef+NI=outlays verified in extractor (halt-on-fail). |
| DATA-04 (multi-decade history) | **PASS** | 64 rows, min 1962, max 2025, actuals only; FY2025 anchors exact. |
| DATA-05 (FY2026 FYTD) | **PASS** | fytd_receipts $3,655.6B + fytd_outlays $4,901.9B, as_of 2026-05-31 (latest MTS month). |
| DATA-06 (agency lens) | **PASS** | dataset_type='federal_agency' FY2025, budget `8f97eb19…`: 29 departments, depth distribution {0:29, 1:216, 2:254, 3:40, 4:2} — 5 levels. Built by parent_id walk; 80 'Total--'/subtotal labels ignored (never summed). Identity: $8,905.0B displayed + −$1,895.5B dropped = T5 'Total Outlays' within 0.006% (T9 cross-check 0.007%). |
| DATA-07 (debt + interest) | **PASS** | total_public_debt $39,213,266,279,741.16 (2026-06-10, Debt to the Penny); fytd_interest_expense $867.3B gross (2026-05-31, label distinguishes from Net Interest function). |

## Sourcing sweep

- federal_annual_summary: 64/64 rows have source_name/source_url/source_date — **0 unsourced**
- federal_context_metrics: 71/71 rows sourced — **0 unsourced** (4 live metrics + 37 function-lens + 30 agency-lens disclosure metrics)
- Federal data_sources rows: 3/3 have non-empty base_url (exact API query URLs / xlsx URL)
- treasury.budgets federal rows: 3/3 carry data_source name-link AND data_source_id → source_registry (treasury-fiscal-data ×2, omb-public-budget-database ×1). Note: registry FK is sparsely used DB-wide (846/19,104) — federal rows are fully linked.
- Source URLs fetched live this session with 200s: Fiscal Data API (T9 2025-09-30, T5 2025-09-30, debt_to_penny, interest_expense), whitehouse.gov hist01z1/hist08z1/hist03z2/outlays xlsx, Census NST-EST2024 CSV.

## Regression

- getCities served count: 532 → **533** (= +1, the United States — intended)
- Plano TX: 19 budget rows, unchanged. California (state): 10 budget rows, unchanged.
- tsc + npm run build green (incl. BudgetIcicle normalization change — identical math for municipal trees).

## Known disclosures owed by Phase 45/46 (recorded, not bugs)

1. Money Out visual total ($7,532.2B) excludes $521.1B of net-negative categories; official net $7,011.1B in federal_annual_summary — methodology note required.
2. Agency lens visual total ($8,905.0B) is before $1,895.5B of offsetting receipts/intrabudgetary transactions — same note.
3. Offsetting items ARE in the data as negative '(offsetting)' line items; 67 disclosure metrics enumerate every exclusion.
4. Account-level icicle percentages are shares of displayed accounts (BudgetIcicle normalizes per level).

## Phase 44 goal: **ACHIEVED** — all seven DATA requirements pass with sourced evidence.
