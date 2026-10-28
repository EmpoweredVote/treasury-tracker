#!/usr/bin/env python3
"""
Municipality of Anchorage, AK ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Alaska's FIRST
local government in TT; the state node (FY2006-2025, `processAKAcfr.js`) was
already loaded and is untouched by this.

── ⚠⚠ ANCHORAGE IS A UNIFIED MUNICIPALITY — IT IS ALSO THE COUNTY ───────────

The Municipality of Anchorage is a unified home-rule municipality: the city and
the borough are ONE consolidated government. There is no separate "Anchorage
Borough" to load, and creating one would mint a government that does not exist.

Typed `city`, following TT's own precedent for consolidated city-counties —
San Francisco CA and Philadelphia PA are both `city`. ⚠ `entity_type` is
identity-load-bearing (`treasury_ensure_municipality` keys on it), so a later
retype would MINT A DUPLICATE rather than move this one.

⚠ Do NOT type it `borough`. In TT `borough` currently means the 949 PENNSYLVANIA
boroughs — a city-like unit — whereas an Alaska borough is a county-equivalent.
Using one label for both would conflate two unrelated things in the county
children panel.

⚠ Alaska has 19 organized boroughs and 11 census areas. The census areas are
statistical only and have NO government, so Alaska's county layer is 19 real
governments, not the 30 county-equivalents the census vintage names.

── ⚠⚠ THE SERIES FLOOR IS FY2012, AND IT IS A TEXT-LAYER FLOOR ──────────────

muni.org publishes back to FY2001, but FY2001-FY2011 are IMAGE-ONLY scans:

    FY2012-FY2024    2,499 - 2,804 chars/page    born-digital
    FY2009, FY2008      48 and 37 chars/page     scan
    FY2010, FY2011           7 chars/page        scan
    FY2005, FY2001           1 char  per page    scan

Measured on the publisher's own copies. The break is exactly where muni.org
switches from four section PDFs per year (FY2001-2011) to one complete report
(FY2012+), so it is an era, not a handful of bad uploads.

Those eleven years are declared in KNOWN_DOCUMENT_GAPS with their cause and
reported at load time. They are NEVER written as $0 and never silently skipped.
Recovering them means OCRing a scan and trusting money read off an image.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption, and FY2024 General Fund
total revenues print as 803,259,435 — already whole dollars for a municipality
of ~290,000. `units=1` (the default).

⚠ Read per entity, never carried: the AK STATE ACFR two paragraphs away in this
same repo is in THOUSANDS (`processAKAcfr.js`, units=1000).

── ⚠ FISCAL YEAR: CALENDAR YEAR, ENDING DECEMBER 31 ─────────────────────────

Anchorage's fiscal year is the calendar year. The State of Alaska's ends JUNE 30.
Two different fiscal calendars inside one state — the AK state node's month must
not be carried onto this entity.

── STRUCTURE, READ FROM THE PRINTED PAGE (`pdftotext -layout`, FY2024 p.25) ──

    Revenues                                      <- FLAT, no grouping
       Taxes / Assessments in lieu of taxes / Special assessments /
       Licenses and permits / Intergovernmental / Charges for services /
       Fines and forfeitures / E911 surcharges / Investment Income /
       Interest income on leases / Restricted contributions / Other
    Expenditures
       Current:                                   <- parent
           General government / Fire services / Police services /
           Health and human services / Economic and community development /
           Public transportation / Public works /
           Maintenance and operations of roads and facilities / Education
       Debt service:                              <- parent
           Principal / Interest and fiscal agent charges / Bond issuance costs
       Debt service - Leases:                     <- parent
           Principal / Interest
       Debt service - SBITAs:                     <- parent
           Principal / Interest
       Capital outlay                             <- root leaf, peer of parents
       Capital outlay - Leases                    <- root leaf
       Capital outlay - SBITAs                    <- root leaf

⚠ `revenue_parents` is deliberately EMPTY. Anchorage prints `Taxes` as a VALUED
leaf ($705,981,800 in FY2024), not as a group heading. Declaring it a parent
would invent structure the issuer did not print — and would still tie at $0.

⚠⚠ THREE DEBT-SERVICE PARENTS, AND `Principal`/`Interest` REPEAT UNDER THEM.
GASB 87 (leases) and GASB 96 (SBITAs) each added their own debt-service block,
so the same child LABEL appears under up to three different parents. All three
parents must be declared: `parents` matches whole label-only lines, so a bare
'debt service' does NOT match 'Debt service - Leases' and its children would
silently reparent onto the preceding block while the statement still tied.

⚠ The three `Capital outlay*` rows sit at the SAME indent as the parents, not
under them — root leaves. `root_leaves` matches PREFIXES, so the single entry
'capital outlay' covers all three.

⚠ The lease/SBITA rows do not exist in the earlier years of the series (GASB 87
is FY2022, GASB 96 is FY2023). Fewer roots in an early year is expected here;
the printed page is still the arbiter.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# Image-only scans on the publisher's own site. Cause recorded per year; these
# are GAPS, never $0. chars/page measured with `pdftotext <f> - | wc -c` over
# `pdfinfo` page count.
KNOWN_DOCUMENT_GAPS = {
    2001: 'image-only scan (1 char/page) — muni.org section PDFs',
    2002: 'image-only scan — muni.org section PDFs',
    2003: 'image-only scan — muni.org section PDFs',
    2004: 'image-only scan — muni.org section PDFs',
    2005: 'image-only scan (1 char/page) — muni.org section PDFs',
    2006: 'image-only scan — muni.org section PDFs',
    2007: 'image-only scan — muni.org section PDFs',
    2008: 'image-only scan (37 chars/page) — muni.org section PDFs',
    2009: 'image-only scan (48 chars/page) — muni.org section PDFs',
    2010: 'image-only scan (7 chars/page) — muni.org section PDFs',
    2011: 'image-only scan (7 chars/page) — muni.org section PDFs',
}

CONFIG = CityConfig(
    city='Municipality of Anchorage, AK',
    parents=(
        'current',
        'debt service',
        'debt service - leases',
        'debt service - sbitas',
    ),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
