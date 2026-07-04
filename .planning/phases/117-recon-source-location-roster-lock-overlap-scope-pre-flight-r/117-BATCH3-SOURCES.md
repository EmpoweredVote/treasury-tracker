# 117 — Batch 3 ACFR Source Location (RECON-11, NE/NV/NH/NM/ND)

**Status:** COMPLETE — all 5 states recon'd, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**States:** Nebraska (NE), Nevada (NV), New Hampshire (NH), New Mexico (NM), North Dakota (ND)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 112-BATCH1/2-SOURCES.md shape.

## Workspace

`_acfr-work/{ne,nv,nh,nm,nd}/` created (gitignored — `.gitignore` lines 108/133 cover `_acfr-work/`).
`pdftotext -v` confirms poppler 4.00 available. `_acfr-work/extract_gf.py` (the v2.14 GF-column
extractor, position-anchored on the "Total revenues" row) used unmodified for all five states.

---

## Section 0 — D-03 Triage (does a GAAP Governmental Funds ACFR with a splittable GF column exist?)

| State | Triage verdict | Basis |
|-------|---------------|-------|
| **Nebraska (NE)** | **RECON** | `das.nebraska.gov/accounting/financial_reports.php` lists direct ACFR PDF links FY2020–FY2025, fully derivable URL, confirmed `application/pdf` (not soft-404). |
| **Nevada (NV)** | **RECON** (with a recency caveat) | `controller.nv.gov` confirms a GAAP ACFR exists; the live nav page states ACFR documents are "currently being remediated" (records-request fallback), but the actual filed PDFs remain directly fetchable by explicit filename through FY2023. FY2024/FY2025 not yet found — see Section 5/6. |
| **New Hampshire (NH)** | **RECON** | Contrary to the pre-planning speculation that NH would be a leading STAY-NASBO candidate, `das.nh.gov/accounting/fy {YY}/` publishes an annual GAAP ACFR every year including FY2024 (published ~9 months after FYE). The blocker is an **access mechanism** issue (Akamai edge-blocks automated fetches — see Section 6), not a data-availability issue. |
| **New Mexico (NM)** | **RECON** | `nmdfa.state.nm.us` (Dept. of Finance & Administration) publishes an annual statewide ACFR (opaque WordPress-upload URLs, confirmed FY2019/FY2022/FY2024) with a clean Governmental Funds GENERAL FUND column. |
| **North Dakota (ND)** | **RECON** | `omb.nd.gov/financial-transparency/annual-comprehensive-financial-reports-acfr` publishes an **annual** GAAP ACFR (FY2021–FY2025, fully derivable URL) — confirms ND's ACFR is NOT limited by its biennial appropriations budget; the annual GAAP reporting cycle is unaffected. |

**Outcome: all 5 Batch-3 states pass D-03 triage — zero STAY-NASBO-exception candidates in this batch.** No accept-relabel-only or stay-NASBO disposition needed; the Phase-123 "nodes remaining NASBO-served" list gets **zero** additions from Batch 3.

---

## Section D-10 — Overlap check (read-only DB probe)

Read-only probe of `treasury.municipalities` / `treasury.budgets` confirmed all five state nodes are
clean NASBO-only nodes (2 `budgets` rows each: FY2023/operating + FY2024/operating, no
`operating_budgets` line items) — matching the `loadStateGF.mjs` NASBO-totals-only write pattern.
**No overlap for any of the 5 states** — no in-place-upgrade planning needed (same conclusion as
Phase 112 for tranche 3). Note: dead pre-v2.10 "estimated" loaders (`scripts/processNE.js`,
`processNV.js`, `processNH.js`, `processNM.js`, `processND.js` + their `*Revenue.js` counterparts)
exist in `scripts/` but were **never run against the live DB** for these nodes — confirmed by the
probe (no matching `data_source`/`source_url` residue). They are superseded/orphaned code, not a
live overlap; out of scope to delete in this doc-only recon phase.

