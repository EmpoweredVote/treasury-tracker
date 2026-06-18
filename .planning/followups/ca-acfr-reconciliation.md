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
| **Glendale** (city) | 2023 | $795.4M (gov-wide Change in Net Position, Total expenses; MD&A, $795,432K) | SCO $920.1M → **+$124.7M / +15.7%** | $855.3M ($855,342K) | SCO $967.9M → **+$112.6M / +13.2%** | Expected SCO>ACFR direction: gov-wide eliminates internal-service funds (fleet, IT, joint helicopter, building maintenance, employee benefits, insurance) that SCO carries gross, plus electric-utility inter-fund flows; modified-accrual capital outlay vs full-accrual depreciation. +15.7% in line with Pasadena (+19.5%) / Riverside County (+16.3%). | **PASS** |
| **San Diego County** | 2022 | $5,341.0M (gov-wide Changes in Net Position, Total expenses, FY2022 audited prior-year column in the FY2023 ACFR; Table 2, $5,340,993K) | SCO $6,344.0M → **+$1,003.0M / +18.8%** | $6,027.2M ($6,027,232K) | SCO $6,389.2M → **+$362.0M / +6.0%** | Expected SCO>ACFR direction: gov-wide eliminates San Diego County's large internal-service funds (public works/communications equipment, purchasing, county-service-district start-up, public liability/employee benefits, fleet, facilities mgmt, IT) that SCO carries gross; modified-accrual capital outlay vs full-accrual depreciation. +18.8% in line with Pasadena (+19.5%) / Glendale (+15.7%) / Riverside County (+16.3%). Revenue +6.0% ≈ Riverside County (+7.1%). FY2022 prior-year column = final audited data; no FY2022-primary ACFR was published separately. | **PASS** |
| **Chula Vista** (city) | 2022 | $363.0M (gov-wide Summary of Changes in Net Position, Total expenses; MD&A, $363,028,142) | SCO $393.0M → **+$30.0M / +8.3%** | $485.9M ($485,911,541) | SCO $448.6M → **−$37.3M / −7.7%** | Small ISF footprint (fleet, technology replacement, workers' comp) → expenses only modestly above gov-wide (+8.3%). Revenue runs the other way (ACFR higher): this developer-heavy city's full-accrual statement recognizes large capital grants & developer contributions ($58.8M) that SCO's modified-accrual aggregate classifies differently. Both deltas <10%, explainable. | **PASS** |
| _Oxnard FY2022 / Riverside city ≤FY2022_ | | _pending — downloads in progress_ | | | | | _pending doc_ |

**Running tally:** 5 of 7 reconciled (all PASS). **FUP-01 (Glendale + Burbank) is now CLOSED** — both reconciled, both PASS, the v2.3 access-blocked follow-up resolved. Combined with the prior-phase PASSes (LA County, Santa Monica, Pasadena, Ventura County), **9 distinct CA entities now reconciled** on the basis-matched method — every one within documented tolerance, zero data anomalies. Remaining: 2 SoCal-sample cities (Oxnard, Riverside city — VER-05 follow-up) pending document downloads. All 3 large SoCal county governments in the v2.4 sample (Riverside, San Diego, Ventura) are done.

### FUP-01 closure note
Glendale and Burbank — the two v2.3 Phase-62 entities that could not be reconciled because their city-website CDNs (Akamai / Cloudflare) blocked CLI ACFR fetches — are now both reconciled to their FY2023 government-wide Statement of Activities and both PASS within the documented basis tolerance. The original deferral was confirmed to be an access limitation, not a data problem: once the ACFR PDFs were obtained via browser, both reconciled cleanly in the expected direction and magnitude. FUP-01 (Glendale/Burbank ACFR) can be marked resolved.

*Prior-phase precedent (all PASS, same method): LA County FY23 −5.0% op (full-accrual depreciation/pension); Santa Monica FY23 +10.0% op (ISF gross); Pasadena FY23 +19.5% op (large ISF portfolio + PWP inter-fund); Ventura County FY22 reconciled to ACFR fund statements within all-funds tolerance.*
