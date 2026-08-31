#!/usr/bin/env python3
"""
Harrison County, MS ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; Mississippi's first local entities in TT alongside the City of
Biloxi, both members of the `ms-local-acfr-gf` family.

⚠ NOT the Harrison County SCHOOL DISTRICT, and NOT the **Pat Harrison Waterway
District** — both are separate governments that a name query returns first, and
the waterway district files under a name that begins with the same word. **EIN
646000425 is the county.** Documents come from the Federal Audit Clearinghouse
by report_id; see `_acfr-work/s8/manifest.json`.

── ⚠⚠ THIS ENTITY'S OPINIONS ARE NOT CLEAN. GRADE PER YEAR. ────────────────

Every other entity in session 8 is `unmodified_opinion` in every year. Harrison
County is not, and FAC states it as structured data on the filing itself:

    FY2016   unmodified, qualified, ADVERSE
    FY2017   unmodified, qualified
    FY2018   QUALIFIED ONLY
    FY2019   QUALIFIED ONLY
    FY2020   unmodified, qualified
    FY2021   unmodified, qualified
    FY2022   unmodified, qualified
    FY2023   unmodified, qualified

⚠⚠ **FY2018 and FY2019 carry no unmodified component at all.** These rows must
NOT inherit a family-level `audit_grade`; the grade belongs to the document.
Because this comes from FAC's `gaap_results` field rather than from OCR of the
auditor's page, session 7b's inverted-polarity failure -- a gate matching
`qualifiedopinion` INSIDE `UNqualifiedopinion` -- cannot arise here.

── ⚠ FY2024 AND FY2025 DO NOT EXIST YET, ANYWHERE ──────────────────────────

Neither FAC nor the Mississippi Office of the State Auditor holds them. This was
checked, not assumed: OSA published FY2024 county audits for 55 OTHER counties
and FY2025 for 9, so this is Harrison County's own filing lag rather than a
coverage limit. MS OSA's archive also begins at FY2015, and its FY2015 copy of
this county is an image-only scan (1 page of 126 carries text), so FY2015 is not
recoverable either. Reported as gaps, never written as $0.

── ⚠⚠ FY2018-FY2020 PRINT AN UNLABELLED REVENUE TOTAL AND CANNOT BE READ ────

The Piltz Williams LaRosa era (FY2018, FY2019, FY2020) closes its revenue
section with a BARE NUMERIC ROW -- the figures alone, with no `Total revenues`
label of any kind:

    Miscellaneous revenues        1,049,868   4,807  438,498  ...
                                 66,615,863  7,968,907  ...          <- the total
    Expenditures

`acfrGF.py` locates the revenue total by its LABEL, so there is nothing for it
to match, and the page is rejected outright. The only page in those documents
carrying both total labels is the BUDGETARY comparison schedule, which the
`_EXCLUDE` tests correctly reject -- so the failure is loud and no budget-basis
figure can leak in under a GAAP-actual label.

⚠ Reading "the last numeric row before the Expenditures header" as the total
would fix these three years and is DELIBERATELY NOT DONE here: on a statement
whose revenue section ends with a valued line item rather than a total, that
rule silently loads a line item as the section total. It needs to be a
considered library feature with its own tests, not a per-entity workaround.

Reported as gaps. FY2016, FY2017 and FY2021-FY2023 load.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption; FY2023 General Fund total
revenues print as 79,426,573 for a county of ~208,000. `units=1` (the default).

── STRUCTURE, READ FROM THE PRINTED PAGE (FY2023, p.25) ────────────────────

    Revenues                                 <- FLAT, no grouping
       Property taxes / Road and bridge privilege taxes /
       Licenses, commissions and other revenue / Fines and forfeitures /
       Intergovernmental revenues / Charges for services / Lease revenue /
       Interest income / Miscellaneous revenues
    Expenditures
       Current:                              <- parent
           General government / Public safety / Public works /
           Health and welfare / Culture and recreation /
           Conservation of natural resources /
           Economic development and assistance
       Debt service:                         <- parent
           Principal / Interest / Bond issue costs /
           Other debt service costs

⚠ `root_leaves` includes `capital outlay` even though the FY2023 General Fund
column does not print one. The label is a PREFIX match that simply never fires
when the row is absent, and neighbouring years in this corpus do print it. This
is the one place a not-yet-observed label is declared deliberately; every other
config fact here was read off a page.

⚠ `revenue_parents` is deliberately EMPTY. `Property taxes` and `Road and bridge
privilege taxes` are peer root lines with no `Taxes:` heading over them, exactly
as Biloxi prints its three tax lines. Inventing the heading is the session-7b
Boulder failure, which tied at $0 with a wrong tree.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Harrison County, MS',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('September', 30),
    # ⚠⚠ ORDINAL, NOT POSITIONAL — and this is not a preference.
    #
    # In FY2016/FY2017 the Wright Ward Hatten era prints a fund column whose
    # cells are sparse, and `-table` lays five General Fund figures out of
    # positional alignment. Read positionally, `Public works`, `Conservation of
    # natural resources`, `Principal`, `Interest` and `Other debt service costs`
    # were all reported as ZERO ROWS and the entire `Debt service` parent
    # vanished from the tree.
    #
    # Their sum is 48,711 + 148,988 + 588,719 + 259,500 + 40,327 = 1,086,245,
    # which is EXACTLY the tie delta the positional read produced. That
    # arithmetic is what identified the cause; the tie failing is what stopped a
    # five-row-short tree from shipping.
    #
    # ⚠ Ordinal changes NOTHING for FY2021-FY2023: those years tie at $0 under
    # both strategies and emit identical trees. Verified across every staged
    # year before being adopted, not assumed from the two years that needed it.
    column_strategy='ordinal',
)

if __name__ == '__main__':
    run_cli(CONFIG)
