#!/usr/bin/env python3
"""
City of Grand Forks, ND ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; North Dakota's first local entities in TT alongside Grand Forks
County, both members of the `nd-local-acfr-gf` family.

⚠ NOT GRAND FORKS COUNTY, whose statement is a different shape entirely: the
county prints flat revenue and `Capital outlay` as a valued ROOT LEAF, while
this city groups revenue under `Taxes:` and makes `Capital outlay:` a PARENT
with children. Same name, same county seat, two different documents — see
scripts/extractGrandForksCountyND.py. **EIN 456002085 is the city**; the county
is 456002215.

⚠ NOT the Grand Forks Public School District No. 1, the Grand Forks AIR FORCE
BASE Public School District No. 140, the Grand Forks Housing Authority, the
Grand Forks Regional Airport Authority, Grand Forks Homes Inc., or the Grand
Forks-East Grand Forks Metropolitan Planning Organization — all of which a name
query returns.

── ⚠⚠ FY2025 IS FILED UNDER THE WRONG STATE ────────────────────────────────

FAC records City of Grand Forks FY2025 with **`auditee_state = MN`**. A state
filter over the bulk data silently DROPPED it, and it was recovered only by
re-querying on EIN; its cover page reads "City of Grand Forks, North Dakota …
December 31, 2025". **Filter FAC by `auditee_ein`, never by state or name.**

── WHY FAC, AND NOT THE CITY'S OWN SITE ────────────────────────────────────

`grandforksgov.com` 403s a plain client AND a full browser header set — the
charlottenc.gov fingerprint. The ND State Auditor mirrors FY2022-FY2024 at
`nd.gov/auditor/.../Local Gov/`, but that mirror is already rotting (its indexed
`2019 Grand Forks County.pdf` now 404s), and its copies are the ACFR alone while
FAC's include the single-audit supplement. FAC holds all ten years permanently.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption; FY2024 General Fund total
revenues print as 51,508,950 for a city of ~59,000. `units=1` (the default).

⚠ Unlike Grand Forks COUNTY, this city prints WHOLE DOLLARS in every year — the
county's FY2016-FY2021 state-auditor era prints cents and needs
`decimal_money=True`. Two governments in one town, two money regimes. Read per
entity; never carry the setting across.

── ⚠ THE STATEMENT CARRIES A PRIOR-YEAR COMPARATIVE COLUMN ─────────────────

The title block reads `WITH COMPARATIVE TOTALS FOR DECEMBER 31, 2023`, and the
statement ends with TWO total columns — `Total Governmental Funds 2024` and
`… 2023`. The General Fund column is the FIRST money column, so the default
positional read takes the correct one, but note that a strategy keying on the
LAST column would silently load the PRIOR YEAR's all-funds total. Verified by
the tie against the current-year printed General Fund total.

── STRUCTURE, READ FROM THE PRINTED PAGE (FY2024, Exhibit 4 p.46) ──────────

    REVENUES
       Taxes:                                <- GROUP PARENT
           Property / Sales / Hotel/Motel Tax
       Licenses and permits / Intergovernmental / Charges for services /
       Special assessments / Fines and forfeits / Lease revenues /
       Investment earnings (loss) / Miscellaneous
    EXPENDITURES
       Current:                              <- parent
           General government / Health & welfare / Public safety /
           Highway & streets / Culture and recreation
       Debt service:                         <- parent
           Principal / Interest and fiscal charges / Bond issuance costs /
           Contractual services
       Capital outlay:                       <- PARENT, not a root leaf
           General government / Health & welfare / Culture and recreation ...

⚠⚠ `revenue_group_members` IS MANDATORY HERE, AND IS THE SESSION-7B TRAP.

With `revenue_parents=('taxes',)` and no members, the group closes after its
FIRST child: `Property` would nest under `Taxes` while `Sales` and `Hotel/Motel
Tax` stood as ROOT categories — **and the statement would still tie to the
cent**, because the multiset of amounts is unchanged and only the parenting
moves. That is exactly how Boulder shipped a wrong tree at $0 in session 7b.

The members are label SUFFIXES that keep the group open. Grand Forks' three tax
children are `Property`, `Sales` and `Hotel/Motel Tax` — they share no common
suffix the way Boulder's six "…taxes" lines did, so all three are declared
explicitly. The line that follows the group is `Licenses and permits`, which
matches none of them and therefore closes it in exactly the right place.

⚠ `Capital outlay:` is a PARENT here — the same words are a valued ROOT LEAF on
Grand Forks County's statement, twenty minutes away. A wrong reading would tie.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='City of Grand Forks, ND',
    parents=('current', 'debt service', 'capital outlay'),
    root_leaves=(),
    revenue_parents=('taxes',),
    revenue_group_members=('property', 'sales', 'hotel/motel tax'),
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
