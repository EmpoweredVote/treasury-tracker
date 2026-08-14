#!/usr/bin/env python3
"""
King County, WA ACFR — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

King County specifics
----------------------
* AMOUNTS ARE IN THOUSANDS -> units=1000.
* Statement splits across two pages in every year; the GF column and both Total
  rows are wholly on page 1, so no multi-page handling is needed.
* Expenditure tree is the Bend/Tualatin shape: `Current:` and `Debt service:`
  are parents, `Capital outlay` is a VALUED LEAF at root.
* column_strategy='ordinal' is REQUIRED, not cosmetic. In FY2018/FY2019
  `pdftotext -table` renders some GF values nearer column 1's anchor; the
  positional reader drops them and FY2018 revenue comes up short by exactly
  4,034 + 8,075 = 12,109. FY2020+ tie either way, but one strategy per entity
  keeps every year on the same reading.
* revenue_parents=('taxes',) fixes labels only. Without it FY2020-FY2025 STILL
  TIE $0 while emitting "Taxes Property taxes" -- the silent trap.
* County vocabulary differs from any TT city: `Intergovernmental revenues`,
  `Investment gains`/`Interest earnings`, `Law, safety and justice`.
* FY2018-era drift: totals are printed UPPERCASE, and there is an extra
  debt-service child `Payment to escrow` absent from later years.

Usage:
  py -3 scripts/extractKingCounty.py "docs/KingCounty/kingcounty-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='King County, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=('taxes',),
    revenue_group_members=('taxes',),
    column_strategy='ordinal',
    units=1000,
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
