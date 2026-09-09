#!/usr/bin/env python3
"""
Hamilton County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 1 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Hamilton County publishes a full Annual Comprehensive Financial Report with a
GFOA Certificate of Achievement, and FAC's metadata records GAAP in all ten
years (`sp_framework_basis` empty).

── ⚠⚠ THE REVENUE SECTION IS GROUPED, AND ITS NEIGHBOURS' ARE NOT ─────────

Marion and Allen both print a FLAT revenue section — one valued `Taxes` line.
Hamilton prints `Taxes:` as a HEADING over five kinds of tax and `Other:` as a
heading over two more:

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Food and beverage / Innkeepers / Other
        Special assessments                  <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Investment earnings
        Other:                               <- a SECOND revenue parent
            Donation / Miscellaneous

⚠⚠ Leaving `revenue_parents` empty here is the QUIET failure the library's own
docstring warns about: the heading is read as a wrapped label and welded onto its
first child (`Taxes Property`), amounts unaffected, `tie_delta` still 0, only the
labels wrong. Three counties, three different revenue shapes — this is why the
structure is read off each issuer's own page rather than inherited.

⚠⚠ AND `revenue_group_members` MUST NAME EVERY MEMBER OF BOTH GROUPS.
The library closes an open group on the first row that is not a member, so an
incomplete list silently REPARENTS the rest to the tree root at a $0 tie
(failure mode 1). Hamilton's members share no suffix at all — Property, Income,
Food and beverage, Innkeepers, Other, Donation, Miscellaneous — so each is named
in full. ⚠ `other` is deliberately in the list AND is the name of the second
group: the group-open branch requires a row with NO value, and the `Other` tax
line carries one, so the two never collide.

── STRUCTURE OF THE EXPENDITURE SECTION ─────────────────────────────────────

    Expenditures
        Current:                             <- parent
            General government / Public safety / Economic development /
            Highways and streets / Health and welfare / Culture and recreation
        Debt service:                        <- parent
            Principal / Interest / Lease principal / Subscription principal /
            Bond issue costs
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF IN MARION'S DOCUMENT.
Copying Marion's `root_leaves=('capital outlay',)` would reparent five children
onto the root **while the statement still tied to the cent** — failure mode 2.

⚠ Five category names appear TWICE, once under `Current:` and once under
`Capital outlay:`. That is the issuer's own presentation; both are kept and they
are distinguishable by their parent.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on this document, not
carried from another entity — and FY2024's printed total governmental revenue is
345,104,150 for a county of ~380,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ Requires "Governmental Funds" — failure mode 10. Hamilton's document also
# carries `Combining Statement of ... - Nonmajor Governmental Funds` (caught by
# `_EXCLUDE`) and a `Budgetary Comparison Schedule - General Fund` (likewise).
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund'
    r'\s+Balances[\s\S]{0,200}?Governmental\s+Funds'
)

CONFIG = CityConfig(
    city='Hamilton County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    # ⚠⚠ `other` is BOTH a root group and a sub-heading inside `Taxes:` — see the
    # module docstring. The library tests subparents first and requires an open
    # parent, so the in-Taxes one nests and the root one opens a group.
    revenue_subparents=('other',),
    revenue_group_members=(
        # the `Taxes:` group, both eras
        'property', 'income', 'food and beverage', 'innkeepers', 'other',
        # the root `Other:` group, FY2016-FY2020
        'interest revenue', 'sale of property', 'donations',
        # the root `Other:` group, FY2021-FY2025
        'donation', 'sale of assets', 'miscellaneous',
    ),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
