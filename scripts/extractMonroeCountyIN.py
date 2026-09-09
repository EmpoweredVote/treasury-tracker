#!/usr/bin/env python3
"""
Monroe County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 3 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Monroe files GAAP for FY2019-FY2024. Its FY2016-FY2018 filings are State Board
of Accounts REGULATORY-BASIS reports (`IN_COUNTY_BASIS_GAPS`); FY2025 has not
been filed yet.

⚠⚠ MONROE IS THE COUNTY THAT FILES UNDER TWO EINs — 351732465 for FY2016 and
351732462 for every filing from FY2017 — the Indiana shape that SPLITS a series
if anything joins on the EIN. Nothing in this route does: identity is the roster
county. Extraction never sees an EIN at all; it is recorded as evidence in
`scripts/data/inCountyAcfrEntities.mjs` and asserted against the roster.

── STRUCTURE, READ FROM THE PRINTED PAGE (all six GAAP years) ───────────────

⚠ THE EXPENDITURE ORDER IS `Current` -> `Capital Outlay` -> `Debt Service`, not
the Current/Debt/Capital of every other county in this family. Order does not
matter to the parser — each heading opens its own group — but it is the reason
the tuple below is written in the printed order rather than copied.

    Revenues                                 <- ⚠ FLAT. NO GROUPS, ALL SIX YEARS
        FY2019-FY2021:  Taxes / Intergovernmental / Interest (FY2020+) /
                        Licenses and Permits / Fines and Forfeitures /
                        Charges for Services / Other Revenues
        FY2022+:        Property Taxes / Excise/Commercial Vehicle Excise /
                        Innkeepers Taxes / Local Income Tax (LIT) Certified
                        Shares (FY2023+) / LIT for Special Purposes / LIT for
                        Public Safety / LIT for Economic Development (FY2023+) /
                        LIT for Jail (FY2024) / Food & Beverage Taxes /
                        Other Taxes / Intergovernmental / Licenses & Permits /
                        Fines & Forfeitures / Charges for Services /
                        Other Revenues / Unrestricted Investment Earnings /
                        Miscellaneous Refunds & Reimbursements
    Expenditures
        Current:                             <- parent
            General Government / Public Safety / Highway and Streets /
            Health and welfare / Economic Development / Culture and Recreation
        Capital Outlay (FY2019-FY2021) | Capital Outlay: (FY2022+)   <- parent,
            over the SAME six function names
        Debt Service:                        <- parent
            Principal Retirement | Principal and Capital Lease Retirement
                (FY2021) / Interest and Fiscal Charges

⚠⚠ **`revenue_parents` IS EMPTY AND THAT IS A MEASURED DECISION, NOT AN
OVERSIGHT.** Monroe's FY2022+ statement prints ELEVEN tax lines with NO `Taxes:`
heading over them — `Property Taxes`, `Innkeepers Taxes`, four `Local Income Tax
(LIT) for ...` lines, `Food & Beverage Taxes`, `Other Taxes`. Declaring a
`taxes` parent here would match nothing (the library opens a group on an EXACT
label), and declaring a suffix rule to gather them would INVENT a heading the
county does not print. The county expanded its own revenue chart from 6 lines to
16 between FY2021 and FY2022 and never grouped them; loaded as published.

⚠ FY2019-FY2021 print `Capital Outlay` with NO colon and FY2022+ with one;
`norm_label` strips a trailing colon, so one tuple covers both. The same is true
of `Health and welfare` -> `Health and Welfare` (FY2021), which is a LEAF label
and is loaded in the case the issuer printed it.

⚠ The printed subtotal labels are `Total Revenues` and `Total Expenditures` with
capitals. The library squashes and lowercases both sides of those membership
tests (failure mode 9), so no override is needed — but the capitals are the
reason to say so rather than to assume it.

── NO `statement_anchor` ────────────────────────────────────────────────────

⚠ `find_statement_page` ORs the anchor with the title, so an anchor can only
WIDEN the candidate set, never require anything. All six documents are located
by the title alone.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Monroe County, IN',
    # ⚠ In the order the county prints them — see the note above.
    parents=('current', 'capital outlay', 'debt service'),
    root_leaves=(),
    # ⚠⚠ EMPTY ON PURPOSE. Monroe prints no revenue group in any year.
    revenue_parents=(),
    revenue_group_members=(),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
