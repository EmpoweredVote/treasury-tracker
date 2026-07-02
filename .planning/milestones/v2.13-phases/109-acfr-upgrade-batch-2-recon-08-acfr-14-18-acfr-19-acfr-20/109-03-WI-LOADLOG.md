# 109-03 WI LOADLOG — Wisconsin ACFR GAAP Upgrade

**Node:** Wisconsin `15fe5240-19d9-4fef-b785-d624b0a39a2a` · **Executed:** 2026-07-01 · **Spend:** $0

## Load Disposition

**Attempted window (D-01):** verified FY2019–FY2025 + deep enumerable history FY2000+ (all 26 single-file archive years downloaded + attempted). **Loaded: 24 (FY2002–FY2025, contiguous). Deepest loaded year: FY2002.**

Per-FY GF totals (thousands ×1000 at store; every year tie ≤ TOL):

| FY | Op Total Exp ($) | Rev Total ($) | | FY | Op Total Exp ($) | Rev Total ($) |
|----|------------------|---------------|-|----|------------------|---------------|
| 2002 | 15,881,746,000 | 16,448,706,000 | | 2014 | 22,070,081,000 | 24,258,902,000 |
| 2003 | 16,195,920,000 | 16,695,820,000 | | 2015 | 23,227,634,000 | 24,584,538,000 |
| 2004 | 17,152,571,000 | 16,794,603,000 | | 2016 | 23,319,239,000 | 24,936,912,000 |
| 2005 | 16,742,019,000 | 17,639,122,000 | | 2017 | 23,703,230,000 | 25,450,035,000 |
| 2006 | 17,020,684,000 | 18,238,767,000 | | 2018 | 24,305,945,000 | 26,410,721,000 |
| 2007 | 17,765,519,000 | 18,942,299,000 | | 2019 | 25,476,013,000 | **27,866,801,000** (bookend ✅) |
| 2008 | 18,450,749,000 | 19,573,757,000 | | 2020 | 26,756,083,000 | 29,422,964,000 |
| 2009 | 20,252,456,000 | 21,177,963,000 | | 2021 | 31,382,478,000 | 34,570,052,000 |
| 2010 | 21,368,766,000 | 22,478,455,000 | | 2022 | 33,576,689,000 | 39,340,952,000 |
| 2011 | 22,145,755,000 | 23,424,531,000 ⚑ | | 2023 | 34,378,171,000 | 38,557,536,000 |
| 2012 | 21,623,078,000 | 23,582,346,000 ⚑ | | 2024 | 35,985,572,000 | 38,362,779,000 |
| 2013 | 21,447,441,000 | 23,786,216,000 ⚑ | | 2025 | 36,445,383,000 | **38,655,598,000** (bookend ✅) |

⚑ = P2 clamp year (negative Interest Income). FY2011 rev sum diff = 1 (thousands) — documented GAAP rounding within TOL=5; all other years $0.

## Honest holes (D-01/D-05)
- **FY2000–FY2001** — pre-GASB-34 Combined-Statement format (same boundary as CT); not force-parsed. Future deepening pass.
- Pre-FY2000 — 4-section multi-file era (95wicomb/gpfs/intr/stat.pdf), out of scope per plan.

## URL enumeration — three path families (archive-confirmed at load)
`/budget/` FY2024–25 (`FY %20{YYYY}%20ACFR%20Final.pdf`) + FY2018–2021 (`CAFR{YYYY}.pdf` / `ACFR2021.pdf`); `/budget/SCO/` FY2022–23; `/DEBFCapitalFinance/{YYYY}/` FY2002–2017 (variants: `{yyyy}cafr.pdf` FY2002–03 lowercase, `{YYYY}CAFR.pdf` FY2004–06, `{YYYY}CAFR_Linked.pdf` / `{YYYY}_CAFR_Linked.pdf` FY2007–2017). One load-time correction vs recon: FY2002–FY2003 filenames are lowercase `cafr` (recon's generic `{YYYY}CAFR[_Linked].pdf` didn't capture this). All 24 real PDFs (1.7–15.8 MB).

## NASBO replacement (RECON-08)
Pre-load baseline: exactly 2 NASBO operating rows — FY2023 **$18,864M**, FY2024 **$22,280M**, 0 revenue rows. Post-load: **48 rows (24 op + 24 rev), 0 NASBO, 0 dups, 0 unsourced** — NASBO FY2023/FY2024 replaced in place.

## Accept-and-relabel divergence (D-07, ACFR-19)
WI ACFR GAAP GF vs NASBO budgetary GF: FY2023 operating $34,378M vs $18,864M (**1.82×**); FY2024 $35,986M vs $22,280M (**1.62×**); recon's revenue-side ~1.74× confirmed in range. Driver: $14.4B Intergovernmental (nearly all federal) inside the GAAP GF — the MA analog. Relabelled honestly.

## P2 clamp (D-06, ACFR-20) — TRIGGERED ×3, verified live
Negative **Interest Income** in FY2011 (−$1,037K), FY2012 (−$1,282K), FY2013 (−$838K) — zero-rate era. All three render clamped-to-0 with "(net loss — shown at 0)" labels (3 clamped categories confirmed in DB), parent totals intact.

## Idempotency (D-09)
FY2025 re-run (operating + revenue) → 48 rows, 0 dups, totals unchanged — **0 net change**.

## Money In
24 revenue rows live → Money In auto-enabled on the WI node.

## Cohort untouched (RECON-08)
Loaders resolve only `name='Wisconsin'`; the 16 other ACFR nodes (14 prior + TN + CT) and remaining NASBO states unchanged.
