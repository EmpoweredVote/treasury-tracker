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
| _(pending document access — see paths above)_ | | | | | | | |

*Prior-phase precedent (all PASS, same method): LA County FY23 −5.0% op (full-accrual depreciation/pension); Santa Monica FY23 +10.0% op (ISF gross); Pasadena FY23 +19.5% op (large ISF portfolio + PWP inter-fund); Ventura County FY22 reconciled to ACFR fund statements within all-funds tolerance.*
