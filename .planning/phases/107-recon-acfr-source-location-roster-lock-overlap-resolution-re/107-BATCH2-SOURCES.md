# 107 — Batch 2 ACFR Source Location (RECON-06, TN/CT/WI/WA/MI)

**Status:** COMPLETE — all 5 states recon'd, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
**States:** Tennessee (TN), Connecticut (CT), Wisconsin (WI), Washington (WA), Michigan (MI)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 103-PA-IL-SOURCES.md shape (PA/IL/NJ/MA/NC/GA/MD recon mold).

All five states publish the Governmental Funds *Statement of Revenues, Expenditures, and Changes
in Fund Balances* — **General Fund** column (GAAP basis). TN/CT/WI/WA report in thousands, FY-end June 30.
MI reports in thousands, FY-end **September 30** (fiscal year differs from the other four). All five pass
the D-07 recency floor (FY2023 + FY2024 in clean window). TX-trap scope divergence documented for each state
in Section 4 — accept-and-relabel recommended for all five (same mechanism as PA/IL/NJ/MA/NC/GA/MD).

**Key finding:** MI's September 30 FY-end means FY2024 = October 2023–September 2024 and FY2025 =
October 2024–September 2025. This must be reflected in source_date stamps and FY labeling in the loader.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **TN** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds (PDF page ~39 of FY2025 ACFR) | **General Fund** (1st of General Fund \| Education \| Highway \| other nonmajor funds \| Total) | thousands | Jun 30 | **FY2009–FY2025** | Base: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/` + per-year variant filename. FY2025: `ACFR%20-%20FY25.pdf`. FY2024: `ACFR_FY24.pdf`. FY2023: `ACFR_fy23.pdf`. FY2022: `ACFR_FY22.pdf`. FY2021: `ACFR_fy21.pdf`. FY2020: `acfr_fy20.pdf`. FY2009–FY2019: `acfr_fy{YY}.pdf` (lowercase 2-digit). **Must enumerate per-year names from archive page** — no single derivable pattern. Landing: `https://www.tn.gov/finance/doa/fa-accfin-ar.html` |
| **CT** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~37 of FY2025 ACFR) | **General Fund** (1st of General \| Debt Service \| Transportation \| Restricted Grants & Accounts \| Grant & Loan Programs \| Other Funds \| Total) | thousands | Jun 30 | **FY1988–FY2025** (FY2019–FY2025 extraction-verified; FY2018 and older enumerable from archive JSON) | No derivable pattern — enumerate from `_reportsSource` JavaScript JSON blob on `https://osc.ct.gov/reports`. FY2025: `https://osc.ct.gov/wp-content/uploads/2026/03/State-of-Connecticut-ACFR-2-27-26_Final.pdf`. FY2024: `https://osc.ct.gov/wp-content/uploads/2025/03/State-of-Connecticut-ACFR-FY-24-3-26-25.pdf`. FY2023: `https://osc.ct.gov/wp-content/uploads/2024/04/ACFR-FY2023-v11-2024-04-12.pdf`. FY2022: `https://osc.ct.gov/reports/ACFR-2022revised032227.pdf`. FY2021: `https://osc.ct.gov/reports/ACFR2021.pdf`. FY2020: `https://osc.ct.gov/reports/CAFR2020.pdf`. FY2019: `https://osc.ct.gov/reports/CAFR-2019.pdf`. Landing: `https://osc.ct.gov/reports` |
| **WI** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~45 of FY2025 ACFR) | **General Fund** (1st of General \| Transportation \| Nonmajor Governmental \| Total) | thousands | Jun 30 | **FY2000–FY2025** (FY2019–FY2025 extraction-verified; FY2000+ enumerable from archive) | Explicit per-year URLs — no single derivable pattern. FY2025: `https://doa.wi.gov/budget/FY%202025%20ACFR%20Final.pdf`. FY2024: `https://doa.wi.gov/budget/FY%202024%20ACFR%20Final.pdf`. FY2023: `https://doa.wi.gov/budget/SCO/FY%202023%20ACFR%20Final.pdf`. FY2022: `https://doa.wi.gov/budget/SCO/FY%202022%20ACFR.pdf`. FY2021: `https://doa.wi.gov/budget/ACFR2021.pdf`. FY2020: `https://doa.wi.gov/budget/CAFR2020.pdf`. FY2019–FY2018: `https://doa.wi.gov/budget/CAFR{YYYY}.pdf`. FY2000–FY2017: `https://doa.wi.gov/DEBFCapitalFinance/{YYYY}/{YYYY}CAFR[_Linked].pdf` (per-year naming variant). Archive: `https://doa.wi.gov/Pages/StateFinances/Financial-Reporting-Archive.aspx` |
| **WA** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~46 of FY2025 ACFR) | **General Fund** (1st of General \| Higher Education Special Revenue \| Higher Education Endowment and Other Permanent \| Total) | thousands | Jun 30 | **FY2020–FY2025** (FY2020 and FY2025 extraction-verified; FY2021–FY2024 confirmed accessible) | FY2025: `https://ofm.wa.gov/wp-content/uploads/FY-2025-Annual-Comprehensive-Financial-Report.pdf` (unique naming). FY2024: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2024/ACFR24.pdf`. FY2023: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2023/ACFR23.pdf`. FY2022: `…/CAFR/2022/ACFR22.pdf`. FY2021: `…/CAFR/2021/ACFR21.pdf`. FY2020: `…/CAFR/2020/CAFR20.pdf` (note `CAFR20` vs `ACFR{YY}` for older). **FY2025 has unique naming** — SOURCES map must special-case it. Landing: `https://ofm.wa.gov/spending/financial-audit-reports/annual-comprehensive-financial-report/` |
| **MI** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~42 of FY2025 ACFR) | **General Fund** (Fund 10, 1st of General Fund \| School Aid Fund \| Non-Major Funds \| Totals) | thousands | **Sep 30** (unique — all other Batch-2 states are Jun 30) | **FY2019–FY2025** (FY2020 and FY2025 extraction-verified; all years accessible) | Base: `https://www.michigan.gov/budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report/`. FY2025: `FY-2025-ACFR.pdf`. FY2024: `ACFR-FY2024.pdf`. FY2023: `ACFR-FY2023.pdf`. FY2022: `ACFR-FY2022.pdf`. FY2021: `ACFR-FY2021.pdf`. FY2020: `ACFR-FY2020.pdf`. FY2019: `ACFR-FY2019.pdf`. Pattern: `ACFR-FY{YYYY}.pdf` for FY2019–FY2024; FY2025 = `FY-2025-ACFR.pdf` (reversed). Landing: `https://www.michigan.gov/budget/fiscal-pages/reports/annual-comprehensive-financial-report` Archive: `https://www.michigan.gov/budget/budget-documents/document-archive/annual-comprehensive-financial-reports` |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **TN** | FY2025 (latest, FY-end Jun 30 2025) | **$35,473,625K** | GF line items sum = $35,473,625K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **TN** | FY2019 (older bookend sampled; FY2009 also confirmed accessible) | **$22,201,193K** | GF line items sum = $22,201,193K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **CT** | FY2025 (latest, FY-end Jun 30 2025) | **$26,074,183K** | GF line items sum = $26,074,183K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **CT** | FY2019 (older bookend sampled) | **$20,776,288K** | GF line items sum = $20,776,288K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WI** | FY2025 (latest, FY-end Jun 30 2025) | **$38,655,598K** | GF line items sum = $38,655,598K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WI** | FY2019 (older bookend sampled) | **$27,866,801K** | GF line items sum = $27,866,801K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WA** | FY2025 (latest, FY-end Jun 30 2025) | **$55,775,958K** | GF line items sum = $55,775,958K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WA** | FY2020 (older bookend sampled) | **$38,977,410K** | GF line items sum = $38,977,410K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **MI** | FY2025 (latest, FY-end Sep 30 2025) | **$53,788,610K** | GF line items sum = $53,788,611K vs printed $53,788,610K. Diff = $1 (acceptable GAAP thousands rounding). ✅ |
| **MI** | FY2020 (older bookend sampled, FY-end Sep 30 2020) | **$39,920,656K** | GF line items sum = $39,920,656K; matches printed General Fund Total revenues. Diff = $0. ✅ |