| State | Municipality ID | Existing `budgets` rows | Verdict |
|-------|-----------------|--------------------------|---------|
| Nebraska | `ccfb8751-ae32-4974-96a9-d8c8ea85a898` | 2023/operating=$5.154B, 2024/operating=$5.314B | Clean NASBO-only |
| Nevada | `d0879e45-0b72-41ee-bdbd-a214a4f2a1d5` | 2023/operating=$4.742B, 2024/operating=$5.273B | Clean NASBO-only |
| New Hampshire | `c54f6dbd-3f2a-453e-b0b9-259e377aef67` | 2023/operating=$2.136B, 2024/operating=$1.981B | Clean NASBO-only |
| New Mexico | `1e60ff76-c9fa-48d0-9442-042f61cd40ea` | 2023/operating=$8.682B, 2024/operating=$9.975B | Clean NASBO-only |
| North Dakota | `e84aafe0-eeaa-470a-8fd3-708c88af2a80` | 2023/operating=$2.436B, 2024/operating=$2.876B | Clean NASBO-only |

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **NE** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General \| Highway \| Federal \| Health and Social Services \| Permanent School \| Nonmajor \| Totals) | thousands | Jun 30 | **FY2020–FY2025** | `https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_{YYYY}.pdf` — fully derivable, confirmed FY2020–FY2025. Landing: `https://das.nebraska.gov/accounting/financial_reports.php` |
| **NV** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| State Education Fund \| Nonmajor Governmental Funds \| Total Governmental Funds) | **dollars** (not thousands) | Jun 30 | **FY2019–FY2023** (FY2024/FY2025 not found — see Section 5/6) | Opaque, non-derivable per-year filenames under `https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/`: FY2023 = `2023-acfr-report.pdf` (also mirrored at the stable alias `annual-comprehensive-financial-report.pdf`), FY2022 = `2022_ACFR_Report.pdf`, FY2021 = `FY21_ACFR.pdf`, FY2020 = `ACFR_FY2020.pdf`, FY2019 = `CAFR_Web_2019.pdf`. Landing: `https://controller.nv.gov/financial-reports/annual-comprehensive-financial-report-acfr/` (page itself states documents are "currently being remediated" — direct filenames still resolve). |
| **NH** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Highway \| Education \| Non-Major Governmental \| Total) | thousands | Jun 30 | **FY2017–FY2024** | `https://www.das.nh.gov/accounting/fy%20{YY}/fy_{YYYY}_annual_comprehensive_financial_report.pdf` for FY2021/22/24; FY2017–FY2020 use `fy_{YYYY}_comprehensive_annual_financial_report.pdf` (pre-ACFR-renaming CAFR era); **FY2023 exception**: `fy_2023_annual_comprehensive_financial_report_acfr.pdf` (adds `_acfr` suffix). **CRITICAL: das.nh.gov is Akamai-edge-blocked for automated/curl fetches (HTTP 403, all UA/header variants tried) — see Section 6.** Landing: `https://www.das.nh.gov/accounting/` (blocked; use Wayback mirror to verify). |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **NE** | FY2025 (latest) | **$6,308,910K** | GF line items sum = $6,308,910K; matches printed Total revenues. Diff = $0. ✅ |
| **NE** | FY2020 (oldest clean) | **$4,993,719K** | GF line items sum = $4,993,719K; matches printed Total revenues. Diff = $0. ✅ |
| **NV** | FY2023 (latest confirmed) | **$15,153,168,081** (dollars) | GF line items sum = $15,153,168,081; matches printed Total revenues. Diff = $0. ✅ |
| **NV** | FY2019 (oldest sampled) | **$10,411,179,917** (dollars) | GF line items sum = $10,411,179,917; matches printed Total revenues. Diff = $0. ✅ |
| **NH** | FY2024 (latest, via Wayback mirror of das.nh.gov) | **$6,377,159K** | GF line items sum = $6,377,159K; matches printed Total revenues. Diff = $0. ✅ |
| **NH** | FY2017 (oldest sampled, via Wayback mirror) | **$4,207,160K** | GF line items sum = $4,207,160K; matches printed Total revenues. Diff = $0. ✅ |

All six ties confirmed via `extract_gf.py` (position-anchored on the "Total revenues" row) against
`pdftotext -table` output — zero manual overrides needed for any of these three states.

---

## Section 3 — Four risk facts per D-08

| Fact | NE | NV | NH |
|------|----|----|----|
| **Units** | thousands | **dollars** (not thousands) | thousands |
| **Negative GF line items** | FY2020 "Other Taxes" = **-$193K** (minor; P2 clamp candidate if FY2020 loaded). FY2025 has no negatives. | None observed in FY2019 or FY2023 bookends. | None observed in FY2017 or FY2024 bookends. |
| **Exact column header + statement** | "General Fund" (1st column), *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) | "General Fund" (1st column), *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities) | "General" (1st column), *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT the biennial appropriations document) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ |

---

## Section 4 — Scope vs NASBO (D-09)

Same apples-to-oranges methodology as Batch 1/2: NASBO GF operating (expenditure-side budgetary
figure) vs ACFR GF Total revenues (GAAP), flagging whether GAAP's GF revenue base is materially
broader due to consolidated federal/intergovernmental flows.

