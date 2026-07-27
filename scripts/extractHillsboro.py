#!/usr/bin/env python3
"""
Hillsboro, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps.

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Hillsboro specifics — THE INVERTED LAYOUT
-----------------------------------------
Hillsboro is the reason `CityConfig` takes label LISTS rather than a
`capital_at_root` boolean. It swaps the roles the other cities use:

    EXPENDITURES:          (0 sp)
      Current:             (1 sp)   <- parent
        General government (2 sp)
        Public safety and judicial
        Community service
        Culture and recreation
        Roads and bridges
      Debt service  12,500 (1 sp)   <- a VALUED LEAF at root, NOT a parent
      Capital outlay:      (1 sp)   <- a PARENT with its own children
        General government (2 sp)
        Roads and bridges

So `parents=('current', 'capital outlay')` and `root_leaves=('debt service',)`.
Indentation confirmed with `pdftotext -layout`; `-table` flattens it.

Configuring this the usual way (`parents=(...,'debt service')`,
`root_leaves=('capital ',)`) STILL TIES AT $0 — it just files Debt service and
the capital-outlay detail underneath Current and overstates the Current
subtotal by $1.2M. The printed total is identical either way, which is exactly
why the tie gate cannot catch it.

* Revenue side is 9 sources; expenditure side is 5 Current functions plus the
  Debt service leaf and the Capital outlay group.
* `Roads and bridges` is $0 in the GF capital-outlay group every year and is
  reported in `zero_rows`.

SOURCE DISCOVERY NOTE
---------------------
hillsboro-oregon.gov sits behind a WAF that returns 403 to `curl` for both GET
and HEAD regardless of headers — almost certainly TLS fingerprinting. The PDFs
must be fetched through a real browser; see `scripts/fetchViaBrowser.mjs`.

Usage:
  py -3 scripts/extractHillsboro.py "docs/Hillsboro/hillsboro-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractHillsboro.py "docs/Hillsboro/hillsboro-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Hillsboro, OR',
    parents=('current', 'capital outlay'),
    root_leaves=('debt service',),
)

if __name__ == '__main__':
    run_cli(CONFIG)
