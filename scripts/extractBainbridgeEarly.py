#!/usr/bin/env python3
"""
City of Bainbridge Island, WA — General Fund extractor, EARLY ERA (GAAP actuals).

COVERS FY2004, FY2005, FY2007 and FY2008 ONLY. For FY2010-FY2025 use
scripts/extractBainbridge.py instead -- that era's expenditure tree is
genuinely differently shaped (see below) and CityConfig is one tree shape
per config, not an era-aware switch. FY2006 has no usable filing (image-only
scan, excluded upstream). FY2009 is font-corrupted and DROPPED: its
statement pages are digit-bearing but ciphered (a broken embedded font with
no usable ToUnicode CMap), and the bounded contiguous-offset decode
attempted in Task 6 found no substitution map that tied. See "Known
limitations" in
docs/superpowers/specs/2026-08-14-bainbridge-island-kitsap-onboarding-design.md.

Thin wrapper over scripts/lib/acfrGF.py.

Early-era specifics (FY2004, FY2005, FY2007, FY2008)
-----------------------------------------------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1 (the default), same as the modern era.
* Revenue side is FLAT, same as the modern era -- revenue_parents stays empty.
* Revenue subtotal prints as `Total Operating Revenues`, not `Total Revenues`
  -- revenue_total_labels adds it as a second candidate. Determined by
  running `pdftotext -table` on all four years and confirming there is no
  other candidate page in any of them (each year has exactly one page
  satisfying find_statement_page's general+fund+total-expenditures gate, so
  this is not a wrong-page risk -- verified individually per year, not
  assumed from one).
* Expenditure tree is a GENUINE STRUCTURAL DIFFERENCE from FY2010+, confirmed
  with `pdftotext -layout` on the FY2004 statement page (label-column
  indentation, since `-layout` scrambles the money columns):
    - There is NO `Current` parent. The function rows (General government,
      Judicial, Public safety, Physical environment, Transportation, Health
      and human services, Economic environment, Culture and recreation) sit
      FLAT, directly under EXPENDITURES.
    - `Debt service:` is itself a PARENT (the Hillsboro-style inversion
      CityConfig's docstring already documents for a different city) --
      label-only, introducing `Principal` and `Interest` as its two
      children. FY2010+ instead prints `Debt Service - Principal` and
      `Debt Service - Interest` as flat, single-line, valued ROOT LEAVES,
      with no separate parent.
    - `Capital outlay` is a flat root leaf in both eras.
  Hence parents=('debt service',), root_leaves=('capital outlay',) -- the
  mirror image of scripts/extractBainbridge.py's
  parents=('current',), root_leaves=('debt service', 'capital outlay').
* label_fixes repairs a cosmetic artifact confirmed in each of the four
  years' raw `pdftotext -table` output: the phrase "Washington State
  Auditor's Office" (a page-footer credit line) shares a physical output
  row with a real data line and gets glued onto the FRONT of that row's
  label by `-table`'s column-flattening. The row's MONEY is unaffected --
  this is a label-only artifact, confirmed by checking that the affected
  row's GF value reproduces its own document's printed total correctly.

Page-footer page numbers -- FIXED IN THE LIBRARY, recorded here as history
--------------------------------------------------------------------------
Each of the four years ALSO carries a THIRD artifact, distinct from the
"Washington State Auditor's Office" label glue above: a page-footer PAGE
NUMBER (a bare one- or two-digit integer, e.g. "16" or "21") lands at the
very START of one data row's rendered line, BEFORE any label text. Because
that page number is itself a bare digit run, it used to be read as the
row's first money token, leaving `label_of_slots` with an empty label --
and `build_operating` drops an empty-labelled row, so the row vanished
along with its true GF value.

`scripts/lib/acfrGF.py` now handles this directly, so nothing here has to
work around it:

  * `_recover_label_past_leading_page_number` blanks a leading 1-4 digit run
    (never a comma-formatted amount) when it is followed by a genuine 2+
    space column gap and then a letter, preserving every later character's
    absolute position so `column_strategy='positional'` cities are unmoved.
    A digit-led label such as "911 Dispatch" or "4Culture" has no such gap
    and is left byte-for-byte untouched.
  * A row that still resolves to a real GF value with no usable label now
    RAISES, naming the offending line, rather than being dropped silently.

Rows recovered in this era (GF values verified against each document's own
printed Total Expenditures by hand-summing every other row):

    FY2004 page 19: '16 ... Transportation ... 75 ...'                  (true GF value: 75)
    FY2005 page 19: '16 ... Transportation ... 7,270 ...'                (true GF value: 7,270)
    FY2007 page 24: '21 ... Economic environment ... 2,323,355 ...'      (true GF value: 2,323,355)
    FY2008 page 19: '16 ... Health and human services ... 452,200 ...'   (true GF value: 452,200)

CURRENT operating tie_deltas with the recovery in place: FY2004 -1, FY2005
0, FY2007 0, FY2008 0. FY2004's surviving -1 is a document-level rounding
residue -- the same species as the modern era's FY2025 operating -1 and
this era's FY2007 revenue +1 / FY2008 revenue -2 -- NOT a dropped row. No
residue is registered in source_rounding here; a later task adjudicates
each one against the rendered statement page.

Regression coverage lives in `scripts/lib/acfrGF.selftest.py`
(`TestLeadingPageNumberRecovery`, `TestValuesWithNoLabelRaisesLoudly`,
`TestBlankLinesAndRulesStillSkipQuietly`). See task-4-report.md fix rounds
2 and 3 for the diagnosis and the fix.

Usage:
  py -3 scripts/extractBainbridgeEarly.py "docs/BainbridgeIsland/bainbridge-2004-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Bainbridge Island, WA',
    parents=('debt service',),
    root_leaves=('capital outlay',),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    revenue_total_labels=('total revenues', 'total operating revenues'),
    label_fixes={
        "Washington State Auditor's Office General government": 'General government',
        "Washington State Auditor's Office Judicial": 'Judicial',
    },
    # Task 8: every entry below was adjudicated by RENDERING the statement page
    # (pdftoppm -r 160) and reading the General column off the image, not off
    # the text layer. In each case the extractor's component list matched the
    # page line for line and the page's own printed total disagreed with the sum
    # of the page's own printed components. Exact deltas only -- never a
    # tolerance; a year that drifts to a different delta still fails the gate.
    source_rounding={
        # FY2004 op: PDF p19 (doc page 16). General column components
        # 2,951,684 + 567,639 + 2,732,525 + 414,591 + 75 + 283,403 + 897,572
        # + 485,708 + 118,898 + 55,275 + 629,708 = 9,137,078, but the page
        # prints Total Expenditures 9,137,079. (The same page's revenue
        # components sum exactly to its printed 12,636,832, so the page is not
        # systematically mis-read.)
        (2004, 'operating'): -1,
        # FY2007 rev: PDF p24 (doc page 21). Components 5,962,203 + 6,604,859
        # + 194,378 + 321,414 + 1,888,377 + 1,126,035 + 43,221 + 206,007 =
        # 16,346,494, page prints Total Operating Revenues 16,346,493.
        (2007, 'revenue'): 1,
        # FY2008 rev: PDF p19 (doc page 16). Components 6,140,693 + 6,881,675
        # + 196,437 + 440,159 + 823,240 + 1,113,379 + 62,891 + 59,323 =
        # 15,717,797, page prints Total Operating Revenues 15,717,799.
        (2008, 'revenue'): -2,
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
