# 112 — Batch 2 ACFR Source Location (RECON-09, RECON-10 — OR/SC/LA/OK/UT)

**Status:** COMPLETE — all 5 states reconned, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**Plan:** 112-02
**States:** Oregon (OR), South Carolina (SC), Louisiana (LA), Oklahoma (OK), Utah (UT)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH2-SOURCES.md / 107-BATCH1-SOURCES.md shape (the v2.13 Batch-2 recon mold).

This is the Phase 114 (Batch 2 load) input contract. Documentation only — no DB writes, no NASBO
mutations, no loader code, no frontend changes.

**UT-specific scope note (D-03/RECON-10):** This document's UT block locates Utah's **state** ACFR
(Division of Finance) only. The UT *state-node* provenance check and in-place-upgrade overlap plan
are plan 112-03's scope (RECON-10). v2.5 Transparent-Utah **municipal** (city/county) BigQuery data
is explicitly out of scope and untouched by this document.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **OR** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (PDF page ~40 of FY2025 ACFR) | **General** (1st of General \| Health and Social Services \| Public Transportation \| Educational Support \| Common School \| Other \| Total) | thousands | Jun 30 | **FY2022–FY2025** (live-durable; older years 404 on current site) | `https://www.oregon.gov/das/Financial/Acctng/Documents/{year-specific filename}` — **no single derivable pattern**, enumerate: FY2025=`2025.ACFR.pdf`, FY2024=`2024_ACFR.pdf`, FY2023=`2023ACFR.pdf`, FY2022=`2022%20ACFR.pdf` (space). Landing: `https://www.oregon.gov/das/Financial/Acctng/Pages/index.aspx` (SARS unit) |
| **SC** | Statement of Revenues, Expenditures, and Changes in Fund Balances — GOVERNMENTAL FUNDS (Exhibit B-2, PDF page ~47 of FY2025 ACFR "Basic Financial Statements" part-file) | **General Fund** (1st of General Fund \| Departmental Program Services \| Local Govt Infrastructure \| DOT Special Revenue \| Nonmajor Governmental \| Totals) | thousands | Jun 30 | **FY1993–FY2025** (full run live on cg.sc.gov; FY2002 + FY2025 tie-confirmed) | Landing/archive: `https://cg.sc.gov/financial-reports/annual-comprehensive-financial-reports-acfrs` — enumerable, no single derivable pattern (naming varies by era: `SC%20FY%20{YYYY}%20CAFR.pdf` for 2000s, `{part}-ACFR-FY2025-{Section}.pdf` current-year split-file, `001-316-ACFR-FY2024.pdf` single-file for FY2019-2024). **FY2025 statement is split across multiple part-PDFs** — the Rev/Exp/Fund Balances statement is in `039-191-ACFR-FY2025-BasicFinancialStatements.pdf`, not the full-ACFR file |
| **LA** | STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS (PDF page ~37 of FY2025 ACFR) | **GENERAL FUND** (1st of General Fund \| Bond Security & Redemption Fund \| Capital Outlay Escrow Fund \| Louisiana Education Quality Trust Fund \| Nonmajor Governmental \| Total) | thousands | Jun 30 | **FY2002–FY2025** (live, hash-path CMS but durable landing page) | Landing: `https://www.doa.la.gov/doa/osrap/annual-financial-report/` (current 4 years) + `https://doa.la.gov/doa/osrap/archives/` (older years). Hash-based media paths, e.g. FY2025=`https://doa.la.gov/media/lqvhnfhs/fy25-acfr-final.pdf`, FY2002=`https://doa.la.gov/media/fthjchle/cafr02.pdf` — **no derivable pattern, must enumerate from the landing/archive pages each refresh** |
| **OK** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds (PDF page ~57 of FY2024 ACFR) | **General** (1st of General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total) | thousands | Jun 30 | **FY2002–FY2024** (22 years, both bookends tie-confirmed; FY2025 not yet published as of 2026-07-02) | Landing/archive: `https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html` — clean derivable pattern for most years: `cafr{YYYY}.pdf` (FY2000–FY2020), `ACFR{YYYY}.pdf` (FY2021–FY2023), current year uses `acfr-2024.pdf` (lowercase-hyphen, breaks the derivable pattern) |
| **UT** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds (PDF page ~44 of FY2025 ACFR) | **General Fund** (1st of General Fund \| Income Tax/Education \| Transportation \| Transportation Investment Fund \| Trust Lands Permanent Fund \| Nonmajor \| Total) | thousands | Jun 30 | **FY2019–FY2025** (live-durable on the WordPress-migrated site; pre-2019 years 404 live, non-durable) | `https://finance.utah.gov/wp-content/uploads/{year-specific filename}` — no single derivable pattern: FY2025=`FY25-ACFR-FINAL-reduced-size.pdf`, FY2024=`FY24-ACFR-Final.pdf`, FY2023=`2023-ACFR.pdf`, FY2022=`2022-ACFR.pdf`, FY2021=`2021-ACFR.pdf`, FY2020=`2020-ACFR.pdf`, FY2019=`2019-ACFR.pdf`. Landing: `https://finance.utah.gov/` (Division of Finance) |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **OR** | FY2025 (latest, FY-end Jun 30 2025) | **$17,291,987K** | Sum of all 6 fund columns (General + Health/SS + Public Transp + Educational Support + Common School + Other) = $45,971,876K; matches printed Total Revenues. Diff = $0. ✅ |
| **OR** | FY2022 (oldest live-durable bookend) | **$15,711,953K** | Sum of all 6 fund columns = $41,589,472K vs printed $41,589,473K. Diff = $1K (acceptable rounding). ✅ |
| **SC** | FY2025 (latest, FY-end Jun 30 2025) | **$20,731,521K** | Sum of all 5 fund columns (General + Program Services + Infrastructure + DOT Special Revenue + Nonmajor) = $41,234,043K; matches printed Total revenues. Diff = $0. ✅ |
| **SC** | FY2002 (oldest bookend, boundary year) | **$5,763,261K** | Sum of all 6 fund columns (General + Departmental General Operating + Local Govt Infrastructure + DOT Special Revenue + State Tobacco Settlement + Nonmajor) = $12,537,177K; matches printed Total revenues. Diff = $0. ✅ |
| **LA** | FY2025 (latest, FY-end Jun 30 2025) | **$22,780,529K** | Sum of all 5 fund columns (General + Bond Security & Redemption + Capital Outlay Escrow + LEQ Trust + Nonmajor) = $44,863,418K; matches printed Total Revenues. Diff = $0. ✅ |
| **LA** | FY2002 (oldest bookend, boundary year) | **$5,807,699K** | Sum of all 4 fund columns (General + Bond Security & Redemption + LEQ Trust + Nonmajor) = $17,523,434K; matches printed Total Revenues. Diff = $0. ✅ |
| **OK** | FY2024 (latest, FY-end Jun 30 2024) | **$30,604,464K** | Sum of all 4 fund columns (General + Commissioners of the Land Office + Wildlife Lifetime Licenses + Tobacco Settlement Endowment) = $31,259,646K; matches printed Total Revenues. Diff = $0. ✅ |
| **OK** | FY2002 (oldest bookend, boundary year) | **$9,568,595K** | Sum of all 5 fund columns (General + Commissioners of the Land Office + Wildlife Lifetime Licenses + Tobacco Settlement Endowment + Nonmajor Capital Projects) = $9,609,878K; matches printed Total Revenues. Diff = $0. ✅ |
| **UT** | FY2025 (latest, FY-end Jun 30 2025) | **$11,404,950K** | Sum of all 6 fund columns (General + Income Tax + Transportation + Transportation Investment + Trust Lands + Nonmajor) = $24,779,233K; matches printed Total Revenues. Diff = $0. ✅ |
| **UT** | FY2019 (oldest live-durable bookend) | **$6,509,587K** | Sum of all 6 fund columns (General + Education + Transportation + Transportation Investment + Trust Lands + Nonmajor) = $14,316,149K; matches printed Total Revenues. Diff = $0. ✅ |

