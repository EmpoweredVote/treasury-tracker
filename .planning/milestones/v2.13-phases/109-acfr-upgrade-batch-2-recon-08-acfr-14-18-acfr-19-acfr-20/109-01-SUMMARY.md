# 109-01 SUMMARY — Tennessee ACFR Upgrade

**Requirements:** ACFR-14, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (17-yr window; 0 holes) · **Spend:** $0

## What shipped
- `scripts/processTNAcfr.js` + `scripts/processTNRevenueAcfr.js` on the NC parser-based mold (D-02).
- **Parser evolution:** `extractGovFundGeneralColumnPositional` added to `scripts/maAcfrExtract.mjs` — nearest-right-aligned-column assignment for statements that leave blank GF cells empty (no dash). Token-order tried first, positional fallback; exact tie remains the gate. Existing MA/NC path untouched.
- TN state node (`f96037ba`) NASBO→ACFR GAAP: GF revenue-by-source (9–10 sources) + spending-by-function (5–8 functions), **FY2009–FY2025 (17 yrs — the deepest Batch-2 window), 0 holes**.

## FY window
**Loaded 17/17:** FY2009–FY2025, every FY tie $0 (both datasets). FY2009–FY2014 recovered via the positional extractor (token-order overshot exp by ~$9B — Education-fund bleed from blank GF cells).

## Bookends (exact)
FY2025 rev **35,473,625K** ✅, FY2019 rev **22,201,193K** ✅ (recon values reproduced; GF-column-only confirmed).

## URLs (load-time discovery)
All 17 recon URLs valid (mixed case, FY2025 `ACFR%20-%20FY25.pdf`). New finding: **tn.gov requires a browser UA** (plain curl → connection reset) — baked into the loaders.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO operating rows (FY2023 $19,570M, FY2024 $23,411M), no revenue. Post-load: **17 op + 17 rev, 0 NASBO, 0 dup keys, 0 unsourced**. Fresh data_sources `tn-acfr-gf-operating` / `tn-acfr-gf-revenue`.

## Accept-relabel (D-07, ACFR-19)
TN ACFR GF ~**1.51×** NASBO (FY2025 rev $35.5B vs NASBO FY2024 $23.4B; Federal revenue $17.5B inside GAAP GF). Relabelled honestly, GAAP basis label on every row.

## P2 clamp (D-06, ACFR-20)
Investment income positive all 17 years; clamp wired, not triggered.

## Idempotency / Money In / cohort
FY2025 re-run → 0 net change (34 rows, 0 dups). 17 revenue rows → Money In on. 50-state snapshot: 14 existing ACFR nodes + 35 NASBO nodes unchanged (RECON-08).

## Deferred
TN pre-FY2009 (FY2007/2008 listed on archive) — future deepening pass.
