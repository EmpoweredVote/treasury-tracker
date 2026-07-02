# 109-03 SUMMARY — Wisconsin ACFR Upgrade

**Requirements:** ACFR-16, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (24-yr contiguous window FY2002–FY2025) · **Spend:** $0

## What shipped
- `scripts/processWIAcfr.js` + `scripts/processWIRevenueAcfr.js` on the shared-parser mold (D-02).
- WI state node (`15fe5240`) NASBO→ACFR GAAP: GF revenue-by-source (9–12 sources) + spending-by-function, **FY2002–FY2025 (24 yrs contiguous — the longest unbroken window in the whole cohort)**.

## Deep-history result (D-01)
All 26 single-file archive years (FY2000–FY2025) attempted; 24 loaded. **Holes:** FY2000–FY2001 (pre-GASB-34 Combined-Statement format — same boundary as CT). Load-time URL correction: FY2002–FY2003 use lowercase `{yyyy}cafr.pdf`.

## Bookends (exact)
FY2025 rev **38,655,598K** ✅, FY2019 rev **27,866,801K** ✅.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO rows (FY2023 $18,864M, FY2024 $22,280M). Post-load: **24 op + 24 rev, 0 NASBO, 0 dups, 0 unsourced**. Fresh data_sources `wi-acfr-gf-operating` / `wi-acfr-gf-revenue`.

## Accept-relabel (D-07, ACFR-19)
WI ~**1.74×** NASBO ($14.4B federal intergovernmental inside GAAP GF; MA analog). Relabelled honestly.

## P2 clamp (D-06, ACFR-20) — TRIGGERED ×3
FY2011/FY2012/FY2013 negative Interest Income (zero-rate era) — all three verified clamped live (0-render, signed label, parent total intact).

## Idempotency / Money In / cohort
FY2025 re-run → 0 net change. 24 revenue rows → Money In on. Cohort untouched (RECON-08).

## Deferred
WI FY2000–FY2001 (pre-GASB-34 extractor design) + pre-FY2000 4-section era — future deepening pass.
