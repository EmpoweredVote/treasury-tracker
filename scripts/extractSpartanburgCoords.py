#!/usr/bin/env python3
"""
City of Spartanburg, SC ACFR — General Fund extractor, COORDINATE-BASED.

Emits the same JSON contract as `scripts/lib/acfrGF.py`, so
`scripts/extractScCitiesAll.mjs` and `scripts/loadScCityAcfrs.mjs` drive it
exactly like every other extractor. EIN 576000245, ten years FY2016-FY2025, all
twenty extractions tie at $0.

── ⚠⚠ WHY THIS ENTITY NEEDS THE COORDINATE READER ─────────────────────────

A DIAGNOSED, MECHANICAL failure of the character-grid reader on FY2018 — not a
year that "happened to tie" better here. On that document `pdftotext -table`
mis-renders the statement page and MIXES THE TWO SECTIONS: the revenue side
comes out 5,975,414 over, which is exactly `Policy Formulation and
Administration`, an EXPENDITURE line; the expenditure side finds no printed
total at all (`printed_total: null`) and computes 66,011,076.

⚠ BOTH `-table` column strategies fail it identically — `positional` and
`ordinal` produce the same two deltas — so it is the grid itself, not the column
assignment, and no `CityConfig` value reaches it.

⚠⚠ AND THE CHOICE IS PER ENTITY, NOT PER YEAR. Nine of the ten years read
correctly through `-table`; using it for those and coordinates for FY2018 would
be picking whichever reader tied, which is the curve-fitting error that got the
LA-01 scope verdict retracted. The entity moves as a whole, for a stated reason,
and the other reader is then required to keep corroborating every year it can
still read — `scripts/extractSpartanburgSC.py`, 18 of 20 exact, with FY2018
declared in `verifyScCityReaders.mjs`.

In glyph space the page is unremarkable: the coordinate reader reads all ten
years with no per-entity tuning beyond `units`.

── ⚠⚠ THE EIN'S TWO NEIGHBOURS ARE CITIES TT ALREADY HOLDS ────────────────

    576000244  CITY OF ROCK HILL      <- wave 2, loaded
    576000245  CITY OF SPARTANBURG    <- wanted
    576000246  CITY OF SUMTER         <- a real SC city

A typo in either direction does not fail: it loads another government's audited
statements under this city's name and every tie gate passes on them.
⭐ Unlike Rock Hill, this EIN is CLEAN — checked in the bulk table, not assumed:
10 filings, ONE auditee name, ONE fiscal year end, one state, one city.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears in any of the ten documents, checked per
document rather than carried from a neighbour.

── STRUCTURE, STABLE ACROSS THE DECADE ────────────────────────────────────

Revenue is FLAT — every source sits at the section root in both FY2016 and
FY2025, so nothing is declared. Expenditure is `Current:` over six functions,
with `Capital Outlay` a VALUED ROOT LEAF and `Debt Service:` a heading.
⚠ `Capital Outlay` is a valued root leaf here and a PARENT in Rock Hill, in the
same registry family. Read it per entity.
⚠ Several printed line items carry no General Fund figure — `Federal Government
Contributions`, `State Government Contributions`, `Donations`, and the whole
Debt Service group in most years. Honest absences: recorded in `zero_rows`,
never published as $0 categories.

── ⚠ JULY FISCAL YEAR, CONFIRMED THREE WAYS ───────────────────────────────

`fy_end_date` is 06-30 on all ten federal filings; the FAC census records
`SC,Spartanburg,municipality,annual,7` across audit years 1998-1999, 2001-2021
and 2023-2025; and each statement states its own period. ⚠ The census has no
2022 row — a census GAP, not a disagreement.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of Spartanburg, SC',
    units=1,               # whole dollars; the city prints full figures
)

if __name__ == '__main__':
    run_cli(CONFIG)
