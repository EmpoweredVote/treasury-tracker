# 107 — Batch 2 ACFR Source Location (RECON-06, TN/CT/WI/WA/MI)

**Status:** IN PROGRESS — TN/CT/WI complete; WA/MI in progress
**Phase:** 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
**States:** Tennessee (TN), Connecticut (CT), Wisconsin (WI), Washington (WA), Michigan (MI)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 103-PA-IL-SOURCES.md shape (PA/IL/NJ/MA/NC/GA/MD recon mold).

All three Task-1 states (TN, CT, WI) publish the Governmental Funds *Statement of Revenues, Expenditures,
and Changes in Fund Balances* — **General Fund** column (GAAP basis). All three report in thousands.
TN FY-end June 30; CT FY-end June 30; WI FY-end June 30. All three pass the D-07 recency floor
(FY2023 + FY2024 in clean window). TX-trap scope divergence documented for each state in Section 4.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **TN** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds (PDF page ~39 of FY2025 ACFR) | **General Fund** (1st of General Fund \| Education \| Highway \| [other nonmajor]) | thousands | Jun 30 | **FY2009–FY2025** | Base: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/` + FY-variant filename. FY2025: `ACFR%20-%20FY25.pdf` (space+dash). FY2024–FY2022: `ACFR_FY{YY}.pdf` or `ACFR_fy{YY}.pdf` (mixed case, 2-digit year). FY2020 and older: `acfr_fy{YY}.pdf` (lowercase). **Must enumerate per-year names from archive page.** Landing: `https://www.tn.gov/finance/doa/fa-accfin-ar.html` |
| **CT** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~37 of FY2025 ACFR) | **General Fund** (1st of General \| Debt Service \| Transportation \| Restricted Grants & Accounts \| Grant & Loan Programs \| Other \| Total) | thousands | Jun 30 | **FY1988–FY2025** (all enumerable from archive; FY2019 oldest verified for `-table` extraction) | FY2025: `https://osc.ct.gov/wp-content/uploads/2026/03/State-of-Connecticut-ACFR-2-27-26_Final.pdf`. FY2024: `https://osc.ct.gov/wp-content/uploads/2025/03/State-of-Connecticut-ACFR-FY-24-3-26-25.pdf`. FY2023: `https://osc.ct.gov/wp-content/uploads/2024/04/ACFR-FY2023-v11-2024-04-12.pdf`. FY2022: `https://osc.ct.gov/reports/ACFR-2022revised032227.pdf`. FY2021: `https://osc.ct.gov/reports/ACFR2021.pdf`. FY2020: `https://osc.ct.gov/reports/CAFR2020.pdf`. FY2019: `https://osc.ct.gov/reports/CAFR-2019.pdf`. **No derivable pattern — enumerate from archive JSON** at `https://osc.ct.gov/reports` (the `_reportsSource` JS blob lists all years with URLs). Landing: `https://osc.ct.gov/reports` |
| **WI** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~45 of FY2025 ACFR) | **General Fund** (1st of General \| Transportation \| Nonmajor Governmental \| Total) | thousands | Jun 30 | **FY2000–FY2025** (all enumerable from archive; FY2019 oldest verified for `-table` extraction) | FY2025: `https://doa.wi.gov/budget/FY%202025%20ACFR%20Final.pdf`. FY2024: `https://doa.wi.gov/budget/FY%202024%20ACFR%20Final.pdf`. FY2023: `https://doa.wi.gov/budget/SCO/FY%202023%20ACFR%20Final.pdf`. FY2022: `https://doa.wi.gov/budget/SCO/FY%202022%20ACFR.pdf`. FY2021: `https://doa.wi.gov/budget/ACFR2021.pdf`. FY2020: `https://doa.wi.gov/budget/CAFR2020.pdf`. FY2019 and older: `https://doa.wi.gov/budget/CAFR{YYYY}.pdf`. FY2000–FY2016: `https://doa.wi.gov/DEBFCapitalFinance/{YYYY}/{YYYY}CAFR.pdf` (with year-specific naming). **Must enumerate from archive.** Landing: `https://doa.wi.gov/Pages/StateFinances/Financial-Reporting-Archive.aspx` |
| **WA** | TBD | TBD | TBD | TBD | TBD | TBD |
| **MI** | TBD | TBD | TBD | TBD | TBD | TBD |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **TN** | FY2025 (latest) | **$35,473,625K** | GF line items sum = $35,473,625K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **TN** | FY2019 (oldest sampled — FY2009 accessible but FY2019 extraction verified) | **$22,201,193K** | GF line items sum = $22,201,193K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **CT** | FY2025 (latest) | **$26,074,183K** | GF line items sum = $26,074,183K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **CT** | FY2019 (oldest sampled) | **$20,776,288K** | GF line items sum = $20,776,288K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WI** | FY2025 (latest) | **$38,655,598K** | GF line items sum = $38,655,598K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WI** | FY2019 (oldest sampled) | **$27,866,801K** | GF line items sum = $27,866,801K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **WA** | TBD (latest) | TBD | TBD |
| **WA** | TBD (oldest clean) | TBD | TBD |
| **MI** | TBD (latest) | TBD | TBD |
| **MI** | TBD (oldest clean) | TBD | TBD |

