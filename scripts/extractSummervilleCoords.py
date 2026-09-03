#!/usr/bin/env python3
"""
Town of Summerville, SC ACFR — General Fund extractor, COORDINATE-BASED.

Emits the same JSON contract as `scripts/lib/acfrGF.py`, so
`scripts/extractScCitiesAll.mjs` and `scripts/loadScCityAcfrs.mjs` drive it
exactly like every other extractor. It reads the page through
`scripts/acfrGfComponents.py` — pdfplumber glyph coordinates — instead of the
`pdftotext -table` character grid.

⚠ A TOWN. `Summerville town` in the Census file, `TOWN OF SUMMERVILLE` in its own
filings, and `treasury_ensure_municipality` keys on (name, state, entity_type),
so the type is part of this government's identity. EIN 576001110.

── ⚠⚠ WHY THIS ENTITY NEEDS THE COORDINATE READER ─────────────────────────

TWO reasons, and the SECOND is the one that decides it.

1. THE TWO-OFFSET COLUMN. `pdftotext -table` renders the General Fund column at
   two different character positions on the same page:

       Taxes                                 $        18,429,526
       Licenses, permits, and franchise fees           20,220,559
       Intergovernmental revenue                                    5,740,546
       Charges for services                                         441,126

   `column_strategy='positional'` files the lower rows under the next fund and
   reads them as 0 — 14 money-carrying rows come back empty. The diagnosed
   remedy for exactly this is `column_strategy='ordinal'`, and it WORKS: see
   `scripts/extractSummervilleSC.py`, which ties at 0 on all twelve extractions.
   So on arithmetic alone the character-grid reader is adequate, and this file
   would not exist.

2. ⚠⚠ THE THREE-LEVEL HIERARCHY, WHICH IS WHAT ACTUALLY DECIDES IT. The town
   prints THREE levels, and no `CityConfig` shape can express them:

       Current:                    44.27  heading
         General Government:       50.75    sub-heading, no money
           Administrative          57.23      3,563,324
           Planning and annexation 57.22      1,493,624
           ... four more
         Public Safety:            50.72    sub-heading
           Police / Fire / Communications
         Roads and drainage:       50.71    sub-heading
           Street
         Culture and recreation    50.70    VALUED LEAF at the sub-group level
       Capital outlay              44.20  valued root leaf
       Debt service:               44.20  heading -> Principal / Interest

   `subparent_member_prefixes` needs a shared prefix these children do not have,
   and `subparent_close='next_heading'` swallows `Culture and recreation`, which
   carries money at the sub-group level. The ordinal `-table` reader therefore
   flattens the middle level — same leaves, same total, a shape the town did not
   print. That ties at exactly 0 either way, which is precisely why the shape
   cannot be chosen on the tie.

   Glyph coordinates state the hierarchy directly, so this reader needs no
   structural declaration at all: `acfrGfCoords._nested` reads however many
   levels the page prints. Root spread is 0.07pt and the level gap 6.5pt, so the
   module default `indent_tol` (1.5) reads it with room on both sides.

⚠ The `-table` reader is kept as a REQUIRED CORROBORATOR
(`scripts/verifyScCityReaders.mjs`) — it agrees on the total in all twelve
extractions. It corroborates the ARITHMETIC; it is not the record reader because
it cannot carry the SHAPE.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears anywhere in any of the six documents, checked
per document rather than carried from a neighbour.

── ⚠⚠ THE FISCAL YEAR CHANGES INSIDE THE LOADED WINDOW ────────────────────

December year ends through FY2020, June from FY2022 — the first entity in this
campaign to move. This reader reads each document's own printed period caption,
so it needs no `fy_end` and gets both eras right; the LOADER is where the month
matters, and `fiscalMonthFor()` carries the override. ⭐ FY2022 is a FULL year,
not a six-month stub: revenue runs 32.9M (FY2020, Dec) -> 37.7M (FY2022, Jun) ->
40.2M -> 46.7M -> 50.8M, where a stub would be ~18M.

── ⚠ LABEL DRIFT IS THE ISSUER'S OWN ──────────────────────────────────────

The town restyles its own line items at FY2023: `Property taxes` -> `Taxes`,
`Licenses, permits, and franchise taxes` -> `... fees`, `Miscellaneous` ->
`Miscellaneous revenues`, and the sub-headings go from `General government` to
`General Government`. Loaded as published and flagged; normalising is inferring
intent (the Wichita rule).

⚠ `Sanitation` is a printed REVENUE line with no General Fund figure in
FY2018-FY2022, and `Federal revenue` likewise in FY2022. Both are recorded in
`zero_rows`, never published as 0 categories.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='Town of Summerville, SC',
    units=1,               # whole dollars; the town prints full figures
)

if __name__ == '__main__':
    run_cli(CONFIG)