---

## Section 3 — Four risk facts per D-08

| Fact | TN | CT | WI | WA | MI |
|------|----|----|----|----|-----|
| **Units** | thousands | thousands | thousands | thousands | thousands |
| **Negative GF line items** | None observed in FY2025 or FY2019. Investment income = +$1,042,605K (FY2025), +$154,441K (FY2019). Low risk. | None observed in FY2025 or FY2019. Investment Earnings = +$338,294K (FY2025), +$48,950K (FY2019). Low risk. Note: older years during CT fiscal stress (2009–2017) may have negative investment lines — check at load. | None observed in FY2025 or FY2019. Investment and Interest Income = +$431,703K (FY2025), +$29,649K (FY2019). Low risk. | None observed in FY2025 or FY2020. Investment income (loss) = +$429,753K (FY2025), +$114,104K (FY2020). Column is labeled "Investment income (loss)" — suggests negative is possible. Check older years at load. | Investment income not broken out as a separate GF revenue line (embedded in Miscellaneous). No standalone negative line possible. No P2 clamp risk. |
| **Exact column header + statement** | "General Fund", Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary comparison) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary comparison) | "General Fund" (labeled "GENERAL" in column header), Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary comparison) | "GENERAL FUND" (Fund 10 label in column header), Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary comparison) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ | **September 30** ✓ — unique among all Batch-1 and Batch-2 states. Source_date must use Sept 30, not Jun 30. FY2025 = Oct 2024–Sep 2025. |

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function). ACFR figures are **revenue** totals. The comparison flags whether the ACFR GF's revenue base is materially broader than NASBO's budgetary concept. All NASBO figures from `loadStateGF.mjs`.

