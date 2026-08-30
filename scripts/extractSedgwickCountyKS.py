#!/usr/bin/env python3
"""
Sedgwick County, KS ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 7b; Wichita's parent county and the second member of the
`ks-local-acfr-gf` family.

⚠⚠ NOT THE CITY OF SEDGWICK, KANSAS. The FAC census carries BOTH:

    KS,Sedgwick,municipality,annual,1,,2003        <- the CITY of Sedgwick
    KS,Sedgwick County,county,annual,1,,1998-2025  <- this entity

The City of Sedgwick is a real government of about 1,600 people in Harvey
County — not even inside Sedgwick County. This is the SIXTH occurrence of the
Saint-Louis-County shape in this campaign (after Saint Louis County MN, Lake
County IN, Philadelphia MS/NY, Miami-Dade's missing hyphen, and the City of
Wayne MI), and `censusName` is exact for exactly this reason.

⚠ Nor the FAC name-match near-misses: Sedgwick County Zoological Society,
Child Advocacy Center of Sedgwick County, Sedgwick County Area Educational
Services Interlocal Cooperative, or USD 265 Sedgwick County (Goddard).

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No "in thousands" caption; FY2024 General Fund total revenues print as
257,880,208. `units=1` (the default). Checked per entity — Boulder, loaded in
the same session, is in thousands.

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

    Revenues                                 <- FLAT, no grouping
       Property taxes / Emergency telephone services taxes / Sales taxes /
       Special assessments / Other taxes / Intergovernmental /
       Charges for services / Uses of money and property / Fines and forfeits /
       Licenses and permits / Other
    Expenditures
       Current:                              <- parent
           General government / Public safety / Public works /
           Health and welfare / Cultural and recreation / Community Development
       Capital outlay                        <- root leaf
       Debt service:                         <- parent
           Principal / Interest and fiscal charges / Debt issuance costs

⚠ Note the ORDER differs from Wichita's: Sedgwick prints `Capital outlay`
BETWEEN the two parents, Wichita prints it after both. `root_leaves` handles
either, because a root leaf closes whichever parent is open rather than assuming
a position — but the two documents are genuinely different, which is why the
structure is declared per entity and never shared.

⚠ FY2005 IS A GAP. The county's own listing offers
`/media/28020/2005_cafr.pdf`, and that URL returns HTTP 404 — a dead link in the
publisher's own archive, not a fetch failure on our side. Reported, never
written as $0. The loaded window therefore opens at FY2006.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

STATEMENT_ANCHOR = (
    r'STATEMENT\s+OF\s+REVENUES,?\s+EXPENDITURES[\s\S]{0,300}?CHANGES\s+IN\s+FUND'
)

CONFIG = CityConfig(
    city='Sedgwick County, KS',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
)

if __name__ == '__main__':
    run_cli(CONFIG)
