#!/usr/bin/env python3
"""
City of Asheville, NC ACFR — General Fund extractor, COORDINATE-BASED.

Thin wrapper over `scripts/lib/acfrGfCoords.py`.

-- WHY THIS ENTITY READS BY COORDINATES -------------------------------------
The FY2021 and FY2022 PDFs set character spacing such that `pdftotext -table`
SPLITS EVERY WORD ON THE PAGE. Verbatim from FY2021's statement:

    A d valo rem taxes                          73,567,305
    Intergo vernmental                          11,373,451
    General go vernment                         17,316,556
    P ublic safety                              54,861,174
               T o tal revenues                138,654,413
               T o t a l e xpe ndit ure s      113,684,227

No label matches, no section banner matches, and neither printed total matches,
so `find_statement_page` reports "primary GF statement not found" for a
statement that is plainly there. This is Bend FY2014's letter-spacing defect
applied to a whole page rather than to two labels, and `label_fixes` cannot
reach it: the totals that QUALIFY the page are mangled too, so the page is
rejected before any label repair could run.

Character spacing is not a word boundary in glyph space, and the coordinate
reader recovers every label cleanly.

⚠ Chosen for the WHOLE ENTITY, not for the two broken years — see
`scripts/lib/acfrGfCoords.py` for why per-year selection is curve-fitting.
`-table` corroborates FY2023-FY2025 and `scripts/verify-nc.mjs` requires the
two readers to agree to the dollar.

-- A SIGN FLIP THIS ENTITY EXPOSED ------------------------------------------
FY2022 is the year that found a latent bug in the shared coordinate machinery.
The city's negative investment earnings are emitted as TWO words 0.1pt apart —
a lone open parenthesis, then "372,058)" — and the merge rule required every
fragment to contain a DIGIT, so the sign was dropped and the row read +372,058
for a printed (372,058). The components then over-summed the printed total by
exactly 2 x 372,058 = 744,116. Fixed in
`acfrPrintedTotal._is_lone_open_paren`; had that row been last, or the
statement printed no total, it would have shipped inverted.

-- STRUCTURE IS READ, NOT DECLARED ------------------------------------------
FY2022, measured — note the city groups its REVENUE, which most issuers do not,
and that the grouping is recovered from indentation with nothing declared:

    Taxes:                       x0 = 53.6   <- root, opens a parent
      Ad valorem taxes           x0 = 61.9   <- child
      Other taxes                x0 = 61.9
    Intergovernmental            x0 = 53.6   <- back at root
    ...

⚠ On the expenditure side the city prints TWO debt-service parents carrying
IDENTICAL child labels ("Principal", "Interest and other charges") — one for
conventional debt, one for GASB-87/96 lease and subscription debt. The shared
walk appends each child to whichever parent is currently open, so the two pairs
stay distinct; a label-keyed tree would have merged them.

-- WINDOW -------------------------------------------------------------------
FY2021-FY2025, the five years the city publishes. It hosts nothing earlier.

Usage:
  py -3 scripts/extractAshevilleCoords.py docs/Asheville/asheville-2022-acfr.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of Asheville, NC',
    units=1,
    weld=None,
)

if __name__ == '__main__':
    run_cli(CONFIG)
