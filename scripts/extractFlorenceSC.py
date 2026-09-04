#!/usr/bin/env python3
"""
City of Florence, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 4. Documents come from the Federal Audit Clearinghouse by REPORT ID;
see scripts/data/scCityAcfrEntities.mjs.

⚠⚠ EIN 576000232, and its ONE-DIGIT NEIGHBOUR IS A SCHOOL DISTRICT IN THIS SAME
CITY — 576000231 `FLORENCE SCHOOL DISTRICT ONE`. One digit the other way is
576000233 `CITY OF GAFFNEY`, a different South Carolina city. A typo does not
fail; it loads a real, related, WRONG government's audited statements under
Florence's name and every tie gate passes on them. A name search over FAC's SC
rows also returns FLORENCE COUNTY (576000351), two housing authorities on two
EINs (570515841, 831445511), FLORENCE DARLINGTON TECHNICAL COLLEGE (570424007),
four Florence County school districts, the county disabilities board (on two
EINs) and the Florence Regional Airport. The EIN plus the recorded per-year
report id is the join, never the name.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears in any of the ten documents, checked per
document rather than carried from a neighbour (Boulder city prints thousands and
Boulder COUNTY, in the same registry family, does not). Property taxes of
$12,333,683 against a population of 40,923 is $301/resident, which is the right
order of magnitude for whole dollars.

── STRUCTURE, read from GLYPH COORDINATES (FY2024, statement page 39) ─────

    Revenues:                  59.76  section header
      Property taxes           66.24  ... seven FLAT leaves, no grouping
      Licenses, permits and fees
      Intergovernmental
      Charges for services
      Fines and forfeitures
      Investment earnings
      Miscellaneous
    Total revenues             74.21

    Expenditures:              59.80  section header
      Current:                 66.28  heading   -> six functions at 72.7x
      Capital outlay           66.31  VALUED ROOT LEAF
      Debt service:            66.24  heading   -> Principal retirement / Interest
    Total expenditures         74.19

⚠⚠ `Capital outlay` IS A VALUED ROOT LEAF HERE AND A PARENT OVER FIVE CHILDREN
IN SUMTER — the other city in this same wave, loaded in the same pull request.
The Hillsboro inversion, between two cities shipped on the same day. Read it per
entity; a config copied from the neighbour parents five Sumter functions under
Florence's leaf and STILL TIES AT $0.

⭐ The leaves were added up BY HAND against the printed totals before any config
was written (FY2024): the seven revenue lines sum to 42,342,051 and the printed
`Total revenues` is 42,342,051; the six `Current` functions plus `Capital outlay`
plus the two debt-service lines sum to 58,637,369 and the printed
`Total expenditures` is 58,637,369.

── ⚠ FLAT REVENUE IS A DECLARATION, NOT AN ASSUMPTION ─────────────────────

`revenue_parents` is deliberately EMPTY. Florence prints all seven sources at one
indent (66.2x) with no heading between them — checked on the page, not inferred
from the absence of a colon. Setting a revenue parent here would close a group
after its first child and quietly reparent six sources while the tie stayed $0;
leaving it empty where the source DOES group welds the heading onto the first
child. Both are silent, so this is read per year rather than once.

── ⚠ JULY FISCAL YEAR ─────────────────────────────────────────────────────

`fy_end_date` is 06-30 and `fy_start_date` 07-01 on all ten federal filings, the
FAC census records `SC,Florence,municipality,annual,7` for audit years 1998-2020
and 2022-2025, and each statement prints its own period
(`FOR THE FISCAL YEAR ENDED JUNE 30, 2024`). Three independent confirmations.
⚠ The census has no 2021 row — a census gap, not a disagreement.

── ⚠ FY2024 RESTATES ITS OPENING FUND BALANCE, AND THAT IS BELOW OUR LINE ──

The FY2024 statement prints `Fund balances, beginning of year, as previously
reported`, then `Adjustment - change within reporting entity`, then `Adjustment -
correction of error`, then `beginning of year, as adjusted`. Those sit BELOW
`Total expenditures` and below `Net change in fund balances`, so they do not
touch either loaded dataset. Recorded because a restatement is exactly the kind
of thing that should be looked at rather than skipped: the General Fund's own
opening balance is unchanged (24,592,480 both lines) — the adjustments move the
Bond Capital Projects and Installment Purchase Revenue funds into Nonmajor.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Florence, SC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
