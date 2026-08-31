#!/usr/bin/env python3
"""
City of Boulder, CO ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 7b; extends the existing `co-local-acfr-gf` family (Colorado Springs and
El Paso County, v2.29) rather than creating a new one.

⚠ NOT Boulder City, NEVADA — a real, separate municipality that this campaign's
own web searches surfaced alongside the Colorado city, and which publishes its
own "Annual Financial Reports" page. Nor Boulder County, whose ACFR is a
different document loaded by extractBoulderCountyCO.py. Nor any of the FAC
near-misses: Boulder Community Health, Boulder Housing Partners, Boulder County
Housing Authority, Boulder Valley School District, Boulder Shelter for the
Homeless, or Mental Health Center of Boulder County. Documents are fetched by FAC
report_id, never by a name match — see scripts/data/coKsAcfrSources.mjs.

── ⚠⚠ UNITS: THOUSANDS ──────────────────────────────────────────────────────

Every statement page carries `(Amounts in 000's)` in its caption block, and the
printed General Fund total revenues for FY2022 is 170,917 against an actual
$170,917,000. `units=1000`.

This is the Charlotte / Austin shape, and it is the reason units are declared per
entity and never inferred: Boulder County, twenty miles away and loaded in the
same session, prints WHOLE DOLLARS. Two entities, one state, one session,
opposite denominations — the Charlotte/Mecklenburg pairing exactly.

⚠ A units error is invisible to the tie: every figure on the statement scales
together, so components still sum to the printed total. It is caught only by
comparing the loaded magnitude against an independent statement of the same
figure.

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

Determined from `pdftotext -layout` on the statement page, which preserves the
leading indentation that `-table` flattens:

    Revenues:
       Taxes:                                   <- revenue parent
           Sales, use and other taxes
           General property taxes
           Accommodation taxes
           Occupation taxes
           Specific ownership & tobacco taxes
           Excise taxes
       Charges for services                     <- root-level revenue leaves
       Sale of goods
       Licenses, permits and fines
       Intergovernmental
       Leases, rents and royalties
       Interest and investment earnings
       Other
    Expenditures:
       Current:                                 <- expenditure parent
           General Government
           Administrative Services
           Public Safety
           Public Works
           Planning & Development Services
           Culture and Recreation
           Open Space and Mountain Parks
           Housing and Human Services
       Capital outlay                           <- root leaf, peer of the parents
       Debt service payments:                   <- expenditure parent
           Principal
           Interest
           Base rentals to Boulder Municipal Property Authority

⚠⚠ `-layout` IS THE BROKEN READER ON THIS ISSUER and is used ONLY to read
indentation, never money. It emits the label column and the numeric columns as
separate blocks, so it pairs `Revenues:` — a section header that carries no
money at all — with $81,136, and `Sales, use and other taxes` with the figure
belonging to `Taxes:`. That is the City of Charlotte defect, and on this issuer
it is obvious rather than subtle. `-table` (what acfrGF.py actually uses) keeps
the grid.

── ⚠ THE BUDGETARY SCHEDULES MUST NOT WIN THE PAGE SEARCH ───────────────────

FY2022 alone has the statement anchor on ten pages. Pages 49 and 51-53 are
`Budget and Actual` schedules on the BUDGETARY basis; loading one would be a
silent basis error of exactly the kind `basisRegistry` exists to prevent. They
are excluded by the shared `budget and actual` filter, the same way Colorado
Springs' are. Page 46 — anchor present, both totals present, no budget/actual
caption — is the governmental-funds statement.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

STATEMENT_ANCHOR = (
    r'STATEMENT\s+OF\s+REVENUES,?\s+EXPENDITURES[\s\S]{0,300}?CHANGES\s+IN\s+FUND\s+BALANCES?'
)

CONFIG = CityConfig(
    city='City of Boulder, CO',
    parents=('current', 'debt service payments'),
    root_leaves=('capital outlay',),
    revenue_parents=('taxes',),
    # ⚠⚠ REQUIRED whenever revenue_parents is set, and the failure is SILENT.
    # Omitting this closed the tax group after its FIRST child, leaving `Taxes`
    # at 81,136 with one child and filing General property taxes, Accommodation
    # taxes, Occupation taxes, Specific ownership & tobacco taxes and Excise
    # taxes as ROOT-LEVEL revenue categories — and the tree still tied at
    # $170,917,000, because the multiset of values is unchanged and only the
    # PARENTING moved. Every one of Boulder's six tax lines ends in "taxes"
    # while the first ungrouped source (`Charges for services`) does not, so
    # this suffix closes the group in exactly the right place.
    revenue_group_members=('taxes',),
    units=1000,
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
)

if __name__ == '__main__':
    run_cli(CONFIG)
