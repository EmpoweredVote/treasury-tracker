#!/usr/bin/env python3
"""
Durham County, NC ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps (dash-zero rows, wrapped statement
titles, expenditure nesting, units).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Durham County specifics
-----------------------
* **Fiscal year ends June 30** — the module default, and the statutory close
  for every North Carolina local unit (N.C.G.S. 159-8(b)).

* **Whole dollars** (`units=1`, the default).

* **`Capital Outlay` is a ROOT-LEVEL PEER of `Current:` and `Debt service:`**,
  not a child of either, and the county capitalises the second word. Read off
  the printed indentation of the FY2024 statement (`pdftotext -layout`, which
  preserves the leading whitespace `-table` flattens):

      Durham County FY2024, statement page 56
        Revenues                          (0 sp)
           Taxes                          (3 sp)   <- flat, no revenue groups
           Licenses and permits
           ...
        Expenditures                      (0 sp)
           Current:                       (3 sp)   <- parent
               General government         (7 sp)
               Public safety
               Transportation
               Environmental protection
               Economic and physical development
               Human services
               Education
               Cultural and recreational
           Debt service:                  (3 sp)   <- parent
               Principal retirement       (7 sp)
               Interest and fiscal charges
               Debt issuance costs
           Capital Outlay                 (3 sp)   <- VALUED LEAF at root

  `root_leaves` entries are matched lowercase, so 'capital outlay' catches the
  county's `Capital Outlay` casing. Nesting it under `Debt service` instead
  would still tie at exactly $0 — it would just file capital spending inside
  debt service and inflate that subtotal, the same silent-but-wrong outcome
  Kent's `Issuance costs` weld produced in WA-CITIES-01.

* **Revenue is flat** — no group headings in the revenue section, so
  `revenue_parents` stays empty. Checked against the printed statement.

* **Long series: FY2005-FY2025, 21 years.** The county's own section wording
  drifts across that span (`Revenues` vs `REVENUES`, colon vs no colon), which
  the shared whole-line section matching already absorbs.

Usage:
  py -3 scripts/extractDurhamCounty.py "docs/DurhamCounty/durham-county-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractDurhamCounty.py "docs/DurhamCounty/durham-county-2024-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Durham County, NC',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