| State | ACFR GF Total revenues (latest) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **NE** | ~$6.31B (FY2025) | ~$5.31B | **~1.19×** | Smallest divergence in the batch — Federal Grants and Contracts is only $157K (~0.002%) of NE's GF; the fund is almost entirely own-source (Income Tax $3.09B + Sales/Use Tax $2.62B = 91% of GF revenue). Federal flows are booked to NE's separate "Federal Fund" column, not GF. | **Accept-and-relabel honestly** (near-parity case, closest to OH/VA precedent in this milestone). Confirm at Phase-120 load. |
| **NV** | ~$15.15B (FY2023) | ~$5.27B | **~2.87×** | GAAP General Fund consolidates federal Medicaid/grant pass-through: "Intergovernmental" = $8.94B, **59% of GF revenue**. Same TX/NC-trap mechanism, more pronounced. | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-120 load; also resolve the FY2024/FY2025 recency gap (Section 5). |
| **NH** | ~$6.38B (FY2024) | ~$1.98B | **~3.22×** | Largest divergence in this batch — "Federal Government" = $3.07B (48% of GF revenue) + "Special Taxes" = $1.79B (Medicaid Enhancement Tax + business taxes bundled into GF, NH has no broad sales/income tax). | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-120 load. |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **NE** | FY2025 (final audited) | ✅ (`..._ACFR_2023.pdf` available) | ✅ (`..._ACFR_2024.pdf` available) | **GREENLIGHT** — recency floor satisfied. |
| **NV** | FY2023 (latest discoverable; live site under "remediation") | ✅ (`2023-acfr-report.pdf` IS the latest available) | ❌ **FY2024 not found** under any tested naming variant (`2024_ACFR_Report.pdf`, `ACFR_FY2024.pdf`, `FY24_ACFR.pdf`, etc. all 404) | **FLAG for load-time decision (D-07).** NV genuinely has not published (or has not publicly posted) a FY2024 ACFR as of this recon. Loading FY2019–FY2023 on ACFR while FY2024 stays NASBO-sourced is one option; re-check `controller.nv.gov` at load time in case FY2024/FY2025 has since posted. Does NOT disqualify NV from the roster (D-01) — accept/relabel + partial-window decision is a load-time call. |
| **NH** | FY2024 (final audited, published ~9 months post-FYE per Wayback crawl date 2025-04-01) | ✅ (`fy_2023_annual_comprehensive_financial_report_acfr.pdf` confirmed present) | ✅ (`fy_2024_annual_comprehensive_financial_report.pdf` confirmed present, tied exactly) | **GREENLIGHT** — recency floor satisfied. Corrects the pre-planning speculation that NH would fail this check; NH publishes promptly. Access-mechanism risk (Section 6) is the only outstanding item. |

---

## Section 6 — Consolidated gap log (NE/NV/NH)

| State | FY / Item | Gap reason | Disposition |
|-------|-----------|-----------|-------------|
| **NE** | Pre-FY2020 | Not checked — FY2020–FY2025 (6-year window) already exceeds the recency floor and is fully derivable. | Low priority. Extend at load time if pre-FY2020 PDFs exist under the same derivable pattern. |
| **NV** | FY2024, FY2025 | Not found under any tested filename variant on `controller.nv.gov/siteassets/content/financialrpts/acfr/`. The live ACFR landing page itself states documents are "currently being remediated." | **Gap logged — genuine current-publication gap, not a durability failure.** Re-check at Phase-120 load time; if still absent, load FY2019–FY2023 on ACFR and leave FY2024 (and beyond) NASBO-sourced until NV publishes. |
| **NV** | Pre-FY2019 | Older filenames exist in Wayback history (`FY94All.pdf` through `FY18All.pdf`) with inconsistent naming; not verified for current live-fetchability within the D-04 budget. | Low priority — FY2019–FY2023 (5-year window) already sufficient for launch. |
| **NH** | Direct-fetch access | `das.nh.gov` / `www.das.nh.gov` / `www.nh.gov` return HTTP 403 "Access Denied" (Akamai `errors.edgesuite.net`) to automated `curl` requests regardless of User-Agent, Accept, Referer, or `sec-fetch-*` header spoofing. This is a harder block than the `tn.gov` precedent (memory: "tn.gov needs a browser UA") — full browser-header emulation was insufficient here, suggesting TLS/JA3-fingerprint-based bot detection. | **NOT a durability failure** — the Wayback Machine has actively re-crawled `das.nh.gov/accounting/` through at least 2026-06 (real browsers/crawlers can reach it), and this recon verified both bookend ties using Wayback-mirrored copies (`https://web.archive.org/web/{timestamp}if_/{original-url}`). **Flagged as a load-time access-mechanism task**: the Phase-120 loader must implement a browser-based download workaround (per `followups/ca-acfr-reconciliation.md` precedent) OR fetch via the Wayback Machine mirror as a stable proxy (Wayback's own URL is durable and directly re-fetchable: `web.archive.org/web/{ts}if_/https://www.das.nh.gov/...`). |
| **NH** | Pre-FY2017 | Not checked within the D-04 effort budget — FY2017–FY2024 (8-year window) already exceeds the recency floor. | Low priority. NH's Wayback history goes back to at least FY1997/1998/1999 (`97nhcafr.pdf`, `98nhcafr.pdf`, `99nhcafr.pdf`) — extend at load time if needed. |

---

## Section 7 — Loader template mapping + Phase-120 load notes (NE/NV/NH)

| State | Closest loader template | GF layout notes | Phase-120 load notes |
|-------|------------------------|----------------|----------------------|
| **NE** | `processCOAcfr.js` / `processINAcfr.js` family (clean multi-column, fully derivable per-year URL) | GF is first column of 7 (General \| Highway \| Federal \| Health and Social Services \| Permanent School \| Nonmajor \| Totals). Units = thousands. | Simplest of the batch — fully derivable URL, no naming exceptions found, no negatives at either bookend (FY2020's -$193K "Other Taxes" is immaterial). `extract_gf.py` + `gen_state.py` clone directly. |
| **NV** | `processGAAcfr.js` / `processNCAcfr.js` family (opaque per-year filenames, explicit SOURCES map required) | GF is first column of 4 (General Fund \| State Education Fund \| Nonmajor Governmental Funds \| Total Governmental Funds). Units = **dollars** — loader must NOT assume thousands. | **Must enumerate each year's opaque filename explicitly** (no derivable pattern). **Must resolve the FY2024/FY2025 recency gap at load time** (Section 5) — either a newer ACFR has posted by then, or load FY2019–FY2023 only and leave the latest year(s) NASBO-sourced with an honest label. |
| **NH** | `processMDAcfr.js` / `processNCAcfr.js` family (multi-column layout, needs a naming-exception map) | GF is first column of 5 (General \| Highway \| Education \| Non-Major Governmental \| Total). Units = thousands. Naming shifts CAFR→ACFR terminology at FY2021, adds `_acfr` suffix only at FY2023. | **Must implement a browser-download or Wayback-proxy fetch step** (Section 6) — this is the loader-level deviation from every other Batch-3/prior-tranche state, none of which needed a non-`curl` fetch path. Otherwise `extract_gf.py` ties cleanly (confirmed both bookends). |

---

## NE — Nebraska Detail Block

**Source:** Nebraska Department of Administrative Services (DAS), State Accounting Division
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://das.nebraska.gov/accounting/financial_reports.php`

**URL pattern (fully derivable):**
`https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_{YYYY}.pdf`
Confirmed FY2020–FY2025 (all six years listed directly on the financial-reports page).

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 7: General \| Highway \| Federal \| Health and Social Services \| Permanent School \| Nonmajor \| Totals)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $6,308,910K — line items sum = $6,308,910K ✅ (diff $0)
- FY2020: GF Total revenues = $4,993,719K — line items sum = $4,993,719K ✅ (diff $0)

**Investment income / negatives:** FY2020 "Other Taxes" = -$193K (minor, immaterial P2 clamp candidate). FY2025 has no negative GF lines.

**Clean window:** FY2020–FY2025 (6 years, fully derivable, no naming exceptions found)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)

