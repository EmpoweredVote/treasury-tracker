# 108-02 SUMMARY — Massachusetts ACFR Upgrade (in-place)

**Requirements:** ACFR-10, ACFR-19, ACFR-20, RECON-08
**Status:** COMPLETE (17-yr window loaded; 8 honest holes logged)
**Spend:** $0

## What shipped
- Shared parser `scripts/maAcfrExtract.mjs` + two loaders `scripts/processMAAcfr.js` (operating) + `scripts/processMARevenueAcfr.js` (revenue).
- MA state node (`fd6b008f`) upgraded **in place** (no duplicate) NASBO→ACFR GAAP: GF revenue-by-source + department-level spending, 17 years (FY2007–2025).

## Approach: PARSER (Chris-approved deviation)
Recon mischaracterized MA as "3 columns, simple." Actual: variable fund columns + ~25–44 **department-level** expenditure lines/year. Hand-transcription impractical (~1,100 values × 25yr), so MA uses a programmatic GENERAL-FUND-column parser gated by an exact total-tie per FY (non-tying years skipped+logged).

## FY window
**Loaded 17:** FY2007–2013, 2015–2020, 2022, 2023, 2024, 2025.
**Honest holes 8:** FY2001–2006 (older combined format), FY2014 + FY2021 (`-table` anchor quirks). Recoverable in a follow-up.

## Bookend ties (exact)
FY2025 rev **61,907,573K** ✅, FY2015 **35,029,512K** ✅. FY2023/FY2024 exp/rev within documented $1–2K GAAP thousands rounding (logged, TOL=5K).

## In-place upgrade (RECON-07)
Pre-load: MA node had only 2 NASBO rows, no revenue, no ACFR, no ma-% metadata. Post-load: exactly **1** MA node; 17 op + 17 rev rows, all GAAP-labelled + sourced; **0 NASBO remain**. v1.8 DLS city-level loaders untouched.

## Accept-relabel (ACFR-19)
MA ACFR GF ~**1.73× NASBO** (federal grants/reimbursements inside GAAP GF). Relabelled honestly.

## P2 clamp (ACFR-20)
Investment income embedded in Miscellaneous; no standalone negative line. Clamp wired, not triggered.

## Idempotency
MA --fy 2025 re-run → 0 net change, no dupes.

## Money In
17 revenue rows → auto-enabled.

## Cohort untouched (RECON-08)
NJ 12, CA 36 unchanged; GA still 2 NASBO (108-04 pending); 1 MA node. Phase 110 = authoritative audit.

## Deferred
MA FY2001–2006 + FY2014 + FY2021 honest holes — future deepening pass.
