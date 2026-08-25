#!/usr/bin/env python3
"""
Buncombe County, NC ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`.

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Buncombe County specifics
-------------------------
* **Fiscal year ends June 30** — the module default (N.C.G.S. 159-8(b)).
* **Whole dollars** (`units=1`, the default).
* ⚠ **`Intergovernmental:` IS A THIRD ROOT-LEVEL PARENT in FY2008-FY2020**, with
  `Education` as its only child. Omitting it welded the heading onto its child
  and published the category as **`Intergovernmental Education`** in ELEVEN of
  the county's sixteen years — with the tie at exactly $0 every time, because a
  weld moves no money. It was caught by `verify-nc.mjs` CHECK 2, whose
  independent coordinate reader sees the two rows separately.

  Placed at ROOT rather than under `Current:` on measured indentation, not on
  the reading that "intergovernmental spending sounds like a current cost" —
  FY2015, glyph x0:

        Current:                     47.40   <- root
          General government         55.68
          ...
        Intergovernmental:           47.40   <- ROOT, same depth as Current
          Education                  55.68
        Capital outlay               47.40   <- root
        Debt service:                47.40   <- root
          Principal retirement       55.68

  Nesting it under `Current` instead would still have tied at $0 and would have
  inflated the Current subtotal by the county's entire education transfer
  ($79,225,390 in FY2015) while hiding a root-level category.

  FY2021+ drop the heading and report `Education` directly under `Current:`, so
  the entry simply never matches in those years.

* **`Capital outlay` is a ROOT-LEVEL PEER of `Current:` and `Debt service:`.**
  Read off the printed indentation of the FY2024 statement (page 41):

        REVENUES                                (0 sp)
          Ad valorem taxes                      (2 sp)  <- flat, no groups
          ...
        EXPENDITURES                            (0 sp)
          Current:                              (2 sp)  <- parent
             General government                 (5 sp)
             Public safety
             Economic and physical development
             Human services
             Cultural and recreational
             Education
          Capital outlay                        (2 sp)  <- VALUED LEAF at root
          Debt service:                         (2 sp)  <- parent
             Principal retirement               (5 sp)
             Interest and fees

* **Revenue is flat** — the county lists ad valorem, sales, intergovernmental,
  permits, sales and services, investment earnings and other as ten peers with
  no group heading, so `revenue_parents` stays empty. Checked against the
  printed statement, not assumed.

Usage:
  py -3 scripts/extractBuncombeCounty.py "docs/BuncombeCounty/buncombe-county-2024-acfr.pdf" --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Buncombe County, NC',
    parents=('current', 'intergovernmental', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('June', 30),
    # FY2011-FY2018 print the government-wide reconciliation at the FOOT of the
    # fund statement itself, so the genuine primary page carries both terms.
    exclude_ignore=('reconciliation', 'net position'),
)

if __name__ == '__main__':
    run_cli(CONFIG)
