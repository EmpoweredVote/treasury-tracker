#!/usr/bin/env python3
"""
El Paso County, CO ACFR — General Fund extractor, COORDINATE-BASED.

Emits the same JSON contract as `scripts/lib/acfrGF.py` (`fiscal_year`, `mode`,
`tree`, `computed_total`, `printed_total`, `tie_delta`, `zero_rows`), so
`scripts/lib/acfrGfLoad.mjs` drives it exactly like every other extractor. It
reads the page through `scripts/acfrGfComponents.py` — pdfplumber glyph
coordinates — instead of the `pdftotext -table` character grid.

-- WHY THIS ENTITY NEEDS ITS OWN EXTRACTOR ----------------------------------
El Paso County's statements defeat BOTH of acfrGF's column strategies, each for
a mechanically identified reason, and no CityConfig value reaches either. Both
were confirmed by arithmetic that lands on the dollar:

  positional  `pdftotext -table` renders the General Fund column at TWO
              character offsets — rows whose later cells are dashes sit ~20
              characters right. The reader anchors on the Total rows and files
              the shifted group under Road and Bridge, so those General Fund
              cells read $0. FY2020's four dropped rows sum to 748,294 +
              1,937,380 + 2,527,617 + 2,548,205 = 7,761,496, which IS the
              reported tie delta. (Austin FY2002-FY2009 fails identically; the
              AUSTIN-TRAVIS-01 closeout names coordinate isolation as the fix.)

  ordinal     the county prints its TABOR refund INSIDE the revenue label —
              "Sales taxes net of $4,477,783 TABOR limitation". That embedded
              figure is the FIRST column slot, so the ordinal reader returns it
              as the amount: FY2024's delta is exactly
              122,194,544 - 4,477,783 = 117,716,761. Where the label WRAPS
              (FY2016, FY2022) the positional reader counts the same figure as
              an extra revenue component and its delta equals the TABOR figure
              to the dollar (+15,174,442 and +31,551,234).

In glyph space neither defect exists: the column has ONE x-position, and the
label's embedded figure sits in the label, tens of points from the column edge.

Choosing per-year whichever strategy happened to tie $0 would have been
CURVE-FITTING — the error that got the LA-01 scope verdict retracted. What is
used instead is agreement with an independent reader, checked component by
component; see `scripts/verify-colorado.mjs` CHECK 1.

-- NESTING COMES FROM THE PAGE, NOT FROM CONFIG -----------------------------
`acfrGF.CityConfig` needs `parents` / `root_leaves` declared by hand because
`-table` flattens the leading whitespace that states the hierarchy. Glyph
coordinates keep it, so this extractor reads the tree off the printed
INDENTATION and needs no structural declaration at all. FY2020, measured:

    Current:                     x0 = 69.8   <- root
      General government         x0 = 74.8   <- child
      ...
    Debt service:                x0 = 69.8   <- root
      Principal                  x0 = 74.8   <- child
    Capital outlay               x0 = 69.8   <- root, VALUED leaf

That is the same shape the hand-written config declared, now derived from the
document rather than asserted about it — which matters because a tie proves
arithmetic and never structure.

-- WINDOW -------------------------------------------------------------------
Reads FY2005 and FY2009-FY2025. Two eras are NOT readable and are excluded with
a diagnosed cause, not a shrug:

  FY2000-FY2004  IMAGE-ONLY SCANS. `pdftotext` returns 0 characters for all
                 five; there is no text layer to read. Needs OCR, which would
                 put a transcription step into a provenance chain that is
                 currently byte-exact.

  FY2006-FY2008  a DIFFERENT STATEMENT. Those years title it "Statement of
                 Revenues and Changes in Fund Balances" — no "Expenditures" —
                 and split the fund columns HORIZONTALLY ACROSS TWO PAGES
                 (General / Road and Bridge / Human Services on one, Capital
                 Projects / Other / Total on the next). The page also
                 letter-spaces its own column headers ("S e r v ic e s"). Both
                 the page-qualifying rule and the single-page column model are
                 wrong for that era; it is a separate build, not a config
                 change.

Usage:
  py -3 scripts/extractElPasoCountyCoords.py docs/ElPasoCounty/el-paso-county-2024-acfr.pdf --mode revenue
  py -3 scripts/extractElPasoCountyCoords.py docs/ElPasoCounty/el-paso-county-2020-acfr.pdf --mode operating
"""

# ── THIS FILE IS NOW A THIN WRAPPER ─────────────────────────────────────────
# The machinery below used to live here in full. NC-DURHAM-AVL-01 needed the
# same coordinate reader for Durham County and Asheville, so it was generalised
# into `scripts/lib/acfrGfCoords.py` rather than copied — two divergent copies
# of a parser this subtle is how a fix lands in one entity and not the other.
#
# The move was proved rather than assumed: every one of this county's 26 years
# was run through BOTH implementations in both modes and all 52 outputs were
# BYTE-IDENTICAL, and `scripts/verify-colorado.mjs` still reports 64 rows / 58
# corroborated / ALL CHECKS PASSED.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='El Paso County, CO',
    units=1,               # whole dollars; the county prints full figures
    weld='disclosure',     # the TABOR figure printed inside the revenue label
)

if __name__ == '__main__':
    run_cli(CONFIG)
