# Phase 135 — MAD-01 Reconciliation: Madison CMREB vs. City ACFR

**Date:** 2026-07-27
**Requirement:** MAD-01 — quantify the delta between the WI DOR CMREB workbook and the City of Madison's own audited ACFR, identify its cause, and record an explicit basis verdict against §4 of `.planning/MADISON-WI-SCOPING.md`.
**Method:** both sides parsed from source, nothing hand-transcribed. CMREB = `CMREB2024.xlsx` → `Cities` sheet → `MADISON` row. ACFR = `2024FS-ACFR.pdf` pp.62–63, *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds*, **Totals** column, via `pdftotext -table`.

**Parse validity check (before trusting any comparison):** the ACFR's own revenue lines sum to its printed Total Revenues at **$0**, and its expenditure lines to its printed Total Expenditures at **$0**. The extraction is faithful, so every delta below is a real source difference and not a mis-read.

---

## Result

Same period (calendar year 2024), same fund scope (governmental funds), two independent producers.

| line | CMREB | ACFR | delta |
|---|---:|---:|---:|
| Taxes | 353,557,359 | 353,557,360 | **−1** |
| Special assessments | 2,775,007 | 2,472,066 | +302,941 |
| Intergovernmental | 198,649,614 | 193,462,203 | +5,187,411 |
| Licenses and permits | 11,645,899 | 9,930,052 | +1,715,847 |
| Fines and forfeitures | 6,711,034 | 6,722,942 | −11,908 |
| Intergovernmental charges for services | 1,115,825 | 6,145,450 | −5,029,625 |
| Public charges for services | 36,908,764 | 39,202,432 | −2,293,668 |
| Investment income | 32,738,598 | 32,731,182 | +7,416 |
| Miscellaneous | 5,399,130 | 4,551,550 | +847,580 |
| **TOTAL REVENUE** | **649,501,230** | **648,775,237** | **+725,993 (+0.11%)** |

| | CMREB | ACFR | delta |
|---|---:|---:|---:|
| operations + capital outlay | 665,525,427 | 674,038,907 | −8,513,480 |
| debt service | 93,266,671 | 95,211,232 | −1,944,561 |
| **TOTAL EXPENDITURE** | **758,792,098** | **769,250,139** | **−10,458,041 (−1.36%)** |

## Reading it

- **Revenue agrees to 0.11%; Taxes tie to $1.** For two separately produced documents — one audited GAAP, one an unaudited self-reported filing — that is a strong signal CMREB is derived from the same underlying governmental-funds ledger, not independently estimated. The $1 on Taxes is rounding, and the same $1 appears on Tax Increments (CMREB 42,239,787 vs the ACFR's Capital Projects tax column 42,239,788).
- **The two largest line deltas cancel.** Intergovernmental +5,187,411 against Intergovernmental charges for services −5,029,625 nets to +157,786. This is a **classification shuffle** between two adjacent categories, not missing or invented money.
- **Expenditure agrees to 1.36%**, and the residual is concentrated in the operations+capital block. No single line explains it; it is consistent with the accounting-practice variance DOR itself warns about.

## Structural finding — function lines are NOT comparable to the ACFR's

**CMREB distributes capital outlay across every activity line; the ACFR reports Capital Outlay as one $273,669,675 line.** The bulletin states this directly: *"Data presented for each activity line includes operating expenditures and capital outlay."*

The arithmetic confirms it: the ACFR's five current-expenditure functions total only **$400,369,232**, against CMREB's operations+capital of **$665,525,427**. Comparing a CMREB function to the ACFR function of the same name is meaningless — e.g. CMREB `Other Transportation` $115,296,578 vs ACFR `Public works and transportation` $69,182,190. The difference is redistributed capital outlay, not a discrepancy.

**Consequence for the load:** CMREB's functions are internally consistent and statewide-uniform, and that is what makes them usable. But nothing in TT may present them as equivalent to an ACFR function line, and the totals are the only figures that should ever be reconciled against the ACFR.

Related: Madison Metro Transit issues a **separate audited statement** (`2024MetroTransitStatement.pdf`), i.e. it is an enterprise fund in the ACFR — yet mass transit falls in CMREB's `Other Transportation` per §III.C.1. Since the governmental-funds totals still reconcile to 1.36%, whatever transit activity CMREB captures is inside the same envelope; it is not additive.

---

## VERDICT — option (a): load CMREB, labelled unaudited

Recorded against §4 of the scoping brief.

**Chosen:** (a) CMREB now, with honest provenance labelling (MAD-06).

**Why:**
1. **Fidelity is demonstrated, not assumed** — 0.11% on revenue, 1.36% on expenditure, Taxes to $1, against the audited book for the same period and scope.
2. **Statewide uniformity is the asset.** CMREB's categories are identical for all 1,921 WI municipalities, which is what makes the deferred `WI-CITIES-01` fan-out possible at all. ACFR function taxonomies differ city to city and would not compose.
3. **It covers Dane County too.** The ACFR path gives Madison alone; the `Counties` sheet gives Dane its own real rows in the same pass.
4. **It carries an exact tie gate** (86,472 checks, 0 failures) that the ACFR path would not.

**Rejected:** (b) Madison-from-ACFR would buy audited GAAP and history back to FY2015, but for Madison alone, on a taxonomy that cannot extend to the rest of Wisconsin, and would put two bases inside one state — the exact problem the Oregon work fought to avoid. (c) Loading both invites apples-to-oranges comparison in the UI for no added truth.

**Conditions attached to the verdict:**
- MAD-06 labelling is **not optional** — "unaudited, self-reported to WI DOR", all-governmental-funds, calendar-year.
- The ACFR path is preserved as `MAD-ACFR-01`, now with a measured 0.11%/1.36% gap to justify the effort.
- This reconciliation is Madison-only. It says nothing about the other 189 cities, and `WI-CITIES-01` should spot-check a few before a statewide load.

## Sources

- CMREB CY2024 workbook — https://www.revenue.wi.gov/SLFReportscotvc/CMREB2024.xlsx
- CMREB Bulletin 124 (definitions, basis, capital-outlay note) — https://www.revenue.wi.gov/SLFReportscotvc/cmreb2024.pdf
- City of Madison FY2024 ACFR — https://www.cityofmadison.com/finance/documents/financials/2024FS-ACFR.pdf (pp.62–63)
- Madison 2024 financial statements index — https://www.cityofmadison.com/finance/accounting/financial-statements/2024-financial-statements
