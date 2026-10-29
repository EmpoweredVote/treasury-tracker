#!/usr/bin/env python3
"""
City and County of Honolulu, HI — General Fund extractor (COORDINATE reader).

⚠⚠ WHY HONOLULU IS THE ONE HAWAII ENTITY NOT ON `-table`.

The other three counties (`scripts/extractHiCounty.py`) tie at exactly $0 under
`scripts/lib/acfrGF.py`. Honolulu cannot be read there at all, for a DIAGNOSED,
mechanical reason — the bar `acfrGfCoords.py` sets for moving an entity, and
never "it happened to tie here".

── THE DIAGNOSIS: DOT LEADERS LAND INSIDE THE DIGITS ─────────────────────────

Honolulu sets its statement with dot leaders, and on the `-table` CHARACTER
GRID those dots are interleaved with the figures rather than stopping at the
label. The FY2025 General Fund column renders:

    Taxes...............................................$.....1..,.8.42,801
    Licenses and permits....................................5..5..,.6..7..8
    Total Revenues........................................2..,.0..8..8..,.7..2.5

`1..,.8.42,801` is not a money token, so NOTHING on the page parses. Measured:
every revenue row landed in `zero_rows`, the tree came back empty, and the
printed total read `2000` — the stray `2` from the Sanitation row, scaled by
units. The failure is total and loud, not a wrong tree.

This is the same class as the LETTER-SPACED GLYPHS case `acfrGfCoords.py`
documents for Asheville ("T o t a l e xpe ndit ure s"): the character grid
destroys the token, while in glyph space the leader dots sit at their own
x-positions and the figure is intact.

── ⭐ AND IT SETTLES THE NESTING, WHICH IS THE BIGGER WIN ───────────────────

`acfrGF.CityConfig` needs `parents` / `subparents` declared by hand because
`-table` flattens the leading whitespace that states the hierarchy — and a tie
proves arithmetic, never structure, so a hand-declared nesting can be wrong
with every gate green. Honolulu is exactly the document where that bites:

  * `Miscellaneous:` is printed TWICE — a revenue group (Recoveries, Interest,
    Other) and an expenditure group under `Current:` (Retirement and health
    benefits, Other).
  * `Other` is a child of BOTH.
  * `Capital Outlay:` repeats five function names already used under
    `Current:` — General government, Public safety, Highways and streets,
    Human services, Culture-recreation.

Labels are not unique across parents here. The coordinate reader takes the
tree from the printed INDENTATION, so none of that has to be declared, and the
structure published is the structure the issuer printed.

── ⚠⚠⚠ UNITS = 1000 ────────────────────────────────────────────────────────

The statement page is captioned "( Amounts in thousands )". General Fund
revenue prints 2,088,725 and is $2.09 BILLION for a city-county of 998,747
(~$2,091/capita). NOT checkable by the tie gate, which scales computed and
printed alike; the loader's per-capita guard and
`TestShippedHiCountyConfigs` are what stand in the way.

-- WINDOW -------------------------------------------------------------------
FY2016-FY2025, the ten years FAC serves.

Usage:
  py -3 scripts/extractHonoluluCoords.py docs/HiCounties/honolulu/honolulu-2025-acfr.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City and County of Honolulu, HI',
    units=1000,
    weld=None,
    # ⚠⚠⚠ WITHOUT THIS THE READER TIES AT $0 ON THE WRONG FUND. The leaders
    # touch the digits, so the General Fund figure is not a free word on the
    # printed total rows; `establish_column` then finds the HIGHWAY fund's
    # figure first and establishes Highway as the General Fund column.
    # Measured on FY2025: computed 315,247 thousand against a General Fund of
    # 2,088,725, tie delta exactly $0. Splitting restores the GF figure as its
    # own token with the word's own right edge, which is the edge the column
    # is aligned on.
    split_leader_dots=True,
    # ⚠⚠ Honolulu draws NO SPACE GLYPHS between the words of a label, and the
    # visual gaps fall under pdfplumber's default 3.0, so every multi-word
    # category came back welded: `Licensesandpermits`, `Publicsafety`,
    # `CapitalOutlay`. Correct money under a name the issuer never printed —
    # the Kent wrapped-label defect class, which a tie cannot see. Measured on
    # FY2025 page 69: 2.0 separates every word while keeping each figure whole.
    x_tolerance=2.0,
    # ⚠⚠⚠ FY2016-FY2023 SET THE GENERAL FUND AND HIGHWAY COLUMNS TOUCHING, so
    # the two figures fuse into one token — `885,055105,532` (FY2016),
    # `1,068,640121,109` (FY2019) — which `_MONEY` accepts as a single number.
    # Measured: FY2016-FY2018 failed loudly ("the two total rows agree on
    # neither edge"), while FY2019-FY2023 came back with deltas in the
    # trillions. Detectable from the token alone, because US comma grouping
    # admits no six-digit interior group.
    split_fused_money=True,
)

if __name__ == '__main__':
    run_cli(CONFIG)
