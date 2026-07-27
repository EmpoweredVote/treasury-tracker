#!/usr/bin/env python3
"""
Beaverton, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the three parsing traps (dash-zero rows, wrapped
statement titles, capital-outlay nesting).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Beaverton specifics
-------------------
* Expenditure parents: `Current` and `Debt service`. There is no Noncurrent
  grouping (verified: adding 'noncurrent' to the parent set produces
  byte-identical output for all 10 city-years).
* `capital_at_root=True` — Capital Outlay is a root-level PEER of Current and
  Debt service. Verified against `pdftotext -layout`, which preserves the
  indentation `-table` flattens:

      Expenditures:           (0 sp)
         Current:             (3 sp)
            General government (6 sp)
         Debt service:        (3 sp)
            Principal         (6 sp)
         Capital Outlay       (3 sp)   <-- peer, not a child

* Richest revenue tree of the Oregon cities so far: 12-13 sources.
* Labels drift across years and are read VERBATIM each year rather than
  normalized to one era's vocabulary — e.g. FY2021 "Fines and forfeits" and
  "Interest on investments and assessments" become FY2025 "Fines and
  forfeitures" and "Investment income".
* FY2021-FY2023 report $0 General Fund debt service, so that parent is
  legitimately absent from those years' trees.

SOURCE DISCOVERY NOTE
---------------------
Beaverton runs CivicPlus Evolve: the ACFR links are injected client-side, so a
plain HTTP fetch of `/<year>-financial-audit` returns a page with NO document
links at all. The URLs were recovered by rendering each page with the cached
Playwright Chromium in headless `--dump-dom` mode. The PDFs themselves live on
two different hosts depending on vintage (`content.civicplus.com/api/assets/...`
for FY2021-FY2024, `beavertonoregon.gov/asset/...` for FY2025), so the per-FY
URLs in processBeaverton.js are pinned literally rather than pattern-built.

Usage:
  py -3 scripts/extractBeaverton.py "docs/Beaverton/beaverton-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractBeaverton.py "docs/Beaverton/beaverton-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Beaverton, OR',
    parents=('current', 'debt service'),
    capital_at_root=True,
)

if __name__ == '__main__':
    run_cli(CONFIG)
