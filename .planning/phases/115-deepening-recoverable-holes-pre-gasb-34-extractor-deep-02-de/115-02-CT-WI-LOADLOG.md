# 115-02 — CT/WI Pre-GASB-34 Deepening + CT FY2006 OCR Recovery Load Log

**States:** Connecticut (node `d01de53e-d687-4825-bfe2-09f7694c28d6`), Wisconsin (node
`15fe5240-19d9-4fef-b785-d624b0a39a2a`)
**Loaders:** `scripts/processCTAcfr.js` + `scripts/processCTRevenueAcfr.js`,
`scripts/processWIAcfr.js` + `scripts/processWIRevenueAcfr.js`
**New extractor:** `scripts/pre34Extract.mjs` — `extractPre34GeneralFund(text)`
**Window before this phase:** CT FY2002–FY2025 (23 yrs, FY2006 hole); WI FY2002–FY2025 (24 yrs)
**Window after this phase:** CT FY1988–FY2025 (**38 yrs, 0 holes**); WI FY2000–FY2025 (**26 yrs, 0 holes**)
**Spend:** $0 (free osc.ct.gov / doa.wi.gov PDFs already cached, pdftotext, pdftoppm, tesseract 5.4 — all free local tools)

---

## Load Disposition

### Connecticut — 15 net-new years (FY1988–FY2001 pre-GASB-34 + FY2006 OCR)

| FY | Operating (Total Exp, $) | Revenue (Total Rev, $) | Tie | Extraction mode | Basis label |
|----|--------------------------|-------------------------|-----|------------------|-------------|
| 1988 | 5,066,954,000 | 5,030,680,000 | $0 / $0 ✅ | pre34Extract (position-anchored) | pre-GASB-34 combined statement basis |
| 1989 | 5,699,265,000 | 5,638,197,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1990 | 6,585,305,000 | 6,297,040,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1991 | 6,859,289,000 | 6,121,389,000 | $0 / $0 ✅ | pre34Extract (period-as-thousands-separator scan quirk fixed) | pre-GASB-34 combined statement basis |
| 1992 | 7,215,567,000 | 7,375,875,000 | $0 / $0 ✅ | pre34Extract (same scan-quirk fix) | pre-GASB-34 combined statement basis |
| 1993 | 8,056,235,000 | 8,490,110,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1994 | 8,526,925,000 | 8,991,044,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1995 | 9,083,956,000 | 9,373,409,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1996 | 9,394,619,000 | 9,953,893,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1997 | 9,552,476,000 | 10,203,385,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1998 | 9,931,609,000 | 10,845,682,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 1999 | 10,515,816,000 | 11,183,142,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 2000 | 11,520,526,000 | 11,997,919,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 2001 | 12,273,058,000 | 12,674,068,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 2006 | 13,924,122,000 | 14,941,201,000 | $0 / $0 ✅ | OCR (embedded, tesseract 5.4) | **GAAP basis** (GASB-34-era, not pre-34) |

**All 14 pre-34 years tie exactly ($0 diff) on both revenue and expenditure printed General Fund
totals** — no honest holes anywhere in CT's pre-34 window (FY1988–FY2001 is the archive's own
edge; CT's `oldcafrpdfs` collection begins at FY1988).

Existing modern years FY2002–FY2005 and FY2007–FY2025 (22 years) re-verified unchanged (see
Idempotency section).

### Wisconsin — 2 net-new years (FY2000–FY2001 pre-GASB-34)

| FY | Operating (Total Exp, $) | Revenue (Total Rev, $) | Tie | Extraction mode | Basis label |
|----|--------------------------|-------------------------|-----|------------------|-------------|
| 2000 | 14,103,791,000 | 15,498,923,000 | $0 / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |
| 2001 | 14,847,684,000 (diff **−2K**) | 15,807,384,000 | within TOL / $0 ✅ | pre34Extract | pre-GASB-34 combined statement basis |

