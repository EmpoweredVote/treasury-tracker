#!/usr/bin/env python3
"""
City of Charlotte, NC ACFR — General Fund extractor, COORDINATE-BASED.

Thin wrapper over `scripts/lib/acfrGfCoords.py`, which carries the shared
machinery and states the rule for when an entity belongs on the coordinate
reader at all.

-- WHY THIS ENTITY READS BY COORDINATES -------------------------------------
Charlotte's ACFR text layer emits the LABEL column and the NUMERIC columns as
separate blocks, so every line-based reader pairs each label with the value of
the row BELOW it. FY2023, `pdftotext -layout`, measured:

    Revenues:                    $426,942  $105,602 ... $553,217
       Property taxes            144,497   32,606   ...
       Other taxes               113,572   -        ...

`$426,942` sits on the `Revenues:` banner line but is Property taxes' figure;
`144,497` is printed beside `Property taxes` but belongs to Other taxes. The
whole column is shifted by exactly one row.

⚠ THIS TIES AT $0 WHILE BEING COMPLETELY WRONG. The offset permutes the
label→value assignment without adding or removing a single figure, so the
component multiset — and therefore the sum — is IDENTICAL either way. The tie
gate, the leaf-multiset check and the printed-total check all pass on a report
in which every category carries its neighbour's money. Only the glyph
coordinates recover the true pairing.

-- ⚠ UNITS: THOUSANDS -------------------------------------------------------
Every statement page is captioned "(Dollar Amounts in Thousands)" — verified on
the FY2023 balance sheet (p50), the governmental-funds statement (p52) and the
notes (p71, p80). `units=1000`.

This is the Austin / Seattle / King County trap: `tie_delta` compares a computed
sum against a printed total read through the SAME multiplier, so it is $0
whether or not the scaling is right. A wrong `units` here would ship a silently
1000x-wrong city. It is checked instead by the loader's per-capita plausibility
guard and by verify-nc.mjs.

-- STRUCTURE IS READ, NOT DECLARED ------------------------------------------
Nesting comes from the printed glyph indentation, so no `parents` /
`root_leaves` config is needed. Charlotte prints `Current-`, `Debt service-`
(hyphen, not colon) as group headings with `Capital outlay` as a valued root
peer.

-- WINDOW -------------------------------------------------------------------
FY2011-FY2025, the fifteen years the city serves live and first-party.
FY2010 and earlier existed on the retired `charmeck.org` host and are reachable
only through the Internet Archive; they are NOT loaded, under the first-party
`source_url` policy set on 2026-08-25 for City of Durham FY2004-FY2006.

Usage:
  py -3 scripts/extractCharlotteCoords.py docs/Charlotte/charlotte_fy2023.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of Charlotte, NC',
    units=1000,   # ⚠ every statement page is captioned "(Dollar Amounts in Thousands)"
    weld='indent',  # ⚠ the city wraps long function names and prints the money on
                    # the DEEPER continuation line ('Engineering and property' /
                    # 'management'). Without this the published categories are
                    # literally `management` and `development`, and the tie is
                    # still exactly $0. See acfrGfComponents.collect.
)

if __name__ == '__main__':
    run_cli(CONFIG)
