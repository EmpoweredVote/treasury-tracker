# 109-04 SUMMARY — Washington ACFR Upgrade

**Requirements:** ACFR-17, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (6-yr window FY2020–FY2025; 0 holes) · **Spend:** $0

## What shipped
- `scripts/processWAAcfr.js` + `scripts/processWARevenueAcfr.js` on the shared-parser mold (D-02).
- WA state node (`d8257751`) NASBO→ACFR GAAP: GF revenue-by-source (13–14 sources) + spending-by-function (9 functions), **FY2020–FY2025 (6 yrs, 0 holes)**.

## URL special-cases (both confirmed live)
FY2025 unique `FY-2025-Annual-Comprehensive-Financial-Report.pdf` (24.5 MB) special-cased; FY2020 `CAFR20.pdf`. Biennial caveat documented in loader headers — ACFR is annual GAAP per FY ending Jun 30.

## Bookends (exact)
FY2025 rev **55,775,958K** ✅, FY2020 rev **38,977,410K** ✅.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO rows (FY2023 $30,861M, FY2024 $32,397M). Post-load: **6 op + 6 rev, 0 NASBO, 0 dups, 0 unsourced**. Fresh data_sources `wa-acfr-gf-operating` / `wa-acfr-gf-revenue`.

## Accept-relabel (D-07, ACFR-19)
WA ~**1.72×** NASBO ($22.4B federal grants-in-aid inside GAAP GF). Relabelled honestly.

## P2 clamp (D-06, ACFR-20) — TRIGGERED ×2
"Investment income (loss)" negative FY2021 (−$12.9M K) and FY2022 (−$216.9M K, adverse bond market) — both verified clamped live. The recon "(loss)" column-name warning was exactly right.

## Idempotency / Money In / cohort
FY2025 re-run → 0 net change. 6 revenue rows → Money In on. Cohort untouched (RECON-08).

## Deferred
WA pre-FY2020 (WA State Library archive lead) — future deepening pass.