| State | ACFR GF Total revenues (FY2025) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **TN** | ~$35.5B | ~$23.4B | **~1.51×** | TN's GAAP General Fund consolidates large federal intergovernmental flows (Federal revenue line = $17.5B of $35.5B total). NASBO's budgetary GF excludes the federal share. Same mechanism as PA/IL. | **Accept-and-relabel honestly** (TX precedent). Relabel basis + source chip. Confirm at Phase-109 load. |
| **CT** | ~$26.1B | ~$22.8B | **~1.14×** | CT's GAAP General Fund includes Federal Grants and Aid ($2.8B) that NASBO's budgetary GF excludes. Modest scope divergence — CT's General Fund is closer to NASBO's concept than most states. | **Accept-and-relabel honestly** (TX precedent). Modest difference. Confirm at Phase-109 load. |
| **WI** | ~$38.7B | ~$22.3B | **~1.74×** | WI's GAAP General Fund consolidates Intergovernmental revenue ($14.4B of $38.7B total — nearly all federal). NASBO's budgetary GF excludes it. Similar mechanism to MA (~1.73×). | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-109 load. |
| **WA** | ~$55.8B | ~$32.4B | **~1.72×** | WA's GAAP General Fund consolidates Federal grants-in-aid ($22.4B of $55.8B total). NASBO's budgetary GF excludes the federal pass-through. Also note: WA budgets biennially but ACFR publishes annual GAAP figures (confirmed). | **Accept-and-relabel honestly** (TX precedent). Confirm WA biennial-vs-annual handling in loader (annual GAAP is correct). Confirm at Phase-109 load. |
| **MI** | ~$53.8B | ~$15.1B | **~3.56×** | MI's GAAP General Fund is very broad: $30.3B from federal agencies (Medicaid/ARP passthrough) inside the GF. NASBO's MI GF is the narrow budgetary general fund ($15.1B). Even larger than TX (~3×). The School Aid Fund ($19.5B) is a separate major fund, not included in the GF column. | **Accept-and-relabel honestly** (TX precedent, even more pronounced). Document the large scope divergence and federal-passthrough driver explicitly in the loader notes. Confirm at Phase-109 load. |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **TN** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`ACFR_fy23.pdf` on archive page — durable) | ✅ (`ACFR_FY24.pdf` on archive page — durable) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable without strand. |
| **CT** | FY2025 (final audited, published March 2026) | ✅ (`ACFR-FY2023-v11-2024-04-12.pdf` accessible) | ✅ (`State-of-Connecticut-ACFR-FY-24-3-26-25.pdf` accessible) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **WI** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`FY%202023%20ACFR%20Final.pdf` accessible at `/budget/SCO/`) | ✅ (`FY%202024%20ACFR%20Final.pdf` accessible at `/budget/`) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **WA** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`ACFR23.pdf` accessible at `/CAFR/2023/`) | ✅ (`ACFR24.pdf` accessible at `/CAFR/2024/`) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **MI** | FY2025 (final audited, FY-end Sep 30 2025) | ✅ (`ACFR-FY2023.pdf` accessible — MI FY2023 = Oct 2022–Sep 2023) | ✅ (`ACFR-FY2024.pdf` accessible — MI FY2024 = Oct 2023–Sep 2024) | **GREENLIGHT** — recency floor satisfied. Note: MI FY labels align to the fiscal year ending in Sept of that year. NASBO FY2023/FY2024 rows replaceable by ACFR actuals for the same FY labels. |

