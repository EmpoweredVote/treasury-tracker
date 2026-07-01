# 108-03 — North Carolina ACFR Load Log

**Node:** dd5281e8 · **Loaders:** processNCAcfr.js + processNCRevenueAcfr.js (reuse maAcfrExtract.mjs) · **Spend:** $0

## Load Disposition
Loaded FY2014–2025 (12 yrs, GF column only, all tie $0). Honest holes: FY2012, FY2013 (older format).

| bookend | value | tie |
|---------|-------|-----|
| FY2025 rev | 75,416,082K | $0 ✅ |
| FY2020 rev | 44,930,429K | $0 ✅ |
| FY2025 exp | 74,597,628K | $0 ✅ |

## NASBO replacement (RECON-08)
Pre-load: 2 NASBO operating rows (FY2023 $26,775M, FY2024 $29,216M), no revenue. Post-load DB: 12 operating + 12 revenue, **0 NASBO labels**, 0 null source_url, FY2014–2025. NASBO FY2023/FY2024 replaced in place.

## Accept-relabel (ACFR-19): NC ACFR GF ~2.58× NASBO ("Federal funds" ~$35B inside GAAP GF) — relabelled honestly.
## P2 clamp (ACFR-20): investment earnings positive in loaded years; wired, not triggered.
## Idempotency: NC --fy 2025 re-run → 0 net change.
## Money In: 12 revenue rows → auto-enabled.
## Cohort untouched (RECON-08): loaders node-scoped to North Carolina; Phase 110 = authoritative audit.

## URL note
Recon's recent `ncacfr{YYYY}.pdf` URLs 404'd; real URLs enumerated from ncosc.gov archive (FY2012–2016 `June_30_{YYYY}_CAFR.pdf`; FY2017–2021 "Comprehensive Annual Financial Report" variants; FY2022–2025 "[NC] Annual Comprehensive Financial Report", FY2024 in `2024-12/`, FY2025 in `2025-12/`).

## Deferred: FY2012–2013 holes + pre-FY2012 (archive back to FY1997) — future deepening pass.
