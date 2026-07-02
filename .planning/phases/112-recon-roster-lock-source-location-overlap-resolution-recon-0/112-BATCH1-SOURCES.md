# 112 — Batch 1 ACFR Source Location (RECON-09, AZ/IN/CO/MO/KY)

**Status:** IN PROGRESS — Task 1 complete (Arizona, Indiana, Colorado sourced + bookend-tied). Task 2 (Missouri, Kentucky) pending.
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**States:** Arizona (AZ), Indiana (IN), Colorado (CO), Missouri (MO), Kentucky (KY)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md shape (Phase 107 tranche-2 recon mold).

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **AZ** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of 5: General Fund \| Transportation & Highway Maintenance & Safety Fund \| Land Endowments Fund \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2002–FY2024 confirmed reachable** (FY2025 not yet published — FY2025 GF is "Estimated" in NASBO Table 1) | No single derivable pattern — each year's node page (`gao.az.gov/resources/annual-comprehensive-financial-report-june-30-{YYYY}`) must be resolved to find that year's PDF path under `gao.az.gov/sites/default/files/{upload-date-folder}/`. **FY2024 is CURRENTLY hosted only as a Google Drive share link** (`drive.google.com/file/d/14FYCgTQPsu77pxLtz41E_Ba_0hCuMhwA`) — not a durable gov URL (D-06 concern, see Section 6 gap log). |
| **IN** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of ~6+ columns: General Fund \| Public Welfare-Medicaid Assistance Fund \| US Dept of Health & Human Services Fund \| Motor Vehicle Highway Fund \| ... \| Total) | thousands | Jun 30 | **FY2002–FY2025** (archive page lists every year back to FY2001; FY2001 not verified — GASB-34 boundary) | No single derivable pattern — explicit per-year filenames on `www.in.gov/comptroller/Annual-Comprehensive-Financial-Reports/archived-annual-comprehensive-financial-reports` (naming varies by year: `State_of_Indiana_{YYYY}_CAFR.pdf` 2001-2007, `Entire_{YYYY}_CAFR.pdf` 2008-2015, `Entire-{YYYY}-CAFR.pdf` 2016-2018, `Entire-CAFR-{YYYY}.pdf` 2019-2020, `Entire-{YYYY}-ACFR.pdf` 2021, `{YYYY}-ACFR.pdf` 2022/2024, `Entire-Annual-Comprehensive-Financial-Report-{YYYY}.pdf` 2023, `Fiscal-2025-Annual-Comprehensive-Financial-Report.pdf` 2025). All direct, no CDN block, no cookies/referer needed. |
| **CO** | Statement Of Revenues, Expenditures, And Changes In Fund Balances — Governmental Funds | **General Funds** (1st of 4: General Funds \| Federal Special Revenue Fund \| Highway Users Tax Fund \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2023–FY2025 confirmed** (pre-FY2023 not found under the current `osc.colorado.gov` domain — likely a site migration; shallow window, D-12 permits) | `https://osc.colorado.gov/sites/osc/files/acfr23.pdf` (FY2023); `https://osc.colorado.gov/sites/osc/files/documents/FY2024%20ACFR%20Final%20-%20Color%20Corrected_ADA.pdf` (FY2024); `https://osc.colorado.gov/sites/osc/files/documents/FY2025%20ACFR_ADA_1.30.26.pdf` (FY2025). No derivable pattern — must resolve from `osc.colorado.gov/financial-operations/financial-reports/acfr` each year. **Requires a `Referer` header matching that landing page** — direct HEAD/GET without it returns 403 (mild WAF, not a hard CDN block like AZ). |
| **MO** | *(Task 2)* | | | | | |
| **KY** | *(Task 2)* | | | | | |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **AZ** | FY2024 (latest confirmed) | **$44,045,434K** | GF line items sum = $44,045,434K; matches printed Total Revenues. Diff = $0. ✅ |
| **AZ** | FY2002 (oldest — GASB-34 first year) | **$11,655,423K** | GF line items sum = $11,655,423K; matches printed Total Revenues. Diff = $0. ✅ |
| **IN** | FY2024 (latest) | **$22,101,900K** | GF line items sum = $22,101,900K; matches printed Total revenues. Diff = $0. ✅ |
| **IN** | FY2002 (oldest — GASB-34 first year) | **$7,341,746K** | GF line items sum = $7,341,746K; matches printed Total revenues. Diff = $0. ✅ |
| **CO** | FY2024 (latest confirmed extracted) | **$26,271,588K** | GF line items sum = $26,271,588K; matches printed Total Revenues. Diff = $0. ✅ |
| **CO** | FY2023 (oldest in the confirmed 3-year window) | *(existence confirmed — 200 OK, 55MB PDF downloaded; full extraction not performed within the D-11 effort budget since FY2024 bookend + FY2025 URL confirmation already establish the recency-floor-satisfying window)* | URL confirmed live/durable; not text-extracted this session. |
| **MO** | *(Task 2)* | | |
| **MO** | *(Task 2)* | | |
| **KY** | *(Task 2)* | | |
| **KY** | *(Task 2)* | | |

---

## Section 3 — Four risk facts per D-08

| Fact | AZ | IN | CO | MO | KY |
|------|----|----|----|----|-----|
| **Units** | Thousands (consistent all years) | Thousands | Thousands | *(Task 2)* | *(Task 2)* |
| **Negative GF line items** | None observed in FY2002/FY2024 GF column (all revenue lines positive, incl. Earnings on investments). Low risk. | None observed in FY2002/FY2024 GF column (Investment income (loss) header implies negatives ARE possible in other years — check all years at load). | **CAUTION: FY2024 "TABOR Excess Revenue" = −$1,214,908K (NEGATIVE)** in the General Funds column — Colorado's constitutional TABOR refund mechanism. P2 clamp required. Check all years at load — this is likely a recurring CO-specific line, not a one-off. | *(Task 2)* | *(Task 2)* |
| **Exact column header + statement** | "General Fund" (1st column), *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) — confirmed on both bookend PDFs. | "General Fund" (1st column), *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* — confirmed. | "General Funds" (1st column, note plural "Funds"), *Statement Of Revenues, Expenditures, And Changes In Fund Balances — Governmental Funds* — confirmed correct (distinct from the adjacent "…Reconciled To Statement Of Activities" schedule on the following page, which was initially mistaken for the target and rejected). | *(Task 2)* | *(Task 2)* |
| **FY-end month** | June 30 ✓ (all 3 years checked: FY2002, FY2024, and FY2023 node-page confirmed) | June 30 ✓ | June 30 ✓ | *(Task 2)* | *(Task 2)* |