---

## Section 6 — Consolidated gap log

| State | FY / Period | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **TN** | FY2025 naming | FY2025 uses `ACFR%20-%20FY25.pdf` (space+dash pattern). All other years use underscore + mixed case. | Named variant, not a gap — PDF confirmed real (8.8 MB, `application/pdf`). SOURCES map must enumerate FY2025 separately. |
| **TN** | FY2021–FY2024 case variation | Mixed-case filenames: `ACFR_fy23.pdf`, `ACFR_FY22.pdf`, `ACFR_fy21.pdf`, `ACFR_FY24.pdf`. No derivable pattern. | Must enumerate from archive landing page. All confirmed durable `tn.gov` paths. Not a gap. |
| **TN** | Pre-FY2009 | FY2007 and FY2008 listed on archive; older years not tested. | Low priority — FY2009–FY2025 (17-year window) is more than sufficient for launch. |
| **CT** | FY2022 naming | `ACFR-2022revised032227.pdf` suffix indicates a revised version. Durable URL confirmed (hosted at `osc.ct.gov/reports/`). | Not a gap — confirmed durable. SOURCES map must use exact URL from archive JSON, not derived. |
| **CT** | Pre-FY2019 verification | FY2018 and older confirmed listed in `_reportsSource` JSON on `osc.ct.gov/reports`. Extraction not verified here — FY2019 is oldest year verified by `pdftotext -table`. | Extension to older years straightforward at load time — enumerate from archive JSON. No extraction gap. Older PDFs likely extract cleanly given consistent OSC layout. |
| **WI** | FY2021–FY2023 path variation | FY2023+FY2022 use `/budget/SCO/` subdirectory; FY2021 uses `/budget/` directly. FY2018–FY2020 use `CAFR{YYYY}.pdf` naming. | Must enumerate per-year URLs from archive — no single derivable pattern. All confirmed durable `doa.wi.gov` paths. Not a gap. |
| **WI** | Pre-FY2000 | Archive lists going back to FY1995 in 4-section format (Intro/GPFS/Combining/Statistical). FY1999 and older split across multiple files. | Low priority — FY2000–FY2025 (26-year window with 2000+ confirmed enumerable) is more than sufficient. |
| **WA** | FY2025 naming | FY2025 uses `FY-2025-Annual-Comprehensive-Financial-Report.pdf` (different prefix from FY2021–FY2024). | Named variant, not a gap — PDF confirmed real (24 MB, `application/pdf`). SOURCES map must special-case FY2025. |
| **WA** | FY2019 and older | Archive lists go back to FY2020 via the OFM `wp-content` path; a State Library link (`wsldocs.sos.wa.gov/library/docs/ofm/cafr/cafr_home.aspx`) references older years. Older year URLs not tested. | Gap: FY2019 and older not verified as directly downloadable. FY2020–FY2025 (6-year window) satisfies recency floor. Extend at load time if deeper history needed. |
| **MI** | FY2025 naming | FY2025 uses `FY-2025-ACFR.pdf` (prefix reversed vs `ACFR-FY{YYYY}.pdf` pattern for FY2019–FY2024). | Named variant, not a gap — PDF confirmed real (4.9 MB, `application/pdf`). SOURCES map must enumerate FY2025 separately. |
| **MI** | Pre-FY2019 | Archive page shows FY2019 as the oldest listed year. Older ACFRs not found on michigan.gov. | Gap: Pre-FY2019 not available on current archive. FY2019–FY2025 (7-year window) satisfies recency floor. |
| **MI** | September 30 FY-end | All other states use June 30. MI's September 30 FY-end requires careful FY-label alignment and source_date stamping in the loader. NASBO FY labels match MI's calendar-year FY designation. | Not a gap — well-documented risk fact. Loader must set FY-end to September 30 and source_date accordingly. |

