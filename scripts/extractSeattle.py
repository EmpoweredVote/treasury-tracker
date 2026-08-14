#!/usr/bin/env python3
"""
City of Seattle ACFR — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

Seattle specifics
-----------------
* AMOUNTS ARE IN THOUSANDS -> units=1000. The tie gate cannot catch this.
* Three format eras, all handled by one config:
    2009   statement split across two pages; GF column and both Total rows are
           wholly on page 1. "Page 1 of 2" interrupts the wrapped title, which
           is why statement_anchor='^\\s*B-4\\b' is required -- Seattle tags the
           statement B-4 in every vintage checked (2009/2015/2019/2024/2025).
    2015   four fund columns PLUS two comparative-year columns. The General
           column is leftmost, so slot 0 stays correct and no comparative
           rejection is needed. `Taxes` is a FLAT leaf through FY2020.
    2021+  `Taxes` becomes a PARENT with five children, and the REVENUES line
           also carries the fund column headers -> section_header_mode='prefix'.
* column_strategy='ordinal' because the FY2009 statement renders GF values
  nearer the next column's anchor -- the positional reader would assign them
  to NO column, silently dropping the value, and the tie would fail by
  exactly the dropped amount. Verified to tie $0 on 2009/2015/2019/2024/2025.
* revenue_parents=('taxes',) is harmless in the eras where `Taxes` is flat --
  a flat `Taxes` row carries a value, so it is data, not a group header.

Known year-over-year discontinuities (structural, NOT parsing bugs)
--------------------------------------------------------------------
All 17 years tie at $0 in both modes, but the operating series jumps +42.9%
in FY2018. That jump is STRUCTURAL, not a parsing defect: in 2018 the City
converted the Department of Education and Early Learning (DEEL) Fund --
previously a separate nonmajor special revenue fund -- into the General Fund
(FY2018 ACFR Note 17, "Restatements, Prior-Period Adjustments, Changes in
Accounting Principles, and Reclassifications", p.149; fund description in
Nonmajor Governmental Funds, p.173). DEEL's programs appear in the General
Fund's functional detail for the first time in FY2018 -- Health and Human
Services goes from absent in FY2017 to $57.0M in FY2018 -- which is why that
category and Economic Environment both jump sharply that year. (The Housing
and Community Development Revenue Sharing Fund, also closed in 2018, split
into the Human Services Operating Fund and the Low-Income Housing Fund per
its own fund description, p.173 -- NOT the General Fund; DEEL is the only
documented General Fund driver.)

Other large YoY moves (FY2020/FY2021 revenue, FY2024 operating) are economic,
not structural, and are cited with their ACFR source in task-7-report.md,
"Year-over-year discontinuities".

Usage:
  py -3 scripts/extractSeattle.py "docs/Seattle/seattle-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Seattle, WA',
    parents=('current', 'capital outlay', 'debt service'),
    root_leaves=(),
    revenue_parents=('taxes',),
    revenue_group_members=('taxes',),
    column_strategy='ordinal',
    units=1000,
    statement_anchor=r'^\s*B-4\b',
    section_header_mode='prefix',
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
