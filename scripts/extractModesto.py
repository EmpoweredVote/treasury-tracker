#!/usr/bin/env python3
"""
Modesto, CA ACFR extractor -- General Fund, GAAP actuals.

Source: City of Modesto Annual Comprehensive Financial Report, governmental-funds
Statement of Revenues, Expenditures, and Changes in Fund Balances, General Fund
column. Published through a CivicPlus ArchiveCenter; item ids pinned in
scripts/fetchCaCities.mjs. Window FY2002-FY2025 (23 years, FY2009 excluded).

* AMOUNTS ARE WHOLE DOLLARS -> units=1. No "(in thousands)" caption in any year;
  FY2025 prints Taxes as "$ 76,102,066" against a $233,017,347 total revenue,
  which is the right order of magnitude for a city of 203,294. The tie gate
  CANNOT catch a wrong `units` -- it compares a computed sum against a printed
  total read through the same multiplier -- so this is asserted here from the
  page and re-checked by the loader's per-capita guard.

* FISCAL YEAR ENDS JUNE 30 -> fy_end=('June', 30). Bound from each page's own
  period sentence ("Year Ended June 30, 2025"), NEVER from the archive title,
  which uses the span form ("FY 2024-25") and would be off by one.

⚠ `pdftotext -layout` MISALIGNS THIS DOCUMENT. On the FY2025 statement its output
   pairs "General government" with a dash and "Parks and recreation" with
   $162,667,321 (which is Public safety's figure). `-table` -- the mode this
   library actually reads -- aligns correctly. Noted because it is the INVERSE of
   the WA-CITIES-01 finding, where `-layout` flattened indentation the document
   printed and `-lineprinter` was needed. Use `-layout` here only to confirm which
   rows are label-only, never to read a value.

── The era split, and why ONE config covers it ──────────────────────────────────
`Capital outlay` changes shape exactly once across the window:

    FY2002-FY2024   a VALUED ROOT LEAF -- "Capital outlay  1,015,003  ..."
    FY2025          a PARENT with children -- "Capital outlay:" then
                    General government / Community development / Highways and
                    streets / Public works / Parks and recreation / Public safety

Both are declared, and they cannot collide, because `build_operating` reaches
them through mutually exclusive branches: the `parents` branch fires only on a
LABEL-ONLY line (kind == 'wrapped'), while `root_leaves` is tested only against a
row that carried a value (kind == 'data'). So "Capital outlay:" opens a group in
FY2025 and "Capital outlay 1,015,003" stays a root-level peer in FY2002-2024,
from the same two lines of config. Same one-config-two-eras shape Bainbridge used
for `revenue_total_labels`.

Verified against every year in the window rather than assumed -- guessing this
distinction produces a $0 tie with a wrong tree, which no arithmetic gate sees.

REVENUE IS FLAT IN EVERY ERA. `Taxes` is a valued leaf in FY2002, FY2010, FY2015,
FY2020, FY2024 and FY2025 alike -- never a group header -- so `revenue_parents`
stays empty. Leaving it empty where a source DOES group is the quiet failure
(the header welds onto its first child, "Taxes Property taxes", while the total
still ties), so this was checked across the eras, not just the newest year.

Usage:
  python scripts/extractModesto.py docs/Modesto/modesto-fy2025.pdf
  python scripts/extractModesto.py docs/Modesto/modesto-fy2025.pdf --mode revenue
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.acfrGF import CityConfig, run_cli

CONFIG = CityConfig(
    city='Modesto, CA',
    # 'capital outlay' is BOTH a parent and a root leaf on purpose -- see the era
    # split above. The two never fire on the same line.
    parents=('current', 'capital outlay', 'debt service'),
    root_leaves=('capital outlay',),
    units=1,
    fy_end=('June', 30),
    # ⚠ FY2024 and FY2025 title the statement in the PLURAL -- "StatementS of
    # Revenues, Expenditures[,] and Changes in Fund Balances" -- which the shared
    # library's `_TITLE` does not match (it requires the singular). FY2002-FY2023
    # are singular and match normally.
    #
    # Fixed here rather than by widening `_TITLE`, deliberately. The plural string
    # also occurs in the King County and Tucson corpora, on NON-primary pages
    # (combining schedules and contents), and both entities load correctly today
    # because those pages never qualify. `find_statement_page` returns the
    # EARLIEST qualifying page, so relaxing the shared regex could promote one of
    # those pages ahead of the real statement and silently change which numbers
    # 168 already-verified PDFs extract from. A per-city anchor has no blast
    # radius at all.
    #
    # This does not weaken page selection: `statement_anchor` only supplies an
    # alternative way to RECOGNISE the title. Every other qualifying condition is
    # unchanged -- the page must still carry a printed revenue subtotal AND the
    # literal 'total expenditures', mention 'general' and 'fund', and not match
    # any _EXCLUDE term (combining / reconciliation / budgetary / proprietary /
    # fiduciary), which is what keeps Modesto's own three decoy classes out.
    statement_anchor=r'Statements\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+'
                     r'Changes\s+in\s+Fund\s+Balances?',
)

if __name__ == '__main__':
    run_cli(CONFIG)