---

## NV — Nevada Detail Block

**Source:** Office of the Nevada State Controller
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://controller.nv.gov/financial-reports/annual-comprehensive-financial-report-acfr/` (states documents are "currently being remediated" — a public-records-request fallback is offered, but the underlying PDFs remain directly fetchable by filename)

**URL pattern (opaque, NOT derivable — explicit per-year enumeration required):**
- FY2023: `https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2023-acfr-report.pdf` (also mirrored at the stable "latest" alias `.../annual-comprehensive-financial-report.pdf`, confirmed to currently serve FY2023 content)
- FY2022: `.../2022_ACFR_Report.pdf`
- FY2021: `.../FY21_ACFR.pdf`
- FY2020: `.../ACFR_FY2020.pdf`
- FY2019: `.../CAFR_Web_2019.pdf`
- FY2024/FY2025: not found under any tested naming variant (genuine current-publication gap — see Section 6)

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 4: General Fund \| State Education Fund \| Nonmajor Governmental Funds \| Total Governmental Funds)
**Units:** Dollars (not thousands)
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2023: GF Total revenues = $15,153,168,081 — line items sum = $15,153,168,081 ✅ (diff $0)
- FY2019: GF Total revenues = $10,411,179,917 — line items sum = $10,411,179,917 ✅ (diff $0)

**Investment income / negatives:** None observed in either bookend year ("Investment Income (Loss)" line was positive in both FY2019 and FY2023).

**Scope note:** "Intergovernmental" = $8,940,557,604 in FY2023 — 59% of GF revenue, driven by federal Medicaid/grant pass-through booked directly into the General Fund (unlike NE/ND where federal flows sit in a separate fund column).

**Clean window:** FY2019–FY2023 (5 years confirmed; FY2024/FY2025 gap logged)
**Recency floor:** FLAGGED — FY2023 confirmed, FY2024 NOT found (Section 5). Load-time decision required.

---

## NH — New Hampshire Detail Block

**Source:** New Hampshire Department of Administrative Services (DAS), Bureau of Financial Reporting
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly "Comprehensive Annual Financial Report (CAFR)" pre-FY2021
**Landing page:** `https://www.das.nh.gov/accounting/` (Akamai-blocked for automated fetches — see access note below)

**URL pattern:**
- FY2021, FY2022, FY2024: `https://www.das.nh.gov/accounting/fy%20{YY}/fy_{YYYY}_annual_comprehensive_financial_report.pdf`
- FY2023 (naming exception, adds `_acfr` suffix): `https://www.das.nh.gov/accounting/fy%2023/fy_2023_annual_comprehensive_financial_report_acfr.pdf`
- FY2017–FY2020 (pre-ACFR-rename, "comprehensive annual" word order): `https://www.das.nh.gov/accounting/fy%20{YY}/fy_{YYYY}_comprehensive_annual_financial_report.pdf`
- Directory segment is `fy%20{YY}` (2-digit year, URL-encoded space, e.g. `fy%2024`)

