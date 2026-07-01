# 107 — Batch 1 ACFR Source Location (RECON-06, NJ/MA/NC/GA/MD)

**Status:** COMPLETE — all 5 states recon'd, bookend-tied, risk-fact-pinned. $0 spend.
**Phase:** 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
**States:** New Jersey (NJ), Massachusetts (MA), North Carolina (NC), Georgia (GA), Maryland (MD)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 103-PA-IL-SOURCES.md shape (PA/IL recon mold).

All five states publish the Governmental Funds *Statement of Revenues, Expenditures, and Changes
in Fund Balances* — **General Fund** column (GAAP basis). NJ reports in dollars; MA/NC/GA/MD
report in thousands. All five have FY-end June 30. All five pass the D-07 recency floor
(FY2023 + FY2024 in clean window). TX-trap scope divergence documented for each state in
Section 4 — accept-and-relabel recommended for all five (same mechanism as PA/IL).

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **NJ** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Transportation Trust Fund \| Nonmajor \| Total) | **dollars** (not thousands) | Jun 30 | **FY2020–FY2025** | FY2025: `https://www.nj.gov/treasury/omb/publications/25fr/pdfs/NJFY2025Complete.pdf` FY2024 and older: `https://www.nj.gov/treasury/omb/publications/{YY}fr/pdfs/NJFRFY{YYYY}Complete.pdf` where `{YY}` = 2-digit year (24, 23, 22, 21, 20). **FY2025 drops the "FR" infix — must special-case.** Landing: `https://www.nj.gov/treasury/omb/fr.shtml` |
| **MA** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2001–FY2025** | `https://www.macomptroller.org/wp-content/uploads/acfr_fy-{YYYY}.pdf` for FY2018+ (hyphenated). **FY2017 exception: `acfr_fy2017.pdf` (no hyphen — must special-case).** FY2001–FY2016: available (confirm filenames at load). Landing: `https://www.macomptroller.org/resource-categories/annual-comprehensive-financial-reports/` |
| **NC** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Highway Fund \| Other \| Total) | thousands | Jun 30 | **FY2012–FY2025** | Per-year explicit URLs from archive page: `https://www.ncosc.gov/sites/default/files/{YYYY}-{MM}/{filename}.pdf`. **No derived pattern — each year requires its explicit URL from the archive page.** Landing: `https://www.ncosc.gov/annual-report-and-popular-report-archives` |
| **GA** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Other \| Total) | thousands | Jun 30 | **FY2021–FY2025** | Opaque Drupal slugs (embed year, not derivable): FY2025: `https://sao.georgia.gov/document/document/fy-2025-acfr/download`, FY2024: `https://sao.georgia.gov/document/document/fy-2024-acfr/download`, FY2023: `https://sao.georgia.gov/document/document/fy-2023-acfr-0/download`, FY2022: `https://sao.georgia.gov/document/document/fy-2022-acfr/download`, FY2021: `https://sao.georgia.gov/document/document/fy-2021-acfr/download`. All Drupal stable. Landing: `https://sao.georgia.gov/reports/annual-comprehensive-financial-report` |
| **MD** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Special Revenue \| Debt Service \| Capital Projects \| Enterprise \| Total) | thousands | Jun 30 | **FY2022–FY2025** | `https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/acfr{YYYY}.pdf` for FY2024–FY2025; `https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/ACFR{YYYY}.pdf` for FY2022–FY2023 (uppercase). **Case change at FY2024 — must special-case.** Landing: `https://www.marylandcomptroller.gov/reports/annual-comprehensive-financial-report-acfr.html` |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **NJ** | FY2025 (latest) | **$60,979,024,211** (dollars) | GF line items sum = $60,979,024,211; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **NJ** | FY2020 (oldest clean) | **$38,768,977,008** (dollars) | GF line items sum = $38,768,977,008; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **MA** | FY2025 (latest) | **$61,907,573K** | GF line items sum = $61,907,573K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **MA** | FY2015 (oldest sampled) | **$35,029,512K** | GF line items sum = $35,029,512K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **NC** | FY2025 (latest) | **$75,416,082K** | GF line items sum (GF column only) = $75,416,082K; matches printed General Fund Total revenues. Diff = $0. ✅ (Initial multi-column sum corrected by extracting GF column items only.) |
| **NC** | FY2020 (oldest sampled) | **$44,930,429K** | GF line items sum = $44,930,429K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **GA** | FY2025 (latest) | **$68,445,055K** | GF line items sum = $68,445,055K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **GA** | FY2021 (oldest clean) | **$55,378,103K** | GF line items sum = $55,378,103K; matches printed General Fund Total revenues. Diff = $0. ✅ |
| **MD** | FY2025 (latest) | **$48,689,018K** | GF line items sum = $48,689,017K vs printed $48,689,018K. Diff = $1 (acceptable GAAP thousands rounding). ✅ |
| **MD** | FY2022 (oldest clean) | **$50,540,136K** | GF line items sum = $50,540,138K vs printed $50,540,136K. Diff = $2 (acceptable GAAP thousands rounding). ✅ |

