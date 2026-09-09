#!/usr/bin/env python3
"""
Delaware County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 4 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Delaware files GAAP for **FY2020-FY2024** — one year later than the wave-2/3
pattern. FY2016-FY2019 are all special-purpose framework reports
(`IN_COUNTY_BASIS_GAPS`) and FY2025 has not been filed.

── ⚠⚠⚠ THE EIGHTEENTH FAILURE MODE: A STRAY TITLE FROM ANOTHER STATEMENT ────

**FY2023 read as `primary GF statement not found` on a document that passes all
four quality checks** (1,936 chars/page, 57.2% vocabulary, 0.0 welds, 81 numeric
statement pages). That symptom is the one the acfrGF how-to warns reads exactly
like OCR damage, and it was neither the document nor the parser: the county left
**the previous statement's page header on this page**.

    Statement of Net Position                      <- ⚠ THE WRONG TITLE, in bold
    Statement of Revenues, Expenditures and Changes  in  Fund Balances -
    Governmental Funds
    Year Ended December 31, 2023

`_EXCLUDE` contains `'net position'` so that a PROPRIETARY-funds statement can
never qualify — and here that guard, working exactly as designed, disqualified
the correct primary statement because of a typesetting slip in the issuer's own
header.

⭐ **CONFIRMED IN THE INK, NOT INFERRED FROM `-table`**: page 24 was rendered to
an image and read. The stray line is genuinely printed on the page.

`exclude_ignore=('net position',)` is the option that exists for exactly this,
and it is ENTITY-SCOPED and VALIDATED — `CityConfig` raises if the token named is
not in `_EXCLUDE`, so a typo cannot silently disable nothing.

⚠ MEASURED BEFORE SHIPPING, over all five of Delaware's GAAP documents: FY2020,
FY2021, FY2022 and FY2024 select the SAME page as before (23, 26, 25, 25) and
FY2023 goes from NOTHING FOUND to page 24. One-directional, which is the property
that makes a relaxation safe.

⚠⚠ AND IT DOES NOT WEAKEN WHAT THE EXCLUSION IS FOR. A proprietary statement
still cannot qualify here: it prints `Total Operating Revenues` beside `Total
Operating Expenses`, and this page gate independently requires the literal
`total expenditures`. The earliest-page rule, the tie gate and the root-label
check all still apply.

── STRUCTURE, READ FROM THE PRINTED PAGE (all five GAAP years) ──────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income
        Special assessments                  <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Investment earnings (FY2021+)
        Other:                               <- a SECOND revenue parent
            FY2020:    Interest revenue / Donations / Other
            FY2021+:   Donation / Miscellaneous
    Expenditures
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation / Economic development
        Debt service:                        <- parent
            FY2020:  Principal paid on bonds / Principal paid on capital
                     leases / Interest
            FY2021+: Principal / Interest / Bond issue costs /
                     Finance purchase agreements (FY2022+)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Economic development / Health and welfare / Culture and recreation

⚠ `Special assessments` is a ROOT LEAF and is what CLOSES the `Taxes:` group —
it is deliberately NOT in `revenue_group_members`. Adding it would swallow every
later root source into Taxes at a $0 tie (failure mode 1).

⚠ `revenue_group_members` names `donations` AND `donation`. The list is matched
as label SUFFIXES and `donations` does not end in `donation`, so the FY2020
plural and the FY2021+ singular are two separate declarations.

⚠ FY2020 prints `Total Revenues` and `Total Expenditures` with capitals; the
library squashes and lowercases both sides of those tests, so no override is
needed — but the capitals are the reason to say so rather than assume it.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Delaware County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group — ⚠ `special assessments` is NOT a member
        'property', 'income',
        # the root `Other:` group — FY2020 spellings ...
        'interest revenue', 'donations', 'other',
        # ... and FY2021+
        'donation', 'miscellaneous',
    ),
    fy_end=('December', 31),
    # ⚠⚠ FY2023 ONLY, and it is the reason this wrapper exists in this shape —
    # see the long note above. The county printed `Statement of Net Position`
    # above the real title of its governmental-funds statement.
    exclude_ignore=('net position',),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
