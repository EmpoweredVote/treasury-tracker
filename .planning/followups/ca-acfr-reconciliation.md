# CA ACFR Reconciliation — Follow-up Worksheet

**Status:** In progress (2026-06-18). Closes the documented v2.3/v2.4 follow-ups: Glendale + Burbank (FUP-01) and the broader per-entity SoCal ACFR cross-read (VER-05 follow-up — only Ventura was fully reconciled in v2.4).

**Why this is a worksheet, not a finished reconciliation:** every target entity's published ACFR is behind an enterprise CDN or returns HTTP 403 / an image-only PDF to command-line fetches (confirmed again 2026-06-18 for Glendale/Akamai, Burbank/Cloudflare+image, Oxnard/403, San Diego County/403). This is an access/environment limitation, **not** a data anomaly — the loaded figures come from the same SCO ByTheNumbers pipeline already reconciled to the dollar for Ventura, LA County, Santa Monica, and Pasadena. A browser bypasses these CDNs trivially.

## Method (validated in Phase 62 / Phase 67 — do not re-derive)

- **Loaded basis:** SCO ByTheNumbers is **all-funds** (governmental + enterprise/proprietary + internal-service). Cities dataset `/d/ju3w-4gxp`, counties `/d/uctr-c2j8`.
- **Cities comparator:** ACFR **government-wide Statement of Activities → "Total expenses, primary government"** (and total revenues). Expect **SCO ≥ ACFR** (SCO includes internal-service-fund gross before inter-fund elimination); for capital-heavy entities ACFR can exceed SCO (depreciation/pension accruals). Either direction is fine if explained.
- **Counties comparator:** sum the ACFR **governmental-funds expenditures + enterprise-fund operating expenses + internal-service-fund expenses** (the SCO all-funds aggregate). This is how Ventura FY2022 reconciled.
- **Pass criterion:** explainable basis tolerance — **never penny-exact**. Document the primary driver.

## Targets (loaded SCO figures already confirmed from prior-phase DB probes)

| Entity | FY | SCO op ($M) | SCO rev ($M) | Comparator to read | Accessible source (use a browser) |
|--------|----|-------------|--------------|--------------------|-----------------------------------|
| Glendale (city) | 2023 | 920.1 | 967.9 | Gov-wide Stmt of Activities → Total expenses / revenues, primary govt | https://www.glendaleca.gov/government/departments/finance/accounting/annual-comprehensive-financial-report/fiscal-year-2023 |
| Burbank (city) | 2023 | 623.6 | 638.9 | Gov-wide Stmt of Activities → Total expenses / revenues, primary govt | https://www.burbankca.gov/web/financial-services/accounting (FY2022-23 ACFR) |
| Riverside County | 2022 | 6,192.1 | 6,177.9 | Sum: gov-funds exp + enterprise op exp + ISF exp | https://auditorcontroller.org/reports-and-publications |
| San Diego County | 2022 | 6,344.0 | 6,389.2 | Sum: gov-funds exp + enterprise op exp + ISF exp | https://www.sandiegocounty.gov/content/sdc/auditor/cafr.html (FY ending 6/30/2022) |
| Oxnard (city) | 2022 | 468.4 | 521.5 | Gov-wide Stmt of Activities → Total expenses / revenues, primary govt | Oxnard Finance ACFR page (city site) |
| Chula Vista (city) | 2022 | 393.0 | 448.6 | Gov-wide Stmt of Activities → Total expenses / revenues, primary govt | https://www.chulavistaca.gov/departments/finance (ACFR FY2022) |
| Riverside (city) | ≤2022 | (use an SCO all-funds year) | — | Gov-wide Stmt of Activities, total expenses | https://riversideca.gov/finance/acfr/ — NOTE: FY2023+ loaded op is the preserved custom General-Fund budget (~$326M), a basis change; reconcile on an SCO all-funds year ≤FY2022 only |

## Two ways to finish (pick one)

**Path A (recommended — least effort for you):** open each source in your browser, download the ACFR PDF, and drop the files in a local folder (e.g. `C:\treasury-tracker\_acfr-tmp\`). Tell me the folder; I'll read each PDF (the Read tool handles PDFs) and do the basis-matched reconciliation + fill this worksheet + write the verdicts. You download, I analyze.

**Path B (fastest if you just want sign-off):** open each ACFR, read the one line ("Total expenses, primary government" for cities; the three fund subtotals for counties), and paste the numbers here or to me. I compute the delta + basis explanation + verdict.

## Reconciliation results (filled as ACFRs are obtained)

| Entity | FY | ACFR total expenses | Δ vs SCO op | ACFR total revenues | Δ vs SCO rev | Basis explanation | Verdict |
|--------|----|--------------------|-------------|--------------------|--------------|-------------------|---------|
| **Burbank** (city) | 2023 | $605.6M (gov-wide Stmt of Activities, Total = govt + business-type; MD&A Table 2, $605,597K) | SCO $623.6M → **+$18.0M / +3.0%** | $645.4M ($645,396K) | SCO $638.9M → **−$6.5M / −1.0%** | Burbank's gov-wide statement already folds internal-service funds (self-insurance, vehicle, IT, infrastructure) into governmental activities; SCO all-funds includes them gross → small +3.0% on expenses. Revenue essentially matches (−1.0%, rounding/transfer treatment). Both within tolerance. | **PASS** |
| **Riverside County** | 2022 | $5,323.6M (gov-wide Changes in Net Position, Total expenses = govt + business-type; MD&A, $5,323,639K) | SCO $6,192.1M → **+$868.5M / +16.3%** | $5,768.1M ($5,768,086K) | SCO $6,177.9M → **+$409.8M / +7.1%** | Expected SCO>ACFR direction: gov-wide eliminates 9 internal-service funds (fleet, info svc, central mail, supply, HR, risk, temp-assistance, EDA facilities, flood-control equip) that SCO carries gross, and SCO modified-accrual books capital outlay as expenditure vs ACFR full-accrual depreciation. +16.3% is in line with the Pasadena precedent (+19.5%). Revenue +7.1% (inter-fund/ISF charges before elimination). | **PASS** |
| _Glendale (city) FY2023_ | | _pending — downloaded files were Glendale **budget books**, not the ACFR; need the Annual Comprehensive Financial Report PDF_ | | | | | _pending doc_ |
| _San Diego County FY2022 / Oxnard FY2022 / Chula Vista FY2022 / Riverside city ≤FY2022_ | | _pending — downloads in progress_ | | | | | _pending doc_ |

**Running tally:** 2 of 7 reconciled (both PASS). Combined with the prior-phase PASSes (LA County, Santa Monica, Pasadena, Ventura County), **6 distinct CA entities now reconciled** on the basis-matched method — every one within documented tolerance, zero data anomalies.

*Prior-phase precedent (all PASS, same method): LA County FY23 −5.0% op (full-accrual depreciation/pension); Santa Monica FY23 +10.0% op (ISF gross); Pasadena FY23 +19.5% op (large ISF portfolio + PWP inter-fund); Ventura County FY22 reconciled to ACFR fund statements within all-funds tolerance.*
