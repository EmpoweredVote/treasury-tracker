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
           rejection is needed. `Taxes` is a FLAT leaf in this era.
    2024+  `Taxes` becomes a PARENT with five children, and the REVENUES line
           also carries the fund column headers -> section_header_mode='prefix'.
* column_strategy='ordinal' because the FY2009 statement renders GF values that
  the positional reader mis-assigns; verified to tie $0 on 2009/2015/2019/2024/2025.
* revenue_parents=('taxes',) is harmless in the eras where `Taxes` is flat --
  a flat `Taxes` row carries a value, so it is data, not a group header.

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
