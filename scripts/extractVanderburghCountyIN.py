#!/usr/bin/env python3
"""
Vanderburgh County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 3 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Vanderburgh files GAAP for FY2019-FY2024. Its FY2016-FY2018 filings are State
Board of Accounts REGULATORY-BASIS reports with no governmental-funds statement
in them, declared in `IN_COUNTY_BASIS_GAPS`; FY2025 has not been filed yet.

⭐ THE MOST UNIFORM COUNTY IN THE WAVE. All six years print the same three
expenditure parents and the same two revenue groups, across the FY2020->FY2021
change of presentation that reshaped Johnson's and Porter's statements. The only
drift is inside the root `Other:` revenue group and in the debt-service leaves.

── STRUCTURE, READ FROM THE PRINTED PAGE (all six GAAP years) ───────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Other
        Licenses and permits                 <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Investment earnings                  (FY2021+)
        Other:                               <- a SECOND revenue parent
            FY2019-FY2020: Interest revenue / Sale of property /
                           Donations / Other
            FY2021+:       Donation / Miscellaneous
    Expenditures
        Current:                             <- parent
            General government / Public safety / Economic development /
            Highways and streets / Health and welfare / Culture and recreation
        Debt service:                        <- parent
            Principal / Interest / Lease principal (FY2023+) /
            Subscription principal (FY2023+) /
            Loan/Bond issuance costs (FY2023)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare / Economic development / Culture and recreation

⚠⚠ `Other` IS A TAX LINE **AND** THE NAME OF A REVENUE GROUP, ON THE SAME PAGE,
IN EVERY YEAR — and in FY2019-FY2020 it is ALSO the last member of that group.
One config covers all three uses, and not by luck: the library opens a group only
on a row with NO value, so the valued tax line and the valued `Other` inside the
group both stay leaves while the valueless `Other:` heading opens the group.
This is Hamilton County's `Other:`-twice-on-one-page hazard (failure mode 13)
with the levels reversed, and what separates the two here is the VALUE, not the
level.

⚠ `revenue_group_members` names `donations` AND `donation` in full. The list is
matched as label SUFFIXES, and `donations` does not end in `donation`, so the
FY2019-FY2020 plural and the FY2021+ singular are two separate declarations. A
member missing from the list closes its group early and silently reparents every
later sibling to the tree root — at a $0 tie (failure mode 1).

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF IN MARION'S, ST. JOSEPH'S
AND JOHNSON'S DOCUMENTS. Copying either shape reparents its six children onto
the root **while the statement still ties to the cent** — failure mode 2.

⚠ FY2019 and FY2020 print `Revenues:` and `Expenditures:` WITH a colon and are
typeset by the State Board of Accounts; FY2021 onward print them without one and
are typeset by the county. `norm_label` strips a trailing colon, so one config
spans the change of preparer.

── NO `statement_anchor` ────────────────────────────────────────────────────

⚠⚠ DELIBERATELY ABSENT, and measured rather than assumed: `find_statement_page`
matches `_TITLE.search(pg) OR anchor.search(pg)`, so an anchor can only WIDEN
which pages qualify — it cannot require anything. All six documents are located
by the title alone. What actually keeps a budgetary or combining page out is
`_EXCLUDE`, the earliest-page rule, the tie gate and the root-label check.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on these documents, not
carried from another entity — and FY2024's printed total governmental revenue is
210,299,051 for a county of ~180,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Vanderburgh County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group
        'property', 'income', 'other',
        # the root `Other:` group — FY2019-FY2020 spellings ...
        'interest revenue', 'sale of property', 'donations',
        # ... and FY2021+
        'donation', 'miscellaneous',
    ),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
