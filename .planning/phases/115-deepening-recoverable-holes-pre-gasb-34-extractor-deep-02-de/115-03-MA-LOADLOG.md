# 115-03 — Massachusetts Hole-Recovery Load Log

**State:** Massachusetts (node `fd6b008f-4d35-4665-8c6a-0429de5a4e1f`) — same node upgraded in Phase 108-02, no duplicate.
**Loaders:** `scripts/processMAAcfr.js` (operating), `scripts/processMARevenueAcfr.js` (revenue), shared parser `scripts/maAcfrExtract.mjs` (+ `scripts/pre34Extract.mjs` for the FY2001 pre-GASB-34 year).
**Target:** the six remaining honest holes from 108-02 (FY2001, FY2002, FY2004, FY2005, FY2014, FY2021).
**Result:** **2 of 6 holes recovered** (FY2001, FY2014) — MA now a **21-year** series (FY2001, FY2003, FY2006–2020, FY2022–2025), **4 honest holes remain** (FY2002, FY2004, FY2005, FY2021), each root-caused and documented below.
**Units:** thousands (UNITS=1000). **Spend:** $0 (free macomptroller.org PDFs, pdftotext -table, no paid AI).

---

## Load Disposition

| FY | Disposition | Rev total ($) | Exp total ($) | Basis label | Root cause / notes |
|----|-------------|---------------|----------------|-------------|---------------------|
| 2001 | **RECOVERED** | 13,623,688,000 | 11,211,746,000 | pre-GASB-34 combined statement basis | Statement is the pre-GASB-34 "Combined Statement Of Revenues, Expenditures And Changes In Fund Balances" format (MA's `All Governmental Fund Types...` line prints BEFORE the title, opposite order from CT/WI) — routed through `pre34Extract.mjs` after widening its lookahead window to also look behind the title line. Ties exactly ($0 diff) on both revenue and expenditure. |
| 2002 | Honest hole (unrecoverable) | — | — | — | `pdftotext -table` (and `-layout`, confirmed identical) interleaves a stray period between individual digits with NO whitespace gap from the label's dot-leader (e.g. `6..0..,.0..4..5` for `60,045`) — see "Dot-leader corruption" below. |
| 2003 | (already loaded, untouched) | 13,011,835,000 | 11,450,114,000 | GAAP basis | Regression-verified unchanged. |
| 2004 | Honest hole (unrecoverable) | — | — | — | Same dot-leader corruption as FY2002. |
| 2005 | Honest hole (unrecoverable) | — | — | — | Same dot-leader corruption as FY2002. |
| 2006–2013 | (already loaded, untouched) | — | — | GAAP basis | Regression-verified unchanged (8 years). |
| 2014 | **RECOVERED** | 32,591,574,000 | 31,299,733,000 | GAAP basis | Isolated single-character font-glyph substitutions on the section anchors ("Total revenaes" for "Total revenues"; "EXPENDTTURES" for "EXPENDITURES") plus a period-as-thousands-separator quirk ("470.116" for "470,116") and a "]"→"1" digit substitution ("],904" for "1,904") — all fixed with narrowly-scoped tolerant regexes in `maAcfrExtract.mjs`. Ties exactly on expenditure; revenue diff = -1 (within TOL, consistent with the GAAP thousands-rounding pattern already documented for FY2023/FY2024). |
| 2015–2020 | (already loaded, untouched) | — | — | GAAP basis | Regression-verified unchanged (6 years). |
| 2021 | Honest hole (unrecoverable) | — | — | — | The entire financial-statements/notes section of this year's PDF (~16,000 of 17,793 pdftotext lines) is encoded with a document-wide corrupted font ToUnicode mapping that neither `pdftotext -table` nor `-layout` can decode to legible text — see "FY2021 font cipher corruption" below. |
| 2022–2025 | (already loaded, untouched) | — | — | GAAP basis | Regression-verified unchanged (4 years). |

**Recovered-year printed totals (both loaders tie exactly / within TOL=5 thousand):**

| FY | Rev total | Exp total | Rev diff | Exp diff |
|----|-----------|-----------|----------|----------|
| 2001 | 13,623,688,000 | 11,211,746,000 | $0 | $0 |
| 2014 | 32,591,574,000 | 31,299,733,000 | -$1K | $0 |

---

## Investigation detail — the two interior holes (attacked first, per plan)

### FY2014 — RECOVERED

Diagnosis (per `_acfr-work/ma/MA2014.txt`, both `-table` and `-layout` reproduce identically — this is baked into the PDF's font metrics, not an extraction-mode artifact):

1. **Section-anchor glyph substitution.** The literal words on the section-header/total lines are
   corrupted by isolated single-character font-glyph swaps: `Total revenaes` (u→a) for `Total
   revenues`, and `EXPENDTTURES` (I→T) for `EXPENDITURES`. Individual department-line labels below
   these anchors are corrupted too (`ludiciary` for `Judiciary`, `GovemorandLieutenantGovemor` for
   `Governor and Lieutenant Governor`) but this is cosmetic — it never changes an extracted VALUE,
   only a display name, matching the existing extractor's "never fix names" discipline.
2. **Period-as-thousands-separator quirk** (same corruption class as CT1991/1992, fixed in
   `pre34Extract.mjs` during 115-02): isolated rows print `470.116` instead of `470,116`.
3. **`]`→`1` digit substitution at the start of a number:** `],904` for `1,904` (Ethics Commission
   row); `20],257` for `201,257` (Energy and Environmental Affairs row). `]` never legitimately
   appears in this statement's data rows, so the substitution is unambiguous.

**Fix (scripts/maAcfrExtract.mjs, `extractMAGeneralFund`):**
- `parseRow()`: normalize `]`→`1` and the period-as-thousands-separator pattern
  (`\d{1,3}(\.\d{3})+` → comma-separated) before column-splitting.
- Section-anchor regexes widened to tolerate a single corrupted character in the distinguishing
  position: `Total\s+reven\w*s\b` (matches both "revenues" and "revenaes"), `EXPEND\w*TURES:?\s*$`
  (matches both "EXPENDITURES" and "EXPENDTTURES"), `Total\s+e\wpenditures` (defensive, tolerates an
  x/z-style swap even though FY2014's own "Total expenditures" line happened to print correctly).

**Result:** expenditure ties EXACTLY ($0 diff, 26 depts); revenue ties within TOL (-$1K, consistent
with the GAAP thousands-rounding pattern already documented for FY2023/FY2024). Regression-gated:
all 19 previously-tying years' totals identical before/after (verified via full dry-run diff against
a pre-change DB baseline capture — see "Regression evidence" below).

### FY2021 — Honest hole (irreducible)

Diagnosis:

- No occurrence of `REVENUES`, `Total revenues`, `Governmental Funds`, or `Changes in Fund Balances`
  (case-insensitive, any spelling variant) anywhere in `MA2021.txt` past line ~1,349 — despite the
  file having 17,793 total lines (248 real PDF pages per `pdfinfo`).
- The common English word "the" appears 222 times in the file, but ALL occurrences are clustered in
  lines 357–1,349 (the MD&A narrative) and 16,386+ (an appendix/boilerplate section) — a gap of
  **16,386 consecutive lines with zero occurrences of "the."** This gap spans the entire financial
  statements + notes section, including where the GF statement must live.
- Sample decode of text within the gap (e.g. `$5D&?C9D9?>` = "Net Position"; `/B?
  =IGJIH?HNM I@ NB? H?N J?HMCIH FC;<CFCNS` = "The components of the net pension liability") confirms
  the text IS present but is encoded with a **document-wide corrupted font ToUnicode mapping** — a
  fixed character-substitution cipher baked into the PDF's embedded font, not an OCR/scan issue
  (there is a genuine text layer; it just decodes to the wrong characters).
- Confirmed with BOTH `pdftotext -table` and `pdftotext -layout` — identical corruption in both
  modes, ruling out an extraction-mode fix.
- Page-boundary mapping via form-feed (`\f`) characters was attempted to locate the statement page
  for a targeted OCR re-transcription (per the 115-02 CT FY2006 precedent) but found 1,351 apparent
  form-feed occurrences against only 248 real PDF pages — the corrupted encoding itself produces
  byte sequences that collide with the form-feed character, making even page-boundary detection
  unreliable in the corrupted region.

**Disposition:** left as an honest hole. Recovering this year would require either (a) fully
reverse-engineering the document's substitution cipher (high effort, and the mapping may vary by
embedded font subset within the same PDF — at least two different apparent alphabets were observed
in different samples), or (b) locating and OCR-transcribing the correct page(s) among 248 pages
without a working page-boundary marker. Both exceed the reasonable scope of an auto-fix within this
plan; flagged as a candidate for a future dedicated OCR pass (same tooling as the CT FY2006
precedent) once a reliable page-location method is worked out.

---

## Investigation detail — the two remaining era holes (FY2002/2004/2005)

Per the plan's per-year format-determination requirement: **FY2001 proved pre-GASB-34** (recovered
above); **FY2002/2004/2005 are all modern GASB-34-format** (confirmed via their table of contents —
FY2002's ToC explicitly says "GOVERNMENTAL FUND FINANCIAL STATEMENTS" and references "GASB 34" by
name, consistent with MA adopting GASB 34 in FY2002) — so none of these three route through
`pre34Extract.mjs`.