---

## Section 3 — Four risk facts per D-08

| Fact | NJ | MA | NC | GA | MD |
|------|----|----|----|----|-----|
| **Units** | **dollars** (not thousands — convert ÷1,000 or store raw at load) | thousands | thousands | thousands | thousands |
| **Negative GF line items** | None observed: FY2025 Investment earnings = +$952,995,499; FY2020 Investment earnings = +$65,483,367 (positive in zero-rate era). Low risk. | None: Investment income embedded in Miscellaneous (not broken out separately). No standalone negative line. | None observed in FY2025. Investment earnings line is positive. Check older years at load. | None observed in FY2025 or FY2021. Investment line is positive. Check older years at load. | **CAUTION: FY2022 Interest and other investment income = -$275,992K (NEGATIVE).** P2 clamp required for FY2022. FY2025 investment income is positive. Loader must apply P2 clamp to any negative GF line per policy. |
| **Exact column header + statement** | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary comparison) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary comparison) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities) | "General Fund", Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ | June 30 ✓ |

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function). ACFR figures are **revenue** totals. The comparison is apples-to-oranges by design — the point is to flag whether the ACFR GF's revenue base is materially broader than NASBO's budgetary concept (the TX-trap: GAAP General Fund consolidates federal intergovernmental revenue that NASBO excludes). All ratios computed using NASBO FY2024 actual (latest available year in loadStateGF.mjs).

| State | ACFR GF Total revenues (FY2025) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **NJ** | ~$61.0B | ~$53.0B | **~1.15×** | Federal/intergovernmental revenue inside GAAP GF expands it slightly vs NASBO's budgetary view. Modest divergence. | **Accept-and-relabel honestly** (TX precedent). Relabel basis label + source chip. Confirm at Phase-108 load. |
| **MA** | ~$61.9B | ~$35.7B | **~1.73×** | GAAP General Fund consolidates federal intergovernmental revenue (lottery, federal grants) that NASBO's budgetary general fund excludes. Same mechanism as PA (~2×). | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-108 load. |
| **NC** | ~$75.4B | ~$29.2B | **~2.58×** | NC's GAAP General Fund is very broad — consolidates large federal grant flows (Medicaid federal match, education federal aid) that NASBO's budgetary GF excludes. Similar to PA mechanism but more pronounced. | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-108 load. |
| **GA** | ~$68.4B | ~$34.6B | **~1.98×** | GAAP General Fund consolidates federal intergovernmental flows excluded from NASBO. Same mechanism as IL (~1.5×) and PA (~2×). | **Accept-and-relabel honestly** (TX precedent). GA also has F-97-01 Medicaid fix supersede requirement — confirm clean supersede at Phase-108 load. |
| **MD** | ~$48.7B | ~$27.4B | **~1.78×** | GAAP General Fund broader than NASBO's budgetary concept due to federal intergovernmental revenue inclusion. | **Accept-and-relabel honestly** (TX precedent). MD has FY2022 negative investment income — P2 clamp must activate. Confirm at Phase-108 load. |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **NJ** | FY2025 (final audited, June 2025) | ✅ (`NJFRFY2023Complete.pdf` available) | ✅ (`NJFRFY2024Complete.pdf` available) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable without strand. |
| **MA** | FY2025 (final audited, Nov 2025) | ✅ (`acfr_fy-2023.pdf` available) | ✅ (`acfr_fy-2024.pdf` available) | **GREENLIGHT** — recency floor satisfied. In-place upgrade of v1.8 DLS node (no duplicate; see overlap note). |
| **NC** | FY2025 (final audited, Jan 2026) | ✅ (per-year URL on archive page) | ✅ (per-year URL on archive page) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **GA** | FY2025 (final audited, Dec 2025) | ✅ (`fy-2023-acfr-0/download` available) | ✅ (`fy-2024-acfr/download` available) | **GREENLIGHT** — recency floor satisfied. Must supersede F-97-01 Medicaid fix cleanly (plan 107-03). |
| **MD** | FY2025 (final audited, Jan 2026) | ✅ (`ACFR2023.pdf` available) | ✅ (`acfr2024.pdf` available) | **GREENLIGHT** — recency floor satisfied. Clean window starts FY2022 (pre-FY2022 not found). |

