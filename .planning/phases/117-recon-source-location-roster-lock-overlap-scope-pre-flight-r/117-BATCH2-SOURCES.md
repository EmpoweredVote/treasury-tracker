# 117 — Batch 2 ACFR Source Location (RECON-11, IA/KS/ME/MS/MT)

**Status:** IN PROGRESS — Section 0 (D-03 triage) complete for all 5 states. Sections 1-7 + per-state
detail blocks to be filled in as each state is reconned (Task 1: IA/KS/ME; Task 2: MS/MT).
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

---

## Section 3 — Four risk facts per D-08 (IA / KS / ME)

| Fact | IA | KS | ME |
|------|----|----|----|
| **Units** | thousands | thousands | thousands |
| **Negative GF line items** | None observed FY2002 or FY2025 (all revenue lines positive in the General Fund column). Low risk. | None observed FY2019 or FY2025 (all General column revenue lines positive). Low risk. | None observed FY2002 or FY2025 in the General column (FY2002's Other Governmental Funds column has a small negative Investment Income of -$3,097K, but that's not the GF column). Low risk for GF itself. |
| **Exact column header + statement** | "GENERAL FUND", Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) | "General", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities) | "General", Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | **June 30 ✓ — plan-flagged non-June risk empirically disproven** (confirmed both FY2002 and FY2025 bookends read "Year Ended June 30") |

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis, IA / KS / ME)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function, from
`scripts/loadStateGF.mjs` `controlTotalGF` FY2024). ACFR figures are **revenue** totals. The
comparison is apples-to-oranges by design (per the Batch-1 precedent) — the point is to flag whether
the ACFR GF's revenue base is materially broader than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------------|-----------------------------|-------|--------|-----------------|
| **IA** | $24,251,676K (FY2025) | $8,560,000K | **~2.83×** | GAAP General Fund consolidates "Receipts from other entities" (~$10.67B, mostly federal intergovernmental) that NASBO's budgetary GF excludes — same NC/GA-style mechanism, on the wider end of the batch. | **Accept-and-relabel honestly** (TX/NC precedent). Confirm at Phase-119 load. |
| **KS** | $10,352,600K (FY2025) | $9,365,000K | **~1.11×** | Modest divergence — KS's Operating/Capital grants line is $0 in the sampled General column both years (federal flows appear to route through separate special-revenue fund columns, not the GF), keeping the GAAP GF close to NASBO's budgetary scope. Closest to NJ's ~1.15× mechanism. | **Accept-and-relabel honestly** (NJ precedent, modest divergence). Confirm at Phase-119 load. |
| **ME** | $6,194,288K (FY2025) | $4,980,000K | **~1.24×** | Modest divergence — Maine's Federal Grants & Reimbursements are booked to a SEPARATE "Federal" major fund column (not the General column), so the GAAP GF stays close to NASBO's budgetary scope. Similar mechanism to KS. | **Accept-and-relabel honestly** (NJ precedent, modest divergence). Confirm at Phase-119 load. |

---

## Section 5 — Recency-floor verdict per D-07 (IA / KS / ME)

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|--------------------------|-------------------|--------------------|---------|
| **IA** | FY2025 (published, 12/22/2025 per filename) | ✅ (`publications.iowa.gov/47299/`) | ✅ (`publications.iowa.gov/51393/`) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable without strand. |
| **KS** | FY2025 (Total revenues $10,352,600K confirmed) | ✅ (`https://www.admin.ks.gov/browse/files/aa7495fbfc7e4c02a9afe62e18c23305/download`) | ✅ (`https://www.admin.ks.gov/browse/files/d74a7e638a0947d5bb8369a5d35ebb48/download`) | **GREENLIGHT** — recency floor satisfied. |
| **ME** | FY2025 (Total Revenues $6,194,288K confirmed) | ✅ (`acfr2023.pdf`, 01/09/2024 filing date) | ✅ (`acfr2024.pdf`, 02/25/2025 filing date) | **GREENLIGHT** — recency floor satisfied. |

---

## Section 6 — Consolidated gap log (IA / KS / ME)

