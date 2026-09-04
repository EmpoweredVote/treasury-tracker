#!/usr/bin/env python3
"""
City of Greenville, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 2. Documents come from the Federal Audit Clearinghouse by REPORT ID;
see scripts/data/scCityAcfrEntities.mjs.

⚠⚠ NOT any of the other 40 (EIN, name) pairs a FAC name search for
`*greenville*` returns in South Carolina: GREENVILLE COUNTY (576000356), THE
SCHOOL DISTRICT OF GREENVILLE COUNTY (576000234), GREENVILLE AIRPORT COMMISSION
(576000554), Greenville Water System (576000555), HOUSING AUTHORITY OF THE CITY
OF GREENVILLE (576000612), GREENVILLE TECHNICAL COLLEGE (570420667),
GREENVILLE-SPARTANBURG AIRPORT DISTRICT (570408425), GREENVILLE TRANSIT AUTHORITY
(570634283) and NORTH GREENVILLE UNIVERSITY (570314406).

⭐ Unlike Rock Hill in this same wave, this EIN is CLEAN — checked in the bulk
table rather than assumed: 10 filings, ONE auditee name, one fiscal year end.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption on the statement page; FY2024 prints General Fund total
revenues of 122,148,024 for a city of 74,371.

── STRUCTURE, READ FROM GLYPH COORDINATES ─────────────────────────────────

    REVENUES                                     x=38   <- FLAT, no groups
        Taxes / Fees, Charges and Rentals / Fines and Forfeitures /
        Licenses, Permits, and Franchise Fees / Grants / Intergovernmental /
        External Service Reimbursements / Investment Earnings /
        Other Revenues                           x=44
    EXPENDITURES
        Current:                                 x=44   <- parent
            Legislative/Administrative ... Other Expenditures    x=50
            (sixteen departmental children)
        Capital Outlay                           x=44   <- root leaf, valued
        Debt Service:                            x=44   <- parent
            Principal Retirement / Interest and Fiscal Charges   x=50

⚠⚠ `Taxes` IS A FLAT LEAF HERE AND A PARENT IN CHARLESTON. Greenville prints one
`Taxes` row carrying a value; Charleston prints `Taxes` as a heading over three
children. Declaring a revenue parent here would publish structure this issuer did
not print — and it would still tie at $0, because only the parenting would move.
That is the Seattle lesson (flat in one vintage, grouped in another) showing up
across two cities in one state rather than one city across time.

⚠ `Capital Outlay` is a valued ROOT LEAF here and a PARENT in Rock Hill, ninety
minutes up the interstate and in the same registry family. Read it per entity.

⚠ Section headings are printed in CAPITALS (`REVENUES`, `TOTAL EXPENDITURES`);
the library lowercases before matching, so the defaults apply unchanged.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Greenville, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
