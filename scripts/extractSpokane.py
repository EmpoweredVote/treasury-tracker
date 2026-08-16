#!/usr/bin/env python3
"""
City of Spokane, WA — General Fund extractor (GAAP actuals).
Thin wrapper over scripts/lib/acfrGF.py.
Source is the WA State Auditor's bound financial statements (MCAG 0724).

Spokane specifics
-----------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1. The statement carries no "(in
  thousands)" caption in any of the 20 loaded years, and FY2024 prints Taxes as
  216,713,093. This is the OPPOSITE of Tacoma, the other city onboarded in this
  milestone, which prints in thousands. The tie gate is unit-invariant and
  cannot tell the two apart -- it reads $0 either way -- so the per-capita band
  in the loader is the only guard that fires on this mistake.

* The General Fund is the LEFTMOST money column in every year. Column count
  varies a lot (2 in FY2019, 3-5 elsewhere, 7 in FY2007) because Spokane's set
  of major governmental funds changes year to year; nothing in this config
  depends on that count.

* `pdftotext -layout` IS UNUSABLE on this issuer, exactly as it is on Tacoma:
  it emits labels and values on DIFFERENT output lines, shifted by a row, so
  "Total Revenues 1,302,655" pairs a label with its neighbour's figure.
  `-table` reconstructs the grid correctly and is what this extractor reads.

WHY column_strategy IS 'positional'
-----------------------------------
FY2005 prints TWO expenditure rows with a blank General Fund-side cell --
`Physical environment` and `Mental and physical health` carry four numbers
where every sibling carries five -- and FY2007 prints one. The ordinal reader
counts cells back from the right end of the row, so a missing cell silently
shifts a column and reads the neighbouring fund's figure as the General Fund
figure. The positional reader anchors each column's x-range from the
fully-populated totals row and correctly sees the cell as absent. This is the
same trap Tacoma FY2023 sprang; Spokane sprang it first, in FY2005.

CAPITAL OUTLAY IS A ROOT PEER, AND ONLY ONE ERA SAYS SO
-------------------------------------------------------
The tree question this config has to answer is whether `Capital outlay` hangs
under `Current:` or sits beside it. FY2015 onward CANNOT answer it: those
statements print every label at the same x, with no indentation at all, so the
document says nothing about nesting beyond the colons on the two group
headings.

FY2004 still prints the indentation, and settles it:

    x=39  Current:
    x=41      General government ... Culture and recreation
    x=39  Capital outlay              <- back at the parent level, a ROOT PEER
    x=39  Debt service:
    x=41      Principal / Interest

That is GASB's character classification (Current / Debt service / Capital
outlay as three peers) and it matches Tacoma. The later eras inherit the
reading from the era that can still be read, rather than from an assumption.
Guessing the other way still ties at $0 -- it just inflates the Current
subtotal by the capital line, which no arithmetic gate can see.

TWO SPELLING DRIFTS THAT ONE CONFIG ABSORBS
-------------------------------------------
* `Capital outlay` (FY2004-FY2011) vs `Capital outlays` (FY2013-FY2024).
  `root_leaves` entries are PREFIXES, so the singular covers both.
* `Current:` / `Debt service:` (most years) vs `Current` / `Debt service`
  (FY2018, FY2022). The library matches parents on the colon-stripped label,
  so both read identically.

Neither is an era split, so neither shortens the window.

FY2007 CARRIES BOTH SAO PAGE-FURNITURE ARTIFACTS ON ONE PAGE
-------------------------------------------------------------
`-table` puts the page-footer PAGE NUMBER (`41`) at column 0 of the
`Debt service:` row, and welds the rotated "Washington State Auditor's Office"
credit onto the front of the `Physical environment` row.

The first is handled by the library's `_recover_label_past_leading_page_number`
and needs nothing here -- the group opens normally.

The second does not repair itself. The FIGURE is correct and the row ties at
$0, so no arithmetic gate sees it; it is a label corruption of exactly the
class v2.22 found in Bainbridge FY2013, where a rendered margin rule shipped to
production inside a category name. Repaired with an EXACT `label_fixes` entry,
because a heuristic that stripped anything resembling page furniture would
eventually eat a real label.

The key is the WHITESPACE-COLLAPSED label, which is what `label_of()` produces
and therefore what `_fix_label` is handed -- keying on the wide spacing that
appears in the raw `-table` line silently never matches.

ONE YEAR IS EXCLUDED, A SOURCE-DOCUMENT DEFECT
-----------------------------------------------
FY2012's statement pages carry NO TEXT LAYER AT ALL: `pdftotext` returns only
the SAO page furniture ("Washington State Auditor's Office  Page 55") for every
page in the statement range. The report passes the fetch-time content guard
only because the auditor's opinion letter, which IS text-bearing, names the
statements in prose. FY2011 and FY2013 both extract cleanly, so FY2012 is an
ISOLATED year and the window continues past it under the milestone's floor
rule.

A NOTE ON PAGE SELECTION, RECORDED BECAUSE IT IS A NEAR MISS
-------------------------------------------------------------
Spokane publishes a supplementary `Schedule of General Fund Accounts` that
breaks the General Fund into sub-accounts (Code Enforcement, Library, Housing
Trust, EMS) with an Eliminations column and a Total column -- and that Total
column EQUALS the basic statement's General Fund column. It carries the same
"Statement of Revenues, Expenditures, and Changes in Fund Balances" title and
its own Total Revenues / Total Expenditures rows, so it would parse cleanly and
tie at $0 while being the wrong schedule.

`find_statement_page` rejects it only by taking the EARLIEST qualifying page
(the basic statement is p.48 in FY2024, the schedule p.200) -- the thin
invariant this repo has been burned by before. What actually rules it out is
that its caption does not say "Governmental Funds", and that is asserted
independently, on every loaded row, by scripts/verify-wa-rederive.mjs.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Spokane, WA',
    # Printed with colons in most years and without them in FY2018/FY2022; the
    # library matches on the colon-stripped label, so one entry covers both.
    parents=('current', 'debt service'),
    # A PREFIX, so it covers `Capital outlay` (FY2004-FY2011) and `Capital
    # outlays` (FY2013-FY2024) from one entry. A root peer, not a Current
    # child -- see the FY2004 indentation reading above.
    root_leaves=('capital outlay',),
    # Spokane prints `Taxes` as a valued LEAF in all 20 years. Opening a
    # revenue group here would fire on a row that carries a value.
    revenue_parents=(),
    revenue_group_members=(),
    # FY2005 and FY2007 print rows with a blank cell. See above.
    column_strategy='positional',
    units=1,
    fy_end=('December', 31),
    label_fixes={
        # FY2007 p.44 only, and the key is the COLLAPSED label as label_of()
        # emits it, not the raw `-table` spacing. Every other year prints this
        # row normally.
        "Washington State Auditor's Office Physical environment": 'Physical environment',
    },
    source_rounding={},   # the load task registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
