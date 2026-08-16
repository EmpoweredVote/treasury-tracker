#!/usr/bin/env python3
"""
City of Everett, WA — General Fund extractor (GAAP actuals).
Thin wrapper over scripts/lib/acfrGF.py.
Source is the WA State Auditor's bound financial statements (MCAG 0664).

ONE CONFIG FOR THE WHOLE 19-YEAR WINDOW, AND THAT IS MEASURED
--------------------------------------------------------------
Everett is the plainest issuer of the six cities in WA-CITIES-01. The Task 11
probe read all 21 filings before this file was written, and the statement shape
does not change once across FY2004-FY2024:

    REVENUES                       <- FLAT. No group heading in any year.
      Taxes / Licenses and permits / Intergovernmental revenues /
      Charges for services / Fines and forfeits / Other revenues
      (FY2019 onward adds Rent and lease revenue, Judgments and settlements,
       Interest earnings, Unrealized gains/losses — more SOURCES, same shape)
    EXPENDITURES
      Current:                     <- parent
        General government services / Security of persons and property /
        Physical environment / Transportation / Economic environment /
        Mental and physical health / Culture and recreation
      Capital outlay               <- VALUED ROOT PEER, printed at heading depth
      Debt service:                <- parent
        Principal / Interest / Other debt service costs

Read off the PRINTED INDENTATION rather than assumed: `pdftotext -lineprinter`
puts `Current`, `Capital outlay` and `Debt service` at x=52 and every child at
x=57 in FY2004, and at x=62/66 in FY2024. `Capital outlay` sits at HEADING depth
in every year, which is what makes it a root peer rather than a Current child —
the distinction a $0 tie is blind to, because the same dollars are present either
way (the Spokane FY2015 trap).

* `revenue_parents` and `revenue_group_members` stay EMPTY. The probe found ZERO
  valueless rows on the revenue side in all 19 readable years, so there is no
  colon heading to open a group and no wrapped label to carry forward. Setting
  them would hunt for structure this issuer does not print.
* `empty_rows` stays EMPTY for the same reason: Everett prints no row that is
  blank in every column. Contrast Kent, which prints four of them and shipped
  four welded labels before they were declared.
* `column_strategy='ordinal'`. The probe found ZERO incomplete rows in every year
  and BOTH sections, so no row is short and the ordinal count cannot slip. That
  is the documented test for choosing ordinal, and it is the safer choice here:
  positional dies when `-table` scatters a column across disjoint horizontal
  zones (Bellevue FY2008/09, Kitsap FY2004-2016).
* AMOUNTS ARE WHOLE DOLLARS -> units=1. No "(in thousands)" caption in any year.
  Like Spokane, Vancouver and Kent; unlike Tacoma and Bellevue. The tie gate is
  unit-invariant, so the roster's per-capita band is the only guard that fires on
  a wrong multiplier.
* No `statement_anchor` is needed: Everett titles every year
  "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES" over
  "GOVERNMENTAL FUNDS", with the General Fund as the leftmost money column, and
  page identity resolved to EXACTLY ONE candidate page in all 19 readable years.
  No wrong-page trap exists in this corpus — the first of the six cities with
  none.
* No `label_fixes`: 23 distinct labels across the whole span, none letter-spaced,
  none carrying page furniture, none containing a digit.

TWO YEARS EXCLUDED, AND THEY ARE NOT CONSECUTIVE
-------------------------------------------------
FY2005 and FY2010 have statement pages carrying ONLY the SAO page furniture — 150
characters of rule line, credit line and page number, with no labels and no digits
— while their narrative and notes pages read normally. Same class as Spokane
FY2012 and Vancouver FY2004; `pdfimages` shows the statement bodies are scans.

FY2006-FY2009 read cleanly BETWEEN them, so the milestone's floor rule (two
consecutive unreadable years end the window) is not triggered and no deviation is
claimed. Contrast Kent, whose consecutive FY2019+FY2020 gap needed an explicit
approval.

FY2025 is a SOURCE-TIMING gap, not a defect: the SAO's only City of Everett
filing for it is ARN 1040273, typed "Annual Comprehensive Financial Report",
which on this issuer is the 5-page opinion letter. Confirmed by CONTENT — the
type name is inverted on this issuer and must never be trusted.

Usage:
  py -3 scripts/extractEverett.py "docs/Everett/everett-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Everett, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    # Deliberately empty — see the docstring. The revenue side prints no group
    # heading and no wrapped label in any of the 19 readable years.
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    source_rounding={},   # the load task registers any confirmed printed-total artifacts
)

if __name__ == '__main__':
    run_cli(CONFIG)
