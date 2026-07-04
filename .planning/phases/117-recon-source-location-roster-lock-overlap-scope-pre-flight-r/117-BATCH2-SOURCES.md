# 117 — Batch 2 ACFR Source Location (RECON-11, IA/KS/ME/MS/MT)

**Status:** COMPLETE — all 5 states recon'd, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**States:** Iowa (IA), Kansas (KS), Maine (ME), Mississippi (MS), Montana (MT)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors `107-BATCH1-SOURCES.md` shape (NJ/MA/NC/GA/MD recon mold), with a new
Section 0 D-03 triage added per this phase's context (small-state risk anticipation).

---

## Section 0 — D-03 Triage (per-state: does a clean GAAP Governmental-Funds ACFR with a
splittable General Fund column even exist?)

| State | Publishing office | GAAP ACFR exists? | Governmental Funds statement w/ distinct GF column? | Verdict |
|-------|-------------------|--------------------|------------------------------------------------------|---------|
| **Iowa (IA)** | Dept. of Administrative Services (DAS), State Accounting Enterprise | Yes — full ACFR, archive FY1997–FY2025 | Yes — "Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds", **GENERAL FUND** first column | **RECON** |
| **Kansas (KS)** | Dept. of Administration, Office of Accounts and Reports | Yes — full ACFR, listed FY2019–FY2025 on current site | Yes — "Statement of Revenues, Expenditures, and Changes in Fund Balances - Governmental Funds", **General** first column (7-fund wide layout) | **RECON** |
| **Maine (ME)** | Office of the State Controller (OSC) | Yes — full ACFR, archive FY2000–FY2025 | Yes — "Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds", **General** first column | **RECON** |
| **Mississippi (MS)** | Dept. of Finance and Administration (DFA), Office of Financial Reporting | Yes — full ACFR (still branded CAFR in older years), archive FY1996–FY2024 | Yes — "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds", **General** first column (near-single-fund model) | **RECON** |
| **Montana (MT)** | Dept. of Administration, State Financial Services Division (SFSD) | Yes — full **annual** ACFR (state budgets biennially, but financial reporting is annual GAAP), archive FY2015–FY2025 confirmed | Yes — "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds", **GENERAL** first column | **RECON** |

**Verdict summary:** All 5 Batch-2 states PASS the D-03 triage — each publishes a GAAP ACFR with a
Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* carrying a
distinct General Fund (or "General") column. **Zero STAY-NASBO-exception candidates in Batch 2** —
no D-01 fill-policy disposition needed for this batch; all 5 proceed to full recon (Tasks 1-2) and
are expected to load in Phase 119.

**MT annual-vs-biennial confirmation (plan-flagged risk):** Montana's budget is adopted biennially,
but its **GAAP financial reporting is annual** — the state publishes a distinct signed ACFR for every
single fiscal year (2015 through 2025 individually listed on `doa.mt.gov/SFSD/ACFR-PAFR`, each with
its own Statement of Revenues/Expenditures/Changes in Fund Balances — Governmental Funds). This is
NOT a biennial-budget schedule; no D-01/D-09 accept-relabel is needed for this reason. (Confirmed in
Task 2 detail block.)

**ME non-June FY-end flag (plan-flagged risk):** the phase plan flagged Maine as "one to watch" for a
non-June fiscal year end. **Empirically disproven** — both the FY2025 and FY2002 bookend ACFRs
confirm "For the Year Ended June 30, {YYYY}" / "Fiscal Year Ended June 30, {YYYY}". Maine's FY-end
is June 30, same as the other four Batch-2 states. Documented honestly in Section 3 (Task 1).

---

## Workspace confirmation (Task 0)

- `pdftotext -v` confirmed: `pdftotext version 4.00` (poppler present, no install needed).
- `_acfr-work/{ia,ks,me,ms,mt}/` created — confirmed gitignored (`.gitignore` lines 108/133 both
  match `_acfr-work/`). No PDFs committed to git.
- This file (`117-BATCH2-SOURCES.md`) scaffolded with the same 8-section skeleton as
  `107-BATCH1-SOURCES.md`: (0) D-03 triage — **new for this phase**, (1) per-state source table,
  (2) bookend tie-confirmations, (3) four risk facts (D-08), (4) scope vs NASBO (D-09),
  (5) recency-floor verdict (D-07), (6) consolidated gap log, (7) loader-template mapping +
  Phase-119 load notes, plus per-state detail blocks.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-------------------|-------------------|-------|--------|----------------------|-----------------------|
