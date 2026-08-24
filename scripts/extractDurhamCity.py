#!/usr/bin/env python3
"""
City of Durham, NC ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps (dash-zero rows, wrapped statement
titles, expenditure nesting, units).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

City of Durham specifics
------------------------
* **Fiscal year ends June 30** — the module default, and the statutory close
  for every North Carolina local unit (N.C.G.S. 159-8(b)).

* **Whole dollars** (`units=1`, the default). FY2024 prints
  `238,105,759` for Taxes. None of the four NC entities in this milestone
  prints in thousands, so unlike AUSTIN-TRAVIS-01 there is no live `units`
  split here — but the loader's per-capita guard still checks it, because the
  tie gate structurally cannot.

* **`Current` and `Debt service` carry NO trailing colon** in this city's
  statements, where the other three NC entities print one. `_is_section_header`
  strips a trailing colon before matching, so a single `parents` tuple serves
  both conventions and no override is needed.

* **No `Capital outlay` root leaf.** Durham reports capital spending inside its
  functional `Current` categories rather than as a separate root-level line, so
  `root_leaves` is empty. Read off the printed indentation of the FY2024
  statement (`pdftotext -layout`, which preserves the leading whitespace
  `-table` flattens):

      City of Durham FY2024, statement page 46
        REVENUES                        (0 sp)
           Taxes                        (3 sp)   <- flat, no revenue groups
           Licenses and permits
           ...
        EXPENDITURES                    (0 sp)
           Current                      (3 sp)   <- parent, NO colon
              General government        (6 sp)
              Public safety
              Development
              General services
              Parks and recreation
              Streets and highways
           Debt service                 (3 sp)   <- parent, NO colon
              Principal                 (6 sp)
              Interest and other charges

* **Revenue is flat** — no group headings in the revenue section, so
  `revenue_parents` stays empty. Checked against the printed statement rather
  than assumed: leaving it empty where the source DOES group welds the heading
  onto its first child while still tying $0.

Usage:
  py -3 scripts/extractDurhamCity.py "docs/DurhamCity/durham-city-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractDurhamCity.py "docs/DurhamCity/durham-city-2024-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='City of Durham, NC',
    parents=('current', 'debt service'),
    root_leaves=(),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
