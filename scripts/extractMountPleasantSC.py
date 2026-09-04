#!/usr/bin/env python3
"""
Town of Mount Pleasant, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 1. Documents come from the Federal Audit Clearinghouse by REPORT ID;
see scripts/data/scCityAcfrEntities.mjs.

⚠⚠ IT IS A TOWN, AND THAT IS PART OF ITS IDENTITY. The Census file calls it
`Mount Pleasant town` and its own filings say `TOWN OF MOUNT PLEASANT`.
`treasury_ensure_municipality` keys on (name, state, entity_type), so recording
it as a `city` would not be a cosmetic difference — it would be a different
government from the one that filed these statements.

⚠⚠ NOT `576001080 MOUNT PLEASANT WATERWORKS`, which is one digit from this
entity's own EIN `576001079` and files its own audited statements. A typo there
loads a real, related, WRONG government's money under the town's name and every
tie gate downstream still passes.

── COVERAGE: FY2018-FY2025 ─────────────────────────────────────────────────

FAC serves no filing under this EIN before FY2018. Declared as a coverage gap in
scCityAcfrEntities.mjs — never written as $0, never silently skipped.

── UNITS: WHOLE DOLLARS ────────────────────────────────────────────────────

The statement carries no "in thousands" caption and FY2024 prints General Fund
total revenues of 104,350,220 for a town of 95,604. ⚠ Read from the STATEMENT
page: the statistical section's "Changes in Fund Balances of Governmental Funds"
table is a different page with its own conventions and is outside the opinion.

── STRUCTURE, READ FROM GLYPH COORDINATES AND CONFIRMED BY ARITHMETIC ──────

    REVENUES                                    x=38   <- FLAT, no groups
        Property, Sales and Other Taxes         x=40
        Licenses and Permits                    x=40
        Intergovernmental                       x=40
        Fines and Forfeitures                   x=40
        Special Assessments                     x=40   <- printed EMPTY, see below
        Charges for Services                    x=40
        Rents and Royalties                     x=40
        Investment Earnings                     x=40
        Other Revenues                          x=40
    EXPENDITURES
        Current:                                x=40   <- parent
            General Government / Justice Department / Public Safety /
            Public Service / Engineering and Development Services /
            Planning, Land Use, and Neighborhoods / Culture and Recreation /
            Non Departmental                    x=47
        Capital Outlay                          x=40   <- root leaf
        Debt Service:                           x=40   <- parent
            Principal / Interest and Fiscal Charges

⚠ `revenue_parents` is deliberately EMPTY. Mount Pleasant prints no revenue
group headings at all — `Property, Sales and Other Taxes` is a single flat line,
not a `Taxes:` heading with children. Contrast Charleston in this same wave,
which groups twice. Inventing a parent here would publish structure the issuer
did not print.

FY2024 arithmetic, to the dollar:

    revenue leaves      50,499,849 + 40,378,168 + 4,553,064 + 592,780
                      + 5,478,443 + 316,238 + 2,296,315 + 235,363 = 104,350,220
    printed TOTAL REVENUES                                        = 104,350,220

    Current's eight children                                      =  87,651,769
    printed TOTAL EXPENDITURES                                    =  87,651,769

⚠ That second identity is the interesting one: `Current`'s children alone equal
the printed total, so the town's General Fund reports NO capital outlay and NO
debt service in FY2024 — the 39,435,253 and 238,769 on those rows belong to the
Capital Asset Fund column. `Capital Outlay` and `Debt Service` are still declared
here because they are real rows on the page that carry GF money in other years,
and a root leaf that is $0 is simply dropped.

── ⚠⚠ `Special Assessments` IS A LINE ITEM PRINTED EMPTY, NOT A WRAPPED LABEL ─

In FY2024 that row carries NO money and NO DASH in any column. The parser's
default reading of a valueless row is "first line of a two-line label", which is
right for most of this corpus — and here it would weld the row forward and
publish `Special Assessments Charges for Services` as one category, hanging
$5,478,443 off a label the town never printed. That is the Kent defect, which
cost ten published labels and, in one case, filed $193,673 of capital spending
inside Debt service. Declared in `empty_rows`.

⚠ A label listed in `empty_rows` only takes effect on a year where the row is
ACTUALLY valueless, so declaring it does not affect years in which the town
reports special assessment revenue.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Town of Mount Pleasant, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    empty_rows=('special assessments',),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