| **IA** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **GENERAL FUND** (1st of General Fund \| Tobacco Settlement Authority \| Tobacco Collections Fund \| Nonmajor \| Total, FY2025; 4-column in FY2002) | thousands | Jun 30 | **FY2002–FY2025** (24 years; archive goes to FY1997, pre-FY2002 not verified this pass) | Opaque ePrints numeric IDs, NOT derivable: FY2025 `https://publications.iowa.gov/54805/1/ACFR%20FY2025%20-%20Protected%2012.22.2025.pdf`; FY2002 `https://publications.iowa.gov/5514/2/FY02_CAFR.pdf`. Full per-year enumeration on landing page `https://das.iowa.gov/acfr-archive` (table back to FY1997). Landing: `https://das.iowa.gov/state-employees/state-accounting/state-financial-reports` |
| **KS** | Statement of Revenues, Expenditures, and Changes in Fund Balances - Governmental Funds | **General** (1st of General \| Social Services \| Health and Environment \| Transportation \| Executive \| Commerce \| Non-major \| Total) | thousands | Jun 30 | **FY2019–FY2025** (7 years; current site archive does not list pre-FY2019) | Opaque hash-based IDs, NOT derivable: FY2025 `https://www.admin.ks.gov/browse/files/d2d39a0deef8464faaba21b8f4e69a24/download`; FY2019 `https://www.admin.ks.gov/browse/files/2bd8990b55c94ceaa02fb136b6a2b111/download`. Full list (FY2019–FY2025) on `https://www.admin.ks.gov/offices/accounts-reports/state-agencies/finance/annual-comprehensive-financial-report/annual-comprehensive-financial-report---acfr/categories/5cdd672f16a4499194349dadf359b1b3` |
| **ME** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Highway \| Federal \| Other Special Revenue \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2000–FY2025** (26 years — deepest in the batch) | **Fully derivable:** `https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr{YYYY}.pdf` for FY2000–FY2025 except **FY2020 exception: `acfr2020v2_0.pdf`** (must special-case). Landing: `https://www.maine.gov/osc/financial-reporting/annual-comprehensive-financial-report` |
| **MS** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Permanent \| Totals, FY2024; General \| Health Care \| Capital Projects \| Nonmajor \| Totals, FY2003 — near-single-fund model, GF is the dominant/only major fund) | thousands | Jun 30 | **FY2003–FY2024** (22 years; archive goes to FY1996, FY2025 not yet published as of this recon) | Opaque per-year filenames, NOT derivable: FY2024 `https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/FY24%20%20ACFR%20Final.pdf`; FY2003 `.../ACFR/2003-cafr.pdf`. Full enumerated list (FY1996–FY2024) on `https://www.dfa.ms.gov/publications` |
| **MT** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **GENERAL** (1st of General \| State Special Revenue \| Federal Special Revenue \| ... \| Total) | thousands | Jun 30 | **FY2016–FY2025** (10 years; archive page confirms back to `2015.pdf` but FY2016 was the first year confirmed cleanly `-table`-extractable this pass) | Opaque per-year filenames, NOT derivable: FY2025 `https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2025-sig-on-file1.pdf`; FY2016 `https://doa.mt.gov/_docs/sfsd/sab/Documents/2016_ACFR.pdf`. Full enumerated list (FY2015–FY2025) on `https://doa.mt.gov/SFSD/ACFR-PAFR` |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|--------------------|-----------|
| **IA** | FY2025 (latest) | **$24,251,676K** (NET REVENUES line — GROSS REVENUES $26,648,950K less Revenue Refunds $2,397,274K) | GF column line items sum to GROSS REVENUES $26,648,950K exactly (Taxes 11,938,586 + Receipts from other entities 10,668,647 + Investment income 485,838 + Fees/licenses/permits 1,723,499 + Refunds & reimbursements 924,381 + Sales/rents/services 33,129 + Miscellaneous 874,870); NET REVENUES ties to printed $24,251,676K. Diff = $0. ✅ |
| **IA** | FY2002 (oldest sampled, post-GASB-34) | **$9,752,220K** | GF column line items sum (Taxes 5,567,742 + Receipts from other entities 3,228,777 + Investment income 80,099 + Fees/licenses/permits 550,649 + Refunds/reimbursements 913,185 + Sales/rents/services 21,300 + Miscellaneous 132,622 + Contributions 0) = GROSS REVENUES $10,494,374K; less Revenue Refunds $742,154K = NET REVENUES $9,752,220K. Matches printed exactly. Diff = $0. ✅ |
| **KS** | FY2025 (latest) | **$10,352,600K** | GF column line items (Property tax 21 + Income/inheritance tax 5,981,722 + Sales/excise tax 3,718,917 + Gross receipts tax 218,826 + Charges for services 71,832 + Operating grants 0 + Capital grants 0 + Investment earnings 305,819 + Other revenues 55,463) sum to $10,352,600K. Matches printed Total revenues exactly. Diff = $0. ✅ |
| **KS** | FY2019 (oldest sampled) | **$7,539,362K** | GF column line items (Property tax 4 + Income/inheritance tax 4,243,431 + Sales/excise tax 3,052,192 + Gross receipts tax 163,950 + Charges for services 32,655 + Operating/capital grants 0 + Investment earnings 36,370 + Other revenues 10,760) sum to $7,539,362K. Matches printed exactly. Diff = $0. ✅ |
| **ME** | FY2025 (latest) | **$6,194,288K** | GF column line items (Taxes 5,910,772 + Assessments 101,221 + Federal Grants & Reimbursements 27 + Charges for Services 50,741 + Investment Income 113,749 + Miscellaneous 17,778) sum to $6,194,288K. Matches printed Total Revenues exactly. Diff = $0. ✅ |
| **ME** | FY2002 (oldest sampled) | **$2,302,006K** | GF column line items (Taxes 2,173,345 + Assessments/Other 61,685 + Federal Grants 21,578 + Service Charges 41,111 + Investment Income 3,830 + Miscellaneous 457) sum to $2,302,006K. Matches printed Total Revenues exactly. Diff = $0. ✅ |
| **MS** | FY2024 (latest) | **$22,709,403K** | GF column line items (Sales/use tax 5,069,172 + Gasoline tax 437,177 + Individual income tax 2,204,678 + Corporate income/franchise tax 895,428 + Insurance tax 510,090 + Other tax 565,786 + Licenses/fees/permits 605,935 + Federal government 10,966,392 + **Investment income (434,060)** + Charges for sales/services 524,150 + Rentals (338) + Court assessments 253,676 + Lottery proceeds 125,102 + Other 986,215) sum to $22,709,403K, **including the two negative lines**. Matches printed Total Revenues exactly. Diff = $0. ✅ |
| **MS** | FY2003 (oldest sampled) | **$9,707,864K** | GF column line items (Sales/use tax 2,377,996 + Gasoline tax 409,249 + Individual income tax 1,021,967 + Corporate income/franchise tax 287,335 + Insurance tax 149,458 + Other tax 344,435 + Licenses/fees/permits 349,795 + Federal government 4,190,940 + Interest/investment income 42,290 + Charges for sales/services 234,015 + Rentals 10,809 + Court assessments 22,494 + Other 267,081) sum to $9,707,864K. Matches printed Total Revenues exactly. Diff = $0. ✅ |
| **MT** | FY2025 (latest) | **$3,453,804K** | GF column line items (Licenses/permits 159,699 + Natural resource tax 97,860 + Individual income tax 2,292,065 + Corporate income tax 319,959 + Property tax 15,562 + Fuel tax 0 + Other tax 326,183 + Charges for services/fines/settlements 28,544 + Investment earnings 156,745 + Securities lending income 1,531 + Sale of documents 384 + Rentals/leases/royalties 42 + Contributions/premiums 46 + Grants/contracts/donations 31,639 + Federal 22,186 + Federal indirect cost recoveries 244 + Other revenues 1,115) sum to $3,453,804K. Matches printed Total revenues exactly. Diff = $0. ✅ |
| **MT** | FY2016 (oldest sampled) | **$2,039,879K** | GF column line items (Licenses/permits 125,357 + Natural resource tax 65,218 + Individual income tax 1,170,799 + Corporate income tax 119,539 + Property tax 258,864 + Fuel tax 0 + Other tax 229,026 + Charges for services 38,370 + Investment earnings 5,703 + Securities lending income 32 + Sale of documents 360 + Rentals 43 + Contributions/premiums 1,736 + Grants/contracts/donations 7,388 + Federal 16,126 + Federal indirect cost recoveries 216 + Other revenues 1,102) sum to $2,039,879K. Matches printed Total revenues exactly. Diff = $0. ✅ |