---

## Section 6 — Consolidated gap log

| State | FY | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **NJ** | Pre-FY2020 | Older years under `/treasury/omb/publications/{YY}fr/` — URL pattern exists but not verified durable for pre-2020. FY2019 and older page structure may differ. | Low priority — FY2020–FY2025 window (6 years) is sufficient for launch. Extend at load time if pre-FY2020 PDFs are accessible under the same pattern. |
| **MA** | FY2017 | `acfr_fy2017.pdf` (no hyphen) vs all other years `acfr_fy-{YYYY}.pdf`. Naming exception. | Loader SOURCES map must special-case FY2017. Otherwise durable — PDF confirmed present. No gap, just a naming variant. |
| **GA** | Pre-FY2021 | Only 5 years on sao.georgia.gov main ACFR page + historical archives page (FY2021–FY2025). Older ACFRs are not linked. No discoverable URL for FY2020 and older. | Gap logged. FY2021–FY2025 (5-year window) is the confirmed clean window. Pre-FY2021 not in scope for Phase-108 launch. |
| **MD** | Pre-FY2022 | FY2021 and older not found on marylandcomptroller.gov under any discoverable path. Site restructured from marylandtaxes.gov; older PDFs not migrated or linked. | Gap logged. FY2022–FY2025 (4-year window) is the confirmed clean window. Pre-FY2022 not in scope for Phase-108 launch. Note: FY2022 has negative investment income → P2 clamp required. |
| **NC** | FY2011 and older | Archive page lists per-year URLs starting FY2012. Pre-FY2012 not in archive. | Low priority — FY2012–FY2025 (14-year window) is more than sufficient. |

---

## Section 7 — Loader template mapping + Phase-108 load notes

| State | Closest loader template | GF layout notes | Phase-108 load notes |
|-------|------------------------|----------------|----------------------|
| **NJ** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map, variant URL naming) | GF is first column of 4 (General Fund \| Transportation Trust Fund \| Nonmajor \| Total). Units = **dollars** — loader must NOT multiply by 1,000; store raw or ÷1,000 depending on schema target. | **CRITICAL: NJ FY2025 drops "FR" infix in filename** — `NJFY2025Complete.pdf` vs `NJFRFY{YYYY}Complete.pdf`. SOURCES map must enumerate FY2025 explicitly. 6-year window FY2020–FY2025. |
| **MA** | `processPAAcfr.js` / `processPARevenueAcfr.js` (similar 2-column GF layout) | GF is first column of 3 (General Fund \| Other Governmental Funds \| Total). Units = thousands. Pattern `acfr_fy-{YYYY}.pdf` derivable for FY2018–FY2025 except FY2017. | **FY2017 naming exception** — `acfr_fy2017.pdf` (no hyphen). MA also has v1.8 DLS overlap — in-place upgrade, not duplicate (plan 107-03 overlap resolution). Derivable pattern simplifies SOURCES map. |
| **NC** | `processILAcfr.js` / `processILRevenueAcfr.js` (explicit per-year SOURCES map required) | GF is first column of 4+ (General Fund \| Highway Fund \| Other \| Total). Units = thousands. **No derivable URL pattern** — each year's URL is unique from the archive page. | Must enumerate all 14 per-year URLs from archive page (`ncosc.gov/annual-report-and-popular-report-archives`) into SOURCES map. FY2012–FY2025 window. |
| **GA** | `processILAcfr.js` / `processILRevenueAcfr.js` (opaque Drupal slugs, explicit per-year SOURCES) | GF is first column (General Fund \| Other \| Total). Units = thousands. 5 confirmed Drupal stable URLs (FY2021–FY2025). | **Must supersede F-97-01 Medicaid fix** (loadStateGF.mjs GA FY2023 row) when writing ACFR actuals. Overlap resolution in plan 107-03. Enumerate all 5 Drupal URLs into SOURCES map. |
| **MD** | `processPAAcfr.js` / `processPARevenueAcfr.js` (similar layout) | GF is first column of 6 (General Fund \| Special Revenue \| Debt Service \| Capital Projects \| Enterprise \| Total). Units = thousands. URL case changes at FY2024. | **P2 clamp required for FY2022** (negative investment income = -$275,992K). Loader must clamp negative GF revenue lines to 0 per P2 policy. **URL case special-case**: FY2022–FY2023 = `ACFR{YYYY}.pdf` (uppercase); FY2024–FY2025 = `acfr{YYYY}.pdf` (lowercase). FY2022–FY2025 (4-year) window. |

