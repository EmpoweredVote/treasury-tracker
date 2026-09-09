#!/usr/bin/env python3
"""
LaPorte County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 4 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

⚠⚠⚠ TWO YEARS, AND THEN THE COUNTY WENT BACK.

    FY2016-FY2018   SBOA regulatory basis
    FY2019, FY2020  GAAP — the two years loaded here
    FY2021-FY2023   ⚠ other_basis — A REVERSION, not a run-up
    FY2024          no filing at all

This is the Lake County shape in a second county, and it is the reason basis is
checked **per filing** rather than per era. A rule of the form "GAAP from FY2019
onward" — which held for all eight counties of waves 2 and 3 — would have loaded
three all-funds cash documents here under an `audited_gaap` label. The page
counts corroborate the reversion without reading a word: 190 and 186 pages for
the two GAAP years against 124, 127 and 137 for the three that follow.

⚠⚠ FAC RECORDS A MODIFIED OPINION IN BOTH LOADED YEARS — `disclaimer_of_opinion`
beside the unmodified one in FY2019, `qualified_opinion` in FY2020. Which units
those name is read out of each document and recorded in
`scripts/data/inCountyAcfrOpinions.mjs`.

── STRUCTURE, READ FROM THE PRINTED PAGE (both GAAP years) ──────────────────

    Revenues:
        Taxes:                               <- revenue parent
            Property / Income / Other
        Licenses and permits                 <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Other:                               <- a SECOND revenue parent
            Interest revenue / Other
    Expenditures:
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation
        Debt service:                        <- parent
            Principal / Interest / Bond issuance costs (FY2020)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and human services (FY2019) | Health and welfare (FY2020) /
            Culture and recreation (FY2020)

⚠⚠ `Other` APPEARS THREE TIMES ON ONE PAGE, AT TWO LEVELS: as the last member of
the `Taxes:` group, as the NAME of the root revenue group, and as the last member
of that group. All three are handled by one entry in `revenue_group_members` plus
one in `revenue_parents`, because the library separates a heading from a leaf by
VALUE — a valueless row opens a group, a valued one stays a leaf — not by
wording. This is the Vanderburgh FY2019 shape, and Hamilton County's
`Other:`-twice-on-one-page hazard (failure mode 13) is the version of it that
went wrong, so it is worth checking rather than assuming.

⚠ FY2019 relabels one capital-outlay leaf: `Health and human services` becomes
`Health and welfare` in FY2020. Both are LEAF labels under a declared parent, so
no config depends on the wording, and both load in the case the issuer printed.

⚠ Both years print `Revenues:` and `Expenditures:` WITH a colon — SBOA
typesetting. `norm_label` strips a trailing colon, so one config covers it.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents. FY2020's
printed total governmental revenue is 43,782,000-odd for a county of ~111,000.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='LaPorte County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group
        'property', 'income', 'other',
        # the root `Other:` group
        'interest revenue',
    ),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
