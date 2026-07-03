# 116-REDERIVATION — Independent ACFR Re-Derivation Log (VER-07 part a)

**Executed:** 2026-07-03 · **Harness:** `scripts/verify-phase116-rederive.mjs` · **Spend:** $0

## Headline verdict

**75/75 exact ties, 0 deltas.** Every sampled FY-dataset check across all 10 tranche-3 states
(IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA) and all 4 deepened states (NJ, CT, WI, MA) ties the
blind-re-extracted General-Fund printed total to the live `treasury.budgets` value at **exactly
$0**. No explanations needed, no in-phase fixes needed, no tolerance band used. The two
pre-flagged candidates for a possible documented-rounding disposition — WI FY2001 pre-34
expenditure (115-02 loadlog: -2K note) and MA FY2014 revenue (115-03 loadlog: -1 note) — both
tied at **exact $0** in this independent re-derivation (see Rounding-note reconciliation below).
Harness exits 0.

## Method (blind / loader-independent)

- The harness imports **zero** `scripts/process*.js` loaders and **zero** shared-parser modules
  (`maAcfrExtract.mjs`, `pre34Extract.mjs`, `njAcfrExtract.mjs` — the loaders' own extraction
  paths). Its statement locator and total-line parser are an independent implementation:
  - Modern (GASB-34) statements: auto-locate the *Statement of Revenues, Expenditures, and
    Changes in Fund Balances — Governmental Funds* page (whitespace-normalized title match;
    combining/budgetary/notes-reconciliation pages excluded), then take the first numeric token
    on the printed "Total revenues" / "Total expenditures" lines (= the GENERAL FUND 1st column).
  - Pre-GASB-34 statements (CT FY1988–2001, WI FY2000–2001, MA FY2001): auto-locate the
    "Combined Statement of Revenues, Expenditures, and Changes in Fund Balances — All
    Governmental Fund Types" page (title-phrase co-occurrence, order-independent since MA prints
    the subtitle before the title and CT/WI print it after), excluding the non-GAAP
    Budget-and-Actual schedule and combining statements.
  - CT FY2006 (scanned page, no text layer): independently re-rendered at 300dpi
    (`pdftoppm`) and re-OCR'd (`tesseract --psm 6`) at the loadlog-documented page (40/164) — NOT
    read from the loader's embedded `CT2006_REVENUES`/`CT2006_EXPENDITURES` static arrays.