---

## Section 3 — Four risk facts per D-08

| Fact | OR | SC | LA | OK | UT |
|------|----|----|----|----|-----|
| **Units** | thousands | thousands | thousands | thousands | thousands |
| **Negative GF line items** | None observed in FY2025 or FY2022 GF column. Investment Income = +$411,848K (FY2025), +$59,464K (FY2022). Low risk. | None observed in FY2025 or FY2002 GF column. Interest and other investment income = +$684,860K (FY2025), +$62,039K (FY2002). Low risk. Note: FY2002 General Fund ENDING fund balance was a deficit $(139,951)K — a structural fact, not a revenue-line P2 clamp issue. | None observed in FY2025 or FY2002 GF column. Use of Money and Property (GF) = +$50,906K (FY2025), +$18,822K (FY2002). Low risk. Note: the nonmajor "Louisiana Education Quality Trust Fund" column showed a negative Use of Money & Property in FY2002 (-$13,444K) — not the GF column. | None observed in FY2024 or FY2002 GF column. Interest and Investment Revenue (GF) = +$459,743K (FY2024), +$96,796K (FY2002). Low risk. Note: the "Commissioners of the Land Office" nonmajor column had negative Interest/Investment Revenue in FY2002 (-$27,167K) — not the GF column. | None observed in FY2025 or FY2019 GF column. Investment Income (Loss) [GF] = +$270,301K (FY2025), +$43,630K (FY2019). Low risk despite the "(Loss)" label in the column header (label indicates the possibility exists, not that it occurred). |
| **Exact column header + statement** | "General", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) | "General Fund", *Statement of Revenues, Expenditures, and Changes in Fund Balances — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) | "GENERAL FUND", *STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) | "General", *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) | "General Fund", *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ |

---

## Section 4 — Scope vs NASBO (D-09)

Note: NASBO GF operating figures (`scripts/loadStateGF.mjs`) are **expenditure** totals (spending-by-function).
ACFR figures are **revenue** totals. The comparison flags whether the ACFR GF's revenue base is materially
broader/narrower than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **OR** | $17,291,987K (FY2025) | $16,100,000K | **~1.07×** | Modest divergence — OR's GAAP General Fund is close to NASBO's budgetary concept. Federal revenue in the GF column is small (~$16M of $17.3B); most federal flows route through the "Health and Social Services" and "Public Transportation" funds, not the GF. | **Accept-and-relabel honestly** (TX precedent), but the divergence here is small — closest to CT's ~1.14× among all recon'd states. Confirm at Phase-114 load. |
| **SC** | $20,731,521K (FY2025) | $14,189,000K | **~1.46×** | Moderate-high divergence, similar to TN's ~1.51×. Federal revenue *within* the GF column is small ($46M) — most federal flows through "Program Services." Driver is more likely GAAP-vs-budgetary basis differences (SC's GAAP GF consolidates more transfers/interest/tobacco-settlement-adjacent revenue than the narrower NASBO budgetary concept). | **Accept-and-relabel honestly** (TX precedent). Document that the driver is basis (GAAP vs budgetary), not federal passthrough, unlike most other Batch-2 states. Confirm at Phase-114 load. |
| **LA** | $22,780,529K (FY2025) | $11,970,000K | **~1.90×** | Large divergence, approaching MI's ~3.56×/OK's ~3.35× pattern. Driver: LA's GAAP General Fund consolidates a very large federal Intergovernmental Revenues line ($22.48B of $22.78B total GF revenue — i.e., **federal money is ~99% of LA's reported GF revenue**), while state taxes are almost entirely booked to the separate "Bond Security and Redemption Fund" (2nd column, $20.07B) rather than the GF. This is a structurally unusual GF composition. | **Accept-and-relabel honestly** (TX precedent), but flag prominently: LA's ACFR "General Fund" is overwhelmingly federal Medicaid/grant passthrough, NOT state tax revenue (which sits in the Bond Security & Redemption Fund instead). A naive "General Fund = state's own-source revenue" assumption would be wrong for LA. Confirm at Phase-114 load; consider whether Bond Security & Redemption Fund is a better basis-match to NASBO's concept — flagged as a load-phase decision, not resolved here. |
| **OK** | $30,604,464K (FY2024) | $9,139,000,000 | **~3.35×** | The largest divergence among the 5 Batch-2 states, on par with MI's ~3.56× (v2.13). OK's GAAP General Fund consolidates nearly all state general-purpose taxes (income, sales, gross production, motor vehicle, fuel, insurance, beverage — ~$9.0B combined) AND the full Federal Revenue line ($13.78B) into a single fund, whereas NASBO's narrower budgetary "GF" concept excludes most of the earmarked/dedicated-revolving-fund and federal-passthrough activity that OK's GAAP GF captures. | **Accept-and-relabel honestly** (TX/MI precedent, most pronounced of the 5). Document the large scope divergence and the federal-passthrough + tax-consolidation driver explicitly. Confirm at Phase-114 load. |
| **UT** | $11,404,950K (FY2025) | $13,674,000,000 | **~0.83×** | **UNIQUE among all Batch-1/Batch-2 states: UT's ACFR General Fund is NARROWER than its NASBO GF**, not broader. Utah's income tax revenue is constitutionally earmarked and reported in a separate major fund ("Income Tax Fund" as of FY2025, formerly labeled "Education" — a fund-name change tied to a 2020 constitutional amendment broadening the earmark, not a data error). NASBO's survey-reported "General Fund" concept for Utah appears to combine the true GAAP General Fund with this earmarked Income Tax Fund, while the ACFR statement legally separates them into two major-fund columns. | **Flag as a load-phase decision, not resolved here** (per D-03/D-09 guidance — do not invent a new pattern in recon). Two options for Phase 114: (a) accept the narrow GAAP General Fund column alone and relabel honestly (may under-represent UT's total operating scope vs. its NASBO history), or (b) combine General Fund + Income Tax/Education Fund columns to better match NASBO's broader historical concept. Recon flags the divergence; does not pick between (a)/(b). |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **OR** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`2023ACFR.pdf` live, confirmed `application/pdf`) | ✅ (`2024_ACFR.pdf` live, confirmed `application/pdf`) | **GREENLIGHT** — recency floor satisfied despite the shallow FY2022–FY2025 window (D-12: no minimum depth beyond the floor). |
| **SC** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`001-308-CAFR-FY2023.pdf` live) | ✅ (`001-316-ACFR-FY2024.pdf` live) | **GREENLIGHT** — recency floor satisfied. Full FY1993–FY2025 window also available (deepest of the 5 Batch-2 states). |
| **LA** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`fy2023-acfr-final.pdf` live) | ✅ (`fy2024-acfr-final.pdf` live) | **GREENLIGHT** — recency floor satisfied. FY2002–FY2025 window (23 years) available via archive enumeration. |
| **OK** | FY2024 (final audited, FY-end Jun 30 2024; FY2025 not yet published as of 2026-07-02) | ✅ (`ACFR2023.pdf` live) | ✅ (`acfr-2024.pdf` live) | **GREENLIGHT** — recency floor satisfied (FY2023+FY2024, the two years the floor requires). Full FY2002–FY2024 window (22 years) also confirmed via bookend tie. |
| **UT** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`2023-ACFR.pdf` live) | ✅ (`FY24-ACFR-Final.pdf` live) | **GREENLIGHT** — recency floor satisfied. FY2019–FY2025 window (7 years) live-durable; pre-2019 years exist historically (Wayback CDX: `{YY}UTCAFR.pdf` era) but 404 live today post-WordPress-migration — excluded per D-06, does not affect roster eligibility (D-12). |

