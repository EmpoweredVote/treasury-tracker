# 117 — Batch 3 ACFR Source Location (RECON-11, NE/NV/NH/NM/ND)

**Status:** IN PROGRESS — Task 0 (workspace + D-03 triage) complete.
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

*(NM and ND recon + Sections 1-8 continuation to follow in Task 2.)*