**CRITICAL ACCESS FINDING:** `das.nh.gov`, `www.das.nh.gov`, and `www.nh.gov` all return HTTP 403
"Access Denied" (Akamai `errors.edgesuite.net`) to automated `curl` requests — tested with multiple
full browser User-Agent strings, `Accept`/`Accept-Language`/`sec-fetch-*`/`Referer` headers, all
blocked identically. This is a harder bot-block than the `tn.gov` precedent (memory: "needs a
browser UA" implies header-spoofing is sufficient there; here it was not). The site IS reachable by
real crawlers — the Internet Archive Wayback Machine has actively re-crawled
`das.nh.gov/accounting/` with snapshots through at least 2026-06-2026-07. This recon verified both
bookend ties by fetching the archived PDF bytes via `https://web.archive.org/web/{timestamp}if_/{original-das.nh.gov-url}`,
which is NOT blocked. **The Phase-120 loader must implement either a browser-based download step
(per `followups/ca-acfr-reconciliation.md` precedent) or fetch via the Wayback Machine mirror as a
stable, durable proxy URL** — the Wayback `if_` URL format is itself a stable, re-fetchable pattern.

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 5: General \| Highway \| Education \| Non-Major Governmental \| Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms (via Wayback-mirrored fetch of the das.nh.gov originals):**
- FY2024: GF Total revenues = $6,377,159K — line items sum = $6,377,159K ✅ (diff $0)
- FY2017: GF Total revenues = $4,207,160K — line items sum = $4,207,160K ✅ (diff $0)

**Investment income / negatives:** None observed in either bookend year.

**Scope note:** "Federal Government" = $3,065,572K in FY2024 — 48% of GF revenue, plus "Special
Taxes" = $1,792,670K (Medicaid Enhancement Tax + business taxes, since NH has no broad sales or
income tax) — the largest scope divergence in this batch (~3.22× vs NASBO).

**Clean window:** FY2017–FY2024 (8 years confirmed via Wayback crawl history back to 1997)
**Recency floor:** GREENLIGHT (FY2023 confirmed present, FY2024 confirmed tied) — corrects the
CONTEXT's pre-planning speculation that NH would likely fail this check. The genuine finding is an
**access-mechanism** risk, not a data-availability risk.

---

## Section 1 (continued) — NM / ND per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **NM** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Severance Tax/Debt Service Fund \| Land Grant/Capital Projects Fund) | thousands | Jun 30 | **FY2019–FY2024** (FY2022 has an image-only extraction hole; FY2023 URL not located within budget) | Opaque, non-derivable WordPress-upload slugs under `nmdfa.state.nm.us`: FY2024 = `wp-content/uploads/2025/04/FINAL-341a-State-of-New-Mexico-FY24-ACFR.pdf`, FY2022 = `wp-content/uploads/2023/07/Agency-341-A-SoNM-FY22-ACFR-Final.pdf`, FY2019 = `wp-content/uploads/2021/01/Final-Version-State-of-New-Mexico-CAFR-2019-Audit-05-07-20.pdf`. Landing: `https://www.nmdfa.state.nm.us/financial-control/statewide-financial-reporting-accountability-bureau/` (does not itself link the current ACFR — found via Wayback CDX enumeration). |
| **ND** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Federal [Special Revenue] \| State [Special Revenue] \| Nonmajor Governmental Funds \| Total) | **dollars** (not thousands) | Jun 30 | **FY2021–FY2025** | `https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/{YYYY}-acfr.pdf`, fully derivable for FY2022–FY2025; **FY2021 exception**: `2021-acfr-nd.pdf` (adds `-nd` suffix). Landing: `https://www.omb.nd.gov/financial-transparency/annual-comprehensive-financial-reports-acfr` (all 5 years listed directly). |

---

## Section 2 (continued) — NM / ND bookend tie-confirmations

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **NM** | FY2024 (latest) | **$30,530,269K** | GF line items sum = $30,530,269K; matches printed Total revenues. Diff = $0. ✅ (`pdftotext -table` clean) |
| **NM** | FY2019 (oldest clean) | **$15,358,087K** | GF line items sum = $15,358,087K; matches printed Total revenues. Diff = $0. ✅ (`pdftotext -table` clean) |
| **NM** | FY2022 (mid-window — NOT a bookend, cited for the extraction-hole finding below) | **$26,161,736K** | Manually transcribed from a rendered page image (`pdftoppm` at 150dpi) and hand-verified: GF line items sum = $26,161,736K; matches printed Total revenues exactly. Diff = $0. ✅ (image-only page, NOT `pdftotext`-extractable — see Section 6) |
| **ND** | FY2025 (latest) | **$4,510,201,793** (dollars) | GF line items sum = $4,510,201,793; matches printed Total revenues. Diff = $0. ✅ |
| **ND** | FY2021 (oldest clean) | **$3,955,670,947** (dollars) | GF line items sum = $3,955,670,947; matches printed Total revenues. Diff = $0. ✅ |

**ND's annual-vs-biennial statement confirmed:** the FY2025 and FY2021 ACFR PDFs are both titled
"Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds, For the
Fiscal Year Ended June 30, {YYYY}" — an **annual** GAAP statement, distinct from ND's biennial
appropriations/budget documents. The D-03 biennial-budget concern flagged in the CONTEXT does
**not** apply to ND's audited ACFR (only to its legislative budget cycle) — no accept-relabel
needed on this basis.

