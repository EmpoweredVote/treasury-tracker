#!/usr/bin/env python3
"""
City of Charleston, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 1. Documents come from the Federal Audit Clearinghouse by REPORT ID;
see scripts/data/scCityAcfrEntities.mjs.

⚠⚠ NOT any of the 50 distinct (EIN, name) pairs a FAC name search for
`*charleston*` returns in South Carolina. The near misses include COLLEGE OF
CHARLESTON, CHARLESTON SOUTHERN UNIVERSITY, HOUSING AUTHORITY OF THE CITY OF
CHARLESTON, CHARLESTON COUNTY SCHOOL DISTRICT, COUNTY OF CHARLESTON and
CHARLESTON WINE & FOOD FESTIVAL — and, one digit from the right answer,
**576000227 Commissioners of Public Works of the City of Charleston** against
the city's own **576000226**. The EIN is the join; the name never is.

── ⚠⚠ THE FISCAL YEAR IS THE CALENDAR YEAR ─────────────────────────────────

Charleston's fiscal year ends DECEMBER 31, in all ten federal filings. Every one
of South Carolina's 46 counties runs July, and so do North Charleston and Mount
Pleasant in this same wave — so the state norm is exactly the wrong default here.
`fy_end=('December', 31)`.

── UNITS: WHOLE DOLLARS ────────────────────────────────────────────────────

No statement page carries an "in thousands" caption, and FY2024 prints General
Fund total revenues of 260,132,887 — already whole dollars for a city of 157,665.

⚠ The STATISTICAL SECTION is a different matter: Table 4, "Changes in Fund
Balances of Governmental Funds", prints "(amounts expressed in thousands)". That
table is outside the auditor's opinion and is not what this reads. Reading a
units caption off the wrong page is how a silently 1000x-wrong row ships, and the
tie gate cannot see it — the caption must come from the STATEMENT page.

── STRUCTURE, READ OFF THE PAGE AND CONFIRMED BY ARITHMETIC ────────────────

⚠ `pdftotext -layout` is UNUSABLE on this document — it emits the label column
and the numeric columns as separate blocks and pairs each label with another
row's money (the Charlotte defect). The structure below was read from pdfplumber
GLYPH X-COORDINATES and then confirmed by adding the leaves up.

    Revenues                                        x=60
        Taxes                                       x=69   <- parent, no value
            Property, net of tax increment ...      x=79
            Tax increment financing districts       x=79
            Other                                   x=79
        Licenses, fees and permits                  x=69
        Fines and forfeitures                       x=69
        Intergovernmental-federal                   x=69
        Intergovernmental-state and local           x=69   <- parent, no value
            Local option sales tax                  x=79
            Other                                   x=79
        Charges for services                        x=69
        Revenues from use of money and property     x=69
        Donations and settlements                   x=69
        Other                                       x=69
    Expenditures
        Current                                     x=69   <- parent
            General government ... Business development and assistance
        Capital outlay                              x=69   <- ROOT LEAF, between the parents
        Debt service                                x=69   <- parent
            Principal retirement / Interest and fiscal charges

FY2024 arithmetic, to the dollar, on both sides:

    revenue leaves     126,140,133 + 77,422,858 + 1,034,488 + 883,953
                     + 33,454,982 + 8,396,253 + 3,606,257 + 7,459,174
                     + 369,457 + 1,365,332                 = 260,132,887
    printed Total revenues                                 = 260,132,887

    expenditure leaves 47,778,766 + 134,182,296 + 19,067,967 + 5,446,681
                     + 31,322,199 + 1,521,755 + 1,100,537 + 887,345
                     + 11,779,496 + 15,073,257 + 1,897,321  = 270,057,620
    printed Total expenditures                             = 270,057,620

⚠⚠ TWO REVENUE GROUPS, NOT ONE, AND THE SECOND IS THE SURPRISING ONE.
`Intergovernmental-state and local` is a HEADING with no value of its own,
holding `Local option sales tax` and `Other`. That is correct for South Carolina
— the Local Option Sales Tax is levied by the county, collected by the state and
distributed back, so the issuer files it as state/local intergovernmental
revenue rather than as an own-source tax. Missing this heading does not change a
single dollar and still ties at $0; it would just publish
`Intergovernmental-state and local Local option sales tax` as one welded label
and hang $41.8M of revenue off the wrong node.

⚠ `revenue_group_members` closes both groups in the right place. The tax group's
members end in `districts` or are `Other`; the intergovernmental group's end in
`sales tax` or are `Other`. The first row after each group — `Licenses, fees and
permits` and `Charges for services` respectively — matches none of the three, so
each group closes exactly where the issuer closed it.

⚠ `Other` is printed THREE TIMES in the revenue section: once inside Taxes, once
inside Intergovernmental-state and local, and once at root. They are different
line items at different levels, so they do not collide as siblings — but a group
that failed to close would make two of them siblings and silently merge them,
since `budget_categories.link_key` is the lowercased name joined to its
ancestors.

── ⚠ THE BUDGETARY SCHEDULE IS A TRAP, AND IT IS IN THIS DOCUMENT ──────────

Page 123 of the FY2024 report is `SCHEDULE OF REVENUES, EXPENDITURES AND CHANGES
IN FUND BALANCE BUDGET AND ACTUAL - GENERAL FUND`. Loading it would put
budget-basis figures under a GAAP-actual label. The library's `_EXCLUDE` list
('budgetary', 'budget and actual', 'combining', ...) disqualifies that page; it
is not weakened here.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Charleston, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=('taxes', 'intergovernmental-state and local'),
    revenue_group_members=('districts', 'other', 'sales tax'),
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
