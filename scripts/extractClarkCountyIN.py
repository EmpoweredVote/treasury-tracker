#!/usr/bin/env python3
"""
Clark County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 4 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

⚠⚠⚠ CLARK'S GAAP RUN OPENS AT **FY2021**, NOT FY2019, AND THE TWO YEARS IN
BETWEEN ARE A FRAMEWORK THIS ROUTE HAD NOT MET.

    FY2016-FY2018   SBOA regulatory basis        (sp_framework_basis=regulatory_basis)
    FY2019, FY2020  ⚠ CASH BASIS                 (sp_framework_basis=cash_basis)
    FY2021-FY2024   GAAP — the four years loaded here

⭐ Clark's FY2019 and FY2020 filings are the **ONLY TWO `cash_basis` filings
among all 562 Indiana county filings**. An FY2019 window carried over from waves
2 and 3 would have read two cash-basis documents here and labelled them
`audited_gaap`. The page counts corroborate it independently, without reading a
word: 73 and 59 pages for FY2019/FY2020 against 161, 159, 159 and 159 for the
four GAAP years.

⚠⚠ FAC RECORDS A MODIFIED OPINION IN ALL FOUR LOADED YEARS — `gaap_results`
carries `adverse_opinion` and `disclaimer_of_opinion` beside the unmodified one
in FY2021, FY2023 and FY2024, and adds `qualified_opinion` in FY2022. Which
opinion units those name, and whether any is one this column is built from, is
read out of each document and recorded in `scripts/data/inCountyAcfrOpinions.mjs`.
Extraction is a separate question from grading and neither answers the other.

── STRUCTURE, READ FROM THE PRINTED PAGE (all four GAAP years) ──────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Other (FY2023 only)
        Licenses and permits                 <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Investment earnings
        Other:                               <- a SECOND revenue parent
            Miscellaneous
    Expenditures
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation (FY2023)
        Debt service:                        <- parent
            Principal / Interest / Capital lease (FY2021)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare

⚠ `Other` is a member of the `Taxes:` group in FY2023 ONLY and the NAME of the
root revenue group in all four years. Both spellings are the same word and the
library separates them by VALUE, not by level: a valueless row opens a group, a
valued one stays a leaf.

⚠ FY2024 prints a row whose LABEL IS MISSING between `Capital outlay > Highways
and streets` and `Total expenditures` — `-table` renders it as a bare pair of
dashes. It is dash-zero in every column, so it contributes nothing and the
statement ties at $0 with it dropped. ⚠ Had it carried a value the library would
have REFUSED with `row has a value but no usable label`, which is the correct
behaviour and the reason this is a note rather than a config entry.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents. FY2024's
printed total governmental revenue is 36,911,222 for a county of ~127,000.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Clark County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=('property', 'income', 'other', 'miscellaneous'),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