---

## Section 3 — Four risk facts per D-08

| Fact | TN | CT | WI | WA | MI |
|------|----|----|----|----|-----|
| **Units** | thousands | thousands | thousands | TBD | TBD |
| **Negative GF line items** | None observed in FY2025 or FY2019. Investment income = +$1,042,605K (FY2025), +$154,441K (FY2019). Low risk. | None observed in FY2025 or FY2019. Investment Earnings = +$338,294K (FY2025), +$48,950K (FY2019). | None observed in FY2025 or FY2019. Investment and Interest Income = +$431,703K (FY2025), +$29,649K (FY2019). | TBD | TBD |
| **Exact column header + statement** | "General Fund", Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary comparison) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary comparison) | TBD | TBD |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | TBD | TBD |

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function). ACFR figures are **revenue** totals. The comparison flags whether the ACFR GF's revenue base is materially broader than NASBO's budgetary concept (federal intergovernmental revenue inside the GAAP GF).

| State | ACFR GF Total revenues (FY2025) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **TN** | ~$35.5B | ~$23.4B | **~1.51×** | TN's GAAP General Fund consolidates large federal intergovernmental flows (Federal line = $17.5B of the $35.5B total). NASBO's budgetary GF excludes the federal share. Same mechanism as PA/IL. | **Accept-and-relabel honestly** (TX precedent). Relabel basis + source chip. Confirm at Phase-109 load. |
| **CT** | ~$26.1B | ~$22.8B | **~1.14×** | CT's GAAP General Fund includes Federal Grants and Aid ($2.8B). NASBO's budgetary GF excludes federal grants. Modest divergence. | **Accept-and-relabel honestly** (TX precedent). Modest scope difference. Confirm at Phase-109 load. |
| **WI** | ~$38.7B | ~$22.3B | **~1.74×** | WI's GAAP General Fund consolidates Intergovernmental revenue ($14.4B of $38.7B total — nearly all federal). NASBO's budgetary GF excludes it. Similar mechanism to MA (~1.73×). | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-109 load. |
| **WA** | TBD | ~$32.4B | TBD | TBD | TBD |
| **MI** | TBD | ~$15.1B | TBD | TBD | TBD |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **TN** | FY2025 (final audited, FY-end June 30 2025) | ✅ (`ACFR_fy23.pdf` on archive page) | ✅ (`ACFR_FY24.pdf` on archive page) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable without strand. |
| **CT** | FY2025 (final audited, published March 2026) | ✅ (`ACFR-FY2023-v11-2024-04-12.pdf` accessible) | ✅ (`State-of-Connecticut-ACFR-FY-24-3-26-25.pdf` accessible) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **WI** | FY2025 (final audited, FY-end June 30 2025) | ✅ (`FY%202023%20ACFR%20Final.pdf` accessible) | ✅ (`FY%202024%20ACFR%20Final.pdf` accessible) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **WA** | TBD | TBD | TBD | TBD |
| **MI** | TBD | TBD | TBD | TBD |