---

## Section 6 — Consolidated gap log

| State | FY / Period | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **OR** | FY2005–FY2019 | Filenames confirmed via Wayback CDX (`{YYYY}_CAFR.pdf` / `{YYYY}%20CAFR.pdf` naming), but ALL return live 404 on `oregon.gov` today — removed from the current DAS/SARS document library (retention/cleanup, not a soft-404: 404 status + `text/html` content-type, correctly distinguished from a real PDF). | **Excluded per D-06 (non-durable)** — these years are only reachable via Wayback snapshots, not a stable re-fetchable URL. Logged, not loaded. Does not affect roster eligibility (D-12 shallow-window rule; recency floor already satisfied). |
| **OR** | FY2020–FY2021 | Tested 8 filename-naming permutations (`{YYYY}_ACFR.pdf`, `{YYYY}%20ACFR.pdf`, `{YYYY}_CAFR.pdf`, `{YYYY}%20CAFR.pdf`, `{YYYY}ACFR.pdf`) at the same `Documents/` path — all 404. Not found in Wayback CDX enumeration either (likely a genuine gap in Oregon's published archive, or a naming pattern not yet discovered within the D-11 budget). | Gap-logged; budget-stopped per D-11. FY2022–FY2025 clean window still satisfies the recency floor — this gap does not block roster eligibility. |
| **SC** | FY2019 naming variant | Two live URLs exist for the same year: `001 - 302 - CAFR - FY 2019.pdf` (spaced) and implicitly referenced via older-era filenames on the same page. | Not a gap — confirmed durable; SOURCES enumeration at load time must pick the canonical spaced-filename variant. |
| **SC** | FY2025 statement location | The FY2025 ACFR is split into 9 separate part-PDFs (Introductory/Transmittal/MDandA/IndependentAuditorsReport/BasicFinancialStatements/RSI/SupplementaryInformation/StatisticalSection) rather than one combined file (unlike FY2019–FY2024 which are single combined PDFs). | Not a gap — confirmed durable, all 9 parts return `application/pdf`. Loader must target `039-191-ACFR-FY2025-BasicFinancialStatements.pdf` specifically for the Rev/Exp/Fund-Balances statement, not a full-ACFR file. |
| **LA** | Pre-FY2002 | LA's `doa.la.gov/doa/osrap/archives/` page lists `cafr97.pdf`, `cafr94.pdf`, `cafr95.pdf`, `cafr96.pdf`, `cafr98d.pdf`, `cafr01.pdf` — i.e. years older than FY2002 ARE present on the live archive. | **Not tie-confirmed here per D-05 (bookend = oldest + latest only) and out of scope per the FY2002 pre-GASB-34 boundary** (Phase 115 territory). Noted in passing per the `<deferred>` guidance — not a 112 gap-log failure. |
| **OK** | FY2024 naming break | The current-year file is `acfr-2024.pdf` (lowercase, hyphenated) — breaks the otherwise-clean `ACFR{YYYY}.pdf` (FY2021-2023) / `cafr{YYYY}.pdf` (FY2000-2020) derivable pattern. | Named variant, not a gap — confirmed real PDF (5.4MB, `application/pdf`). SOURCES map must special-case the current year each time OMES republishes. |
| **OK** | FY2011 filename typo | Archive page lists `cafr2011pdf` (missing the dot before `pdf`) for FY2011. | Not tested for FY2011 specifically (outside the tie-confirmed bookends) — noted as a known filename oddity for Phase 114 to verify at load time. |
| **OK** | FY2025 not yet published | As of 2026-07-02, OK's ACFR archive page's newest entry is FY2024; no FY2025 link found. | Not a gap — OK's ACFR publication cadence lags some other states; FY2024 satisfies the recency floor (FY2023+FY2024 required, not FY2025). Re-check at Phase-114 load time in case FY2025 has since posted. |
| **UT** | Pre-FY2019 | Wayback CDX confirms a `{YY}UTCAFR.pdf` naming era (FY2006-FY2016) previously live at `finance.utah.gov/reporting/documents/`, plus an even older NXT-gateway document-management system (`apps.finance.utah.gov/nxt/gateway.dll?...vid=nxtpub:cafr`). Both paths tested and return 404 live today — retired after the site's WordPress migration. | **Excluded per D-06 (non-durable)** — only reachable via Wayback snapshots. Logged, not loaded. Recency floor already satisfied by the FY2019-FY2025 live window; does not block roster eligibility (D-12). |
| **UT** | Fund-name change (Education → Income Tax) | UT's 2nd major fund column was labeled "Education" in FY2019 and "Income Tax" in FY2025 — reflects the 2020 Utah constitutional amendment (Amendment G) that broadened the income-tax earmark beyond education. Column position (2nd) and GF (1st) are unaffected. | Not a gap — a naming/labeling change worth documenting in the loader for historical continuity, since a naive column-header string match across years would break. |

---

## Section 7 — Loader template mapping + Phase-114 load notes

| State | Closest loader template | GF layout notes | Phase-114 load notes |
|-------|------------------------|----------------|----------------------|
| **OR** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed — no derivable pattern) | GF is 1st of 6 columns (General \| Health and Social Services \| Public Transportation \| Educational Support \| Common School \| Other \| Total). Units = thousands. Multi-fund layout similar to NC/CT. | Must enumerate per-year URLs (naming varies: dot/underscore/no-separator/space across FY2022–FY2025). Only a 4-year live window (FY2022–FY2025) — inherits from the state's current retention practice, not a recon gap. Modest ~1.07× NASBO scope divergence is the smallest of the 5 Batch-2 states — low relabel risk. |
| **SC** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed) | GF is 1st of 5 columns (General Fund \| Program Services \| Infrastructure \| DOT Special Revenue \| Nonmajor \| Total). Units = thousands. | **CRITICAL: FY2025 requires targeting the specific `BasicFinancialStatements` part-PDF**, not the combined ACFR (which doesn't exist as one file for FY2025). FY2019–FY2024 are single combined-PDF files — simpler. Full FY1993–FY2025 window available; recommend loading a deeper window than the FY2002 boundary here since SC's full run is live-durable back to 1993 (subject to Phase 115 pre-GASB-34 boundary at FY2002 for this tranche). |
| **LA** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed — hash-based CMS paths) | GF is 1st of 4-5 columns (General \| Bond Security & Redemption \| [Capital Outlay Escrow, FY2025+ only] \| Louisiana Education Quality Trust \| Nonmajor \| Total). Units = thousands. | **CRITICAL: LA's GF revenue is ~99% federal Intergovernmental Revenue** — state tax revenue is booked to the Bond Security & Redemption Fund column instead of GF. Must document this prominently in the loader/relabel; do not assume GF = state-source revenue for LA. Hash-based media URLs (`doa.la.gov/media/{hash}/...`) must be re-enumerated from the landing/archive pages at load time — they are not predictable from the FY alone. |
| **OK** | `processILAcfr.js` (simplest GF-statement layout precedent: General Fund \| Other Nonmajor \| Total) | GF is 1st of 4 columns (General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total) — the simplest layout of the 5 Batch-2 states, only 3 small nonmajor permanent funds alongside GF. Units = thousands. | Must special-case the current-year filename (`acfr-{year}.pdf` lowercase-hyphen vs `ACFR{YYYY}.pdf`/`cafr{YYYY}.pdf` historical pattern) each republish. The ~3.35× NASBO scope divergence (largest of the 5) must be documented prominently — OK's GF consolidates nearly all state taxes AND federal passthrough into one fund. |
| **UT** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed) | GF is 1st of 6 columns (General Fund \| Income Tax/Education \| Transportation \| Transportation Investment Fund \| Trust Lands Permanent Fund \| Nonmajor \| Total). Units = thousands. | **CRITICAL: UT's GF is narrower than NASBO's GF (~0.83×), the only state in this tranche where the ACFR figure undershoots NASBO.** Loader must decide (Phase-114 call, not resolved in recon) whether to load GF alone or GF+Income Tax Fund combined — document the constitutional-earmark driver explicitly either way. Also: the 2nd column's label changed from "Education" (FY2019) to "Income Tax" (FY2025) — loader must match by column *position*, not header string, across years. **UT overlap-risk reminder: this state's state-node provenance check + in-place-upgrade plan are plan 112-03's scope (RECON-10) — this SOURCES block only locates the source, it does not resolve the overlap.** |

