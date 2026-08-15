#!/usr/bin/env python3
"""
Kitsap County, WA — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

Source is the WA State Auditor's bound financial statements (MCAG 0132).
Kitsap is large enough to publish its own ACFR on kitsap.gov, yet SAO STILL
binds its full statements -- which is what disproved v2.21's over-general
"SAO does not publish local-government financial statements" finding. The
kitsap.gov copy is retained as an INDEPENDENT re-derivation oracle, not as
the load source.

Kitsap specifics
----------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1.
* Statement splits across two pages; the GF column and both Total rows are
  wholly on page 1, so find_statement_page's earliest-qualifying-page rule is
  correct here (same as King County).
* Revenue side is FLAT. Three labels END in "Taxes" ("Retail Sales & Use
  Taxes") but there is NO `Taxes:` parent row, so revenue_parents stays empty
  -- the opposite of King County, which does print the parent.
* Expenditure tree is the Bend/Tualatin/King County shape: `Current` and
  `Debt Service` are parents, `Capital Outlay` is a VALUED ROOT LEAF.
* County vocabulary uses AMPERSANDS: `Retail Sales & Use Taxes`,
  `Fines & Forfeits`, `Health & Human Services`, `Interest & Other Charges`.
* Dash-zeros in the GF column on Transportation, Health & Human Services and
  Economic Environment -- three CONSECUTIVE dash-zero rows in FY2024.
* Kitsap's extracted text collapses spaces in some headings
  ("KitsapCounty,Washington", "FortheYearEndedDecember31,2024"). This matters
  for fiscal-year parsing: acfrGF.parse_fy already widens the month/day gap to
  `\\s*` for exactly this failure mode (found on King County FY2024/FY2025).
* FY2004-2016 title their combined governmental-funds statement "Statement of
  REVENUE, Expenditures, and Changes in Fund Balances" -- REVENUE SINGULAR,
  not the "Revenues" (plural) the shared `_TITLE` regex requires (the same
  kind of singular/plural document variance CityConfig's docstring already
  documents for Tigard's "Fund Balance"). Every individual-fund
  Budget-and-Actual schedule in the SAME documents (General Fund, County
  Roads, Real Estate Excise Tax, Mental Health...) consistently uses the
  PLURAL "Revenues," so the distinction is real and stable across years, not
  a one-off typo -- confirmed by inspecting every candidate page's title text
  directly with `pdftotext -table` across FY2004-2016.
  `statement_anchor` (an ADDITIONAL regex ORed with `_TITLE`, per its
  existing contract -- see Seattle's B-4 schedule-ID use in acfrGF.py) covers
  this without touching the shared library: it matches the singular form
  specifically, so it can never itself turn a PLURAL-titled page (any
  Budget-and-Actual schedule, or a different fund's) into a false positive.
  CONFIRMED LIVE FAILURE MODE without this anchor, enumerated across all 21
  years (not a single spot check): 10 of the 13 singular-titled years
  (FY2004-2016) silently select the WRONG page as the primary GF statement,
  and 9 of those 10 still TIE AT $0 against that wrong page's own, smaller
  totals -- only FY2004/2015/2016 fail loudly instead. Examples: FY2005 picks
  the County Roads Budget-and-Actual schedule ($29,279,443); FY2008 picks
  page 33 ($38,874,052); FY2013 picks the Real Estate Excise Tax Fund's own
  Budget-and-Actual schedule ($354,295 vs the true $75,935,769); FY2014 picks
  page 43 ($304,600); FY2010 both mis-selects the page AND mis-parses the
  fiscal year as 2009. Every one of these wrong pages ties at $0 against its
  OWN totals -- a clean demonstration that a $0 tie proves arithmetic, never
  which page was read.
  BE PRECISE ABOUT WHAT ACTUALLY PROTECTS THIS: it is NOT that
  `find_statement_page`'s `_EXCLUDE` list keeps a Budget-and-Actual page from
  ever qualifying as a candidate. `_EXCLUDE` checks the LITERAL substring
  `'budget and actual'`, and `pdftotext -table` routinely inserts extra
  whitespace inside that phrase ("- Budget and                   Actual"),
  which defeats the literal match. Budget-and-Actual pages ARE live
  candidates in FY2005-2014 and, confirmed, in FY2021 too (pages 54/55/56
  qualify there alongside the true statement at page 49). The only thing
  protecting every year is that `find_statement_page` returns the EARLIEST
  qualifying candidate, and the true combined statement sorts earlier than
  every Budget-and-Actual schedule in every year inspected. That is the real,
  thinner invariant -- and exactly what a future change in document ordering
  (SAO reordering the basic statements after the individual-fund schedules,
  for instance) would silently break. A maintainer relying on the `_EXCLUDE`
  list for protection would not know to check for that.
* FY2017, FY2018 and FY2019 have a SOURCE-DOCUMENT FONT DEFECT, not a parser
  bug: `pdftotext` (any of plain / -table / -layout / -raw) decodes large
  portions of these three PDFs -- including the basic financial statements
  section containing the GF statement -- through what is consistently a
  constant +29 byte-value shift from correct ASCII (verified by hand:
  'XQUHVWULFWHG' -3 -> ... +29 each byte -> 'unrestricted'). This is a defect
  in the embedded font's encoding in the SOURCE PDF itself; no CityConfig
  option or pdftotext flag recovers it, and de-shifting the byte stream is a
  document-preprocessing operation outside a per-city CONFIG's scope. These
  three fiscal years extract garbage or fail outright and are reported as
  BLOCKED, not silently worked around.

Usage:
  py -3 scripts/extractKitsap.py "docs/KitsapCounty/kitsap-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Kitsap County, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    # FY2004-2016 print "Statement of REVENUE, Expenditures, and Changes in
    # Fund Balances" (singular) on the combined governmental-funds actual
    # statement -- see the module docstring's "FY2004-2016 title..." note
    # above for the confirmed live failure this fixes (FY2013 silently
    # landing on the wrong page's $354,295 instead of the true $75,935,769).
    statement_anchor=r'Statement\s+of\s+Revenue\s*,\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances?',
    source_rounding={},   # Task 7 registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
