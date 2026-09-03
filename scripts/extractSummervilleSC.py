#!/usr/bin/env python3
"""
Town of Summerville, SC ACFR — the CORROBORATING `-table` extractor.

⚠⚠ NOT THE RECORD READER. `scripts/extractSummervilleCoords.py` is, and this
file exists to keep that move falsifiable: when an entity goes to glyph
coordinates the campaign requires the OTHER reader to keep corroborating every
year it can still read, because a coordinate reader that quietly went wrong
would tie at 0 exactly as happily as the character-grid reader it replaced.
Driven by `scripts/verifyScCityReaders.mjs`, which compares `computed_total` and
fails on any undeclared difference. Result: 12 of 12 exact agreement.

── ⚠ WHAT IT CORROBORATES, AND WHAT IT CANNOT ─────────────────────────────

The ARITHMETIC, in full — every one of the twelve totals matches the coordinate
reader to the dollar, from two readers that share no code and no strategy.

NOT the SHAPE. The town prints `Current:` > `General Government:` >
`Administrative`, and no `CityConfig` can hold three levels: the config below
promotes the three valueless sub-headings to ROOT parents, so `Current` ends up
holding nothing and `General Government`, `Public Safety` and `Roads and
drainage` stand beside it. The leaf multiset is identical, which is exactly why
the total still ties at 0 — and exactly why the tie cannot be used to choose
between the two shapes. The printed indentation can, and does.

── ⚠⚠ `column_strategy='ordinal'` IS LOAD-BEARING HERE ────────────────────

The issuer renders the General Fund column at TWO character offsets, so
`positional` files the lower rows under the next fund and reads 14 money rows as
0 (FY2024 operating computes 24,184,615 against a printed 47,063,844). Ordinal
takes the Nth money token instead and reads every year. ⚠ This is a per-ENTITY
choice made once, not a per-YEAR search for whichever strategy happened to tie —
that is the curve-fitting error the LA-01 scope verdict was retracted for.

⚠ `Culture and recreation` is declared a ROOT LEAF because in this flattened
reading it has no parent to belong to; on the printed page it is a valued leaf at
the sub-group level, which only the coordinate reader can express.

⚠ No `fy_end` override: the ordinal reader recovers 2018 and 2020 (December year
ends) and 2022-2025 (June) from each document's own caption, verified per year.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Town of Summerville, SC',
    parents=('current', 'general government', 'public safety', 'roads and drainage',
             'debt service'),
    root_leaves=('capital outlay', 'culture and recreation'),
    column_strategy='ordinal',
)

if __name__ == '__main__':
    run_cli(CONFIG)
