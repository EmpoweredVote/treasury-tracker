# 108-05 SUMMARY — Maryland ACFR Upgrade (+ FY2022 P2 clamp)

**Requirements:** ACFR-13, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (4-yr full window, 0 holes) · **Spend:** $0

## What shipped
- `scripts/processMDAcfr.js` + `scripts/processMDRevenueAcfr.js` (parser-based, reuse `maAcfrExtract.mjs`).
- MD state node (`8e597f8f`) NASBO→ACFR GAAP: GF revenue-by-source (12) + spending-by-function (~16–18), **FY2022–2025 (full clean window, 0 holes)**.

## Bookends (within documented GAAP rounding)
FY2025 rev **48,689,018K** (line-sum diff −$1) ✅, FY2022 **50,540,136K** (diff +$2) ✅. TOL=5K absorbs documented rounding; diffs logged. (GF 1st of 6: General | Special Revenue | Debt Service | Capital Projects | Enterprise | Total.)

## FY2022 P2 clamp (ACFR-20) — CONFIRMED
FY2022 "Interest and other investment income" = **−$275,992K** (negative). DB confirms the leaf renders **0** with label "Interest and other investment income (net loss — shown at 0)"; the parent total **$50,540,136,000** nets the negative. Correct P2 behavior.

## URLs — case change (confirmed)
FY2022/FY2023 uppercase `ACFR{YYYY}.pdf`; FY2024/FY2025 lowercase `acfr{YYYY}.pdf`. All 4 real PDFs.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO operating (FY2023 $27,972M, FY2024 $27,397M), no revenue. Post-load: 4 op + 4 rev, 0 NASBO, 0 null source_url, FY2022–2025. Fresh data_sources `md-acfr-gf-operating` / `md-acfr-gf-revenue`.

## Accept-relabel (ACFR-19)
MD ACFR GF ~**1.78× NASBO** (federal intergovernmental inside GAAP GF). Relabelled honestly.

## Idempotency / Money In / cohort
MD --fy 2025 re-run → 0 change. 4 revenue rows → Money In on. Loaders node-scoped to Maryland; cohort untouched (RECON-08; Phase 110 = authoritative audit).

## Deferred
MD pre-FY2022 not migrated to marylandcomptroller.gov (recon gap confirmed).