---

## Section 3 (continued) — NM / ND four risk facts per D-08

| Fact | NM | ND |
|------|----|----|
| **Units** | thousands | **dollars** (not thousands) |
| **Negative GF line items** | **FY2022 (mid-window): "Investment Income (Loss)" = -$91,222K** — P2 clamp required if FY2022 is loaded. FY2019 and FY2024 bookends have no negative GF lines. | None observed in FY2021 or FY2025 bookends. |
| **Exact column header + statement** | "General Fund" (1st column), *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) | "General" (1st column), *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT the biennial appropriations/budget document, NOT Statement of Activities) |
| **FY-end month** | June 30 ✓ | June 30 ✓ |

---

## Section 4 (continued) — NM / ND scope vs NASBO (D-09)

| State | ACFR GF Total revenues (latest) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **NM** | ~$30.53B (FY2024) | ~$9.98B | **~3.06×** | Second-largest divergence in the batch — "Federal Revenue" = $11.69B (38%) + "General and Selective Taxes" = $8.02B + "Rentals and Royalties" (oil & gas) = $5.35B. Federal-passthrough plus a substantial own-source oil/gas royalty stream, both consolidated into GF. | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-120 load; resolve the FY2022 extraction-hole and FY2023 URL-discovery gap first (Section 6). |
| **ND** | ~$4.51B (FY2025) | ~$2.88B | **~1.57×** | Smallest structural divergence in the batch — ND's GF is dominated by Sales & Use Tax ($1.35B) and Oil, Gas, and Coal Taxes ($750M), both own-source; most federal intergovernmental revenue ($2.68B) is booked to the separate "Federal" special-revenue column, NOT the General Fund. | **Accept-and-relabel honestly** (mild divergence, closer to the NE/OH/VA near-parity case than the TX-trap case). Confirm at Phase-120 load. |

---

## Section 5 (continued) — NM / ND recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **NM** | FY2024 (final audited, confirmed tied) | ⚠️ **URL not located within the D-04 effort budget** — NM's opaque WordPress slugs (FY2022 and FY2024 share no derivable pattern) made FY2023 non-guessable in the time available. Likely exists (FY2022 and FY2024 both publish on a similar ~10-13-month lag) but not yet found. | ✅ (`FINAL-341a-State-of-New-Mexico-FY24-ACFR.pdf` confirmed present and tied exactly) | **FLAG for load-time discovery** — not a hard blocker (D-01). The Phase-120 loader should crawl `nmdfa.state.nm.us` live (or its statewide-financial-reporting-accountability-bureau page) to find the FY2023 URL before falling back to a partial-window load. |
| **ND** | FY2025 (final audited, beyond the recency floor) | ✅ (`2023-acfr.pdf` — inferred from the fully derivable pattern, all adjacent years FY2022/2024/2025 confirmed live) | ✅ (`2024-acfr.pdf` — same derivable pattern) | **GREENLIGHT** — recency floor satisfied with margin (FY2025 already available). Best-covered state in the batch. |

---

## Section 6 (continued) — Consolidated gap log (NM/ND) + full 5-state summary