---

## Section 3 — Four risk facts per D-08 (all 5 states)

| Fact | IA | KS | ME | MS | MT |
|------|----|----|----|----|----|
| **Units** | thousands | thousands | thousands | thousands | thousands |
| **Negative GF line items** | None observed FY2002 or FY2025 (all revenue lines positive in the General Fund column). Low risk. | None observed FY2019 or FY2025 (all General column revenue lines positive). Low risk. | None observed FY2002 or FY2025 in the General column (FY2002's Other Governmental Funds column has a small negative Investment Income of -$3,097K, but that's not the GF column). Low risk for GF itself. | **CAUTION: FY2024 Investment income = -$434,060K (NEGATIVE, material)** and Rentals = -$338K (negative, immaterial) in the General column. P2 clamp required for FY2024. FY2003 General column has no negative lines. | None observed FY2016 or FY2025 (all General column revenue lines positive). Low risk. |
| **Exact column header + statement** | "GENERAL FUND", Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) | "General", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities) | "General", Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) | "General", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) | "GENERAL", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | **June 30 ✓ — plan-flagged non-June risk empirically disproven** (confirmed both FY2002 and FY2025 bookends read "Year Ended June 30") | June 30 ✓ | June 30 ✓ — confirmed both FY2016 and FY2025 (annual reporting despite biennial budgeting; see Section 0 + MT detail block) |

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis, all 5 states)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function, from
`scripts/loadStateGF.mjs` `controlTotalGF` FY2024). ACFR figures are **revenue** totals. The
comparison is apples-to-oranges by design (per the Batch-1 precedent) — the point is to flag whether
the ACFR GF's revenue base is materially broader than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------------|-----------------------------|-------|--------|-----------------|
| **IA** | $24,251,676K (FY2025) | $8,560,000K | **~2.83×** | GAAP General Fund consolidates "Receipts from other entities" (~$10.67B, mostly federal intergovernmental) that NASBO's budgetary GF excludes — same NC/GA-style mechanism, on the wider end of the batch. | **Accept-and-relabel honestly** (TX/NC precedent). Confirm at Phase-119 load. |
| **KS** | $10,352,600K (FY2025) | $9,365,000K | **~1.11×** | Modest divergence — KS's Operating/Capital grants line is $0 in the sampled General column both years (federal flows appear to route through separate special-revenue fund columns, not the GF), keeping the GAAP GF close to NASBO's budgetary scope. Closest to NJ's ~1.15× mechanism. | **Accept-and-relabel honestly** (NJ precedent, modest divergence). Confirm at Phase-119 load. |
| **ME** | $6,194,288K (FY2025) | $4,980,000K | **~1.24×** | Modest divergence — Maine's Federal Grants & Reimbursements are booked to a SEPARATE "Federal" major fund column (not the General column), so the GAAP GF stays close to NASBO's budgetary scope. Similar mechanism to KS. | **Accept-and-relabel honestly** (NJ precedent, modest divergence). Confirm at Phase-119 load. |
| **MS** | $22,709,403K (FY2024) | $6,635,000K | **~3.42×** | **Widest divergence in Batch 2**, comparable to the TX ~3× precedent. Mississippi's General Fund is effectively the state's ONLY major governmental fund (Permanent fund is negligible, ~$3.8M) — nearly all state activity including $10.97B of Federal government revenue flows directly through the General column, unlike IA/ME/MT where federal flows are partly diverted to separate special-revenue funds. | **Accept-and-relabel honestly** (TX precedent — same mechanism, near-single-fund consolidation). MS also carries the FY2024 P2 clamp requirement (see Section 3). Confirm at Phase-119 load. |
| **MT** | $3,453,804K (FY2025) | $2,684,000K | **~1.29×** | Modest divergence — Montana's Federal revenue is booked overwhelmingly to a SEPARATE "Federal Special Revenue" fund column ($4.45B in FY2025 vs only $22.2M in the General column), keeping the GAAP GF close to NASBO's budgetary scope. Same mechanism as ME. | **Accept-and-relabel honestly** (NJ/ME precedent, modest divergence). Confirm at Phase-119 load. |

