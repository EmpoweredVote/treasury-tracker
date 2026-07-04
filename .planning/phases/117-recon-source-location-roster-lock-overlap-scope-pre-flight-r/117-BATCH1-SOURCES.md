# 117-01 — Batch 1 ACFR Source Location (RECON-11, AK/AR/DE/HI/ID)

**Status:** COMPLETE — all 5 states triaged (D-03: all RECON), reconned, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**States:** Alaska (AK), Arkansas (AR), Delaware (DE), Hawaii (HI), Idaho (ID)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 98-RECON.md shape (bookend, four risk facts, scope-vs-NASBO, gap log, loader mapping).

All five states pass the D-03 triage and publish the Governmental Funds *Statement of Revenues, Expenditures, and
Changes in Fund Balances* — **General Fund** column (GAAP basis). All five report in thousands (except Idaho, whose
units are MIXED — a genuine new risk finding, see Section 3/6). All five have FY-end June 30. All five pass the D-07
recency floor (FY2023 + FY2024 in a clean window). Scope-vs-NASBO ranges from Hawaii's narrower ~0.95× (UT-style,
Med-Quest/Medicaid reported separately) to Arkansas's **~3.96× — the widest scope divergence found in the entire
ACFR cohort to date** (a true single-fund state with no major/nonmajor fund split). One honest hole (Arkansas FY2025,
garbled Type-3-font PDF) and one historical gap (Hawaii FY2000-2004, scanned image-only PDFs) are gap-logged; neither
threatens the D-07 recency floor. Zero Batch-1 states triage to a stay-NASBO-exception disposition.

---

## Section 0 — D-03 Triage (does a GAAP Governmental Funds ACFR with a splittable GF column exist?)

| State | GAAP Gov-Funds ACFR exists? | Splittable GF column? | Basis if not GAAP | Triage verdict |
|-------|------------------------------|------------------------|--------------------|-----------------|
| **AK** | Yes — Alaska DOF publishes a full ACFR back to FY1998 (`doa.alaska.gov/dof/reports/annualreport.html`) | Yes — Governmental Funds Statement of Rev/Exp/Changes has a distinct "General Fund" column (1 of 3: General Fund \| Alaska Permanent Fund \| Nonmajor Funds \| Total) | N/A | **RECON** |
| **AR** | Yes — Arkansas DFA publishes a full ACFR/CAFR back to FY2003 (`dfa.arkansas.gov`) | Yes, but Arkansas has only ONE governmental fund — the statement has a single "General Fund" column (no separate major/nonmajor funds) | N/A | **RECON** |
| **DE** | Yes — Delaware Office of Accounting publishes a full ACFR back to FY2004+ (`accounting.delaware.gov`) | Yes — distinct "General" column (1 of 4: General \| Federal \| Local School Districts \| Capital Projects \| Total) | N/A | **RECON** |
| **HI** | Yes — Hawaii DAGS publishes a full ACFR back to FY2000 (`ags.hawaii.gov/accounting/annual-financial-reports/`) | Yes — distinct "General Fund" column (of up to 8 columns depending on year) | N/A | **RECON** |
| **ID** | Yes — Idaho State Controller's Office (SCO) publishes a full ACFR/CAFR back to FY2004+ (`sco.idaho.gov`, PDFs at `CAFRDocuments/`) | Yes — distinct "General" column (of 3-4: General \| Health and Welfare \| Transportation \| [Public School Endowment]) | N/A | **RECON** |

