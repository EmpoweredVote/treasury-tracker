#!/usr/bin/env python3
"""
Travis County, TX ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps (dash-zero rows, wrapped statement
titles, expenditure nesting, units).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Travis County specifics
-----------------------
* **Fiscal year ends September 30**, not the module default of June 30. Both
  Texas entities in this milestone close with the state's local-government
  convention. Getting `fy_end` wrong does not mis-parse money — it makes
  `parse_fy` miss the statement page's own caption and fall through to the
  whole-document scan, which is the documented way to silently label a row
  with a neighbouring year.

* **Whole dollars** (`units=1`, the default). Travis prints full figures
  ($830,367,445), unlike Seattle/King County's "(in thousands)". Austin, the
  city inside this same county, DOES print in thousands — so the two entities
  in this milestone deliberately differ on `units`, and the tie gate cannot
  tell them apart (it compares a sum against a printed total read through the
  same multiplier). This is checked instead by the loader's per-capita
  plausibility guard.

* **Section headers carry a trailing colon** ("Revenues:", "Expenditures:").
  The shared `_is_section_header` in 'exact' mode already ignores a trailing
  colon, so no `section_header_mode` override is needed.

* **Expenditure nesting: `Capital outlay` is a ROOT-LEVEL PEER of `Current`,
  not a child of it.** Read off the printed indentation of the FY2024
  statement (`pdftotext -layout`, which preserves the leading whitespace
  `-table` flattens):

      Travis County FY2024, statement page 58
        Current:                        (1 sp)   <- parent
          General government            (>1 sp)
          ...
        Capital outlay                  (1 sp)   <- VALUED LEAF at root
        Debt service:                   (1 sp)   <- parent
            Lease principal             (5 sp)
            Financed purchases principal
            SBITA principal
            Interest and other charges

  Nesting Capital outlay under Current instead would still tie at exactly $0
  — it would just inflate the Current subtotal by the capital figure
  ($63,912,280 in FY2024) and hide a root-level category. A tie proves
  arithmetic, never structure.

* **Revenue is flat** — no group headings in the revenue section, so
  `revenue_parents` stays empty. Setting it where the source does not group is
  harmless; leaving it empty where the source DOES group welds the group
  heading onto its first child while still tying $0, so this was checked
  against the printed statement rather than assumed.

Usage:
  py -3 scripts/extractTravis.py "docs/TravisCounty/travis-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractTravis.py "docs/TravisCounty/travis-2024-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Travis County, TX',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('September', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
