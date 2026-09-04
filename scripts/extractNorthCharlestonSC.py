#!/usr/bin/env python3
"""
City of North Charleston, SC ACFR — the CORROBORATING `-table` extractor.

⚠⚠ NOT THE RECORD READER. `scripts/extractNorthCharlestonCoords.py` is, and this
file exists to keep that move falsifiable: when an entity goes to glyph
coordinates the campaign requires the OTHER reader to keep corroborating every
year it can still read, because a coordinate reader that quietly went wrong
would tie at $0 exactly as happily as the character-grid reader it replaced.
Driven by `scripts/verifyScCityReaders.mjs`.

── ⚠ IT AGREES ON FOUR OF THE EIGHT, AND THE OTHER FOUR ARE DECLARED ──────

    FY2021 revenue    129,509,947   agrees to the dollar
    FY2022 revenue    136,086,848   agrees to the dollar
    FY2025 revenue    172,505,262   agrees to the dollar
    FY2025 operating  158,793,790   agrees to the dollar

That is a real check on four figures from a reader that shares no code and no
strategy with the coordinate one — and it is worth having precisely because this
issuer's pages are the hardest in the wave.

The four it cannot read are declared in `READER_DISAGREEMENTS` with their
diagnosed causes rather than waved through. All four are the character grid
meeting the same defects the coordinate reader was configured for: the split
leading `1` on FY2021's expenditure total, and page furniture that `-table`
flattens into the label column.

⚠ `column_strategy='ordinal'` because this issuer, like Summerville, renders its
General Fund column at more than one character offset. It is a per-ENTITY choice
made once, not a per-YEAR search for whichever strategy happened to tie.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of North Charleston, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    column_strategy='ordinal',
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