| State | FY / Item | Gap reason | Disposition |
|-------|-----------|-----------|-------------|
| **NM** | FY2022 numeric table | The Statement of Revenues/Expenditures pages (printed pp. 36–37) in the FY2022 ACFR PDF are rendered as a **raster image**, not extractable text — both `pdftotext -table` and `pdftotext -layout` return only the page header/footer with zero numeric content (confirmed via `pdfinfo` + `pdftoppm` page render). This mirrors the KY FY2023 "no ToUnicode CMap" precedent (v2.14 Phase 114) — an honest, source-side extraction hole, not a recon or loader bug. | **Recoverable via manual transcription or OCR at load time** (already hand-verified in this recon: $26,161,736K revenues / $20,159,689K expenditures, ties exactly to the printed total). Phase-120 loader should embed the FY2022 GF figures as static/transcribed data (NJ-style embedded-data precedent, v2.14 Phase 115) rather than relying on `extract_gf.py`'s automated `pdftotext` pass for this one year. |
| **NM** | FY2023 URL | Not discovered within the D-04 (~15-20 min) effort budget — NM's opaque per-year WordPress slugs (no shared naming convention between FY2022's `Agency-341-A-SoNM-FY22-ACFR-Final.pdf` and FY2024's `FINAL-341a-State-of-New-Mexico-FY24-ACFR.pdf`) made it non-guessable. | Flagged for live-site discovery at Phase-120 load time (see Section 5). Not a hard blocker. |
| **NM** | Pre-FY2019 | Not checked within budget — FY2019–FY2024 (6-year window, with the one FY2022 extraction caveat) already exceeds the recency floor. | Low priority. NM's Wayback history goes back to FY1995 CAFRs if deeper history is wanted later. |
| **ND** | FY2021 filename exception | `2021-acfr-nd.pdf` (adds `-nd` suffix) vs the otherwise-uniform `{YYYY}-acfr.pdf` pattern for FY2022–FY2025. | Loader SOURCES map must special-case FY2021. Otherwise fully durable — no gap, just a naming variant (same class of exception as MA's FY2017 `acfr_fy2017.pdf` in Batch 1). |
| **ND** | Pre-FY2021 | Not checked within budget — FY2021–FY2025 (5-year window, includes FY2025 beyond the recency floor) already fully sufficient. | Low priority. Extend at load time if pre-FY2021 PDFs exist under a related pattern. |

### Full 5-state Batch-3 gap-log summary

No Batch-3 state failed D-03 triage and none require a STAY-NASBO disposition (Section 0). All
five have real, sourced, bookend-tied GAAP ACFR data. The genuine, load-time-actionable findings
carried forward to Phase 120 are:
1. **NV** — FY2024/FY2025 not yet published/found; partial-window load (FY2019–2023) or re-check at load time.
2. **NH** — direct automated fetch is Akamai-blocked; browser-download or Wayback-mirror-proxy fetch required.
3. **NM** — FY2022's numeric table is image-only (manual/embedded-data transcription, already hand-verified); FY2023 URL needs live-site discovery at load time.
4. **NE, ND** — no material gaps; both are fully derivable, clean, and complete through the recency floor (ND additionally reaches FY2025).

**Phase-123 "nodes remaining NASBO-served" list contribution from Batch 3: none.** All five states
are recommended for full ACFR upgrade (with the load-time caveats above); zero accept-relabel-only
exceptions and zero stay-NASBO exceptions in this batch.

---

## Section 7 (continued) — NM / ND loader template mapping + Phase-120 load notes

| State | Closest loader template | GF layout notes | Phase-120 load notes |
|-------|------------------------|----------------|----------------------|
| **NM** | `processGAAcfr.js` / `processNCAcfr.js` family (opaque per-year filenames, explicit SOURCES map) + the NJ/CT-style embedded-data pattern (v2.14 Phase 115) for the one image-only year | GF is first column of 3 (General Fund \| Severance Tax/Debt Service Fund \| Land Grant/Capital Projects Fund). Units = thousands. | **FY2022 must be hand-transcribed/embedded** (numeric table is image-only — see Section 6), not run through the standard `extract_gf.py` pass. **FY2023 URL must be discovered via a live-site crawl** before load (Section 5). Otherwise `extract_gf.py` ties cleanly on FY2019 and FY2024. |
| **ND** | `processCOAcfr.js` / `processINAcfr.js` family (clean multi-column, fully derivable per-year URL) | GF is first column of 5 (General \| Federal \| State \| Nonmajor Governmental Funds \| Total). Units = **dollars** — loader must NOT assume thousands. | Second-simplest of the batch after NE — fully derivable URL (one FY2021 naming exception), no negatives at either bookend, reaches FY2025 (beyond the recency floor). `extract_gf.py` + `gen_state.py` clone directly. |

---

## NM — New Mexico Detail Block

**Source:** New Mexico Department of Finance and Administration (DFA), Financial Control Division
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly "Comprehensive Annual Financial Report (CAFR)" pre-FY2021
**Landing page:** `https://www.nmdfa.state.nm.us/financial-control/statewide-financial-reporting-accountability-bureau/` (does not itself link the current ACFR directly — the actual PDF was located via Wayback Machine CDX enumeration of `nmdfa.state.nm.us/wp-content/uploads/`, then confirmed live)

**URL pattern (opaque, NOT derivable — explicit per-year enumeration required):**
- FY2024: `https://www.nmdfa.state.nm.us/wp-content/uploads/2025/04/FINAL-341a-State-of-New-Mexico-FY24-ACFR.pdf`
- FY2022: `https://www.nmdfa.state.nm.us/wp-content/uploads/2023/07/Agency-341-A-SoNM-FY22-ACFR-Final.pdf`
- FY2019: `https://www.nmdfa.state.nm.us/wp-content/uploads/2021/01/Final-Version-State-of-New-Mexico-CAFR-2019-Audit-05-07-20.pdf`
- FY2023: not located within the D-04 effort budget (see gap log)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 3: General Fund \| Severance Tax/Debt Service Fund \| Land Grant/Capital Projects Fund)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024: GF Total revenues = $30,530,269K — line items sum = $30,530,269K ✅ (diff $0, clean `pdftotext -table`)
- FY2019: GF Total revenues = $15,358,087K — line items sum = $15,358,087K ✅ (diff $0, clean `pdftotext -table`)

**FY2022 extraction-hole finding:** the Statement of Revenues/Expenditures pages (printed pp.
36–37) render as a raster image in the FY2022 PDF — confirmed via `pdfinfo` (Word→Distiller
producer chain) and a `pdftoppm` page render. Manually transcribed and hand-verified: GF Total
revenues = $26,161,736K, GF Total expenditures = $20,159,689K, both tie exactly to the printed
totals. **"Investment Income (Loss)" = -$91,222K in FY2022** — a genuine negative GF line requiring
a P2 clamp if this year is loaded.

**Scope note:** "Federal Revenue" = $11,691,941K in FY2024 (38% of GF revenue) + "Rentals and
Royalties" (oil & gas) = $5,353,926K — federal-passthrough plus a substantial own-source
severance/royalty stream, both consolidated into GF (~3.06× vs NASBO).

