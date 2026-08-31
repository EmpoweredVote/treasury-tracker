#!/usr/bin/env python3
"""
City of Biloxi, MS ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Knight campaign
session 8; Mississippi's FIRST local entity in TT, alongside Harrison County,
and the founding member of the `ms-local-acfr-gf` family.

⚠ NOT any of the near-misses a name match returns for "Biloxi": Biloxi Public
School District, The Housing Authority of the City of Biloxi, the
Gulfport-Biloxi Regional Airport Authority, or Catholic Charities Housing
Association of Biloxi. **EIN 646000153 is the city.** Documents come from the
city's own publications page for FY2002-FY2015 and from the Federal Audit
Clearinghouse for FY2016+; see `_acfr-work/s8/manifest.json`.

── ⚠⚠ BILOXI'S POST-FY2020 FILINGS ARE SCANS. THIS IS THE HARD PART. ────────

Every filing from FY2021 onward is a scan, not a born-digital PDF, and the OCR
damages the MONEY while leaving the prose readable. FY2024's statement page
prints `4,973,!09`, `20,034, 199` and a total of `I09,091 ,141` while the
document still scores 43.6% known-vocabulary and 1,999 chars/page — it passes
every prose and density check the campaign has. `scripts/checkAcfrMoneyIntegrity.py`
exists because of this document.

⚠⚠ **THE DAMAGE IS THE PUBLISHER'S, NOT A FETCH ARTIFACT.** Three independent
copies were compared for the affected years — FAC, the city's own site, and the
Mississippi Office of the State Auditor — and all three are the same scan. There
is no cleaner copy to prefer, so the choice is repair-or-drop, not re-fetch.

Per-year money-integrity rate (suspect tokens / money tokens on the statement
pages), from `checkAcfrMoneyIntegrity.py`:

    FY2002-FY2020   0.00%     born-digital, nothing to repair
    FY2022          3.18%
    FY2021          6.27%
    FY2025          6.87%
    FY2024         17.23%     ALSO carries two UNRECOVERABLE lost digits
    FY2023         (total loss — see below)

`whitespace_repair=True` closes the split thousands groups. It only ever deletes
a SINGLE space adjacent to a comma between digits — `-table` separates columns
with two or more spaces, so a single space can never be a column boundary — and
it never invents, deletes or alters a digit. Every repair is then independently
validated by the tie gate: if a repair had joined two figures that were not one
figure, the component sum would stop matching the printed total.

⚠⚠ **IT CANNOT AND MUST NOT RESCUE A LOST DIGIT.** `4,973,!09` has lost a
character and `I09,091,141` has a letter where a digit belongs. Those are left
exactly as they are, fail to parse, and take the tie down with them. Guessing
the missing digit would be inventing money.

── ⚠⚠ FY2023 IS NOT LOADABLE FROM ANY PUBLISHED COPY ────────────────────────

FY2023 is a catastrophically bad scan: 24.4% known-vocabulary against 39.5-47.2%
for every other document in the corpus, 29.8 digit-welded tokens per page, and
**zero pages carrying a numeric statement**. Its cover extracts as
`CITY Of' 80.,0XI, MJSSISSll'l'I FINANCIAL llliPOffl' SEPTEMBER30, 2023`.

Verified against FAC, the city's own site AND the MS State Auditor — all three
byte-for-byte the same damaged document. Reported as a GAP, never written as $0
and never parsed. This follows the Columbia SC FY2019 precedent from session 6a.

── ⚠ YEARS WITH NO ROUTE AT ALL ─────────────────────────────────────────────

FY2005-FY2008 and FY2013 are image-only uploads on the city's site with no text
layer whatsoever, and MS OSA's archive begins at FY2015, so no publisher holds a
readable copy. FY2003 and FY2004 are fine, so this is not an era boundary.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No statement page carries an "in thousands" caption; FY2024 General Fund total
revenues print as 77,153,727 for a city of ~48,000. `units=1` (the default).

── STRUCTURE, READ FROM THE PRINTED PAGE (FY2024, Exhibit D p.29) ───────────

    REVENUES                                 <- FLAT, no grouping
       Ad valorem taxes / Property taxes / Franchise taxes /
       Licenses and permits / Fees and fines / Intergovernmental /
       Charges for services / Lease revenues / Interest Income - leases /
       Investment earnings / Miscellaneous - other
    EXPENDITURES
       Current:                              <- parent
           General government / Public safety / Public works /
           Parks and recrecation / Community development / Engineering /
           Non-departmental / Other expenditure
       Capital outlay                        <- PARENT, not a root leaf
           Public works
       Debt service:                         <- parent
           Principal retirement / Interest and agent fees

⚠ `Capital outlay` is a PARENT here, with `Public works` nested beneath it — the
Hillsboro inversion. Grand Forks COUNTY, loaded in this same session, prints
`Capital outlay` as a valued ROOT LEAF instead. Same two words, two different
roles, and a wrong reading would still tie.

⚠ `Parks and recrecation` is the publisher's own typo, in the printed statement.
It is loaded exactly as published. TT does not silently correct an issuer's
labels; `label_fixes` exists for OCR transcription artifacts, not for the
issuer's spelling.

⚠ `revenue_parents` is deliberately EMPTY — Biloxi prints `Ad valorem taxes`,
`Property taxes` and `Franchise taxes` as three peer root lines with no `Taxes:`
heading over them. Inventing that heading is the session-7b Boulder failure,
which tied at $0 with five tax lines wrongly at root.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ FY2025's scan mangles the TITLE but not the two words the anchor needs:
# the page reads `STATEi\lENT O F REVENUES, EXPENDITURES, AND C HANGES IN FUND
# BALANCES`. "STATEMENT OF" and "CHANGES" are destroyed; `REVENUES,
# EXPENDITURES` survives intact, so the anchor keys on that and nothing else.
#
# ⚠ This anchor also matches the General Fund BUDGETARY schedule, which Biloxi
# prints every year. That is safe only because the anchor is applied IN ADDITION
# to the library's `_EXCLUDE` page tests, which reject `budget and actual` — do
# not weaken those tests to make a year parse.
STATEMENT_ANCHOR = r'REVENUES,\s*EXPENDITURES'

CONFIG = CityConfig(
    city='City of Biloxi, MS',
    parents=('current', 'capital outlay', 'debt service'),
    root_leaves=(),
    fy_end=('September', 30),
    statement_anchor=STATEMENT_ANCHOR,
    # ⚠ Harmless on the born-digital years: they contain no single-space-split
    # thousands group, so the substitution matches nothing and FY2002-FY2020
    # extract identically with it on or off. Verified, not assumed.
    whitespace_repair=True,
)

if __name__ == '__main__':
    run_cli(CONFIG)
