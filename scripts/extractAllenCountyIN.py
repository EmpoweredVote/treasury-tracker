#!/usr/bin/env python3
"""
Allen County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 1 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

── ⚠⚠ THE COVER SAYS "ANNUAL FINANCIAL REPORT", AND IT IS STILL GAAP ───────

Allen County's document is issued by the Indiana State Board of Accounts under
the plain title `ALLEN COUNTY GOVERNMENT — ANNUAL FINANCIAL REPORT`, not
`Annual Comprehensive Financial Report`. That cover is NOT the basis signal:
the report carries Government-Wide Financial Statements, a Balance Sheet -
Governmental Funds and an MD&A, i.e. the full GASB 34 presentation, and FAC's
own metadata records it as GAAP (`gaap_results` carries an opinion and
`sp_framework_basis` is empty) in all ten years.

⚠⚠ THE COVER TITLE IS THE WRONG TEST, AND LAKE COUNTY PROVES IT BOTH WAYS.
Lake County's filings carry an SBOA cover too — and six of its eight are
`Statement of Receipts, Disbursements, and Cash and Investment Balances -
REGULATORY BASIS`, which is Gateway's cash data with an opinion on it, not a
governmental-funds statement at all. Basis is read from the STATEMENTS (and
corroborated against FAC's metadata), never from the cover.

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

    Revenues:                                <- FLAT, no grouping
        Taxes / Special assessments / Licenses and permits / Intergovernmental /
        Charges for services / Fines and forfeits / Other
    Expenditures:
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Sanitation / Economic development / Health and welfare /
            Culture and recreation
        Debt service:                        <- parent
            Principal / Interest
        Capital outlay:                      <- parent, NOT a root leaf
            Economic development / General government / Public safety /
            Highways and streets / Special assessment

⚠ `revenue_parents` is deliberately EMPTY: Allen prints `Taxes` as a single
valued line, not as a heading over Property/Income/Excise the way Hamilton does.
Inventing a `Taxes:` parent here would be structure the issuer did not print.

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF IN MARION'S DOCUMENT.
Twenty counties in one state do not share a chart of accounts. Declaring it as a
`root_leaves` entry copied from the neighbouring wrapper would reparent five
children onto the tree root **while the statement still tied to the cent** —
failure mode 2 in the extractor how-to.

⚠ Four category names appear TWICE, once under `Current:` and once under
`Capital outlay:` (General government, Public safety, Highways and streets,
Economic development). That is the issuer's own presentation and the tree keeps
both; they are distinguishable by their parent.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on this document, not
carried from another entity — and FY2024's printed total governmental revenue is
324,150,411 for a county of ~399,000.  `units=1` (the default).

── ⚠ FIVE FUND COLUMNS IN FY2024, AND THE COUNT MOVES BY YEAR ──────────────

FY2024 prints General, Local Income Tax - Economic Development, ARP Coronavirus
Local Recovery, Correctional Facility Building Fund, Allen County Indiana
Building Corporation, Other Governmental and Total Governmental. The major-fund
set changes with the county's own major-fund determination, which is why
`target_column='last'` resolves against the columns actually present rather than
against an index.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ Requires "Governmental Funds" — failure mode 10. A looser anchor can match a
# General-Fund-only statement, which `target_column='last'` would read happily,
# returning the General Fund under a total-governmental label at a $0 tie.
#
# ⚠⚠ `\s*,?\s*` AROUND BOTH COMMAS, matching the library's `_TITLE`. Allen's own
# FY2016-FY2022 title prints `EXPENDITURES ,AND` — the comma on the wrong side of
# the space. A comma-then-space assumption silently loses seven of ten years to
# `primary GF statement not found`.
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund'
    r'\s+Balances[\s\S]{0,200}?Governmental\s+Funds'
)

CONFIG = CityConfig(
    city='Allen County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
