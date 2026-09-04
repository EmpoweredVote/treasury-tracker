#!/usr/bin/env python3
"""
Town of Hilton Head Island, SC ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). South Carolina
city wave 5. See scripts/data/scCityAcfrEntities.mjs.

⚠ A TOWN, not a city — `Hilton Head Island town` in the Census place file and
`TOWN OF HILTON HEAD ISLAND` in its own filings. `treasury_ensure_municipality`
keys on (name, state, entity_type), so the type is part of this government's
identity and the loaded rows read `Town of Hilton Head Island ACFR — ...`.

── ⚠⚠ EIGHT OF THESE NINE DOCUMENTS COME FROM FAC. FY2020 COMES FROM THE TOWN ──

EIN 570752325 has EIGHT federal filings, not ten: FY2016 and FY2020 are absent.
The recorded coverage figure for this town was therefore "8 of 10". Asking the
question per YEAR at BOTH publishers — the North Charleston discipline — moved
it to NINE: the town publishes FY2020 itself and it is the real document
(12,108,104 bytes, cover `Town of Hilton Head Island, South Carolina /
COMPREHENSIVE ANNUAL FINANCIAL REPORT / Fiscal Year Ended June 30, 2020`, PDF
Author `Town of Hilton Head Island`, 1,922 ch/pg · 56.0% vocab · 0.0 welds).

⭐ FY2020's statement has the SAME SHAPE as its FAC neighbours — flat revenue,
three expenditure parents, same caption style as FY2018 and FY2019 — which is
the evidence that the issuer's own copy is the same document family and not a
differently-typeset restatement. FY2016 is absent at BOTH publishers (the town's
listing begins at FY2020) and is a genuine, declared gap.

── ⚠⚠ THE NAME TRAP IS A PUBLIC SERVICE DISTRICT ──────────────────────────

    570752325  TOWN OF HILTON HEAD ISLAND                 <- wanted
    570680099  Hilton Head No. 1 Public Service District  <- a SEPARATE government

The PSD is a real independent special-purpose district filing its own audited
statements. It does NOT share this EIN, so it is a name-search trap only — but
it is the third occurrence of the Charleston CPW / Mount Pleasant Waterworks
shape in this campaign, and a name join here would also SPLIT this town three
ways: FAC records `TOWN OF HILTON HEAD ISLAND, SOUTH CAROLINA`,
`TOWN OF HILTON HEAD ISLAND` and `Town of Hilton Head Island, South Carolina`
across the eight filings.

⚠⚠ ITS UEI IS NOT STABLE EITHER — `GSA_MIGRATION` through FY2021, `CCGUAVLGD1G9`
from FY2022. Grouping a SERIES by UEI reads this town as two governments. The
(EIN + audit_year + fy_end + UEI) key is for asking whether a GOVERNMENT-YEAR has
a second filing; asked here, it returns ZERO duplicates, so Sumter's reissue
problem does not recur.

── UNITS: WHOLE DOLLARS ───────────────────────────────────────────────────

No "in thousands" caption appears in any of the nine documents, checked per
document rather than carried from a neighbour. FY2017 real and personal property
tax of $12,971,590 against a population of 38,158 is $340/resident, the right
order of magnitude for whole dollars.

── STRUCTURE (verified on ALL NINE statement pages, not one) ──────────────

    REVENUES                      section header
      Real and Personal Property Tax    ... FLAT leaves, no grouping
      Accommodations Tax
      ... (17-19 sources, the set drifts year to year)
    Total revenues

    EXPENDITURES                  section header
      Current:                    heading -> 5-8 functions
      Debt Service:               heading -> Administrative Charges / Principal / Interest
      Capital Outlay:             heading -> 1-4 functions
    Total expenditures

⚠⚠ `Capital Outlay` IS A PARENT HERE AND A VALUED ROOT LEAF IN FLORENCE — the
other SC city loaded one wave earlier. That is the Hillsboro inversion for the
THIRD time inside this one state (Rock Hill parent / Charleston leaf, Sumter
parent / Florence leaf, and now this). A config copied from the neighbour
reparents four functions and STILL TIES AT $0. Read per entity, every time.

⚠ THE PARENT ORDER IS NOT STABLE and does not need to be: FY2017-FY2021 print
`Current: / Debt Service: / Capital Outlay:`, FY2022-FY2025 print
`Current: / Capital Outlay: / Debt Service:`. `parents` is a set of labels, so
the swap is inert — recorded because a shape change that IS inert still has to be
seen and dismissed deliberately rather than never noticed.

⭐ The leaves were added up BY HAND against the printed totals before any config
was written, at BOTH ends of the window:

    FY2017  19 revenue lines            -> 30,862,771  = printed Total revenues
            Current 35,201,612 + Capital outlay 1,229,271 + Debt service 0
                                        -> 36,430,883  = printed Total expenditures
    FY2025  17 revenue lines            -> 56,163,870  = printed Total Revenues
            Current 57,413,716 + Debt Service 362,114 + Capital Outlay 0
                                        -> 57,775,830  = printed Total Expenditures

── ⚠ FLAT REVENUE IS A DECLARATION, NOT AN ASSUMPTION ─────────────────────

`revenue_parents` is deliberately EMPTY. Every source prints at one indent with
no heading between them, checked on the page in all nine years. Setting a revenue
parent here would close a group after its first child and quietly reparent the
rest while the tie stayed $0; leaving it empty where the source DOES group welds
the heading onto the first child. Both are silent, so this is read per year.

── ⚠⚠ `pdftotext -layout` IS UNUSABLE ON THIS ISSUER ──────────────────────

The Charlotte defect, and it is loud in FY2017: `-layout` renders the label
column and the numeric columns as separate blocks, so the money lands on a
DIFFERENT TEXT LINE from its label —

    REVENUES                            $ 12,971,590      <- the section HEADER
    Real and Personal Property Tax                        <- its actual owner

Read that way, every figure is attributed one row off and the totals still tie.
`-table` renders the same page correctly and is what this parser reads. Use
pdfplumber coordinates, never `-layout`, if this issuer ever needs re-reading.

── ⚠ THE ISSUER MISSPELLS ITS OWN CAPTION IN FY2017 ───────────────────────

FY2017 prints `Excees (deficiency) of / revenues over expenditures`. It is the
town's own typo, kept verbatim (the Wichita rule) — and it matters beyond
tidiness, because `scripts/verifyScCityExcess.py` anchors on that caption to bind
the two sides of the statement together. An anchor on `Excess` silently skips
FY2017 and reads as "no such line" rather than as a miss, which is exactly how
Florence lost four years. The caption is printed FIVE ways across this window:

    FY2017              `Excees (deficiency) of revenues over expenditures`
    FY2018-FY2022       `REVENUES OVER (UNDER) EXPENDITURES`
    FY2023              `revenues over (under) expenditures`
    FY2024-FY2025       `Revenues Over (Under) Expenditures`

── ⚠ INVENTED INTERNAL WHITESPACE IN A LABEL ──────────────────────────────

`Business License and Franchise  Fees` renders with two spaces in FY2017 and
three in FY2025 — the character grid inventing whitespace the document does not
contain. This is the ninth `acfrGF` failure mode (a hard-coded literal vs
whitespace the grid invents); labels are whitespace-normalised before comparison
rather than matched against a literal.

── ⚠ THE TABLE OF CONTENTS IS NOT THE STATEMENT ───────────────────────────

FY2018 and FY2020 carry `Statement of revenues, expenditures, and changes in
fund balances` on page 26 — their TABLE OF CONTENTS. The real statement is on
page 48 in both. A page finder keying on the caption alone lands on the TOC,
finds no money, and reports the year as unreadable. The statement page is
located by its printed totals, not by its title.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Town of Hilton Head Island, SC',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
