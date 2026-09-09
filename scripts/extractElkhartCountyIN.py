#!/usr/bin/env python3
"""
Elkhart County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 2 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Elkhart files GAAP for FY2019-FY2024. Its FY2016-FY2018 filings are State Board
of Accounts REGULATORY-BASIS reports with no governmental-funds statement in
them, declared in `IN_COUNTY_BASIS_GAPS`; FY2025 has not been filed yet.

⚠⚠ FAC RECORDS A QUALIFIED OPINION for FY2020 and FY2021, and for FY2021 the
`gaap_results` field carries `qualified_opinion` and NOTHING ELSE — the same
under-reporting shape as Allen County FY2016/FY2017, where the metadata omitted
the unmodified opinions the document plainly gives. The DOCUMENT is the
authority; what each auditor actually said is recorded per entity-year in
`scripts/data/inCountyAcfrOpinions.mjs`.

── ⚠⚠⚠ FY2024's TITLE IS TRUNCATED BY THE ISSUER ────────────────────────────

Every other Elkhart year prints the statement title in full. FY2024 prints:

    Statement of Revenues, Expenditures and Changes in Fund Balances -
    Year Ended December 31, 2024

The `Governmental Funds` line that the dash introduces IS NOT THERE. The dash
dangles. Confirmed against the rendered page and against `pdftotext -layout`,
which agrees; the words do not appear anywhere on the page as an adjacent pair,
because the column captions split `Governmental` and `Funds` onto separate
lines. This is Allen County's `EXPENDITURES ,AND` in a second costume — failure
mode 12, THE ISSUER'S OWN TYPO IN ITS OWN TITLE.

So the anchor names BOTH shapes and nothing else:

    branch 1  ... Fund Balances  <up to 200 chars>  Governmental Funds
    branch 2  ... Fund Balances - <newline> [For The] Year Ended

⚠ Branch 2 is deliberately narrow. It requires the DANGLING DASH followed
immediately by the period caption, which is exactly what FY2024 prints, rather
than relaxing branch 1 into "the words are optional" — a relaxation would let a
General-Fund-only statement qualify, which is failure mode 10 and the thing the
anchor exists to prevent. The remaining protection for FY2024 is the library's
`_EXCLUDE` list (which rejects budgetary, combining and nonmajor pages), the
earliest-qualifying-page rule, and the printed `Total Governmental Funds` column
caption on the page itself.

── STRUCTURE, READ FROM THE PRINTED PAGE (all six GAAP years) ───────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Other
        Intergovernmental                    <- root sources resume here
        Charges for services
        Fines and forfeits
        Investment Income (FY2019-FY2020) / Investment earnings (FY2021+)
        Other  (FY2019-FY2020: a VALUED ROOT LEAF)
        Other: (FY2021+: a SECOND revenue parent)
            Miscellaneous
    Expenditures
        Current:                             <- parent
            General government / Public safety /
            Highways and Streets (FY2019-FY2020) / Highways and streets (FY2021+) /
            Health and welfare / Culture and recreation
        Debt service:                        <- parent
            Principal / Interest / Bond Issuance Costs (FY2020) /
            Capital lease (FY2021) / Lease and financed purchases (FY2022+) /
            Bond issue costs (FY2022)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation

⚠ ELKHART IS THE ONLY WAVE-2 COUNTY WITH NO `Licenses and permits` LINE, so the
row that closes its `Taxes:` group is `Intergovernmental`. The close is driven
by `revenue_group_members` naming every member, not by knowing which row comes
next — but it is worth recording that the three counties differ here.

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF IN MARION'S AND ST.
JOSEPH'S DOCUMENTS. Copying either county's `root_leaves` reparents five
children onto the root **while the statement still ties to the cent** — failure
mode 2, which wave 1 hit in three separate costumes.

⚠ `Highways and Streets` (capital S) in FY2019-FY2020 and `Highways and streets`
from FY2021 are BOTH LOADED AS PUBLISHED, in the case the issuer used. Silently
case-folding one onto the other would be normalising two presentations onto one
another, which is inferring intent — the Milledgeville rule.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on these documents, not
carried from another entity — and FY2024's printed total governmental revenue is
248,238,217 for a county of ~207,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠⚠ TWO BRANCHES, ONE PER PRINTED SHAPE — see the module docstring. Branch 2
# exists only because FY2024's title stops at the dash.
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund'
    r'\s+Balances'
    r'(?:[\s\S]{0,200}?Governmental\s+Funds'
    r'|\s*[-‐-―]\s*\n\s*(?:For\s+The\s+)?Year\s+Ended\s+December)'
)

CONFIG = CityConfig(
    city='Elkhart County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group, all six years
        'property', 'income', 'other',
        # the root `Other:` group, FY2021 onward
        'miscellaneous',
    ),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