| State | FY | Gap reason | Disposition |
|-------|----|-----------|--------------|
| **IA** | FY1997–FY2001 | Archive lists these years (`das.iowa.gov/acfr-archive`) but pre-GASB-34 statement format not verified within the D-04 effort budget (FY2002 confirmed already has the modern GASB-34 statement). | Low priority — FY2002–FY2025 (24-year window) is more than sufficient for Phase-119 launch. Extend at load time if the pre-2002 format is confirmed compatible. |
| **IA** | (naming) | FY2025 filename embeds "Protected" (`ACFR FY2025 - Protected 12.22.2025.pdf`) — the PDF is owner-password-encrypted but `pdftotext -table` extracts cleanly regardless (confirmed). | No gap — informational only. Loader SOURCES map must enumerate the exact filename per year (opaque ePrints IDs, no derivable pattern). |
| **KS** | Pre-FY2019 | Current site's ACFR listing (`admin.ks.gov` "ACFR Reports" category) only enumerates FY2019–FY2025 (7 years). No older years discoverable within the D-04 effort budget; KS mentions EMMA (Electronic Municipal Market Access) as an alternate historical filing venue for FY2009+ but that was not verified as a durable direct-download source this pass. | Gap logged. FY2019–FY2025 (7-year window) is the confirmed clean window for Phase-119 launch. Pre-FY2019 is a load-time extension candidate (verify EMMA durability first). |
| **ME** | FY2020 | Filename exception: `acfr2020v2_0.pdf` instead of the derived `acfr2020.pdf`. | Loader SOURCES map must special-case FY2020. Otherwise durable — PDF confirmed present under the exception filename. No gap, just a naming variant (mirrors MA's FY2017 exception from Batch 1). |
| **ME** | Pre-FY2000 | Archive page listing starts at FY2000; no older years found within the D-04 effort budget. | Low priority — FY2000–FY2025 (26-year window) is the deepest confirmed window in the batch, more than sufficient for launch. |

---

## Section 7 — Loader template mapping + Phase-119 load notes (IA / KS / ME)

| State | Closest loader template | GF layout notes | Phase-119 load notes |
|-------|---------------------------|-------------------|------------------------|
| **IA** | `extract_gf.py` + `gen_state.py` (opaque per-year SOURCES map, NC/GA-style enumeration) | GF is first column of a 4-5-column layout (General Fund \| Tobacco Settlement Authority \| Tobacco Collections Fund \| Nonmajor \| Total in FY2025; General Fund \| Tobacco Tax-Exempt Bond Proceeds \| Nonmajor \| Total in FY2002). Total revenues line is labeled "NET REVENUES" (GROSS REVENUES less Revenue Refunds), not "Total revenues" — extractor must target NET REVENUES as the tie-check total, not assume a literal "Total revenues" label. Units = thousands. | Must enumerate all per-year opaque `publications.iowa.gov/{id}/` URLs from `das.iowa.gov/acfr-archive` into the SOURCES map — no derivable pattern. FY2025 file is owner-password-encrypted (extracts fine via `pdftotext -table`, confirmed). 24-year window FY2002–FY2025. |
| **KS** | `extract_gf.py` + `gen_state.py` (opaque per-year SOURCES map; wide multi-fund position-anchored extraction, similar to the v2.14 CO/MO wide-layout precedent) | GF is first column of an 8-column layout (General \| Social Services \| Health and Environment \| Transportation \| Executive \| Commerce \| Non-major Governmental \| Total Governmental). Units = thousands. | Must enumerate all per-year opaque `/browse/files/{hash}/download` URLs from the KS DOA ACFR category page — no derivable pattern. 7-year window FY2019–FY2025 (shallower than IA/ME; pre-FY2019 needs load-time investigation). |
| **ME** | `extract_gf.py` + `gen_state.py` (**derivable per-year SOURCES map**, MA-style pattern from Batch 1) | GF is first column of a 6-column layout (General \| Highway \| Federal \| Other Special Revenue \| Other Governmental Funds \| Total Governmental). Units = thousands. Federal revenue is booked to its OWN major fund column (not the General column) — keeps GF scope close to NASBO. | **Cleanest URL pattern in the batch** — `acfr{YYYY}.pdf` derivable for FY2000-FY2025 except the FY2020 naming exception (`acfr2020v2_0.pdf`, must special-case in the SOURCES map). 26-year window FY2000–FY2025, deepest in Batch 2. |

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

*(Sections for MS and MT to be added in Task 2, along with the final wrap-up.)*