---

## Oregon (OR) — Detail Block

**Source:** State of Oregon Department of Administrative Services (DAS), Statewide Accounting and Reporting Services (SARS) unit
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.oregon.gov/das/Financial/Acctng/Pages/index.aspx`

**URL pattern (live, confirmed `application/pdf`, no derivable single pattern):**
- FY2025: `https://www.oregon.gov/das/Financial/Acctng/Documents/2025.ACFR.pdf`
- FY2024: `https://www.oregon.gov/das/Financial/Acctng/Documents/2024_ACFR.pdf`
- FY2023: `https://www.oregon.gov/das/Financial/Acctng/Documents/2023ACFR.pdf`
- FY2022: `https://www.oregon.gov/das/Financial/Acctng/Documents/2022%20ACFR.pdf`
- FY2005–FY2021: filenames known from Wayback CDX (`{YYYY}_CAFR.pdf` era) but **404 live** — see gap log (D-06 exclusion)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances (Governmental Funds)
**Column:** General (1st of 6: General | Health and Social Services | Public Transportation | Educational Support | Common School | Other | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $17,291,987K — 6-column sum = $45,971,876K matches printed Total Revenues exactly ✅ (diff $0)
- FY2022: GF Total Revenues = $15,711,953K — 6-column sum = $41,589,472K vs printed $41,589,473K ✅ (diff $1K, acceptable rounding)

**Investment income:** GF column FY2025 = +$411,848K (positive); FY2022 = +$59,464K (positive). No P2 clamp needed for verified years.

**Scope vs NASBO (~1.07×):** OR ACFR GF revenue ($17.29B, FY2025) vs NASBO GF operating ($16.10B, FY2024) — the smallest divergence of the 5 Batch-2 states. Federal revenue inside the GF column itself is small (~$16M); OR's federal flows mostly route through the separate "Health and Social Services" and "Public Transportation" fund columns. **Accept-and-relabel honestly**, low relabel risk.

**Clean window:** FY2022–FY2025 (4 years, all live-durable). Older years (FY2005–FY2021, confirmed to exist historically via Wayback) are 404 on the live site today — excluded per D-06.
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed live-durable; D-12 shallow-window rule applies — Oregon is roster-eligible despite the narrow window).

