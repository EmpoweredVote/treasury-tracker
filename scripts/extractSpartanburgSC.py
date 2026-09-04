#!/usr/bin/env python3
"""
City of Spartanburg, SC ACFR — the CORROBORATING `-table` extractor.

⚠⚠ NOT THE RECORD READER. `scripts/extractSpartanburgCoords.py` is, because
`pdftotext -table` MIS-RENDERS THE FY2018 STATEMENT PAGE and mixes the two
sections: revenue comes out 5,975,414 over — exactly `Policy Formulation and
Administration`, an EXPENDITURE line — and expenditure finds no printed total at
all. ⚠ BOTH column strategies fail it identically, so it is the grid itself.

This file exists to keep that move falsifiable: when an entity goes to glyph
coordinates the campaign requires the OTHER reader to keep corroborating every
year it can still read, because a coordinate reader that quietly went wrong
would tie at $0 exactly as happily. Result: 18 of 20 exact agreement, with the
two FY2018 failures declared in `verifyScCityReaders.mjs`.

Documents come from the Federal Audit Clearinghouse by REPORT ID; see
scripts/data/scCityAcfrEntities.mjs.

── ⚠⚠ THE EIN'S TWO NEIGHBOURS ARE CITIES TT ALREADY HOLDS ────────────────

    576000244  CITY OF ROCK HILL      <- wave 2, loaded
    576000245  CITY OF SPARTANBURG    <- wanted
    576000246  CITY OF SUMTER         <- a real SC city

A typo in either direction does not fail: it loads another government's audited
statements under this city's name and every tie gate passes on them. This is the
wave-1 near-miss lesson at its sharpest, because both wrong answers are real
South Carolina cities of comparable size.

⚠ Also in South Carolina and NOT this government: SPARTANBURG COUNTY
(576000401), HOUSING AUTHORITY OF THE CITY OF SPARTANBURG (576001369),
Spartanburg Water System (576000944), Spartanburg Sanitary Sewer District
(576000941), seven Spartanburg County school districts, Spartanburg Regional
Health Services District (571075649), Spartanburg Community College (570439615)
and Spartanburg Methodist College (570314415).

⭐ Unlike Rock Hill, this EIN is CLEAN — checked in the bulk table rather than
assumed: 10 filings, ONE auditee name, ONE fiscal year end, one state, one city.
⚠ Every document was still checked for its issuer: `City of Spartanburg` appears
36-47 times in each, against 10-17 mentions of `Spartanburg County` (the county
is named in the notes as a separate reporting entity, which is expected and is
why a bare name search is not an issuer test).

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears in any of the ten documents, checked per
document rather than carried from a neighbour.

── STRUCTURE, read from GLYPH COORDINATES and STABLE ACROSS THE DECADE ────

Revenue is FLAT — every source sits at the section root (indent 44.1-44.6 in
both FY2016 and FY2025), so no `revenue_parents` is declared. ⚠ Declaring one
without `revenue_group_members` is the Boulder defect, and declaring structure
this issuer did not print would tie at $0 either way.

Expenditure:

    Current:            root heading -> six functions
    Capital Outlay      VALUED ROOT LEAF (44.18 in FY2025, 44.67 in FY2016)
    Debt Service:       root heading -> Principal Retirement / Interest /
                        issuance fees

⚠ `Capital Outlay` is a valued ROOT LEAF here and a PARENT in Rock Hill, ninety
minutes away and in the same registry family. Read it per entity.
⚠ The city prints several line items with NO General Fund figure — `Federal
Government Contributions`, `State Government Contributions`, `Donations` and
(some years) `Investment Earnings`, `Confiscated Drug Funds` and `Ground Lease
Rent` on the revenue side, and `Operating` plus the whole Debt Service group on
the expenditure side. Those are honest absences: they are recorded in
`zero_rows` and never published as $0 categories.

── ⚠ JULY FISCAL YEAR, CONFIRMED THREE WAYS ───────────────────────────────

`fy_end_date` is 06-30 on all ten federal filings; the FAC census records
`SC,Spartanburg,municipality,annual,7` across audit years 1998-1999, 2001-2021
and 2023-2025; and each statement states its own period. ⚠ The census has no
2022 row — a census GAP, not a disagreement, and the filing for that year
exists.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Spartanburg, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
