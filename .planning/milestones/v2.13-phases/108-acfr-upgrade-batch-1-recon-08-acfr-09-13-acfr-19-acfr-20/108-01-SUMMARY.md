# 108-01 SUMMARY — New Jersey ACFR Upgrade

**Requirements:** ACFR-09, ACFR-19, ACFR-20, RECON-08
**Status:** COMPLETE
**Spend:** $0

## What shipped
- Two new loaders: `scripts/processNJAcfr.js` (operating) + `scripts/processNJRevenueAcfr.js` (revenue), cloned from the IL template, **UNITS=1 (dollars)** — NJ is the only tranche state in raw dollars, not thousands.
- NJ state node (`91f310a1`) upgraded NASBO→ACFR GAAP across the **full clean window FY2020–FY2025** (6 years, 0 honest holes).

## FY window transcribed
FY2020, FY2021, FY2022, FY2023, FY2024, FY2025 — all extracted from the Governmental Funds Statement of Rev/Exp/Changes, GENERAL FUND column (1st of 4). **No omitted/honest-hole FYs.**

## Bookend ties (exact, $0)
- FY2025 GF Total revenues = **60,979,024,211** ✅ (matches recon)
- FY2020 GF Total revenues = **38,768,977,008** ✅ (matches recon)
- All 6 FYs tie $0 on both revenue and expenditure.

## NASBO replacement
Pre-load NASBO: FY2023 $48,837M, FY2024 $52,996M (2 operating rows, no revenue). Post-load: 6 operating (GAAP) + 6 revenue rows, all sourced; **zero NASBO labels remain**; FY2023/FY2024 replaced in place. Fresh data_sources `nj-acfr-gf-operating` + `nj-acfr-gf-revenue`.

## Accept-relabel divergence (ACFR-19)
NJ ACFR GF ≈ **1.15× NASBO** (smallest in tranche) — federal/intergovernmental inside GAAP GF. Relabelled honestly (GAAP basis label).

## P2 clamp (ACFR-20)
No negative GF category in any NJ FY; clamp wired as safety net, not triggered.

## Idempotency
Re-run NJ --fy 2025 (op+rev) → 0 net change, no dupes (RPC keyed (muni,fy,dataset_type)).

## Money In
6 revenue rows → auto-enabled on NJ (data-driven, no frontend change).

## Load-time deviations from recon
1. **URL fix:** recon's `/pdfs/` path segment was spurious → corrected to `…/publications/{YY}fr/NJFR…Complete.pdf` (FY2025 = `NJFY2025Complete.pdf`). Soft-404 guard caught the bad URLs.
2. **Column label:** recon said 2nd fund = "Transportation Trust Fund"; actual = "Property Tax Relief Fund". GF still 1st column → no impact.

## Cohort untouched (RECON-08)
Confirmed: CA (18op/18rev), PA (10/10), TX (10/10), OH (6/6) all unchanged, 0 NASBO; Georgia still on NASBO (2 op — 108-04 not yet run); NJ 6/6. All match RECON-08 counts.

## Deferred
- **NJ pre-FY2020** deeper history exists (FY2002–2019, varying filenames) — deferred to a future deepening pass.
