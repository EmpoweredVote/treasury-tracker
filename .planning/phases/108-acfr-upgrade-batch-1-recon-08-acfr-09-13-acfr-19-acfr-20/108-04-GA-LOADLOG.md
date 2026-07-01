# 108-04 — Georgia ACFR Load Log

**Node:** 6eb7dd4a · **Loaders:** processGAAcfr.js + processGARevenueAcfr.js (reuse maAcfrExtract.mjs) · **Spend:** $0

## Load Disposition
Loaded FY2021–2025 (5 yrs, full clean window, GF column only, all tie $0). Holes: none.

| bookend | value | tie |
|---------|-------|-----|
| FY2025 rev | 68,445,055K | $0 ✅ |
| FY2021 rev | 55,378,103K | $0 ✅ |

## F-97-01 supersede (RECON-07) — CONFIRMED
Pre-load FY2023 NASBO operating = $29,266M (Phase-97 Medicaid-corrected). Post-load FY2023 operating = ACFR GAAP **$59,893,783K** at the same (6eb7dd4a, 2023, 'operating') key. DB: **0 NASBO rows** on GA node — no orphan. Clean supersede.

## NASBO replacement (RECON-08)
Pre-load: 2 NASBO operating (FY2023 $29,266M, FY2024 $34,594M), no revenue. Post-load DB: 5 op + 5 rev, 0 NASBO, 0 null source_url, FY2021–2025.

## Accept-relabel (ACFR-19): GA ~1.98× NASBO ("Intergovernmental - Federal" ~$27.8B inside GAAP GF).
## P2 clamp (ACFR-20): investment income positive; wired, not triggered.
## Idempotency: GA --fy 2025 re-run → 0 net change. ## Money In: 5 revenue rows → on.
## Cohort untouched (RECON-08): node-scoped to Georgia; Phase 110 = authoritative audit.

## URL note
Recon Drupal slugs 404'd; real slugs enumerated from sao.georgia.gov/swar/acfr + /historical-acfr-reports (FY2021 2021acfrfinal070122bdpdf, FY2022 2022-acfr-final-securedpdf, FY2023 2023-acfr-final-securepdf, FY2024 2024-acfr-42525-securedv2pdf, FY2025 2025-acfr-21325-securedpdf).