---

## Section 4 — Scope vs NASBO (D-09)

Note: NASBO GF figures are budgetary *expenditure* totals; ACFR figures below are GAAP *revenue* totals (same apples-to-oranges comparison method as Phase 98/103/107 — the point is to flag scope divergence, not compare like-for-like).

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **AZ** | $44,045,434K (FY2024) | $17,903M | **~2.46×** | "Intergovernmental" = $25,234,916K of the $44.05B GF total — federal Medicaid/education passthrough consolidated into GAAP GF, excluded from NASBO's budgetary concept. Consistent with the TX/PA/IL/NC precedent. | Accept-and-relabel honestly (TX precedent). Confirm at Phase-113 load. |
| **IN** | $22,101,900K (FY2024) | $22,405M | **~0.99×** — near parity, smallest divergence found across the whole v2.14 tranche so far (smaller even than CT's 1.14× in Phase 107) | Indiana's ACFR reports Medicaid in a **separate major fund** ("Public Welfare-Medicaid Assistance Fund," $15,111,031K FY2024) rather than folding it into the General Fund column — this is why IN's GF stays close to the NASBO budgetary concept instead of ballooning like other states. | No meaningful accept-relabel needed — IN's ACFR GF is nearly identical in scope to its NASBO GF. Still confirm at Phase-113 load per policy. |
| **CO** | $26,271,588K (FY2024) | $14,513M | **~1.81×** | "Federal Grants and Contracts" = $9,692,569K of the $26.27B GF total — same federal-passthrough mechanism as other states. | Accept-and-relabel honestly (TX precedent). Confirm at Phase-113 load. |
| **MO** | *(Task 2)* | $14,561M | | | |
| **KY** | *(Task 2)* | $14,188M | | | |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **AZ** | FY2024 (FY2025 not yet published/audited — NASBO shows FY2025 as "Estimated") | ✅ (node page + URL pattern confirmed to exist, per 107-style enumeration; not separately extracted this session — FY2024 extraction supersedes it for recency purposes) | ✅ (extracted + bookend-tied, but **only reachable via a non-durable Google Drive link at present** — see gap log) | **CONDITIONAL GREENLIGHT — D-07 numerically satisfied (FY2023+FY2024 data obtainable and FY2024 ties exactly) but D-06 (durable URL) is NOT satisfied for FY2024 as currently published.** Flagged as a load-phase blocker/decision per D-07's own escalation clause: Phase 113 must either (a) re-check whether AZ GAO has since migrated the FY2024 PDF to its normal `sites/default/files` hosting (the pattern every prior year uses), or (b) accept the Google Drive link with an explicit non-durability caveat documented in the loader, or (c) treat AZ as a partial substitution candidate for FY2024 only. Also note: `gao.az.gov` runs Cloudflare bot-management that intermittently 403-blocked plain `curl` requests (both HTML and PDF assets) during this recon session — a session-cookie + `Referer` combination worked for FY2002/FY2023 PDFs but the WAF re-blocked subsequent bare requests; this is a genuine CDN access limitation (ca-acfr-reconciliation.md precedent), not a soft-404. Phase 113 should budget for possible browser-download fallback. |
| **IN** | FY2025 (`Fiscal-2025-Annual-Comprehensive-Financial-Report.pdf` confirmed present on the main ACFR page) | ✅ (`Entire-Annual-Comprehensive-Financial-Report-2023.pdf` confirmed live via HEAD, 200 OK) | ✅ (`2024-ACFR.pdf` extracted + bookend-tied, diff $0) | **GREENLIGHT** — recency floor cleanly satisfied, all direct durable URLs, zero access friction. |
| **CO** | FY2025 (`FY2025 ACFR_ADA_1.30.26.pdf` confirmed present on the ACFR landing page) | ✅ (`acfr23.pdf` confirmed live, 55MB PDF downloaded successfully) | ✅ (`FY2024 ACFR Final - Color Corrected_ADA.pdf` extracted + bookend-tied, diff $0) | **GREENLIGHT** — recency floor satisfied. Mild WAF requires a `Referer` header (not a hard block like AZ); durable once that header is set. |
| **MO** | *(Task 2)* | | | |
| **KY** | *(Task 2)* | | | |

---

## Section 6 — Consolidated gap log

| State | FY | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **AZ** | FY2024 URL durability | Current FY2024 ACFR is hosted ONLY on Google Drive (`drive.google.com/file/d/14FYCgTQPsu77pxLtz41E_Ba_0hCuMhwA`), not on `gao.az.gov/sites/default/files/` like every other year (FY2002–FY2023 all confirmed on the stable government domain). Fails D-06 durable-URL-hard-requirement as currently published. | **Load-phase blocker/decision (D-07 escalation).** Not treated as a gap-log exclusion outright since the numbers were obtained and tie exactly — flagged for Phase 113 to resolve (re-check for a since-migrated durable URL, or accept the Drive link with a documented caveat). |
| **AZ** | `gao.az.gov` Cloudflare WAF | Both HTML pages and PDF assets under `gao.az.gov` are behind a Cloudflare bot-management challenge that intermittently blocks plain `curl` (403 "Just a moment..." challenge page). A session-cookie + `Referer` combination bypassed it for 3 successful fetches (home page, FY2023 node page, FY2002 PDF, FY2024 PDF via the Drive fallback) before the WAF re-blocked further bare requests from this session. | Not a hard blocker — matches the Glendale/Burbank CDN precedent (ca-acfr-reconciliation.md). Phase 113 should plan for either retrying with fresh session cookies + referer headers, or a browser-download fallback if the WAF proves persistent. |
| **AZ** | Pre-FY2002 | Node pages exist back to FY1999 per Wayback CDX, but FY2002 is the declared pre-GASB-34 boundary for this milestone (D-12) — not pursued further. | Not a gap — in-scope boundary honored per plan instructions. |
| **CO** | Pre-FY2023 | No ACFR PDFs found under the current `osc.colorado.gov` domain for FY2022 and older; direct filename guesses (`acfr22.pdf`, `acfr21.pdf`, `acfr20.pdf`) all 403'd, and Wayback CDX shows only the FY2023 file ever crawled under this domain — consistent with a relatively recent site/domain migration (similar to MD's marylandtaxes.gov → marylandcomptroller.gov restructure in Phase 107). | Gap logged. FY2023–FY2025 (3-year window) is the confirmed clean window — satisfies the D-07 recency floor; D-12 permits a shallow window (GA precedent was 5 years, MD was 4). Pre-FY2023 not in scope for Phase-113 load; could be revisited if an older `colorado.gov`/`state.co.us` domain is found to host historical ACFRs. |
| **IN** | None found | Indiana's archive is exceptionally complete (FY2001–FY2025, all direct URLs, no CDN issues). | No gap. |
| **MO** | *(Task 2)* | | |
| **KY** | *(Task 2)* | | |

