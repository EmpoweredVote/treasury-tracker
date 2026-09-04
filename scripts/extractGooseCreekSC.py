#!/usr/bin/env python3
"""
City of Goose Creek, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 3. Documents come from the Federal Audit Clearinghouse by REPORT ID;
see scripts/data/scCityAcfrEntities.mjs.

⚠ EIN 576008064. A FAC name search for `*goose creek*` in SC also returns the
GOOSE CREEK CONSOLIDATED FIRE DISTRICT and the Berkeley County School District's
Goose Creek facilities — the EIN plus the recorded per-year report id is the
join, never the name. See the module docstring of the roster.

── ⚠⚠ WHY THIS ENTITY NEEDED A LIBRARY CHANGE ─────────────────────────────

Its revenue section GROUPS, and the group is closed by a PRINTED SUBTOTAL:

    Local revenues                              <- heading, indent 40.44
      Property taxes                8,773,340   <- indent 46.57
      Licenses and permits         15,224,034
      Franchise taxes               3,273,895
      Charges for services          5,299,118
      Fines and forfeitures         1,262,172
      Miscellaneous revenues        3,120,528
        Total local revenues       36,953,087   <- indent 54.44, the SUBTOTAL
    State revenues                 11,063,959   <- back at root, indent 40.54
    Federal revenues                   31,820

Read as an ordinary leaf, that subtotal DOUBLE-COUNTS its own six children and
every year fails by exactly the subtotal — FY2024 by 36,953,087, which IS the
printed figure. ⚠⚠ BOTH readers failed identically with the same deltas, which
is what identified it as a LIBRARY gap rather than a reader artifact:
`subtotal_prefixes` existed only in `build_operating`. It now applies to
`build_revenue` too, where each subtotal is CHECKED against the sum of the group
it closes — so this issuer's own printed figure is a free extra oracle,
confirmed on all six years.

⚠ `revenue_group_close='next_heading'` rather than `revenue_group_members`: the
six sources end in "taxes", "permits", "taxes", "services", "forfeitures" and
"revenues" and share no usable suffix. The group is closed by the subtotal, which
is a DECLARED heading, so `next_heading` is exact here rather than permissive.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears anywhere in any of the six documents (checked
per document, not carried from a neighbour — Boulder city prints thousands and
Boulder COUNTY, twenty miles away and in the same registry family, does not).

── STRUCTURE, read from GLYPH COORDINATES ─────────────────────────────────

    Current            46.69  heading      -> its thirteen functions at 54.x
    Capital outlay     46.70  VALUED ROOT LEAF
    Debt service       46.71  heading      -> Principal / Interest at 54.5x

⚠ `Capital outlay` is a valued ROOT LEAF here and a PARENT in Rock Hill, in this
same registry family. Read it per entity.
⚠ Principal and Interest are blank in the General Fund column in FY2024 — a real
absence, so `Debt service` is dropped as childless that year rather than
published as a $0 category. It carries figures in FY2021.

── ⚠ JANUARY FISCAL YEAR ──────────────────────────────────────────────────

All six filings end 12-31 and the FAC census records month 1 across 1999,
2002-2003, 2016 and 2021-2025. All 46 SC COUNTIES run July, so the state norm is
the wrong default here — `fy_end` is stated explicitly.

── ⚠ LABEL DRIFT IS THE ISSUER'S OWN, AND IT LOOKS LIKE A JUMP ────────────

Revenue rises 22.2% from FY2023 to FY2024, and most of that is the city
RESTYLING its own line items rather than collecting more:

    FY2023   Licenses, permits, and franchise taxes   15,618,133
    FY2024   Licenses and permits                     15,224,034
             Franchise taxes                           3,273,895

and `Miscellaneous` becomes `Miscellaneous revenues` in the same year. Loaded as
PUBLISHED, both sides, and flagged here — normalising the labels to make a
series look continuous is inferring intent (the Wichita rule, where one revenue
line is printed under three names across 24 years).

⭐ The real growth is corroborated by the issuer's own MD&A, which is what a
narrative figure is for: "business license revenue was up $2,134,102 from the
prior year or 20%, which was attributable to increased construction activity",
and for the FY2022 jump, "increased revenues from business licenses, property
taxes, and local option sales tax revenues" plus an unbudgeted $2,535,000 state
appropriation for a fire station. The MD&A also states the population "climbed
close to 50,000 in 2024", agreeing with the Census PEP figure in the roster.

⚠ FAC coverage is intermittent (six years, not ten) because a Single Audit is
filed only when federal awards reach $750k. Absence is absence of a FEDERAL
filing, never evidence no ACFR exists, and never written as $0. See
SC_CITY_COVERAGE_GAPS.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Goose Creek, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    column_strategy='ordinal',
    fy_end=('December', 31),
    revenue_parents=('local revenues',),
    revenue_group_close='next_heading',
    subtotal_prefixes=('total local revenues',),
)

if __name__ == '__main__':
    run_cli(CONFIG)
