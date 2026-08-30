#!/usr/bin/env python3
"""
Boulder County, CO ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 7b; extends the existing `co-local-acfr-gf` family (Colorado Springs and
El Paso County, v2.29).

⚠ A DIFFERENT GOVERNMENT FROM THE CITY OF BOULDER, which is loaded in this same
session by extractBoulderCO.py. Also not Boulder County Housing Authority,
Boulder Valley School District, Boulder Community Health, Mental Health Center
of Boulder County, or the Early Childhood Council of Boulder County — all of
which FAC returns for a "Boulder" name query.

⚠⚠ AND THE AUDITEE NAME IS NOT STABLE: this county files with FAC as
`BOULDER COUNTY, COLORADO`, then `Boulder County`, then `County of Boulder`
across three consecutive years.

── ⚠⚠ THREE WAYS THIS DOCUMENT DIFFERS FROM ITS OWN CITY, ALL SILENT ────────

Boulder city and Boulder County sit twenty miles apart, are loaded in the same
session into the same registry family, and disagree on all three of the facts
this config exists to declare:

1. UNITS. The city prints `(Amounts in 000's)`; THE COUNTY PRINTS WHOLE DOLLARS
   (FY2024 property tax 210,061,736). A units error is invisible to the tie —
   every figure scales together — so carrying the city's units=1000 across would
   have shipped the county 1000x too large with a $0 delta. The Charlotte /
   Mecklenburg pairing exactly, one session later.

2. THE DEBT PARENT IS NOT CALLED "DEBT SERVICE". Boulder County prints
   `Service on long-term obligations:`. A config copied from the city — or from
   Wichita or Sedgwick County, which both say `Debt service:` — would not match
   it, and Principal and Interest would silently reparent while the statement
   still tied to the cent.

3. THE REVENUE TOTAL IS SINGULAR. The county prints `Total revenue`, not
   `Total revenues`, so the library's default `revenue_total_labels` does not
   recognise the page at all.

── ⚠⚠ THE STATEMENT TITLE IS NOT IN THE TEXT LAYER ──────────────────────────

On the statement page only the trailing word `Balances` survives; the phrase
"Statement of Revenues, Expenditures and Changes in Fund Balances" appears
NOWHERE in the page's extracted text, so neither the library's `_TITLE` regex
nor a title-shaped anchor can find it. The page is identified instead by the
county's own distinctive expenditure parent, which appears on the
governmental-funds statement and not on the budgetary schedules. The library
still requires a revenue total, a `total expenditures`, the words `general` and
`fund`, and the absence of every `_EXCLUDE` term ('combining', 'reconciliation',
'budgetary', 'budget and actual', 'proprietary', 'fiduciary', 'net position'),
so the anchor widens the search without weakening the page test.

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

    Revenue                                  <- FLAT, no grouping
       Property tax / Specific ownership tax / Sales tax / Use tax /
       Licenses, fees, and permits / Investment and interest income /
       Intergovernmental / Charges for services / Fines and forfeitures /
       Payment from component unit / Other revenue
    Expenditures
       Current:                              <- parent
           General government / Conservation / Public safety /
           Health and welfare / Economic opportunity / Highways and streets /
           Urban redevelopment/housing
       Capital outlay                        <- root leaf
       Service on long-term obligations:     <- parent (NOT "Debt service")
           Principal / Interest and fiscal charges

Arithmetic check on FY2024, read off the page: Current's seven children sum to
211,253,294; plus Capital outlay 26,482,199 and Principal 3,685,756 + Interest
628,943 gives 242,050,192 — the printed Total expenditures exactly.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ Anchors on the county's own distinctive parent, because the statement title
# is absent from the text layer. Used IN ADDITION to the library's page tests,
# never instead of them.
STATEMENT_ANCHOR = r'Service\s+on\s+long[-\s]term\s+obligations'

CONFIG = CityConfig(
    city='Boulder County, CO',
    parents=('current', 'service on long-term obligations'),
    root_leaves=('capital outlay',),
    # ⚠ SINGULAR, BOTH OF THEM. The library defaults are ('total revenues',)
    # and 'revenues'; this document prints `Total revenue` and opens the section
    # with `Revenue`. With the plural header, the section reader matched NOTHING
    # and the revenue tree came back empty while the printed total was still
    # found — the tie gate failed loudly at the full -283,438,244 rather than
    # shipping a wrong shape.
    revenue_total_labels=('total revenue',),
    revenue_section_header='revenue',
    units=1,
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
)

if __name__ == '__main__':
    run_cli(CONFIG)