FY2001's −2 (thousands) expenditure-sum diff is the same class of honest GAAP-rounding drift
already documented for WI's modern series (FY2011 rev diff = 1K, FY2016 exp diff = −4K, etc., all
well inside `TOL=5`) — not an extraction defect.

**WI pre-FY2000 is NOT attempted** — the 4-section multi-file era (`95wicomb/gpfs/intr/stat.pdf`
naming, per the 109-03 loadlog) is out of scope for this deepening pass, exactly as scoped in the
115-02 plan. Recorded here as the honest scope boundary, not a hole.

## pre34Extract.mjs — title anchor + confounders rejected

`scripts/pre34Extract.mjs` anchors ONLY on **"Combined Statement of Revenues, Expenditures, and
Changes in Fund Balances"** (comma-tolerant, line-wrap-tolerant) followed within ~8 lines by **"All
Governmental Fund Types"**, then requires a genuine `Revenues:` / `Total Revenues` / `Expenditures:`
/ `Total Expenditures` sequence within a bounded window before accepting the candidate. Confirmed
in the cached CT/WI text that this correctly REJECTS every confounder found in the same CAFRs:

- Higher-Education/University-Hospital funds — title says "**and Other Changes**", not "and Changes
  in Fund Balances" (CT1995.txt:198)
- Budget-and-Actual / Non-GAAP Budgetary Basis statement — no "All Governmental Fund Types" nearby
  (CT1995.txt:2701)
- Ten-year statistical trend tables reusing the same title with a year range appended
  (CT1995.txt:10187) — no `Revenues:` header follows within the bounded window
- A Table-of-Contents line that literally contains both title phrases (CT1995.txt:365–367) — no
  `Revenues:` header follows within 30 lines (next line is another ToC entry)

