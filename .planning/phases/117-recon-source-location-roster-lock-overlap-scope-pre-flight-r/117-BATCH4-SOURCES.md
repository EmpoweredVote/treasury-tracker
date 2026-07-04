# 117 — Batch 4 ACFR Source Location (RECON-11, OK/RI/SD/VT/WV/WY — the last 6, all-50 completion)

**Status:** COMPLETE — all 6 states reconned/re-verified, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**Plan:** 117-04
**States:** Oklahoma (OK — reused v2.14 recon, re-verified), Rhode Island (RI), South Dakota (SD), Vermont (VT), West Virginia (WV), Wyoming (WY)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 112-BATCH2-SOURCES.md shape (the v2.13/v2.14 recon mold).

This is the Phase 121 (Batch 4 load, ACFR-48..53) input contract — the final Batch-4 recon
completing all 50 states. Documentation only — no DB writes, no NASBO mutations, no loader
code, no frontend changes.

**Workspace:** `_acfr-work/{ok,ri,sd,vt,wv,wy}/` (gitignored, `.gitignore` lines 108/133). `pdftotext`
confirmed available (`pdftotext version 4.00`, poppler).

---

## Section 0 — D-03 Triage (does a GAAP ACFR with a splittable GENERAL FUND column exist?)

| State | Publisher | GAAP ACFR exists? | Annual (not biennial-only)? | Splittable GF column? | Verdict |
|-------|-----------|-------------------|------------------------------|------------------------|---------|
| **OK** | Oklahoma OMES (Central Accounting & Reporting) | Yes (preserved v2.14 recon, re-verified Task 1) | Yes | Yes | **RECON — re-verified, no rot** |
| **RI** | RI Office of Accounts and Control (`controller.admin.ri.gov`) | Yes — confirmed live | Yes | Yes (4-column governmental funds statement) | **RECON** |
| **SD** | SD Bureau of Finance and Management (`bfm.sd.gov/ACFR`) | Yes — confirmed live, full archive to FY1998 | Yes | Yes (multi-column governmental funds statement) | **RECON** |
| **VT** | VT Dept. of Finance & Management (`finance.vermont.gov`) | Yes — confirmed live | Yes | Yes (multi-column governmental funds statement) | **RECON** |
| **WV** | WV Dept. of Finance (`finance.wv.gov`) | Yes — confirmed live | Yes | Yes (multi-column governmental funds statement) | **RECON** |
| **WY** | WY State Auditor's Office (`sao.wyo.gov/publications`) | Yes — confirmed live, full archive to FY1980 | **Yes (annual ACFR; the biennial cycle is the LEGISLATIVE APPROPRIATION/budget bill, NOT the audited ACFR)** — corrected assumption, see note below | Yes (multi-column governmental funds statement) | **RECON** |

**WY note (corrects the plan's anticipated risk):** Wyoming's biennial *budget/appropriation*
process does not mean it lacks an annual *audited* ACFR. `sao.wyo.gov/publications` hosts a
continuous annual CAFR/ACFR archive from FY1980 through FY2025 (52 years), each with a standard
GASB governmental-funds Statement of Revenues, Expenditures, and Changes in Fund Balances and a
distinct "General Fund" column. WY is **not** a stay-NASBO candidate — it RECONs cleanly.

**Outcome:** All 6 Batch-4 states pass D-03 triage. **Zero stay-NASBO-exception candidates in
this batch** — the Phase 123 "nodes remaining NASBO-served" list contributed by Batch 4 is
**empty**.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **OK** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total) | thousands | Jun 30 | **FY2002–FY2024** (re-verified, no rot; FY2025 still not published as of 2026-07-04) | `https://oklahoma.gov/content/dam/ok/en/omes/documents/{cafr\|ACFR\|acfr-}{YYYY}.pdf` — naming varies by era, current year (`acfr-2024.pdf`) breaks the pattern each refresh. Landing: `https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html` |
| **RI** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Intermodal Surface Transportation \| Rhode Island Capital Plan \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2006–FY2025** (20 years, both bookends tie-confirmed; older years 1998-2016 also listed but not tie-confirmed within D-04 budget) | Opaque per-year filenames under a date-stamped Drupal path — no single derivable pattern, enumerate from the financial-reports page: FY2025=`.../2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf`, FY2024=`.../2025-03/2024%20State%20of%20Rhode%20Island%20ACFR%206.30.24%20-%20Final.pdf`, FY2023=`.../2024-02/ACFR%206-30-2023.pdf`. Landing: `https://controller.admin.ri.gov/financial-reporting-and-accounting/financial-reports` |
| **SD** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Transportation \| Social Services Federal \| COVID-19 Federal \| Dakota Cement Trust \| Education Enhancement Trust \| Nonmajor \| Total) | thousands | Jun 30 | **FY2002–FY2025** (24 years, both bookends tie-confirmed; full archive live back to FY1998) | **Cleanly derivable**: `https://bfm.sd.gov/acfr/SD_ACFR_{YYYY}.PDF` (FY2021–FY2025) / `SD_CAFR_{YYYY}.PDF` (FY1998–FY2020) — naming variant is a fixed era boundary, not a per-year lookup. Landing: `https://bfm.sd.gov/ACFR/` |
| **VT** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Transportation Fund \| Education Fund \| Special Fund \| Federal Revenue Fund \| Global Commitment Fund \| Non-major Governmental Funds \| Total) | **dollars** (not thousands) | Jun 30 | **FY2015–FY2025** (11 years, both bookends tie-confirmed) | Mostly derivable: `https://finance.vermont.gov/sites/finance/files/documents/VERMONT_{YYYY}_ACFR_FINAL.pdf` (FY2021–FY2025); `.../Rpts_Pubs/CAFR/FIN-{YYYY}_CAFR_FINAL.pdf` (FY2015–FY2018); `VERMONT_2020_CAFR_FINAL.pdf` (FY2020 naming exception); `2019_CAFR_FINAL.pdf` (FY2019 naming exception). **Site requires a browser User-Agent** (curl without one gets HTTP 403). Landing: `https://finance.vermont.gov/reports-and-publications/annual-comprehensive-financial-report` |
| **WV** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Transportation \| Tobacco Settlement Finance Authority \| State Road \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2020–FY2025** (6 years, both bookends tie-confirmed) | Opaque Drupal media IDs, not derivable — enumerate from the landing page: FY2025=`https://finance.wv.gov/media/37441/download?inline`, FY2024=`.../media/10261/...`, FY2023=`.../media/10251/...`, FY2022=`.../media/10236/...`, FY2021=`.../media/10521/...`, FY2020=`.../media/10646/...`. Landing: `https://finance.wv.gov/annual-comprehensive-financial-report-acfr` |
| **WY** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Foundation Program Fund \| Common School Land Fund \| Permanent Mineral Trust Fund \| Nonmajor Governmental Funds \| Total) | **dollars** (not thousands) | Jun 30 | **FY2005–FY2025** (21 years, both bookends tie-confirmed; FY1980–FY2004 archive exists but FY2002-era PDFs are poor-OCR scans — see gap log) | Multiple naming eras, not a single derivable pattern — enumerate from the publications page: FY2025=`https://sao.wyo.gov/wp-content/uploads/2026/01/2025-ACFR-12.22.25.pdf`, FY2024=`.../2025/01/2024-ACFR-State-of-Wyoming.pdf`, FY2023=`.../2024/02/2023-ACFR-State-of-Wyoming.pdf`, FY2021=`.../2022/06/ACFR-FY2021-5.31.22.pdf`, FY2005–FY2018=`.../2020/01/{YYYY}-CAFR.pdf`, FY1980–FY2004=same pattern (poor-OCR quality for older scans — verify at load). Landing: `https://sao.wyo.gov/publications/` |

