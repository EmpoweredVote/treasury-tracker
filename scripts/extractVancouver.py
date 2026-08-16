#!/usr/bin/env python3
"""
City of Vancouver, WA — General Fund extractor (GAAP actuals).
Thin wrapper over scripts/lib/acfrGF.py.
Source is the WA State Auditor's bound financial statements (MCAG 0247).

Vancouver specifics
-------------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1. No "(in thousands)" caption in any
  loaded year; FY2023 prints Total revenues as 238,714,756. Tacoma, the other
  large city in this milestone, prints IN THOUSANDS, and the tie gate is
  unit-invariant -- it reads $0 either way -- so the loader's per-capita band is
  the only guard that fires on a wrong multiplier.

* The General Fund column is the LEFTMOST money column in every year, captioned
  `Consolidated General Fund`. Column counts run 4-6 as the set of major
  governmental funds changes; nothing here depends on that count.

* THE STATEMENT IS FULLY POPULATED. Unlike Tacoma FY2019/FY2023 and Spokane
  FY2005/FY2007, every data row prints a token in every column -- dashes where
  a fund has no activity. No row is ever short, so no blank-cell trap arises.

THE TREE SHAPE IS READ OFF THE PAGE, IN BOTH ERAS
--------------------------------------------------
Vancouver prints its indentation, which makes the one question that matters --
whether the capital line hangs under `Current` or sits beside it -- answerable
directly rather than by inference:

    FY2005 p.23        FY2023 p.33
    x=43  Current      x=47  Current
    x=48    functions  x=51    functions
    x=43  Capital projects      x=47  Capital outlay   <- ROOT PEER
    x=43  Debt service          x=47  Debt service

That is GASB's character classification and it matches Tacoma and Spokane.
Spokane needed its FY2004 filings to settle the same question because its later
eras print no indentation at all; Vancouver never lost it.

TWO SPELLINGS OF THE CAPITAL LINE, ONE PREFIX
----------------------------------------------
FY2005-FY2014 print `Capital projects`; FY2015 onward print `Capital outlay`.
`root_leaves` entries are PREFIXES, so `('capital ',)` covers both. Naming only
one spelling would silently nest half the corpus under `Current` -- same
dollars, wrong shape, and a $0 tie either way.

`Current` and `Debt service` are printed WITHOUT colons in every year. The
library matches parents on the colon-stripped label, so that needs nothing.

TWO YEARS ARE EXCLUDED, BOTH SOURCE-DOCUMENT DEFECTS AT THE ENDS OF THE SPAN
-----------------------------------------------------------------------------
FY2004 -- image-only scan. Every statement page returns nothing but the SAO
page furniture ("Washington State Auditor's Office / 19"). Only the table of
contents and the front matter carry text. Same class as Spokane FY2012 and
Bainbridge FY2006.

FY2024 -- the worst text layer in this milestone so far, and worth describing
because it is NOT the familiar +29 shift alone. Three defects coexist in one
document:

  * A glyph map that DROPS characters outright. `f`, `w`, `x`, `j`, `z` and the
    fi/fl/ff ligatures vanish: "rom operations", "Foreitures", "hich",
    "cityide", "proects", "groth", "Ependitures", "nancial statements".
  * The +29 byte shift on other runs: `34!4%-%.4/&2%6%.5%3` is
    "STATEMENTOFREVENUES".
  * On the governmental-funds statement itself, THE MONEY DIGITS ARE ABSENT.
    The General Fund's Property taxes row renders as `$ ,,` -- the thousands
    separators survive and every digit is gone.

v2.22 established that a bounded, self-validating decode of this cipher class
does not recover the money digits (Bainbridge FY2010, Kitsap FY2017-FY2019),
and there is nothing here to decode: the digits were never emitted. FY2023
extracts cleanly, so FY2024 is documented and skipped rather than recovered.

A NOTE ON PAGE SELECTION: FY2021 SPANS TWO PAGES
--------------------------------------------------
FY2021's governmental-funds statement runs across p.45 and p.46. Page 46
carries the IDENTICAL title and `GOVERNMENTAL FUNDS` scope line, its own
REVENUES / Total rows, and no General Fund column at all -- its columns are
American Rescue Plan Act / General Obligation Debt / Non-Major Governmental /
Total. `find_statement_page` takes the earliest qualifying page, so it lands on
p.45 correctly; scripts/verify-wa-rederive.mjs asserts single-candidacy
independently, and needed its General-Fund caption test tightened so that
"General Obligation" no longer counts as a General Fund column.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Vancouver, WA',
    # Printed without colons in every year; the library matches parents on the
    # colon-stripped label, so one entry covers it.
    parents=('current', 'debt service'),
    # A PREFIX covering `Capital projects` (FY2005-FY2014) and `Capital outlay`
    # (FY2015-FY2023). A root peer of the two parents, read off the printed
    # indentation in both eras.
    root_leaves=('capital ',),
    # Vancouver names its tax sources as sibling leaves; there is no `Taxes:`
    # parent to open.
    revenue_parents=(),
    revenue_group_members=(),
    # Every row is fully populated, so ordinal would also work here. Positional
    # is kept because it anchors on the totals row's x-ranges and is therefore
    # indifferent to a column appearing or disappearing between years, which
    # Vancouver does often (4-6 money columns across the span).
    column_strategy='positional',
    units=1,
    fy_end=('December', 31),
    source_rounding={
        # FY2008 p.28 (bound page 25). ADJUDICATED OFF THE RENDERED IMAGE at
        # 200dpi, not off the text layer -- the text layer is what would be
        # under suspicion. Both sides of the statement print a total ONE DOLLAR
        # BELOW the sum of their own printed components, and every component
        # was read from the picture and re-added by hand.
        #
        # Expenditures, General Fund column:
        #   General government            26,506,868
        #   Judicial                       1,664,942
        #   Security/persons & property   35,842,530
        #   Physical environment             942,211
        #   Transportation                 3,554,060
        #   Economic environment           6,952,430
        #   Mental and physical health       318,433
        #   Culture and recreation        10,306,066
        #   (Capital outlay, Principal retirement, Refunding bond issuance
        #    cost and Interest/fiscal charges all print a dash)
        #   = 86,087,540; the page prints Total expenditures 86,087,539.
        (2008, 'operating'): 1,
        # Revenues, General Fund column:
        #   Property taxes                37,586,290
        #   Sales and use taxes           28,009,925
        #   Other taxes                   29,790,794
        #   License and permits              837,918
        #   Intergovernmental              6,794,412
        #   Charges for services          17,266,364
        #   Fines and forfeits             1,784,822
        #   Investment earnings            1,171,935
        #   Rents and royalties              406,096
        #   Contributions/donations          268,919
        #   Miscellaneous                    738,632
        #   = 124,656,107; the page prints Total revenues 124,656,106.
        (2008, 'revenue'): 1,
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