---

## Section 6 — Consolidated gap log

| State | FY | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **TN** | FY2025 naming | FY2025 uses `ACFR%20-%20FY25.pdf` (space+dash pattern), all other years use underscore patterns. Must special-case FY2025 in SOURCES map. | Named variant, not a gap — PDF confirmed real (8.8 MB). SOURCES map must enumerate FY2025 separately. |
| **TN** | FY2021/FY2022/FY2023 case variation | Mixed-case filenames: FY2023=`ACFR_fy23.pdf`, FY2022=`ACFR_FY22.pdf`, FY2021=`ACFR_fy21.pdf`. | Must enumerate from archive page — no derivable pattern for 2021–2024. All confirmed durable `tn.gov` paths. |
| **TN** | Pre-FY2009 | Archive lists FY2007–FY2008 via same base pattern. FY2007 and older not tested. | Low priority — FY2009–FY2025 window (17 years) is more than sufficient. |
| **CT** | FY2022 naming | `ACFR-2022revised032227.pdf` suffix suggests it's a revised version. Durable URL (confirmed 2022 on `osc.ct.gov/reports/`). | No gap — confirmed durable. SOURCES map must use exact URL from archive JSON, not a derived pattern. |
| **CT** | Pre-FY2019 verification | URLs for FY2018 and older confirmed durable (listed in `_reportsSource` JSON blob on `osc.ct.gov/reports`). FY2019 is the oldest year extraction-verified here. | Extension to older years straightforward at load time — enumerate from archive JSON. No extraction gap. |
| **WI** | FY2021/FY2022/FY2023 path variation | FY2023 and FY2022 use `/budget/SCO/` subdirectory; FY2021 uses `/budget/` directly. FY2019 and FY2020 use `CAFR{YYYY}.pdf`. | Must enumerate per-year URLs from archive page — no single derivable pattern. All confirmed durable `doa.wi.gov` paths. |
| **WA** | TBD | TBD | TBD |
| **MI** | TBD | TBD | TBD |

---

## Section 7 — Loader template mapping + Phase-109 load notes

| State | Closest loader template | GF layout notes | Phase-109 load notes |
|-------|------------------------|----------------|----------------------|
| **TN** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed) | GF is 1st of 4+ columns (General Fund \| Education \| Highway \| nonmajor \| Total). Units = thousands. Multiple major funds means multi-column layout like IL's "General Fund \| Other Nonmajor \| Total". | Must enumerate per-year URLs from archive (mixed filename conventions FY2025–FY2009). FY2025 has unique naming — SOURCES map must special-case it. 17-year window FY2009–FY2025 available. |
| **CT** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed — no derivable pattern) | GF is 1st of 7 columns. Units = thousands. Layout similar to NC (multiple named non-major fund columns). Must extract GF column items only — do not sum across columns. | Enumerate all per-year URLs from `_reportsSource` JSON blob at `osc.ct.gov/reports`. Window FY2019+ easily extractable; FY2018 and older enumerable from same JSON. FY2022 URL has "revised" suffix — enumerate explicitly. |
| **WI** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map) | GF is 1st of 3+ columns (General \| Transportation \| Nonmajor \| Total). Units = thousands. Clean `-table` extraction confirmed for FY2025 and FY2019. | Must enumerate per-year URLs from archive (path structure changes at FY2022: `/budget/SCO/`; FY2021: `/budget/`; FY2019–2020: `CAFR{YYYY}.pdf`). Window FY2019–FY2025 confirmed; FY2000+ enumerable from archive. |
| **WA** | TBD | TBD | TBD |
| **MI** | TBD | TBD | TBD |

---

## TN — Tennessee Detail Block

**Source:** State of Tennessee Department of Finance and Administration / Division of Accounts
**PDF:** Annual Comprehensive Financial Report (ACFR) — audited, GAAP basis
**Landing page:** `https://www.tn.gov/finance/doa/fa-accfin-ar.html`

