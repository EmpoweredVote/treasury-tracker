# 124-01 — Independent Re-Derivation Log (VER-09, part a)

**Headline verdict: 149/151 exact ties ($0 delta); 2 EXPLAINED (loadlog-documented rounding, no in-phase fix required). Harness `node scripts/verify-phase124-rederive.mjs` exits 2 only because of these 2 pre-approved, documented non-zero deltas — every other check ties at exact $0.**

Scope: the 21 newly-loaded v2.15 final-tail states (Phases 118–121, risk-weighted sample: bookends + newest FY + every documented transcription-risk/clamp year) **plus** the FULL 24-state-FY CA/FL deepening set (Phase 122: CA FY2002–FY2007, FL FY2003–FY2020), exhaustive on both datasets. 78 FY targets → 151 FY-dataset checks (5 targets are `revOnly` clamp-year samples).

Method: `scripts/verify-phase124-rederive.mjs` blind-re-extracts the GENERAL FUND column "Total revenue(s)"/"Total expenditure(s)" printed line from each source ACFR/CAFR PDF using its own independent `pdftotext -table` pass (or independent `pdftoppm` + `tesseract` OCR for the 4 image/scan years), then diffs against the live `treasury.budgets.total_budget` value. Zero loader/parser code imported or shelled out to (no `scripts/process*Acfr.js`, no `_acfr-work/extract_gf.py` / `gen_state.py` / `ia_extract.py`, no `maAcfrExtract.mjs` / `pre34Extract.mjs`). PASS bar = `abs(delta) === 0` exactly, carried forward from the Phase 106/110/116 precedent — no tolerance band anywhere in the disposition logic.

## Sample documentation (reproducibility)