**Note (site access):** `finance.vermont.gov` returns HTTP 403 to a non-browser `curl` User-Agent
— a browser UA (`Mozilla/5.0 ... Chrome/122.0.0.0`) resolves cleanly. No such block encountered
on the OK/RI/SD/WV/WY sites.

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **OK** | FY2024 (latest, re-verified) | **$30,604,464K** | 4-column sum = $31,259,646K; matches printed Total Revenues exactly. Diff = $0. ✅ (byte-identical to v2.14 preserved recon) |
| **OK** | FY2002 (oldest, re-verified) | **$9,568,595K** | 5-column sum = $9,609,878K; matches printed Total Revenues exactly. Diff = $0. ✅ (byte-identical to v2.14 preserved recon) |
| **RI** | FY2025 (latest) | **$10,095,792K** | 5-column sum (General + Intermodal Surface Transportation + RI Capital Plan + Other Governmental Funds) = $11,394,132K; matches printed Total revenues exactly. Diff = $0. ✅ |
| **RI** | FY2006 (oldest sampled) | **$4,585,920K** | 5-column sum = $5,218,477K; matches printed Total revenues exactly. Diff = $0. ✅ |
| **SD** | FY2025 (latest) | **$2,423,413K** | 7-column sum (General Fund + Transportation + Social Services Federal + COVID-19 Federal + Dakota Cement Trust + Education Enhancement Trust + Nonmajor) = $6,937,344K; matches printed Total Revenue exactly. Diff = $0. ✅ |
| **SD** | FY2002 (oldest sampled) | **$697,589K** | 5-column sum = $2,191,006K; matches printed Total Revenue exactly. Diff = $0. ✅ |

| **VT** | FY2025 (latest) | **$2,543,030,123** | 7-column sum (General Fund + Transportation + Education + Special + Federal Revenue + Global Commitment + Non-major) = $9,281,271,214; matches printed Total Revenues exactly. Diff = $0. ✅ |
| **VT** | FY2015 (oldest sampled) | **$1,392,033,404** | 7-column sum = $5,532,771,197; matches printed Total Governmental Funds figure exactly. Diff = $0. ✅ |
| **WV** | FY2025 (latest) | **$14,639,897K** | 5-column sum (General + Transportation + Tobacco Settlement Finance Authority + State Road + Other Governmental Funds) = $17,027,191K; matches printed Total Revenues exactly. Diff = $0. ✅ |
| **WV** | FY2020 (oldest, live-durable window) | **$10,760,376K** | 5-column sum = $12,357,751K; matches printed Total Revenues exactly. Diff = $0. ✅ |
| **WY** | FY2025 (latest) | **$4,027,001,270** | 6-column sum (General Fund + Foundation Program + Common School Land + Permanent Mineral Trust + Pandemic Relief [$0] + Nonmajor) = $7,222,723,950; matches printed Total Revenues exactly. Diff = $0. ✅ |
| **WY** | FY2005 (oldest clean-text bookend — FY2002 is a poor-OCR scan, see gap log) | **$1,590,602,744** | 6-column sum = $3,647,136,539; matches printed Total Revenues exactly. Diff = $0. ✅ |