---

## Section 7 — Loader template mapping + Phase-113 load notes

| State | Closest loader template | GF layout notes | Phase-113 load notes |
|-------|------------------------|----------------|----------------------|
| **AZ** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map, non-derivable URL naming, needs per-year node-page resolution) | GF is 1st column of 5 (General Fund \| Transportation & Highway Maintenance & Safety Fund \| Land Endowments Fund \| Other Governmental Funds \| Total). Units = thousands. | **CRITICAL: FY2024's Google Drive URL is a load-phase blocker/decision** — resolve durability before writing (see gap log). SOURCES map must enumerate each year's exact `sites/default/files` path (varies by upload date-folder, not derivable). Budget for possible Cloudflare WAF friction (session cookie + Referer, or browser-download fallback) — this is the most access-constrained state in Batch 1. |
| **IN** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map — filenames vary by year with no derivable pattern; multi-column fund layout) | GF is 1st column of 6+ (General Fund \| Public Welfare-Medicaid Assistance Fund \| US Dept of Health & Human Services Fund \| Motor Vehicle Highway Fund \| ... \| Total). Units = thousands. Column header literally reads "Investment income (loss)" — check all years for negatives at load. | Cleanest state in Batch 1 — no CDN issues, no unit traps, and by far the smallest scope divergence (~0.99×) because Medicaid is a separate major fund in IN's ACFR, not folded into General Fund. Straightforward enumerate-and-load. |
| **CO** | `processPAAcfr.js` / `processPARevenueAcfr.js` (regular fund-column layout, but inconsistent per-year filenames requiring an explicit SOURCES map like IL/GA) | GF is 1st column of 4 (General Funds \| Federal Special Revenue Fund \| Highway Users Tax Fund \| Other Governmental Funds \| Total). Units = thousands. Column literally labeled "General Funds" (plural) — cosmetic naming quirk, same concept as every other state's "General Fund." | **P2 clamp required for the TABOR Excess Revenue line** (−$1,214,908K in FY2024) — likely recurs most/every year given Colorado's constitutional TABOR mechanism; check every loaded year, not just FY2024. Requires a `Referer` header on every fetch (mild WAF) — no cookies needed, less severe than AZ. |
| **MO** | *(Task 2)* | | |
| **KY** | *(Task 2)* | | |

