#!/usr/bin/env python3
"""
Lexington-Fayette Urban County Government, KY — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; Kentucky's FIRST local entity in TT and the founding member of the
`ky-local-acfr-gf` family. LFUCG is a CONSOLIDATED city-county government, so it
is one entity in the roster, not a city plus a county.

── ⚠⚠ FIVE SIBLING GOVERNMENTS SHARE THIS NAME ─────────────────────────────

The sharpest issuer-identity case in the campaign. A name query over FAC for
"Lexington-Fayette" returns ALL of these, and only the first is this government:

    LEXINGTON-FAYETTE URBAN COUNTY GOVERNMENT              EIN 610858140  <- this
    Transit Authority of the LFUCG                         EIN 610850923
    Lexington-Fayette Urban County HOUSING AUTHORITY       EIN 616000346
    Lexington-Fayette Urban County DEPARTMENT OF HEALTH    EIN 610920825
    Lexington Fayette Urban County AIRPORT BOARD           EIN 616000043
    C.A.C. for Lexington-Fayette, Bourbon, Harrison and
      Nicholas Counties                                    EIN 610650121

plus Fayette County Public Schools, the Fayette County Attorney, Lexington
Public Library, the Lexington Convention & Visitors Bureau and Commerce
Lexington. **EIN 610858140 is the government.**

⚠ AND THE AUDITEE NAME IS NOT STABLE: it files as `LEXINGTON-FAYETTE URBAN
COUNTY GOVERNMENT` through FY2022 and `Lexington Fayette Urban County
Government` (no hyphen) from FY2022 on. The EIN is the stable key; the report_id
is the join. Never match on the name.

⚠ NOT **Lexington County, SOUTH CAROLINA**, which publishes its own ACFR at
`lex-co.sc.gov` and is not a Knight entity.

── ⚠⚠ THE FAC PACKAGE IS TITLED "SINGLE AUDIT REPORT". IT IS STILL THE ACFR. ─

From FY2017 on, the document LFUCG files is titled `Single Audit Report in
Accordance with Uniform Guidance` -- only FY2016 is titled as the CAFR. It
nonetheless BUNDLES the complete governmental-funds statements: FY2024 page 60
is `STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES /
GOVERNMENTAL FUNDS`, General Fund Total Revenues $492,988,023.

**Do not reject one of these packages on its cover title.** The statement is
what matters, and the library's page finder locates it regardless.

⚠ FY2022 and FY2023 each have TWO report_ids -- a re-submission. Both pairs were
downloaded and proven TEXT-IDENTICAL by extraction and diff, and the manifest
keeps the later-accepted GSAFAC id. Decided by comparison, never by preferring a
pattern.

── ⚠ LFUCG's OWN SITE IS NOT THE BETTER ROUTE ──────────────────────────────

lexingtonky.gov publishes on Google Drive with opaque, non-derivable file ids
that must be read from the Accounting page. Worse, the link there labelled
"fiscal year 2025" is a **20-page summary with no numeric statement** -- not the
ACFR. A publisher's own label is not evidence of what a file is. FAC is used
instead, and covers FY2016-FY2025 complete.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption; FY2024 General Fund total
revenues print as 492,988,023 for a consolidated government of ~320,000.
`units=1` (the default).

── STRUCTURE, READ FROM THE PRINTED PAGE (FY2024, p.60) ────────────────────

    REVENUES                                 <- FLAT, no grouping
       License Fees and Permits / Taxes / Charges for Services /
       Fines and Forfeitures / Intergovernmental / Exactions /
       Property Sales / Income on Investments / Other
    EXPENDITURES
       Current:                              <- parent, BY DEPARTMENT
           Administrative Services / Chief Development Officer /
           Community Corrections / Environmental Quality & Public Works /
           Housing Advocacy and Community Development / Finance /
           Fire and Emergency Services / General Government /
           General Services / Information Technology / Law /
           Outside Agencies / Parks and Recreation /
           Planning, Preservation, & Development / Police /
           Public Safety / Social Services
       Debt Service:                         <- parent
           Principal / Interest / Other Debt Service
       Capital:                              <- PARENT (note the wording)
           Equipment / Acquisitions and Construction

⚠ The capital parent is printed `Capital:` -- NOT `Capital outlay`, which is
what Biloxi, Grand Forks County and most of this corpus print. A config copied
from a sibling entity would leave Equipment and Acquisitions to reparent
silently under Debt Service **while the statement still tied to the cent** --
the Boulder County `Service on long-term obligations:` failure exactly.

⚠ LFUCG's fund columns are General / Urban Services / Federal and State Grants /
Other Governmental -- a consolidated-government layout. `Urban Services` is a
real LFUCG fund (the urban services district that funds refuse and street
lighting inside the former city limits), not a subtotal.

⚠ `Current:` is broken out BY DEPARTMENT rather than by the usual function
labels (general government / public safety / public works). That is how the
issuer prints it and it is loaded that way; TT does not remap an issuer's
functional taxonomy onto a canonical one.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

CONFIG = CityConfig(
    city='Lexington-Fayette Urban County Government, KY',
    parents=('current', 'debt service', 'capital'),
    root_leaves=(),
    fy_end=('June', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