---

## Section 3 — Four risk facts per D-08

| Fact | OK | RI | SD | VT | WV | WY |
|------|----|----|-----|----|----|----|
| **Units** | thousands | thousands | thousands | **dollars** (not thousands) | thousands | **dollars** (not thousands) |
| **Negative GF line items** | None observed in FY2024 or FY2002 GF column. Interest and Investment Revenue = +$459,743K (FY2024), +$96,796K (FY2002). Low risk. | None observed in FY2025 or FY2006 GF column. Income from investments = +$47,546K (FY2025), +$2,000K (FY2006). Low risk. | None observed in FY2025 or FY2002 GF column. Use of Money and Property = +$127,799K (FY2025), +$23,060K (FY2002). Low risk. | None observed in FY2025 or FY2015 GF column. Investment income/(loss) = +$60,960,064 (FY2025), Investment income = +$304,938 (FY2015). Low risk despite the "(loss)" possibility in the FY2025 column header — check intervening years at load. | None observed in FY2025 or FY2020 GF column. Investment Earnings = +$352,526K (FY2025), +$96,028K (FY2020). Low risk. | **CAUTION:** GF column carries a "Net Increase/(Decrease) in the Fair Market Value of Investments" sub-line (FY2005 = +$26,698,597, positive, but the label itself signals mark-to-market risk) plus large Investment Income lines ($1.41B in FY2025) tied to Permanent Mineral Trust Fund earnings — WY's GF revenue is unusually exposed to investment-market swings. Both confirmed bookend years are positive, but **flag for P2 clamp monitoring at every load year**, not just the bookends. |
| **Exact column header + statement** | "General", *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) | "General", *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities) | "General Fund", *STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) | "General Fund", *STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) | "General", *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) | "General Fund", *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ (all 6 Batch-4 states are June 30 — no non-June FY-end in this batch, unlike TX/MI in prior batches) |

---

## Section 4 — Scope vs NASBO (D-09)

Note: NASBO GF operating figures (`scripts/loadStateGF.mjs`) are **expenditure** totals
(spending-by-function). ACFR figures are **revenue** totals. The comparison flags whether the
ACFR GF's revenue base is materially broader/narrower than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **OK** | $30,604,464K (FY2024) | $9,139,000,000 | **~3.35×** | Unchanged from v2.14 preserved recon — OK's GAAP General Fund consolidates nearly all state general-purpose taxes AND the full Federal Revenue line ($13.78B) into a single fund, whereas NASBO's narrower budgetary concept excludes most earmarked/dedicated-revolving-fund and federal-passthrough activity. | **Accept-and-relabel honestly** (TX/MI precedent). Confirm at Phase-121 load. |
| **RI** | $10,095,792K (FY2025) | $5,236,000,000 | **~1.93×** | RI's GAAP General Fund consolidates a large Federal grants line ($4.55B of $10.1B GF total, ~45%) that NASBO's narrower budgetary concept excludes. Similar mechanism to MD/GA (~1.8-2.0×). | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-121 load. |
| **SD** | $2,423,413K (FY2025) | $2,362,000,000 | **~1.03×** | Near-parity — the smallest divergence recorded across the whole v2.15 milestone so far. SD's "Administering Programs" federal-passthrough revenue ($748.5M) is booked to the Transportation/Federal columns, not the GF column, keeping the GF column close to NASBO's budgetary concept. | **Accept-and-relabel honestly** (TX precedent), but the divergence is minimal — confirm at Phase-121 load. |

