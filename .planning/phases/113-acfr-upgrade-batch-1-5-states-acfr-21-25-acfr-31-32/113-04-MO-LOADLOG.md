# 113-04 — Missouri ACFR Load Log

**Date:** 2026-07-02
**Node:** Missouri `21892bb7-1a1d-4038-8665-51c256ab5875` (resolved + asserted)
**Loaders:** `scripts/processMOAcfr.js` + `scripts/processMORevenueAcfr.js`, UNITS=1_000 (thousands)

## Load Disposition

| Item | Result |
|------|--------|
| FYs loaded | **FY2012–FY2025 (all 14), operating + revenue** — the full recon-locked window; no honest holes |
| URL resolution | All 14 node pages on `acct.oa.mo.gov` resolved (the PDF link lives in a `data-src` embed attribute, not an `<a href>` — scraped accordingly). FY2024/FY2012 URLs match the recon's confirmed examples exactly |
| Statement trap | The reconciliation-to-Statement-of-Activities schedule (immediately after the target statement) was NOT extracted — extractor anchors on the Governmental Funds statement + printed-total tie gates |
| Bookend ties | FY2024 GF Total revenues = 32,756,386K ✅ ($0); FY2012 = 18,068,155K ✅ ($0). All 14 years tie **$0 diff** on both sections |
| Wrapped-label fixes (2 years, hand-verified) | FY2017: the "Net Increase (Decrease) in the Fair Value of Investments" values-only continuation line was initially mis-parsed (picked the Conservation column's −2,031); corrected to the printed GF −3,250 — year then ties $0. FY2021: the wrapped label line carried Public Education's −600; GF −7,566 is on the continuation line — corrected, ties $0. Both fixes verified against the printed statement text |

## NASBO Replacement (in place)

| FY | Pre-load NASBO operating (recon baseline) | Loaded ACFR operating (GAAP) |
|----|-------------------------------------------|------------------------------|
| 2023 | $12,526,000,000 | $29,784,903,000 |
| 2024 | $14,561,000,000 | $30,900,541,000 |

Post-load: **0 NASBO labels; exactly one operating row per (MO, fy)**.

## Scope Divergence (ACFR-31)

ACFR GF FY2024 revenues $32,756,386K vs NASBO FY2024 operating $14,561M → **~2.25× — exactly the recon-pinned mechanism**: "Contributions and Intergovernmental" (federal passthrough) = $18,773,418K of the FY2024 GF total, consolidated into the GAAP GF and excluded from NASBO's budgetary concept. Accepted-and-relabelled honestly (TX precedent); GAAP basis label on all 28 rows.

## Negative Lines / P2 Clamp (ACFR-32)

**Six years have a negative GF "Net Increase (Decrease) in the Fair Value of Investments":** FY2013 −11,518K, FY2017 −3,250K, FY2018 −2,981K, FY2021 −7,566K, FY2022 −309,337K, FY2023 −187,845K. All render clamped to 0 with the signed magnitude in the label; root totals carry the signed net and tie the printed statements. (Recon flagged this line as "CAN go negative" from the Road Fund column — confirmed it goes negative in the GF column too in 6 of 14 years.)

## Idempotency + 0-Residue

- Re-ran `--fy 2024` live (both loaders): UPDATE-in-place, 0 net change.
- `data_sources` 'mo-acfr-%' rows → **0**.

## Money In + Cohort

- 14 revenue rows → **Money In auto-enabled**.
- Cohort spot-check (CA/PA/NJ/OK/KS) unchanged this session.