**Triage summary: all 5 Batch-1 states pass triage — 0 stay-NASBO-exception candidates in this batch.** All five publish a GAAP Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances with a splittable General Fund column. Full recon proceeds for all 5 in Tasks 1-2.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end month | Durable clean window | Per-year URL pattern |
|-------|-------------------|-------------------|-------|---------------|------------------------|------------------------|
| **AK** | Statement 1.13 — Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds (printed page 27) | **General Fund** (1st of 4: General Fund \| Alaska Permanent Fund \| Nonmajor Funds \| Total Governmental Funds) | Thousands | June 30 | **FY1998–FY2025** (28 years; FY2020 and FY2025 bookend-tied) | `https://doa.alaska.gov/dof/reports/resource/{YYYY}acfr.pdf` (FY2020–FY2025); `{YYYY}cafr.pdf` for FY1998–FY2019 (naming exception — "cafr" not "acfr"). Landing: `https://doa.alaska.gov/dof/reports/annualreport.html` |
| **AR** | Statement of Revenues, Expenditures, and Changes in Fund Balance(s), Governmental Fund(s) (printed page ~20-21) | **General Fund** — Arkansas has only ONE governmental fund; the statement has a single unlabeled-column General Fund total (no separate major/nonmajor funds to split) | Thousands | June 30 | **FY2003–FY2024** (22 years; FY2003 and FY2024 bookend-tied). **FY2025 (`2025-Arkansas-ACFR.pdf`) is garbled — Type 3 custom fonts, no ToUnicode CMap, pdftotext produces unreadable output (KY FY2023 precedent)** — gap-logged. | `https://www.dfa.arkansas.gov/wp-content/uploads/cafr{YYYY}.pdf` for FY2003–FY2024. **FY2025 exception: `2025-Arkansas-ACFR.pdf` (different naming AND garbled — do not use).** Landing: `https://www.dfa.arkansas.gov/office/accounting/annual-comprehensive-financial-report/` |
| **DE** | Statement of Revenues, Expenditures and Changes in Fund Balances (Deficits), Governmental Funds (printed page ~25 in FY2025) | **General** (1st of 5: General \| Federal \| Local School Districts \| Capital Projects \| Total Governmental Funds) | Thousands | June 30 | **FY2004–FY2025** (22 years; FY2004 and FY2025 bookend-tied) | `https://accountingfiles.delaware.gov/docs/{YYYY}acfr.pdf` for FY2021–FY2025; `{YYYY}cafr.pdf` for FY2004–FY2020 (naming exception, FY2005/2007/2008/2010/2011/2013 not published/found in the archive index — spot-check at load). **CRITICAL: `accountingfiles.delaware.gov` WAF rejects requests without a `Referer` header pointing at `accounting.delaware.gov` — returns a 245-byte "Request Rejected" HTML soft-404 (HTTP 200) that looks like success. Must set `Referer` header or requests silently fail (soft-404 caution, 98-RECON precedent).** Landing: `https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/` (+ `/archived-annual-comprehensive-financial-reports/`) |
| **HI** | Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds (printed page ~35 in FY2025) | **General Fund** (1st column; column count grows over time — 3 columns in FY2005 [General \| Capital Projects \| Other Governmental \| Total], 7 columns by FY2025 [General \| Capital Projects \| Med-Quest Special Revenue \| Administrative Support Special Revenue \| Natural Resources Special Revenue \| Hawaiian Programs Special Revenue \| Other Governmental \| Total]) | Thousands | June 30 | **FY2005–FY2025** (21 years; FY2005 and FY2025 bookend-tied). **FY2000–FY2004 are scanned image-only PDFs with NO extractable text layer (`pdffonts` returns zero fonts) — gap-logged.** | `https://ags.hawaii.gov/wp-content/uploads/{upload-year-path}/acfr{YYYY}.pdf` — folder path is the WordPress upload date, NOT derivable from fiscal year alone (e.g. FY2025 → `2026/02/acfr2025.pdf`, FY2000–FY2016 → `2012/09/acfr{YYYY}.pdf`). Each year's exact folder must be read off the archive page — **not a clean per-year pattern**. Landing: `https://ags.hawaii.gov/accounting/annual-financial-reports/` |
| **ID** | Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds (printed page ~24-25) | **General** (1st of 3-4: General \| Health and Welfare \| Transportation \| [Public School Endowment, some years]) | **Mixed — whole dollars pre-transition (confirmed FY2004), thousands post-transition (confirmed FY2015+). Exact transition year NOT pinned within the D-04 budget — loader MUST verify per-year units before scaling (non-derivable, high-risk trap).** | June 30 | **FY2004–FY2025** (22 years; FY2004 and FY2025 bookend-tied; FY2023 spot-checked clean) | `https://www.sco.idaho.gov/CAFRDocuments/{YYYY}%20Annual%20Comprehensive%20Financial%20Report.pdf` for FY2024–FY2025; `{YYYY}%20Comprehensive%20Annual%20Financial%20Report.pdf` for FY2004–FY2020; `{YYYY}%20Annual%20Comprehensive%20Financial%20Review.pdf` for FY2021–FY2023 (**"Review" not "Report" — 3-way naming exception, confirm exact term per year**). Landing: `https://www.sco.idaho.gov/LivePages/acfr-financial-report-archive.aspx` (JS-rendered on the live site as of this recon — used Wayback Machine snapshot `20260513095742` to enumerate the per-year filenames, then confirmed each live) |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|---------------------|-----------|
| **AK** | FY2025 (latest) | **$8,378,945K** | GF line items sum (Taxes 1,600,605 + Licenses/Permits 145,208 + Charges 182,882 + Fines 59,341 + Rents/Royalties 1,059,348 + Premiums 38,327 + Investment Income 350,330 + Federal Grants 4,833,918 + Component Unit Payments 51,038 + Other 57,948) = $8,378,945K; matches printed Total Revenues. Diff = $0. ✅ |
| **AK** | FY2020 (oldest bookend) | **$6,063,851K** | GF line items sum = $6,063,851K; matches printed Total Revenues. Diff = $0. ✅ |
| **AR** | FY2024 (latest clean) | **$24,045,611K** | GF line items sum (Personal/corp income 3,521,101 + Consumer sales 4,639,049 + Gas/motor carrier 506,911 + Other taxes 1,628,312 + Intergovernmental 11,221,223 + Licenses/permits/fees 1,516,933 + Investment earnings 442,735 + Miscellaneous 569,347) = $24,045,611K; matches printed Total Revenues. Diff = $0. ✅ |
| **AR** | FY2003 (oldest bookend) | **$9,434,421K** | GF line items sum = $9,434,421K; matches printed Total revenues. Diff = $0. ✅ |
| **DE** | FY2025 (latest) | **$7,475,243K** | GF line items sum (Personal Taxes 2,372,854 + Business Taxes 3,938,979 + Other Tax Revenue 111 + Licenses/Fees/Permits/Fines 523,113 + Rentals/Sales 94,377 + Grants 30,410 + Interest/Investment Income 238,663 + Other 276,736) = $7,475,243K; matches printed Total Revenues. Diff = $0. ✅ |
| **DE** | FY2004 (oldest bookend) | **$3,055,310K** | GF line items sum (Personal taxes 782,369 + Business taxes 1,359,569 + Other tax revenue 240,939 + Licenses/fees/permits/fines 295,379 + Rentals/sales 22,347 + Federal government 70,735 + Interest/investment income 30,713 + Other 253,259) = $3,055,310K; matches printed TOTAL REVENUES. Diff = $0. ✅ |
| **HI** | FY2025 (latest) | **$10,607,306K** | GF line items sum (Total taxes 9,964,105 + Interest/dividend income 167,213 + Net increase in fair value of investments 12,735 + Charges for current services 263,131 + Intergovernmental 11,743 + Rentals 77 + Fines/forfeitures/penalties 13,704 + Licenses/fees 847 + Revenues from private sources 13,805 + Other 159,946) = $10,607,306K; matches printed Total revenues. Diff = $0. ✅ |
| **HI** | FY2005 (oldest bookend) | **$4,198,123K** | GF line items sum (Total Taxes 4,018,536 + Interest/investment income 25,170 + Charges for current services 69,215 + Intergovernmental 10,729 + Rentals 5,852 + Fines/forfeitures/penalties 21,316 + Licenses/fees 1,209 + Revenues from private sources 3,274 + Other 42,822) = $4,198,123K; matches printed Total Revenues. Diff = $0. ✅ |
| **ID** | FY2025 (latest) | **$6,658,024K** (thousands) | GF line items sum (Sales Tax 3,032,148 + Individual/Corp Taxes 3,189,337 + Other Taxes 56,224 + Licenses/Permits/Fees 52,900 + Sale of Goods/Services 47,176 + Grants/Contributions 22,668 + Investment Income 200,696 + Tobacco Settlement 19,246 + Other Income 37,629) = $6,658,024K; matches printed Total Revenues. Diff = $0. ✅ |
| **ID** | FY2004 (oldest bookend) | **$2,314,491,978** (**whole dollars, NOT thousands** — see risk facts) | GF line items sum (Sales Tax 1,035,648,340 + Individual/Corp Taxes 997,453,573 + Other Taxes 62,735,096 + Licenses/Permits/Fees 29,846,320 + Sale of Goods/Services 69,043,410 + Grants/Contributions 58,221,332 + Investment Income 13,190,646 + Tobacco Settlement 22,848,142 + Other Income 25,505,119) = $2,314,491,978; matches printed Total Revenues. Diff = $0. ✅ |

