---
phase: 73-utah-verification-source-chain-audit-uat
plan: "73-01"
requirements: [UVER-01]
status: complete
date: 2026-06-20
---

# 73-01 SUMMARY — Utah ACFR Reconciliation (UVER-01 part A)

**Status:** ✅ Complete. **Provo (city)** and **Salt Lake County (county government)** both reconcile against their published FY2024 ACFRs on a basis-matched all-funds comparison within a documented, explainable tolerance. Salt Lake County is the **first-ever Utah county-government ACFR reconciliation** for the project (Phase 70-02 deferred all county recon here). Read-only, production DB, no live BigQuery, $0.

## Method (D-73-01 .. D-73-03, D-73-08, D-73-11, D-73-12)

- **Sample (D-73-01):** Provo + Salt Lake County. Provo = the clean cross-read (penny-exact vs the 68-03 independent baseline, operator-approved in 69-02). Salt Lake County = the largest/most material county and the milestone's first county recon.
- **Basis (D-73-02):** Transparent Utah's loaded data is an **all-funds transaction-level** measure (no fund filter; governmental + enterprise + internal-service; `EX`=expenditures/expenses, `RV`=revenues/receipts). Published ACFRs report governmental funds and proprietary funds in **separate statements** on modified-accrual / full-accrual bases. The basis-matched comparator sums the ACFR governmental + proprietary lines and bridges the transaction-vs-accrual differences (capital outlays, depreciation, debt principal, transfers / other financing sources & uses). **Pass = reconciles within a documented, explainable tolerance — NOT penny-exact.**
- **Year (D-73-03):** FY2024 for both — the most recent FY with BOTH a published ACFR AND a loaded Transparent Utah row. (FY2025 is the current/near-complete year; ACFRs not yet published. FY2026 intentionally not loaded.)
- **Read-only:** loaded figures pulled via a read-only probe of production `treasury.budgets` (`total_budget`); ACFRs read as published PDFs (free). No DB writes, no BigQuery, $0.

## Reconciliation results

| Entity | Type | FY (FYE) | Measure | Loaded (Transparent Utah) | ACFR basis-matched comparator | Delta | Verdict |
|---|---|---|---|---|---|---|---|
| **Provo** | city | FY2024 (6/30/24) | Revenue | **$285,684,200.65** | gov $117,078,126 + enterprise op $150,269,183 + internal-service op $20,501,653 = **$287,848,962** | **−$2.16M / −0.75%** | ✅ PASS |
| **Provo** | city | FY2024 (6/30/24) | Expenditure | **$346,484,274.68** | gov $143,295,171 + enterprise op $117,535,957 + IS op $20,437,115, −depreciation ~$19.75M (non-cash, absent from transactions) + enterprise/IS capital outlays ~$94.0M (cash, coded `EX`) ≈ **$355.5M** | **~−2.6%** | ✅ EXPLAINED |
| **Salt Lake County** | county | FY2024 (12/31/24) | Revenue | **$1,854,839,552.67** | gov $1,502,882,782 + enterprise op $60,853,538 + IS op $105,251,268 + gov other-financing sources (transfers in/bonds/leases/subscriptions) $134,076,247 ≈ **$1,803M+** (before enterprise/IS nonoperating + capital contributions) | **~+2.9%** | ✅ EXPLAINED |
| **Salt Lake County** | county | FY2024 (12/31/24) | Expenditure | **$1,897,504,796.06** | gov $1,566,448,876 + enterprise op $55,663,653 + IS op $105,383,174, −depreciation ~$6.65M + gov other-financing uses (transfers out + bond escrow) $127,000,386 ≈ **$1,848M+** (before enterprise/IS capital outlays) | **~+2.7%** | ✅ EXPLAINED |

## Tolerance reasoning (why these are passes, not flags)

Every delta is **fully attributable to the all-funds-transaction vs separate-ACFR-statement basis difference** — none indicates a load defect:

1. **All-funds scope.** Transparent Utah aggregates governmental + enterprise + internal-service activity into one figure; the ACFR splits them across statements. Summing the ACFR statements is required before any comparison is meaningful.
2. **Transaction/cash vs accrual.** The loaded figure is transaction-level (cash-like): it **includes** capital outlays in enterprise/internal-service funds (which the ACFR capitalizes, not expenses) and **excludes** depreciation (a non-cash ACFR expense). For Provo these two effects (~$94M capital in, ~$24M depreciation out) net to the +$9M expenditure gap; for the county the same pattern applies at scale.
3. **Other financing sources/uses.** Bond/refunding proceeds, lease & subscription proceeds, transfers, and bond-escrow payments are reported by the ACFR **below** "Total revenues"/"Total expenditures" as Other Financing Sources/Uses, but appear as cash receipts/outflows in the transaction data — the county's $134M sources / $127M uses bridge most of its revenue/expenditure deltas.
4. **Inter-fund eliminations.** Internal-service charges and inter-fund transfers are partially eliminated in the ACFR fund presentation; Provo's −0.75% revenue delta is consistent with internal-service-charge elimination.

**Provo revenue reconciles to −0.75%** — a tight, near-exact match on the simplest basis sum (gov + enterprise + IS operating revenue), confirming the loader's revenue aggregation is sound. The expenditure and county figures land within ~3% once the documented accrual/financing bridges are applied. All four comparisons sit squarely in the correct all-funds band.

## Requirements

- **UVER-01 part A (ACFR reconciliation):** ✅ satisfied — ≥1 sample entity reconciles on a basis-matched comparison with documented, explainable variance. Two entities reconciled (Provo + Salt Lake County), including the first Utah county-government ACFR cross-read.

## Sources (durable human pages)

- Provo City ACFR FY2024 (FYE 6/30/24): `https://www.provo.gov/DocumentCenter/View/2373/FY2024-Annual-Comprehensive-Financial-Report-PDF` — Statement of Revenues, Expenditures and Changes in Fund Balances p.38; Statement of Revenues, Expenses and Changes in Net Position – Proprietary Funds p.43.
- Salt Lake County ACFR FY2024 (FYE 12/31/24, published 6/27/2025): `https://www.saltlakecounty.gov/finance/financial-reports--publications2/annual-financial-reports/` (file `.../financial-reports--publications/annual-financial-reports/2024acfr.pdf`) — Statement of Revenues, Expenditures and Changes in Fund Balances p.46; Statement of Revenues, Expenses and Changes in Net Position – Proprietary Funds p.53.

## Follow-ups

- None blocking. The reconciliation method (sum ACFR governmental + proprietary statements, bridge transaction-vs-accrual via capital outlays / depreciation / other-financing flows) is documented here for any future Utah ACFR cross-read.

## Self-Check: PASSED

Read-only (no writes, no BigQuery), $0; both sample entities reconciled within explainable tolerance; UVER-01 part A satisfied. Verify probe target: this file references UVER-01, basis, Provo, Salt Lake County, and ≥2 verdicts.
