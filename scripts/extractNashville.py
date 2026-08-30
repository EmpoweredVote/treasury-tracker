#!/usr/bin/env python3
"""
The Metropolitan Government of Nashville and Davidson County, TN — General Fund
extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 6b; Tennessee's FIRST local entity in TT.

⚠ ONE ENTITY, NOT TWO. Nashville and Davidson County are a single consolidated
government, so this is `entity_type='city'` with `county_id` NULL — the
convention settled 2026-08-30 across San Francisco, Philadelphia, Macon-Bibb and
Columbus-Muscogee. Creating a city AND a county here would double-count Metro in
every state and national rollup (spec §4.5).

-- ⚠⚠ WHY THE BULK SOURCE IS NOT USED ---------------------------------------

Tennessee HAS an excellent statewide source and it cannot serve this entity. The
Comptroller's TAG export carries fund/account/object detail for all 95 counties,
FY2007–2025, prepared by the Division of Local Government Audit — which audits 91
of them itself. Davidson is one of the FOUR audited by a CPA firm instead
(with Hamilton, Knox and Shelby), and it appears in TAG at TOTAL ONLY: exactly
one revenue row and one expenditure row per year, no tree at all.

⚠⚠ AND THAT SINGLE ROW HIDES A SCOPE BREAK. Through FY2024 the `PRI` total runs
$1.72B → $4.00B; FY2025 reads $2.41B with a separate `SCH` row at $1.56B
(2.41 + 1.56 ≈ 3.96, continuous with FY2024's 4.00). The school department was
folded into the primary-government total until FY2025 and split out afterwards,
so loading the `PRI` series would render a FAKE $1.4B COLLAPSE. This is the
session-5 Lake County lesson — read the series for continuity, because no gate
sees it.

-- WHY `-table`, NOT COORDINATES --------------------------------------------

Because `-table` is CORRECT here. `pdftotext -layout` misaligns this issuer's
label and value columns the way it does Charlotte's and Columbia's, but `-table`
pairs them correctly and the General Fund column sums to the printed total on the
dollar. The coordinate reader is reserved for a DIAGNOSED mechanical failure of
`-table`, and there is none.

-- ⚠⚠ EVERY POSITIVE NUMBER CARRIES A STRAY TRAILING `)` --------------------

The text layer renders every amount on the statement pages as `835,727,083)` —
all 79 money tokens on the FY2024 page, positives included. The document ALSO
uses ordinary accounting negatives with a LEADING paren, `(213,716,851)`.

So the two forms must be told apart by the LEADING character, never the trailing
one. `acfrGF.parse_money` already does exactly that — `_MONEY` alternates a fully
bracketed `\\((?:\\d[\\d,]*)\\)` against a bare `\\$?\\s*\\d[\\d,]*`, so the stray
`)` is simply never captured and `neg` is set only by a leading `(`.

⚠ A reader that treated a trailing paren as negative would flip all 79 positives;
one that stripped every paren would flip the genuine negatives. Both would be a
whole-entity sign inversion of the kind
`project_adopted_budget_inversion_sweep` had to sweep across 106 sources. Pinned
by a test rather than left to inspection.

-- THE STATEMENT SPANS FOUR PHYSICAL PAGES ----------------------------------

Metro prints it across four pages, all carrying the same title:

    p53  REVENUES + EXPENDITURES     General, General Purpose School,
                                     Education Services, GSD Gen Purposes Debt
    p54  same rows (CONTINUED)       USD Debt, GSD Capital, Education Capital,
                                     Other Governmental, Total
    p55  OTHER FINANCING SOURCES     first fund columns
    p56  OTHER FINANCING SOURCES     remaining columns + Total

**The General Fund is the FIRST money column of the FIRST page**, and both
printed General Fund totals (`Total revenues`, `Total expenditures`) are on that
page, so nothing downstream needs the other three. ⚠ Pages 55/56 are a real
hazard for a page-picker: they repeat the title exactly and would yield an
`OTHER FINANCING SOURCES` tree that is not revenue at all.

-- ⚠ SCOPE: METRO'S GENERAL FUND EXCLUDES THE SCHOOLS ------------------------

`General Purpose School` and `Education Services` are SEPARATE major funds
alongside the General Fund, so a consolidated government's General Fund is a
smaller share of its total governmental activity than a plain city's would be.
That is what `fund_scope='general_fund'` means and it is read from the statement,
not inferred — but it is worth stating, because Metro performs both city and
county functions and a reader may expect schools inside the headline.

-- UNITS: WHOLE DOLLARS -----------------------------------------------------
No statement page carries an "in thousands" caption. FY2024 General Fund revenue
is $1,562,264,668 against roughly 715k residents, about $2,184 a head — high for
a city and correct for a government doing city AND county work.

⚠ Units are NOT checkable by the tie, which reads the printed total through the
same multiplier. The loader's per-capita guard is the only check that catches it.

-- STRUCTURE ----------------------------------------------------------------
Read off `-layout`'s leading whitespace, which survives even where its money does
not:

    REVENUES:                        (0 sp)   <- flat, no groups
    Property taxes                   (0 sp)
    Other taxes, licenses and        (0 sp)   <- WRAPPED; money is on the
      permits                        (2 sp)      continuation line
    ...
    EXPENDITURES:                    (0 sp)
       Current:                      (3 sp)   <- parent
          General government         (6 sp)
          Law enforcement and care   (6 sp)   <- WRAPPED
                of prisoners        (12 sp)
          ...
       Debt service:                 (3 sp)   <- parent
          Principal retirement       (6 sp)
          Interest                   (6 sp)
          Fiscal charges             (6 sp)
       Capital outlay                (3 sp)   <- ROOT LEAF: sits at the parents'
                                                 indent and carries money itself

⚠ Wrapped labels are pervasive on this issuer — at least six on the FY2024 page.
`acfrGF.py` joins them by default, which is the right default here: without it
the published categories would read `permits`, `money or property`,
`governmental agencies`, `damage to property`, `of prisoners` and `streets`.

Usage:
  py -3 scripts/extractNashville.py _acfr-work/tn/acfr/nashville_2024.pdf --mode revenue
  py -3 scripts/extractNashville.py _acfr-work/tn/acfr/nashville_2024.pdf --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Metropolitan Government of Nashville and Davidson County, TN',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    units=1,
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
