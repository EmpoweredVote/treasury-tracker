#!/usr/bin/env python3
"""
City of Sumter, SC ACFR — General Fund extractor (COORDINATE reader).

Wrapper over `scripts/lib/acfrGfCoords.py`, which reads structure from the PDF's
own glyph x-coordinates. South Carolina city wave 4. Documents come from the
Federal Audit Clearinghouse by REPORT ID; see scripts/data/scCityAcfrEntities.mjs.

⚠⚠ EIN 576000246, AND ITS ONE-DIGIT NEIGHBOURS ARE TWO CITIES TT ALREADY HOLDS:

    576000244  CITY OF ROCK HILL      <- wave 2, loaded
    576000245  CITY OF SPARTANBURG    <- wave 3, loaded
    576000246  CITY OF SUMTER         <- wanted

A typo in either direction does not fail — it loads another LOADED city's audited
statements under Sumter's name, and every tie gate passes on them. Also in South
Carolina and NOT this government: SUMTER COUNTY (576000405), HOUSING AUTHORITY OF
SUMTER (570475456), SUMTER SCHOOL DISTRICT (364682689), the county's alcohol and
drug abuse commission (570604046), its disabilities board (570645651 AND
824401069 — one board, two EINs) and SUMTER FAMILY HEALTH CENTER (571095992).
⭐ Checked in the FAC bulk table rather than assumed: this EIN carries ONE
government — one UEI (WA1XM9LJCL85), one fiscal year end (06-30), one city, and
`CITY OF SUMTER` / `City of Sumter` as its only two spellings.

── ⚠⚠ WHY THE COORDINATE READER, AND WHY THE WHOLE ENTITY MOVES ───────────

`pdftotext -table` renders this issuer's statement page LETTER-SPACED, and it hits
exactly the tokens the shared reader depends on:

    Re ve nue s                     the revenue banner  (`^revenues?:?$`)
    T otal revenues 85,437,318      the anchor row      (`^(?:Total|Net)\\s*revenues\\b`)
    Expe nditure s                  the expenditure banner
    Go v ern men t al               the column headers

None of those match, and `acfrGF.classify` then refuses the page outright because
the printed page number `31` lands in the General Fund column — it fails LOUDLY
rather than shipping a wrong shape, which is the correct behaviour.

⚠ The letter-spacing is INTERMITTENT: FY2016 and FY2022 render `Total revenues`
cleanly, the other eight do not. Reading the clean years with `-table` and the
rest with coordinates would be picking whichever reader happened to work per
year — the LA-01 curve-fitting error — so the ENTITY MOVES AS A WHOLE.

⚠⚠ De-letter-spacing the text layer is NOT the fix, and the library already says
why: `CityConfig.label_fixes` refuses fuzzy repair because "a rule that rejoined
runs of capitals would happily corrupt a legitimate label", and
`repair_ocr_whitespace` closes split THOUSANDS GROUPS only, never letters.
pdfplumber sidesteps the whole question by reconstructing `T` + `otal` from glyph
spacing, so the coordinate reader sees clean words and the grid never gets a say.

── ⚠⚠ THE CORROBORATOR IS NOT THE OTHER READER, BECAUSE IT CANNOT BE ──────

Rock Hill and Spartanburg keep `-table` as a required corroborator. Sumter cannot:
the grid reader fails in every one of the ten years, for the reason above. So the
independent check is the ISSUER'S OWN DERIVED LINE — `Excess (deficiency) of
revenues over (under) expenditures`, which the city computed from the two totals
this extractor reads and its auditor typeset:

    Total revenues                        85,437,318
    Total expenditures                    64,284,680
    Excess ... over (under) expenditures  21,152,638

⭐ `scripts/verifyScCityExcess.py` asserts that identity per entity-year and
reproduces it on **10 of 10** Sumter years, including the worst letter-spaced
ones. ⚠ It binds the two SIDES to each other, which the tie gate does not: the tie
compares each total against its own printed total on the same side, so a whole
side read from a neighbouring FUND COLUMN still ties at $0 (the Rock Hill
two-offset defect). Its honest limit is recorded in that script: a pair of errors
equal in size and identical in sign, one per side, would survive it.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears in any of the ten documents, checked per
document rather than carried from a neighbour. Property-and-vehicle-and-fire-fee
taxes of $11,838,940 against a population of 42,958 is $276/resident — the right
order of magnitude for whole dollars.

── STRUCTURE, read from GLYPH COORDINATES (FY2024, statement page 35) ─────

REVENUE — grouped THREE times, with valued root leaves printed BETWEEN the groups:

    Taxes                                   100.65  heading
      Property and vehicle and fire fees    105.15
      Sales                                 105.17
    Licenses, permits, and franchise fees   100.68  VALUED ROOT LEAF
    Intergovernmental revenue               100.69  heading
      State and federal government          105.18
      Local governments                     105.20
    Charges for services                    100.71  heading
      Sanitation fees and container rentals  105.21
      Other                                 105.22
    Fines, fees, and forfeitures            100.73  VALUED ROOT LEAF
    Interest income and investment return   100.73  VALUED ROOT LEAF
    Other                                   100.73  VALUED ROOT LEAF

⚠⚠ THAT SHAPE IS THE SECOND REASON FOR THIS READER, INDEPENDENT OF THE
LETTER-SPACING. `acfrGF` can express a revenue group three ways and none of them
fits: `revenue_group_members` is a SUFFIX list and these members share none
(`Property and vehicle and fire fees` / `Sales`; `State and federal government` /
`Local governments`); `revenue_group_close='next_heading'` would swallow the four
root leaves printed between the groups into whichever group preceded them; and
`numeric_chart` needs a published account numbering this issuer does not print.
Every one of those wrong shapes TIES AT $0, because the multiset of amounts is
unchanged and only the parenting moves — documented failure mode 1. The
coordinate reader derives nesting from the printed indent and needs no rule.

EXPENDITURE — three parents, NO root leaves:

    Current         100.74  heading -> six functions at 105.2x
    Debt Service    100.76  heading -> three lines
    Capital Outlay  100.77  heading -> five functions

⚠⚠ `Capital Outlay` IS A PARENT HERE AND A VALUED ROOT LEAF IN FLORENCE — the
other city in this same wave, shipped in the same pull request. The Hillsboro
inversion between two cities loaded on the same day. Read per entity.

⚠ THE SAME LABEL APPEARS AT TWO PATHS. `General government administration`,
`Public works`, `Parks, recreation and culture` and `Economic development` are
each printed under BOTH `Current` and `Capital Outlay`, and revenue prints `Other`
both at root and inside `Charges for services`. They are different rows with
different figures; nothing may merge them by name.

⭐ The leaves were added up BY HAND against the printed totals before any config
was written. FY2024: the ten revenue lines sum to 85,437,318 and the printed
`Total revenues` is 85,437,318; the fourteen expenditure lines sum to 64,284,680
and the printed `Total expenditures` is 64,284,680. FY2016 likewise, 41,249,903.

── ⚠ SHAPE MOVES ACROSS THE SERIES, ALL CHECKED ON THE PAGE ───────────────

`Current` carries five functions through FY2022 and six from FY2023, and
`Capital Outlay` five, then four, then five. Neither is a reader artifact:

    FY2016-FY2022  `Community development` is PRINTED and its General Fund cell
                   is a DASH (FY2016 p26: `Community development - 203,418
                   203,418`) — the non-major fund carries the money. From FY2023
                   it carries a General Fund figure.
    FY2021-FY2023  capital `General government administration` prints `- - -`.

Recorded in `zero_rows` and never published as a $0 category — an honest absence,
verified by rendering the rows rather than inferred from a count.

── ⚠ THE ISSUER RESTYLES ITS OWN LABELS (the Wichita rule) ────────────────

    FY2016-FY2022  `Principal retirement-capital lease obligations`
    FY2023-FY2025  `Principal retirement-lease obligations`

GASB 87 dropped "capital" from lease terminology and the city followed. Loaded AS
PUBLISHED on both sides of the change and flagged here; normalising the labels to
make the series look continuous is inferring intent. Likewise FY2016's
`State and federal governments` (plural) becomes singular later.

── ⚠ JULY FISCAL YEAR, CONFIRMED THREE WAYS ───────────────────────────────

`fy_end_date` is 06-30 and `fy_start_date` 07-01 on all eleven federal filings;
the FAC census records `SC,Sumter,municipality,annual,7` across audit years
1998-2000, 2003-2015 and 2017-2025; and each statement prints its own period
(`For the Year Ended June 30, 2024`). ⚠ The census has no 2016 row — a census GAP,
not a disagreement, and the filing for that year exists.

── ⚠⚠ FY2024 EXISTS TWICE AT FAC, AND THE TWO COPIES DISAGREE ─────────────

The reissued report is the one loaded. See `SC_CITY_SUPERSEDED_REPORTS` in
scripts/data/scCityAcfrEntities.mjs: the two documents differ by a General Fund
reclassification of 227,950 and 31,205 out of `Capital Outlay` and into
`Current`, offsetting to the dollar, so **both tie at exactly $0** and no
arithmetic gate can tell them apart.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of Sumter, SC',
    units=1,               # whole dollars; the city prints full figures
)

if __name__ == '__main__':
    run_cli(CONFIG)
