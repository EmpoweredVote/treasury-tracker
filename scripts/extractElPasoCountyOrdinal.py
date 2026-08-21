#!/usr/bin/env python3
"""
El Paso County, CO — the acfrGF `-table` reader in ORDINAL column mode.

THIS IS NOT A LOADER. It exists so `scripts/verify-colorado.mjs` can corroborate
the coordinate reader that DOES load this entity
(`scripts/extractElPasoCountyCoords.py`) against an implementation that shares
no code with it.

Two wrappers are needed rather than one because neither `-table` column strategy
reads the whole corpus, and each fails for a separately identified reason:

  positional (scripts/extractElPasoCounty.py)
      `pdftotext -table` renders the General Fund column at TWO character
      offsets; rows whose later cells are dashes sit ~20 characters right and
      get filed under Road and Bridge. FY2020's four dropped rows sum to
      exactly its 7,761,496 tie delta.

  ordinal (this file)
      takes the FIRST column slot and ignores x-positions, which fixes the
      above — but the county prints its TABOR refund INSIDE the revenue label
      ("Sales taxes net of $4,477,783 TABOR limitation"), and that embedded
      figure IS the first slot. FY2024's delta is exactly
      122,194,544 - 4,477,783 = 117,716,761.

So each strategy reads a different subset of the years correctly, and the
harness treats a row as corroborated when EITHER reproduces the stored figure.
Rows neither can read are reported by name as single-reader rather than counted
as passing.

Measured when this milestone was built: of 36 stored rows, 30 are corroborated
this way. Every year in which a strategy ties at $0 also agrees with the
coordinate reader component-for-component — the tie gate produced no false
positives on this corpus, which is why the two signals can be trusted together.

Usage (harness only):
  py -3 scripts/extractElPasoCountyOrdinal.py <pdf> --mode revenue
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
    column_strategy='ordinal',
)

if __name__ == '__main__':
    run_cli(CONFIG)
