#!/usr/bin/env python3
"""
City of Aberdeen, SD — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; South Dakota's FIRST local entities in TT alongside Brown County,
both members of the `sd-local-acfr-gf` family.

⚠⚠ NOT **Aberdeen, MARYLAND**, which publishes its own ACFR at `aberdeenmd.gov`
and is not a Knight entity. ⚠ NOT Aberdeen School District 6-1 or the Housing
and Redevelopment Commission of the City of Aberdeen, both of which a name query
returns. **EIN 466000010 is the city.**

⚠ The city's own cover page says only "City of Aberdeen" with no state — SD is
confirmed from the 52 in-document mentions of South Dakota and from the FAC
filing state, not from the cover.

── SOURCES: TWO ROUTES, NEITHER COMPLETE ───────────────────────────────────

  FY2016-FY2024   Federal Audit Clearinghouse by report_id
  FY2006-FY2009   the city's own CivicPlus archive,
                  `/ArchiveCenter/ViewFile/Item/<id>`

⚠⚠ THE ARCHIVE IDS RUN DESCENDING BY YEAR — 47=FY2009, 48=FY2008, 49=FY2007,
50=FY2006. Derivable-looking and therefore dangerous; each was read from the
archive listing and then confirmed against the fiscal year printed on the
document's own cover page. The Wichita lesson: two adjacent inversions there
would have loaded one year's money under another year's label with every tie
still passing.

⚠ Archive items 51, 52 and 53 are almost certainly FY2005, FY2004 and FY2003 but
have NO TEXT LAYER AT ALL, so their years are unconfirmed and they are not
loaded. FY2010-FY2015 are on neither route: not in the city archive, and before
FAC's coverage begins. Reported as gaps, never written as $0.

── ⚠⚠ THE STATEMENT SPANS TWO PAGES ────────────────────────────────────────

`Total revenues` is on p26 and `Total expenditures` on p27 (FY2024). The
single-page page finder rejected the document outright — "primary GF statement
not found" — because it requires both totals on one page. `multipage=True` joins
the span; the join stops as soon as both totals are present and refuses to cross
an `_EXCLUDE` page.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption; FY2024 General Fund total
revenues print as 30,485,309 for a city of ~28,000. `units=1` (the default).
⚠ Unlike Brown County twelve miles away, which prints CENTS on the modified cash
basis, this city prints whole dollars on a GAAP basis. Same county, same
auditor's town, two regimes. Read per entity.

── STRUCTURE: A NUMBERED CHART OF ACCOUNTS, THREE LEVELS DEEP ──────────────

Aberdeen prints the standard South Dakota municipal chart of accounts, and the
account CODE — not the wording — is what defines the hierarchy:

    Revenues
      310 Taxes                              <- group
          311 General property taxes ... 319 Penalties and interest
      320 Licenses and permits               <- VALUED, a peer of the groups
      330 Intergovernmental revenue          <- group
          331 Federal grants / 334 State grants
          335 State shared revenue           <- SUB-GROUP (third level)
              335.01 Bank franchise tax ... 335.08 Local government highway
          336 State payments in lieu of taxes   <- back at 330's level
          338 County shared revenue          <- SUB-GROUP
              338.03 County wheel tax
      340 Charges for goods and services / 350 Fines and forfeits /
      360 Miscellaneous revenue              <- groups
    Expenditures
      410 General government -> 411..419, then `Total general government`
      420 Public safety / 430 Public works / 440 Health and welfare /
      450 Culture and recreation / 460 Conservation and development
      470 Debt service                       <- VALUED root leaf
      492 Other expenditures                 <- VALUED root leaf

⚠⚠ `revenue_group_close='numeric_chart'` exists for exactly this. Membership
CANNOT be expressed as label suffixes — `310 Taxes`'s six children end in
"taxes", "tax deed revenue" and "delinquent taxes", sharing no usable suffix —
and it cannot be a global prefix list either, because `340 Charges…` must CLOSE
group 330 while `335.01` must stay inside it. Membership has to be relative to
the open group's own code, which is the issuer's published rule, not an
invention: a round heading owns the codes sharing its first two digits, and a
decimal heading owns the codes that extend it with a dot.

⚠ `320 Licenses and permits` and `336 State payments in lieu of taxes` are
VALUED rows that sit at their group's own level. Under the chart rule 320 closes
310 (different first two digits) while 336 stays inside 330 and closes only the
335 sub-group. Both behaviours were verified against the printed page.

── ⚠ THE PRINTED SUBTOTALS ARE USED AS AN ORACLE, NOT DISCARDED ────────────

Aberdeen prints `Total general government`, `Total public safety`, `Total public
works`, `Total health and welfare`, `Total culture and recreation` and `Total
conservation and development`. Loaded as leaves they would DOUBLE-COUNT the
whole expenditure side; skipped silently they would be a wasted check. With
`subtotal_prefixes=('total ',)` each one is asserted against the sum of the
group it closes, and any mismatch fails the extraction — six independent checks
per year on top of the grand-total tie, which is the campaign's own rule about
asserting subtotals against their own leaves.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Aberdeen, SD',
    parents=(
        '410 general government', '420 public safety', '430 public works',
        '440 health and welfare', '450 culture and recreation',
        '460 conservation and development',
    ),
    root_leaves=('470 debt service', '492 other expenditures'),
    subtotal_prefixes=('total ',),
    revenue_parents=(
        '310 taxes', '330 intergovernmental revenue',
        '340 charges for goods and services', '350 fines and forfeits',
        '360 miscellaneous revenue',
    ),
    revenue_subparents=('335 state shared revenue', '338 county shared revenue'),
    revenue_group_close='numeric_chart',
    leading_account_code=True,
    # ⚠ `335.04 Motor vehicle licenses (5%)` — `label_of` cuts a label at the
    # first money token after which no WORD remains, and the `5` inside `(5%)`
    # is followed only by `%)` and the figures, so the label truncated to
    # `... licenses (`. This is the Kent `Fire District # 37 Contract` shape: a
    # number that belongs to the NAME. Repaired by EXACT match, never by a
    # heuristic — a rule that re-joined any truncated parenthesis would corrupt
    # legitimate labels elsewhere.
    label_fixes={
        '335.04 Motor vehicle licenses (': '335.04 Motor vehicle licenses (5%)',
    },
    multipage=True,
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
