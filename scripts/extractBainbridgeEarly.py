#!/usr/bin/env python3
"""
City of Bainbridge Island, WA — General Fund extractor, EARLY ERA (GAAP actuals).

COVERS FY2004, FY2005, FY2007 and FY2008 ONLY. For FY2010-FY2025 use
scripts/extractBainbridge.py instead -- that era's expenditure tree is
genuinely differently shaped (see below) and CityConfig is one tree shape
per config, not an era-aware switch. FY2006 has no usable filing (image-only
scan, excluded upstream). FY2009 is font-corrupted (a separate, later task).

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

KNOWN UNRESOLVED DEFECT -- library-level, out of scope for this config
------------------------------------------------------------------------
Every one of the four years has ALSO lost exactly one expenditure row
entirely (both its label AND its GF value), to a THIRD kind of artifact:
a page-footer PAGE NUMBER (a bare one- or two-digit integer, e.g. "16" or
"21") lands at the very START of one data row's rendered line -- not glued
onto an existing label like the "Washington State Auditor's Office" case
above, but landing BEFORE any label text at all. Because the page number is
itself a bare digit sequence, acfrGF.py's row classifier reads it as the
row's FIRST money token / column slot; `label_of`/`label_of_slots` then
returns everything strictly BEFORE that first token as the label, which is
EMPTY (the page number is at position 0). `build_operating` drops any row
whose label is empty (`if not full: continue`), so the row vanishes with no
trace in `zero_rows` either -- the true label is discarded along with the
true value, silently.

Confirmed line-by-line in `pdftotext -table` output for all four years
(GF value quoted is the row's TRUE value, verified against its own
document's printed Total Expenditures by hand-summing every other row):

    FY2004 page 19: '16 ... Transportation ... 75 ...'                  (true GF value: 75)
    FY2005 page 19: '16 ... Transportation ... 7,270 ...'                (true GF value: 7,270)
    FY2007 page 24: '21 ... Economic environment ... 2,323,355 ...'      (true GF value: 2,323,355)
    FY2008 page 19: '16 ... Health and human services ... 452,200 ...'   (true GF value: 452,200)

These EXACTLY account for this extractor's operating tie_delta in each year
(-76, -7,270, -2,323,355, -452,200 respectively; FY2004's -76 additionally
includes a $1 same-species-as-elsewhere document rounding residue once the
missing $75 is accounted for: -76 = -75 - 1). No CityConfig knob -- not
label_fixes (there is no label to rewrite; the row never reaches the tree),
not parents/root_leaves (both operate on rows that already carry a label) --
can recover a row that acfrGF.py's classifier has already reduced to an
empty label. Fixing this needs a change to acfrGF.py's row-classification
logic (e.g. recognising and stripping a lone leading page-number token
before parsing the rest of the line), which is explicitly OUT OF SCOPE for
this round -- reported, not attempted. See task-4-report.md, fix round 2,
for the full diagnosis.

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
    source_rounding={},   # Task 8 adjudicates every residue against the rendered page
)

if __name__ == '__main__':
    run_cli(CONFIG)
