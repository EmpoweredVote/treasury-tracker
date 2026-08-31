#!/usr/bin/env python3
"""
Grand Forks County, ND ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; North Dakota's FIRST local entities in TT, alongside the City of
Grand Forks, and the founding members of the `nd-local-acfr-gf` family.

⚠ NOT the CITY of Grand Forks, whose statement is a different shape entirely
(the city groups its revenue under `Taxes:` and makes `Capital outlay:` a parent
with children; this county does neither). Same name, same county seat, twenty
minutes apart, two different documents — see scripts/extractGrandForksND.py.

⚠ NOT any of the FAC near-misses a name match returns for "Grand Forks": Grand
Forks Public School District No. 1, Grand Forks AIR FORCE BASE Public School
District No. 140, Grand Forks Housing Authority, Grand Forks Regional Airport
Authority, Grand Forks Homes Inc., or the Grand Forks-East Grand Forks
Metropolitan Planning Organization. **EIN 456002215 is the county** (the city is
456002085). Documents come from the Federal Audit Clearinghouse by report_id;
see `_acfr-work/s8/manifest.json`.

── WHY FAC, AND NOT THE COUNTY'S OWN SITE ───────────────────────────────────

`grandforksgov.com` 403s a plain client AND a full browser header set — the
charlottenc.gov fingerprint. The ND State Auditor mirrors some local ACFRs at
`nd.gov/auditor/.../Local Gov/`, but that mirror has ALREADY ROTTED: the indexed
`2019 Grand Forks County.pdf` now 404s, and only FY2022-2024 city reports remain.
FAC holds the auditee's own submission permanently, filed under federal penalty.

⚠ FY2018 and FY2019 ARE NOT IN FAC and are not loaded. The county fell below the
$750k single-audit threshold in those years, so no filing exists to find — this
is a genuine gap in the federal record, not a fetch failure, and the ND mirror's
copy is exactly the one that has rotted. Reported as a gap, never written as $0.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption; FY2024 General Fund total
revenues print as 27,210,456 for a county of ~73,000. `units=1` (the default).
⚠ Read per entity, never carried: the campaign has already been bitten by
Boulder city printing `(Amounts in 000's)` while Boulder COUNTY, twenty miles
away and in the same registry family, prints whole dollars.

── STRUCTURE, READ FROM THE PRINTED PAGE (FY2024, Exhibit p.13) ─────────────

    REVENUES                                 <- FLAT, no grouping
       Taxes / Licenses, permits and fees / Intergovernmental /
       Charges for services / Interest income / Miscellaneous
    EXPENDITURES
       Current                               <- parent, printed WITHOUT a colon
           General government / Public safety / Health and welfare /
           Conserv. of natural resources / Economic development
       Capital outlay                        <- root leaf, peer of the parents
       Debt Service                          <- parent, printed WITHOUT a colon
           Principal / Interest / Fiscal agent charges

⚠ `revenue_parents` is deliberately EMPTY. This county prints `Taxes` as a
single valued line, NOT as a heading over property/sales children the way the
CITY of Grand Forks does. Setting a revenue parent here would invent structure
the issuer did not print — the session-7b Boulder failure, which tied at $0
while five tax lines stood wrongly at root.

⚠ `Capital outlay` sits BETWEEN the two parents rather than after them — the
Sedgwick County shape. A root leaf CLOSES whichever parent is open, so this
works either way; it is recorded because reading it as a child of `Current`
would still tie.

⚠ The parents print WITHOUT trailing colons (`Current`, `Debt Service`), unlike
Harrison County MS and Biloxi MS which print `Current:` and `Debt service:`.
The library strips a trailing colon before matching, so the same lowercase
labels serve both — but do not assume the wording matches: Boulder County prints
`Service on long-term obligations:` where every other issuer prints `Debt
service:`, and a copied config reparented Principal and Interest silently while
the statement still tied to the cent.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Grand Forks County, ND',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