| **VT** | $2,543,030,123 (FY2025) | $2,510,000,000 | **~1.01×** | Near-parity, the smallest divergence in Batch 4 (edging out SD's ~1.03×). VT's federal grants ($410.5M) are booked mostly to the Transportation Fund, not the GF column; the GF column stays close to NASBO's budgetary concept. | **Accept-and-relabel honestly** (TX precedent), divergence is minimal. Confirm at Phase-121 load. |
| **WV** | $14,639,897K (FY2025) | $4,164,000,000 | **~3.52×** | Large divergence, comparable to MI's ~3.56×/OK's ~3.35×. Driver: WV's GAAP General Fund consolidates a very large "Intergovernmental" federal-passthrough line ($6.92B of $14.64B GF total, ~47%) plus its full state-tax base into a single fund, while NASBO's narrower budgetary concept excludes most of this. | **Accept-and-relabel honestly** (TX/MI/OK precedent), document prominently. Confirm at Phase-121 load. |
| **WY** | $4,027,001,270 (FY2025) | $1,654,000,000 | **~2.43×** | Large divergence. Driver: WY's GAAP General Fund consolidates a large Federal line ($1.11B) AND a very large Investment Income line ($1.41B, driven by Permanent Mineral Trust Fund earnings routed partly through the GF) into a single fund — a mechanism unique to WY among Batch-4 states (investment income, not tax consolidation, is the larger driver). | **Accept-and-relabel honestly** (TX precedent), flag the investment-income driver explicitly (distinct from the typical federal-passthrough driver seen elsewhere). Confirm at Phase-121 load. |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **OK** | FY2024 (final audited; FY2025 not yet published as of 2026-07-04, re-checked — unchanged from v2.14) | ✅ (`ACFR2023.pdf` confirmed live in v2.14; landing page still lists it) | ✅ (`acfr-2024.pdf` re-verified live today, `application/pdf`, byte-identical GF total to v2.14) | **GREENLIGHT** — recency floor satisfied, no regression since v2.14. |
| **RI** | FY2025 (final audited, ACFR published 2026-06) | ✅ (`ACFR 6-30-2023.pdf` listed on financial-reports page) | ✅ (`2024 State of Rhode Island ACFR 6.30.24 - Final.pdf` listed) | **GREENLIGHT** — recency floor satisfied. |
| **SD** | FY2025 (final audited) | ✅ (`SD_ACFR_2023.PDF` listed) | ✅ (`SD_ACFR_2024.PDF` listed) | **GREENLIGHT** — recency floor satisfied. |

| **VT** | FY2025 (final audited) | ✅ (`VERMONT_2023_ACFR_FINAL.pdf` listed) | ✅ (`VERMONT_2024_ACFR_FINAL.pdf` listed) | **GREENLIGHT** — recency floor satisfied. |
| **WV** | FY2025 (final audited) | ✅ (`/media/10251/` listed as "2023 West Virginia Annual Comprehensive Financial Report") | ✅ (`/media/10261/` listed as "2024 West Virginia Annual Comprehensive Financial Report") | **GREENLIGHT** — recency floor satisfied despite the shallow FY2020–FY2025 window (D-12: no minimum depth beyond the floor). |
| **WY** | FY2025 (final audited, published 2025-12-22) | ✅ (`2023-ACFR-State-of-Wyoming.pdf` listed) | ✅ (`2024-ACFR-State-of-Wyoming.pdf` listed) | **GREENLIGHT** — recency floor satisfied. Full FY1980–FY2025 archive exists (deepest of any Batch-4 state, and matching the deepest states in the whole v2.15 milestone); FY2005–FY2025 (21-year) window tie-confirmed clean-text within the D-04 budget. |

---

## Section 6 — Consolidated gap log

| State | FY / Period | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **OK** | FY2025 | Not yet published by OMES as of 2026-07-04 (re-checked, unchanged from the v2.14 recon date of 2026-07-02 — landing page's newest entry is still FY2024). | Not a gap — does not block the recency floor (FY2023+FY2024 already satisfied). Re-check at Phase-121 load in case FY2025 has since posted. |
| **RI** | Pre-FY2006 | Files exist under `/sites/g/files/xkgbur621/files/2025-01/{YYYY}.pdf` for 2006-2016 and CAFR filenames for 2017-2020, all discoverable on the financial-reports page, but not individually tie-confirmed within the D-04 budget (bookend = oldest+latest only per D-05). | Not tie-confirmed here, logged for Phase-121 load-time verification. FY2006–FY2025 (20-year window) already exceeds most other Batch states' depth. |
| **RI** | Naming variants | No single derivable URL pattern — every year (and even every "CAFR" vs "ACFR" naming era) requires its own explicit URL from the financial-reports page, and files live under a date-stamped Drupal directory. | SOURCES map must enumerate all years explicitly (NC/GA precedent), not a derivable pattern. Re-verify each URL still resolves at Phase-121 load (Drupal directories are stable once published). |
| **SD** | Pre-FY2002 | `SD_CAFR_{YYYY}.PDF` exists back to 1998 on the same landing page, but not tie-confirmed within the D-04 budget. | Not tie-confirmed here, logged for Phase-121 load-time consideration if a deeper window is desired. FY2002–FY2025 (24-year window) already matches the deepest Batch-2/3 states. |

| **VT** | Pre-FY2015 | The landing page's oldest listed year is FY2015 (`FIN-2015_CAFR_FINAL.pdf`); no older years discoverable on the current site within the D-04 budget. | Not tie-confirmed; logged for Phase-121 load-time consideration if a deeper window is desired. FY2015–FY2025 (11-year window) already satisfies the recency floor. |
| **VT** | Naming variants | FY2019 (`2019_CAFR_FINAL.pdf`, no `FIN-` prefix) and FY2020 (`VERMONT_2020_CAFR_FINAL.pdf`, `VERMONT_` prefix + `CAFR` not `ACFR`) both break the otherwise-clean `FIN-{YYYY}_CAFR_FINAL.pdf` (2015-2018) / `VERMONT_{YYYY}_ACFR_FINAL.pdf` (2021+) patterns. | Named variants, not gaps — both confirmed real, live PDFs. SOURCES map must special-case FY2019 and FY2020 explicitly. |
| **WV** | Pre-FY2020 | Only 6 years (FY2020–FY2025) are linked from the current `annual-comprehensive-financial-report-acfr` page; older years not discoverable within the D-04 budget (opaque Drupal media IDs make guessing infeasible). | Gap logged. FY2020–FY2025 (6-year window) is the confirmed clean window, matching MD's/GA's shallow-window precedent (D-12: no minimum depth beyond the recency floor). |
| **WY** | FY1980–FY2004 | The publications page lists a continuous CAFR archive back to FY1980, but the FY2002 PDF (and likely other pre-2005 years) is a **poor-quality OCR scan** — extracted text is heavily garbled (e.g. "flna,nce", "STaMe", corrupted digits), making a reliable `pdftotext -table` GF-column tie infeasible within the D-04 budget. FY2005 was confirmed to have clean, non-OCR text and ties exactly. | **Not a durable-URL gap (D-06 doesn't apply — the URLs resolve fine)**; this is an **extraction-quality gap**, logged for Phase-121 load-time OCR handling (KY FY2002 / CT FY2006 precedent — free-OCR recovery may be possible, same as `pre34Extract.mjs`-adjacent tooling). FY2005–FY2025 (21-year window) is the confirmed clean-text window; FY1980–FY2004 is a stretch goal for the load phase, not required for the recency floor. |

---

## Section 7 — Loader template mapping + Phase-121 load notes

| State | Closest loader template | GF layout notes | Phase-121 load notes |
|-------|------------------------|----------------|----------------------|
| **OK** | `extract_gf.py` + `gen_state.py` (v2.14 generic tooling) | GF is 1st column of 4 (General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total). Units = thousands, standard `UNITS = 1_000` scaling. | Straightforward reuse of the v2.14-preserved SOURCES map; no fy_end override needed (June 30). Current-year filename (`acfr-2024.pdf`) breaks the derivable pattern each refresh — special-case at load. |
| **RI** | `extract_gf.py` + `gen_state.py`, explicit per-year SOURCES map (NC/GA precedent — opaque filenames) | GF is 1st column of 4 (General \| Intermodal Surface Transportation \| Rhode Island Capital Plan \| Other Governmental Funds \| Total). Units = thousands. | Must enumerate all years' explicit URLs from the financial-reports page (no derivable pattern). Naming/casing/spacing varies by year ("ACFR 6-30-2022 .pdf" has a trailing space before ".pdf" — verify literal filename at load). |
| **SD** | `extract_gf.py` + `gen_state.py` — **cleanest derivable pattern in Batch 4** | GF is 1st column of 7 (General Fund \| Transportation \| Social Services Federal \| COVID-19 Federal \| Dakota Cement Trust \| Education Enhancement Trust \| Nonmajor \| Total). Units = thousands. | Simple `SD_ACFR_{YYYY}.PDF` (2021+) / `SD_CAFR_{YYYY}.PDF` (pre-2021) pattern — closest to a "one config line" load of any Batch-4 state. |
| **VT** | `extract_gf.py` + `gen_state.py` — **requires `UNITS = 1` override** (dollars-not-thousands, NJ/WY precedent) | GF is 1st column of 7 (General Fund \| Transportation \| Education \| Special \| Federal Revenue \| Global Commitment \| Non-major \| Total). Units = **dollars** — do NOT apply the default `UNITS = 1_000` scaling. | Naming exceptions for FY2019/FY2020 (see gap log) must be special-cased in the SOURCES map. Requires a browser User-Agent for all fetches (`finance.vermont.gov` 403s bare `curl`). |
| **WV** | `extract_gf.py` + `gen_state.py`, explicit per-year SOURCES map (NC/GA/RI precedent — opaque Drupal media IDs) | GF is 1st column of 5 (General \| Transportation \| Tobacco Settlement Finance Authority \| State Road \| Other Governmental Funds \| Total). Units = thousands. | Must enumerate all 6 years' explicit media-ID URLs from the landing page (no derivable pattern). Shallow 6-year window (FY2020-2025) — re-check the landing page at load time in case older years have since been added. |
| **WY** | `extract_gf.py` + `gen_state.py` — **requires `UNITS = 1` override** (dollars-not-thousands, same as VT/NJ) | GF is 1st column of 6 (General Fund \| Foundation Program Fund \| Common School Land Fund \| Permanent Mineral Trust Fund \| Pandemic Relief Fund \| Nonmajor \| Total). Units = **dollars**. | Multiple naming eras across the 21-year window (see per-year URLs above) — enumerate explicitly, no single derivable pattern despite the long archive. **P2 clamp monitoring recommended** for every load year given the GF's large investment-income exposure (see Section 3 risk-fact caution), not just a one-time check. FY2005 is the recommended clean-text floor; pre-FY2005 years need OCR handling before considering. |

---

## Oklahoma (OK) — Detail Block (v2.14-preserved recon, re-verified 2026-07-04)

**Source:** State of Oklahoma Office of Management and Enterprise Services (OMES), Central
Accounting and Reporting division
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing/archive page:** `https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html`

**Re-verification method (T-117-04 mitigation):** re-fetched the FY2024 and FY2002 PDFs live
today (2026-07-04) rather than trusting the v2.14 doc blind; confirmed `Content-Type:
application/pdf` on both, re-ran `pdftotext -table`, and re-derived both bookend ties from the
raw text — **every figure is byte-identical to the v2.14-preserved recon.** No rot found.

**URL pattern (live, confirmed `application/pdf`; mostly-derivable):**
- FY2024 (current, breaks the pattern): `https://oklahoma.gov/content/dam/ok/en/omes/documents/acfr-2024.pdf`
- FY2023: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2023.pdf`
- FY2022: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2022.pdf`
- FY2021: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2021.pdf`
- FY2000–FY2020: `https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr{YYYY}.pdf` (e.g. FY2002 bookend = `cafr2002.pdf`)
- FY2025: **re-checked 2026-07-04 — still not published** (landing page's newest entry remains FY2024, matching the v2.14 recon date; this does not block the recency floor)

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 4: General | Commissioners of the Land Office | Wildlife Lifetime Licenses | Tobacco Settlement Endowment | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms (re-derived from freshly-fetched PDFs, 2026-07-04):**
- FY2024: GF Total Revenues = $30,604,464K — 4-column sum = $31,259,646K matches printed Total Revenues exactly ✅ (diff $0)
- FY2002: GF Total Revenues = $9,568,595K — 5-column sum (FY2002 also had a small Nonmajor Capital Projects column) = $9,609,878K matches printed Total Revenues exactly ✅ (diff $0)

**Investment income:** GF column "Interest and Investment Revenue" FY2024 = +$459,743K (positive); FY2002 = +$96,796K (positive). No P2 clamp needed for the GF column, re-confirmed.

**Scope vs NASBO (~3.35×, unchanged):** OK ACFR GF revenue ($30.60B, FY2024) vs NASBO GF operating ($9.14B, FY2024) — the largest divergence of the 6 Batch-4 states. OK's GAAP General Fund consolidates nearly all state general-purpose taxes and the full Federal Revenue line ($13.78B) into a single fund. **Accept-and-relabel honestly, document prominently** (unchanged recommendation).

**Clean window:** FY2002–FY2024 (22 years, both bookends re-tie-confirmed to $0 diff, 2026-07-04).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 re-confirmed live-durable, no regression since v2.14; FY2025 still not published, which does not block the floor).

---

## Rhode Island (RI) — Detail Block

**Source:** State of Rhode Island Office of Accounts and Control (Dept. of Administration)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://controller.admin.ri.gov/financial-reporting-and-accounting/financial-reports`

**URL pattern (opaque per-year filenames under a date-stamped Drupal directory; no single
derivable pattern — must enumerate from the landing page each refresh):**
- FY2025: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf`
- FY2024: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-03/2024%20State%20of%20Rhode%20Island%20ACFR%206.30.24%20-%20Final.pdf`
- FY2023: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2024-02/ACFR%206-30-2023.pdf`
- FY2022: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2023-01/ACFR%206-30-2022%20.pdf` *(note the literal trailing `%20` before `.pdf` in the filename — verify exact string at load)*
- FY2021: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/ACFR%206-30-2021.pdf`
- FY2020–FY2017 (CAFR naming): `.../2022-04/CAFR%2006-30-{YYYY}.pdf`
- FY2006–FY2016: `.../2025-01/{YYYY}.pdf` (bare year filenames)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 4: General | Intermodal Surface Transportation | Rhode Island Capital Plan | Other Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $10,095,792K — 4-column sum (General + Intermodal Surface Transportation + RI Capital Plan + Other Governmental Funds) = $11,394,132K matches printed Total revenues exactly ✅ (diff $0)
- FY2006: GF Total revenues = $4,585,920K — 4-column sum = $5,218,477K matches printed Total revenues exactly ✅ (diff $0)

**Investment income:** GF column "Income (loss) from investments" FY2025 = +$47,546K (positive); FY2006 "Income from investments" = +$2,000K (positive). No P2 clamp needed for either confirmed bookend year — note the column header itself includes "(loss)" possibility, so check intervening years at load.

**Scope vs NASBO (~1.93×):** RI ACFR GF revenue ($10.10B, FY2025) vs NASBO GF operating ($5.24B, FY2024). Driver: Federal grants booked to the GF column ($4.55B of $10.1B, ~45%) — a similar mechanism to MD/GA/MA in prior batches. **Accept-and-relabel honestly** (TX precedent).

**Clean window:** FY2006–FY2025 (20 years, both bookends tie-confirmed to $0 diff; older years FY1998–2016 discoverable but not individually verified within the D-04 budget).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed present on the financial-reports page).

---

## South Dakota (SD) — Detail Block

**Source:** State of South Dakota Bureau of Finance and Management (BFM)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://bfm.sd.gov/ACFR/`

**URL pattern (live, confirmed `application/pdf`; cleanly derivable — the best of Batch 4):**
- FY2021–FY2025: `https://bfm.sd.gov/acfr/SD_ACFR_{YYYY}.PDF`
- FY1998–FY2020: `https://bfm.sd.gov/acfr/SD_CAFR_{YYYY}.PDF`
- Naming-era boundary (2021, "ACFR" vs "CAFR" terminology change) is fixed and known, not a per-year lookup.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 7: General Fund | Transportation | Social Services Federal | COVID-19 Federal | Dakota Cement Trust | Education Enhancement Trust | Nonmajor | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenue = $2,423,413K — 7-column sum = $6,937,344K matches printed Total Revenue exactly ✅ (diff $0)
- FY2002: GF Total Revenue = $697,589K — 5-column sum (FY2002 had 5 columns: General Fund | Transportation | Social Services Federal | Dakota Cement Trust | Nonmajor) = $2,191,006K matches printed Total Revenue exactly ✅ (diff $0)

**Investment income:** GF column "Use of Money and Property" FY2025 = +$127,799K (positive); FY2002 = +$23,060K (positive). No P2 clamp needed for either confirmed bookend year.

**Scope vs NASBO (~1.03×, near-parity):** SD ACFR GF revenue ($2.42B, FY2025) vs NASBO GF operating ($2.36B, FY2024) — the smallest divergence recorded in the entire v2.15 milestone to date (closer than OR's ~1.07× or VT's projected near-parity). SD's federal-passthrough revenue ("Administering Programs", $748.5M) routes through the Transportation/Social Services Federal/COVID-19 Federal columns, not the GF column, keeping GF close to NASBO's budgetary concept. **Accept-and-relabel honestly** (TX precedent), though the divergence is minimal.

**Clean window:** FY2002–FY2025 (24 years, both bookends tie-confirmed to $0 diff; full archive live back to FY1998).
**Recency floor:** GREENLIGHT (FY2023 `SD_ACFR_2023.PDF` + FY2024 `SD_ACFR_2024.PDF` both confirmed present on the landing page).

---

## Vermont (VT) — Detail Block

**Source:** State of Vermont Department of Finance & Management (DFM)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://finance.vermont.gov/reports-and-publications/annual-comprehensive-financial-report`
**Access note:** `finance.vermont.gov` returns HTTP 403 to a bare `curl` User-Agent — a browser
UA (`Mozilla/5.0 ... Chrome/122.0.0.0 Safari/537.36`) resolves cleanly. Not a hard blocker
(same class of quirk as `tn.gov` needing a browser UA, per memory).

**URL pattern (live, confirmed `application/pdf` with a browser UA; mostly-derivable):**
- FY2025: `https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2025_ACFR_FINAL.pdf` (also split into `VT_2025_ACFR_FINAL_FINANCIAL.pdf` / `_INTRO.pdf` / `_OTHER_SUPP.pdf` parts — the combined file's GF statement is confirmed extractable)
- FY2024: `https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2024_ACFR_FINAL.pdf`
- FY2023: `https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2023_ACFR_FINAL.pdf`
- FY2022: `https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2022_ACFR_FINAL.pdf`
- FY2021: `https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/VERMONT_2021_ACFR_FINAL.pdf`
- FY2020 (naming exception): `https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/VERMONT_2020_CAFR_FINAL.pdf`
- FY2019 (naming exception): `https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/2019_CAFR_FINAL.pdf`
- FY2015–FY2018: `https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-{YYYY}_CAFR_FINAL.pdf`
- Pre-FY2015: not discoverable on the current landing page within the D-04 budget.

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 7: General Fund | Transportation Fund | Education Fund | Special Fund | Federal Revenue Fund | Global Commitment Fund | Non-major Governmental Funds | Total)
**Units:** Dollars (not thousands — VT reports whole-dollar figures, e.g. `$1,400,355,717`)
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $2,543,030,123 — 7-column sum = $9,281,271,214 matches printed Total Revenues exactly ✅ (diff $0)
- FY2015: GF Total revenues = $1,392,033,404 — 7-column sum = $5,532,771,197 matches printed Total Governmental Funds figure exactly ✅ (diff $0)

**Investment income:** GF column "Investment income/(loss)" FY2025 = +$60,960,064 (positive); "Investment income" FY2015 = +$304,938 (positive). No P2 clamp needed for either confirmed bookend year — the "(loss)" possibility in the FY2025 column header signals the line CAN go negative; check intervening years at load.

**Scope vs NASBO (~1.01×, near-parity):** VT ACFR GF revenue ($2.54B, FY2025) vs NASBO GF operating ($2.51B, FY2024) — the smallest divergence in Batch 4. VT's federal grants revenue ($410.5M) is booked mostly to the Transportation Fund column, not the GF column, keeping the GF column close to NASBO's budgetary concept. **Accept-and-relabel honestly** (TX precedent), divergence is minimal.

**Clean window:** FY2015–FY2025 (11 years, both bookends tie-confirmed to $0 diff).
**Recency floor:** GREENLIGHT (FY2023 `VERMONT_2023_ACFR_FINAL.pdf` + FY2024 `VERMONT_2024_ACFR_FINAL.pdf` both confirmed present).

---

## West Virginia (WV) — Detail Block

**Source:** State of West Virginia Department of Finance (Financial Accounting & Reporting Section)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://finance.wv.gov/annual-comprehensive-financial-report-acfr`

**URL pattern (opaque Drupal media IDs — no derivable pattern, enumerate from the landing page):**
- FY2025: `https://finance.wv.gov/media/37441/download?inline`
- FY2024: `https://finance.wv.gov/media/10261/download?inline`
- FY2023: `https://finance.wv.gov/media/10251/download?inline`
- FY2022: `https://finance.wv.gov/media/10236/download?inline`
- FY2021: `https://finance.wv.gov/media/10521/download?inline`
- FY2020: `https://finance.wv.gov/media/10646/download?inline`
- Pre-FY2020: not linked from the current page within the D-04 budget.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 5: General | Transportation | Tobacco Settlement Finance Authority | State Road | Other Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $14,639,897K — 5-column sum = $17,027,191K matches printed Total Revenues exactly ✅ (diff $0)
- FY2020: GF Total Revenues = $10,760,376K — 5-column sum = $12,357,751K matches printed Total Revenues exactly ✅ (diff $0)

**Investment income:** GF column "Investment Earnings" FY2025 = +$352,526K (positive); FY2020 = +$96,028K (positive). No P2 clamp needed for either confirmed bookend year.

**Scope vs NASBO (~3.52×):** WV ACFR GF revenue ($14.64B, FY2025) vs NASBO GF operating ($4.16B, FY2024) — the second-largest divergence in Batch 4 (after OK's ~3.35×, comparable to MI's ~3.56× from v2.13). Driver: WV's GAAP General Fund consolidates a very large "Intergovernmental" federal-passthrough line ($6.92B of $14.64B, ~47%) plus nearly all state tax revenue into a single fund. **Accept-and-relabel honestly** (TX/MI/OK precedent), document prominently.

**Clean window:** FY2020–FY2025 (6 years, both bookends tie-confirmed to $0 diff; shallow window like MD's/GA's from prior batches).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 both confirmed present on the landing page).

---

## Wyoming (WY) — Detail Block

**Source:** State of Wyoming Auditor's Office (SAO)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://sao.wyo.gov/publications/`

**D-03 correction (important):** Wyoming's legislature operates on a **biennial budget bill**,
which the plan anticipated might mean WY lacks a clean annual GAAP ACFR (a leading
stay-NASBO/accept-relabel candidate). Recon found this assumption does not hold: WY's SAO
publishes a continuous **annual** audited ACFR/CAFR archive from **FY1980 through FY2025** (52
years) — the deepest archive of any Batch-4 state and among the deepest in the whole v2.15
milestone. The biennial *budget* cycle governs appropriations, not financial reporting; the
audited ACFR is produced every fiscal year regardless.

**URL pattern (multiple naming eras — no single derivable pattern, enumerate from the
publications page):**
- FY2025: `https://sao.wyo.gov/wp-content/uploads/2026/01/2025-ACFR-12.22.25.pdf`
- FY2024: `https://sao.wyo.gov/wp-content/uploads/2025/01/2024-ACFR-State-of-Wyoming.pdf`
- FY2023: `https://sao.wyo.gov/wp-content/uploads/2024/02/2023-ACFR-State-of-Wyoming.pdf`
- FY2022: `https://sao.wyo.gov/wp-content/uploads/2023/02/ACFR-FY2022-1.31.23.pdf`
- FY2021: `https://sao.wyo.gov/wp-content/uploads/2022/06/ACFR-FY2021-5.31.22.pdf`
- FY2019: `https://sao.wyo.gov/wp-content/uploads/2020/04/CAFR_2019.pdf`
- FY2018: `https://sao.wyo.gov/wp-content/uploads/2019/10/2018-CAFR.pdf`
- FY1980–FY2017: `https://sao.wyo.gov/wp-content/uploads/2020/01/{YYYY}-CAFR.pdf`

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 6: General Fund | Foundation Program Fund | Common School Land Fund | Permanent Mineral Trust Fund | Pandemic Relief Fund | Nonmajor Governmental Funds | Total)
**Units:** Dollars (not thousands — WY reports whole-dollar figures, e.g. `$4,027,001,270`)
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $4,027,001,270 — 6-column sum (General Fund + Foundation Program + Common School Land + Permanent Mineral Trust + Pandemic Relief [$0] + Nonmajor) = $7,222,723,950 matches printed Total Revenues exactly ✅ (diff $0)
- FY2005: GF Total Revenues = $1,590,602,744 — 6-column sum = $3,647,136,539 matches printed Total Revenues exactly ✅ (diff $0)
- FY2002 attempted but rejected as a bookend: the PDF is a **poor-quality OCR scan** (garbled text — "flna,nce", "STaMe", corrupted digits throughout); FY2005 was substituted as the oldest clean-text bookend within the D-04 budget. See gap log.

**Investment income (CAUTION — flag for load-time monitoring):** GF column carries a
"Net Increase/(Decrease) in the Fair Market Value of Investments" sub-line in older-format years
(FY2005 = +$26,698,597, positive) plus large "Investment Income" lines overall (FY2025 =
+$1,414,203,323, the largest single revenue line in WY's GF, driven by Permanent Mineral Trust
Fund earnings routed partly through the General Fund). Both confirmed bookend years are
positive, but the mark-to-market nature of this revenue line means a down-market year could
plausibly go negative — **recommend P2 clamp monitoring at every load year**, not just the
bookends (unlike the other 5 Batch-4 states, which show only routine low-risk investment lines).

**Scope vs NASBO (~2.43×):** WY ACFR GF revenue ($4.03B, FY2025) vs NASBO GF operating ($1.65B,
FY2024). Driver is unusual among Batch-4/prior-batch states: a large Federal line ($1.11B) AND
an even larger Investment Income line ($1.41B) both consolidate into the GF column — investment
income, not federal-passthrough or tax consolidation, is WY's largest single scope-divergence
driver. **Accept-and-relabel honestly** (TX precedent), flag the investment-income driver
explicitly as distinct from the typical mechanism seen in OK/WV/RI.

**Clean window:** FY2005–FY2025 (21 years, both bookends tie-confirmed to $0 diff). FY1980–FY2004
archive exists but pre-2005 PDFs (at least FY2002) are poor-OCR scans — a stretch goal for the
load phase, not required for the recency floor.
**Recency floor:** GREENLIGHT (FY2023 `2023-ACFR-State-of-Wyoming.pdf` + FY2024
`2024-ACFR-State-of-Wyoming.pdf` both confirmed present).

---

## Section 8 — Nodes remaining NASBO-served after Batch 4 (feeds Phase 123)

**None.** All 6 Batch-4 states (OK, RI, SD, VT, WV, WY) passed D-03 triage and were
bookend-tie-confirmed to a clean GAAP ACFR General Fund column. Batch 4 contributes **zero**
entries to the Phase 123 (NASBORT-01) "stay-NASBO-exception" list. Combined with the outcomes of
Batches 1–3 (Phases 118–120, tracked separately), this recon's Batch-4 slice supports the
milestone's "all 50 states on ACFR" goal with no shortfall from this batch.

---

*Batch-4 recon complete. Input contract for Phase 121 (ACFR-48..53) is ready.*