---

## South Carolina (SC) — Detail Block

**Source:** South Carolina Office of the Comptroller General (CG)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://cg.sc.gov/financial-reports/annual-comprehensive-financial-reports-acfrs`

**URL pattern (live, confirmed `application/pdf`, full FY1993–FY2025 archive; no single derivable pattern):**
- FY2025 (Basic Financial Statements part-file — contains the Rev/Exp/Fund Balances statement): `https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2010%20-%202019)/ACFR%20Current%20Year/039-191-ACFR-FY2025-BasicFinancialStatements.pdf`
- FY2024 (combined single file): `https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-316-ACFR-FY2024.pdf`
- FY2023: `.../001-308-CAFR-FY2023.pdf`
- FY2002 (bookend, boundary year): `https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202002%20CAFR.pdf`
- Full FY1993–FY2025 run enumerable from the landing page (naming conventions shift by era)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — GOVERNMENTAL FUNDS (Exhibit B-2)
**Column:** General Fund (1st of 5: General Fund | Departmental Program Services | Local Government Infrastructure | Dept of Transportation Special Revenue | Nonmajor Governmental | Totals) — FY2002 had a 6th column (State Tobacco Settlement, since folded elsewhere)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $20,731,521K — 5-column sum = $41,234,043K matches printed Total revenues exactly ✅ (diff $0)
- FY2002: GF Total Revenues = $5,763,261K — 6-column sum = $12,537,177K matches printed Total revenues exactly ✅ (diff $0)

**Investment income:** GF column FY2025 "Interest and other investment income" = +$684,860K (positive); FY2002 = +$62,039K (positive). No P2 clamp needed. Note: FY2002 General Fund's **ending fund balance was a deficit** $(139,951)K — a structural/historical fact worth carrying into the loader notes, not a revenue-line P2 clamp concern.

**Scope vs NASBO (~1.46×):** SC ACFR GF revenue ($20.73B, FY2025) vs NASBO GF operating ($14.19B, FY2024). Unlike most other Batch-2 states, the driver is NOT federal passthrough within the GF column (federal revenue in GF is only $46M) — it is more likely a GAAP-vs-budgetary basis difference (SC's GAAP General Fund consolidates broader transfer/interest activity than NASBO's narrower budgetary concept). **Accept-and-relabel honestly**, document the differing driver mechanism explicitly.

**Clean window:** FY1993–FY2025 (33 years, the deepest of the 5 Batch-2 states — full run live on cg.sc.gov).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed live-durable).

---

## Louisiana (LA) — Detail Block

**Source:** Louisiana Division of Administration, Office of Statewide Reporting and Accounting Policy (OSRAP)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing pages:** `https://www.doa.la.gov/doa/osrap/annual-financial-report/` (current 4 years) + `https://doa.la.gov/doa/osrap/archives/` (older years)

