#!/usr/bin/env python3
"""
Hendricks County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 2 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Hendricks files GAAP for FY2019-FY2024. Its FY2016-FY2018 filings are State
Board of Accounts REGULATORY-BASIS reports with no governmental-funds statement
in them, declared in `IN_COUNTY_BASIS_GAPS`; FY2025 has not been filed yet.

⚠⚠ FAC RECORDS A DISCLAIMER OF OPINION for FY2020 and FY2021 — `gaap_results`
carries `disclaimer_of_opinion` and NOTHING ELSE for both years. Which opinion
units it names, and whether any of them is one this column is built from, is
read out of each document and recorded in `scripts/data/inCountyAcfrOpinions.mjs`.
Extraction is a separate question from grading and neither answers the other.

── STRUCTURE, READ FROM THE PRINTED PAGE (all six GAAP years) ───────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Innkeepers (FY2023+) / Other
        Licenses and permits                 <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Investment Income (FY2019) / Investment income (FY2020) /
            Investment earnings (FY2021+)
        Other  (FY2019-FY2020: a VALUED ROOT LEAF)
        Other: (FY2021+: a SECOND revenue parent)
            Contribution (FY2023 only) / Miscellaneous
    Expenditures
        Current:                             <- parent
            General government / Public safety / Economic development /
            Highways and streets / Health and welfare / Culture and recreation
        Debt service:                        <- parent
            Principal / Interest / Capital lease (FY2021) /
            Bond issuance costs (FY2020) / Bond issue costs (FY2021, FY2022, FY2024)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare

── ⚠⚠ `Other` IS A VALUED LEAF IN TWO YEARS AND A GROUP HEADING IN FOUR ─────

FY2019 and FY2020 print a single valued `Other` revenue line ($6,111,055 in
FY2019). FY2021 onward print `Other:` as a heading over `Miscellaneous`. ONE
CONFIG COVERS BOTH, and not by luck: the library's group-open branch requires a
row with NO value, so the valued FY2019 line stays a leaf while the valueless
FY2021 heading opens a group. Naming `other` in `revenue_parents` therefore
cannot damage the two early years.

⚠ `Innkeepers` and `Contribution` each appear in ONE year only, and both are
named in `revenue_group_members` in full. The library closes an open group on
the first row that is not a member, so a member missing from that list silently
REPARENTS the rest of the tax group to the tree root at a $0 tie — failure mode
1. A suffix rule would not work here: these members share no common ending.

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF IN MARION'S AND ST.
JOSEPH'S DOCUMENTS. Copying either county's `root_leaves` reparents its children
onto the root **while the statement still ties to the cent** — failure mode 2.

⚠ FY2019 and FY2020 print `Debt service` with a stray dash in the General Fund
column instead of an empty heading row. That is trap 6, which the library
already handles for a `parents`-matched label whose target cell is an explicit
dash placeholder — the heading opens its group instead of being dropped as a $0
leaf and stranding Principal and Interest under `Current`.

⚠ FY2019 and FY2020 print `Current`, `Debt service` and `Capital outlay` with NO
colon; `norm_label` strips a trailing colon either way, so one tuple covers both.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on these documents, not
carried from another entity — and FY2024's printed total governmental revenue is
170,338,464 for a county of ~191,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ Requires "Governmental Funds" — failure mode 10. The county wraps the title
# after `Fund Balances -` in some years and keeps it on one line in others.
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund'
    r'\s+Balances[\s\S]{0,200}?Governmental\s+Funds'
)

CONFIG = CityConfig(
    city='Hendricks County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group — `innkeepers` is FY2023-FY2024 only
        'property', 'income', 'innkeepers', 'other',
        # the root `Other:` group — `contribution` is FY2023 only
        'contribution', 'miscellaneous',
    ),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
