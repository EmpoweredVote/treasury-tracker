#!/usr/bin/env python3
"""
City of Rock Hill, SC ACFR — General Fund extractor, COORDINATE-BASED.

Emits the same JSON contract as `scripts/lib/acfrGF.py` (`fiscal_year`, `mode`,
`tree`, `computed_total`, `printed_total`, `tie_delta`, `zero_rows`), so
`scripts/lib/acfrGfLoad.mjs` and `scripts/extractScCitiesAll.mjs` drive it
exactly like every other extractor. It reads the page through
`scripts/acfrGfComponents.py` — pdfplumber glyph coordinates — instead of the
`pdftotext -table` character grid.

── ⚠⚠ WHY THIS ENTITY NEEDS ITS OWN EXTRACTOR ─────────────────────────────

Rock Hill defeats BOTH of acfrGF's column strategies, each in a different year,
and no CityConfig value reaches either. That is the whole reason this file
exists, and it is a per-ENTITY decision, not a per-year one.

  positional  `pdftotext -table` renders the General Fund column at TWO
              character offsets. On FY2024 the rows whose later cells are dashes
              sit ~24 characters right:

                  Property taxes         $  41,219,375
                  Fines and forfeitures                     432,533
                  Impact fees                               -
                  Program income                            -

              so the reader files them under the next fund and their General
              Fund cells read $0. FY2024 revenue came out 432,533 short —
              **exactly the `Fines and forfeitures` figure**, confirmed by
              reading the printed page. The other nine years tie under this
              strategy.

  ordinal     assigns money to columns by SLOT INDEX. That fixes FY2024 — and
              breaks FY2025 operating by 20,125, which positional reads
              correctly.

⚠⚠ SO NEITHER STRATEGY IS RIGHT FOR THIS ISSUER, AND PICKING WHICHEVER TIES PER
YEAR WOULD BE CURVE-FITTING — the error that got the LA-01 scope verdict
retracted. Nineteen of twenty extractions tying is not evidence that a strategy
is correct; it is evidence that the twentieth is where the defect is visible.
The coordinate reader never sees the character grid, so the grid's artifacts
cannot reach it.

⭐ CORROBORATED, NOT ASSUMED. An independent read of the FY2024 page by glyph
x-coordinates — keyed on the RIGHT edge, because these columns are right-aligned
and their left edge moves with the digit count — sums the General Fund revenue
leaves to **96,194,080, exactly the printed total**. The `-table` reader is
required to keep corroborating every year it can still read; see
`scripts/verifyScCityReaders.mjs`.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No statement page carries an "in thousands" caption, and FY2024 prints General
Fund total revenues of 96,194,080 for a city of 75,798.

── ⚠ STRUCTURE IS DERIVED FROM THE PRINTED INDENTATION, NOT DECLARED ──────

The coordinate reader takes nesting from glyph x-positions, so this entity's
awkward shape needs no configuration:

    Capital outlay                           x=61   <- a PARENT here
        General / Finance purchases vehicles and equipment  x=77

Charleston, Mount Pleasant and Greenville all print `Capital outlay` as a single
valued ROOT LEAF; Rock Hill prints it as a heading with two children and no value
of its own — the documented Hillsboro inversion. Under `acfrGF.py` that had to be
declared as `parents=('current','capital outlay','debt service')` with empty
`root_leaves`; here it falls out of the page.

── ⚠⚠ FY2024 IS FILED UNDER A PERSON'S NAME ───────────────────────────────

FAC records the FY2024 filing's `auditee_name` as `Drew Cooper`. A name-based
join would have silently DROPPED that year, leaving a hole that reads exactly
like a city that did not file. The document's own cover reads `CITY OF ROCK HILL,
SOUTH CAROLINA ANNUAL COMPREHENSIVE FINANCIAL REPORT FOR THE FISCAL YEAR ENDED
JUNE 30, 2024`; "City of Rock Hill" appears 85 times in it and "Drew Cooper"
ZERO times. See scripts/data/scCityAcfrEntities.mjs.

⚠ Its EIN 576000244 is ALSO shared with the HOUSING AUTHORITY OF THE CITY OF
ROCK HILL, which closes December where the city closes June. The report ids are
recorded per year and every one of them is a `-06-` filing.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of Rock Hill, SC',
    units=1,               # whole dollars; the city prints full figures
)

if __name__ == '__main__':
    run_cli(CONFIG)
