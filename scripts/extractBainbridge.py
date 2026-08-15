#!/usr/bin/env python3
"""
City of Bainbridge Island, WA — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

Source is the WA State Auditor's bound financial statements, not a
self-published ACFR: SAO binds full statements for every filer except large
GAAP filers that publish their own (Seattle, King County). Every year
FY2004-FY2025 is available from one host under one URL pattern.

Bainbridge specifics
--------------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1 (the default). Opposite of Seattle and
  King County, which print "(IN THOUSANDS)". The tie gate is unit-invariant and
  reads $0 either way, so this is checked by the selftest and by the loader's
  per-capita guard, never by the tie.
* Statement is on ONE page with the General Fund as the leftmost money column.
* Revenue side is FLAT -- there is no `Taxes:` parent, so revenue_parents stays
  empty. Setting it would hunt for a group this issuer does not print.
* Expenditure tree: `Current` is the only parent; `Debt Service - Principal`,
  `Debt Service - Interest` and `Capital Outlay` are VALUED ROOT LEAVES.
* `Transportation` is a dash-zero in the GF column in FY2025 and neighbouring
  years -- handled by the library, asserted by the selftest.
* FY2006 has no usable filing (image-only scan) and is excluded upstream in
  scripts/fetchBainbridgeKitsap.mjs.
* FY2004, FY2005, FY2007 and FY2008 print the revenue subtotal as `Total
  Operating Revenues` instead of `Total Revenues` (FY2010 alone renders it as
  `Total REVENUES`, already covered by the default's case-insensitive match).
  `revenue_total_labels` covers both eras from one config -- see
  `CityConfig`'s docstring in scripts/lib/acfrGF.py for why widening only the
  revenue side cannot accidentally match a proprietary-funds statement.

Usage:
  py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2025-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Bainbridge Island, WA',
    parents=('current',),
    root_leaves=('debt service', 'capital outlay'),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    revenue_total_labels=('total revenues', 'total operating revenues'),
    source_rounding={},   # Task 7 registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
