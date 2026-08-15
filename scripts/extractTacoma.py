#!/usr/bin/env python3
"""
City of Tacoma, WA — General Fund extractor (GAAP actuals).
Thin wrapper over scripts/lib/acfrGF.py.
Source is the WA State Auditor's bound financial statements (MCAG 0610).

Tacoma specifics
----------------
* AMOUNTS ARE IN THOUSANDS -> units=1000. The page says so explicitly
  ("amounts expressed in thousands"). This matches Seattle and King County
  and is the OPPOSITE of Bainbridge and Kitsap, which print whole dollars.
  The tie gate cannot catch a wrong `units` -- it is unit-invariant, reading
  $0 whether or not the multiplier was applied -- so the per-capita band in
  the loader is the only guard that fires on this mistake.

* FOUR money columns, General Fund LEFTMOST:
      General Fund | Trans Capital & Engineering | Other Governmental | Total
  Verified on FY2024 p.52: Property 69,082 + 0 + 25,847 = 94,929.

* `pdftotext -layout` IS UNUSABLE on this issuer and `-table` is required.
  On FY2024 p.52 `-layout` emits every label and every number on DIFFERENT
  output lines -- the values are shifted a dozen rows away from the labels
  they belong to, so a reader would silently pair "Property" with another
  row's money. `-table` reconstructs the grid correctly. This is only worth
  recording because `-layout` is the tool the shared library's own docs
  recommend for READING NESTING BY EYE; that advice still holds for
  indentation, but never trust its column pairing here.

THREE STATEMENT ERAS, and why one config still spans them
---------------------------------------------------------
Read across all 22 filings, Tacoma restates its statement twice:

  Era A  FY2019-FY2024   `Taxes:` is a PARENT with four children
                         (Property / Retail Sales & Use / Business / Excise).
                         Functions: General Government, Public Safety,
                         Transportation, Natural and Economic Environment,
                         Social Services, Culture and Recreation.
                         `Current:` and `Debt Service:` are parents;
                         `Capital Outlay` is a root leaf.

  Era B  FY2012-FY2017   `Taxes` is a FLAT LEAF carrying a value. Functions
                         renamed (Economic environment, Mental and physical
                         health, and in some years Utilities and environment).
                         `Capital expenditures`, not `Capital Outlay`.

  Era C  FY2003-FY2008   `Current` is printed WITHOUT ITS COLON, and the
                         functions are renamed again: `Security of persons &
                         property`, `Physical environment`, `Principal
                         retirement`, `Interest and fiscal charges`.
                         `Capital outlay` sits at root BETWEEN the functions
                         and `Debt service:`, not after it.

                         (An earlier read of this era claimed it printed no
                         `Current` parent at all. That was wrong -- an artifact
                         of a scan that required a trailing colon. The library
                         matches parents on the colon-stripped label, so the
                         bare `Current` is recognised normally. Corrected here
                         rather than left standing, because a wrong comment
                         about nesting is exactly what sends the next reader
                         looking for an era switch that is not needed.)

The config below is deliberately written to be a SUPERSET rather than an
era switch, because the library's own semantics make the extra entries inert
where they do not apply:

  * `revenue_parents=('taxes',)` only opens a group when the `Taxes` row is a
    WRAPPED label -- one carrying no value (acfrGF.build_revenue checks
    `kind == 'wrapped'`). In Eras B and C the `Taxes` row carries a value, so
    it is read as an ordinary leaf and the group never opens.
  * `parents=('current', 'debt service')` never fires in Era C, which prints
    no `Current:` row; the functions fall through to root, which is exactly
    where that era puts them.
  * `root_leaves` lists BOTH era spellings of the capital line.

Whether that superset actually holds is not a matter of reading -- it is
settled by running every year and requiring tie_delta == 0 on each. MEASURED:
one config ties at exactly $0 on 19 of the 22 filings, across all three eras.
The three exceptions are source-document defects, not config gaps, and are
excluded in scripts/lib/waRoster.mjs -- see below.

WHY column_strategy IS 'positional' AND MUST STAY THAT WAY
----------------------------------------------------------
'ordinal' -- the strategy Kitsap uses -- gets FY2023 WRONG, and wrong in the
way that matters: it produced a clean-looking total that was too high by
exactly 4,330 thousand.

FY2023's `Transportation` row has a BLANK General Fund cell. Not a dash --
nothing at all. The row prints only three numbers where every other row
prints four:

    Transportation                        4,330        38,605       42,935

The ordinal reader counts cells back from the right end of the row, so with
one cell missing it silently shifted a column and read the Trans Capital
figure (4,330) as the General Fund figure. 268,401 computed against 264,071
printed -- the difference IS the misread cell. The positional reader anchors
each column's x-range from the fully-populated `Total expenditures` row and
correctly sees the General Fund cell as absent.

This is a NEW variant of the dash-zero trap. v2.22's version printed `-` as a
placeholder, which is at least a visible token; this prints nothing, so a
reader counting tokens cannot know a cell is missing. Note that the tie gate
DID catch it here only because the misread inflated the sum -- had the missing
cell been in the last column instead, the same shift could have produced a
self-consistent wrong answer.

THREE YEARS ARE EXCLUDED, ALL SOURCE-DOCUMENT DEFECTS
------------------------------------------------------
FY2011, FY2018 and FY2021 produce "primary GF statement not found": their
statement pages carry no usable text layer. FY2018 shows the signature
plainly -- `1RWHVWRWKH)LQDQFLDO6WDWHPHQWV` is "NotestotheFinancialStatements"
under a constant +29 byte shift, the same cipher class that defeated
Bainbridge FY2010 and Kitsap FY2017-2019 in v2.22. That milestone already
proved a bounded, self-validating decode of this cipher does not recover the
money digits, so no recovery is attempted here.

All three are ISOLATED years -- FY2010/FY2012, FY2017/FY2019 and
FY2020/FY2022 all extract cleanly -- so under the milestone's floor rule they
are documented and skipped, and the window continues past them.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Tacoma, WA',
    # Era A/B print `Current:` and `Debt Service:`; Era C prints only the
    # latter. A parent that never appears is inert.
    parents=('current', 'debt service'),
    # Era A calls it `Capital Outlay`; Era B calls it `Capital expenditures`.
    # Both sit at root as peers of the parents, not inside them.
    root_leaves=('capital outlay', 'capital expenditures'),
    # Era A only -- inert in B/C, where `Taxes` carries a value and is
    # therefore a leaf rather than a wrapped parent label.
    revenue_parents=('taxes',),
    # SUFFIXES that keep a row inside the open tax group. Tacoma's tax
    # children are bare nouns, NOT "... taxes" as Seattle's are, so the
    # ('taxes',) suffix Seattle uses would close the group immediately and
    # strand Property/Retail/Business/Excise at root. The first ungrouped
    # source, `Licenses and Permits`, matches none of these, which is what
    # closes the group in the right place.
    revenue_group_members=('property', 'retail sales & use', 'business', 'excise'),
    column_strategy='positional',
    units=1000,
    fy_end=('December', 31),
    source_rounding={},   # the load task registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
