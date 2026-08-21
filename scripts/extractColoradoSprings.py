#!/usr/bin/env python3
"""
City of Colorado Springs, CO ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps (dash-zero rows, wrapped statement
titles, expenditure nesting, units).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

Colorado Springs specifics
--------------------------
* **Calendar fiscal year — closes December 31**, not the module default of
  June 30. Getting `fy_end` wrong does not mis-parse money; it makes `parse_fy`
  miss the statement page's own caption and fall through to a whole-document
  scan, which is the documented way to silently label a row with a
  neighbouring year (King County FY2024 once loaded as FY2023 exactly that way).

* **The right statement is Exhibit 4, and the city prints a DECOY.** The ACFR
  contains two pages whose titles both read "STATEMENT OF REVENUES,
  EXPENDITURES AND CHANGES IN FUND BALANCE(S)" and both mention the General
  Fund:

    Exhibit 4  GOVERNMENTAL FUNDS ... (GF | Road Repair Sales Tax | Non-Major |
               Total) -- GAAP actuals. THIS ONE.
    Exhibit 6  GENERAL FUND ... BUDGET AND ACTUAL, spread over FOUR pages
               (Original | Final | Actual | Variance) -- BUDGETARY basis.

  Loading Exhibit 6 would put budget-basis figures in a row labelled GAAP
  actual, and its four-page spread would truncate the tree as well. The shared
  module's `_EXCLUDE` list already carries `'budget and actual'`, and Exhibit 4
  precedes Exhibit 6 in every year, so `find_statement_page` returns Exhibit 4
  both by exclusion and by the earliest-qualifying rule. No `statement_anchor`
  is needed -- verified by reading the emitted `page` index against the printed
  exhibit number rather than assumed.

* **Whole dollars** (`units=1`, the default). The city prints full figures
  ($282,203,328 of FY2024 GF tax revenue). Not validatable by the tie gate --
  see `CityConfig.units` -- so the loader's per-capita guard holds it.

* **Expenditure nesting: `Capital outlay` is a ROOT-LEVEL PEER of `Current`,
  not a child of it,** and neither `Current` nor `Debt service` carries a
  trailing colon here. Read off the printed indentation of the FY2024
  statement (Exhibit 4, `pdftotext -layout`, which preserves the leading
  whitespace `-table` flattens):

      Colorado Springs FY2024, Exhibit 4
        Expenditures                    (0 sp)
        Current                         (0 sp)   <- parent, NO colon
             General government         (5 sp)
             Public safety
             Planning and neighborhood services
             Public works
             Parks
        Debt service                    (0 sp)   <- parent, NO colon
             Principal
             Principal - leases
             Principal - subscriptions
             Interest
             Interest - leases
             Interest - subscriptions
        Capital outlay                  (0 sp)   <- VALUED LEAF at root
             Total expenditures

  Nesting `Capital outlay` under `Current` would still tie at exactly $0 -- it
  would just inflate the Current subtotal by $24,986,648 (FY2024) and hide a
  root-level category. A tie proves arithmetic, never structure.

  `_is_section_header` in 'exact' mode ignores a trailing colon, so the
  colon-less spelling needs no `section_header_mode` override.

* **Revenue is flat** -- nine sources with no group headings (Taxes, Licenses
  permits and fines, Intergovernmental, Charges for services, Endowments and
  donations, Interfund services provided, Investment earnings, Other revenue,
  Rental income), so `revenue_parents` stays empty. Checked against the printed
  statement: leaving it empty where the source DOES group welds the group
  heading onto its first child while still tying $0.

* **FY1999-FY2010 are IMAGE-ONLY SCANS and cannot be extracted at all.**
  `pdftotext` returns 0 characters for FY1999-FY2008 across the whole document,
  9,213 for FY2009 and 4,683 for FY2010 (243- and 251-page reports). There is
  no text layer to parse -- this is an upstream publishing fact, not an
  extraction failure, and no config change reaches it. Recovering that era
  needs OCR, which is a separate decision about introducing a transcription
  step into a provenance chain that is currently byte-exact.

Usage:
  py -3 scripts/extractColoradoSprings.py "docs/ColoradoSprings/colorado-springs-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractColoradoSprings.py "docs/ColoradoSprings/colorado-springs-2024-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

# The shared `_TITLE` regex CANNOT match this city's statement heading, because
# the city prints its own name down the RIGHT MARGIN of the same lines and
# `pdftotext -table` interleaves that text into the title:
#
#   GOVERNMENTAL FUNDS                              CITY OF COLORADO SPRINGS
#   STATEMENT OF REVENUES, EXPENDITURES                             COLORADO
#   AND CHANGES IN FUND BALANCES                                   Exhibit 4
#
# so "EXPENDITURES" and "AND CHANGES" are separated by the word COLORADO, not
# by whitespace, and `Expenditures\s*,?\s+and\s+Changes` fails on all 27 years.
# This is the wrap case `CityConfig.statement_anchor` exists for (Seattle's
# FY2009 era prints "Page 1 of 2" in the same position); the anchor is used IN
# ADDITION to the title match, so nothing about other cities changes.
#
# Deliberately NOT anchored on "Exhibit 4": the exhibit NUMBER is a document
# convention that can be renumbered between years, while the wrapped title is
# the statement's own name. The bounded `{0,300}` gap is what lets the margin
# text through without letting the match run off into an unrelated later
# heading.
#
# This anchor is not a scope loophole. Every OTHER qualifying page it reaches is
# still rejected by the shared `_EXCLUDE` list, verified page-by-page on FY2012
# and FY2024: the five combining special-revenue statements are excluded by
# 'combining', and Exhibit 6 -- the four-page GENERAL FUND *BUDGET AND ACTUAL*
# schedule, which is BUDGETARY basis and would be a silent basis error -- is
# excluded by 'budget and actual'. Exactly one page survives in each year, and
# it is the governmental-funds statement.
STATEMENT_ANCHOR = (
    r'STATEMENT\s+OF\s+REVENUES,?\s+EXPENDITURES[\s\S]{0,300}?CHANGES\s+IN\s+FUND\s+BALANCES?'
)

CONFIG = CityConfig(
    city='City of Colorado Springs, CO',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
)

if __name__ == '__main__':
    run_cli(CONFIG)