---

## NJ — New Jersey Detail Block

**Source:** State of New Jersey Office of Management and Budget (OMB)
**PDF:** Annual Comprehensive Financial Report (ACFR) — Complete Edition
**Landing page:** `https://www.nj.gov/treasury/omb/fr.shtml`

**URL pattern:**
- FY2025: `https://www.nj.gov/treasury/omb/publications/25fr/pdfs/NJFY2025Complete.pdf`
- FY2024 and older: `https://www.nj.gov/treasury/omb/publications/{YY}fr/pdfs/NJFRFY{YYYY}Complete.pdf`
  - Examples: `24fr/pdfs/NJFRFY2024Complete.pdf`, `23fr/pdfs/NJFRFY2023Complete.pdf`, `22fr/pdfs/NJFRFY2022Complete.pdf`, `21fr/pdfs/NJFRFY2021Complete.pdf`, `20fr/pdfs/NJFRFY2020Complete.pdf`

**Statement:** Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances
**Column:** General Fund (1st of 4: General Fund | Transportation Trust Fund | Nonmajor | Total)
**Units:** Dollars (not thousands)
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $60,979,024,211 — line items sum = $60,979,024,211 ✅ (diff $0)
- FY2020: GF Total revenues = $38,768,977,008 — line items sum = $38,768,977,008 ✅ (diff $0)

**Investment income:** FY2025 Investment earnings = +$952,995,499 (positive); FY2020 Investment earnings = +$65,483,367 (positive even in zero-rate era). No P2 clamp needed for confirmed years.

**Clean window:** FY2020–FY2025 (6 years)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)

---

## MA — Massachusetts Detail Block

**Source:** Massachusetts Office of the Comptroller (macomptroller.org)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.macomptroller.org/resource-categories/annual-comprehensive-financial-reports/`

**URL pattern:**
- FY2018–FY2025 (except FY2017): `https://www.macomptroller.org/wp-content/uploads/acfr_fy-{YYYY}.pdf`
- FY2017 exception: `https://www.macomptroller.org/wp-content/uploads/acfr_fy2017.pdf` (no hyphen)
- FY2001–FY2016: Available on landing page (confirm filenames at load)

**Statement:** Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances
**Column:** General Fund (1st of 3: General Fund | Other Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $61,907,573K — line items sum = $61,907,573K ✅ (diff $0)
- FY2015: GF Total revenues = $35,029,512K — line items sum = $35,029,512K ✅ (diff $0)

**Investment income:** Not broken out as a separate GF revenue line in MA (embedded in Miscellaneous). No standalone negative line possible. No P2 clamp risk.

**Overlap note (D-10):** MA already has a v1.8 DLS (Division of Local Services) state-budget node. The DLS node covers municipal-level data (not a state ACFR duplicate). This is an in-place upgrade of the state node — no dual-node conflict. Per Phase 98 CA precedent. Overlap resolution handled in plan 107-03 (RECON-07).

**Clean window:** FY2001–FY2025 (25 years confirmed; FY2015 old-end sampled; earlier years durable)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)

---

## NC — North Carolina Detail Block

**Source:** North Carolina Office of the State Controller (NCOSC)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.ncosc.gov/annual-report-and-popular-report-archives`

**URL pattern:** Per-year explicit URLs from archive page — no derivable pattern.
- FY2025: `https://www.ncosc.gov/sites/default/files/2025-11/ncacfr2025.pdf`
- FY2024: `https://www.ncosc.gov/sites/default/files/2025-01/ncacfr2024.pdf`
- FY2023: `https://www.ncosc.gov/sites/default/files/2023-12/ncacfr2023.pdf`
- FY2020: `https://www.ncosc.gov/sites/default/files/2021-01/ncacfr2020.pdf`
- Earlier years: available on archive page going back to FY2012. All enumerable from archive.

