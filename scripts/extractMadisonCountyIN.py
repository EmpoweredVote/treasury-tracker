#!/usr/bin/env python3
"""
Madison County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 4 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

⭐ MADISON IS THE ONLY ONE OF WAVE 4'S FIVE THAT FOLLOWS THE WAVE-2/3 PATTERN:
GAAP from FY2019 straight through to FY2024, six years, no reversion. Its
FY2016-FY2018 filings are SBOA REGULATORY-BASIS reports (`IN_COUNTY_BASIS_GAPS`)
and FY2025 has not been filed.

── STRUCTURE, READ FROM THE PRINTED PAGE (all six GAAP years) ───────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Other
        Intergovernmental                    <- root sources resume here
        Charges for services
        Investment income (FY2019-FY2020) | Investment earnings (FY2021+)
        Fines, forfeitures and penalties (FY2019-FY2020) |
            Fines and forfeitures (FY2021+)
        Other  (FY2019-FY2020: a VALUED ROOT LEAF)
        Other: (FY2021+: a SECOND revenue parent)
            Miscellaneous
    Expenditures
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Health and welfare / Sanitation / Community development (FY2020) /
            Economic development (FY2021+)
        Debt service:                        <- parent
            Principal / Interest / Bond issue costs (FY2024)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare

⚠⚠ THE THREE EXPENDITURE PARENTS ARE PRINTED IN THREE DIFFERENT ORDERS ACROSS
SIX YEARS — FY2019 prints Current, CAPITAL OUTLAY, Debt service; FY2020 onward
print Current, Debt service, Capital outlay. Order does not change the parse
(each heading opens its own group) and the tuple below is written in the order
the LATER years print, which is also Vanderburgh's. It is recorded because the
next reader will otherwise wonder whether FY2019 was checked. It was.

⚠⚠ `Other` IS A VALUED ROOT LEAF IN TWO YEARS AND A GROUP HEADING IN FOUR —
the Hendricks and Vanderburgh shape. One config covers both, and not by luck:
the library opens a group only on a row with NO value, so the valued FY2019 and
FY2020 lines stay leaves while the valueless FY2021 heading opens a group.

⚠ THE COUNTY RELABELLED TWO REVENUE LINES AT FY2021 — `Investment income` ->
`Investment earnings` and `Fines, forfeitures and penalties` -> `Fines and
forfeitures`. Both are ROOT leaves in every year, so no config depends on the
wording; both load IN THE CASE AND WORDING THE ISSUER PRINTED. ⚠ A naive
year-over-year label diff will show each as one line vanishing and another
appearing — see `IN_COUNTY_SERIES_NOTES` for the same trap in Hendricks.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on these documents, not
carried from another entity. `units=1` (the default).

── NO `statement_anchor` ────────────────────────────────────────────────────

⚠ `find_statement_page` ORs the anchor with the title, so an anchor can only
WIDEN the candidate set. All six documents are located by title alone.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Madison County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group
        'property', 'income', 'other',
        # the root `Other:` group, FY2021+
        'miscellaneous',
    ),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
