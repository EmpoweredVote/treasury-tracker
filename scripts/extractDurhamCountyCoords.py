#!/usr/bin/env python3
"""
Durham County, NC ACFR — General Fund extractor, COORDINATE-BASED.

Thin wrapper over `scripts/lib/acfrGfCoords.py`, which carries the shared
machinery and states the rule for when an entity belongs on the coordinate
reader at all.

-- WHY THIS ENTITY READS BY COORDINATES -------------------------------------
`pdftotext -table` renders this county's General Fund column at TWO DIFFERENT
character positions in FY2006-FY2011. Rows whose later cells are dashes are
pushed ~35 characters right, so the positional reader files them under a
neighbouring fund and their General Fund cells read $0. FY2008, measured:

    Taxes                     $  257,166,035        <- ends col ~55
    Licenses and permits              1,049,599     <- ends col ~88
    Intergovernmental revenues   125,658,596
    Investments                       4,859,005
    Rent                              2,062,145
    Charges for services         19,308,086
    Other revenues                      659,642

The four shifted rows sum to
    1,049,599 + 4,859,005 + 2,062,145 + 659,642 = 8,630,391
which is EXACTLY the tie delta `-table` reports for that year. The same defect
sinks FY2006, FY2007, FY2009, FY2010 and FY2011. It is the identical mechanism
already diagnosed for El Paso County FY2020 and Austin FY2002-FY2009.

⚠ The reader is chosen for the WHOLE ENTITY, not for the six broken years.
Loading FY2005 and FY2012-FY2025 through `-table` and only these six through
coordinates would be CURVE-FITTING — picking per year whichever strategy
happened to tie. All 21 years load here, and `-table` is kept as an INDEPENDENT
CROSS-CHECK on the 15 years it can still read; `scripts/verify-nc.mjs` requires
the two to agree to the dollar and names the six that only one reader can see.

-- STRUCTURE IS READ, NOT DECLARED ------------------------------------------
Nesting comes from the printed glyph indentation, so no `parents` /
`root_leaves` config is needed. FY2024, measured:

    Current:                     x0 = 62.8   <- root, opens a parent
      General government         x0 = 67.8   <- child
      ...
    Debt service:                x0 = 62.8   <- root, opens a parent
      Principal retirement       x0 = 67.8
      Interest and fiscal charges
      Debt issuance costs
    Capital Outlay               x0 = 62.8   <- root, VALUED leaf

That agrees with what `scripts/extractDurhamCounty.py` declares by hand, now
derived from the document rather than asserted about it.

-- WINDOW -------------------------------------------------------------------
FY2005-FY2025, all 21 published years. No era of this county's reports is
image-only or structurally different.

Usage:
  py -3 scripts/extractDurhamCountyCoords.py docs/DurhamCounty/durham-county-2024-acfr.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='Durham County, NC',
    units=1,      # whole dollars; the county prints full figures
    weld=None,    # no embedded-disclosure label construction in this corpus
)

if __name__ == '__main__':
    run_cli(CONFIG)
