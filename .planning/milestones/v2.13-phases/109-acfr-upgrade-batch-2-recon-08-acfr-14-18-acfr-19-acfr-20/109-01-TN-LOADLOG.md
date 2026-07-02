# 109-01 TN LOADLOG — Tennessee ACFR GAAP Upgrade

**Node:** Tennessee `f96037ba-af9e-406d-a98f-8c5e2fd299d6` · **Executed:** 2026-07-01 · **Spend:** $0

## Load Disposition

**Attempted window:** FY2009–FY2025 (17 yrs, D-01 full-attempt). **Loaded: 17/17 — 0 holes.**

| FY | Operating (GF Total Exp, $) | Revenue (GF Total Rev, $) | Tie | Extractor |
|----|---------------------------|--------------------------|-----|-----------|
| 2009 | 15,771,383,000 | 16,386,072,000 | $0/$0 | positional |
| 2010 | 16,862,856,000 | 17,974,787,000 | $0/$0 | positional |
| 2011 | 17,945,526,000 | 19,333,040,000 | $0/$0 | positional |
| 2012 | 18,071,481,000 | 19,311,910,000 | $0/$0 | positional |
| 2013 | 17,797,954,000 | 19,247,386,000 | $0/$0 | positional |
| 2014 | 17,796,222,000 | 18,783,610,000 | $0/$0 | positional |
| 2015 | 18,351,323,000 | 19,794,774,000 | $0/$0 | token-order |
| 2016 | 19,172,294,000 | 20,942,947,000 | $0/$0 | token-order |
| 2017 | 19,353,023,000 | 21,363,379,000 | $0/$0 | token-order |
| 2018 | 19,919,632,000 | 21,972,111,000 | $0/$0 | token-order |
| 2019 | 20,214,973,000 | **22,201,193,000** (bookend ✅) | $0/$0 | token-order |
| 2020 | 21,839,637,000 | 24,494,440,000 | $0/$0 | token-order |
| 2021 | 24,401,560,000 | 28,609,255,000 | $0/$0 | token-order |
| 2022 | 25,531,223,000 | 30,653,486,000 | $0/$0 | token-order |
| 2023 | 26,687,537,000 | 32,451,372,000 | $0/$0 | token-order |
| 2024 | 29,321,014,000 | 31,700,317,000 | $0/$0 | token-order |
| 2025 | 32,459,939,000 | **35,473,625,000** (bookend ✅) | $0/$0 | token-order |

## Load-time recon-corrections (expected per 108 lesson)
1. **tn.gov resets plain-curl connections** — downloads require a browser User-Agent (`-A Mozilla/5.0…`). Baked into both loaders' curl invocation.
2. **FY2009–FY2014 blank-GF-cell layout** — older statements leave empty GENERAL FUND cells truly blank (no `--` placeholder), shifting token-order extraction into the Education-fund column (exp sum overshot by ~$8.5–9.4B). **Parser evolution (109-01):** added `extractGovFundGeneralColumnPositional` to `scripts/maAcfrExtract.mjs` — assigns each row's numeric tokens to the nearest right-aligned anchor column (anchors from the Total revenues / Total expenditures rows). Loaders try token-order first, fall back to positional; the exact per-FY tie stays the gate. Recovered all 6 years — no operating holes.
3. All 17 recon URLs valid as enumerated (mixed-case + FY2025 `ACFR%20-%20FY25.pdf` space+dash special case confirmed).

## Enumerated URL record (SOURCES)
Base `https://www.tn.gov/content/dam/tn/finance/acfr/archive/` + `acfr_fy{09..19}.pdf` (lowercase), `acfr_fy20.pdf`, `ACFR_fy21.pdf`, `ACFR_FY22.pdf`, `ACFR_fy23.pdf`, `ACFR_FY24.pdf`, `ACFR%20-%20FY25.pdf`. All real PDFs (2.7–13.9 MB, `%PDF-` magic).

## NASBO replacement (RECON-08)
Pre-load baseline (recorded before write): exactly 2 NASBO operating rows — FY2023 **$19,570M**, FY2024 **$23,411M** (`data_source_id=null`, budgetary basis), 0 revenue rows. Post-load: **34 rows (17 op + 17 rev), 0 NASBO labels, 0 dup (fy,dataset) keys, 0 unsourced** — NASBO FY2023/FY2024 replaced in place at the same `(muni,fy,'operating')` keys.

## Accept-and-relabel divergence (D-07, ACFR-19)
TN ACFR GAAP GF vs NASBO budgetary GF: FY2023 operating $26,688M vs $19,570M (**1.36×**); FY2024 operating $29,321M vs $23,411M (**1.25×**); FY2025 revenue $35,474M vs NASBO FY2024 $23,411M (**~1.51×**, recon's figure). Driver: **Federal revenue $17,490M inside the FY2025 GAAP GF** (Medicaid/education passthrough NASBO excludes). Relabelled honestly — every row carries "Tennessee State ACFR — General Fund (FY{fy} actual, GAAP basis)".

## P2 clamp (D-06, ACFR-20)
Investment income positive every loaded year (FY2025 +$1,042,605K … FY2009 checked). `clampForRender` wired in the revenue loader; not triggered.

## Idempotency (D-09)
FY2025 re-run (operating + revenue) → row count still 34, 0 dup keys, totals unchanged — **0 net change**.

## Money In
17 revenue rows live → Money In auto-enabled on the TN node (data-driven).

## Cohort untouched (RECON-08)
Post-load 50-state snapshot: all 14 existing ACFR nodes unchanged (CA 36, MA 38, MN 36, NY 44, NC 28, PA 20, TX 20, NJ 12, OH 12, IL 10, GA 10, FL 8, MD 8, VA 8 rows — 0 NASBO each); all 35 remaining NASBO-state nodes (incl. CT/WI/WA/MI pending in this phase) still exactly 2 NASBO operating rows each.
