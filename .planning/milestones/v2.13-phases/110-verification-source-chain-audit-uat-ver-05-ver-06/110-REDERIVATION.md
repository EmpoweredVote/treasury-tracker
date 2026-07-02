# 110-REDERIVATION — Independent ACFR Re-Derivation Log (VER-05 part a)

**Executed:** 2026-07-01 · **Harness:** `scripts/verify-phase110-rederive.mjs` · **Spend:** $0

## Headline verdict

**49/49 exact ties, 0 deltas.** Every sampled FY-dataset check across all 10 tranche-2 states
(NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI) ties the blind-re-extracted General-Fund printed total
to the live `treasury.budgets` value at **exactly $0**. No explanations needed, no fixes needed,
no tolerance band used. Harness exits 0.

## Method (blind / loader-independent)

- The harness imports **zero** `scripts/process*.js` loaders and **zero** shared-parser modules
  (`scripts/maAcfrExtract.mjs` / `extractGovFundGeneralColumn` — the loaders' own extraction path).
  Its statement locator and total-line parser are an independent implementation: auto-locate the
  *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* page
  (whitespace-normalized title match; combining/budgetary/notes-reconciliation pages excluded),
  then take the first numeric token on the printed "Total revenues" / "Total expenditures" lines
  (= the GENERAL FUND 1st column in all 10 states' layouts, incl. CT's 7-column and MI's Fund-code
  headers), strip "(Note NN)" cross-refs, apply the state's unit multiplier.
- Source bytes: the load-time verified `_acfr-work/{st}/{ST}{YYYY}.pdf` cache (each `%PDF` magic +
  size checked again at harness runtime; Phase 106 cache-reuse precedent). Canonical re-fetch URLs
  recorded per target from 107-BATCH{1,2}-SOURCES.md + LOADLOG load-time corrections.
- Municipality IDs resolved at runtime by entity name (exactly-1-row assertion).
- Bar: `abs(delta) === 0` exactly (Phase 106 D-03 carried forward). Clamp years compare the printed
  GF **root** total, which already nets the negative line — matching how the loader stored
  `total_budget`.

## Sample definition (reproducible)

Bookends = oldest loaded FY + FY2025 (newest for all 10 states), both datasets. Documented random
middles: **MA FY2016** (mid of the contiguous FY2015–2020 run, avoiding the FY2014 hole),
**NC FY2019** (year 8/14 of FY2012–2025), **TN FY2017** (year 9/17 of FY2009–2025). Clamp-year
extras (rev-only): CT FY2013, WI FY2013, WA FY2022; MD FY2022 is both the oldest bookend and the
Batch-1 clamp year. 26 FY targets → 49 FY-dataset checks.

## Per-check results

| State | FY | Dataset | Independent re-extracted total | Live DB total_budget | Delta | Disposition |
|-------|----|---------|-------------------------------|----------------------|-------|-------------|
| NJ | 2020 | revenue | $38,768,977,008 | $38,768,977,008 | $0 | exact tie (dollars ×1) |
| NJ | 2020 | operating | $36,563,705,440 | $36,563,705,440 | $0 | exact tie |
| NJ | 2025 | revenue | $60,979,024,211 | $60,979,024,211 | $0 | exact tie |
| NJ | 2025 | operating | $59,603,886,014 | $59,603,886,014 | $0 | exact tie |
| MA | 2003 | revenue | $13,011,835,000 | $13,011,835,000 | $0 | exact tie (colon-fix-recovered oldest FY) |
| MA | 2003 | operating | $11,450,114,000 | $11,450,114,000 | $0 | exact tie |
| MA | 2016 | revenue | $36,690,392,000 | $36,690,392,000 | $0 | exact tie (random middle) |
| MA | 2016 | operating | $35,530,773,000 | $35,530,773,000 | $0 | exact tie |
| MA | 2025 | revenue | $61,907,573,000 | $61,907,573,000 | $0 | exact tie |
| MA | 2025 | operating | $58,604,191,000 | $58,604,191,000 | $0 | exact tie |
| NC | 2012 | revenue | $35,413,469,000 | $35,413,469,000 | $0 | exact tie (colon-fix-recovered oldest FY) |
| NC | 2012 | operating | $36,460,325,000 | $36,460,325,000 | $0 | exact tie |
| NC | 2019 | revenue | $42,576,109,000 | $42,576,109,000 | $0 | exact tie (random middle) |
| NC | 2019 | operating | $42,555,689,000 | $42,555,689,000 | $0 | exact tie |
| NC | 2025 | revenue | $75,416,082,000 | $75,416,082,000 | $0 | exact tie |
| NC | 2025 | operating | $74,597,628,000 | $74,597,628,000 | $0 | exact tie |
| GA | 2021 | revenue | $55,378,103,000 | $55,378,103,000 | $0 | exact tie |
| GA | 2021 | operating | $46,514,015,000 | $46,514,015,000 | $0 | exact tie |
| GA | 2025 | revenue | $68,445,055,000 | $68,445,055,000 | $0 | exact tie |
| GA | 2025 | operating | $62,533,774,000 | $62,533,774,000 | $0 | exact tie |
| MD | 2022 | revenue | $50,540,136,000 | $50,540,136,000 | $0 | exact tie — CLAMP year: printed root nets "Interest and other investment income" −$275,992K; loader stored the printed root, so the tie is exact (the loadlog's +$2K note was printed-vs-line-sum, not printed-vs-stored) |
| MD | 2022 | operating | $45,744,096,000 | $45,744,096,000 | $0 | exact tie |
| MD | 2025 | revenue | $48,689,018,000 | $48,689,018,000 | $0 | exact tie (same: −$1K loadlog note was line-sum-side) |
| MD | 2025 | operating | $52,367,297,000 | $52,367,297,000 | $0 | exact tie |
| TN | 2009 | revenue | $16,386,072,000 | $16,386,072,000 | $0 | exact tie (blank-GF-cell era; totals row fully populated) |
| TN | 2009 | operating | $15,771,383,000 | $15,771,383,000 | $0 | exact tie |
| TN | 2017 | revenue | $21,363,379,000 | $21,363,379,000 | $0 | exact tie (random middle) |
| TN | 2017 | operating | $19,353,023,000 | $19,353,023,000 | $0 | exact tie |
| TN | 2025 | revenue | $35,473,625,000 | $35,473,625,000 | $0 | exact tie |
| TN | 2025 | operating | $32,459,939,000 | $32,459,939,000 | $0 | exact tie |
| CT | 2002 | revenue | $11,745,453,000 | $11,745,453,000 | $0 | exact tie (pre-GASB-34 boundary edition, oldest FY in the cohort) |
| CT | 2002 | operating | $12,554,181,000 | $12,554,181,000 | $0 | exact tie |
| CT | 2013 | revenue | $20,134,738,000 | $20,134,738,000 | $0 | exact tie — CLAMP year: printed root nets "Investment Earnings (Loss)" −$2,100K |
| CT | 2025 | revenue | $26,074,183,000 | $26,074,183,000 | $0 | exact tie (7-column layout, General 1st) |
| CT | 2025 | operating | $25,072,796,000 | $25,072,796,000 | $0 | exact tie |
| WI | 2002 | revenue | $16,448,706,000 | $16,448,706,000 | $0 | exact tie (oldest loaded FY) |
| WI | 2002 | operating | $15,881,746,000 | $15,881,746,000 | $0 | exact tie |
| WI | 2013 | revenue | $23,786,216,000 | $23,786,216,000 | $0 | exact tie — CLAMP year: printed root nets Interest Income −$838K |
| WI | 2025 | revenue | $38,655,598,000 | $38,655,598,000 | $0 | exact tie |
| WI | 2025 | operating | $36,445,383,000 | $36,445,383,000 | $0 | exact tie |
| WA | 2020 | revenue | $38,977,410,000 | $38,977,410,000 | $0 | exact tie |
| WA | 2020 | operating | $38,315,455,000 | $38,315,455,000 | $0 | exact tie |
| WA | 2022 | revenue | $53,683,370,000 | $53,683,370,000 | $0 | exact tie — CLAMP year (largest): printed root nets "Investment income (loss)" −$216,940K |
| WA | 2025 | revenue | $55,775,958,000 | $55,775,958,000 | $0 | exact tie (unique FY2025 filename) |
| WA | 2025 | operating | $58,602,334,000 | $58,602,334,000 | $0 | exact tie |
| MI | 2019 | revenue | $36,674,832,000 | $36,674,832,000 | $0 | exact tie (Fund-10 GF column; Sep-30 FY-end) |
| MI | 2019 | operating | $36,124,451,000 | $36,124,451,000 | $0 | exact tie |
| MI | 2025 | revenue | $53,788,610,000 | $53,788,610,000 | $0 | exact tie — the loadlog's +1K note was printed-vs-line-sum; the loader stored the PRINTED total, which is the bar here |
| MI | 2025 | operating | $55,592,047,000 | $55,592,047,000 | $0 | exact tie |

## Rounding-note reconciliation (the only pre-approved non-zero candidates)

The loadlogs flagged printed-vs-**line-sum** GAAP thousands-rounding at MA FY2023/24, MD FY2022/25,
MI FY2025 (≤$2K each). This harness compares printed-root vs **stored**, and all such sampled years
tie at exactly $0 — confirming the loaders stored the printed root totals (the honest comparator).
No explanation or fix was needed anywhere in the sample.

## Harness self-caught false positives (not data defects — recorded for honesty)

The first harness run reported 4 WI deltas (FY2002, FY2025). Root cause was in the *harness*
locator, not the data: `pdftotext -table` pads the statement title with column-alignment gaps
("Changes    in Fund Balances"), so the title match missed the true statement page and fell
through to the Notes reconciliation table (whose first column is **Total Governmental Funds** —
$43.2B for FY2025). After whitespace-normalizing the title match, the locator lands on the true
statement page (WI2025 p.51, WI2002 p.41) and all 4 checks tie at exactly $0. The DB values were
correct throughout.

## Deep-window / negative-clamp coverage

- Oldest-in-cohort FY2002 editions (CT, WI — the pre-GASB-34 boundary) both re-derive exactly.
- All 4 sampled clamp years (MD FY2022, CT FY2013, WI FY2013, WA FY2022) confirm the stored root
  total equals the printed root total that nets the negative line — the P2 clamp affects the
  child-category render only, never the root.
- NJ's dollars-unit (×1) confirmed against full-dollar printed values (no thousands inflation).
- MI's Sep-30 FY-end rows compare at the same NASBO-aligned FY keys (FY2025 = Oct 2024–Sep 2025).
