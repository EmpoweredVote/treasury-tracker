#!/usr/bin/env python3
"""
City of Wichita, KS ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 7b; Kansas's FIRST local entity in TT, and the founding member of the
`ks-local-acfr-gf` family.

⚠ NOT any of the FAC near-misses a name match returns for "Wichita": Wichita
State University, Wichita Public Schools USD 259, The Wichita Children's Home,
Wichita Family Crisis Center, Wichita Area Metropolitan Planning Organization,
Music Theatre Wichita, Senior Services Inc. of Wichita, Wichita Area Sexual
Assault Center, or WICHITA COUNTY Health Center — Wichita County is a DIFFERENT
Kansas government 250 miles away. Documents come from the city's own archive by
ADID; see scripts/data/coKsAcfrSources.mjs.

── ⚠⚠ THE ARCHIVE IDS ARE NOT ORDERED BY YEAR ───────────────────────────────

Wichita's archive assigns FY2018 the id 56 and FY2017 the id 57; FY2016 is 54
and FY2015 is 55. Two adjacent inversions. Deriving an id from a fiscal year
would silently load one year's money under another year's label, and EVERY tie
would still pass because each document is internally consistent. The mapping is
read from the publisher's listing and then verified against the fiscal year
printed on each document's own cover page.

── ⚠⚠ TWO YEARS ARE SCANS AND ARE NOT LOADED ────────────────────────────────

FY2001 and FY2008 are image-only uploads with no usable text layer — 30 and 20
characters per page against 1,301-1,973 for every other year in the series
(FY2001's PDF even carries the producer title "eCopy, Inc."). Their immediate
neighbours FY2000, FY2002, FY2007 and FY2009 are all born-digital, so this is
two bad uploads rather than an era.

Reported as GAPS, never written as $0 and never silently skipped. This follows
the Columbia SC FY2019 precedent from session 6a: recovering them means OCRing
a scan and trusting money read off an image, which is a different and worse risk
than the two years are worth.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption and the printed General Fund
total revenues for FY2024 is 317,858,416 — a figure that is already whole
dollars for a city of 397,000. `units=1` (the default).

⚠ Checked per entity, not carried: Boulder, loaded in this same session, prints
`(Amounts in 000's)` and uses units=1000.

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

    REVENUES                                 <- FLAT, no grouping
       Property taxes / Motor vehicle taxes / Transient guest taxes /
       Special assessments / Franchise taxes / Local sales tax /
       Intergovernmental / Licenses and permits / Fines and penalties /
       Rentals / Sale of property / Interest and investment earnings /
       Charges for services and sales /
       Premiums from the issuance of temporary notes / Other revenue
    EXPENDITURES
       Current:                              <- parent
           General government / Public safety / Highways and streets /
           Sanitation / Health and welfare / Culture and recreation
       Debt service:                         <- parent
           Principal retirement - bonds / Interest and fiscal charges -
           bonds/notes / Principal retirement - financed purchase debt /
           Principal retirement - leases / Interest - leases /
           Principal retirement - SBITA / Interest - SBITA / Other debt service
       Capital outlay                        <- root leaf, peer of the parents

⚠ `revenue_parents` is deliberately EMPTY. Wichita's revenue section has no
group headings at all — every source is a root leaf, including the five distinct
tax lines, which are NOT nested under a `Taxes:` heading the way Boulder's are.
Setting a revenue parent here would be inventing structure the issuer did not
print.

⚠ FY2000-FY2003 PREDATE GASB 34. The General Fund statement of revenues,
expenditures and changes in fund balance is a governmental-funds statement and
exists on both sides of that boundary, but the surrounding presentation differs.
Those years are extracted and tie-checked exactly like the rest; nothing about
them is assumed to match FY2004+.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

STATEMENT_ANCHOR = (
    r'STATEMENT\s+OF\s+REVENUES,?\s+EXPENDITURES[\s\S]{0,300}?CHANGES\s+IN\s+FUND'
)

CONFIG = CityConfig(
    city='City of Wichita, KS',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
)

if __name__ == '__main__':
    run_cli(CONFIG)