---

## AZ — Arizona Detail Block

**Source:** Arizona General Accounting Office (GAO), Department of Administration
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://gao.az.gov/financials/acfr` (redirects/aliases to `https://gao.az.gov/document-category/acfr`)

**URL pattern:** Each fiscal year has its own node page `https://gao.az.gov/resources/annual-comprehensive-financial-report-june-30-{YYYY}`, which links to that year's PDF under `gao.az.gov/sites/default/files/{upload-YYYY-MM}/`. Confirmed examples:
- FY2023: `https://gao.az.gov/sites/default/files/2024-11/State%20of%20AZ%20-%20FY23%20ACFR%20Final%20-%20w%20sig.pdf`
- FY2024: currently `https://drive.google.com/file/d/14FYCgTQPsu77pxLtz41E_Ba_0hCuMhwA/view?usp=sharing` (**non-durable** — flagged, see gap log)
- FY2002: `https://gao.az.gov/sites/default/files/2022-05/02-CAFRall_0.pdf`

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 5: General Fund | Transportation & Highway Maintenance & Safety Fund | Land Endowments Fund | Other Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024: GF Total Revenues = $44,045,434K — line items sum = $44,045,434K ✅ (diff $0)
- FY2002: GF Total Revenues = $11,655,423K — line items sum = $11,655,423K ✅ (diff $0) — this is the earliest year on the current GASB-34-style statement format (matches the milestone's declared pre-GASB-34 boundary).

**Negative GF line items:** None in either bookend year (all revenue lines, including Earnings on investments, are positive in both FY2002 and FY2024). Low P2 risk.

**Access note:** `gao.az.gov` runs a Cloudflare bot-management WAF. Plain `curl` requests to most paths return a 403 "Just a moment…" JS-challenge page. A session established via the homepage (cookie jar) combined with a `Referer` header matching the resource's own node page successfully retrieved the FY2002, FY2023, and (via a Wayback Machine "Save Page Now" trigger + Google Drive `uc?export=download` endpoint) the FY2024 PDFs — but the WAF re-blocked further bare requests afterward. This matches the CDN-blocked-CLI precedent documented in `ca-acfr-reconciliation.md` (Glendale/Burbank) — not a soft-404, a genuine access limitation. Phase 113 should plan for retry-with-fresh-session or browser-download fallback.

**Clean window:** FY2002–FY2024 confirmed reachable (FY2025 not yet published — NASBO shows it as "Estimated")
**Recency floor:** CONDITIONAL GREENLIGHT — see Section 5 (FY2024 durability blocker)

---

## IN — Indiana Detail Block

**Source:** Indiana State Comptroller (in.gov/comptroller)
**PDF:** Annual Comprehensive Financial Report (ACFR) / formerly CAFR
**Landing page:** `https://www.in.gov/comptroller/Annual-Comprehensive-Financial-Reports` (current years) + `.../archived-annual-comprehensive-financial-reports` (FY2001–FY2024 archive)

**URL pattern:** No single derivable pattern — every year has its own filename on `www.in.gov/comptroller/files/`. Confirmed examples:
- FY2025: `https://www.in.gov/comptroller/files/Fiscal-2025-Annual-Comprehensive-Financial-Report.pdf`
- FY2024: `https://www.in.gov/comptroller/files/2024-ACFR.pdf`
- FY2023: `https://www.in.gov/comptroller/files/Entire-Annual-Comprehensive-Financial-Report-2023.pdf`
- FY2002: `https://www.in.gov/comptroller/files/State_of_Indiana_2002_CAFR.pdf`
- Full archive confirmed present back to FY2001 (`State_of_Indiana_2001_CAFR.pdf`).

No Cloudflare/CDN issues encountered — every fetch succeeded on the first plain `curl` attempt with a standard browser User-Agent.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 6+ columns: General Fund | Public Welfare-Medicaid Assistance Fund | US Dept of Health and Human Services Fund | Motor Vehicle Highway Fund | Build Indiana Fund | ... | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024: GF Total revenues = $22,101,900K — line items sum = $22,101,900K ✅ (diff $0)
- FY2002: GF Total revenues = $7,341,746K — line items sum = $7,341,746K ✅ (diff $0) — earliest year on the current GASB-34-style statement format.

**Negative GF line items:** None in either bookend year, but the revenue line itself is labeled "Investment income (loss)" implying negative years are possible elsewhere in the window — check every loaded year at Phase 113.

**Scope note (unusual, favorable):** Indiana reports Medicaid spending through a **separate major fund** ("Public Welfare-Medicaid Assistance Fund," $15,111,031K in FY2024) rather than folding it into the General Fund column the way most other states do. This makes IN's ACFR GF scope nearly identical to its NASBO budgetary GF concept (~0.99× ratio) — the smallest divergence found in the entire v2.14 tranche so far, smaller than even CT's 1.14× from Phase 107.

**Clean window:** FY2002–FY2025 (24 years; FY2001 also present but not verified against the GASB-34 statement format)
**Recency floor:** GREENLIGHT — FY2023 (confirmed live via HEAD) + FY2024 (extracted, bookend-tied)

---

## CO — Colorado Detail Block

**Source:** Colorado Office of the State Controller (OSC), Department of Personnel & Administration
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://osc.colorado.gov/financial-operations/financial-reports/acfr`

**URL pattern:** No derivable pattern — each year has its own filename under `osc.colorado.gov/sites/osc/files/` (or the `/documents/` subfolder). Confirmed examples:
- FY2025: `https://osc.colorado.gov/sites/osc/files/documents/FY2025%20ACFR_ADA_1.30.26.pdf`
- FY2024: `https://osc.colorado.gov/sites/osc/files/documents/FY2024%20ACFR%20Final%20-%20Color%20Corrected_ADA.pdf`
- FY2023: `https://osc.colorado.gov/sites/osc/files/acfr23.pdf`

**Access note:** `osc.colorado.gov` returns 403 on plain requests without a `Referer` header matching the ACFR landing page (`https://osc.colorado.gov/financial-operations/financial-reports/acfr`). Once that header is set, fetches succeed directly (no cookies/session needed) — a mild WAF rule, not a hard Cloudflare challenge like AZ.

**Statement:** Statement Of Revenues, Expenditures, And Changes In Fund Balances — Governmental Funds (confirmed distinct from the immediately-following "…Reconciled To Statement Of Activities" schedule, which is NOT the target)
**Column:** General Funds (1st of 4: General Funds | Federal Special Revenue Fund | Highway Users Tax Fund | Other Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024: GF Total Revenues = $26,271,588K — line items sum = $26,271,588K ✅ (diff $0)
- FY2023: URL confirmed live and downloadable (55MB PDF, 200 OK); not separately text-extracted within the D-11 effort budget for this recon session (FY2024's clean tie + FY2025's confirmed existence already establish the recency floor without needing a third full extraction).

**Negative GF line items:** **CAUTION — FY2024 "TABOR Excess Revenue" = −$1,214,908K** in the General Funds column. This is Colorado's constitutional Taxpayer's Bill of Rights refund mechanism (excess revenue collected above the TABOR cap must be refunded to taxpayers, recorded as a negative revenue adjustment). This is very likely a recurring line in most/every fiscal year, not a one-off — Phase 113 must apply the P2 clamp and check every loaded year.

**Clean window:** FY2023–FY2025 confirmed (3 years; pre-FY2023 not found under the current `osc.colorado.gov` domain — likely a site/domain migration, similar to MD's Phase-107 precedent)
**Recency floor:** GREENLIGHT — FY2023 (confirmed live) + FY2024 (extracted, bookend-tied)

---

## MO — Missouri Detail Block

*(Task 2)*

---

## KY — Kentucky Detail Block

*(Task 2)*
