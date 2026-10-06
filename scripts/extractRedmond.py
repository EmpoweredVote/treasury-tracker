#!/usr/bin/env python3
"""
City of Redmond, WA — General Fund extractor (MCAG 0425).

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Ninth WA SAO
entity in Treasury Tracker; King County, alongside Bellevue and Kent.

WINDOW: FY2011-FY2024 less FY2017-FY2019 = 11 years, 22 rows.

── ⚠⚠ FY2006-FY2010 ARE READABLE AND DELIBERATELY NOT LOADED ───────────────

The floor rule walks back from the newest filing and stops at two CONSECUTIVE
unreadable years. Redmond has THREE (FY2017-FY2019), so the mechanical rule
ends the window at FY2020. The Kent deviation was taken -- on Kent's exact
justification, that the years below the gap parse on the UNCHANGED config --
which reaches FY2011 and no further:

    FY2007-FY2010   print the statement across TWO pages ("Page 1 of 2") and
                    would need `multipage=True`
    FY2006          captions it "Changes in Fund Balance" (SINGULAR) and would
                    need its own `statement_anchor`

Both are one line of config on existing library features, and that is exactly
why the line is worth holding: the floor rule's era-split clause says a city
that needs a second config for an era split does not get one. The statement's
shape changes at FY2010. Extending through a documented shape change AND a
three-year gap, because the config is cheap, is the reasoning the rule exists
to refuse. See the spec §2.1.1; the ARNs are recorded in §6 so revisiting the
decision needs no re-recon.

⚠ DO NOT ADD `multipage=True` OR A `statement_anchor` HERE to pick those years
up. Either one silently reopens a decision that was made deliberately.

── ⚠ FY2017-FY2019: THE DIGITS ARE ABSENT, NOT ENCODED ─────────────────────

The statement pages carry a rich text layer under a constant +29 byte shift:

    &,7<2)5('021'              -> CITY OF REDMOND
    67$7(0(172)5(9(18(6        -> STATEMENT OF REVENUES
    $1'&+$1*(6,1)81'%$/$1&(6   -> AND CHANGES IN FUND BALANCES

Every LABEL decodes. No DIGIT does. Under that shift an original '0'-'9'
(0x30-0x39) would land on bytes 0x13-0x1C, and the extracted pages contain ZERO
bytes in that range -- the year is missing from "FOR THE YEAR ENDED DECEMBER"
for the same reason. A decode returning a complete tree of correctly-named rows
and no money is not a partial success; there is nothing to load. Same class as
Bainbridge FY2010, Kent FY2019/FY2020/FY2023 and Vancouver FY2024.

⚠ FY2004/FY2005 are a DIFFERENT defect -- CCITT stencil scans at 300dpi with
1-2 money tokens in the entire document -- and need a different probe to
detect. Do not record them as the same thing.

── CONFIG, EVERY FIELD READ FROM REDMOND'S OWN STATEMENTS ──────────────────

Evidence: docs/superpowers/plans/REDMOND-RECON.md.

* `column_strategy='positional'`, `target_column=0`. NOT ordinal. Redmond
  prints a BLANK -- not a dash, nothing -- where a fund has no amount in a
  column, so rows carry 3 cells where the widest carries 5, in EVERY one of the
  11 years. An ordinal reader counts back from the right end and silently
  shifts a column. The General Fund is the leftmost money column:
  General | Capital Improvements Program | Other Governmental | Total.
* `parents=('current', 'debt service')` and `root_leaves=('capital outlay',)`,
  read from `-lineprinter` TRUE GEOMETRY, not `-layout` (which reflows this
  issuer's pages badly enough to scramble labels against values). Three levels,
  consistent across the window: section headers at x=34/55/45, level 1 at
  x=37/58/48, level 2 at x=40/60/50 for FY2011/FY2016/FY2024. `capital outlay`
  sits at LEVEL 1 -- a PEER of the two parents, carrying its own value.
  ⚠ The shape can INVERT: Bellevue prints `Capital outlay` as a PARENT. The
  wrong choice still ties at $0.
* `revenue_parents=()` / `revenue_group_members=()`. The revenue side is FLAT
  in all 11 years -- no group heading, no wrapped label.
  ⚠ Declaring `revenue_parents` without `revenue_group_members` closes the
  group after its FIRST child and silently reparents every later sibling, and
  the statement still ties. Declaring neither is the correct description here.
* AMOUNTS ARE WHOLE DOLLARS -> units=1. Like Spokane, Vancouver, Kent and
  Everett; unlike Tacoma and Bellevue. The tie gate is unit-invariant, so the
  roster's per-capita band is the only guard that fires on a wrong multiplier.
* No `statement_anchor`: the caption is the library's default form in all 11
  years (the singular variant is FY2006 only, outside the window).
* No `label_fixes`: no letter-spacing, no page furniture, no damaged headings.
* No `empty_rows`: Redmond prints a value or a dash in the General Fund column
  on every line item inside both sections.

NO WRONG-PAGE TRAP EXISTS IN THIS CORPUS. Page identity resolved to EXACTLY ONE
candidate in all 11 years. Unlike Spokane (whose `Schedule of General Fund
Accounts` Total column equals the basic statement's GF column) and Vancouver
FY2021 (an identically-titled p.2), Redmond prints the statement once.

⚠ Child labels vary across the window while the structure does not: FY2011
prints `Security of persons and property`, `Physical environment`, `Mental
physical health`; FY2024 prints `Public safety`, `Social services`. Different
rows, same tree. Do not "normalise" them.

Usage:
  <python> scripts/extractRedmond.py "docs/Redmond/redmond-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Redmond, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='positional',
    target_column=0,
    units=1,
    fy_end=('December', 31),
    source_rounding={},   # Task 6 registers any confirmed printed-total artifact
)

if __name__ == '__main__':
    run_cli(CONFIG)