**URL pattern (live, confirmed `application/pdf`; hash-based CMS media paths — no derivable pattern, must enumerate):**
- FY2025: `https://doa.la.gov/media/lqvhnfhs/fy25-acfr-final.pdf`
- FY2024: `https://doa.la.gov/media/db0f1bsl/fy2024-acfr-final.pdf`
- FY2023: `https://doa.la.gov/media/epmbw2el/fy2023-acfr-final.pdf`
- FY2022: `https://doa.la.gov/media/ofqdeujb/acfr-2022.pdf`
- FY2021: `https://doa.la.gov/media/bxtnn4d2/fy21-acfr.pdf`
- FY2002 (bookend, boundary year): `https://doa.la.gov/media/fthjchle/cafr02.pdf`
- Archive lists years back to FY1994 (`cafr94.pdf` etc.) — noted in passing, out of this tranche's scope (Phase 115 pre-GASB-34 boundary)

**Statement:** STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS
**Column:** GENERAL FUND (1st of 5 in FY2025: General Fund | Bond Security & Redemption Fund | Capital Outlay Escrow Fund | Louisiana Education Quality Trust Fund | Nonmajor Governmental Funds | Total; FY2002 had 4 columns, no separate Capital Outlay Escrow Fund yet)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $22,780,529K — 5-column sum = $44,863,418K matches printed Total Revenues exactly ✅ (diff $0)
- FY2002: GF Total Revenues = $5,807,699K — 4-column sum = $17,523,434K matches printed Total Revenues exactly ✅ (diff $0)

**Investment income:** GF column "Use of Money & Property" FY2025 = +$50,906K (positive); FY2002 = +$18,822K (positive). No P2 clamp needed for the GF column in verified years. Note: the nonmajor "Louisiana Education Quality Trust Fund" column showed a small negative Use of Money & Property figure in FY2002 (-$13,444K) — not the GF column, so no clamp risk for the GF-only extraction.

**Scope vs NASBO (~1.90×):** LA ACFR GF revenue ($22.78B, FY2025) vs NASBO GF operating ($11.97B, FY2024). **CRITICAL structural finding:** LA's GAAP General Fund is ~99% Intergovernmental (federal) Revenue — $22.48B of the $22.78B GF total is the "INTERGOVERNMENTAL REVENUES" line (Medicaid/federal grant passthrough). Louisiana's own-source state tax revenue (~$14.14B in FY2025) is booked almost entirely to the separate "Bond Security and Redemption Fund" column (2nd column), NOT the General Fund. This is a materially different GF composition than any other Batch-1/Batch-2 state reconned so far — the GF column alone does not represent "the state's discretionary/tax revenue" the way it does for most other states. **Accept-and-relabel honestly, flag prominently in the loader**; whether Phase 114 should load GF alone or GF + Bond Security & Redemption combined is a load-phase decision, not resolved here (per D-03's guidance to flag rather than invent a new pattern).

**Clean window:** FY2002–FY2025 (24 years; hash-based media paths re-enumerable from the two landing pages).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed live-durable).

---

## Oklahoma (OK) — Detail Block

**Source:** State of Oklahoma Office of Management and Enterprise Services (OMES), Central Accounting and Reporting division
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing/archive page:** `https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html`

**URL pattern (live, confirmed `application/pdf`; mostly-derivable):**
- FY2024 (current, breaks the pattern): `https://oklahoma.gov/content/dam/ok/en/omes/documents/acfr-2024.pdf`
- FY2023: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2023.pdf`
- FY2022: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2022.pdf`
- FY2021: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2021.pdf`
- FY2000–FY2020: `https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr{YYYY}.pdf` (e.g. FY2002 bookend = `cafr2002.pdf`)
- FY2025: not yet published as of 2026-07-02

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 4: General | Commissioners of the Land Office | Wildlife Lifetime Licenses | Tobacco Settlement Endowment | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024: GF Total Revenues = $30,604,464K — 4-column sum = $31,259,646K matches printed Total Revenues exactly ✅ (diff $0)
- FY2002: GF Total Revenues = $9,568,595K — 5-column sum (FY2002 also had a small Nonmajor Capital Projects column) = $9,609,878K matches printed Total Revenues exactly ✅ (diff $0)

**Investment income:** GF column "Interest and Investment Revenue" FY2024 = +$459,743K (positive); FY2002 = +$96,796K (positive). No P2 clamp needed for the GF column. Note: the "Commissioners of the Land Office" nonmajor permanent-fund column had negative Interest/Investment Revenue in FY2002 (-$27,167K) — not the GF column, so no clamp risk for GF-only extraction.

**Scope vs NASBO (~3.35×):** OK ACFR GF revenue ($30.60B, FY2024) vs NASBO GF operating ($9.14B, FY2024) — the largest divergence of the 5 Batch-2 states, comparable to MI's ~3.56× (v2.13). OK's GAAP General Fund consolidates nearly all state general-purpose taxes (income, sales, gross production, motor vehicle, fuel, insurance, beverage — combined ~$9.0B) **and** the full Federal Revenue line ($13.78B) into a single fund. **Accept-and-relabel honestly, document prominently.**

**Clean window:** FY2002–FY2024 (22 years, both bookends tie-confirmed to $0 diff).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed live-durable; FY2025 not yet published, which does not block the floor).

---

## Utah (UT) — Detail Block

**Source:** State of Utah Division of Finance (`finance.utah.gov`)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://finance.utah.gov/` (the dedicated ACFR-archive sub-page is Cloudflare-protected against non-browser UAs; direct `wp-content/uploads` PDF links are reachable without a special UA)

