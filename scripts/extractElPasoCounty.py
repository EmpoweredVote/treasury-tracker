#!/usr/bin/env python3
"""
El Paso County, CO ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps (dash-zero rows, wrapped statement
titles, expenditure nesting, units).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

El Paso County specifics
------------------------
* **Calendar fiscal year — closes December 31**, like the City of Colorado
  Springs inside it, and unlike the two Texas entities (Oct-Sep) that share
  this extractor's machinery. See `extractColoradoSprings.py` for why a wrong
  `fy_end` mislabels a year rather than mis-parsing money.

* **Whole dollars** (`units=1`, the default). The county prints full figures
  ($81,903,304 of FY2024 GF property tax). The tie gate is structurally blind
  to a units error, so this is held by the loader's per-capita guard.

* **Expenditure nesting: `Capital outlay` is a ROOT-LEVEL PEER of `Current:`,
  not a child of it.** Read off the printed indentation of the FY2024
  governmental-funds statement (`pdftotext -layout`):

      El Paso County FY2024
        EXPENDITURES                    (0 sp)
          Current:                      (2 sp)   <- parent, WITH colon
            General government          (4 sp)
            Public safety
            Public works
            Health and welfare
            Culture and recreation
            Auxiliary services
          Debt service:                 (2 sp)   <- parent, WITH colon
            Principal
            Issuance costs
            Interest
          Capital outlay                (2 sp)   <- VALUED LEAF at root
            Total expenditures

  This is the same shape as Travis County, TX. Nesting `Capital outlay` under
  `Current` would tie at exactly $0 while hiding a root-level category.

* **Section headers carry a trailing colon** ("Current:", "Debt service:"),
  which 'exact' mode already strips -- no `section_header_mode` override. Note
  the section *banners* are UPPERCASE here (`REVENUES` / `EXPENDITURES`) where
  Colorado Springs prints them in title case; neither matters to the parser.

* **Revenue is flat** -- eleven sources with no group headings (Property taxes,
  Sales taxes, Specific ownership taxes, Highway user taxes, Intergovernmental,
  Fees and fines, Legal settlements, Licenses and permits, Charges for
  services, Investment earnings, Contributions, Miscellaneous), so
  `revenue_parents` stays empty, checked against the printed statement.

  One label to note but NOT to repair: FY2024 prints the sales-tax line as
  "Sales taxes net of $4,477,783 TABOR limitation". That embedded figure is
  part of the issuer's own label, not a parse artifact, and the amount in the
  General Fund column is read from the money columns as usual. Colorado's TABOR
  refunds are disclosed this way and the wording changes year to year; a
  `label_fixes` entry would be inventing a label the county did not print.

* **FY2000-FY2004 are IMAGE-ONLY SCANS and cannot be extracted at all** --
  `pdftotext` returns 0 characters for all five. FY2005 onward carry a real
  text layer. An upstream publishing fact, not an extraction failure.

Usage:
  py -3 scripts/extractElPasoCounty.py "docs/ElPasoCounty/el-paso-county-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractElPasoCounty.py "docs/ElPasoCounty/el-paso-county-2024-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='El Paso County, CO',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
