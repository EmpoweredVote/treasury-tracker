#!/usr/bin/env python3
"""
Sherwood, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the three parsing traps (dash-zero rows, wrapped
statement titles, capital-outlay nesting).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Sherwood specifics
------------------
* The whole statement is set in UPPERCASE ("TOTAL REVENUES", "EXPENDITURES:"),
  and the title wraps so a line begins "EXPENDITURES AND CHANGE...". Both are
  handled by the shared module's case-insensitive, whole-line section matching.
* Expenditure parents: `Current` and `Noncurrent` (plus `Debt service`,
  included defensively in case an earlier ACFR splits it out as its own parent).
* `root_leaves=()` — Sherwood files Capital Outlay as a CHILD of
  Noncurrent, alongside Debt Service - Principal/Interest. Verified against
  `pdftotext -layout`, which preserves the indentation `-table` flattens:

      EXPENDITURES:        (0 sp)
        Current:           (2 sp)
           Administration  (5 sp)
        Noncurrent         (2 sp)
           Capital Outlay  (5 sp)   <-- child, not a peer

  Getting this backwards still ties at $0; it just mis-nests the node.
* Sherwood's GF carries five real operating functions (Administration,
  Community Development, Public Safety, Community Services, Public Works) — a
  richer expenditure tree than Bend's two.

Usage:
  py -3 scripts/extractSherwood.py "docs/Sherwood/sherwood-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractSherwood.py "docs/Sherwood/sherwood-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Sherwood, OR',
    parents=('current', 'noncurrent', 'debt service'),
    root_leaves=(),
)

if __name__ == '__main__':
    run_cli(CONFIG)
