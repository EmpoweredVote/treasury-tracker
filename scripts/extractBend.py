#!/usr/bin/env python3
"""
Bend, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the three parsing traps (dash-zero rows, wrapped
statement titles, capital-outlay nesting).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Bend specifics
--------------
* Expenditure parents: `Current` and `Debt service`.
* `root_leaves=('capital ',)` — Bend prints Capital outlay as a root-level peer of
  Current and Debt service, after the Debt service block.
* Bend uses dash placeholders for $0 General Fund cells (Assessments, System
  development charges, Loan repayments, Permanent maintenance fees on the
  revenue side; Infrastructure, Permanent maintenance, Urban renewal on the
  expenditure side). These are handled by the shared `classify()` and surface
  in `zero_rows`.
* Bend's GF is a COMBINED fund (the statement column is headed `General Fund*`;
  the ACFR also carries a "Combining Balance Sheet - General Fund" and a
  "General Fund Revenue Stabilization Fund"). This is why these figures do not
  match Bend's `Schedule of Expenditures and Other Uses by Appropriation
  Levels`, which is the narrower legal-appropriation scope. The GAAP primary
  statement is deliberately used instead of the budgetary schedule, which is
  biennium-budget basis and cannot be split per fiscal year.

Usage:
  py -3 scripts/extractBend.py "docs/Bend/bend-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractBend.py "docs/Bend/bend-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Bend, OR',
    parents=('current', 'debt service'),
    root_leaves=('capital ',),
)

if __name__ == '__main__':
    run_cli(CONFIG)