- **Middle year:** AK FY2015 (arithmetic middle of the loaded FY2006–2025 window).
- **Clamp years sampled (revOnly — bar is the printed GF root/control total, which already nets the negative line, matching how the loader stored `total_budget`):** KS FY2021 (Investment earnings −$3,712K), NE FY2022 (Investment Income −$191,405K), NV FY2022 (Interest and investment income (loss) −$141,921,982), ND FY2022 (Interest and Investment Income (Loss) −$897,827,062), WY FY2013 (interior Fair-Market-Value/Sale-of-Assets clamp).
- **UNITS=1 (full dollars) states, independently confirmed:** NV, ND, VT, WY — all 4 states' checks tie exactly with the ×1 multiplier, no thousands-scaling error.
- **UNITS=1000 (thousands) states:** the other 17 new states + CA + FL.
- **NET-REVENUES tie (IA):** IA's statement prints GROSS REVENUES / "Less Revenue Refunds" / NET REVENUES with no literal "Total revenues" line. The harness re-keys the literal "NET REVENUES" printed row directly (FY2002, FY2009, FY2025 all tie exact $0) — this IS the GROSS-minus-refunds arithmetic already baked into the printed statement, re-derived independently rather than recomputed.
- **Single-fund state (AR):** AR's whole "Statement of Revenues, Expenditures, and Changes in Fund Balance" (singular, one column) IS the General Fund. The harness's standard modern-statement extraction applies unmodified (AR's own statement still labels its total row "Total revenues"/"Total expenditures", plural, despite being conceptually single-fund) — FY2003 + FY2024 both tie exact $0.
- **ID FY2004 mixed-unit high-risk year:** re-extracted as WHOLE DOLLARS (harness applies a `unitsOverride: 1` for this single target, since the printed statement itself is in whole dollars, not thousands like every other ID year) — see Disposition Table below for the resulting rounding note.
- **OCR-independent years (image/scan, re-rendered + re-OCR'd FRESH every harness run from the source PDF — never read from any loader-embedded static array `nm_all.json` / `ok_all.json` / `sd_all.json`):**
  - **NM FY2022** — Governmental Funds statement (printed pp. 36–37) renders as a raster image with zero `pdftotext` content. Independently re-rendered at 300dpi (`pdftoppm`) and re-OCR'd (`tesseract --psm 6`) at PDF pages 48–49 (page-location hint from the 120-04 loadlog — a location fact, not an extracted value). Result: Total Revenues $26,161,736,000 / Total Expenditures $20,159,689,000 — **exact $0 tie** against both the stored value AND the loadlog's own independent hand-transcription (two independent re-derivations of the same image, identical result).
  - **OK FY2019** — the statement (PDF page 56) is a single embedded JPEG image, no text layer. Independently re-rendered + re-OCR'd at page 56 (hint from the 121-01 loadlog). Result: Total Revenues $19,417,878,000 / Total Expenditures $18,344,756,000 — **exact $0 tie**.
  - **SD FY2007 + FY2010** — 2 of the 9 whole-document-scanned years (FY2003–2011 excl. FY2002). Independently re-rendered + re-OCR'd across PDF pages 44–50 (statement-page-range hint from the 121-03 loadlog); SD's SINGULAR "Total Revenue"/"Total Expenditures" labels matched via the harness's `singular` OCR flag. Both years tie **exact $0** (FY2007 $917,987,000/$1,092,097,000; FY2010 $916,027,000/$1,114,735,000).
- **SD singular-label discovery (auto-extracted years):** the harness's standard `parseModernGFTotals` regex was widened to accept "total revenue(s)"/"total expenditure(s)" (optional trailing "s") — a safe superset per the 121-03 SD-loadlog precedent — after the first run showed SD FY2002/FY2025 as FAIL ("statement not auto-located") purely because SD's printed labels are singular ("Total Revenue", not "Total Revenues"). Re-run after the fix: both tie exact $0, zero regression on the other 20 states (all of which use plural labels).
- **WY budget-schedule-exclusion refinement:** the standard statement-page locator's exclusion filter was refined from a bare `includes('budget')` check to `includes('budgetary comparison') || includes('budget and actual') || includes('budget to actual')`, because WY's real GAAP Governmental Funds statement has a fund literally named "Budget Reserve Fund" as a COLUMN header, which would have falsely excluded WY's correct statement page under the bare-substring check. No effect on any other state (none of the other 22 sampled states has a fund/column name containing the word "budget").
- **CA/FL deepening — EXHAUSTIVE, all 24 state-FYs, both datasets:** CA FY2002–FY2007 (6 years, bookends: FY2002 rev $63,942,875,000 / FY2007 rev $96,309,497,000 — both confirmed exact) and FL FY2003–FY2020 (18 years, bookends: FY2003 rev $19,857,818,000 / FY2020 rev $40,534,343,000 — both confirmed exact). No sampling — every single deepened state-FY re-derived. FL's 2 documented P2 clamp years (FY2004 Investment earnings −$78,773K, FY2009 Investment earnings −$374,931K) both tie exact $0 on the netted root total.

## Disposition Table

State | FY | Dataset | Independent re-extracted total | Live DB total_budget | Delta | Disposition
------|----|---------|--------------------------------|----------------------|-------|-------------
Alaska | FY2006 | revenue | $6,729,788,000 | $6,729,788,000 | $0 | Exact tie
Alaska | FY2006 | operating | $6,215,777,000 | $6,215,777,000 | $0 | Exact tie
Alaska | FY2015 | revenue | $4,853,356,000 | $4,853,356,000 | $0 | Exact tie
Alaska | FY2015 | operating | $13,127,986,000 | $13,127,986,000 | $0 | Exact tie
Alaska | FY2025 | revenue | $8,378,945,000 | $8,378,945,000 | $0 | Exact tie
Alaska | FY2025 | operating | $12,373,317,000 | $12,373,317,000 | $0 | Exact tie
Arkansas | FY2003 | revenue | $9,434,421,000 | $9,434,421,000 | $0 | Exact tie
Arkansas | FY2003 | operating | $9,017,879,000 | $9,017,879,000 | $0 | Exact tie
Arkansas | FY2024 | revenue | $24,045,611,000 | $24,045,611,000 | $0 | Exact tie
Arkansas | FY2024 | operating | $22,159,960,000 | $22,159,960,000 | $0 | Exact tie
Delaware | FY2004 | revenue | $3,055,310,000 | $3,055,310,000 | $0 | Exact tie
Delaware | FY2004 | operating | $3,051,408,000 | $3,051,408,000 | $0 | Exact tie
Delaware | FY2006 | revenue | $3,552,457,000 | $3,552,457,000 | $0 | Exact tie
Delaware | FY2006 | operating | $3,739,864,000 | $3,739,864,000 | $0 | Exact tie
Delaware | FY2025 | revenue | $7,475,243,000 | $7,475,243,000 | $0 | Exact tie
Delaware | FY2025 | operating | $7,971,129,000 | $7,971,129,000 | $0 | Exact tie
Hawaii | FY2005 | revenue | $4,198,123,000 | $4,198,123,000 | $0 | Exact tie
Hawaii | FY2005 | operating | $3,653,792,000 | $3,653,792,000 | $0 | Exact tie
Hawaii | FY2025 | revenue | $10,607,306,000 | $10,607,306,000 | $0 | Exact tie
Hawaii | FY2025 | operating | $8,728,004,000 | $8,728,004,000 | $0 | Exact tie
Idaho | FY2004 | revenue | $2,314,491,978 | $2,314,492,000 | −$22 | **EXPLAINED** — 118-05 loadlog documented printed-vs-stored rounding: FY2004 is ID's ONLY mixed-unit year, printed in WHOLE DOLLARS while every other ID year prints thousands. This harness re-extracts the raw whole-dollar printed value (2,314,491,978) with no unit multiplier; the loader normalized that same whole-dollar value by dividing by 1000 and storing as thousands ($2,314,492,000), which rounds the last 3 digits. The −$22 difference (2,314,491,978 vs 2,314,492,000) is exactly that documented rounding artifact of the /1000 normalization, verbatim per 118-05 loadlog: "FY2004 $2,314,491,978 whole dollars → normalized to $2,314,492K (≈$2,314,492,000 stored, ~$22 rounding vs recon, within tolerance)." No fix needed — this is the loader's own pre-approved normalization rounding, not a transcription error.
Idaho | FY2004 | operating | $1,670,288,029 | $1,670,288,000 | $29 | **EXPLAINED** — same 118-05 loadlog mixed-unit normalization rounding (whole-dollar printed value 1,670,288,029 vs the /1000-normalized-then-restored stored value 1,670,288,000). Same root cause as the FY2004 revenue row above.
Idaho | FY2025 | revenue | $6,658,024,000 | $6,658,024,000 | $0 | Exact tie
Idaho | FY2025 | operating | $5,196,087,000 | $5,196,087,000 | $0 | Exact tie
Iowa | FY2002 | revenue | $9,752,220,000 | $9,752,220,000 | $0 | Exact tie (NET REVENUES tie)
Iowa | FY2002 | operating | $9,968,538,000 | $9,968,538,000 | $0 | Exact tie
Iowa | FY2009 | revenue | $13,019,055,000 | $13,019,055,000 | $0 | Exact tie (NET REVENUES tie)
Iowa | FY2009 | operating | $12,847,469,000 | $12,847,469,000 | $0 | Exact tie
Iowa | FY2025 | revenue | $24,251,676,000 | $24,251,676,000 | $0 | Exact tie (NET REVENUES tie)
Iowa | FY2025 | operating | $23,947,143,000 | $23,947,143,000 | $0 | Exact tie
Kansas | FY2019 | revenue | $7,539,362,000 | $7,539,362,000 | $0 | Exact tie
Kansas | FY2019 | operating | $7,151,077,000 | $7,151,077,000 | $0 | Exact tie
Kansas | FY2025 | revenue | $10,352,600,000 | $10,352,600,000 | $0 | Exact tie
Kansas | FY2025 | operating | $10,267,038,000 | $10,267,038,000 | $0 | Exact tie
Kansas | FY2021 | revenue | $8,533,069,000 | $8,533,069,000 | $0 | Exact tie (P2 clamp year, revOnly — root nets the −$3,712K Investment earnings line)
Maine | FY2002 | revenue | $2,302,006,000 | $2,302,006,000 | $0 | Exact tie
Maine | FY2002 | operating | $2,604,696,000 | $2,604,696,000 | $0 | Exact tie
Maine | FY2025 | revenue | $6,194,288,000 | $6,194,288,000 | $0 | Exact tie
Maine | FY2025 | operating | $5,681,088,000 | $5,681,088,000 | $0 | Exact tie
Mississippi | FY2003 | revenue | $9,707,864,000 | $9,707,864,000 | $0 | Exact tie
Mississippi | FY2003 | operating | $9,958,757,000 | $9,958,757,000 | $0 | Exact tie
Mississippi | FY2024 | revenue | $22,709,403,000 | $22,709,403,000 | $0 | Exact tie (dual-negative P2 clamp year — root nets both Investment income + Rentals negatives)
Mississippi | FY2024 | operating | $23,549,305,000 | $23,549,305,000 | $0 | Exact tie
Montana | FY2015 | revenue | $2,122,413,000 | $2,122,413,000 | $0 | Exact tie
Montana | FY2015 | operating | $2,109,168,000 | $2,109,168,000 | $0 | Exact tie
Montana | FY2025 | revenue | $3,453,804,000 | $3,453,804,000 | $0 | Exact tie
Montana | FY2025 | operating | $2,947,803,000 | $2,947,803,000 | $0 | Exact tie
Nebraska | FY2020 | revenue | $4,993,719,000 | $4,993,719,000 | $0 | Exact tie
Nebraska | FY2020 | operating | $4,751,700,000 | $4,751,700,000 | $0 | Exact tie
Nebraska | FY2025 | revenue | $6,308,910,000 | $6,308,910,000 | $0 | Exact tie
Nebraska | FY2025 | operating | $7,776,942,000 | $7,776,942,000 | $0 | Exact tie
Nebraska | FY2022 | revenue | $6,060,843,000 | $6,060,843,000 | $0 | Exact tie (P2 clamp year, revOnly — root nets the −$191,405K Investment Income line)
Nevada | FY2019 | revenue | $10,411,179,917 | $10,411,179,917 | $0 | Exact tie (UNITS=1, full dollars)
Nevada | FY2019 | operating | $10,143,797,415 | $10,143,797,415 | $0 | Exact tie
Nevada | FY2023 | revenue | $15,153,168,081 | $15,153,168,081 | $0 | Exact tie
Nevada | FY2023 | operating | $12,405,372,737 | $12,405,372,737 | $0 | Exact tie
Nevada | FY2022 | revenue | $14,612,607,899 | $14,612,607,899 | $0 | Exact tie (P2 clamp year, revOnly — root nets the −$141,921,982 Interest/investment loss line)
New Hampshire | FY2017 | revenue | $4,207,160,000 | $4,207,160,000 | $0 | Exact tie
New Hampshire | FY2017 | operating | $4,279,104,000 | $4,279,104,000 | $0 | Exact tie
New Hampshire | FY2024 | revenue | $6,377,159,000 | $6,377,159,000 | $0 | Exact tie
New Hampshire | FY2024 | operating | $6,492,697,000 | $6,492,697,000 | $0 | Exact tie
New Mexico | FY2019 | revenue | $15,358,087,000 | $15,358,087,000 | $0 | Exact tie
New Mexico | FY2019 | operating | $13,931,193,000 | $13,931,193,000 | $0 | Exact tie
New Mexico | FY2024 | revenue | $30,530,269,000 | $30,530,269,000 | $0 | Exact tie
New Mexico | FY2024 | operating | $23,955,264,000 | $23,955,264,000 | $0 | Exact tie
New Mexico | FY2022 | revenue | $26,161,736,000 | $26,161,736,000 | $0 | Exact tie — **OCR-independent** (raster-image statement page, re-rendered + re-OCR'd fresh at PDF pp.48–49)
New Mexico | FY2022 | operating | $20,159,689,000 | $20,159,689,000 | $0 | Exact tie — **OCR-independent** (same page)
North Dakota | FY2021 | revenue | $3,955,670,947 | $3,955,670,947 | $0 | Exact tie (UNITS=1, full dollars)
North Dakota | FY2021 | operating | $1,872,868,491 | $1,872,868,491 | $0 | Exact tie
North Dakota | FY2025 | revenue | $4,510,201,793 | $4,510,201,793 | $0 | Exact tie
North Dakota | FY2025 | operating | $2,598,549,548 | $2,598,549,548 | $0 | Exact tie
North Dakota | FY2022 | revenue | $2,408,848,192 | $2,408,848,192 | $0 | Exact tie (P2 clamp year, revOnly — root nets the −$897,827,062 Interest/Investment Income (Loss) line)
Oklahoma | FY2002 | revenue | $9,568,595,000 | $9,568,595,000 | $0 | Exact tie
Oklahoma | FY2002 | operating | $10,107,983,000 | $10,107,983,000 | $0 | Exact tie
Oklahoma | FY2024 | revenue | $30,604,464,000 | $30,604,464,000 | $0 | Exact tie
Oklahoma | FY2024 | operating | $30,421,436,000 | $30,421,436,000 | $0 | Exact tie
Oklahoma | FY2019 | revenue | $19,417,878,000 | $19,417,878,000 | $0 | Exact tie — **OCR-independent** (embedded-JPEG statement page, re-rendered + re-OCR'd fresh at PDF p.56)
Oklahoma | FY2019 | operating | $18,344,756,000 | $18,344,756,000 | $0 | Exact tie — **OCR-independent** (same page)
Rhode Island | FY2006 | revenue | $4,585,920,000 | $4,585,920,000 | $0 | Exact tie
Rhode Island | FY2006 | operating | $4,975,674,000 | $4,975,674,000 | $0 | Exact tie
Rhode Island | FY2025 | revenue | $10,095,792,000 | $10,095,792,000 | $0 | Exact tie
Rhode Island | FY2025 | operating | $10,523,009,000 | $10,523,009,000 | $0 | Exact tie
South Dakota | FY2002 | revenue | $697,589,000 | $697,589,000 | $0 | Exact tie (SD singular-label regex widening applied)
South Dakota | FY2002 | operating | $879,803,000 | $879,803,000 | $0 | Exact tie
South Dakota | FY2025 | revenue | $2,423,413,000 | $2,423,413,000 | $0 | Exact tie
South Dakota | FY2025 | operating | $2,599,721,000 | $2,599,721,000 | $0 | Exact tie
South Dakota | FY2007 | revenue | $917,987,000 | $917,987,000 | $0 | Exact tie — **OCR-independent** (whole-document scan, re-rendered + re-OCR'd fresh across PDF pp.44–50)
South Dakota | FY2007 | operating | $1,092,097,000 | $1,092,097,000 | $0 | Exact tie — **OCR-independent** (same range)
South Dakota | FY2010 | revenue | $916,027,000 | $916,027,000 | $0 | Exact tie — **OCR-independent** (whole-document scan, re-rendered + re-OCR'd fresh across PDF pp.44–50)
South Dakota | FY2010 | operating | $1,114,735,000 | $1,114,735,000 | $0 | Exact tie — **OCR-independent** (same range)
Vermont | FY2015 | revenue | $1,392,033,404 | $1,392,033,404 | $0 | Exact tie (UNITS=1, full dollars)
Vermont | FY2015 | operating | $828,929,456 | $828,929,456 | $0 | Exact tie
Vermont | FY2025 | revenue | $2,543,030,123 | $2,543,030,123 | $0 | Exact tie
Vermont | FY2025 | operating | $1,627,200,216 | $1,627,200,216 | $0 | Exact tie
West Virginia | FY2020 | revenue | $10,760,376,000 | $10,760,376,000 | $0 | Exact tie
West Virginia | FY2020 | operating | $10,752,235,000 | $10,752,235,000 | $0 | Exact tie
West Virginia | FY2025 | revenue | $14,639,897,000 | $14,639,897,000 | $0 | Exact tie
West Virginia | FY2025 | operating | $15,065,132,000 | $15,065,132,000 | $0 | Exact tie
Wyoming | FY2005 | revenue | $1,590,602,744 | $1,590,602,744 | $0 | Exact tie (UNITS=1, full dollars; WY budget-schedule-exclusion refinement applied so the real "Budget Reserve Fund" column isn't falsely excluded)
Wyoming | FY2005 | operating | $1,630,762,733 | $1,630,762,733 | $0 | Exact tie
Wyoming | FY2025 | revenue | $4,027,001,270 | $4,027,001,270 | $0 | Exact tie
Wyoming | FY2025 | operating | $3,206,868,645 | $3,206,868,645 | $0 | Exact tie
Wyoming | FY2013 | revenue | $2,406,105,195 | $2,406,105,195 | $0 | Exact tie (interior clamp year, revOnly)
California | FY2002 | revenue | $63,942,875,000 | $63,942,875,000 | $0 | Exact tie — deepening bookend
California | FY2002 | operating | $73,900,709,000 | $73,900,709,000 | $0 | Exact tie
California | FY2003 | revenue | $66,133,497,000 | $66,133,497,000 | $0 | Exact tie
California | FY2003 | operating | $76,571,568,000 | $76,571,568,000 | $0 | Exact tie
California | FY2004 | revenue | $74,692,896,000 | $74,692,896,000 | $0 | Exact tie
California | FY2004 | operating | $73,714,298,000 | $73,714,298,000 | $0 | Exact tie
California | FY2005 | revenue | $84,280,930,000 | $84,280,930,000 | $0 | Exact tie
California | FY2005 | operating | $80,367,868,000 | $80,367,868,000 | $0 | Exact tie
California | FY2006 | revenue | $93,412,784,000 | $93,412,784,000 | $0 | Exact tie
California | FY2006 | operating | $89,196,958,000 | $89,196,958,000 | $0 | Exact tie
California | FY2007 | revenue | $96,309,497,000 | $96,309,497,000 | $0 | Exact tie — deepening bookend
California | FY2007 | operating | $96,186,583,000 | $96,186,583,000 | $0 | Exact tie
Florida | FY2003 | revenue | $19,857,818,000 | $19,857,818,000 | $0 | Exact tie — deepening bookend
Florida | FY2003 | operating | $21,723,170,000 | $21,723,170,000 | $0 | Exact tie
Florida | FY2004 | revenue | $21,829,932,000 | $21,829,932,000 | $0 | Exact tie (P2 clamp year — root nets the −$78,773K Investment earnings line)
Florida | FY2004 | operating | $23,059,543,000 | $23,059,543,000 | $0 | Exact tie
Florida | FY2005 | revenue | $25,171,792,000 | $25,171,792,000 | $0 | Exact tie
Florida | FY2005 | operating | $25,075,833,000 | $25,075,833,000 | $0 | Exact tie
Florida | FY2006 | revenue | $32,233,584,000 | $32,233,584,000 | $0 | Exact tie
Florida | FY2006 | operating | $26,984,180,000 | $26,984,180,000 | $0 | Exact tie
Florida | FY2007 | revenue | $31,546,749,000 | $31,546,749,000 | $0 | Exact tie
Florida | FY2007 | operating | $29,420,281,000 | $29,420,281,000 | $0 | Exact tie
Florida | FY2008 | revenue | $28,595,132,000 | $28,595,132,000 | $0 | Exact tie
Florida | FY2008 | operating | $29,208,561,000 | $29,208,561,000 | $0 | Exact tie
Florida | FY2009 | revenue | $24,105,954,000 | $24,105,954,000 | $0 | Exact tie (P2 clamp year — root nets the −$374,931K Investment earnings line)
Florida | FY2009 | operating | $25,236,426,000 | $25,236,426,000 | $0 | Exact tie
Florida | FY2010 | revenue | $25,978,531,000 | $25,978,531,000 | $0 | Exact tie
Florida | FY2010 | operating | $23,143,096,000 | $23,143,096,000 | $0 | Exact tie
Florida | FY2011 | revenue | $27,288,574,000 | $27,288,574,000 | $0 | Exact tie
Florida | FY2011 | operating | $25,320,228,000 | $25,320,228,000 | $0 | Exact tie
Florida | FY2012 | revenue | $28,554,204,000 | $28,554,204,000 | $0 | Exact tie
Florida | FY2012 | operating | $24,781,947,000 | $24,781,947,000 | $0 | Exact tie
Florida | FY2013 | revenue | $30,304,288,000 | $30,304,288,000 | $0 | Exact tie (filename convention flip year — {YYYY}cafr.pdf)
Florida | FY2013 | operating | $26,731,972,000 | $26,731,972,000 | $0 | Exact tie
Florida | FY2014 | revenue | $31,577,252,000 | $31,577,252,000 | $0 | Exact tie
Florida | FY2014 | operating | $28,873,415,000 | $28,873,415,000 | $0 | Exact tie
Florida | FY2015 | revenue | $33,317,827,000 | $33,317,827,000 | $0 | Exact tie
Florida | FY2015 | operating | $30,388,938,000 | $30,388,938,000 | $0 | Exact tie
Florida | FY2016 | revenue | $34,525,423,000 | $34,525,423,000 | $0 | Exact tie
Florida | FY2016 | operating | $32,082,585,000 | $32,082,585,000 | $0 | Exact tie
Florida | FY2017 | revenue | $36,178,507,000 | $36,178,507,000 | $0 | Exact tie
Florida | FY2017 | operating | $33,466,690,000 | $33,466,690,000 | $0 | Exact tie
Florida | FY2018 | revenue | $37,715,324,000 | $37,715,324,000 | $0 | Exact tie (filename convention flips back — cafr{YYYY}.pdf)
Florida | FY2018 | operating | $34,599,033,000 | $34,599,033,000 | $0 | Exact tie
Florida | FY2019 | revenue | $40,405,714,000 | $40,405,714,000 | $0 | Exact tie
Florida | FY2019 | operating | $35,825,555,000 | $35,825,555,000 | $0 | Exact tie
Florida | FY2020 | revenue | $40,534,343,000 | $40,534,343,000 | $0 | Exact tie — deepening bookend
Florida | FY2020 | operating | $36,963,807,000 | $36,963,807,000 | $0 | Exact tie

## Summary

- **151 total FY-dataset checks.** 149 exact $0 ties. 2 EXPLAINED (both ID FY2004, a pre-approved documented rounding note from the 118-05 loadlog — no in-phase fix, no new tolerance band).
- **All 21 newly-loaded states** (AK, AR, DE, HI, ID, IA, KS, ME, MS, MT, NE, NV, NH, NM, ND, OK, RI, SD, VT, WV, WY) reconciled independently, including every documented transcription-risk year (ID mixed-unit, IA NET-REVENUES, NM/OK/SD-scan OCR-independent image years) and every documented clamp year (KS, NE, NV, ND, MS, WY).
- **All 24 CA/FL deepening state-FYs** reconciled exhaustively (not sampled) on both operating and revenue datasets — CA FY2002–FY2007 (6 years) and FL FY2003–FY2020 (18 years), including both FL P2 clamp years.
- **No numeric tolerance band** appears anywhere in the disposition logic — the harness's PASS gate is `abs(delta) === 0` exactly; the 2 non-zero ID FY2004 deltas are explained via the pre-existing loadlog record, not auto-passed by a widened bar.
- **Zero loader/parser dependency** confirmed by source inspection of `scripts/verify-phase124-rederive.mjs` — no `require`/`import` of any `process*Acfr.js` module, no shell-out to `extract_gf.py`/`gen_state.py`/`ia_extract.py`/`build_state.py`, no import of `maAcfrExtract.mjs`/`pre34Extract.mjs`/`njAcfrExtract.mjs`.
- **Independence of the 4 OCR checks confirmed:** all 4 (NM FY2022, OK FY2019, SD FY2007, SD FY2010) were re-rendered and re-OCR'd fresh from the source PDF during this harness run (see the temp-file churn in `_acfr-work/124-ocr-tmp/`), not read from any loader-embedded static JSON array.

This file is the VER-09(a) input for the Plan 02 cohort audit and the Plan 03 UAT prep.