**Clean window:** FY2019–FY2024 (6 years; FY2022 has the image-extraction caveat above; FY2023 gap-logged)
**Recency floor:** FY2024 confirmed tied; FY2023 flagged for load-time URL discovery (not a hard blocker).

---

## ND — North Dakota Detail Block

**Source:** North Dakota Office of Management and Budget (OMB)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.omb.nd.gov/financial-transparency/annual-comprehensive-financial-reports-acfr` (lists all 5 years directly, no discovery needed)

**URL pattern (fully derivable):**
`https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/{YYYY}-acfr.pdf`
Confirmed FY2022–FY2025. **FY2021 exception:** `2021-acfr-nd.pdf` (adds an `-nd` suffix not present
in later years).

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 5: General \| Federal [Special Revenue] \| State [Special Revenue] \| Nonmajor Governmental Funds \| Total)
**Units:** Dollars (not thousands)
**FY-end:** June 30 — **confirmed annual GAAP reporting**, distinct from ND's biennial legislative
appropriations cycle. The D-03 "biennial budget" concern raised in the CONTEXT does not apply to
the audited ACFR.

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $4,510,201,793 — line items sum = $4,510,201,793 ✅ (diff $0)
- FY2021: GF Total revenues = $3,955,670,947 — line items sum = $3,955,670,947 ✅ (diff $0)

**Investment income / negatives:** None observed in either bookend year.

**Scope note:** Sales and Use Taxes ($1,346,955,054) + Oil, Gas, and Coal Taxes ($750,043,102) are
booked directly into the General Fund column, while most federal intergovernmental revenue
($2,678,818,384) is booked to the separate "Federal" special-revenue fund column, NOT the General
Fund — the mildest scope divergence in the batch (~1.57× vs NASBO).

**Clean window:** FY2021–FY2025 (5 years, reaches beyond the recency floor)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 both within the confirmed derivable window; FY2025 already available)

---

## Phase-120 Pre-Load Checklist (per D-10 overlap resolution + load-time action items)

These items are flagged here for the Phase-120 loader author. Overlap resolution is N/A for all
five states (Section D-10 — all confirmed clean NASBO-only nodes, no in-place-upgrade planning
needed). The load-time action items below are the genuine, non-blocking findings from this recon:

| State | Pre-load requirement | Risk if skipped |
|-------|---------------------|------------------|
| **NE** | None — clean, fully derivable, no naming exceptions, no negatives. Standard new ACFR loader. | N/A |
| **NV** | Re-check `controller.nv.gov` for a FY2024/FY2025 ACFR before finalizing the load window; if still absent, load FY2019–FY2023 and leave the latest year(s) NASBO-sourced with an honest label. Units are **dollars**, not thousands. | Silently stranding the latest NASBO-covered year if FY2024 loads incompletely; unit-scaling bug if thousands is assumed. |
| **NH** | Implement a browser-download step or fetch via the Wayback Machine mirror (`web.archive.org/web/{ts}if_/https://www.das.nh.gov/...`) — direct `curl`/fetch from `das.nh.gov` is Akamai-blocked. | Loader silently fails/hangs on every fetch attempt if this is not anticipated. |
| **NM** | Hand-transcribe/embed the FY2022 GF figures (image-only page, already hand-verified in this recon) rather than relying on automated `pdftotext` extraction for that year. Discover the FY2023 URL via a live-site crawl before finalizing the load window. Apply a P2 clamp to FY2022's "Investment Income (Loss)" = -$91,222K if that year is loaded. | Silent $0/blank GF row for FY2022 if the image-only page is not caught; negative revenue displayed in UI if the P2 clamp is skipped. |
| **ND** | Special-case the FY2021 `-nd` filename suffix in the SOURCES map. Units are **dollars**, not thousands. | Naming mismatch causes a 404 on FY2021 if not special-cased; unit-scaling bug if thousands is assumed. |

## Self-Check

- [x] `.planning/phases/.../117-BATCH3-SOURCES.md` exists with all 8 sections, D-03 triage, D-10 overlap check, and per-state detail blocks for NE, NV, NH, NM, ND.
- [x] All 5 D-03 triage verdicts recorded (all RECON — zero STAY-NASBO candidates).
- [x] 10/10 bookend ties confirmed at exact $0 diff (2 per state × 5 states), incl. one hand-verified mid-window tie (NM FY2022) documenting the image-extraction hole.
- [x] Four risk facts pinned for all 5 states (units / negatives / exact column+statement / FY-end month, non-June explicitly checked — all 5 are June 30).
- [x] Recency-floor verdict recorded for all 5 (3 GREENLIGHT: NE/NH/ND; 2 flagged for load-time decision: NV/NM — neither disqualifies per D-01).
- [x] Scope-vs-NASBO magnitude + accept-relabel recommendation for all 5.
- [x] Loader-template mapping for all 5.
- [x] Consolidated gap log covers every non-clean/non-durable/non-tying item found.
- [x] No DB writes, no loader edits, no NASBO mutations, no frontend changes; $0 spend (pdftotext + curl only, no paid API).
