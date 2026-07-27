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
    # 'current operating' is the FY2013-and-earlier spelling of the 'Current'
    # parent header. Without it that line is read as a wrapped label and glued
    # onto the next row ("Current operating General government"), flattening the
    # tree while the total still ties.
    parents=('current', 'current operating', 'debt service'),
    root_leaves=('capital ',),
    # Bend's own statements are internally off by $1 in these two city-years:
    # the printed total exceeds the sum of the printed components. Verified by
    # reading the rows off the page — see the CityConfig docstring for why this
    # is an exact registry rather than a tolerance.
    source_rounding={
        (2010, 'revenue'):   -1,   # components 33,770,749 vs printed 33,770,750
        (2013, 'operating'): -1,   # components 20,123,136 vs printed 20,123,137
        (2014, 'revenue'):    1,   # components 36,849,625 vs printed 36,849,624
        (2014, 'operating'): -1,   # components 21,374,060 vs printed 21,374,061
    },
    # Bend's FY2014 PDF letter-spaces its glyphs, so `-table` splits words inside
    # labels. Every adjacent year of the same statement prints these normally.
    label_fixes={
        'Public w ays and facilities': 'Public ways and facilities',
        'Urban renew al': 'Urban renewal',
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
