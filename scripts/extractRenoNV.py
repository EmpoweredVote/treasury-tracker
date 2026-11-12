#!/usr/bin/env python3
"""
City of Reno, NV ACFR — General Fund extractor, COORDINATE-BASED.

Thin wrapper over `scripts/lib/acfrGfCoords.py`.

-- WHY THIS ENTITY READS BY COORDINATES -------------------------------------
`pdftotext -table` does not hold the General Fund in one column. Measured
across all nine published years, the character offset at which a row's FIRST
money token begins (FY2017, page 54):

    offset 87   x8    47,347,070 / 115,225,445 / 176,072,360   8-9 digits
    offset 98   x13    2,446,854 /   6,542,289 /   9,712,505   7 digits
    offset 146  x3       856,024 /      76,881                 NOT General Fund

The split at 87/98 is the El Paso and Durham County defect — one printed
column rendered at two character offsets by value width, so neither an
ordinal nor a positional read is safe.

⚠⚠ THE THIRD OFFSET IS THE DANGEROUS ONE. Reno's General Fund has no urban
redevelopment line, so on that row the first money token (856,024) is the
NON-MAJOR column. A "first token is the General Fund" rule does not merely
mis-align there, it reads a different fund and would tie at $0 against a
printed total it had helped compute.

Every year shows the same class of break (3 to 7 distinct offsets per year;
FY2020 splits 9/12 exactly as FY2017 does), so this is a property of the
issuer's typesetting, not of one era.

⚠ Chosen for the WHOLE ENTITY, never per year by which one happened to tie —
that is the LA-01 curve-fitting error. `-table` corroborates the years it can
read, and the two readers must agree to the dollar.

-- WORDS BREAK IN BOTH DIRECTIONS -------------------------------------------
FY2025 prints `Public w orks` and `Proceeds f rom sale of capital assets`;
the glyph reader recovers both, but any label rule must use `\\s*`, never
`\\s+`. Same class as Asheville FY2021-22 and Durham FY2023.

-- TWO ERAS, ONE ENTITY -----------------------------------------------------
FY2017-FY2020 title the statement GOVERNMENTAL FUNDS / STATEMENT OF REVENUES,
EXPENDITURES AND CHANGES IN FUND BALANCES — the scope FIRST — and run it over
TWO pages with a `(Continued)` banner, printing `Total current`,
`Total capital outlay` and `Total debt service` subtotals.

FY2021+ title it `Statement of Revenues, Expenditures and Changes in Fund
Balances - Governmental Funds`, fit it on ONE page, and print NO subtotals:
`Current`, `Debt service` and `Capital Outlay` are bare parents whose children
sum straight to TOTAL EXPENDITURES.

⚠ Both eras repeat labels across parents — `General government`,
`Public works`, `Culture and recreation`, `Community development & support`
and `Urban redevelopment` each appear under Current AND under Capital Outlay.
Parenting is therefore load-bearing: a label-keyed tree would merge them and
still tie, because the multiset would be unchanged. That is failure mode 1 in
the extractor how-to.

-- SCOPE, MEASURED ----------------------------------------------------------
FY2025 General Fund against Total Governmental Funds:

    revenue       308,004,408 / 436,014,904  = 70.6%
    expenditure   306,331,904 / 464,680,965  = 65.9%

Both are comfortable discriminators. (Durham County's 93-95% revenue share is
the case where this test is too weak to identify the column on its own.)

Arithmetic checked by hand on FY2025 before any code ran — Current 301,703,601
+ Debt service 534,851 + Capital Outlay 4,093,452 = 306,331,904, exactly the
printed TOTAL EXPENDITURES.

-- ⚠ FY2022 DOES NOT ADD UP, AND THAT IS THE CITY'S ARITHMETIC ---------------
Reno's FY2022 statement prints these expenditure columns:

    230,520,516 + 27,824,776 + 3,383,263 + 28,119,779 + 51,986,283
      = 341,834,617      printed TOTAL EXPENDITURES: 341,834,616

A ONE DOLLAR difference, in the published document. The revenue row of the
same statement closes exactly, so it is not a reading artifact.

⭐ Recorded, never corrected — the Milledgeville rule. It does not touch the
figure this extractor stores: the General Fund column is 230,520,516 and ties
at $0 against its own printed total. `ncScopeProbe` refuses to name a Total
Governmental expenditure for FY2022 rather than publish a plausible wrong
one, which is the behaviour that found this.

-- WINDOW -------------------------------------------------------------------
FY2017-FY2025, the nine years reno.gov serves. Older reports exist (the city
claims 41 consecutive GFOA awards) but its CivicPlus document estate returned
404 after the 2026 migration to Revize, so nothing earlier has a live
first-party URL.

Usage:
  py -3 scripts/extractRenoNV.py docs/Reno/FY2025.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='City of Reno, NV',
    units=1,
    weld=None,
    # ⚠ A WRAPPED LABEL, NOT A GROUP. FY2025 prints the city's largest single
    # revenue over two lines — 'Intergovernmental consolidated' at the section
    # root carrying no figure, then 'tax revenue' one level deeper carrying
    # 98,822,138. The reader cannot tell that from a heading, so it emitted a
    # parent with one child. It TIED AT $0 either way, because only the child
    # counts as a leaf; what was wrong was the published shape, and a reader
    # would have seen a category called 'tax revenue' nested under a truncated
    # name the city never printed.
    #
    # ⛔ Not fixable by inference, and this very document proves why: `Debt
    # service` has exactly one child (`Principal retirement`) and is a GENUINE
    # group. A rule reading "one child means a wrapped label" would flatten it.
    label_fixes={
        'Intergovernmental consolidated': 'Intergovernmental consolidated tax revenue',
    },
    collapse_children=('Intergovernmental consolidated tax revenue',),
)

if __name__ == '__main__':
    run_cli(CONFIG)
