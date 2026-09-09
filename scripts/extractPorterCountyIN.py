#!/usr/bin/env python3
"""
Porter County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 3 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Porter files GAAP for FY2019-FY2024. Its FY2016-FY2018 filings are State Board
of Accounts REGULATORY-BASIS reports with no governmental-funds statement in
them (`IN_COUNTY_BASIS_GAPS`); FY2025 has not been filed yet.

⚠⚠⚠ **FY2022 IS A DOCUMENT GAP — THREE PUBLISHERS, THREE FILES, ALL IMAGE-ONLY
ON THE STATEMENTS.** See `KNOWN_DOCUMENT_GAPS` in
`scripts/extractInCountiesAll.mjs` for the evidence. Five loadable years, not
six, and the missing one is REPORTED, never interpolated and never a $0.

── ⚠⚠ TWO CHARTS OF ACCOUNTS IN ONE SERIES ─────────────────────────────────

Porter changed preparer and presentation between FY2021 and FY2023, and the two
eras do not print the same statement. ONE config has to read both.

    FY2019-FY2021 (State Board of Accounts typesetting)

        Revenues:                            <- ⚠ NO revenue groups at all
            Property Taxes / Other taxes / Other assessments /
            Fines and forfeitures / Licenses and permits /
            Intergovernmental / Charges for services /
            Other receipts (FY2019, FY2021) | Other revenues (FY2020)
        Expenditures:
            Current: / Debt Service: / Capital Outlay:   <- three parents,
                each over the same six functions (General Government,
                Public Safety, Storm Water and Development, Highway, Roads,
                and Streets, Public Health, Culture and Recreation)

    FY2023-FY2024 (the county's own typesetting)

        Revenues
            Taxes:                           <- a revenue group appears
                Property / Income / Other
            Special assessments / Licenses and permits / Intergovernmental /
            Charges for services / Fines and forfeits /
            Investment earnings (FY2024)
            Other:                           <- a second revenue group
                Contribution (FY2024) / Miscellaneous
        Expenditures
            Current:                         <- Stormwater joins the functions
            Debt service:
                Principal / Interest / Finance purchase agreements /
                Bond issue costs
            ⚠ NO `Capital outlay` SECTION AT ALL in either year.

⚠⚠ THE FLAT EARLY YEARS ARE WHY `revenue_parents` IS SAFE HERE, and it is worth
saying why rather than trusting it: the group-open branch matches the label
EXACTLY, and no FY2019-FY2021 row is exactly `Taxes` or `Other` — they are
`Property Taxes`, `Other taxes`, `Other assessments`, `Other receipts`. A PREFIX
or SUFFIX rule in that position would have opened a group on `Other taxes` and
swallowed the rest of the revenue section at a $0 tie.

⚠ `capital outlay` stays in `parents` even though FY2023 and FY2024 do not print
it. A parent that never matches costs nothing; removing it would silently
reparent six FY2019-FY2021 capital lines into whatever section was last open.

── NO `statement_anchor` ────────────────────────────────────────────────────

⚠ `find_statement_page` ORs the anchor with the title, so an anchor can only
widen the candidate set. All five readable documents are found by title alone —
including FY2019, whose page carries the SBOA's own banner in the same text
block as the title.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents. FY2024's
printed total governmental revenue is 51,642,000-odd for a county of ~176,000.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Porter County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group, FY2023-FY2024 only
        'property', 'income', 'other',
        # the root `Other:` group
        'contribution', 'miscellaneous',
    ),
    fy_end=('December', 31),
    target_column='last',
    # ── ⚠⚠ THE COUNTY'S OWN STATEMENT IS OUT BY A DOLLAR, AND THE COLUMN THAT
    # IS WRONG IS THE GENERAL FUND, NOT THE ONE THIS ROUTE READS ─────────────
    #
    # FY2020 operating, PDF page 26. The Total Governmental Funds column adds
    # up as:  Current  43,673,676 + 18,670,241 + 5,705,042 + 6,114,213
    # + 2,919,402 + 1,173,126 = 78,255,700;  Debt Service  4,470,000
    # + 1,902,119 = 6,372,119;  Capital Outlay  9,360,862 + 3,595,306
    # + 9,814,955 + 6,237,906 + 108,365 + 144,839 = 29,262,233. Sum
    # **113,890,052**; the page prints `Total expenditures` **113,890,053**.
    #
    # ⭐ THE SOURCE OF THE DOLLAR WAS LOCATED, NOT ASSUMED. Every ROW ties
    # across the funds (26,167,098 + 4,548,296 + 12,958,282 = 43,673,676, and so
    # on for all fourteen), and two of the three fund COLUMNS tie down their own
    # length — Foundation 5,763,393 and Other Governmental 65,876,163 both
    # exactly. The GENERAL FUND column does not: its fourteen printed lines sum
    # to 42,250,496 against a printed 42,250,497, and the Total column inherits
    # that dollar (42,250,497 + 5,763,393 + 65,876,163 = 113,890,053).
    #
    # ⚠ The same year's REVENUE side ties at exactly $0, which is what makes
    # this an artifact of the county's own footing rather than a mis-parse of
    # this page. An EXACT delta, never a tolerance: any other value still fails.
    source_rounding={
        (2020, 'operating'): -1,
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