**URL pattern (live, confirmed `application/pdf`; no single derivable pattern):**
- FY2025: `https://finance.utah.gov/wp-content/uploads/FY25-ACFR-FINAL-reduced-size.pdf`
- FY2024: `https://finance.utah.gov/wp-content/uploads/FY24-ACFR-Final.pdf`
- FY2023: `https://finance.utah.gov/wp-content/uploads/2023-ACFR.pdf`
- FY2022: `https://finance.utah.gov/wp-content/uploads/2022-ACFR.pdf`
- FY2021: `https://finance.utah.gov/wp-content/uploads/2021-ACFR.pdf`
- FY2020: `https://finance.utah.gov/wp-content/uploads/2020-ACFR.pdf`
- FY2019: `https://finance.utah.gov/wp-content/uploads/2019-ACFR.pdf`
- Pre-FY2019: confirmed to have existed (`{YY}UTCAFR.pdf` naming, FY2006-2016) but 404 live today — see gap log (D-06 exclusion)

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 6: General Fund | Income Tax [FY2025] / Education [FY2019] | Transportation | Transportation Investment Fund | Trust Lands Permanent Fund | Nonmajor Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $11,404,950K — 6-column sum = $24,779,233K matches printed Total Revenues exactly ✅ (diff $0)
- FY2019: GF Total Revenues = $6,509,587K — 6-column sum = $14,316,149K matches printed Total Revenues exactly ✅ (diff $0)

**Investment income:** GF column "Investment Income (Loss)" FY2025 = +$270,301K (positive); FY2019 "Investment Income" = +$43,630K (positive). No P2 clamp needed for verified years, though the "(Loss)" label on the FY2025 column header signals the possibility exists — check older/future years at load.

**Scope vs NASBO (~0.83×) — UNIQUE FINDING:** UT is the **only state in this tranche (and across v2.13's cohort) where the ACFR General Fund is narrower than NASBO's reported GF** ($11.40B ACFR vs $13.67B NASBO FY2024). Driver: Utah's income tax revenue is constitutionally earmarked (Utah Constitution Article XIII, as broadened by the 2020 "Amendment G") and reported in a legally separate major fund — labeled "Education" in FY2019 filings and "Income Tax" in FY2025 filings (same fund, renamed to reflect the broadened earmark, not a data discontinuity). NASBO's state-reported "General Fund" figure appears to combine what Utah's GAAP statements report as two separate funds. **This is flagged as a load-phase decision (per D-03/D-09) — recon does not resolve whether Phase 114 should load GF alone (narrower, GAAP-legal-fund-accurate) or GF+Income Tax Fund combined (broader, closer to the NASBO historical figure).**

**Clean window:** FY2019–FY2025 (7 years, both bookends tie-confirmed to $0 diff). Pre-FY2019 years existed historically but are non-durable (404 live) post-WordPress-migration.
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed live-durable).

**UT overlap-risk flag (D-03, RECON-10 — plan 112-03's scope, NOT resolved here):**
Utah is the named overlap-risk state for this milestone. `scripts/loadStateGF.mjs` (read as static source code, not a DB probe) confirms Utah currently has NASBO-sourced operating rows (FY2023 controlTotalGF $11.682B, FY2024 $13.674B) — i.e., Utah's state node is presently on the standard un-upgraded NASBO path, the same pattern as the other 30 not-yet-upgraded NASBO states. **This document does not probe the live database** — per the plan's explicit instruction, the UT *state-node* provenance check (does the live `treasury.budgets`/`operating_budgets` state-node row set match this NASBO-only expectation, or does it carry an older custom-source artifact that needs an in-place upgrade per the MA v1.8-DLS / CA v1.7 precedent?) and the resulting overlap/upgrade plan are **plan 112-03's job**. Separately and explicitly: Utah's v2.5 **municipal** (city/county) data — loaded from the Transparent Utah BigQuery rollup (`reference_utah_transparency_bigquery`) — is unrelated to the state node, unaffected by this ACFR upgrade, and untouched by both this document and 112-03.
