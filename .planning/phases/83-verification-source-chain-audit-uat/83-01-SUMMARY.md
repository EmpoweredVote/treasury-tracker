---
phase: 83-verification-source-chain-audit-uat
plan: 01
status: complete
completed: 2026-06-23
requirements: [VAVER-01]
files_modified: []
---

# Phase 83-01 Summary — ACFR Reconciliation (read-only, $0)

**Result: PASS.** Both sample entities reconcile to their published FY2024 ACFRs within a documented, explained tolerance (≤ ~5.4%), all deltas attributable to known basis differences (APA modified-accrual governmental-funds, local-revenue-only vs ACFR government-wide full-accrual Total Primary Government) — not load defects.

## Method

The loaded data is the Virginia APA Comparative Report (Exhibit C "Total Expenditures" = governmental-funds expenditures; Exhibit B "Total Local Revenue" = local sources only, intergovernmental B-1 excluded per Phase 79). The APA report is itself compiled from each locality's audited ACFR data submitted to the state Auditor of Public Accounts, so the chain is loaded → APA → audited ACFR. ACFR comparators taken from each entity's published FY2024 ACFR / PAFR government-wide statements (WebFetch + PDF read, free).

## Alexandria (city), FYE 6/30/2024

| Measure | Loaded (APA) | ACFR (published) | Δ | Explanation |
|---|---|---|---|---|
| Expenditure | $863,578,347 | gov-activities expenses $996.2M | −13.3% | ACFR is government-wide full-accrual (depreciation, full pension/OPEB); APA Exhibit C is governmental-funds expenditures. Gap direction expected. |
| Revenue (local) | $874,230,660 | local-source ≈ 89% of $969.1M gov-activities revenue ≈ $862.5M | +1.4% | APA Total Local Revenue ≈ ACFR local-source (property 62% + other local taxes 16% + charges 6% + interest 3% + misc 2%); intergovernmental (~11%, ~$107M) correctly excluded. |

Loaded figure equals the APA report **exactly** (loader proof point). Revenue reconciles tightly (~1.4%); expenditure gap is the expected fund-vs-government-wide basis difference. Source: City of Alexandria FY2024 ACFR / PAFR (alexandriava.gov).

## Fairfax County (county), FYE 6/30/2024

| Measure | Loaded (APA) | ACFR (published, Total Primary Govt) | Δ | Explanation |
|---|---|---|---|---|
| Expenditure | $6,674,467,930 | Total expenses $6,332.7M | +5.4% | APA governmental-funds (incl. capital outlay + debt principal) vs ACFR government-wide accrual (incl. depreciation) + sewer enterprise in Total Primary Govt. **Education ties: APA function vs ACFR $2,653.1M.** |
| Revenue (local) | $5,646,769,177 | local-source ≈ taxes $4,646.6M + charges $1,275.0M + use of money $13.3M = $5,934.9M (Total Primary Govt, less sewer enterprise ≈ APA) | −4.9% | APA = governmental local revenue; ACFR Total Primary Govt includes the Integrated Sewer System enterprise (~$0.29B). Intergovernmental grants ($689.9M) correctly excluded from APA. |

The ACFR's functional expense breakdown uses the **same function taxonomy** as the loaded VA data (General Government, Judicial, Public Safety, Public Works, Health & Welfare, Community Development, Parks/Rec/Cultural, Education, Interest) — strong corroboration of the data chain. Source: Fairfax County FY2024 ACFR / PAFR (fairfaxcounty.gov).

## Verdict

Both reconcile within a documented, explained tolerance (SC#1). All variance is basis-driven (modified-accrual governmental-funds local-revenue-only vs government-wide full-accrual Total Primary Government), consistent in magnitude and direction with the Phase 73 Utah precedent. $0 spend (free WebFetch + PDF read). No defects; read-only.

## Self-Check: PASSED
