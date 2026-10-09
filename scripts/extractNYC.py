#!/usr/bin/env python3
"""
City of New York ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`.

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  GF expenditure-by-function tree, one parent (Debt Service)

NYC specifics
-------------
* **Fiscal year ends June 30.**

* **Units = 1000** — the caption reads `(in thousands)`. ⚠ A units error is
  INVISIBLE to the tie gate; every figure on the page scales together. The
  caption was read on this document, not carried from another entity.

* ⚠⚠ **`select_fiscal_year=True` IS LOAD-BEARING: EVERY NYC BOOK PRINTS TWO
  COMPLETE STATEMENTS** — the current year and the prior year, on consecutive
  pages, each tying at exactly $0. This is the Duvall biennial hazard in a
  different costume: taking the earliest qualifying page would publish one
  year's money under another year's label and every arithmetic gate in this
  repo would still pass. The page is therefore chosen by its own printed
  `For the Year Ended June 30, <YYYY>` caption against the year in the
  filename (`nyc-<fy>-acfr.pdf`), and a book that does not print the requested
  year fails loudly instead of yielding its first statement.

* ⚠⚠ **`exclude_ignore=('reconciliation', 'net position')` IS REQUIRED.**
  NYC prints the government-wide reconciliation note at the FOOT of the genuine
  primary statement:

      "The reconciliation of the net change in fund balances of governmental
       funds to the change in net position of governmental activities in the
       Statement of Net Position is presented in an accompanying schedule."

  That one sentence puts BOTH `reconciliation` and `net position` — two
  `_EXCLUDE` terms — on the right page. With the default list EVERY year in the
  window reports "primary GF statement not found" and NYC gets no series at
  all. Same case as Buncombe County; see `scripts/extractBuncombeCounty.py`.

* ⚠⚠ **THE ANCHOR MUST REQUIRE "GOVERNMENTAL FUNDS", AND ITS ORDER IS THE
  REVERSE OF MARION COUNTY'S.** Pages 85-86 of each modern book are:

      THE CITY OF NEW YORK
      GENERAL FUND
      STATEMENT OF REVENUES, EXPENDITURES,
      AND CHANGES IN FUND BALANCE          <- note: BALANCE, singular
      BUDGET AND ACTUAL

  `_EXCLUDE` catches that page on 'budget and actual', and this wrapper does
  NOT ignore that term — so the page is already excluded. The anchor is defence
  in depth, because that page's LAST column is `Better (Worse) Than Modified
  Budget`: a VARIANCE column. Were it ever to qualify, `target_column='last'`
  would publish variance figures as audited actuals.

  ⚠ NYC prints `GOVERNMENTAL FUNDS` BEFORE the statement title, where Marion
  County prints it after. The anchor is NOT copyable from
  `extractMarionCountyIN.py` — the two halves are in the opposite order.

* **Revenue is flat.** Eleven peers (real estate taxes, sales and use taxes,
  personal income tax, other income taxes, other taxes, Federal/State and other
  categorical aid, unrestricted Federal and State aid, charges for services,
  tobacco settlement, investment income, other revenues) with no group heading.
  Read off the printed statement, so `revenue_parents` stays empty.

* **Expenditures carry exactly one parent: `Debt Service:`**, whose children are
  Interest, Redemptions and a third line that is `Rental payments` in the modern
  books and `Lease payments` in the FY2015 era. Both sit in the same slot under
  the same parent, so the label change needs no config. Every other function
  (General government ... Administrative and other) is a root-level leaf.

Usage:
  py -3 scripts/extractNYC.py "docs/NYC/nyc-2024-acfr.pdf" --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

# ⚠ "Governmental Funds" FIRST, then the title -- the reverse of Marion County.
STATEMENT_ANCHOR = (
    r'Governmental\s+Funds[\s\S]{0,200}?'
    r'Statement\s+of\s+Revenues,?\s+Expenditures,?\s+and\s+Changes\s+in\s+Fund'
    r'\s+Balances'
)

# ⚠ The text layer letter-spaces some glyphs, so `-table` splits words. Each of
# these has a CLEAN TWIN elsewhere in the same 24-year corpus, which is what
# identifies them as transcription artifacts rather than different line items.
# Exact match on the normalised label; applies to headings as well as leaves.
LABEL_FIXES = {
    'Other re venues': 'Other revenues',
    'Renta l payment s': 'Rental payments',
    'Lease pay ments': 'Lease payments',
}

CONFIG = CityConfig(
    city='New York City',
    # ⚠ `Current Operations:` is a REAL PARENT HEADING in FY2002 and FY2004
    # only -- read off the printed indentation with `pdftotext -layout`:
    #
    #     EXPENDITURES:
    #        Current Operations:          (3 sp)  <- heading, carries no value
    #           General government        (6 sp)  <- its children
    #           Public safety and judicial
    #
    # Later books drop the heading and print the functions at root, so the
    # entry simply never matches there (the Buncombe `Intergovernmental` shape).
    # Without it the heading WELDS onto its first child and FY2002/FY2004
    # publish a category called `Current Operations General government` -- while
    # tying at exactly $0, because a weld moves no money.
    parents=('current operations', 'debt service'),
    root_leaves=(),
    label_fixes=LABEL_FIXES,
    fy_end=('June', 30),
    units=1000,
    statement_anchor=STATEMENT_ANCHOR,
    exclude_ignore=('reconciliation', 'net position'),
    select_fiscal_year=True,
    underscore_rules=True,
)

if __name__ == '__main__':
    run_cli(CONFIG)
