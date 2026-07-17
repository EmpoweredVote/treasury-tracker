# 131-RECON — Pima County Municipalities ACFR Recon (PIMA-01, PIMA-02)

**Phase:** 131 · **Date:** 2026-07-16 · **Window decision:** FY2019–FY2024 common (6-yr), per Chris (deeper Oro Valley history to ~FY2006 deferred to a future deepening pass).

All four target municipalities publish audited governmental-funds financial statements from which the **General Fund** column extracts cleanly and **bookend-ties its printed *Total revenues* / *Total expenditures* at exactly $0** via `pdftotext -table`. The generalized extractor `scripts/extractAcfrGF.py` (PIMA-03) produces the trees; its full dry-run tie table is below.

## Method & unit basis

- Extraction: `pdftotext -table <pdf> -` (poppler 4.00). **`-layout` never used** (scrambles the multi-fund columns). General Fund = the **first data column**; columns isolated positionally from the fully-populated `Total revenues`/`Total expenditures` anchor rows.
- **Unit basis = whole dollars** for all four (verified by magnitude sanity: Marana FY2024 GF ≈ $94.2M rev / $59.8M exp; South Tucson FY2022 ≈ $6.2M / $5.9M — consistent with each town's size). No thousands-scaled governmental-funds statements encountered.
- Correctness oracle: `tie_delta = computed − printed` must be **0**; a non-zero delta fails loud (non-zero exit). Cross-check: `rev.computed − op.computed == printed Excess (deficiency)` — 0 mismatches where the Excess row was machine-captured; internally consistent otherwise.

## Retrieval deviation (precedented — same as v2.15 NH)

Two of four city origins return **HTTP 403 "Access Denied"** to automated clients (an edge WAF; the PDFs open fine in a human browser). Retrieval therefore uses public mirrors; the **canonical origin URL is pinned as the stored `source_url`** (it resolves for real users), with the mirror recorded as the fetch mechanism:

| City | Origin host | Automated fetch | Retrieval path used |
|------|-------------|-----------------|---------------------|
| Oro Valley | orovalleyaz.gov | ❌ 403 WAF | **Wayback Machine** (`web.archive.org/web/<ts>id_/`) |
| Marana | maranaaz.gov | ❌ 403 WAF | **Wayback Machine** |
| Sahuarita | sahuaritaaz.gov | ✅ 200 | **direct** (`/DocumentCenter/View/<id>`) |
| South Tucson | southtucsonaz.gov | ❌ 403 WAF | **AZ ADE mirror** (`ade.az.gov`) / Wayback of own-site file path |

PDFs are stored in gitignored `docs/<City>/` on `main` (not a worktree).

## Locked clean-extract windows

- **Locked clean-extract window (Oro Valley):** FY2019–FY2024 (6 yr, contiguous). _Deeper: CAFRs exist back to ~FY2006 (deferred)._
- **Locked clean-extract window (Marana):** FY2019–FY2024 (6 yr, contiguous). _Marana's public archive does not go earlier._
- **Locked clean-extract window (Sahuarita):** FY2019–FY2024 (6 yr, contiguous). _Sahuarita publishes back to FY2015 (deferred)._
- **Locked clean-extract window (South Tucson):** FY2019–FY2022 (4 yr, contiguous). _FY2023–FY2024 = documented holes (not yet published)._

## South Tucson source verdict (PIMA-02)

**Verdict: (a) LOAD-FROM-ACFR.** The feared "AFR-only / not-icicle-grade" case did **not** materialize. South Tucson's FY2022 report is a titled **Annual Comprehensive Financial Report (FYE June 30, 2022)** containing a full governmental-funds *Statement of Revenues, Expenditures and Changes in Fund Balances*; the GF column extracts and ties at $0 (rev $6,201,468 / exp $5,883,806). FY2019–FY2021 reports are labeled "Annual Financial Report" but carry the same governmental-funds statement, and all tie $0. Load FY2019–FY2022.

- **Evidence:** own-site `/finance/page/annual-financial-statements` (via Wayback) lists FY2007–FY2022; ADE mirror `ade.az.gov/sfsinbound/GeneralUpload/194104.pdf` = FY2022 ACFR (200, `application/pdf`, 2.37 MB, 7× "Statement of Revenues, Expenditures").
- **FY2023–FY2024 = holes:** not yet published. South Tucson files late (its site carries "Notice of Pending Financial Statement Filing" placeholders with the AZ Auditor General). These two years load when published; no source exception needed for FY2019–2022.

## Per-year source table (canonical origin URLs)

### Oro Valley — retrieved via Wayback
| FY | Canonical `source_url` |
|----|------------------------|
| 2019 | https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-oro-valley-az-comprehensive-annual-financial-report-fye-06-30-2019.pdf |
| 2020 | https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-cafr-20-final.pdf |
| 2021 | https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-acfr-21-final-1.pdf |
| 2022 | https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-of-oro-valley-az-annual-comprehensive-financial-report-fye-6-30-2022.pdf |
| 2023 | https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-of-oro-valley-annual-comprehensive-financial-report-fye-06-30-2023.pdf |
| 2024 | https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-acfr-24.pdf |

### Marana — retrieved via Wayback
| FY | Canonical `source_url` |
|----|------------------------|
| 2019 | https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/attachments_co15061000018356399_ka1k7fxxra6nxlutydef_fy2019cafrelectronic.pdf |
| 2020 | https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/finalfy20cafr.pdf |
| 2021 | https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/finalmaranaacfrfy21.pdf |
| 2022 | https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/unsecurefinalmaranaacfrfy22.pdf |
| 2023 | https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/7htpvn1rosfbkwjzqgdj_finalfy23acfr.pdf |
| 2024 | https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/2024-town-of-marana-acfr-final.pdf |

### Sahuarita — direct
| FY | Canonical `source_url` |
|----|------------------------|
| 2019 | https://sahuaritaaz.gov/DocumentCenter/View/4956 |
| 2020 | https://sahuaritaaz.gov/DocumentCenter/View/6361 |
| 2021 | https://sahuaritaaz.gov/DocumentCenter/View/7162 |
| 2022 | https://sahuaritaaz.gov/DocumentCenter/View/8597 |
| 2023 | https://sahuaritaaz.gov/DocumentCenter/View/10080 |
| 2024 | https://sahuaritaaz.gov/DocumentCenter/View/11908 |

### South Tucson — retrieved via ADE mirror / Wayback of own-site file path
| FY | Canonical `source_url` |
|----|------------------------|
| 2019 | https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/4463/annual_financial_report_fye_6-30-2019.pdf |
| 2020 | https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/20_south_tucson-afr.pdf |
| 2021 | https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2021.pdf |
| 2022 | https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2022.pdf (ADE mirror: https://www.ade.az.gov/sfsinbound/GeneralUpload/194104.pdf) |
| 2023 | — HOLE (not yet published) |
| 2024 | — HOLE (not yet published) |

## Dry-run tie results (`scripts/extractAcfrGF.py`, both modes)

Every in-scope (city × FY × mode) ties the printed GF total at exactly $0.

| City | FY | Rev computed | Exp computed | Rev d | Exp d | Stmt pg |
|------|----|-------------:|-------------:|:-----:|:-----:|:-------:|
| Oro Valley | 2019 | 40,924,353 | 35,448,052 | 0 | 0 | 49 |
| Oro Valley | 2020 | 41,065,979 | 37,962,660 | 0 | 0 | 50 |
| Oro Valley | 2021 | 53,628,289 | 39,532,776 | 0 | 0 | 50 |
| Oro Valley | 2022 | 55,499,679 | 51,254,966 | 0 | 0 | 54 |
| Oro Valley | 2023 | 56,920,753 | 48,464,723 | 0 | 0 | 54 |
| Oro Valley | 2024 | 59,077,316 | 50,170,504 | 0 | 0 | 52 |
| Marana | 2019 | 50,147,453 | 39,674,172 | 0 | 0 | 53 |
| Marana | 2020 | 52,840,154 | 42,402,824 | 0 | 0 | 57 |
| Marana | 2021 | 67,075,206 | 40,135,110 | 0 | 0 | 57 |
| Marana | 2022 | 75,874,651 | 44,574,470 | 0 | 0 | 54 |
| Marana | 2023 | 80,636,006 | 60,559,777 | 0 | 0 | 54 |
| Marana | 2024 | 94,153,099 | 59,821,670 | 0 | 0 | 53 |
| Sahuarita | 2019 | 17,760,711 | 15,763,375 | 0 | 0 | 40 |
| Sahuarita | 2020 | 19,998,382 | 15,450,037 | 0 | 0 | 38 |
| Sahuarita | 2021 | 23,182,922 | 20,407,440 | 0 | 0 | 40 |
| Sahuarita | 2022 | 24,411,649 | 20,080,061 | 0 | 0 | 44 |
| Sahuarita | 2023 | 26,852,671 | 21,516,785 | 0 | 0 | 42 |
| Sahuarita | 2024 | 32,166,628 | 23,924,397 | 0 | 0 | 40 |
| South Tucson | 2019 | 5,138,816 | 5,034,119 | 0 | 0 | 26 |
| South Tucson | 2020 | 5,646,186 | 5,555,457 | 0 | 0 | 26 |
| South Tucson | 2021 | 6,207,597 | 5,424,024 | 0 | 0 | 25 |
| South Tucson | 2022 | 6,201,468 | 5,883,806 | 0 | 0 | 25 |

**Regression oracle:** the generalized extractor reproduces **Tucson FY2024** at $0 in both modes (revenue 773,493,270 / operating 648,657,363) — the generalization does not break the shipped city. `extractTucson.py` and `processTucson.js` are untouched.

## Extractor notes (PIMA-03)

- **Structure derived from the statement**, not hardcoded: expenditure parents come from section-header rows (label-only, trailing `:` — e.g. `Current:`, `Debt service:`); `Capital outlay`/`Capital projects` are root leaves; intermediate `Total <section>` subtotals are skipped. Handles both cities that print parent subtotals and those that print only the grand total (South Tucson).
- **Fix applied this phase:** a $0-GF row with dash placeholder cells (e.g. OV "Highway and streets — — —") no longer bleeds its label into the next valued row (previously produced "Highway and streets - - Transit"). All ties re-verified $0 after the fix.
- **Known cosmetic artifact (Oro Valley only, FY2020+):** OV's newer PDFs render some glyphs space-separated under `-table` ("Tran s it" for Transit, "In teres t" for Interest, "in v es tmen ts" for investments). Values and ties are correct; only these leaf **labels** are affected. Deferred to Phase 132 as a small OV label-normalization step at load (mirrors the v2.17 precedent that deferred Tucson's analogous wrapped-label cosmetic).

## Holes summary

| City | FY | Reason |
|------|----|--------|
| South Tucson | 2023 | Not yet published (city files late) |
| South Tucson | 2024 | Not yet published (city files late) |

Load total for Phase 132: Oro Valley 6 + Marana 6 + Sahuarita 6 + South Tucson 4 = **22 (FY × city)**, each with GF operating + revenue.
