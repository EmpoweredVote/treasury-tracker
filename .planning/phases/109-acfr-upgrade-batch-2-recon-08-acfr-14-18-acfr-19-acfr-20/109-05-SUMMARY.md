# 109-05 SUMMARY — Michigan ACFR Upgrade (Sep-30 FY-end)

**Requirements:** ACFR-18, ACFR-19, ACFR-20, RECON-08 · **Status:** COMPLETE (7-yr window FY2019–FY2025; 0 holes) · **Spend:** $0

## What shipped
- `scripts/processMIAcfr.js` + `scripts/processMIRevenueAcfr.js` — dedicated MI loaders on the shared-parser mold with **D-03 Sep-30 semantics**: `source_date = {FY}-09-30`, `fiscal_year_start_month: 10` (data_sources → RPC propagation + direct stamp), NASBO FY-label alignment documented.
- Two parser generalizations in `maAcfrExtract.mjs` (positional variant): case-insensitive header match (MI all-caps "GENERAL FUND") + "(Note NN)" cross-reference stripping (MI "Tax credits (Note 16)" — bare 16 was displacing the real $1.588B GF value). TN/CT/WI regression-checked clean.
- MI state node (`38c9f1ff`) NASBO→ACFR GAAP: GF revenue-by-source (7 sources) + spending-by-function (11–12 functions), **FY2019–FY2025 (7 yrs, 0 holes)**.

## Bookends
FY2025 rev **53,788,610K** printed (line-sum +1K documented GAAP rounding, TOL=5 MA/MD precedent) ✅, FY2020 rev **39,920,656K** exact ✅.

## D-03 verified live
DB check: 0 non-Sep-30 source_dates, 0 wrong fiscal_year_start_month across all 14 MI rows. Fund 10 = GF only; School Aid Fund (Fund 20) excluded.

## NASBO replacement / DB (verified)
Pre-load: 2 NASBO rows (FY2023 $14,861M, FY2024 $15,129M). Post-load: **7 op + 7 rev, 0 NASBO, 0 dups, 0 unsourced**. Fresh data_sources `mi-acfr-gf-operating` / `mi-acfr-gf-revenue` (both with fiscal_year_start_month=10).

## Accept-relabel (D-07, ACFR-19) — tranche's largest
MI ~**3.4–3.56×** NASBO (~$30.3B "From federal agencies" Medicaid/ARP passthrough inside GAAP GF). Prominently documented; every row GAAP-labelled.

## P2 clamp (D-06, ACFR-20)
No standalone investment line (embedded in Miscellaneous) — no negatives, clamp wired as safety net (as recon predicted).

## Idempotency / Money In / cohort
FY2025 re-run → 0 net change. 7 revenue rows → Money In on. Full 50-state check: 19 ACFR states, 31 clean NASBO states, 0 anomalies (RECON-08).

## Deferred
MI pre-FY2019 (not on michigan.gov archive) — revisit if older ACFRs surface.
