#!/usr/bin/env python3
"""
City of Columbia, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 6a; South Carolina's first city in TT.

⚠ NOT Columbia MO, Columbia CT, Columbia IL, Columbia KY, Columbia LA, Columbia
MS or Columbia NC — all of which exist in the FAC census, Missouri's at fiscal
month 10 against South Carolina's 7. Nor `City of West Columbia`, a different
government in Lexington County. Documents are fetched by FAC report_id, never by
a name match; see scripts/data/scAcfrSources.mjs.

-- WHY THIS ENTITY READS BY `-table`, NOT COORDINATES ------------------------

Because `-table` is CORRECT here, and the coordinate reader is only for a
DIAGNOSED mechanical failure of it. Columbia looked like a coordinate case and
is not, which is worth recording precisely:

`pdftotext -layout` emits the LABEL column and the NUMERIC columns as separate
blocks, so every line-based reader pairs each label with another row's money.
On FY2024 it renders the General Fund column shifted such that `34,353,509`
prints beside `Local option sales tax` when it belongs to `Licenses and
permits`. That is the City of Charlotte defect exactly, and it TIES AT $0 —
the offset permutes the label→value assignment without adding or removing a
figure, so the multiset and therefore the sum are identical either way.

⚠⚠ THE TIE CANNOT ARBITRATE THIS. It was settled by running
`scripts/acfrGfComponents.py` (pdfplumber glyph x-coordinates, which never see
the character grid) over the same page and comparing pairings row by row. The
glyph reader agrees with `-table` and disagrees with `-layout`:

    General property taxes            35,394,337   both readers
    Local option sales tax            31,058,772   both readers
    Hospitality and admission taxes       10,844   both readers
    Accommodations tax                  0 (dash)   both readers
    Licenses and permits              34,353,509   -table + glyphs; -layout says
                                                   this belongs to sales tax

So `-layout` is the broken reader on this issuer and `-table` is sound. Choosing
`-table` because it happened to tie would have been curve-fitting; it is chosen
because an independent reader corroborates its pairing.

-- UNITS: WHOLE DOLLARS -----------------------------------------------------
No statement page carries an "in thousands" caption, and the printed General
Fund total is $157,677,640 against a city of 144,788 — about $1,089 per
resident, which is an ordinary municipal figure. `units=1`.

⚠ A wrong `units` ties at $0 regardless, because tie_delta compares a computed
sum against a printed total read through the SAME multiplier. This is the
Austin / Charlotte / Seattle trap and it is checked by the loader's per-capita
guard, never by the tie.

-- STRUCTURE ----------------------------------------------------------------
Read off `-layout`'s leading whitespace, which survives even though its money
does not:

    REVENUES                       (0 sp)   <- flat, no groups
    General property taxes         (0 sp)
    ...
    EXPENDITURES                   (0 sp)
    Current                        (0 sp)   <- parent, NO colon
        General government         (4 sp)
        Judicial
        ...
    Debt service                   (0 sp)   <- parent
        Principal payment on bonds (4 sp)
        ...
    Capital outlay                 (0 sp)   <- parent, and its ONLY child is
        Capital outlay             (4 sp)      also called "Capital outlay"

⚠ The doubled `Capital outlay` is what the issuer actually prints — an unvalued
heading above a valued line of the same name — and it is published that way
rather than collapsed. Renaming or flattening it would be TT inventing a label
the city never used, and the money is identical either way.

Usage:
  py -3 scripts/extractColumbiaSC.py _acfr-work/sc/acfr/columbia_2024.pdf --mode revenue
  py -3 scripts/extractColumbiaSC.py _acfr-work/sc/acfr/columbia_2024.pdf --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='City of Columbia, SC',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    units=1,
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
