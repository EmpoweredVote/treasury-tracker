# 109-02 CT LOADLOG — Connecticut ACFR GAAP Upgrade

**Node:** Connecticut `d01de53e-d687-4825-bfe2-09f7694c28d6` · **Executed:** 2026-07-01 · **Spend:** $0

## Load Disposition

**Attempted window (D-01):** verified FY2019–FY2025 + deep enumerable history FY1988+ (all 38 archive years downloaded + attempted). **Loaded: 23 (FY2002–FY2025, FY2006 hole). Deepest loaded year: FY2002.**

| FY | Operating (GF Total Exp, $) | Revenue (GF Total Rev, $) | Tie |
|----|---------------------------|--------------------------|-----|
| 2002 | 12,554,181,000 | 11,745,453,000 | $0/$0 |
| 2003 | 12,741,277,000 | 12,562,160,000 | $0/$0 |
| 2004 | 12,119,423,000 | 12,846,146,000 | $0/$0 |
| 2005 | 12,756,317,000 | 13,789,266,000 | $0/$0 |
| 2007 | 14,622,681,000 | 15,693,905,000 | $0/$0 |
| 2008 | 17,947,895,000 | 16,201,738,000 | $0/$0 |
| 2009 | 16,836,826,000 | 15,557,421,000 | $0/$0 |
| 2010 | 16,800,927,000 | 16,321,753,000 | $0/$0 |
| 2011 | 17,415,039,000 | 17,706,813,000 | $0/$0 |
| 2012 | 18,406,443,000 | 19,333,898,000 | $0/$0 |
| 2013 | 18,738,253,000 | 20,134,738,000 | $0/$0 · **P2 clamp triggered** |
| 2014 | 16,591,164,000 | 17,400,333,000 | $0/$0 |
| 2015 | 16,935,748,000 | 17,953,769,000 | $0/$0 |
| 2016 | 17,443,713,000 | 18,214,714,000 | $0/$0 |
| 2017 | 17,137,603,000 | 18,501,815,000 | $0/$0 |
| 2018 | 18,076,775,000 | 20,662,693,000 | $0/$0 |
| 2019 | 18,358,016,000 | **20,776,288,000** (bookend ✅) | $0/$0 |
| 2020 | 18,726,070,000 | 20,061,640,000 | $0/$0 |
| 2021 | 20,709,974,000 | 22,990,342,000 | $0/$0 |
| 2022 | 22,894,339,000 | 26,223,573,000 | $0/$0 |
| 2023 | 23,754,483,000 | 25,139,978,000 | $0/$0 |
| 2024 | 23,588,666,000 | 25,084,660,000 | $0/$0 |
| 2025 | 25,072,796,000 | **26,074,183,000** (bookend ✅) | $0/$0 |

## Honest holes (D-01/D-05 — self-limited by extraction, never forced)
- **FY2006** — scanned PDF, no text layer (`pdftotext` yields 164 bytes). Recoverable only via OCR — deferred.
- **FY1988–FY2001** (14 yrs) — pre-GASB-34 **"Combined Statement"** format (All Governmental Fund Types columns, different statement + reporting basis than the post-2002 Governmental Funds statement). Not force-parsed — mixing pre-GASB-34 figures into a GAAP-GF series would be dishonest. Future deepening pass with a dedicated pre-34 extractor + basis label.
- FY2005 extractor note: token-order ties EXP exactly, positional ties REV exactly — each loader's per-dataset tie gate independently selected the tying extractor; both datasets loaded at $0.

## URL enumeration (D-09/Claude's-discretion — from the `_reportsSource` JSON)
All 38 per-year URLs enumerated from the JSON blob on `https://osc.ct.gov/reports` — never derived. FY2022 exact "revised" URL (`ACFR-2022revised032227.pdf`) confirmed; pre-FY2021 CAFR naming; FY2015–FY2016 under `/20XXcafr/`; FY1988–FY2005 under `/reports/oldcafrpdfs/CT_CAFR_FY{YYYY}.pdf`. All 38 real PDFs (1.2–8.5 MB, `%PDF-` magic).

## NASBO replacement (RECON-08)
Pre-load baseline: exactly 2 NASBO operating rows — FY2023 **$22,199M**, FY2024 **$22,779M**, 0 revenue rows. Post-load: **46 rows (23 op + 23 rev), 0 NASBO labels, 0 dup keys, 0 unsourced, FY2006 absent** — NASBO FY2023/FY2024 replaced in place.

## Accept-and-relabel divergence (D-07, ACFR-19)
CT ACFR GAAP GF vs NASBO budgetary GF: FY2023 operating $23,754M vs $22,199M (**1.07×**); FY2024 $23,589M vs $22,779M (**1.04×**); recon's revenue-side figure ~1.14× (FY2025 rev $26.1B vs NASBO FY2024 $22.8B). Smallest divergence in the tranche — driver $2.8B Federal Grants and Aid inside the GAAP GF. Relabelled honestly.

## P2 clamp (D-06, ACFR-20) — TRIGGERED, verified live
**FY2013 "Investment Earnings (Loss)" = −$2,100K** (the recon-predicted fiscal-stress-era negative). Live row renders `Investment Earnings (Loss) (net loss — shown at 0)` amount 0, signed magnitude in the label, parent total intact (the printed $20,134,738K total is preserved). All other 22 loaded years positive.

## Idempotency (D-09)
FY2025 re-run (operating + revenue) → 46 rows, 0 dups, totals unchanged — **0 net change**.

## Money In
23 revenue rows live → Money In auto-enabled on the CT node.

## Cohort untouched (RECON-08)
Loaders resolve only `name='Connecticut'`. State-cohort spot-check after load: 15 ACFR nodes (14 prior + TN from 109-01) unchanged; remaining NASBO states still 2 rows each.
