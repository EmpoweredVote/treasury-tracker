# 108-03 SUMMARY — North Carolina ACFR Upgrade

**Requirements:** ACFR-11, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (12-yr window; 2 honest holes) · **Spend:** $0

## What shipped
- `scripts/processNCAcfr.js` + `scripts/processNCRevenueAcfr.js`, **reusing the shared parser** `scripts/maAcfrExtract.mjs` (generic `extractGovFundGeneralColumn`).
- NC state node (`dd5281e8`) NASBO→ACFR GAAP: GF revenue-by-source (~19–23 sources) + spending-by-function (11 functions), **FY2014–2025 (12 yrs)**.

## Approach: PARSER (reused from MA)
NC's statement is functional-level but has 4+ fund columns (General | Highway | Other Highway | Other Governmental | Total). The parser takes the **GENERAL FUND (1st numeric) column ONLY** — this directly avoids the recon-flagged multi-column-sum error. Every FY gated by an exact GF total-tie.

## FY window
**Loaded 12:** FY2014–2025 (all tie $0). **Honest holes 2:** FY2012, FY2013 (older format — parser anchors not present; recoverable in follow-up).

## Bookends (exact)
FY2025 rev **75,416,082K** ✅, FY2020 **44,930,429K** ✅ (both match recon; GF-column-only confirmed).

## URLs (load-time discovery)
Recon's recent-year `ncacfr{YYYY}.pdf` URLs 404'd (site reorganized). Real URLs enumerated from the ncosc.gov archive: FY2012–2016 `June_30_{YYYY}_CAFR.pdf`, FY2017–2021 `{YYYY} Comprehensive Annual Financial Report` variants, FY2022–2025 `{YYYY} [North Carolina] Annual Comprehensive Financial Report.pdf` (FY2024 under `2024-12/`, FY2025 under `2025-12/`). All 14 confirmed real PDFs.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO operating rows (FY2023 $26,775M, FY2024 $29,216M), no revenue. Post-load: 12 op + 12 rev, **0 NASBO**, all GAAP-labelled + sourced, FY2014–2025. Fresh data_sources `nc-acfr-gf-operating` / `nc-acfr-gf-revenue`.

## Accept-relabel (ACFR-19)
NC ACFR GF ~**2.58× NASBO** (largest Batch-1 divergence — "Federal funds" ~$35B inside GAAP GF). Relabelled honestly.

## P2 clamp (ACFR-20)
"Investment earnings (losses)" positive in loaded years; clamp wired, not triggered.

## Idempotency / Money In / cohort
NC --fy 2025 re-run → 0 change. 12 revenue rows → Money In on. Loaders resolve only `name='North Carolina'`; cohort untouched (RECON-08; Phase 110 = authoritative audit).

## Deferred
NC FY2012–2013 honest holes (older format); NC pre-FY2012 exists back to FY1997 (`June_30_{YYYY}_CAFR.pdf`) — future deepening pass.