---

## Section 3 — Four risk facts per D-08

| Fact | AK | AR | DE | HI | ID |
|------|----|----|----|----|-----|
| **Units** | Thousands | Thousands | Thousands | Thousands | **MIXED — whole dollars confirmed FY2004, thousands confirmed FY2015+. Exact transition year not pinned within D-04 budget (between FY2004 and FY2015). Loader MUST detect/verify units per-year (check statement header for "(dollars in thousands)" note) before scaling — a purely derived pattern would silently misscale by 1000x for the wrong years.** |
| **Negative GF line items** | None observed: FY2025 Interest and Investment Income (Loss) = +$350,330K; FY2020 = +$273,988K. Both positive. Low risk (bookend years only — check interior years at load). | None observed: FY2024 Investment earnings (loss) = +$442,735K; FY2003 Investment earnings = +$46,139K. Both positive. Low risk. | None observed: FY2025 Interest/Investment Income = +$238,663K; FY2004 = +$30,713K. Both positive. Low risk. | None observed: FY2025 Net increase in fair value of investments = +$12,735K (small but positive); FY2005 Interest and investment income = +$25,170K (positive). Both years positive; check interior years (2008-crash-era FY2009 is a plausible negative-year candidate) at load. | None observed: FY2025 Investment Income (Loss) = +$200,696K; FY2004 Investment Income = +$13,190,646 (positive). Note the line is explicitly labeled "(Loss)" in FY2025 — a negative year is plausible in the interior window; check at load (P2 clamp ready). |
| **Exact column header + statement** | "General Fund", Statement 1.13 — Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT the government-wide Statement of Activities, NOT the Budgetary Comparison Schedule) | "General Fund" (single-fund state — the whole statement IS the General Fund), *Statement of Revenues, Expenditures, and Changes in Fund Balance(s)*, Governmental Fund(s) (NOT Statement of Activities) | "General" (1st of 5 columns), Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances (Deficits)* (NOT Statement of Activities) | "General Fund" (1st column), Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT the Budgetary Comparison Schedule — General Fund) | "General" (1st column), *Statement of Revenues, Expenditures, and Changes in Fund Balances*, Governmental Funds (NOT Statement of Activities) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ |

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function, FY2024 actual from `loadStateGF.mjs`). ACFR figures are **revenue** totals (latest cleanly-tied FY). The comparison is apples-to-oranges by design — the point is to flag whether the ACFR GF's revenue base is materially broader/narrower than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------------|------------------------------|-------|--------|-----------------|
| **AK** | $8,378,945K (FY2025) | $6,339,000K | **~1.32×** | GAAP General Fund consolidates Federal Grants in Aid ($4.83B) that NASBO's narrower budgetary GF concept treats differently across years. Modest-to-moderate divergence, same mechanism as NJ/MA. | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-118 load. |
| **AR** | $24,045,611K (FY2024) | $6,075,000K | **~3.96×** | **Widest divergence found across the whole ACFR cohort to date** (wider than TX's ~3×). Driver: Arkansas presents ALL of its governmental funds activity under a single "General Fund" — there is no separate major/nonmajor fund structure to exclude. GAAP GF revenue includes ~$11.2B of Intergovernmental (federal) revenue that NASBO's narrower operating definition excludes almost entirely. | **Accept-and-relabel honestly, flag as the tranche's most extreme scope divergence** (wider than TX). Confirm at Phase-118 load; consider a prominent basis note given the magnitude. |
| **DE** | $7,475,243K (FY2025) | $6,232,000K | **~1.20×** | Modest divergence — smallest of the batch. Driver: Delaware's ACFR splits Federal grants into their OWN "Federal" major-fund column (separate from General), so the GF column stays closer to NASBO's own-source-revenue-centric definition. Similar mechanism to NJ (~1.15×). | **Accept-and-relabel honestly** (TX precedent, modest case). Confirm at Phase-118 load. |
| **HI** | $10,607,306K (FY2025) | $11,222,000K | **~0.95×** | **Narrower than NASBO** — the batch's one UT/AL-style narrower case. Driver: Hawaii's GAAP General Fund EXCLUDES the Med-Quest (Medicaid) Special Revenue Fund ($2.45B in FY2025), which is a separate major-fund column. NASBO's broader "General Fund" operating concept apparently folds Medicaid spending in, making NASBO's figure larger than the GAAP GF-alone revenue total. | **GF-alone scope decision required at load** (UT precedent) — load the printed General Fund column alone, honestly relabelled as narrower than NASBO's concept, OR consider whether a GF+Med-Quest composite is more appropriate (load-time call, not resolved in recon). |
| **ID** | $6,658,024K (FY2025, thousands) | $5,020,000K | **~1.33×** | Moderate divergence, similar magnitude to AK. Driver: ID's GF column consolidates Grants and Contributions revenue ($22.7M, relatively small) plus broader own-source tax collections; the Health and Welfare fund (which carries most Medicaid federal match, $4.36B in FY2025) is reported SEPARATELY from General — so this ratio is driven more by ID's broader own-source tax base within GF than by federal consolidation. | **Accept-and-relabel honestly** (TX precedent, moderate case). Confirm at Phase-118 load; also confirm the FY2004-vs-FY2015+ units transition before trusting any interior-year ratio. |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|---------------------------|--------------------|--------------------|---------|
| **AK** | FY2025 (final audited, Dec 2025) | ✅ (`2023acfr.pdf`) | ✅ (`2024acfr.pdf`) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **AR** | FY2024 is the latest CLEANLY EXTRACTABLE year (`cafr2024.pdf`); FY2025 exists but is garbled (gap-logged) | ✅ (`cafr2023.pdf`, confirmed extracts cleanly) | ✅ (`cafr2024.pdf`, bookend-tied) | **GREENLIGHT** — recency floor satisfied at FY2024 (latest clean year). FY2025 gap-logged as a load-phase decision (re-check for a corrected upload, or accept honest 1-year-behind window). |
| **DE** | FY2025 (final audited, ~Dec 2025) | ✅ (`2023acfr.pdf`) | ✅ (`2024acfr.pdf`) | **GREENLIGHT** — recency floor satisfied. Loader must use the `Referer` header workaround (soft-404 WAF, Section 1). |
| **HI** | FY2025 (final audited, ~Feb 2026 upload) | ✅ (`acfr2023.pdf`) | ✅ (`acfr2024.pdf`) | **GREENLIGHT** — recency floor satisfied. Load-time GF-alone-vs-NASBO decision required (~0.95× narrower, Section 4). |
| **ID** | FY2025 (final audited) | ✅ (`2023 Annual Comprehensive Financial Review.pdf` — confirmed live, 200 OK) | ✅ (`2024 Annual Comprehensive Financial Report.pdf` — confirmed live, bookend-tied) | **GREENLIGHT** — recency floor satisfied. Naming exception confirmed live for FY2021–2023 ("Review" not "Report"). |

---

## Section 6 — Consolidated gap log

| State | FY | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **AK** | Pre-FY1998 | Not published on the DOF reports page (page states "back to Fiscal Year 1998"). | Out of scope — FY1998–FY2025 (28-year window) already exceeds the D-07 recency floor by a wide margin. Not a load blocker. |
| **AR** | FY2025 | `2025-Arkansas-ACFR.pdf` downloads as a real, correctly-sized PDF (49MB) but uses Type 3 custom fonts with no ToUnicode CMap (`pdffonts` confirms) — `pdftotext` output is unreadable garbage, same failure mode as the KY FY2023 precedent (Phase 114). | **Honest hole** — do not load FY2025 from this file. Load phase should re-check for a corrected/re-uploaded PDF, or a browser-rendered OCR fallback (ca-acfr-reconciliation.md precedent), before accepting a 1-year-behind window (FY2024 latest). |
| **DE** | Pre-FY2004 | Archive page (`archived-annual-comprehensive-financial-reports/`) lists back to `2004cafr.pdf` only; no earlier years discoverable. | Low priority — FY2004–FY2025 (22-year window) far exceeds the recency floor. Not a load blocker. |
| **DE** | (naming/access) | `accountingfiles.delaware.gov` returns a soft-404 WAF rejection (245-byte HTML, HTTP 200) for requests lacking a `Referer` header — NOT a missing-year gap, but a loader-implementation requirement. | Loader MUST set `Referer: https://accounting.delaware.gov/...` on every request to `accountingfiles.delaware.gov`. Documented in Section 1 + DE detail block. |
| **HI** | FY2000–FY2004 | PDFs download successfully (real, correctly-sized files) but are scanned images with NO extractable text layer whatsoever (`pdffonts` returns zero embedded fonts — more severe than the KY FY2023 no-ToUnicode-CMap case, since there is no text at all, only images). | **Honest hole** — not loadable without a full-document OCR pass (out of scope for `pdftotext`-only recon per the milestone's $0/no-AI constraint). FY2005–FY2025 (21-year window) far exceeds the recency floor; not a load blocker. |
| **ID** | (units risk, not a missing-year gap) | Units switch from whole dollars (confirmed FY2004) to thousands (confirmed FY2015) at an UNDETERMINED year in between — not pinned within the D-04 ~15-20 min/state budget. | Load phase MUST check each year's statement header for a "(dollars in thousands)" note (or equivalently, sanity-check the magnitude of Total Revenues) before trusting any given year's scale — do NOT assume a single units constant across the full FY2004–FY2025 window. |

---

## Section 7 — Loader template mapping + Phase-118 load notes

| State | Closest loader template | GF layout notes | Phase-118 load notes |
|-------|---------------------------|--------------------|-------------------------|
| **AK** | `processMDAcfr.js` / `processNJAcfr.js` (multi-column GF-first-of-N layout, `extract_gf.py` + `gen_state.py` position-anchor) | GF is 1st of 4 columns (General Fund \| Alaska Permanent Fund \| Nonmajor Funds \| Total). Clean `-table` extraction across the whole 28-year window (spot-checked FY2020/FY2025). Units = thousands throughout. | Naming exception: FY2020–2025 use `{YYYY}acfr.pdf`; FY1998–2019 use `{YYYY}cafr.pdf`. `gen_state.py` SOURCES map must special-case the "cafr"→"acfr" naming switch (mirrors the MA FY2017 precedent). |
| **AR** | Simplest layout in the cohort — closer to a **single-column pass-through** than any existing multi-fund template; `extract_gf.py`'s generic line-item parser applies directly with no position-anchor needed (GF is the ONLY fund) | GF is the sole governmental fund — the entire Statement of Revenues, Expenditures, and Changes in Fund Balance is the General Fund (no multi-column split required, no "1st of N" logic). | **CRITICAL: FY2025 (`2025-Arkansas-ACFR.pdf`) is garbled (gap-logged) — load window is FY2003–FY2024 (22 years) until a clean FY2025 source is found.** SOURCES map: `cafr{YYYY}.pdf` FY2003–2024. |
| **DE** | `processNJAcfr.js` / `processMDAcfr.js` (multi-column GF-first-of-N, position-anchor) | GF is 1st of 5 columns (General \| Federal \| Local School Districts \| Capital Projects \| Total). Federal grants live in their own column (not consolidated into GF) — explains DE's modest ~1.20× NASBO ratio. | **CRITICAL: loader must send a `Referer: https://accounting.delaware.gov/...` header on every `accountingfiles.delaware.gov` request** — omitting it returns a soft-404 (HTTP 200 + tiny "Request Rejected" HTML) that a naive Content-Type-only filter could still catch (not `application/pdf`) but a size-only filter (>1MB) would also correctly reject (245 bytes). Confirm both filters are active. Naming exception: `{YYYY}acfr.pdf` for FY2021–2025, `{YYYY}cafr.pdf` for FY2004–2020. |
| **HI** | `processMDAcfr.js` / `processLAAcfr.js` (multi-column GF-first-of-N, position-anchor tolerant of column-count growth over time) | GF is always the 1st column, but the TOTAL COLUMN COUNT grows from 4 (FY2005: General \| Capital Projects \| Other Governmental \| Total) to 8 (FY2025: General \| Capital Projects \| Med-Quest \| Administrative Support \| Natural Resources \| Hawaiian Programs \| Other Governmental \| Total) as new special revenue funds are broken out over the years — `extract_gf.py`'s position-anchor (1st data column after row label) handles this without per-year column-count configuration. | Per-year URL folder path is NOT derivable from FY alone (WordPress upload-date path) — SOURCES map must enumerate each year's exact URL from the archive page (`ags.hawaii.gov/accounting/annual-financial-reports/`), similar to the NC precedent (Phase 107). GF-alone-vs-NASBO decision (~0.95× narrower) is a load-time call. |
| **ID** | `gen_state.py` with a custom units-detection step (no existing precedent state has a units transition mid-window) — closest structural analog is `processMOAcfr.js` (multi-column GF-first-of-N with named non-major columns) | GF is 1st of 3-4 named columns (General \| Health and Welfare \| Transportation \| [Public School Endowment]). **NEW REQUIREMENT for this state: `gen_state.py`/`extract_gf.py` must support a per-year units override** (dollars vs thousands) since a single fiscal_year_start_month-style config constant is insufficient — reusable generalization for any future state with a similar units transition. | 3-way filename-naming exception across the window: `{YYYY} Annual Comprehensive Financial Report.pdf` (FY2024–2025), `{YYYY} Annual Comprehensive Financial Review.pdf` (FY2021–2023, note "Review"), `{YYYY} Comprehensive Annual Financial Report.pdf` (FY2004–2020, old GASB-pre-2021 naming order). SOURCES map must enumerate the correct term per year. **Units transition year must be pinned before load** (Section 6 gap log). |

---

## Nodes remaining NASBO-served after this batch (feeds Phase 123 NASBORT-01)

None from this batch — all 5 Batch-1 states (AK, AR, DE, HI, ID) pass D-03 triage and are RECON-verdict, load-eligible candidates for Phase 118.

---

## AK — Alaska Detail Block

**Source:** Alaska Department of Administration, Division of Finance (DOF)
**PDF:** Annual Comprehensive Financial Report (ACFR) — full report
**Landing page:** `https://doa.alaska.gov/dof/reports/annualreport.html`

**URL pattern:**
- FY2020–FY2025: `https://doa.alaska.gov/dof/reports/resource/{YYYY}acfr.pdf`
- FY1998–FY2019: `https://doa.alaska.gov/dof/reports/resource/{YYYY}cafr.pdf` (naming exception — "cafr" not "acfr")

**Statement:** Statement 1.13 — Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds
**Column:** General Fund (1st of 4: General Fund | Alaska Permanent Fund | Nonmajor Funds | Total Governmental Funds)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $8,378,945K — line items sum = $8,378,945K ✅ (diff $0)
- FY2020: GF Total Revenues = $6,063,851K — line items sum = $6,063,851K ✅ (diff $0)

**Investment income:** FY2025 Interest and Investment Income (Loss) = +$350,330K (positive); FY2020 = +$273,988K (positive). No P2 clamp needed for confirmed years; check interior years at load.

**Clean window:** FY1998–FY2025 (28 years; FY2020 + FY2025 bookend-tied at `-table` extraction quality)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~1.32× (FY2025 ACFR $8.38B vs FY2024 NASBO $6.34B) — accept-and-relabel recommended.

---

## AR — Arkansas Detail Block

**Source:** Arkansas Department of Finance and Administration (DFA), Office of Accounting
**PDF:** Comprehensive/Annual Comprehensive Financial Report (CAFR/ACFR)
**Landing page:** `https://www.dfa.arkansas.gov/office/accounting/annual-comprehensive-financial-report/`

**URL pattern:**
- FY2003–FY2024: `https://www.dfa.arkansas.gov/wp-content/uploads/cafr{YYYY}.pdf`
- FY2025: `https://www.dfa.arkansas.gov/wp-content/uploads/2025-Arkansas-ACFR.pdf` — **downloads as a valid 49MB PDF but is GARBLED (Type 3 custom fonts, no ToUnicode CMap; `pdftotext` output unreadable). Do not use for extraction — gap-logged.**

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balance(s), Governmental Fund(s)
**Column:** General Fund — **Arkansas has only ONE governmental fund; the entire statement is a single "General Fund" column** (no major/nonmajor fund split to navigate — the simplest layout in the whole 34-state ACFR cohort to date).
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024 (latest clean): GF Total Revenues = $24,045,611K — line items sum = $24,045,611K ✅ (diff $0)
- FY2003 (oldest bookend): GF Total revenues = $9,434,421K — line items sum = $9,434,421K ✅ (diff $0)

**Investment income:** FY2024 Investment earnings (loss) = +$442,735K (positive); FY2003 Investment earnings = +$46,139K (positive). No P2 clamp needed for confirmed years.

**Clean window:** FY2003–FY2024 (22 years; FY2025 gap-logged as garbled)
**Recency floor:** GREENLIGHT at FY2024 (latest clean year covers both FY2023 and FY2024)
**Scope vs NASBO:** ~3.96× (FY2024 ACFR $24.05B vs FY2024 NASBO $6.08B) — **the widest scope divergence found in the entire ACFR cohort to date (wider than TX's ~3×)**, driven by Arkansas consolidating essentially all governmental activity (including ~$11.2B Intergovernmental/federal revenue) into its single reported "General Fund." Accept-and-relabel recommended, with a prominent basis note given the magnitude.

---

## DE — Delaware Detail Block

**Source:** Delaware Office of Accounting (part of the Department of Finance)
**PDF:** Annual Comprehensive Financial Report (ACFR) / Comprehensive Annual Financial Report (CAFR)
**Landing page:** `https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/` (+ `/archived-annual-comprehensive-financial-reports/` for older years)
**File host:** `accountingfiles.delaware.gov` (separate CDN domain from the landing page)

**URL pattern:**
- FY2021–FY2025: `https://accountingfiles.delaware.gov/docs/{YYYY}acfr.pdf`
- FY2004–FY2020: `https://accountingfiles.delaware.gov/docs/{YYYY}cafr.pdf` (naming exception)

**CRITICAL — soft-404 WAF caution (T-117-01):** `accountingfiles.delaware.gov` rejects requests lacking a `Referer` header pointing at `accounting.delaware.gov`, returning a 245-byte HTML "Request Rejected" page at **HTTP 200** (not 404/403) — a status-only check would wrongly accept this as success. Both mitigations catch it: Content-Type is `text/html` not `application/pdf`, AND size is 245 bytes (<<1MB). **Loader must send `Referer: https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/` on every request to this host.**

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances (Deficits), Governmental Funds
**Column:** General (1st of 5: General | Federal | Local School Districts | Capital Projects | Total Governmental Funds)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $7,475,243K — line items sum = $7,475,243K ✅ (diff $0)
- FY2004: GF Total Revenues = $3,055,310K — line items sum = $3,055,310K ✅ (diff $0)

**Investment income:** FY2025 Interest and Other Investment Income = +$238,663K (positive); FY2004 Interest & other investment income = +$30,713K (positive). No P2 clamp needed for confirmed years.

**Clean window:** FY2004–FY2025 (22 years)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~1.20× (FY2025 ACFR $7.48B vs FY2024 NASBO $6.23B) — the smallest divergence in this batch, because Delaware reports Federal grants in their own separate major-fund column rather than consolidating them into General. Accept-and-relabel recommended.

---

## HI — Hawaii Detail Block

**Source:** Hawaii Department of Accounting and General Services (DAGS)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://ags.hawaii.gov/accounting/annual-financial-reports/`

**URL pattern:** Per-year WordPress upload-date folder — NOT derivable from fiscal year alone. Enumerable from the archive page:
- FY2025: `https://ags.hawaii.gov/wp-content/uploads/2026/02/acfr2025.pdf`
- FY2024: `https://ags.hawaii.gov/wp-content/uploads/2025/02/acfr2024.pdf`
- FY2023: `https://ags.hawaii.gov/wp-content/uploads/2024/04/acfr2023.pdf`
- FY2005–FY2016: all under `https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr{YYYY}.pdf`
- FY2000–FY2004: same `2012/09/` folder, but files are **scanned images with no text layer** (gap-logged)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds
**Column:** General Fund (1st column; total column count grows from 4 in FY2005 to 8 in FY2025 as new special revenue funds — most notably Med-Quest/Medicaid — are broken out over time)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $10,607,306K — line items sum = $10,607,306K ✅ (diff $0)
- FY2005: GF Total Revenues = $4,198,123K — line items sum = $4,198,123K ✅ (diff $0)

**Investment income:** FY2025 Net increase in fair value of investments = +$12,735K (positive, small); FY2005 Interest and investment income = +$25,170K (positive). Both bookend years positive — the 2008-2009 financial crisis era is a plausible negative-year candidate in the interior window; check at load (P2 clamp ready).

**GF-alone scope note (D-09):** Hawaii's General Fund column EXCLUDES the Med-Quest (Medicaid) Special Revenue Fund, which is reported as its own major-fund column ($2.45B in FY2025). This makes HI's GAAP GF-alone revenue (~$10.6B) slightly NARROWER than NASBO's operating GF concept (~$11.2B FY2024) — the batch's one UT/AL-style narrower case. Load-time GF-alone-vs-composite decision required (UT precedent).

**Clean window:** FY2005–FY2025 (21 years). **FY2000–FY2004 gap-logged — scanned image-only PDFs, zero embedded fonts, no OCR text layer (more severe than the KY no-CMap case: there is literally no text, only images).**
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~0.95× (FY2025 ACFR $10.61B vs FY2024 NASBO $11.22B) — narrower than NASBO; GF-alone-vs-composite is a load-time call.

---

## ID — Idaho Detail Block

**Source:** Idaho State Controller's Office (SCO)
**PDF:** Annual Comprehensive Financial Report (ACFR) / Comprehensive Annual Financial Report (CAFR)
**Landing page:** `https://www.sco.idaho.gov/LivePages/acfr-financial-report-archive.aspx` — **as of this recon, the live page renders via JavaScript and does not expose static PDF links in the raw HTML.** Used the Wayback Machine (`web.archive.org` CDX API, snapshot `20260513095742`) to enumerate the exact per-year filenames, then confirmed each file resolves live (HTTP 200, valid PDF) directly against `www.sco.idaho.gov`.
**File host:** `https://www.sco.idaho.gov/CAFRDocuments/` (works directly, no Referer/WAF issue like Delaware)

**URL pattern (3-way naming exception):**
- FY2024–FY2025: `{YYYY} Annual Comprehensive Financial Report.pdf`
- FY2021–FY2023: `{YYYY} Annual Comprehensive Financial Review.pdf` (**"Review" not "Report"**)
- FY2004–FY2020: `{YYYY} Comprehensive Annual Financial Report.pdf` (old word order, pre-GASB-2021-style naming)

All confirmed with URL-encoded spaces (`%20`) against `https://www.sco.idaho.gov/CAFRDocuments/`.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds
**Column:** General (1st of 3-4 named columns: General | Health and Welfare | Transportation | [Public School Endowment, appears in some years])
**Units:** **MIXED — the batch's standout risk finding.** FY2004 statement is in whole dollars (no "(dollars in thousands)" note on the page); FY2015 statement is explicitly labeled "(dollars in thousands)". The exact transition year was NOT pinned within the ~15-20 min D-04 budget (would require checking each intervening year FY2005–FY2014). **Loader must verify per-year units before scaling — do not assume one constant.**
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $6,658,024K (thousands) — line items sum = $6,658,024K ✅ (diff $0)
- FY2004: GF Total Revenues = $2,314,491,978 (**whole dollars**) — line items sum = $2,314,491,978 ✅ (diff $0)

**Investment income:** FY2025 "Investment Income (Loss)" = +$200,696K (positive; note the line is explicitly labeled with "(Loss)" in its header, signaling a negative year is plausible somewhere in the interior window — P2 clamp should be ready); FY2004 "Investment Income" = +$13,190,646 (positive, no "(Loss)" qualifier in that year's older header style).

**Clean window:** FY2004–FY2025 (22 years; FY2004/FY2025 bookend-tied, FY2023 spot-checked extractable). Units transition year unresolved (see risk facts + gap log).
**Recency floor:** GREENLIGHT (FY2023 "Review" naming + FY2024 "Report" naming both confirmed live)
**Scope vs NASBO:** ~1.33× (FY2025 ACFR $6.66B vs FY2024 NASBO $5.02B) — moderate divergence; Health and Welfare (carrying most Medicaid federal match, $4.36B in FY2025) is reported separately from General, so the ratio reflects ID's broader own-source-tax GF rather than federal consolidation.

---