---

## Section 7 — Loader template mapping + Phase-109 load notes

| State | Closest loader template | GF layout notes | Phase-109 load notes |
|-------|------------------------|----------------|----------------------|
| **TN** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed) | GF is 1st of 4+ columns (General Fund \| Education \| Highway \| nonmajor funds \| Total). Units = thousands. Multiple major fund columns similar to NC layout. | Must enumerate per-year URLs from archive (mixed filename conventions FY2009–FY2025). FY2025 has unique naming — SOURCES map must special-case it. 17-year window FY2009–FY2025 available. |
| **CT** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed — no derivable pattern) | GF is 1st of 7 columns (General \| Debt Service \| Transportation \| Restricted Grants & Accounts \| Grant & Loan Programs \| Other \| Total). Units = thousands. Extract GF column items only — do NOT sum across columns. | Enumerate all per-year URLs from `_reportsSource` JSON blob at `osc.ct.gov/reports`. Window FY2019–FY2025 extraction-verified; FY1988+ enumerable from same JSON. FY2022 URL has "revised" suffix — enumerate explicitly. |
| **WI** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map) | GF is 1st of 3 columns (General \| Transportation \| Nonmajor Governmental \| Total). Units = thousands. Cleaner 3-column layout than TN or CT. | Must enumerate per-year URLs from archive (path structure changes: FY2022–FY2023 = `/budget/SCO/`; FY2021 = `/budget/`; FY2018–FY2020 = `CAFR{YYYY}.pdf`). Window FY2019–FY2025 confirmed; FY2000+ enumerable from archive. |
| **WA** | `processPAAcfr.js` / `processPARevenueAcfr.js` (similar multi-column GF layout with Higher Education major funds) | GF is 1st of 3+ columns (General \| Higher Education Special Revenue \| Higher Education Endowment \| Total). Units = thousands. Very large PDF (24 MB for FY2025). GAAP GF includes large federal grants-in-aid ($22.4B). | **CRITICAL: FY2025 has unique URL naming** — `FY-2025-Annual-Comprehensive-Financial-Report.pdf`. Enumerate FY2025 separately. FY2020–FY2024 follow `CAFR/{YYYY}/ACFR{YY}.pdf` pattern (except FY2020 uses `CAFR20.pdf`). Window FY2020–FY2025 confirmed. WA biennial-budget caveat: loader must document that ACFR is annual GAAP (not biennial), FY-end = Jun 30. |
| **MI** | `processILAcfr.js` or new `processMIAcfr.js` template (September 30 FY-end is unique; may require a new template) | GF is 1st of 3 columns (General Fund [Fund 10] \| School Aid Fund [Fund 20] \| Non-Major Funds \| Totals). Units = thousands. **FY-end September 30 — requires custom FY-end logic not in any existing template.** Column headers are fund codes (10/20/30/70) not standard names — parser must identify GF as Fund 10. | **CRITICAL: September 30 FY-end requires loader customization** — none of the existing templates (`processILAcfr.js`, `processPAAcfr.js`, etc.) are built for a September 30 FY-end. Must set `fiscal_year_start_month = 10` (October). Source_date stamps must use `{FY}-09-30` not `{FY}-06-30`. FY labeling: MI "FY2025" = Oct 2024–Sep 2025, same as NASBO FY2025 designation. URL: `ACFR-FY{YYYY}.pdf` for FY2019–FY2024; `FY-2025-ACFR.pdf` for FY2025. The ~3.56× scope divergence vs NASBO (federal Medicaid passthrough) must be documented prominently in the loader and relabel. |

