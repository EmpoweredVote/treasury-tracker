#!/usr/bin/env python3
"""
Tippecanoe County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 2 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Tippecanoe files GAAP for FY2019-FY2024. Its FY2016-FY2018 filings are State
Board of Accounts REGULATORY-BASIS reports with no governmental-funds statement
in them, declared in `IN_COUNTY_BASIS_GAPS`; FY2025 has not been filed yet.

── ⚠⚠⚠ THIS COUNTY PRINTS NO `Expenditures` CAPTION FROM FY2022 ─────────────

Its statement goes STRAIGHT from the `Total revenues` row to `Current:`. There
is no heading between them — confirmed by RENDERING page 23 of the FY2022 filing
to an image and reading it, not inferred from the absence of a word in
`-table` output. FY2019, FY2020 and FY2021 of the same county DO print it.

    FY2019  Revenues ... Total revenues   Expenditures   Current   ...
    FY2020  Revenues ... Total revenues   Expenditures   Current   ...
    FY2021  Revenues ... Total revenues   Expenditures   Current:  ...
    FY2022  Revenues ... Total revenues                  Current:  ...   <- gone
    FY2023  Revenues ... Total revenues                  Current:  ...
    FY2024  Revenues ... Total revenues                  Current:  ...

The library's own docstring had recorded that the expenditure section word is
NOT configurable because "every document in this corpus prints `Expenditures`
plural, including Boulder County, which is exactly why only one of the two is
configurable". That claim was about WORDING. This county breaks it by ABSENCE,
which needed a different answer: `expenditures_follow_revenue_total=True` takes
the section as the lines strictly between the printed revenue total and the
printed `Total expenditures`, and ONLY when no caption is found at all.

⭐ THIS ONE COULD NOT HAVE SHIPPED WRONG. With no caption and no fallback the
expenditure tree comes back EMPTY, so the tie gate fails with the entire printed
total as its delta — the loud failure that found it. It is not a member of the
"wrong tree at a $0 tie" family.

── ⚠⚠ FY2024 HAS TWO ACCEPTED FILINGS AND ONE OF THEM IS BROKEN ─────────────

`2024-12-GSAFAC-0000384819` is missing, ON THE PAGE THIS FILE READS, the
`Governmental Funds` sub-title, the date line, ALL THREE ROWS OF COLUMN
HEADINGS, the `Revenues` and `Taxes:` headings and THE WHOLE PROPERTY TAX ROW
($54,149,405 total governmental). The ink is genuinely absent — both PDFs were
rendered to images and compared. `2024-12-GSAFAC-0000397320` prints them, and is
also the later filing. The choice and its evidence live in
`IN_COUNTY_FILING_CHOICES`; `resubmission_status` says `most_recent` on both.

── STRUCTURE, READ FROM THE PRINTED PAGE (all six GAAP years) ───────────────

    Revenues
        Taxes:                               <- revenue parent
            Property / Income / Other
        Licenses and permits                 <- root sources resume here
        Intergovernmental
        Charges for services
        Fines and forfeits
        Investment earnings   (FY2022+: `Investment earnings (loss)`)
        Other:                               <- a SECOND revenue parent
            Miscellaneous
    Expenditures                             <- ABSENT FY2022 onward
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation
        Debt service:                        <- parent
            Principal / Interest / Capital lease (to FY2021) /
            Finance purchase agreements (FY2022+) / Leases (FY2023+)
        Capital outlay:                      <- parent, NOT a root leaf
            General government / Public safety / Highways and streets /
            Health and welfare / Culture and recreation

⚠ FY2019 and FY2020 print `Current`, `Debt service` and `Capital outlay` with NO
colon; `norm_label` strips a trailing colon either way, so one `parents` tuple
covers both eras.

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF IN MARION'S AND ST.
JOSEPH'S DOCUMENTS. Copying either county's `root_leaves` would reparent five
children onto the root **while the statement still tied to the cent** — failure
mode 2, which wave 1 hit in three separate costumes.

⚠⚠ `revenue_group_members` MUST NAME EVERY MEMBER of the `Taxes:` group. The
library closes an open group on the first row that is not a member, so an
incomplete list silently REPARENTS the rest to the tree root at a $0 tie
(failure mode 1). `Licenses and permits` is the row that must close it.

⚠ FY2020 prints `Miscellaneous` as a ROOT source with no `Other` heading over
it. That is handled by the same list: the `Taxes:` group has already been closed
by `Licenses and permits`, so nothing is open and the row lands at root, where
the issuer put it.

⚠ `revenue_subparents` is DELIBERATELY NOT SET, and that is a statement about
these six documents rather than a copy of Hamilton's config. Hamilton needs it
because it prints a VALUELESS `Other:` sub-heading INSIDE `Taxes:`; Tippecanoe's
in-`Taxes` `Other` always carries a value, so it is a leaf, and the root `Other:`
only ever arrives after `Licenses and permits` has closed the tax group. Setting
it here would be inert config that reads as protection.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on these documents, not
carried from another entity — and FY2024's printed total governmental revenue is
157,570,713 for a county of ~192,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ Requires "Governmental Funds" — failure mode 10. The county wraps the title
# after `Fund Balances -` in some years and keeps it on one line in others, so
# the gap is spanned rather than assumed.
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund'
    r'\s+Balances[\s\S]{0,200}?Governmental\s+Funds'
)

CONFIG = CityConfig(
    city='Tippecanoe County, IN',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=(
        # the `Taxes:` group, all six years
        'property', 'income', 'other',
        # the root `Other:` group
        'miscellaneous',
    ),
    # ⚠⚠ FY2022-FY2024 print no expenditure caption at all. See the docstring.
    expenditures_follow_revenue_total=True,
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
