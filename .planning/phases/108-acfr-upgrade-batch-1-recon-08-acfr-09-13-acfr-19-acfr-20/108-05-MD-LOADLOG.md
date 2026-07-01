# 108-05 — Maryland ACFR Load Log

**Node:** 8e597f8f · **Loaders:** processMDAcfr.js + processMDRevenueAcfr.js (reuse maAcfrExtract.mjs) · **Spend:** $0

## Load Disposition
Loaded FY2022–2025 (4 yrs, full clean window, GF column only). Holes: none.

| bookend | value | tie |
|---------|-------|-----|
| FY2025 rev | 48,689,018K | −$1 (GAAP rounding) ✅ |
| FY2022 rev | 50,540,136K | +$2 (GAAP rounding) ✅ |

TOL=5K absorbs documented GAAP thousands rounding (FY2024 exp diff +3, rev −1 also logged); nonzero diffs shown, not hidden.

## FY2022 P2 clamp (ACFR-20) — CONFIRMED
"Interest and other investment income" = −$275,992K → DB leaf = **0**, label "(net loss — shown at 0)", parent total $50,540,136,000 nets it.

## NASBO replacement (RECON-08)
Pre-load: 2 NASBO operating (FY2023 $27,972M, FY2024 $27,397M), no revenue. Post-load DB: 4 op + 4 rev, 0 NASBO, 0 null source_url, FY2022–2025.

## URL case change: FY2022/2023 `ACFR{YYYY}.pdf` (uppercase); FY2024/2025 `acfr{YYYY}.pdf` (lowercase). Confirmed.
## Accept-relabel (ACFR-19): MD ~1.78× NASBO (federal intergovernmental inside GAAP GF).
## Idempotency: MD --fy 2025 re-run → 0 net change. ## Money In: 4 revenue rows → on.
## Cohort untouched (RECON-08): node-scoped to Maryland; Phase 110 = authoritative audit.