**URL pattern (archive, FY2025 and prior):**
- FY2025: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR%20-%20FY25.pdf` (space+dash, unique naming)
- FY2024: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_FY24.pdf`
- FY2023: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_fy23.pdf`
- FY2022: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_FY22.pdf`
- FY2021: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR_fy21.pdf`
- FY2020: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/acfr_fy20.pdf`
- FY2019–FY2009: `https://www.tn.gov/content/dam/tn/finance/acfr/archive/acfr_fy{YY}.pdf` (all lowercase, 2-digit year)
  - Examples: `acfr_fy19.pdf`, `acfr_fy18.pdf`, ..., `acfr_fy09.pdf`
- All confirmed accessible (HTTP 200, `application/pdf`, real content > 1 MB).

**Statement:** Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances
**Column:** General Fund (1st of 4+: General Fund | Education | Highway | [nonmajor funds] | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $35,473,625K — line items sum = $35,473,625K ✅ (diff $0)
- FY2019: GF Total revenues = $22,201,193K — line items sum = $22,201,193K ✅ (diff $0)

**Investment income:** FY2025 Investment income = +$1,042,605K (positive); FY2019 = +$154,441K (positive). No P2 clamp needed for verified years. Check older years at load.

**Clean window:** FY2009–FY2025 (17 years; FY2009 confirmed accessible; archive lists FY2007–FY2008 also)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

## CT — Connecticut Detail Block

**Source:** State of Connecticut Office of the State Comptroller (OSC)
**PDF:** Annual Comprehensive Financial Report (ACFR) — previously CAFR pre-FY2021
**Landing page / archive:** `https://osc.ct.gov/reports` (ACFR links in `_reportsSource` JavaScript JSON blob)

**URL pattern (all explicit per-year URLs — no derivable pattern):**
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
- FY2014–FY1988: enumerable from `_reportsSource` JSON on reports page (all confirmed hosted on `osc.ct.gov`)
- All confirmed accessible (HTTP 200, `application/pdf`, real content > 1 MB).

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 7: General | Debt Service | Transportation | Restricted Grants & Accounts | Grant & Loan Programs | Other Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $26,074,183K — line items sum = $26,074,183K ✅ (diff $0)
- FY2019: GF Total revenues = $20,776,288K — line items sum = $20,776,288K ✅ (diff $0)

**Investment income:** FY2025 Investment Earnings = +$338,294K (positive); FY2019 = +$48,950K (positive). No P2 clamp needed for verified years. Check older years at load (CT had fiscal stress in early 2010s — possible negative years).

**Clean window:** FY2019–FY2025 (7 years verified; FY2018 and older enumerable from archive and likely clean — extend at load time)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

## WI — Wisconsin Detail Block

**Source:** State of Wisconsin Department of Administration / State Controller's Office
**PDF:** Annual Comprehensive Financial Report (ACFR) — previously CAFR
**Landing page:** `https://doa.wi.gov/Pages/StateFinances/ACFR.aspx`
**Archive page:** `https://doa.wi.gov/Pages/StateFinances/Financial-Reporting-Archive.aspx`

**URL pattern (all explicit per-year URLs — no single derivable pattern):**
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
- FY2015–FY2000: `https://doa.wi.gov/DEBFCapitalFinance/{YYYY}/{YYYY}CAFR[_Linked].pdf` (naming variant per year; enumerate from archive)
- All recent years confirmed accessible (HTTP 200, `application/pdf`, real content > 2 MB).

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 3+: General | Transportation | Nonmajor Governmental | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $38,655,598K — line items sum = $38,655,598K ✅ (diff $0)
- FY2019: GF Total revenues = $27,866,801K — line items sum = $27,866,801K ✅ (diff $0)

**Investment income:** FY2025 Investment and Interest Income = +$431,703K (positive); FY2019 = +$29,649K (positive). No P2 clamp needed for verified years. Check older years at load (zero-rate era FY2010–FY2015 may have very low/near-zero investment income but unlikely negative in GF column).

**Clean window:** FY2019–FY2025 (7 years verified; FY2018 and older enumerable from archive; FY2000+ durable)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed accessible with durable URLs)

---

*WA and MI detail blocks follow upon Task-2 completion.*