- Source bytes: the load-time verified `_acfr-work/{st}/{ST}{YYYY}.pdf` cache (each `%PDF` magic +
  size re-checked at harness runtime). All 41 targets resolved from cache; no re-fetch was needed
  (AZ FY2024's Drive link was not exercised this run — cache present and valid).
- Municipality IDs resolved at runtime by entity name (exactly-1-row assertion) for all 14 states.
- Bar: `abs(delta) === 0` exactly (Phase 106/110 D-03 carried forward). Clamp years compare the
  printed GF **root** total, which already nets the negative line — matching how the loader
  stored `total_budget`.

## Sample definition (reproducible)

**Tranche-3 (10 states):** bookends (oldest loaded FY + FY2025) on both datasets for IN, AZ
(FY2024 newest — Drive-link caveat year), OR, CO, SC, KY, UT, AL, LA. Documented random middles:
**IN/SC/AL/LA FY2013** (arithmetic middle, year 12/24 of FY2002–2025); **KY FY2012** (year 11/24,
deliberately one year clear of the FY2023 honest hole). Clamp years (rev-only, printed-root bar):
**MO FY2013/2017/2018/2021/2022/2023** (all 6 P2 clamp years, plus bookends FY2012+FY2025);
**CO FY2023+FY2025** (both years TABOR-clamped); **UT FY2022** (Investment Income (Loss) clamp,
in addition to bookends FY2019+FY2025).

**Deepening (4 states):** **NJ FY2002** (new archive-edge floor) + **FY2010** (random middle of
the newly-recovered FY2002–2019 run) — UNITS=1 (full dollars). **CT FY1988** (archive floor,
pre-34) + **FY2001** (pre-34 boundary) + **FY2006** (OCR-recovered, GAAP basis). **WI FY2000**
(archive floor, pre-34) + **FY2001** (pre-34, known -2K rounding-note candidate). **MA FY2001**
(pre-34, recovered) + **FY2014** (recovered, GAAP basis, known -1 rounding-note candidate).

41 FY targets → 75 FY-dataset checks (MO clamp years and UT FY2022 are rev-only = 1 check each).

## Per-check results

| State | FY | Dataset | Independent re-extracted total | Live DB total_budget | Delta | Disposition |
|-------|----|---------|-------------------------------|----------------------|-------|-------------|
| IN | 2002 | revenue | $7,341,746,000 | $7,341,746,000 | $0 | exact tie (oldest bookend) |
| IN | 2002 | operating | $7,536,060,000 | $7,536,060,000 | $0 | exact tie |
| IN | 2013 | revenue | $13,527,118,000 | $13,527,118,000 | $0 | exact tie (random middle, yr 12/24) |
| IN | 2013 | operating | $12,078,737,000 | $12,078,737,000 | $0 | exact tie |
| IN | 2025 | revenue | $23,203,835,000 | $23,203,835,000 | $0 | exact tie (newest bookend) |
| IN | 2025 | operating | $19,123,203,000 | $19,123,203,000 | $0 | exact tie |
| AZ | 2002 | revenue | $11,655,423,000 | $11,655,423,000 | $0 | exact tie (oldest bookend) |
| AZ | 2002 | operating | $11,702,561,000 | $11,702,561,000 | $0 | exact tie |
| AZ | 2024 | revenue | $44,045,434,000 | $44,045,434,000 | $0 | exact tie — Drive-link caveat year, re-derived from the same cached Drive PDF the loadlog recorded |
| AZ | 2024 | operating | $45,047,271,000 | $45,047,271,000 | $0 | exact tie |
| OR | 2022 | revenue | $15,711,953,000 | $15,711,953,000 | $0 | exact tie (window-floor bookend) |
| OR | 2022 | operating | $13,673,575,000 | $13,673,575,000 | $0 | exact tie |
| OR | 2025 | revenue | $17,291,987,000 | $17,291,987,000 | $0 | exact tie (newest bookend) |
| OR | 2025 | operating | $17,774,745,000 | $17,774,745,000 | $0 | exact tie |
| MO | 2012 | revenue | $18,068,155,000 | $18,068,155,000 | $0 | exact tie (window-floor bookend) |
| MO | 2012 | operating | $15,462,049,000 | $15,462,049,000 | $0 | exact tie |
| MO | 2025 | revenue | $32,960,973,000 | $32,960,973,000 | $0 | exact tie (newest bookend) |
| MO | 2025 | operating | $31,848,774,000 | $31,848,774,000 | $0 | exact tie |
| MO | 2013 | revenue | $18,185,825,000 | $18,185,825,000 | $0 | exact tie — CLAMP year: printed root nets Fair Value of Investments -$11,518K |
| MO | 2017 | revenue | $19,801,137,000 | $19,801,137,000 | $0 | exact tie — CLAMP year: printed root nets -$3,250K |
| MO | 2018 | revenue | $20,213,937,000 | $20,213,937,000 | $0 | exact tie — CLAMP year: printed root nets -$2,981K |
| MO | 2021 | revenue | $27,260,093,000 | $27,260,093,000 | $0 | exact tie — CLAMP year: printed root nets -$7,566K |
| MO | 2022 | revenue | $29,984,198,000 | $29,984,198,000 | $0 | exact tie — CLAMP year (largest MO clamp): printed root nets -$309,337K |
| MO | 2023 | revenue | $32,948,695,000 | $32,948,695,000 | $0 | exact tie — CLAMP year: printed root nets -$187,845K |
| CO | 2023 | revenue | $24,912,540,000 | $24,912,540,000 | $0 | exact tie (window-floor bookend, TABOR refund netted into revenue lines, no standalone negative line this year) |
| CO | 2023 | operating | $24,805,259,000 | $24,805,259,000 | $0 | exact tie |
| CO | 2025 | revenue | $27,950,701,000 | $27,950,701,000 | $0 | exact tie — CLAMP year: printed root nets standalone "TABOR Excess Revenue" -$129,536K |
| CO | 2025 | operating | $27,559,901,000 | $27,559,901,000 | $0 | exact tie |
| SC | 2002 | revenue | $5,763,261,000 | $5,763,261,000 | $0 | exact tie (oldest bookend) |
| SC | 2002 | operating | $5,455,224,000 | $5,455,224,000 | $0 | exact tie |
| SC | 2013 | revenue | $9,874,881,000 | $9,874,881,000 | $0 | exact tie (random middle, yr 12/24) |
| SC | 2013 | operating | $8,823,817,000 | $8,823,817,000 | $0 | exact tie |
| SC | 2025 | revenue | $20,731,521,000 | $20,731,521,000 | $0 | exact tie (newest bookend, part-file BasicFinancialStatements) |
| SC | 2025 | operating | $20,323,239,000 | $20,323,239,000 | $0 | exact tie |
| KY | 2002 | revenue | $6,510,474,000 | $6,510,474,000 | $0 | exact tie (oldest bookend) |
| KY | 2002 | operating | $6,650,623,000 | $6,650,623,000 | $0 | exact tie |
| KY | 2012 | revenue | $8,945,590,000 | $8,945,590,000 | $0 | exact tie (random middle, yr 11/24 — deliberately clear of the FY2023 honest hole) |
| KY | 2012 | operating | $8,907,430,000 | $8,907,430,000 | $0 | exact tie |
| KY | 2025 | revenue | $15,541,675,000 | $15,541,675,000 | $0 | exact tie (newest bookend). FY2023 NOT sampled (documented honest hole — see below) |
| KY | 2025 | operating | $14,495,976,000 | $14,495,976,000 | $0 | exact tie |
| UT | 2019 | revenue | $6,509,587,000 | $6,509,587,000 | $0 | exact tie (window-floor bookend) |
| UT | 2019 | operating | $7,386,308,000 | $7,386,308,000 | $0 | exact tie |
| UT | 2025 | revenue | $11,404,950,000 | $11,404,950,000 | $0 | exact tie (newest bookend) |
| UT | 2025 | operating | $12,924,757,000 | $12,924,757,000 | $0 | exact tie |
| UT | 2022 | revenue | $10,798,468,000 | $10,798,468,000 | $0 | exact tie — CLAMP year: printed root nets Investment Income (Loss) -$4,304K |
| AL | 2002 | revenue | $1,094,623,000 | $1,094,623,000 | $0 | exact tie (oldest bookend; Sep-30 FY-end) |
| AL | 2002 | operating | $1,044,708,000 | $1,044,708,000 | $0 | exact tie |
| AL | 2013 | revenue | $1,405,981,000 | $1,405,981,000 | $0 | exact tie (random middle, yr 12/24) |
| AL | 2013 | operating | $1,353,122,000 | $1,353,122,000 | $0 | exact tie |
| AL | 2025 | revenue | $3,399,417,000 | $3,399,417,000 | $0 | exact tie (newest bookend) |
| AL | 2025 | operating | $2,597,406,000 | $2,597,406,000 | $0 | exact tie |
| LA | 2002 | revenue | $5,807,699,000 | $5,807,699,000 | $0 | exact tie (oldest bookend) |
| LA | 2002 | operating | $14,695,770,000 | $14,695,770,000 | $0 | exact tie |
| LA | 2013 | revenue | $10,287,062,000 | $10,287,062,000 | $0 | exact tie (random middle, yr 12/24) |
| LA | 2013 | operating | $22,733,857,000 | $22,733,857,000 | $0 | exact tie |
| LA | 2025 | revenue | $22,780,529,000 | $22,780,529,000 | $0 | exact tie (newest bookend) |
| LA | 2025 | operating | $39,246,140,000 | $39,246,140,000 | $0 | exact tie |
| NJ | 2002 | revenue | $21,939,257,600 | $21,939,257,600 | $0 | exact tie — new archive-edge floor (dollars ×1, no pre-34 boundary exists for NJ) |
| NJ | 2002 | operating | $24,075,099,379 | $24,075,099,379 | $0 | exact tie |
| NJ | 2010 | revenue | $30,777,686,614 | $30,777,686,614 | $0 | exact tie (random middle of the newly-recovered FY2002–2019 run) |
| NJ | 2010 | operating | $32,638,456,069 | $32,638,456,069 | $0 | exact tie |
| CT | 1988 | revenue | $5,030,680,000 | $5,030,680,000 | $0 | exact tie (archive floor, pre-GASB-34 Combined Statement basis) |
| CT | 1988 | operating | $5,066,954,000 | $5,066,954,000 | $0 | exact tie |
| CT | 2001 | revenue | $12,674,068,000 | $12,674,068,000 | $0 | exact tie (pre-GASB-34 boundary year) |
| CT | 2001 | operating | $12,273,058,000 | $12,273,058,000 | $0 | exact tie |
| CT | 2006 | revenue | $14,941,201,000 | $14,941,201,000 | $0 | exact tie — independently re-OCR'd (300dpi + tesseract --psm 6, PDF page 40/164), GASB-34-era GAAP basis |
| CT | 2006 | operating | $13,924,122,000 | $13,924,122,000 | $0 | exact tie |
| WI | 2000 | revenue | $15,498,923,000 | $15,498,923,000 | $0 | exact tie (archive floor, pre-GASB-34) |
| WI | 2000 | operating | $14,103,791,000 | $14,103,791,000 | $0 | exact tie |
| WI | 2001 | revenue | $15,807,384,000 | $15,807,384,000 | $0 | exact tie (pre-GASB-34 boundary year) |
| WI | 2001 | operating | $14,847,684,000 | $14,847,684,000 | $0 | exact tie — pre-flagged as the known -2K rounding-note candidate (115-02 loadlog); independent re-derivation ties EXACT, no diff — see Rounding-note reconciliation |
| MA | 2001 | revenue | $13,623,688,000 | $13,623,688,000 | $0 | exact tie — recovered 115-03, pre-GASB-34 Combined Statement (MA prints the "All Governmental Fund Types" subtitle before the title) |
| MA | 2001 | operating | $11,211,746,000 | $11,211,746,000 | $0 | exact tie |
| MA | 2014 | revenue | $32,591,574,000 | $32,591,574,000 | $0 | exact tie — recovered 115-03, font-glyph-corrupted statement ("Total revenaes" for "Total revenues"); pre-flagged as the known -1 rounding-note candidate; independent re-derivation ties EXACT — see Rounding-note reconciliation |
| MA | 2014 | operating | $31,299,733,000 | $31,299,733,000 | $0 | exact tie |

## Rounding-note reconciliation (the only pre-approved non-zero candidates)

The loadlogs flagged two possible printed-vs-line-sum rounding diffs: **WI FY2001** pre-34
expenditure (115-02 loadlog: -2K, documented as within the loader's TOL=5) and **MA FY2014**
revenue (115-03 loadlog: -1, documented as consistent with the GAAP thousands-rounding pattern
already seen at FY2023/FY2024). Both were sampled here specifically to test whether the harness's
independent re-extraction would reproduce the discrepancy. Neither did: this harness's
printed-root comparator ties **exactly $0** against the stored `total_budget` for both. Consistent
with the 110-REDERIVATION precedent (MD/MI rounding notes also resolved to $0 against the printed
root), the loadlog notes describe a printed-vs-line-sum reconciliation internal to the loader's own
validation step, not a printed-vs-stored discrepancy — the loaders stored the printed root total
in both cases, which is the correct comparator and the one this harness uses. No explanation or
fix was needed.

## Harness self-caught issue (not a data defect — recorded for honesty)

The first harness run reported 2 FAILs (MA FY2014 revenue + operating: "Governmental Funds
statement not auto-located"). Root cause was in the *harness's* title-anchor regex, not the data:
`pdftotext -table` renders this specific PDF's statement title as "Statement ofRevenues,Expenditures
and Changes in Fund Balances" — missing the space after "of" and after the comma (a kerning/spacing
defect distinct from, but co-located with, the documented font-glyph substitutions on this PDF's
section-header lines). The harness's title match required a literal `"of revenues, expenditures"`
substring, which never matched. Fixed by loosening the title-anchor to a `\s*`-tolerant regex
(`statement\s*of\s*revenues\s*,?\s*expenditures`) and by normalizing the single documented
glyph substitution ("Total revenaes" → "Total revenues", per the 115-03 loadlog) before line
matching. After the fix, the locator lands on the true statement page (MA2014 p.56) and both
checks tie at exactly $0. The DB values were correct throughout; this was purely a re-derivation
harness defect, fixed per Rule 3 (auto-fix blocking issue in the current task's own deliverable).

## Honest-hole confirmation (absent-by-design, not re-litigated)

- **KY FY2023** — NOT sampled (broken-font PDF, no ToUnicode CMap; NASBO row retained per 114-02
  loadlog). Confirmed absent-by-design; KY's sample instead uses FY2012 as its middle year,
  deliberately one year clear of the hole.
- **AZ stops at FY2024** — FY2025 not yet sourced at load time; not a gap in this sample (FY2024
  is the newest bookend, sampled and tied exact including the Drive-link caveat).
- **Window floors are recon/format-locked** — OR FY2022, CO FY2023, MO FY2012, UT FY2019 (modern
  tranche-3 floors); CT FY1988, WI FY2000 (pre-GASB-34 boundary/multi-file-era edge); NJ FY2002
  (archive edge, no pre-34 boundary exists for NJ). All confirmed present and tied exact at their
  respective floors.

## Deep-window / negative-clamp coverage

- Both CT and WI pre-GASB-34 archive floors (FY1988, FY2000) and boundary years (FY2001, FY2001)
  re-derive exactly from the "All Governmental Fund Types" Combined Statement.
- MA FY2001 (pre-34, subtitle-before-title order) and MA FY2014 (GAAP, glyph-corrupted) both
  recovered from Phase 115 tie exact.
- CT FY2006's OCR recovery (scanned page, no text layer) ties exact via an independent re-render
  and re-OCR — not read from the loader's embedded static arrays.
- All 9 sampled clamp years (MO ×6, CO ×2 — including the largest-in-cohort MO FY2022 at
  -$309,337K — and UT FY2022) confirm the stored root total equals the printed root total that
  nets the negative line: the P2 clamp affects the child-category render only, never the root.
- NJ's dollars-unit (×1) confirmed against full-dollar printed values at both the new archive
  floor (FY2002) and the FY2010 middle of the newly-recovered range — no thousands inflation.
- AL's Sep-30 FY-end rows compare at the same NASBO-aligned FY keys as every other state.
