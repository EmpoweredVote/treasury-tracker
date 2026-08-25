#!/usr/bin/env python3
"""
City of Asheville, NC ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`.

  --mode revenue    GF revenue-by-source tree (GROUPED — see below)
  --mode operating  2-level GF expenditure-by-function tree

City of Asheville specifics
---------------------------
* **Fiscal year ends June 30** — the module default (N.C.G.S. 159-8(b)).
* **Whole dollars** (`units=1`, the default).

* ⚠ **The revenue section IS GROUPED**, unlike the other three NC entities.
  Asheville prints a `Taxes:` heading with two children. FY2024, page 40:

        REVENUES                       (0 sp)
        Taxes:                         (0 sp)  <- PARENT
          Ad valorem taxes             (2 sp)
          Other taxes                  (2 sp)
        Intergovernmental              (0 sp)  <- back at root
        Licenses and permits           (0 sp)
        Charges for services           (0 sp)
        Investment earnings            (0 sp)
        Miscellaneous                  (0 sp)

  Leaving `revenue_parents` empty here would read `Taxes:` as a wrapped label
  and weld it onto its first child ("Taxes Ad valorem taxes") while the tie
  stayed $0 — labels wrong, arithmetic right. `revenue_group_members=('taxes',)`
  closes the group in exactly the right place: both children end in "taxes"
  and the next source, `Intergovernmental`, does not.

* ⚠ **Two debt-service parents with IDENTICAL child labels, and the second one
  IS RENAMED EVERY YEAR.** The city reports conventional debt and GASB-87/96
  lease-and-subscription debt separately, and both use the same two child names:

        Debt service:                  (0 sp)
          Principal                    (2 sp)
          Interest and other charges   (2 sp)
        Lease/subscription debt service: (0 sp)
          Principal                    (2 sp)
          Interest and other charges   (2 sp)

  Every variant the city has used must be declared, because a heading not in
  `parents` falls through as a wrapped label and welds onto its own first child.
  Read off the statements, not guessed:

        FY2021   (absent — pre-GASB-87)
        FY2022   Leases
        FY2023   Leases/SBITA's
        FY2024   Lease/subscription debt service
        FY2025   Lease/subscription debt service

  ⚠ `leases` is deliberately listed BEFORE the longer forms only for
  readability — `_is_section_header` matches a whole label-only line, not a
  prefix, so the order does not matter and `leases` cannot swallow
  `leases/sbita's`.

  This is exactly what `scripts/extractAshevilleCoords.py` needs NONE of: the
  coordinate reader takes the hierarchy from printed indentation, so a renamed
  heading costs it nothing. That is why the coordinate reader is the LOADER for
  this entity and this file is only the cross-check — and the check that caught
  the omission is `verify-nc.mjs` CHECK 12, comparing root-level subtotals.

* **`Capital outlay` NESTS UNDER `Current:`** for this city — it is printed at
  the same 2-space depth as `General government` and `Public safety`, not at
  root. This is the opposite of Buncombe and Durham County, which is why
  `root_leaves` is a per-entity list and not a shared default.

Usage:
  py -3 scripts/extractAsheville.py "docs/Asheville/asheville-2024-acfr.pdf" --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='City of Asheville, NC',
    parents=('current', 'debt service', 'leases',
             "leases/sbita's", 'lease/subscription debt service'),
    root_leaves=(),
    revenue_parents=('taxes',),
    revenue_group_members=('taxes',),
    fy_end=('June', 30),
    # `-table` INTERLEAVES this city's title: on FY2021/22/24 the page renders
    # "AND CHANGES IN FUND" BEFORE "STATEMENT OF REVENUES, EXPENDITURES",
    # so no left-to-right title regex can match it. The anchor matches the
    # surviving fragment; _EXCLUDE still rejects the budgetary and combining
    # pages, and find_statement_page still returns the EARLIEST qualifying one.
    statement_anchor=r'STATEMENT\s+OF\s+REVENUES,?\s+EXPENDITURES',
)

if __name__ == '__main__':
    run_cli(CONFIG)
