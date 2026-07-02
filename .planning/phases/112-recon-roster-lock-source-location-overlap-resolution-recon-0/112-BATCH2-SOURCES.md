# 112 — Batch 2 ACFR Source Location (RECON-09, RECON-10 — OR/SC/LA/OK/UT)

**Status:** IN PROGRESS — OR/SC/LA reconned (Task 1); OK/UT pending (Task 2)
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
| **OK** | _pending Task 2_ | | | | | |
| **UT** | _pending Task 2_ | | | | | |

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

---

## Section 3 — Four risk facts per D-08

| Fact | OR | SC | LA | OK | UT |
|------|----|----|----|----|-----|
| **Units** | thousands | thousands | thousands | _pending Task 2_ | _pending Task 2_ |
| **Negative GF line items** | None observed in FY2025 or FY2022 GF column. Investment Income = +$411,848K (FY2025), +$59,464K (FY2022). Low risk. | None observed in FY2025 or FY2002 GF column. Interest and other investment income = +$684,860K (FY2025), +$62,039K (FY2002). Low risk. Note: FY2002 General Fund ENDING fund balance was a deficit $(139,951)K — a structural fact, not a revenue-line P2 clamp issue. | None observed in FY2025 or FY2002 GF column. Use of Money and Property (GF) = +$50,906K (FY2025), +$18,822K (FY2002). Low risk. Note: the nonmajor "Louisiana Education Quality Trust Fund" column showed a negative Use of Money & Property in FY2002 (-$13,444K) — not the GF column. | _pending Task 2_ | _pending Task 2_ |
| **Exact column header + statement** | "General", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) | "General Fund", *Statement of Revenues, Expenditures, and Changes in Fund Balances — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) | "GENERAL FUND", *STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) | _pending Task 2_ | _pending Task 2_ |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | _pending Task 2_ | _pending Task 2_ |

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
| **OK** | _pending Task 2_ | | | | |
| **UT** | _pending Task 2_ | | | | |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **OR** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`2023ACFR.pdf` live, confirmed `application/pdf`) | ✅ (`2024_ACFR.pdf` live, confirmed `application/pdf`) | **GREENLIGHT** — recency floor satisfied despite the shallow FY2022–FY2025 window (D-12: no minimum depth beyond the floor). |
| **SC** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`001-308-CAFR-FY2023.pdf` live) | ✅ (`001-316-ACFR-FY2024.pdf` live) | **GREENLIGHT** — recency floor satisfied. Full FY1993–FY2025 window also available (deepest of the 5 Batch-2 states). |
| **LA** | FY2025 (final audited, FY-end Jun 30 2025) | ✅ (`fy2023-acfr-final.pdf` live) | ✅ (`fy2024-acfr-final.pdf` live) | **GREENLIGHT** — recency floor satisfied. FY2002–FY2025 window (23 years) available via archive enumeration. |
| **OK** | _pending Task 2_ | | | |
| **UT** | _pending Task 2_ | | | |

---

## Section 6 — Consolidated gap log

