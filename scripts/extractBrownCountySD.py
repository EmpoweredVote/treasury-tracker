#!/usr/bin/env python3
"""
Brown County, SD — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; South Dakota's first local entities in TT alongside the City of
Aberdeen (its county seat), both members of the `sd-local-acfr-gf` family.

⚠ NOT Brown County WISCONSIN, MINNESOTA, OHIO, INDIANA, KANSAS, TEXAS or the
several other Brown Counties. **EIN 466000011 is this county**; the City of
Aberdeen is 466000010, one digit away.

── ⚠⚠ THIS ENTITY IS NOT GAAP. IT REPORTS ON THE MODIFIED CASH BASIS. ──────

Alone among session 8's seven entities, Brown County is an OCBOA filer. Its own
statements say so in their titles — `STATEMENT OF REVENUES, EXPENDITURES AND
CHANGES IN FUND BALANCES - MODIFIED CASH BASIS` — and the auditor's report
states it outright:

    "the financial statements are prepared on the modified cash basis of
     accounting, which is a basis of accounting other than accounting
     principles generally accepted in the United States of America"

FAC corroborates independently: `gaap_results = not_gaap` on every filing.

⚠⚠ **THESE ROWS MUST NOT CARRY `audit_grade: audited_gaap`, AND THEIR `basis`
IS NOT THE ACCRUAL/GAAP VALUE THE OTHER SIX ENTITIES USE.** They are genuinely
AUDITED — by the South Dakota Department of Legislative Audit, under Government
Auditing Standards — but on a different measurement basis, so a reader comparing
this county's General Fund to Aberdeen's is comparing two different things
unless the basis is stated. Registry entries are a deliberate decision recorded
in `.planning/KNIGHT-COMMUNITIES-PROGRESS.md`, not a loader default.

── ⚠ MONEY IS PRINTED IN CENTS ─────────────────────────────────────────────

`641,556.92`, not `641,557`. `decimal_money=True` runs the whole pipeline in
integer cents so the tie is exact, converting to dollars once at emission.
Without it `-table` splits `641,556.92` into `641,556` and `92`, and the column
reader can return the CENTS as the row's value — that is how Grand Forks County
FY2016 read `Economic development` as **41**.

⚠ The City of Aberdeen, twelve miles away and audited in the same town, prints
WHOLE DOLLARS on a GAAP basis. Never carry either setting between them.

── ⚠⚠ THE STATEMENT SPANS FOUR PAGES ───────────────────────────────────────

FY2024: p18 opens it, p19 finishes revenues and starts expenditures, p20 repeats
the title with "(Continued)", p21 reaches `Total Expenditures`. The single-page
finder rejects the document outright. `multipage=True` joins the span and stops
at p21 because p22 is `STATEMENT OF NET POSITION` and `net position` is already
an `_EXCLUDE` term — the join can never run past the statement it belongs to.

── STRUCTURE: EVERY LEAF SITS UNDER A SUB-HEADING (THREE LEVELS) ───────────

    Revenues:
      Taxes:
      Intergovernmental Revenue:
          State Shared Revenue:        <- sub-group
      Charges for Goods and Services: / Fines and Forfeits: /
      Miscellaneous Revenue:
    Expenditures:
      General Government:
          Legislative: / Financial Administration: / Legal Services: /
          Other General Government:
      Public Safety:
          Law Enforcement: / Protective and Emergency Services:
      Public Works:
          Highways and Bridges:
      Health and Welfare:
          Economic Assistance: / Health Assistance: / Social Services: /
          Mental Health Services:
      Culture and Recreation:
          Culture: / Recreation:
      Conservation of Natural Resources:
          Soil Conservation:
      Urban and Economic Development:
          Urban Development:

⚠ `subparent_close='next_heading'` and `revenue_group_close='next_heading'`
rather than member prefixes: this issuer's sub-groups are EXHAUSTIVE — every
leaf sits under one — and its labels carry no account codes to match on, unlike
Aberdeen's numbered chart. A group therefore stays open until the next declared
heading, which is exactly how the page reads.

⚠ `Law Enforcement:` arrives as `16  Law Enforcement:` on some pages — a page
footer that `-table` interleaves onto the row. `_LEADING_PAGE_NUMBER` strips it
(it requires two or more spaces after the number, which is what a footer leaves
and an account code does not).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Brown County, SD',
    parents=(
        'general government', 'public safety', 'public works',
        'health and welfare', 'culture and recreation',
        'conservation of natural resources', 'urban and economic development',
    ),
    subparents=(
        'legislative', 'financial administration', 'legal services',
        'other general government', 'law enforcement',
        'protective and emergency services', 'highways and bridges',
        'economic assistance', 'health assistance', 'social services',
        'mental health services', 'culture', 'recreation',
        'soil conservation', 'urban development',
    ),
    subparent_close='next_heading',
    revenue_parents=(
        'taxes', 'intergovernmental revenue', 'charges for goods and services',
        'fines and forfeits', 'miscellaneous revenue',
    ),
    revenue_subparents=('state shared revenue',),
    revenue_group_close='next_heading',
    decimal_money=True,
    multipage=True,
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
