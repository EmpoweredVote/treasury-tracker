#!/usr/bin/env python3
"""
City of Kent, WA — General Fund extractor (GAAP actuals).
Thin wrapper over scripts/lib/acfrGF.py.
Source is the WA State Auditor's bound financial statements (MCAG 0401).

Kent specifics
--------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1. No "(in thousands)" caption in any
  loaded year; FY2024 prints Property tax as 16,350,xxx and TOTAL REVENUES as
  130,475,xxx. Tacoma and Bellevue in this same milestone print IN THOUSANDS,
  and the tie gate cannot tell them apart, so the loader's per-capita band is
  the only guard that fires on a wrong multiplier.

* `column_strategy='positional'`. Kent's statements are FULL OF BLANK CELLS --
  FY2004's revenue section prints rows carrying anywhere from one to four
  numbers against a four-column totals row, and FY2006/FY2008 do the same
  against seven. The ordinal reader counts cells back from the right end, so a
  missing cell silently shifts a column. This is the Tacoma FY2023 / Spokane
  FY2005 trap at a scale neither of them reached.

THE RICHEST REVENUE TREE IN THE COHORT: FIVE PARENTS
------------------------------------------------------
Every other WA entity here prints a flat revenue side or, at most, one `Taxes:`
group. Kent groups almost the whole section:

    REVENUES
      Taxes:                      Property / Sales and use / Utility /
                                  Business & occupation / Real estate excise
                                  tax / Lodging / Other
      Licenses and permits:       Building permits / Other licenses and permits
      Intergovernmental revenue:  Federal grants / State grants / State shared
                                  revenues / Other governments
      Charges for services:       Park and recreation fees / Other fees and
                                  charges
      Fines and forfeitures       <- A ROOT LEAF, the only ungrouped source
      Miscellaneous revenue:      Special assessments / Interest income /
                                  Rent/Leases income / Contributions and
                                  donations / Other miscellaneous revenue

Read off the FY2024 indentation, which Kent prints: parents at x=51, children at
x=53, and `Fines and forfeitures` back at x=51.

WHY `revenue_group_members` LOOKS THE WAY IT DOES
--------------------------------------------------
The library closes an open revenue group at the first row whose label does not
end with one of these suffixes. Because each parent row REOPENS a group, the
only close that has to work is Charges-for-services -> Fines and forfeitures.
The suffixes therefore have to cover every child of every group across all
eighteen years while NOT matching `fines and forfeitures`.

Two entries are deliberately narrower than they look like they should be:

  * `miscellaneous revenue`, NOT the bare `revenue`. FY2012 prints
    `Intergovernmental revenue` as a VALUED LEAF rather than a parent, and a
    bare `revenue` suffix would have kept it inside the still-open Licenses and
    permits group instead of closing it -- same dollars, wrong shape, $0 tie.
  * `shared revenues` and `revenues` (plural) cover `State shared revenues`
    without matching that same singular `Intergovernmental revenue`.

FY2004-FY2008 WELD THE SAO PAGE-FOOTER CREDIT ONTO A LABEL
------------------------------------------------------------
`-table` renders the `Fire District #` row with "Washington State Auditor's
Office" glued to the front of it, exactly as it does on Spokane FY2007. The
figure is correct and the row ties at $0, so no arithmetic gate sees it.
Repaired with an EXACT `label_fixes` entry, keyed on the WHITESPACE-COLLAPSED
label that `label_of()` emits -- keying on the raw `-table` spacing silently
never matches.

THREE YEARS ARE EXCLUDED, AND ONE DEVIATION FROM THE FLOOR RULE IS RECORDED
----------------------------------------------------------------------------
FY2019, FY2020 and FY2023 carry no usable text layer. All three are the +29
shift with the money digits absent: FY2023 p.43's statement renders as
`67$7(0(172)5(9(18(6...` with nothing after `3URSHUW\`, and FY2019 has ZERO
money-bearing pages in the entire document. v2.22 proved this cipher class does
not decode back to digits, and here there are no digits to recover.

⚠ FY2019 and FY2020 are CONSECUTIVE, and the milestone's floor rule says two
consecutive unreadable years END the window -- which would have stopped Kent at
FY2021 and published three years. The window below the gap was taken instead,
as an EXPLICIT, APPROVED DEVIATION recorded here and in the recon doc.

The reason is that the rule's stated purpose is "never extend a window by doing
not-easy work to make the row count look better", and reading below FY2019 needs
no work at all: no era split, no second config, no font recovery, no different
source. The fifteen years below the gap parse on the SAME config as the three
above it, which is the test the rule actually cares about. The gap is a property
of two documents, not a boundary in the statements.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Kent, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=('taxes', 'licenses and permits', 'intergovernmental revenue',
                     'charges for services', 'miscellaneous revenue'),
    # See the note above on why `miscellaneous revenue` and `shared revenues`
    # are used rather than the bare `revenue`.
    revenue_group_members=(
        'property', 'sales and use', 'utility', 'occupation', 'excise tax',
        'lodging', 'other',
        'permits',
        # `contract`, NOT `district #`. The row is `Fire District # 37 Contract`
        # and label_of used to truncate it at the `37`, so the old suffix matched
        # the TRUNCATION. With the full name read, the suffix has to match the
        # name's actual end or the Intergovernmental group closes on its own first
        # child.
        'contract', 'grants', 'shared revenue', 'shared revenues', 'revenues',
        'governments',
        'fees', 'charges',
        'assessments', 'income', 'investments', 'donations',
        'miscellaneous revenue',
    ),
    column_strategy='positional',
    units=1,
    fy_end=('December', 31),
    # Rows Kent prints with NOTHING in any column -- real line items carrying no
    # money that year, not the first line of a wrapped label. See
    # CityConfig.empty_rows: welding these forward shipped `Lodging Other`,
    # `Real estate excise tax Lodging Other`, `Contributions and Donations Other
    # miscellaneous revenue` and `Issuance costs Capital outlay` across six years.
    #
    # `real estate excise tax` is valueless in FY2004 ONLY; the entry is inert in
    # the fifteen years where the row carries a figure.
    #
    # Kent DOES have one genuine wrapped label -- FY2022's `Unrealized net
    # gain/(loss)` / `in fair value of investments` -- which is why the default
    # weld is left in place rather than inverted, here or in the library.
    empty_rows=(
        'lodging',
        'real estate excise tax',
        'contributions and donations',
        'issuance costs',
    ),
    label_fixes={
        # FY2004-FY2008. The key is the COLLAPSED label as label_of() emits it,
        # which since the label_of truncation fix carries the full row name.
        "Washington State Auditor's Office Fire District # 37 Contract": 'Fire District # 37 Contract',
    },
    source_rounding={},   # the load task registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
