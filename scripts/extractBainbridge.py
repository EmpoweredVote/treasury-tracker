#!/usr/bin/env python3
"""
City of Bainbridge Island, WA — General Fund extractor (GAAP actuals).

COVERS FY2010-FY2025. For FY2004, FY2005, FY2007 and FY2008 (an era with a
genuinely different expenditure tree shape), use
scripts/extractBainbridgeEarly.py instead. FY2006 has no usable filing
(image-only scan, excluded upstream). FY2009 is font-corrupted and DROPPED:
its statement pages are digit-bearing but ciphered (a broken embedded font
with no usable ToUnicode CMap), and the bounded contiguous-offset decode
attempted in Task 6 found no substitution map that tied. See "Known
limitations" in
docs/superpowers/specs/2026-08-14-bainbridge-island-kitsap-onboarding-design.md.

Thin wrapper over scripts/lib/acfrGF.py.

Source is the WA State Auditor's bound financial statements, not a
self-published ACFR: SAO binds full statements for every filer except large
GAAP filers that publish their own (Seattle, King County).

Bainbridge specifics (FY2010-FY2025)
-------------------------------------
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
* revenue_total_labels is left at its default (`('total revenues',)`).
  FY2010 alone in this era renders the caption as `Total REVENUES`
  (different case), already covered by the default's case-insensitive
  match, so no override is needed here -- unlike the early era, which needs
  `'total operating revenues'` added and therefore has its own config in
  scripts/extractBainbridgeEarly.py.

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
    source_rounding={},   # Task 7/8 registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