| State | FY / Period | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **OR** | FY2005–FY2019 | Filenames confirmed via Wayback CDX (`{YYYY}_CAFR.pdf` / `{YYYY}%20CAFR.pdf` naming), but ALL return live 404 on `oregon.gov` today — removed from the current DAS/SARS document library (retention/cleanup, not a soft-404: 404 status + `text/html` content-type, correctly distinguished from a real PDF). | **Excluded per D-06 (non-durable)** — these years are only reachable via Wayback snapshots, not a stable re-fetchable URL. Logged, not loaded. Does not affect roster eligibility (D-12 shallow-window rule; recency floor already satisfied). |
| **OR** | FY2020–FY2021 | Tested 8 filename-naming permutations (`{YYYY}_ACFR.pdf`, `{YYYY}%20ACFR.pdf`, `{YYYY}_CAFR.pdf`, `{YYYY}%20CAFR.pdf`, `{YYYY}ACFR.pdf`) at the same `Documents/` path — all 404. Not found in Wayback CDX enumeration either (likely a genuine gap in Oregon's published archive, or a naming pattern not yet discovered within the D-11 budget). | Gap-logged; budget-stopped per D-11. FY2022–FY2025 clean window still satisfies the recency floor — this gap does not block roster eligibility. |
| **SC** | FY2019 naming variant | Two live URLs exist for the same year: `001 - 302 - CAFR - FY 2019.pdf` (spaced) and implicitly referenced via older-era filenames on the same page. | Not a gap — confirmed durable; SOURCES enumeration at load time must pick the canonical spaced-filename variant. |
| **SC** | FY2025 statement location | The FY2025 ACFR is split into 9 separate part-PDFs (Introductory/Transmittal/MDandA/IndependentAuditorsReport/BasicFinancialStatements/RSI/SupplementaryInformation/StatisticalSection) rather than one combined file (unlike FY2019–FY2024 which are single combined PDFs). | Not a gap — confirmed durable, all 9 parts return `application/pdf`. Loader must target `039-191-ACFR-FY2025-BasicFinancialStatements.pdf` specifically for the Rev/Exp/Fund-Balances statement, not a full-ACFR file. |
| **LA** | Pre-FY2002 | LA's `doa.la.gov/doa/osrap/archives/` page lists `cafr97.pdf`, `cafr94.pdf`, `cafr95.pdf`, `cafr96.pdf`, `cafr98d.pdf`, `cafr01.pdf` — i.e. years older than FY2002 ARE present on the live archive. | **Not tie-confirmed here per D-05 (bookend = oldest + latest only) and out of scope per the FY2002 pre-GASB-34 boundary** (Phase 115 territory). Noted in passing per the `<deferred>` guidance — not a 112 gap-log failure. |
| **OK** | _pending Task 2_ | | |
| **UT** | _pending Task 2_ | | |

---

## Section 7 — Loader template mapping + Phase-114 load notes

| State | Closest loader template | GF layout notes | Phase-114 load notes |
|-------|------------------------|----------------|----------------------|
| **OR** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed — no derivable pattern) | GF is 1st of 6 columns (General \| Health and Social Services \| Public Transportation \| Educational Support \| Common School \| Other \| Total). Units = thousands. Multi-fund layout similar to NC/CT. | Must enumerate per-year URLs (naming varies: dot/underscore/no-separator/space across FY2022–FY2025). Only a 4-year live window (FY2022–FY2025) — inherits from the state's current retention practice, not a recon gap. Modest ~1.07× NASBO scope divergence is the smallest of the 5 Batch-2 states — low relabel risk. |
| **SC** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed) | GF is 1st of 5 columns (General Fund \| Program Services \| Infrastructure \| DOT Special Revenue \| Nonmajor \| Total). Units = thousands. | **CRITICAL: FY2025 requires targeting the specific `BasicFinancialStatements` part-PDF**, not the combined ACFR (which doesn't exist as one file for FY2025). FY2019–FY2024 are single combined-PDF files — simpler. Full FY1993–FY2025 window available; recommend loading a deeper window than the FY2002 boundary here since SC's full run is live-durable back to 1993 (subject to Phase 115 pre-GASB-34 boundary at FY2002 for this tranche). |
| **LA** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map needed — hash-based CMS paths) | GF is 1st of 4-5 columns (General \| Bond Security & Redemption \| [Capital Outlay Escrow, FY2025+ only] \| Louisiana Education Quality Trust \| Nonmajor \| Total). Units = thousands. | **CRITICAL: LA's GF revenue is ~99% federal Intergovernmental Revenue** — state tax revenue is booked to the Bond Security & Redemption Fund column instead of GF. Must document this prominently in the loader/relabel; do not assume GF = state-source revenue for LA. Hash-based media URLs (`doa.la.gov/media/{hash}/...`) must be re-enumerated from the landing/archive pages at load time — they are not predictable from the FY alone. |
| **OK** | _pending Task 2_ | | |
| **UT** | _pending Task 2_ | | |

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

_pending Task 2_

---

## Utah (UT) — Detail Block

_pending Task 2_