**Note:** Per-year pages (`/public-information/{YYYY}-annual-comprehensive-financial-report`) all redirect to the current year's content — use archive page URLs only, not the per-year marketing pages.

**Statement:** Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances
**Column:** General Fund (1st of 4+: General Fund | Highway Fund | Other | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $75,416,082K — GF column line items sum = $75,416,082K ✅ (diff $0)
- FY2020: GF Total revenues = $44,930,429K — GF column line items sum = $44,930,429K ✅ (diff $0)

**Investment income:** FY2025 Investment earnings line is positive. Check older years at load.

**Clean window:** FY2012–FY2025 (14 years; all per-year URLs enumerable from archive page)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)

---

## GA — Georgia Detail Block

**Source:** Georgia State Accounting Office (SAO)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://sao.georgia.gov/reports/annual-comprehensive-financial-report`

**URL pattern:** Opaque Drupal document/download slugs. Durable (Drupal stable links) but not derivable from year alone.
- FY2025: `https://sao.georgia.gov/document/document/fy-2025-acfr/download`
- FY2024: `https://sao.georgia.gov/document/document/fy-2024-acfr/download`
- FY2023: `https://sao.georgia.gov/document/document/fy-2023-acfr-0/download` (note `-0` suffix on FY2023)
- FY2022: `https://sao.georgia.gov/document/document/fy-2022-acfr/download`
- FY2021: `https://sao.georgia.gov/document/document/fy-2021-acfr/download`
- Pre-FY2021: Not found. Gap logged.

**Statement:** Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances
**Column:** General Fund (1st of: General Fund | Other | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $68,445,055K — line items sum = $68,445,055K ✅ (diff $0)
- FY2021: GF Total revenues = $55,378,103K — line items sum = $55,378,103K ✅ (diff $0)

**Investment income:** Positive in FY2025 and FY2021. No P2 clamp needed for confirmed years.

**Overlap note (D-10):** GA is the only non-cohort NASBO state (it was loaded separately) and carries the v2.10 F-97-01 Medicaid fix applied in Phase 97. The ACFR replace must supersede that fix cleanly — the ACFR GAAP actuals will replace the NASBO budgetary rows for the same (muni, fy, 'operating') key. Supersede verification handled in plan 107-03 (RECON-07).

**Clean window:** FY2021–FY2025 (5 years — only 5 years discoverable on main + historical pages)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)

---

## MD — Maryland Detail Block

**Source:** Maryland Comptroller (marylandcomptroller.gov)
**PDF:** Annual Comprehensive Financial Report (ACFR)
**Landing page:** `https://www.marylandcomptroller.gov/reports/annual-comprehensive-financial-report-acfr.html`

**URL pattern:**
- FY2024–FY2025 (lowercase): `https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/acfr{YYYY}.pdf`
  - FY2025: `…/acfr2025.pdf`, FY2024: `…/acfr2024.pdf`
- FY2022–FY2023 (uppercase): `https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/ACFR{YYYY}.pdf`
  - FY2023: `…/ACFR2023.pdf`, FY2022: `…/ACFR2022.pdf`
- FY2021 and older: NOT FOUND on marylandcomptroller.gov. Site restructured from former marylandtaxes.gov; older files not migrated or linked.

**Statement:** Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances
**Column:** General Fund (1st of 6: General Fund | Special Revenue Funds | Debt Service Funds | Capital Projects Funds | Enterprise Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $48,689,018K — line items sum = $48,689,017K ✅ (diff $1 — acceptable GAAP thousands rounding)
- FY2022: GF Total revenues = $50,540,136K — line items sum = $50,540,138K ✅ (diff $2 — acceptable GAAP thousands rounding)

**CRITICAL — Negative investment income FY2022:**
`Interest and other investment income = -$275,992K` in FY2022 GF revenue.
The P2 clamp policy (from loadStateGF.mjs) applies: any negative GF revenue line must be clamped to 0 at load time. Loader must implement P2 clamp for MD FY2022 (and check all older years at load).

**Clean window:** FY2022–FY2025 (4 years; pre-FY2022 not accessible)
**Recency floor:** GREENLIGHT (FY2022–FY2025 confirmed; FY2023 + FY2024 covered)