---

## TN — Tennessee Detail Block

**Source:** State of Tennessee Department of Finance and Administration / Division of Accounts
**PDF:** Annual Comprehensive Financial Report (ACFR) — audited, GAAP basis
**Landing page:** `https://www.tn.gov/finance/doa/fa-accfin-ar.html`

**URL pattern (all confirmed accessible — HTTP 200, `application/pdf`, > 1 MB):**
- FY2025: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR%20-%20FY25.pdf` (unique naming)
- FY2024: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_FY24.pdf`
- FY2023: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_fy23.pdf`
- FY2022: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_FY22.pdf`
- FY2021: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_fy21.pdf`
- FY2020: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/acfr_fy20.pdf`
- FY2009–FY2019: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/acfr_fy{YY}.pdf` (lowercase 2-digit year)

**Statement:** Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances
**Column:** General Fund (1st of 4+: General Fund | Education | Highway | nonmajor funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $35,473,625K — line items sum = $35,473,625K ✅ (diff $0)
- FY2019: GF Total revenues = $22,201,193K — line items sum = $22,201,193K ✅ (diff $0)

**Investment income:** FY2025 = +$1,042,605K (positive); FY2019 = +$154,441K (positive). No P2 clamp needed for verified years. Check older years at load.

**Clean window:** FY2009–FY2025 (17 years; FY2009 confirmed accessible at 5.16 MB)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

## CT — Connecticut Detail Block

**Source:** State of Connecticut Office of the State Comptroller (OSC)
**PDF:** Annual Comprehensive Financial Report (ACFR) — previously CAFR pre-FY2021
**Landing page / archive:** `https://osc.ct.gov/reports` (ACFR links in `_reportsSource` JavaScript JSON blob on page)

**URL pattern (all explicit per-year — no derivable pattern; enumerate from archive JSON):**
- FY2025: `https://osc.ct.gov/wp-content/uploads/2026/03/State-of-Connecticut-ACFR-2-27-26_Final.pdf`
- FY2024: `https://osc.ct.gov/wp-content/uploads/2025/03/State-of-Connecticut-ACFR-FY-24-3-26-25.pdf`
- FY2023: `https://osc.ct.gov/wp-content/uploads/2024/04/ACFR-FY2023-v11-2024-04-12.pdf`
- FY2022: `https://osc.ct.gov/reports/ACFR-2022revised032227.pdf`
- FY2021: `https://osc.ct.gov/reports/ACFR2021.pdf`
- FY2020: `https://osc.ct.gov/reports/CAFR2020.pdf`
- FY2019: `https://osc.ct.gov/reports/CAFR-2019.pdf`
- FY2018: `https://osc.ct.gov/reports/CAFR-2018rev040919.pdf`
- FY2017: `https://osc.ct.gov/reports/2017CAFRrev012918.pdf`
- FY2016: `https://osc.ct.gov/2016cafr/CAFR2016rev.pdf`
- FY2015: `https://osc.ct.gov/2015cafr/cafr2015.pdf`
- FY2014–FY1988: enumerable from `_reportsSource` JSON on `osc.ct.gov/reports`

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 7: General | Debt Service | Transportation | Restricted Grants & Accounts | Grant & Loan Programs | Other Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $26,074,183K — line items sum = $26,074,183K ✅ (diff $0)
- FY2019: GF Total revenues = $20,776,288K — line items sum = $20,776,288K ✅ (diff $0)

**Investment income:** FY2025 = +$338,294K (positive); FY2019 = +$48,950K (positive). No P2 clamp needed for verified years. Check older years at load — CT had fiscal stress in early 2010s; possible negative investment income years.

**Clean window:** FY2019–FY2025 (7 years verified; FY1988+ enumerable from archive JSON)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

## WI — Wisconsin Detail Block

**Source:** State of Wisconsin Department of Administration / State Controller's Office
**PDF:** Annual Comprehensive Financial Report (ACFR) — previously CAFR
**Landing page:** `https://doa.wi.gov/Pages/StateFinances/ACFR.aspx`
**Archive page:** `https://doa.wi.gov/Pages/StateFinances/Financial-Reporting-Archive.aspx`

