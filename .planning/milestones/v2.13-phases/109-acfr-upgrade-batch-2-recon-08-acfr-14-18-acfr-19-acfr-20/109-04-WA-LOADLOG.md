# 109-04 WA LOADLOG — Washington ACFR GAAP Upgrade

**Node:** Washington `d8257751-45c4-4853-9621-e1841e7d4998` · **Executed:** 2026-07-01 · **Spend:** $0

## Load Disposition

**Attempted window (D-01):** FY2020–FY2025 (6 yrs, confirmed window; pre-FY2020 deferred per recon gap log — not attempted). **Loaded: 6/6 — 0 holes.**

| FY | Operating (GF Total Exp, $) | Revenue (GF Total Rev, $) | Tie |
|----|---------------------------|--------------------------|-----|
| 2020 | 38,315,455,000 | **38,977,410,000** (bookend ✅) | $0/$0 |
| 2021 | 44,552,280,000 | 47,340,176,000 | $0/$0 · **P2 clamp** |
| 2022 | 48,290,884,000 | 53,683,370,000 | $0/$0 · **P2 clamp** |
| 2023 | 52,499,419,000 | 54,994,902,000 | $0/$0 |
| 2024 | 53,424,789,000 | 53,051,273,000 | $0/$0 |
| 2025 | 58,602,334,000 | **55,775,958,000** (bookend ✅) | $0/$0 |

## URL special-cases (confirmed at load, per recon risk facts)
- **FY2025 unique name:** `https://ofm.wa.gov/wp-content/uploads/FY-2025-Annual-Comprehensive-Financial-Report.pdf` (24.5 MB) — special-cased in SOURCES, never derived. ✅
- **FY2020:** `CAFR/2020/CAFR20.pdf` (not ACFR20). ✅ FY2021–FY2024 follow `CAFR/{YYYY}/ACFR{YY}.pdf`. All 6 real PDFs (6.5–24.5 MB).

## Biennial caveat (documented in both loader headers)
WA budgets on a 2-year biennium; the ACFR is **annual GAAP** per FY ending June 30 ("For the Fiscal Year Ended June 30, {YYYY}" printed on each statement). Loader treats FY-end = Jun 30 and loads per-year — the budget cycle was not mistaken for the reporting period.

## NASBO replacement (RECON-08)
Pre-load baseline: exactly 2 NASBO operating rows — FY2023 **$30,861M**, FY2024 **$32,397M**, 0 revenue rows. Post-load: **12 rows (6 op + 6 rev), 0 NASBO, 0 dups, 0 unsourced** — NASBO FY2023/FY2024 replaced in place.

## Accept-and-relabel divergence (D-07, ACFR-19)
WA ACFR GAAP GF vs NASBO budgetary GF: FY2023 operating $52,499M vs $30,861M (**1.70×**); FY2024 $53,425M vs $32,397M (**1.65×**); recon's ~1.72× confirmed in range. Driver: $22.4B federal grants-in-aid inside the GAAP GF. Relabelled honestly.

## P2 clamp (D-06, ACFR-20) — TRIGGERED ×2, verified live
**"Investment income (loss)"** negative in **FY2021 (−$12,899K)** and **FY2022 (−$216,940K — adverse bond market)** — exactly what the "(loss)" column name flagged in recon. Both render clamped-to-0 with "(net loss — shown at 0)" labels (2 clamped categories in DB), parent totals intact. FY2020/2023/2024/2025 positive.

## Idempotency (D-09)
FY2025 re-run (operating + revenue) → 12 rows, 0 dups, totals unchanged — **0 net change**.

## Money In
6 revenue rows live → Money In auto-enabled on the WA node.

## Cohort untouched (RECON-08)
Loaders resolve only `name='Washington'`; the 17 other ACFR nodes (14 prior + TN/CT/WI) and remaining NASBO states unchanged.
