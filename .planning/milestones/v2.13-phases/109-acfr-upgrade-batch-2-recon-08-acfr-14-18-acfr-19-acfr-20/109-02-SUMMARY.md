# 109-02 SUMMARY — Connecticut ACFR Upgrade

**Requirements:** ACFR-15, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (23-yr window FY2002–FY2025; FY2006 + pre-2002 honest holes) · **Spend:** $0

## What shipped
- `scripts/processCTAcfr.js` + `scripts/processCTRevenueAcfr.js` on the NC parser-based mold (D-02), token-order + positional fallback, per-dataset tie gates.
- CT state node (`d01de53e`) NASBO→ACFR GAAP: GF revenue-by-source (7–11 sources) + spending-by-function (11–12 functions), **FY2002–FY2025 (23 yrs — deepest CT window feasible from text-layer PDFs)**.

## Deep-history result (D-01)
All 38 archive years (FY1988–FY2025) enumerated from the `_reportsSource` JSON and attempted. 23 loaded (every FY2002+ except FY2006). **Holes:** FY2006 (scanned PDF, no text layer); FY1988–FY2001 (pre-GASB-34 Combined-Statement format — different statement + basis, honestly not force-parsed). The 7-column multi-column-sum trap never fired — GF-column-only ties $0 everywhere.

## Bookends (exact)
FY2025 rev **26,074,183K** ✅, FY2019 rev **20,776,288K** ✅.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO rows (FY2023 $22,199M, FY2024 $22,779M). Post-load: **23 op + 23 rev, 0 NASBO, 0 dups, 0 unsourced**. Fresh data_sources `ct-acfr-gf-operating` / `ct-acfr-gf-revenue`.

## Accept-relabel (D-07, ACFR-19)
CT ~**1.14×** NASBO (smallest in tranche; $2.8B Federal Grants and Aid inside GAAP GF). Relabelled honestly.

## P2 clamp (D-06, ACFR-20) — TRIGGERED
**FY2013 Investment Earnings (Loss) −$2,100K** — the recon-predicted fiscal-stress negative. Verified live: rendered 0 with "(net loss — shown at 0)" label, parent total intact.

## Idempotency / Money In / cohort
FY2025 re-run → 0 net change. 23 revenue rows → Money In on. Cohort untouched (RECON-08).

## Deferred
CT FY2006 (OCR pass) + FY1988–FY2001 (pre-GASB-34 extractor + basis-label design) — future deepening pass.
