#!/usr/bin/env python3
"""
Cornelius, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps.

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Cornelius specifics
-------------------
* Expenditure parents: `Current` and `Debt service`; `Capital outlay` is a
  root-level PEER of both. Verified against `pdftotext -layout`, which preserves
  the indentation `-table` flattens:

      Expenditures         (0 sp)
        Current            (2 sp)
          General government (4 sp)
          Public safety      (4 sp)
        Capital outlay     (2 sp)   <-- peer, not a child
        Debt service       (2 sp)
          Principal        (4 sp)

* Smallest city in the Oregon set (pop 15,369). Its General Fund runs three
  operating functions — General government, Public safety, Culture and
  recreation — with `Community development` and `Highways and streets` printed
  at $0 in the GF and reported in `zero_rows`.
* Capital outlay can dwarf operations in a given year (FY2025: $5.6M capital vs
  $9.4M current, against $10.8M of GF revenue, funded by a debt issuance shown
  under Other Financing Sources). That is the source's own presentation, not a
  parse artifact.

SOURCE DISCOVERY NOTE — the recon miss worth remembering
--------------------------------------------------------
Cornelius was initially recorded as publishing NO ACFR, on the strength of its
`/257/Budgeting` page, which carries only adopted budgets and Budget-in-Brief
summaries. That was wrong: audited reports live on a SEPARATE
`/258/Financial-Reporting` page, reachable only from the Finance landing page
(`/256/Finance`) — and both pages render their document lists client-side, so a
plain HTTP fetch of either returns no document links at all. Enumerate a
CivicPlus site's section pages from the department landing page with a rendered
DOM before concluding a city publishes nothing.

Usage:
  py -3 scripts/extractCornelius.py "docs/Cornelius/cornelius-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractCornelius.py "docs/Cornelius/cornelius-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Cornelius, OR',
    parents=('current', 'debt service'),
    root_leaves=('capital ',),
)

if __name__ == '__main__':
    run_cli(CONFIG)