---

## Section 5 — Recency-floor verdict per D-07 (all 5 states)

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|--------------------------|-------------------|--------------------|---------|
| **IA** | FY2025 (published, 12/22/2025 per filename) | ✅ (`publications.iowa.gov/47299/`) | ✅ (`publications.iowa.gov/51393/`) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable without strand. |
| **KS** | FY2025 (Total revenues $10,352,600K confirmed) | ✅ (`https://www.admin.ks.gov/browse/files/aa7495fbfc7e4c02a9afe62e18c23305/download`) | ✅ (`https://www.admin.ks.gov/browse/files/d74a7e638a0947d5bb8369a5d35ebb48/download`) | **GREENLIGHT** — recency floor satisfied. |
| **ME** | FY2025 (Total Revenues $6,194,288K confirmed) | ✅ (`acfr2023.pdf`, 01/09/2024 filing date) | ✅ (`acfr2024.pdf`, 02/25/2025 filing date) | **GREENLIGHT** — recency floor satisfied. |
| **MS** | FY2024 (Total Revenues $22,709,403K confirmed; FY2025 not yet published as of this recon — normal filing lag) | ✅ (`2023 ACFR Final.pdf` confirmed on `dfa.ms.gov/publications`) | ✅ (`FY24  ACFR Final.pdf`, the bookend PDF itself) | **GREENLIGHT** — recency floor satisfied (FY2024 is MS's latest published ACFR; no strand). |
| **MT** | FY2025 (Total revenues $3,453,804K confirmed) | ✅ (`Montana-ACFR-2023-Final-w_-sig-on-file.pdf`, HTTP 200 confirmed) | ✅ (`Montana-ACFR-2024-sig-on-file.pdf`, HTTP 200 confirmed) | **GREENLIGHT** — recency floor satisfied. |

---

## Section 6 — Consolidated gap log (all 5 states)

| State | FY | Gap reason | Disposition |
|-------|----|-----------|--------------|
| **IA** | FY1997–FY2001 | Archive lists these years (`das.iowa.gov/acfr-archive`) but pre-GASB-34 statement format not verified within the D-04 effort budget (FY2002 confirmed already has the modern GASB-34 statement). | Low priority — FY2002–FY2025 (24-year window) is more than sufficient for Phase-119 launch. Extend at load time if the pre-2002 format is confirmed compatible. |
| **IA** | (naming) | FY2025 filename embeds "Protected" (`ACFR FY2025 - Protected 12.22.2025.pdf`) — the PDF is owner-password-encrypted but `pdftotext -table` extracts cleanly regardless (confirmed). | No gap — informational only. Loader SOURCES map must enumerate the exact filename per year (opaque ePrints IDs, no derivable pattern). |
| **KS** | Pre-FY2019 | Current site's ACFR listing (`admin.ks.gov` "ACFR Reports" category) only enumerates FY2019–FY2025 (7 years). No older years discoverable within the D-04 effort budget; KS mentions EMMA (Electronic Municipal Market Access) as an alternate historical filing venue for FY2009+ but that was not verified as a durable direct-download source this pass. | Gap logged. FY2019–FY2025 (7-year window) is the confirmed clean window for Phase-119 launch. Pre-FY2019 is a load-time extension candidate (verify EMMA durability first). |
| **ME** | FY2020 | Filename exception: `acfr2020v2_0.pdf` instead of the derived `acfr2020.pdf`. | Loader SOURCES map must special-case FY2020. Otherwise durable — PDF confirmed present under the exception filename. No gap, just a naming variant (mirrors MA's FY2017 exception from Batch 1). |
| **ME** | Pre-FY2000 | Archive page listing starts at FY2000; no older years found within the D-04 effort budget. | Low priority — FY2000–FY2025 (26-year window) is the deepest confirmed window in the batch, more than sufficient for launch. |
| **MS** | FY2025 | Not yet published as of this recon (2026-07-03) — MS's FY24 ACFR (the current latest) was filed after the FYE; a FY2025 filing was not found on `dfa.ms.gov/publications`. | Not a true gap — normal reporting lag. FY2024 already satisfies the D-07 recency floor. Re-check at Phase-119 load time in case FY2025 has since been published. |
| **MS** | Pre-1996 | Archive page listing starts at FY1996; not pursued further within the D-04 effort budget. | Low priority — FY2003–FY2024 (22-year window, oldest bookend-tied) is more than sufficient; FY1996–FY2002 available on the archive page but not bookend-tied this pass. |
| **MS** | (naming) | No derivable URL pattern — filenames vary per year (`FY24  ACFR Final.pdf` [double space], `2023 ACFR Final.pdf`, `FY22 ACFR.pdf`, `2021-annual-comprehensifinancial-report.pdf` [typo in the source filename], `2020-state-of-ms-cafr.pdf`, etc). | Loader SOURCES map must hardcode each year's exact filename from the enumerated `dfa.ms.gov/publications` archive — no gap, just an enumeration requirement (NC/GA-style). |
| **MT** | Pre-FY2015 | `doa.mt.gov/SFSD/ACFR-PAFR` archive page's earliest listed file is `2015.pdf` (FY2015); no older years discoverable within the D-04 effort budget. | Gap logged. FY2016–FY2025 (10-year confirmed bookend window; FY2015 itself listed but not bookend-tied this pass) is sufficient for Phase-119 launch. Pre-FY2015 is a load-time extension candidate if a separate archive is found. |
| **MT** | (naming) | No derivable URL pattern — filenames vary per year (`Montana-ACFR-2025-sig-on-file1.pdf` [note the "1" suffix], `Montana-ACFR-2024-sig-on-file.pdf`, `Montana-ACFR-2023-Final-w_-sig-on-file.pdf`, `2016_ACFR.pdf`, `FY17_ACFR.pdf`, `Montana-CAFR-2018-web-version-protected.pdf`, etc). | Loader SOURCES map must hardcode each year's exact filename from the enumerated `doa.mt.gov/SFSD/ACFR-PAFR` archive — no gap, just an enumeration requirement. |

---

## Section 7 — Loader template mapping + Phase-119 load notes (all 5 states)

| State | Closest loader template | GF layout notes | Phase-119 load notes |
|-------|---------------------------|-------------------|------------------------|
| **IA** | `extract_gf.py` + `gen_state.py` (opaque per-year SOURCES map, NC/GA-style enumeration) | GF is first column of a 4-5-column layout (General Fund \| Tobacco Settlement Authority \| Tobacco Collections Fund \| Nonmajor \| Total in FY2025; General Fund \| Tobacco Tax-Exempt Bond Proceeds \| Nonmajor \| Total in FY2002). Total revenues line is labeled "NET REVENUES" (GROSS REVENUES less Revenue Refunds), not "Total revenues" — extractor must target NET REVENUES as the tie-check total, not assume a literal "Total revenues" label. Units = thousands. | Must enumerate all per-year opaque `publications.iowa.gov/{id}/` URLs from `das.iowa.gov/acfr-archive` into the SOURCES map — no derivable pattern. FY2025 file is owner-password-encrypted (extracts fine via `pdftotext -table`, confirmed). 24-year window FY2002–FY2025. |
| **KS** | `extract_gf.py` + `gen_state.py` (opaque per-year SOURCES map; wide multi-fund position-anchored extraction, similar to the v2.14 CO/MO wide-layout precedent) | GF is first column of an 8-column layout (General \| Social Services \| Health and Environment \| Transportation \| Executive \| Commerce \| Non-major Governmental \| Total Governmental). Units = thousands. | Must enumerate all per-year opaque `/browse/files/{hash}/download` URLs from the KS DOA ACFR category page — no derivable pattern. 7-year window FY2019–FY2025 (shallower than IA/ME; pre-FY2019 needs load-time investigation). |
| **ME** | `extract_gf.py` + `gen_state.py` (**derivable per-year SOURCES map**, MA-style pattern from Batch 1) | GF is first column of a 6-column layout (General \| Highway \| Federal \| Other Special Revenue \| Other Governmental Funds \| Total Governmental). Units = thousands. Federal revenue is booked to its OWN major fund column (not the General column) — keeps GF scope close to NASBO. | **Cleanest URL pattern in the batch** — `acfr{YYYY}.pdf` derivable for FY2000-FY2025 except the FY2020 naming exception (`acfr2020v2_0.pdf`, must special-case in the SOURCES map). 26-year window FY2000–FY2025, deepest in Batch 2. |
| **MS** | `extract_gf.py` + `gen_state.py` (opaque per-year SOURCES map, NC/GA-style enumeration; **P2 clamp required**, same lever as MD FY2022 in Batch 1) | GF is first column of a small (2-5)-column layout — General Fund is effectively the state's only major fund (General \| Permanent \| Totals in FY2024; General \| Health Care \| Capital Projects \| Nonmajor \| Totals in FY2003). Units = thousands. | **P2 clamp required for FY2024** (Investment income = -$434,060K, Rentals = -$338K, both negative in the General column). Must enumerate all per-year opaque/varying-naming filenames from `dfa.ms.gov/publications` into the SOURCES map — no derivable pattern. 22-year window FY2003–FY2024 (FY2025 not yet published). |
| **MT** | `extract_gf.py` + `gen_state.py` (opaque per-year SOURCES map; wide multi-fund position-anchored extraction, similar to KS) | GF is first column of a wide multi-column layout (General \| State Special Revenue \| Federal Special Revenue \| ... \| Total Governmental). Units = thousands. Federal revenue is booked overwhelmingly to the separate "Federal Special Revenue" column, not General — keeps GF scope close to NASBO. | Must enumerate all per-year opaque/varying-naming filenames from `doa.mt.gov/SFSD/ACFR-PAFR` into the SOURCES map — no derivable pattern. 10-year window FY2016–FY2025. Confirmed the ACFR is filed ANNUALLY despite MT's biennial budget cycle (Section 0) — no biennial-schedule risk. |

---

## IA — Iowa Detail Block

**Source:** Iowa Department of Administrative Services (DAS), State Accounting Enterprise
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://das.iowa.gov/state-employees/state-accounting/state-financial-reports`
**Archive page:** `https://das.iowa.gov/acfr-archive` (table of FY1997–FY2024, each year an opaque
`publications.iowa.gov/{id}/` landing page)

**URL pattern:** Opaque ePrints repository numeric IDs — NOT derivable from year alone. Confirmed:
- FY2025: `https://publications.iowa.gov/54805/1/ACFR%20FY2025%20-%20Protected%2012.22.2025.pdf`
- FY2024: landing `https://publications.iowa.gov/51393/`
- FY2023: landing `https://publications.iowa.gov/47299/`
- FY2002: `https://publications.iowa.gov/5514/2/FY02_CAFR.pdf`

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** GENERAL FUND (1st column)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: NET REVENUES (GF) = $24,251,676K — GF column line items sum to GROSS REVENUES
  $26,648,950K, less Revenue Refunds $2,397,274K = $24,251,676K ✅ (diff $0)
- FY2002: NET REVENUES (GF) = $9,752,220K — GF column line items sum to GROSS REVENUES
  $10,494,374K, less Revenue Refunds $742,154K = $9,752,220K ✅ (diff $0)

**Investment income:** FY2025 = +$485,838K (positive); FY2002 = +$80,099K (positive). No P2 clamp
needed for confirmed years.

**Note (extraction quirk):** the FY2025 PDF is owner-password-encrypted (`/Encrypt` in the PDF
header) — `pdftotext -table` extracts cleanly regardless (confirmed, no workaround needed). Also,
`pdftotext -table` visually shifts the "Sales, rents & services" cell one column right in years where
adjacent fund columns show "-" for zero (both FY2002 and FY2025) — the value is recoverable exactly
via the GROSS REVENUES subtraction check (confirmed tied to $0 both years), a light-cleanup lever for
the Phase-119 loader (per D-08's "light -table cleanup" precedent).

**Clean window:** FY2002–FY2025 (24 years; FY1997–FY2001 pre-GASB-34 format not verified this pass)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~2.83× (IA FY2024 NASBO GF $8.56B) — accept-and-relabel recommended (NC/TX-style
federal-consolidation driver)

---

## KS — Kansas Detail Block

**Source:** Kansas Department of Administration, Office of Accounts and Reports
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.admin.ks.gov/offices/accounts-reports/state-agencies/finance/annual-comprehensive-financial-report`
**Archive page (ACFR Reports category):** `https://www.admin.ks.gov/offices/accounts-reports/state-agencies/finance/annual-comprehensive-financial-report/annual-comprehensive-financial-report---acfr/categories/5cdd672f16a4499194349dadf359b1b3`

**URL pattern:** Opaque hash-based `/browse/files/{hash}/download` IDs — NOT derivable from year
alone. Confirmed (FY2019–FY2025, all 7 years listed on the archive page):
- FY2025: `https://www.admin.ks.gov/browse/files/d2d39a0deef8464faaba21b8f4e69a24/download`
- FY2024: `https://www.admin.ks.gov/browse/files/d74a7e638a0947d5bb8369a5d35ebb48/download`
- FY2023: `https://www.admin.ks.gov/browse/files/aa7495fbfc7e4c02a9afe62e18c23305/download`
- FY2022: `https://www.admin.ks.gov/browse/files/ee6e0e7000bb4e5f957683878a938886/download`
- FY2021: `https://www.admin.ks.gov/browse/files/7d8b648a351d481eaebd75655a44ea07/download`
- FY2020: `https://www.admin.ks.gov/browse/files/cf4e8d86320544d2a815531a87dbcb36/download`
- FY2019: `https://www.admin.ks.gov/browse/files/2bd8990b55c94ceaa02fb136b6a2b111/download`

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances - Governmental Funds
**Column:** General (1st of 8: General | Social Services | Health and Environment | Transportation |
Executive | Commerce | Non-major Governmental | Total Governmental)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: Total revenues (GF) = $10,352,600K — GF column line items sum to $10,352,600K ✅ (diff $0)
- FY2019: Total revenues (GF) = $7,539,362K — GF column line items sum to $7,539,362K ✅ (diff $0)

**Investment income:** FY2025 = +$305,819K (positive); FY2019 = +$36,370K (positive). No P2 clamp
needed for confirmed years. (Note: the "Health and Environment" special revenue fund shows a negative
ending fund balance in some years — not a revenue line and not the General column, no P2 relevance.)

**Clean window:** FY2019–FY2025 (7 years — the shallowest confirmed window in the batch; the current
site listing does not enumerate pre-FY2019 years)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~1.11× (KS FY2024 NASBO GF $9.365B) — modest divergence, accept-and-relabel
recommended (NJ-style mechanism — federal flows largely outside the General column)

---

## ME — Maine Detail Block

**Source:** Maine Office of the State Controller (OSC)
**PDF:** Annual Comprehensive Financial Report (ACFR); older years branded "Comprehensive Annual
Financial Report" (CAFR)
**Landing page:** `https://www.maine.gov/osc/financial-reporting/annual-comprehensive-financial-report`

**URL pattern — fully derivable, deepest and cleanest in the batch:**
`https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr{YYYY}.pdf` for FY2000–FY2025
**except FY2020: `acfr2020v2_0.pdf`** (must special-case).
- FY2025: `.../acfr2025.pdf`
- FY2002: `.../acfr2002.pdf`
- Confirmed present on the landing page all the way to `acfr2000.pdf`.

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 6: General | Highway | Federal | Other Special Revenue | Other
Governmental Funds | Total Governmental)
**Units:** Thousands
**FY-end:** June 30 — **the plan flagged ME as a non-June risk to watch; empirically disproven** by
both bookend PDFs ("For the Year Ended June 30, 2025" / "Fiscal Year Ended June 30, 2002").

**Bookend tie-confirms:**
- FY2025: Total Revenues (General) = $6,194,288K — GF column line items sum to $6,194,288K ✅ (diff $0)
- FY2002: Total Revenues (General) = $2,302,006K — GF column line items sum to $2,302,006K ✅ (diff $0)

**Investment income:** FY2025 = +$113,749K (positive, General column); FY2002 = +$3,830K (positive,
General column). FY2002's "Other Governmental Funds" column has a small negative Investment Income
(Loss) of -$3,097K — not the General column, no P2 relevance to the GF node. No P2 clamp needed for
confirmed GF years.

**Federal revenue architecture (scope driver):** unlike IA/MS, Maine books essentially all Federal
Grants & Reimbursements to a SEPARATE "Federal" major fund column ($5,972,037K in FY2025), not the
General column (General's Federal line is only $27K in FY2025). This keeps Maine's GAAP General Fund
close to NASBO's budgetary scope (~1.24×) — the state's own structure, not a load-time choice.

**Clean window:** FY2000–FY2025 (26 years — deepest confirmed window in Batch 2)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~1.24× (ME FY2024 NASBO GF $4.98B) — modest divergence, accept-and-relabel
recommended (NJ-style mechanism)

---

## MS — Mississippi Detail Block

**Source:** Mississippi Department of Finance and Administration (DFA), Office of Financial Reporting
**PDF:** Annual Comprehensive Financial Report (ACFR); older years branded "Comprehensive Annual
Financial Report" (CAFR)
**Landing page:** `https://www.dfa.ms.gov/publications` (full archive FY1996–FY2024 under the "Annual
Comprehensive Financial Report (ACFR)" accordion)

**URL pattern:** Opaque, varying per-year filenames — NOT derivable. Confirmed:
- FY2024: `https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/FY24%20%20ACFR%20Final.pdf` (note double space in filename)
- FY2023: `.../ACFR/2023%20ACFR%20Final.pdf`
- FY2022: `.../ACFR/FY22%20ACFR.pdf`
- FY2021: `.../ACFR/2021-annual-comprehensifinancial-report.pdf` (typo in source filename, preserved verbatim)
- FY2020: `.../ACFR/2020-state-of-ms-cafr.pdf`
- FY2003: `.../ACFR/2003-cafr.pdf`
- Full list back to FY1996 enumerated on the landing page.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General (1st column; Mississippi's fund structure is a near-single-fund model — General
+ Permanent in FY2024, General + Health Care + Capital Projects + Nonmajor in FY2003)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024: Total Revenues (General) = $22,709,403K — GF column line items (including two negative
  lines) sum to $22,709,403K ✅ (diff $0)
- FY2003: Total Revenues (General) = $9,707,864K — GF column line items sum to $9,707,864K ✅ (diff $0)

**CRITICAL — Negative investment income + rentals FY2024:**
`Investment income = -$434,060K` (material negative) and `Rentals = -$338K` (immaterial negative) in
the FY2024 General Fund revenue column. The P2 clamp policy (from `loadStateGF.mjs` / MD FY2022
precedent) applies: any negative GF revenue line must be clamped to 0 at load time. Loader must
implement P2 clamp for MS FY2024 (and check all other years at load — FY2003 has no negative lines).

**Federal revenue architecture (scope driver):** Mississippi's General Fund is effectively the
state's ONLY major governmental fund of consequence (the "Permanent" fund is negligible, $3.7M in
FY2024) — Federal government revenue ($10,966,392K in FY2024, ~48% of General Fund total revenues)
flows directly through the General column rather than being diverted to a separate special-revenue
fund (unlike IA/ME/MT). This drives the widest scope-vs-NASBO ratio in the batch (~3.42×).

**Clean window:** FY2003–FY2024 (22 years; archive goes to FY1996, FY2025 not yet published)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed; FY2024 is the latest published)
**Scope vs NASBO:** ~3.42× (MS FY2024 NASBO GF $6.635B) — widest in Batch 2, TX-style
near-single-fund consolidation; accept-and-relabel recommended, confirm P2 clamp at Phase-119 load

---

## MT — Montana Detail Block

**Source:** Montana Department of Administration, State Financial Services Division (SFSD)
**PDF:** Annual Comprehensive Financial Report (ACFR); pre-2021 years branded "Comprehensive Annual
Financial Report" (CAFR)
**Landing page:** `https://doa.mt.gov/SFSD/ACFR-PAFR` (archive listing FY2015–FY2025)

**URL pattern:** Opaque, varying per-year filenames — NOT derivable. Confirmed:
- FY2025: `https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2025-sig-on-file1.pdf` (note the "1" suffix)
- FY2024: `https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2024-sig-on-file.pdf` (HTTP 200 confirmed)
- FY2023: `https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2023-Final-w_-sig-on-file.pdf` (HTTP 200 confirmed)
- FY2022: `https://doa.mt.gov/_docs/sfsd/sab/Documents/Final-Montana-ACFR-2022-wo-signature.pdf`
- FY2021: `https://doa.mt.gov/_docs/sfsd/sab/Documents/Final-Montana-ACFR---2021-wo-signature.pdf`
- FY2016: `https://doa.mt.gov/_docs/sfsd/sab/Documents/2016_ACFR.pdf`
- FY2015: `https://doa.mt.gov/_docs/sfsd/sab/Documents/2015.pdf` (listed; not bookend-tied this pass)
- Full list enumerated on the landing page (back to FY2015).

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** GENERAL (1st column of a wide multi-fund layout: General | State Special Revenue |
Federal Special Revenue | ... | Total Governmental)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: Total revenues (GENERAL) = $3,453,804K — GF column line items sum to $3,453,804K ✅ (diff $0)
- FY2016: Total revenues (GENERAL) = $2,039,879K — GF column line items sum to $2,039,879K ✅ (diff $0)

**Investment earnings:** FY2025 = +$156,745K (positive); FY2016 = +$5,703K (positive). No P2 clamp
needed for confirmed years.

**Annual-vs-biennial confirmation (D-03/D-09 risk pre-flagged in the plan):** Montana's legislature
adopts a **biennial budget**, but its **GAAP financial reporting cadence is annual** — every single
fiscal year from FY2015 through FY2025 has its own individually-signed ACFR with its own Statement of
Revenues, Expenditures and Changes in Fund Balances — Governmental Funds (confirmed directly from the
FY2016 and FY2025 bookend PDFs, both labeled "FOR THE FISCAL YEAR ENDED JUNE 30, {YYYY}", not a
biennial period). **No D-01/D-09 accept-relabel is triggered by this risk** — Montana's GAAP GF
statement is a normal annual GAAP statement, same shape as every other Batch-2 state.

**Federal revenue architecture (scope driver):** Montana books Federal revenue overwhelmingly to a
SEPARATE "Federal Special Revenue" major fund column ($4,309,139K Federal line alone in FY2025 vs
only $22,186K in the General column) — this keeps Montana's GAAP General Fund close to NASBO's
budgetary scope (~1.29×), the same mechanism as Maine.

**Clean window:** FY2016–FY2025 (10 years bookend-tied; FY2015 listed on the archive but not tied
this pass)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed, both HTTP 200)
**Scope vs NASBO:** ~1.29× (MT FY2024 NASBO GF $2.684B) — modest divergence, accept-and-relabel
recommended (NJ/ME-style mechanism)

---

## Phase-119 Pre-Load Checklist (per D-10 overlap resolution + D-08 risk facts)

These items are flagged here for the Phase-119 loader author. Recon documents; the load phase
executes.

| State | Pre-load requirement | Risk if skipped |
|-------|------------------------|--------------------|
| **IA** | Enumerate opaque `publications.iowa.gov/{id}/` URLs per year into the SOURCES map. Target "NET REVENUES" as the GF total-tie line (not "Total revenues" — IA's statement uses NET REVENUES = GROSS REVENUES less Revenue Refunds). Confirm no pre-existing IA state-node overlap before writing (standard new ACFR loader — no dual-node conflict expected, not probed live this pass since this is documentation-only recon). | Extractor targeting the wrong "total" line would silently under/over-count IA's GF total. |
| **KS** | Enumerate opaque `/browse/files/{hash}/download` URLs per year into the SOURCES map. 8-column wide layout — position-anchor the General column (1st) carefully. | Column misalignment in a wide layout could misattribute a special-revenue-fund dollar amount to the General Fund. |
| **ME** | Use the derivable `acfr{YYYY}.pdf` pattern with the FY2020 exception (`acfr2020v2_0.pdf`) hardcoded. | Naive pattern-only SOURCES map would 404 on FY2020. |
| **MS** | **Apply P2 clamp for FY2024.** `Investment income = -$434,060K` and `Rentals = -$338K` in the General Fund revenue statement — both must clamp to 0 per P2 policy. Enumerate MS's varying per-year filenames (no derivable pattern) into the SOURCES map. Check all years for negative lines before writing. | Negative revenue displayed in UI (invalid for P2 clamp policy); a naive derivable-pattern loader would 404 on every MS year. |
| **MT** | Enumerate opaque, varying per-year filenames into the SOURCES map (no derivable pattern). Confirm the annual (not biennial) cadence continues to hold at load time (already confirmed FY2015–FY2025 all individually filed). | A naive derivable-pattern loader would 404 on every MT year; assuming a biennial reporting gap would incorrectly skip a fiscal year that in fact has its own ACFR. |

---

## Summary

All five Batch-2 states (IA, KS, ME, MS, MT) publish a GAAP Governmental Funds *Statement of
Revenues, Expenditures and Changes in Fund Balances* with a distinct General Fund column — **zero
STAY-NASBO-exception candidates** in this batch (D-01 fill policy not triggered; nothing to feed the
Phase-123 NASBO-served list from Batch 2). All five bookend-tie at exact $0 diff across both the
oldest and latest sampled fiscal years. All five pass the D-07 recency floor (FY2023 + FY2024 in
clean window). Windows range from KS's shallowest (FY2019–FY2025, 7 years) to ME's deepest
(FY2000–FY2025, 26 years). One P2 clamp candidate identified (MS FY2024, -$434,060K investment
income). Scope-vs-NASBO divergence ranges from KS's modest ~1.11× to MS's TX-style ~3.42× — all five
recommended for accept-and-relabel at load time. All five map to the `extract_gf.py` + `gen_state.py`
loader template; only Maine has a fully derivable per-year URL pattern (the other four require an
enumerated SOURCES map of opaque or varying-naming filenames). This is the Phase 119 input contract
for IA/KS/ME/MS/MT.