**URL pattern (all explicit per-year — no single derivable pattern):**
- FY2025: `https://doa.wi.gov/budget/FY%202025%20ACFR%20Final.pdf`
- FY2024: `https://doa.wi.gov/budget/FY%202024%20ACFR%20Final.pdf`
- FY2023: `https://doa.wi.gov/budget/SCO/FY%202023%20ACFR%20Final.pdf`
- FY2022: `https://doa.wi.gov/budget/SCO/FY%202022%20ACFR.pdf`
- FY2021: `https://doa.wi.gov/budget/ACFR2021.pdf`
- FY2020: `https://doa.wi.gov/budget/CAFR2020.pdf`
- FY2019: `https://doa.wi.gov/budget/CAFR2019.pdf`
- FY2018: `https://doa.wi.gov/budget/CAFR2018.pdf`
- FY2017: `https://doa.wi.gov/DEBFCapitalFinance/2017/2017_CAFR_Linked.pdf`
- FY2016: `https://doa.wi.gov/DEBFCapitalFinance/2016/2016_CAFR_Linked.pdf`
- FY2000–FY2015: `https://doa.wi.gov/DEBFCapitalFinance/{YYYY}/{YYYY}CAFR[_Linked].pdf` (per-year variants; enumerate from archive page)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 3: General | Transportation | Nonmajor Governmental | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $38,655,598K — line items sum = $38,655,598K ✅ (diff $0)
- FY2019: GF Total revenues = $27,866,801K — line items sum = $27,866,801K ✅ (diff $0)

**Investment income:** FY2025 = +$431,703K (positive); FY2019 = +$29,649K (positive). No P2 clamp needed for verified years. Check older years at load (FY2008–FY2012 may have near-zero investment income due to zero-rate era, but unlikely negative in GF column).

**Clean window:** FY2019–FY2025 (7 years verified; FY2000+ enumerable from archive; FY2025+FY2024 on separate paths vs FY2021–FY2023)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

## WA — Washington Detail Block

**Source:** State of Washington Office of Financial Management (OFM)
**PDF:** Annual Comprehensive Financial Report (ACFR) — previously CAFR
**Landing page:** `https://ofm.wa.gov/spending/financial-audit-reports/annual-comprehensive-financial-report/`

**URL pattern:**
- FY2025: `https://ofm.wa.gov/wp-content/uploads/FY-2025-Annual-Comprehensive-Financial-Report.pdf` (unique name — must special-case)
- FY2024: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2024/ACFR24.pdf`
- FY2023: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2023/ACFR23.pdf`
- FY2022: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2022/ACFR22.pdf`
- FY2021: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2021/ACFR21.pdf`
- FY2020: `https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2020/CAFR20.pdf` (note: `CAFR20` vs `ACFR{YY}` for FY2021–FY2024)
- Pre-FY2020: Not verified from wp-content path. WA State Library link referenced on archive page; extend at load time.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 3+: "GENERAL" | Higher Education Special Revenue | Higher Education Endowment and Other Permanent | Total)
**Units:** Thousands
**FY-end:** June 30

**WA biennial budget caveat (D-02 per plan):** Washington State budgets on a 2-year biennium cycle. However, the ACFR publishes **annual GAAP** financial statements for each individual fiscal year ending June 30. The Governmental Funds statement clearly shows "For the Fiscal Year Ended June 30, 2025" — annual figures confirmed. The biennial budget is a budgetary/statutory concept only; the GAAP ACFR is annual. Loader must treat FY-end = June 30 and load per-year. FY2023 and FY2025 are each the first year of their respective bienniums; FY2024 and FY2026 are the second years — but both are full GAAP annual filings.

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $55,775,958K — line items sum = $55,775,958K ✅ (diff $0)
- FY2020: GF Total revenues = $38,977,410K — line items sum = $38,977,410K ✅ (diff $0)

**Investment income:** FY2025 = +$429,753K (positive); FY2020 = +$114,104K (positive). Column header is "Investment income (loss)" — indicates negative is possible in adverse markets. Check older years at load.

