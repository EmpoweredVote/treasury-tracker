#!/usr/bin/env python3
"""
City of Myrtle Beach, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 6a.

⚠ NOT `City of North Myrtle Beach`, a separate government in the same county
that also files, nor `Housing Authority of Myrtle Beach`. Documents are fetched
by FAC report_id, never by a name match; see scripts/data/scAcfrSources.mjs.

-- THE STATEMENT SPANS TWO PHYSICAL PAGES, AND THAT IS FINE -----------------

Myrtle Beach prints its governmental-funds statement across two pages: the
General Fund and three other major funds on the first, the remaining funds and
the Total Governmental column on the second. The General Fund column — the only
one loaded — is entirely on the first page, so the reader never needs the
second.

⚠ Rows that are blank in the General Fund on that page are GENUINE ZEROS, not
missing data: `Local Accommodations Taxes`, `Hospitality Fee Taxes` and `Storm
Water Fees` are real line items whose money sits in the special revenue funds on
the following page. Verified by arithmetic — the nine non-blank General Fund
revenue rows sum to exactly the printed $96,136,323, so nothing is missing.

-- UNITS: WHOLE DOLLARS -----------------------------------------------------
No "in thousands" caption on any statement page. FY2024 General Fund revenues
$96,136,323 against a city of 40,535 — high per head, and correct: Myrtle Beach
is a resort economy whose General Fund is carried by tourism, with $44.6M of
licences and permits against $33.7M of property taxes. `units=1`.

⚠ Units are NOT checkable by the tie, which reads the printed total through the
same multiplier. The loader's per-capita guard is what catches it.

-- STRUCTURE ----------------------------------------------------------------
Read off `-layout`'s leading whitespace:

    REVENUES                              (0 sp)   <- flat, no groups
      Property Taxes                      (2 sp)
      ...
    EXPENDITURES                          (0 sp)
      Current:                            (2 sp)   <- parent
         General Government               (5 sp)
         Public Safety
         Transportation
         Community and Economic Development
         Parks, Recreation and Sports Tourism
         Public Works
      Capital Outlay                      (2 sp)   <- ROOT LEAF: sits at the
                                                      parents' indent and
                                                      carries money itself
      Debt Service:                       (2 sp)   <- parent
         Principal                        (5 sp)
         Interest and Fiscal Charges
         Bond Issuance Costs

⚠ `Capital Outlay` is the Bend / Tualatin / Beaverton shape, and getting it
wrong is invisible to every gate: filed as a child of `Current:` the sum is
unchanged and the tie is still exactly $0, but the published tree claims the
city spent it on current operations. The indent is the only evidence, which is
why it is read from `-layout` rather than assumed from the label.

Usage:
  py -3 scripts/extractMyrtleBeach.py _acfr-work/sc/acfr/myrtlebeach_2024.pdf --mode revenue
  py -3 scripts/extractMyrtleBeach.py _acfr-work/sc/acfr/myrtlebeach_2024.pdf --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='City of Myrtle Beach, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    units=1,
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
