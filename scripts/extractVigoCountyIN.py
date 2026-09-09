#!/usr/bin/env python3
"""
Vigo County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 4 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

⚠⚠⚠ FOUR YEARS, AND THEN VIGO WENT BACK TOO.

    FY2016, FY2017  SBOA regulatory basis
    FY2018          no filing at all
    FY2019-FY2022   GAAP — the four county-years loaded here
    FY2023, FY2024  ⚠ other_basis — the SECOND reversion in this wave, both
                    filings accepted on the same day (2025-09-25)

⚠⚠ **FOUR COUNTY-YEARS, FIVE GAAP FILINGS.** FY2022 carries TWO accepted FAC
filings, so a count of GAAP FILINGS says five where a count of GAAP YEARS says
four. The route's own ceiling table said "Vigo 5/9" and that figure was
FILINGS — see `IN_COUNTY_FILING_CHOICES['vigo-2022']` for which document is read
and why, and the wave-4 note in `IN_COUNTY_SERIES_NOTES` for the arithmetic.

── ⚠⚠ TWO CHARTS OF ACCOUNTS IN FOUR YEARS ─────────────────────────────────

    FY2019, FY2020 (SBOA typesetting)

        Revenues                             <- ⚠ NO revenue groups at all
            Taxes                            <- a VALUED ROOT LEAF
            Licenses and permits / Intergovernmental /
            Charges for services / Fines and forfeits
            Other                            <- also a VALUED ROOT LEAF

    FY2021, FY2022 (the county's own typesetting)

        Revenues
            Taxes:                           <- a group appears
                Property / Income / Food and beverage / Innkeepers
            Licenses and permits / Intergovernmental /
            Charges for services / Fines and forfeits / Investment earnings
            Other:                           <- a second group
                Miscellaneous

⚠⚠ `Taxes` AND `Other` ARE EACH A VALUED ROOT LEAF IN TWO YEARS AND A GROUP
HEADING IN TWO. Naming both in `revenue_parents` cannot damage FY2019 or FY2020:
the library opens a group only on a row with NO value, so the valued early lines
stay leaves. This is the Johnson County shape on the revenue side.

── EXPENDITURES: ONE SHAPE, ALL FOUR YEARS ─────────────────────────────────

    Current:                                 <- parent
        General government / Public safety / Highways and streets /
        Health and welfare / Culture and recreation
    Debt service:                            <- parent
        FY2019:  Principal / Interest / Capital leases / Interest on debt /
                 Bond issuance costs
        FY2020:  Principal / Interest / Capital leases
        FY2021+: Principal / Interest and fiscal charges / Capital lease
    Capital outlay:                          <- parent, NOT a root leaf
        General government / Public safety / Highways and streets /
        Culture and recreation / Health and welfare (FY2020)

⚠ FY2019 prints FIVE debt-service leaves including BOTH `Interest` and `Interest
on debt`, which are two printed lines and are loaded as two. Normalising them
onto one another would be inferring intent.

⚠ Several rows are dash-zero in every column in FY2019 and FY2020 (the SBOA
template prints a dash rather than leaving a cell blank). The library's dash-zero
handling drops them at $0, which is why the leaf counts differ across the series
without any figure moving.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents. FY2021's
printed total governmental revenue is 39,168,16x for a county of ~106,000.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Vigo County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group, FY2021-FY2022 only
        'property', 'income', 'food and beverage', 'innkeepers',
        # the root `Other:` group
        'miscellaneous',
    ),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
