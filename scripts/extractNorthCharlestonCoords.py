#!/usr/bin/env python3
"""
City of North Charleston, SC ACFR — General Fund extractor, COORDINATE-BASED.

Emits the same JSON contract as `scripts/lib/acfrGF.py`, so
`scripts/extractScCitiesAll.mjs` and `scripts/loadScCityAcfrs.mjs` drive it
exactly like every other extractor. EIN 570545285; South Carolina's THIRD
LARGEST city (126,005), and until now absent from TT entirely.

── ⚠⚠ THE EARLIER DEFERRAL BLAMED THE WRONG THING ─────────────────────────

This entity was held back as "OCR-damaged statement tables in every readable
year". The glyphs are in fact CLEAN on the years that matter, and two of the
three defects are MECHANICAL properties of the shared reader, not of the
documents:

1. ROW CHAINING. `lines_of` grew a row while each successive word was within
   ROW_GAP of the PREVIOUS one — single linkage. FY2016 prints another fund's
   figure `9,566,068.` 3.40pt below one statement row and 3.47pt above the next:
   two legal hops, so `Property taxes` and `Licenses and permits` merged into one
   row reading `Property Licenses taxes and pennits` for 4,419,364,731,548,834.
   → `row_gap=3.0`, measured: the widest REAL row in this corpus spans 3.42pt and
   the widest DATA row 0.50pt.

2. PAGE FURNITURE POISONING THE INDENT BASELINE. FY2024 prints a bare `N` and a
   leader run `,........` at x0 ~32, where every real row starts at 58.96.
   `_nested` takes `min(indents)` as the section root, so those two glyphs drag
   the root band 26pt left and EVERY genuine row reports "an indented row with no
   open parent". → `left_margin=35.0`, which clears the junk in every year
   without cutting a label in any (root headings print at 65.73 in FY2024 and
   42.05 in FY2025).

3. A LEADING `1` RENDERED AS THE LETTER `I` — see below. That one IS a text-layer
   defect, and it is the only repair this entity needs.

── ⚠⚠ `ocr_leading_one`, AND WHY IT IS NOT THE BILOXI REFUSAL ─────────────

FY2021 prints its General Fund `Total expenditures` as two words: `I` then
`13,143,394`. `acfrGF._WS_REPAIR` REFUSES exactly this shape (`I09,091,141`,
Biloxi FY2024) on the ground that a lost digit must never be guessed, and that
refusal STANDS — it is about a digit nothing can confirm.

Nothing is guessed here. THREE independent readings agree on 113,143,394:

  * the eight expenditure components, each read separately and cleanly, sum to
    113,143,394 — so the TIE GATE validates the repair, exactly as it validates
    `_WS_REPAIR`; were the reading wrong the components would stop matching and
    the extraction would fail loudly;
  * the page, rendered at 150dpi and read, prints `Total expenditures
    113,143,394`;
  * the statement's OWN next line, `Excess (deficiency) of revenues over
    expenditures`, prints 16,366,553 — and 129,509,947 − 113,143,394 =
    16,366,553 exactly, confirming BOTH totals at once.

⚠ The repair fires only where the letter TOUCHES the figure (<= 6pt, about one
character), so a column marker or footnote reference standing apart from the
money is left exactly as printed.

── ⚠ SIX OF TEN YEARS ARE GAPS, EACH CHECKED AT **TWO** PUBLISHERS ────────

Quality is a property of the COPY, so the city's own site (which publishes
FY2015-FY2025) was fetched and measured alongside the Federal Audit
Clearinghouse copy for every year:

  FY2016  FAC revenue reads and ties; its EXPENDITURE section fuses three rows
          beyond recovery (`General Public Sanitation safety government`).
          The city's copy is a pure image, 1 char/page.
  FY2017  FAC: the primary GF statement page cannot be located at all — only
          budgetary and combining schedules match. City copy: 1 char/page.
  FY2018  FAC: the GF expenditure total is mangled (`I 18.446,203`, a period
          where a comma belongs — TWO character substitutions, which nothing
          independent confirms). ⭐ The CITY's copy passes all four quality
          checks and its REVENUE ties at $0 — but its expenditure statement is
          damaged differently, printing no General Fund figure for `General
          government` or `Public safety`. A year needs both datasets.
  FY2019  image-only at FAC (120 chars/page) AND at the city (1 char/page).
  FY2020  image-only at FAC (118 chars/page) AND at the city (226).
  FY2023  image-only at FAC (238 chars/page) AND at the city (129).

⚠ None of these is written as $0 and none is skipped silently; every one is
declared in `KNOWN_DOCUMENT_GAPS` with its cause. ⚠ And a gap here is a
DOCUMENT-QUALITY gap, unlike Summerville's and Goose Creek's, which are years
with no federal filing at all.

── STRUCTURE, read from GLYPH COORDINATES ─────────────────────────────────

    Current:            root heading -> five functions
    Capital outlay      root; its General Fund cell is blank or a dash in every
                        loaded year, so it is an honest absence and is dropped
                        rather than published as a $0 category (verified on the
                        rendered page for FY2024)
    Debt service:       root heading -> principal / interest lines

⚠ `Fin. purchase obligations and bonds principal` IS THE CITY'S OWN WORDING in
FY2024 — verified by rendering page 50 at 150dpi and reading it, NOT assumed
from the neighbouring years, which print `Financed purchase obligations and
bonds principal`. It is loaded exactly as published (the Wichita rule).
⚠ `Lease & SBIT A liability principal` is the ONE genuine text-layer artifact:
the page prints `SBITA` and the text layer splits it. Repaired by a declared
`label_fixes` entry, which changes a NAME and never an amount.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears in any of the loaded documents, checked per
document.

⚠ The `-table` reader is kept as a REQUIRED CORROBORATOR
(`scripts/verifyScCityReaders.mjs`): it agrees to the dollar on four of the
eight loaded extractions, and the four it cannot read are declared with their
causes rather than waved through.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of North Charleston, SC',
    units=1,                 # whole dollars; the city prints full figures
    row_gap=3.0,             # single linkage chains — see the header
    left_margin=35.0,        # page furniture poisons min(indents)
    ocr_leading_one=True,    # `I` + `13,143,394` -> 113,143,394, tie-validated
    label_fixes={
        # ⚠ The page prints `SBITA`; the text layer splits it into `SBIT` + `A`.
        # A rename only — it moves no amount and changes no nesting.
        'Lease & SBIT A liability principal': 'Lease & SBITA liability principal',
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
