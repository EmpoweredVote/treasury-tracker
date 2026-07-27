#!/usr/bin/env python3
"""
Tualatin, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the three parsing traps (dash-zero rows, wrapped
statement titles, capital-outlay nesting).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Tualatin specifics
------------------
* Uppercase section headers ("TOTAL REVENUES") and a wrapped statement title,
  same as Sherwood — handled by the shared module's case-insensitive,
  whole-line section matching.
* Expenditure parents: `Current` and `Debt service`. There is no Noncurrent
  grouping.
* `capital_at_root=True` — Tualatin files Capital outlay as a root-level PEER
  of Current and Debt service (the GASB convention), NOT as a child. This is
  the one place Tualatin diverges from Sherwood, and `pdftotext -table`
  flattens the indentation that distinguishes them. Verified with
  `pdftotext -layout`:

      Tualatin                      Sherwood
        Current:          (2 sp)      Current:          (2 sp)
          General govt    (4 sp)         Administration (5 sp)
        Capital outlay    (2 sp) <--   Noncurrent       (2 sp)
        Debt service:     (2 sp)         Capital Outlay (5 sp) <--

  Running Sherwood's config over Tualatin still ties at $0 — it just nests
  Capital outlay under Current and inflates the Current subtotal.
* FY2021-FY2024 report $0 General Fund debt service, so the `Debt service`
  parent is legitimately ABSENT from those years' trees (the shared builder
  drops childless parents). That is an honest absence, not an extraction gap.

Usage:
  py -3 scripts/extractTualatin.py "docs/Tualatin/tualatin-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractTualatin.py "docs/Tualatin/tualatin-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Tualatin, OR',
    parents=('current', 'debt service'),
    capital_at_root=True,
)

if __name__ == '__main__':
    run_cli(CONFIG)
