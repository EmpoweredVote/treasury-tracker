#!/usr/bin/env python3
"""
Johnson County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 3 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

Johnson files GAAP for FY2019-FY2024. FY2016 and FY2017 are State Board of
Accounts REGULATORY-BASIS reports (`IN_COUNTY_BASIS_GAPS`), **FY2018 has no
filing at all** (`IN_COUNTY_COVERAGE_GAPS` — a coverage gap outside the GAAP
window, so no loadable year is lost to it), and FY2025 has not been filed yet.

── ⚠⚠⚠ THE ONE PLACE IN THIS WAVE WHERE THE CONFIG CANNOT BE LITERAL ────────

Johnson prints THREE different expenditure hierarchies across six years, and no
single `CityConfig` reproduces all three. The deviation is declared here rather
than discovered later.

    FY2019, FY2020 — everything is INSIDE `Current`

        Current
            General government ... Health and welfare
            Debt Service                 <- ⚠ INDENTED INSIDE `Current`
                Principal
                Interest and fiscal charges
                Capital leases           (FY2020 only)
            Capital leases               (FY2019 only, back at function level)
            Issuance costs               (FY2019 only)
            Capital outlay               <- ⚠ ALSO a child of `Current`

    FY2021 — the standard three peers

        Current: / Debt service: / Capital outlay      (Capital outlay a
            valued ROOT LEAF, not a heading)

    FY2022, FY2023, FY2024 — ⚠ NO `Debt service` HEADING AT ALL

        Current:
            General government ... Culture and recreation
            Principal / Interest / Finance purchase agreements /
            Principal on leases (FY2022) / Bond issue costs (FY2022, FY2023)
        Capital outlay                   (root leaf; ABSENT in FY2024)

⚠⚠ **THE FY2019/FY2020 NESTING IS REAL, NOT A `-layout` ARTIFACT** — page 28 of
the FY2019 filing was RENDERED TO AN IMAGE and read. `Debt Service` genuinely
sits at the same indent as the `Current` functions, with its own two lines
indented under it, and `Capital outlay` sits at the function indent too. Taken
literally, the whole FY2019 expenditure statement is ONE `Current` group worth
68,677,440 — the entire printed total.

⚠⚠ **AND THE THREE OTHER SBOA-ERA COUNTIES OF THIS WAVE DISAGREE WITH IT.**
Vanderburgh, Porter and Monroe all print `Current` / `Debt service` / `Capital
outlay` as PEERS in their own FY2019 filings, so this is Johnson's typesetting,
not the State Board of Accounts template.

⭐ **THE CHOICE MADE, AND WHY.** `debt service` is declared a PARENT and
`capital outlay` a ROOT LEAF, which is literally correct for FY2021-FY2024 (four
of six years) and PROMOTES both out of `Current` in FY2019-FY2020. The cost is
two years in which `Debt service` and `Capital outlay` are shown as peers of
`Current` rather than inside it, and in which FY2019's `Capital leases` and
`Issuance costs` — both debt-service items, and both printed under `Debt
service:` by this same county from FY2021 — attach to `Debt service` instead of
`Current`.

⚠ NO TOTAL MOVES: the tie is against the county's own printed `Total
expenditures` either way, and every leaf keeps its printed value and its printed
label. What changes is the level of two headings in two years. The alternative —
`subparents=('debt service',)` — is literal for FY2019 and WRONG for FY2021, and
would publish two years as a single 68.7M `Current` block against four years of
three peers. Recorded in `IN_COUNTY_SERIES_NOTES` as a presentation break.

── REVENUE: FLAT UNTIL FY2021, GROUPED AFTER ────────────────────────────────

    FY2019, FY2020    Taxes / Income taxes / Other taxes /
                      Licenses and permits / Intergovernmental /
                      Charges for services / Fines and forfeitures /
                      Miscellaneous                      <- ⚠ NO GROUPS
    FY2021+           Taxes:                             <- a group appears
                          Property / Income / Other
                      Licenses and permits / Intergovernmental /
                      Charges for services / Fines and forfeits /
                      Investment earnings
                      Other:
                          Miscellaneous

⚠⚠ `Taxes` IS A VALUED ROOT LEAF IN FY2019 AND FY2020 ($20,202,635 in FY2019)
AND A GROUP HEADING FROM FY2021. Naming it in `revenue_parents` cannot damage
the two early years: the library opens a group only on a row with NO value.
`Income taxes` and `Other taxes` are matched EXACTLY, not by prefix, so neither
opens a group either.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption on the statement page, checked on these documents. FY2024's
printed total governmental revenue is 56,806,995 for a county of ~171,000.
`units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Johnson County, IN',
    parents=('current', 'debt service'),
    # ⚠ A ROOT LEAF HERE, A PARENT IN VANDERBURGH'S AND MONROE'S DOCUMENTS.
    # Copying either county's `parents` would leave this valued line to open an
    # empty group — and the statement would still tie.
    root_leaves=('capital outlay',),
    revenue_parents=('taxes', 'other'),
    revenue_group_members=('property', 'income', 'other', 'miscellaneous'),
    fy_end=('December', 31),
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