**Clean window:** FY2020–FY2025 (6 years confirmed; FY2021–FY2024 URLs confirmed accessible)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

## MI — Michigan Detail Block

**Source:** State of Michigan Department of Technology, Management and Budget / Office of Financial Management (OFM)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.michigan.gov/budget/fiscal-pages/reports/annual-comprehensive-financial-report`
**Archive page:** `https://www.michigan.gov/budget/budget-documents/document-archive/annual-comprehensive-financial-reports`

**URL pattern (all hosted under `/budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report/`):**
- FY2025: `FY-2025-ACFR.pdf` (unique name — must enumerate separately)
- FY2024: `ACFR-FY2024.pdf`
- FY2023: `ACFR-FY2023.pdf`
- FY2022: `ACFR-FY2022.pdf`
- FY2021: `ACFR-FY2021.pdf`
- FY2020: `ACFR-FY2020.pdf`
- FY2019: `ACFR-FY2019.pdf`
- Full base URL example: `https://www.michigan.gov/budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report/ACFR-FY2024.pdf`
- Note: The `?rev=...&hash=...` query parameters may appear in HTML but are NOT required for direct download.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** GENERAL FUND (Fund 10, 1st of: General Fund | School Aid Fund | Non-Major Funds | Totals)
**Units:** Thousands
**FY-end:** September 30 (UNIQUE — all other Batch-1 and Batch-2 states use June 30)

**CRITICAL — September 30 FY-end:** Michigan's fiscal year runs October 1 to September 30. This is different from all other roster states. The loader must:
1. Set `fiscal_year_start_month = 10` (October)
2. Set `source_date` to `{FY}-09-30` (September 30), not June 30
3. Align FY labels correctly: ACFR "FY2025" = October 2024–September 2025 = NASBO "FY2025" ✓ (same calendar year designation, different month boundary)

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $53,788,610K — line items sum = $53,788,611K ✅ (diff $1 — acceptable GAAP thousands rounding)
- FY2020: GF Total revenues = $39,920,656K — line items sum = $39,920,656K ✅ (diff $0)

**Investment income:** Not broken out as a separate GF revenue line (embedded in Miscellaneous revenue). No standalone negative line possible. No P2 clamp risk from investment income.

**Scope vs NASBO (~3.56×):** MI ACFR GF ($53.8B) vs NASBO GF ($15.1B). The huge divergence is driven by $30.3B in "From federal agencies" revenue inside the GF (Medicaid federal match and federal passthrough programs). This is the TX-trap at its most pronounced — MI's GAAP General Fund includes nearly all federal pass-through spending. The School Aid Fund ($19.5B) is a separate major fund and NOT included in the GF column. Must be prominently documented in the loader and relabel.

**Clean window:** FY2019–FY2025 (7 years; all years confirmed accessible)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs; MI FY2024 = Oct 2023–Sep 2024)

---

## Phase-109 Pre-Load Checklist (Batch-2 states)

| State | Pre-load requirement | Risk if skipped |
|-------|---------------------|-----------------|
| **TN** | None — no existing state-budget node overlap. Standard new ACFR loader. | N/A |
| **CT** | None — no existing state-budget node overlap. Standard new ACFR loader. Check older years for negative investment income (CT fiscal stress era). | Negative revenue displayed in UI if P2 clamp not applied to negative investment income years. |
| **WI** | None — no existing state-budget node overlap. Standard new ACFR loader. | N/A |
| **WA** | **FY2025 has unique URL** — must not use derived pattern. Also: WA biennial budget must NOT be mistaken for annual data — ACFR is annual GAAP; loader must document this. | Wrong URL 404s FY2025 fetch. Biennial misidentification would cause incorrect FY coverage. |
| **MI** | **September 30 FY-end requires custom loader logic** — `fiscal_year_start_month = 10`, `source_date = {FY}-09-30`. No existing template has this. May require a `processMIAcfr.js` custom template rather than a pure clone of PA/IL. Also: FY2025 has unique URL name. | Wrong FY-end sets incorrect source_date and potentially incorrect FY labeling in UI. |