### Dot-leader digit-interleaving corruption (FY2002, FY2004, FY2005)

All three years share an IDENTICAL corruption pattern, confirmed reproduced identically in both
`pdftotext -table` and `-layout` output (baked into the PDF, not an extraction-mode artifact):

- The row's label dot-leader runs with **NO whitespace gap** directly into its first numeric
  column — e.g. `Departmental...............................................................................................6..1..7..,.8..0..8............................2..,.2..4..4.....................4..,.4..1..7..,.8..0..0..............................-.............                          -                  -                       -     1,058,674      6,096,527`
  (General Fund value = `617,808`, embedded as `6..1..7..,.8..0..8`).
- This breaks the token-order extractor entirely: `[\d,]+` never matches across the embedded
  periods, so the whole label+dots+number run is left unrecognized as one text blob.

**Attempted fix (built, tested, then ABANDONED — not shipped):** a self-contained,
MA-2002/04/05-scoped variant (`maDotLeaderTokensWithPos` / would-be `extractMAGeneralFundDotLeader`,
fully isolated from the shared `extractGovFundGeneralColumnPositional` used by CT/MI/TN/WA/WI so
those states' already-tying years could never regress) matched a "digit run tolerant of a bounded
inter-digit separator" — `\d(?:[.,]{0,4}\d)*` — directly against the raw line, then assigned each
match to the nearest fund-column anchor position (same nearest-neighbor logic as the shared
positional extractor).

This initially looked promising (FY2001... err FY2002's Taxes/Assessments/Federal
grants/Departmental/Miscellaneous rows extracted correctly with the `{0,4}` bound), but a systematic
gap-length audit across ~100 rows of the FY2002 statement found:

- **Within-number corruption gaps** (the periods interleaved between digits of ONE number):
  observed range 1–7 characters (median 2).
- **Genuine inter-column / leader-dot gaps** (the whitespace-equivalent separating two DIFFERENT
  numbers, or the leader dots before the first number on a line): observed range 6–111 characters.
- **These two ranges OVERLAP in the 6–7 character band** — there is no single threshold that
  correctly separates "still the same number" from "next column" for every row. A bound low enough
  to avoid merging adjacent fund columns into one inflated figure (as happened at `{0,*}` unbounded —
  e.g. "Departmental" initially extracted as `61,780,822,444,417,800`, a garbage value spanning
  multiple columns) also truncates some legitimate numbers early when their internal separator run
  happens to exceed the bound (e.g. "Secretary of the Commonwealth"'s `3..4..,..5..2..9` has a 5-char
  gap between the '4' and the comma, but other rows on the same page need gaps up to 7 to stay intact
  without also swallowing the next column).

Since a **wrong-but-plausible dollar figure is worse than an honest hole** (the explicit governing
principle for this deepening pass), this approach was abandoned rather than shipped with a
best-guess threshold. The attempted code was removed from `maAcfrExtract.mjs` (replaced with a
comment documenting the investigation) so no dead/unreliable extraction path ships.

**Disposition:** FY2002, FY2004, FY2005 left as honest holes. A future recovery attempt would need
either a smarter column-boundary heuristic (e.g. deriving expected column START positions from a
DIFFERENT, uncorrupted anchor such as the column-header row, rather than inferring boundaries purely
from separator-run length) or an OCR-based re-transcription (these years' pages DO have a working
text layer, just a badly-formed one, so unlike FY2021, page-location via form-feed counting should
work normally here if a future attempt chooses the OCR route).

---

## Regression evidence — 19 previously-loaded years untouched

**Pre-change DB baseline** (captured before any code change, read-only probe of `treasury.budgets`
for the MA state node): 38 rows (19 operating + 19 revenue) for FY2003, FY2006–2013, FY2015–2020,
FY2022–2025, matching the totals below exactly.

**Dry-run regression check** (after both maAcfrExtract.mjs changes and the pre34Extract.mjs
lookahead-window widening), full sweep FY2001–FY2025, both loaders:

| FY | Operating (pre-change → post-change) | Revenue (pre-change → post-change) |
|----|----------------------------------------|--------------------------------------|
| 2003 | 11,450,114,000 → 11,450,114,000 | 13,011,835,000 → 13,011,835,000 |
| 2006 | 21,792,905,000 → 21,792,905,000 | 23,445,418,000 → 23,445,418,000 |
| 2007 | 24,149,079,000 → 24,149,079,000 | 26,002,237,000 → 26,002,237,000 |
| 2008 | 25,328,716,000 → 25,328,716,000 | 27,520,209,000 → 27,520,209,000 |
| 2009 | 26,014,881,000 → 26,014,881,000 | 26,494,905,000 → 26,494,905,000 |
| 2010 | 26,287,063,000 → 26,287,063,000 | 27,747,983,000 → 27,747,983,000 |
| 2011 | 27,011,883,000 → 27,011,883,000 | 29,764,415,000 → 29,764,415,000 |
| 2012 | 28,024,676,000 → 28,024,676,000 | 29,431,736,000 → 29,431,736,000 |
| 2013 | 29,147,780,000 → 29,147,780,000 | 30,694,266,000 → 30,694,266,000 |
| 2015 | 34,084,046,000 → 34,084,046,000 | 35,029,512,000 → 35,029,512,000 |
| 2016 | 35,530,773,000 → 35,530,773,000 | 36,690,392,000 → 36,690,392,000 |
| 2017 | 36,507,105,000 → 36,507,105,000 | 37,396,174,000 → 37,396,174,000 |
| 2018 | 37,798,290,000 → 37,798,290,000 | 40,468,609,000 → 40,468,609,000 |
| 2019 | 38,853,014,000 → 38,853,014,000 | 42,843,978,000 → 42,843,978,000 |
| 2020 | 41,249,138,000 → 41,249,138,000 | 43,151,305,000 → 43,151,305,000 |
| 2022 | 48,686,379,000 → 48,686,379,000 | 55,383,569,000 → 55,383,569,000 |
| 2023 | 53,773,441,000 → 53,773,441,000 | 56,705,297,000 → 56,705,297,000 |
| 2024 | 52,754,896,000 → 52,754,896,000 | 57,723,619,000 → 57,723,619,000 |
| 2025 | 58,604,191,000 → 58,604,191,000 | 61,907,573,000 → 61,907,573,000 |

All 19 years bit-for-bit identical. Post-live-load DB read confirms the same 19 years' totals
unchanged in the live table.

**Shared-file regression (pre34Extract.mjs widened lookahead window):** the widened window is a
strict superset of the original (adds a lookbehind, never removes a previously-matching lookahead) —
verified by full dry-run of all four dependent loaders after the change:
- CT operating: all 38 years (FY1988–2025) TIE, 0 holes, totals identical to the 115-02-recorded values.
- CT revenue: all 38 years TIE, 0 holes, totals identical.
- WI operating: all 26 years (FY2000–2025) TIE, 0 holes, totals identical.
- WI revenue: all 26 years TIE, 0 holes, totals identical.

## Idempotency + 0-residue evidence

- Live-loaded FY2001 and FY2014 individually via `--fy` in both loaders (4 live-load runs total).
- Post-load DB read: 42 rows total (21 years × 2 datasets) — the 19 pre-existing years' totals and
  labels unchanged; FY2001 carries the "pre-GASB-34 combined statement basis" label distinctly from
  every other (GAAP-labelled) row; FY2014 carries the normal GAAP basis label.
- Re-ran `--fy 2001` (operating) and `--fy 2014` (revenue) a second time: identical totals, row count
  still 42 (0 net change, no duplicate rows — `treasury_sync_budget_tree` UPDATE-in-place keyed on
  (muni, fy, dataset_type) confirmed idempotent).
- `data_sources` probe for `ma-acfr-%` dataset_ids: **0 rows** both before and after all four live
  loads (ephemeral create-then-delete lifecycle from Phase 111, confirmed 0 residue).

## Money In

FY2001 and FY2014 add 2 more years to the existing "Money In" revenue-by-source view (already
auto-enabled since Phase 108-02) — no frontend change needed.

## Cohort untouched

No other state's loader or shared extractor file was touched except `scripts/pre34Extract.mjs`
(widened lookahead window, regression-verified 0 impact on CT/WI). No other state's `data_sources`
or `budgets` rows were read or written by this plan.

---
*Phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de, Plan 03*
*Completed: 2026-07-03*