The extractor is position-anchored (nearest-to-GF-column-anchor token matching, ported from
`_acfr-work/extract_gf.py`'s proven approach) rather than token-order, so blank GF cells (a
category's dollars live in a different fund column that year) are never mis-assigned a neighbor
column's value.

### CT1991/CT1992 scan-quirk fix

CT1991's and CT1992's "Total Expenditures" row prints the thousands separator as a **period**
instead of a comma on that one row (`6.859.289` for 6,859,289; `7.215,567` — a mixed one-off, for
7,215,567) — a scan/OCR-layer artifact in the underlying PDF, not a data error. Since every figure
in this statement is whole thousands (never a real decimal), `pre34Extract.mjs` normalizes any
`\d{1,3}(\.\d{3})+` run to comma-separated before tokenizing, scoped narrowly to the statement's own
tokenizer (never touches unrelated numeric text elsewhere in the document). Both years now tie
exactly; this generic fix required no CT1991/1992-specific hand-correction.

### Sub-header handling (Current:/Debt Service:)

`Current:` is a no-op header (matches the modern extractor's convention — never renamed). `Debt
Service:` propagates onto its leaf rows (`Principal Retirement` → `Debt service — Principal
Retirement`) until the next top-level line (a fresh sub-header or the section's own "Total ..."
row) closes it — the same propagate-then-clear discipline as `extract_gf.py`. One cosmetic
label-merge artifact is present and accepted (matches the established KY pending-prefix
precedent): CT1995's zero-value standalone "Assessments" revenue line (no tokens on its own row)
gets folded into the following "Miscellaneous" label as "Assessments Miscellaneous" — the DOLLAR
VALUE is unaffected (Miscellaneous's own value, unchanged; the tie is unaffected since Assessments
contributed $0), only the display name is imprecise. Not fixed, per the accepted precedent that
numbers are always correct even when a zero-value fragment's label merges with its neighbor.

## FY2006 OCR recovery (DEEP-03)

CT2006.pdf's Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances
is a **scanned page with no text layer** (`pdftotext -table` → 164 bytes for the whole document).

**Page location:** bracketed via CT2005 (statement at PDF page 39 of 158, ratio 0.247) and CT2007
(statement at PDF page 41 of 165, ratio 0.248) — CT2006 has 164 pages, so the predicted page was
~40–41. Confirmed by rendering pages 36–46 at 150dpi and OCR-scanning each for the title text
(`pdftoppm -r 150 -png -f 36 -l 46` + `tesseract --psm 6`) — the exact match landed at **page 40**.

**Transcription:** re-rendered page 40 alone at 300dpi (`pdftoppm -r 300 -png -f 40 -l 40`),
transcribed with `tesseract 5.4 --psm 6` (both free local tools, invoked via the full path
`C:\Program Files\Tesseract-OCR\tesseract.exe`, $0 spend). No re-render/escalation was needed —
the 300dpi/psm-6 pass was clean on the first attempt.

**Accuracy verification (the OCR-error defense, per the plan's tie gate):**
- Both grand totals tie their independent category sums exactly: revenue $14,941,201K ($0 diff),
  expenditure $13,924,122K ($0 diff).
- Additionally, **every one of the 21 revenue+expenditure leaf rows was cross-checked against its
  OWN printed row total** (the statement's 5th "Total Governmental Funds" column = sum of General +
  Debt Service + Transportation + Other Governmental Funds for that row) — all 21 rows tie their
  row arithmetic exactly (e.g. Taxes: 11,225,489 + 0 + 583,896 + 27,424 = 11,836,809 ✅; Investment
  Earnings: 53,629 + 14,642 + 11,789 + 22,634 = 102,694 ✅; General Government:
  916,747 + 0 + 2,947 + 385,877 = 1,305,571 ✅). This double-tie (grand total AND every row's
  independent arithmetic) gives high confidence the OCR transcription is digit-exact.

**Embedded, not runtime-parsed:** per the plan, OCR output is not stable enough to re-parse on
every run — `CT2006_REVENUES`/`CT2006_EXPENDITURES` are embedded as static arrays in
`processCTRevenueAcfr.js`/`processCTAcfr.js` with a full provenance comment (page number, tooling,
cross-tie evidence). `loadYear(2006)` short-circuits to the embedded object before any
PDF/text-file access.

**Basis label:** FY2006 is GASB-34-era (this is the MODERN Governmental Funds statement format,
not the pre-34 Combined Statement) → carries the normal `"...GAAP basis)"` label, confirmed
distinct from the pre-34 label on the adjacent FY2001/FY2007 rows in the same series.

## Basis-label spot-check (DEEP-02 success criterion 1)

Post-load DB read, same node, adjacent fiscal years, visibly distinct labels:

| FY | dataset_type | data_source |
|----|--------------|-------------|
| CT 1995 | operating | `Connecticut State CAFR — General Fund (FY1995 actual, pre-GASB-34 combined statement basis)` |
| CT 2006 | operating | `Connecticut State ACFR — General Fund (FY2006 actual, GAAP basis)` |
| CT 2024 | operating | `Connecticut State ACFR — General Fund (FY2024 actual, GAAP basis)` |
| WI 2000 | operating | `Wisconsin State CAFR — General Fund (FY2000 actual, pre-GASB-34 combined statement basis)` |
| WI 2024 | operating | `Wisconsin State ACFR — General Fund (FY2024 actual, GAAP basis)` |

(Revenue-dataset labels follow the identical pattern with "Revenue" inserted — verified the same
way, not repeated here.) `source_url`/`source_date` stamped on every row (pre-34 years point at the
same `oldcafrpdfs`/`DEBFCapitalFinance` PDFs used for extraction; FY2006 points at the
`osc.ct.gov/2006cafr/cafr2006.pdf` scanned source even though the loader never re-fetches it).

## Idempotency (never-overwrite) + 0 residue

**Baseline (before this phase's live loads):**
- CT node: 46 rows (23 operating + 23 revenue), FYs 2002–2025 minus FY2006
- WI node: 48 rows (24 operating + 24 revenue), FYs 2002–2025 continuous
- CT FY2024 operating `total_budget` = 23,588,666,000; FY2025 = 25,072,796,000
- WI FY2024 operating `total_budget` = 35,985,572,000; FY2025 = 36,445,383,000
- `treasury.data_sources` rows for `ct-acfr-%`/`wi-acfr-%` dataset_ids: **0**

**Live-loaded** all 15 CT new years (FY1988–2001, FY2006) and both WI new years (FY2000–2001),
one `--fy` at a time, for both operating and revenue (34 loader invocations total — never a full
multi-year run, so the modern years could not be touched by construction).

**Post-load:**
- CT node: **76 rows (38 operating + 38 revenue), FYs 1988–2025 continuous, 0 holes**
- WI node: **52 rows (26 operating + 26 revenue), FYs 2000–2025 continuous, 0 holes**
- CT FY2024/FY2025 rows: **identical** to baseline (both operating and revenue totals unchanged)
- WI FY2024/FY2025 rows: **identical** to baseline (both operating and revenue totals unchanged)
- All 17 new years (15 CT + 2 WI): `data_source`/`source_url`/`source_date` stamped correctly per
  the basis-label table above
- `treasury.data_sources` rows for `ct-acfr-%`/`wi-acfr-%` dataset_ids: **0** (ephemeral lifecycle
  held on every one of the 34 invocations)

**Re-run test (one deepened FY per state, run a second time live):**
- CT FY1995 operating: pre-rerun 38 rows / total_budget 9,083,956,000; post-rerun 38 rows
  (unchanged) / total_budget 9,083,956,000 (unchanged) — **0 net change**
- WI FY2000 operating: pre-rerun 26 rows / total_budget 14,103,791,000; post-rerun 26 rows
  (unchanged) / total_budget 14,103,791,000 (unchanged) — **0 net change**
- `treasury.data_sources` residue for `ct-acfr-%`/`wi-acfr-%` after both re-runs: **0**

## Cohort untouched

Both CT loaders resolve only `name='Connecticut', state='CT', entity_type='state'`; both WI loaders
resolve only `name='Wisconsin', state='WI', entity_type='state'` — unchanged from the pre-existing
Phase 109 code, so no other ACFR/NASBO node could be structurally written by this phase's changes.
(Phase 116 runs the authoritative full 50-node cohort audit.)

## Money In

CT already had `dataset_type='revenue'` rows since Phase 109 (Money In already enabled); this phase
extends the SAME series 15 years deeper (FY1988–2001, FY2006), no frontend change. WI likewise
extends its existing revenue series 2 years deeper (FY2000–2001).

## Phase-114 hardening applied

All four loaders were touched, so the Phase-114 hardening pattern was applied per the
fix-while-touching rule (no fleet-wide sweep):
- **WR-01** — `parseArgs({ strict: true, allowPositionals: false })`: a mistyped flag now exits 2
  instead of silently live-loading.
- **WR-01 (re-review)** — `--fy` value validated against the loadable-years map before any work.
- **WR-04** — the per-FY write loop runs inside `try { } finally { }`, guaranteeing the ephemeral
  `data_sources` cleanup runs even on a mid-run failure.
- **WR-07** — the post-RPC `budgets` select error is now surfaced rather than silently falling
  through to "row not found".
- **Rule 1 bug fix** (processCTRevenueAcfr.js): the hole-skip log message was interpolating
  `ex.expTotal` instead of `ex.revTotal` — display-only, never affected stored data; fixed while
  touching this file for the pre-34 wiring.

## Verification-command wording note

The plan's automated verify commands grep for the literal string `"PASS"` in dry-run output.
These four Phase 108/109-style parser-based loaders have always used the word **`"TIE"`**
(pre-existing convention, not introduced by this phase — see the original `console.log(`FY${fy}:
TIE (...)`)` lines before any 115-02 edits) rather than the `gen_state.py`-generated loaders'
`"PASS"` wording. Functionally equivalent — every dry-run in this log prints `TIE` with `diff 0`
(or within `TOL`) for every loadable year, which is the actual acceptance criterion. Documented
here rather than changing 37 years of established console-output wording for a cosmetic string
match.
