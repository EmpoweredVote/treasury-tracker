#!/usr/bin/env python3
"""
City of Rock Hill, SC ACFR — the CORROBORATING `-table` reader.

⚠⚠ THIS IS NOT THE READER OF RECORD. Rock Hill loads through
`scripts/extractRockHillCoords.py` (pdfplumber glyph coordinates), because this
`-table` reader is 432,533 short on FY2024 revenue — it drops `Fines and
forfeitures`, whose General Fund cell is rendered ~24 characters right of the
column. Switching this file to `column_strategy='ordinal'` fixes FY2024 and
breaks FY2025 operating by 20,125, so NEITHER strategy is right for this issuer
and choosing per year would be curve-fitting.

This file is kept because the campaign requires the OTHER reader to corroborate
every year it can still read — 18 of 20 here. `scripts/verifyScCityReaders.mjs`
runs both and requires agreement, with the two known disagreements declared.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 2. Documents come from the Federal Audit Clearinghouse by REPORT ID;
see scripts/data/scCityAcfrEntities.mjs.

── ⚠⚠ ITS EIN IS SHARED WITH ANOTHER GOVERNMENT ───────────────────────────

FAC's EIN 576000244 carries the CITY of Rock Hill *and* the HOUSING AUTHORITY OF
THE CITY OF ROCK HILL — 19 filings under one number, seven auditee-name variants
and TWO fiscal year ends. Joining on the EIN alone pulls the authority's audited
statements into the city's series, and since the authority closes December while
the city closes June, it would also read as a city that alternates its fiscal
calendar every single year. A wrong CONFIRMATION is worse than no evidence.

⭐ The census-era report id separates them independently: the city is
`...-06-CENSUS-0000170607`, the authority `...-12-CENSUS-0000182948`.

── ⚠⚠ FY2024 IS FILED UNDER A PERSON'S NAME ───────────────────────────────

FAC records the FY2024 filing's `auditee_name` as **`Drew Cooper`** — almost
certainly the submitter typing their own name into the auditee field.

**A NAME-BASED JOIN WOULD HAVE SILENTLY DROPPED FY2024**, leaving a hole in the
series that reads exactly like a city that did not file. The document itself is
unambiguous and was checked rather than assumed: its cover reads `CITY OF ROCK
HILL, SOUTH CAROLINA ANNUAL COMPREHENSIVE FINANCIAL REPORT FOR THE FISCAL YEAR
ENDED JUNE 30, 2024`, "City of Rock Hill" appears 85 times in it, and "Drew
Cooper" appears ZERO times. It is loaded.

⚠ The FAC fiscal-year census drops FY2024 for the same reason — its month-7
coverage for Rock Hill runs 2001-2023 and 2025, skipping 2024 — which
corroborates the cause rather than casting doubt on the year.

── ⚠ ROCK HILL CHANGED ITS FISCAL YEAR, BEFORE THIS WINDOW ────────────────

The census records month 1 for 1998-1999, a SIX-MONTH stub in 2000, then month 7
from 2001 onward. The change predates FY2016 by sixteen years, so month 7 holds
across everything loaded here — recorded because a changeover year is exactly
where an inferred month goes wrong.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No statement page carries an "in thousands" caption, and FY2024 prints General
Fund total revenues of 96,194,080 for a city of 75,798.

── STRUCTURE, READ FROM GLYPH COORDINATES ─────────────────────────────────

    REVENUES                                     x=45   <- FLAT, no groups
        Property taxes / Accommodations and hospitality taxes /
        Licenses and permits / Fines and forfeitures / Intergovernmental /
        Charges for services / Impact fees / Investment earnings /
        Program income / Scrap and equipment sales / Other      x=61
    EXPENDITURES
        Current:                                 x=61   <- parent
            General government / Public safety / Public works /
            Parks, recreation and tourism        x=77
        Capital outlay                           x=61   <- PARENT, NOT A LEAF
            General / Finance purchases vehicles and equipment  x=77
        Debt service:                            x=61   <- parent
            Principal / Interest and fees / Financed purchases payments

⚠⚠ `Capital outlay` IS A PARENT HERE AND A ROOT LEAF EVERYWHERE ELSE IN THIS
WAVE. Charleston, Mount Pleasant and Greenville all print it as a single valued
row; Rock Hill prints it as a heading with two children and NO value of its own.
This is the documented Hillsboro inversion, and it is why `root_leaves` is empty.
A config copied from a sibling city would reparent both children silently while
the statement still tied to the cent.

⚠ `revenue_parents` is deliberately EMPTY — Rock Hill prints no revenue group
headings, and its two tax lines stand as ROOT sources rather than under a
`Taxes:` heading. Contrast Charleston in wave 1, which groups twice.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Rock Hill, SC',
    parents=('current', 'capital outlay', 'debt service'),
    root_leaves=(),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
