#!/usr/bin/env python3
"""
St. Joseph County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 2 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

St. Joseph files GAAP for FY2019-FY2022, FY2024 and FY2025. FY2017 and FY2018
are State Board of Accounts REGULATORY-BASIS reports with no governmental-funds
statement in them (`IN_COUNTY_BASIS_GAPS`), and FY2016 and **FY2023** have no
filing at all (`IN_COUNTY_COVERAGE_GAPS`).

⚠ FY2023 IS A HOLE IN THE MIDDLE OF THE SERIES — GAAP filings sit on both sides
of it. It is reported as a coverage gap, never interpolated and never a $0.

⚠ THE PERIOD IN THE NAME IS LOAD-BEARING ELSEWHERE. FAC writes `ST JOSEPH`; a
county-name normaliser that did not strip periods reported this county as having
NO filings when it has eight. Nothing here matches on a name — see `countyKey`
in scripts/buildInCountyFacRoster.mjs.

── ⚠⚠⚠ THIS DOCUMENT'S CHARACTER GRID SPLITS WORDS, AND IT DOES IT DIFFERENTLY
── EVERY YEAR ───────────────────────────────────────────────────────────────

The PRINTED page is normal — `Taxes`, `Intergovernmental`, `Current:`,
`Expenditures:`, `Total revenues`. This was confirmed by RENDERING page 46 of the
FY2024 filing to an image and reading it. What `pdftotext -table` produces from
this issuer's font is not:

    printed              FY2019          FY2020/21/22        FY2024              FY2025
    Taxes                Taxes           T axes              T axes              T axes
    Intergovernmental    (see below)     In t ergo v ern     In t ergo v ern     In t ergo v ern
                                           men t al            ment al             m en t al
    Principal            —               P rin cip al        P r in cip al       P rin cip al
    Current:             Current:        Curren t :          Current :           Curren t :
    Expenditures:        Expenditures:   Ex p en dit ures:   Ex p endit ures:    Ex p en dit ures:
    Total revenues       Total revenues  T otal revenues     T otal revenues     T otal revenues

**FIVE spellings of one word across six years.** That is failure mode 9 — the
character grid inventing whitespace — in its most aggressive form so far, and
this county cost the library two fixes:

* **The SECTION-END test was failure mode 9's last unfixed site.** `_squash` was
  already applied at four places; `_section` still ended on a character-exact
  regex, so on `T otal revenues` the revenue section never closed and ran away
  through the expenditures and into the fund balances. FY2020 computed
  867,083,274 against a printed 169,635,305 — a LOUD failure, not a silent one.
  Now `_is_section_end`, squashed like the other four, proven by a corpus diff
  over every PDF under `_acfr-work`.
* **`label_fixes` did not reach GROUP HEADINGS.** It was applied only on the leaf
  path, so `Curren t` would have been published as the name of the group holding
  six of this county's seven expenditure functions, with every leaf under it
  correctly repaired and the tie at $0.

⚠⚠ SO `parents` NAMES BOTH SPELLINGS OF `Current` AND `label_fixes` REPAIRS IT.
Those are two separate declarations answering two separate questions — which
rows OPEN a group, and what the group is CALLED. The library deliberately does
not collapse them, because collapsing them means guessing which spellings of a
word are the same word.

⚠ Every entry in `label_fixes` below was READ IN A SPECIFIC DOCUMENT and checked
against how the same line reads on the rendered page. There is no de-spacing
heuristic here and there must not be: a rule that rejoined single spaces would
corrupt `Fines and forfeitures`, `Interest on long-term debt` and every other
legitimate multi-word label on this very page.

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

    Revenue:                                 <- ⚠ SINGULAR. Boulder County's shape.
        Taxes / Special assessments / Licenses and permits /
        Intergovernmental (FY2019: `Intergovernmental receipts`) /
        Charges for services / Fines and forfeitures /
        Gains on investments (FY2024-FY2025 only) / Other revenue
                                             <- FLAT, no grouping at all
    Expenditures:
        Current:                             <- parent
            General government / Public safety / Highways and streets /
            Economic development / Health and welfare / Culture and recreation
        Debt service - principal and interest   <- FY2019 ONLY: a valued ROOT LEAF
        Debt service:                        <- FY2020+: a parent
            Principal / Interest on long-term debt
        Capital outlay                       <- a valued ROOT LEAF, every year

⚠⚠ `Capital outlay` IS A ROOT LEAF HERE AND A PARENT IN ELKHART'S, HENDRICKS'S,
TIPPECANOE'S, ALLEN'S AND HAMILTON'S DOCUMENTS. Copying any of their
`parents=('current','debt service','capital outlay')` onto this county would
reparent nothing (there are no children to take) but would stop `Capital outlay`
being a leaf — and Marion's `root_leaves=('capital outlay',)` is right here only
by coincidence of shape. Failure mode 2, which wave 1 hit in three costumes and
which still ties to the cent every time.

⚠⚠ AND `debt service` IS IN **BOTH** `parents` AND `root_leaves`, DELIBERATELY.
FY2019 prints one VALUED `Debt service - principal and interest` line; FY2020
onward print a VALUELESS `Debt service:` heading over two children. The library
tests the parent branch only on a row with no value, and `root_leaves` matches a
label PREFIX on a valued row, so the two eras cannot collide: FY2019's valued
line is a root leaf and FY2020's empty heading opens a group. Without the
`root_leaves` entry FY2019's debt service would have been swallowed into
`Current`, at a tie of exactly $0.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on these documents, not
carried from another entity — and FY2024's printed total governmental revenue is
277,887,958 for a county of ~274,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ FY2019 prints `GOVERNMENTAL FUNDS` AFTER the title; FY2020 onward print it
# BEFORE, on the line above — Lake County's shape in a second county. Both orders
# are named. ⚠ The anchor WIDENS which pages can qualify (it is OR'd with the
# library's own title regex, not AND'ed with it); the guards that actually keep a
# budgetary or combining page out are `_EXCLUDE` and the earliest-page rule.
# Measured over all 64 Indiana county documents: the anchor moves ZERO pages.
STATEMENT_ANCHOR = (
    r'(?:Governmental\s+Funds[\s\S]{0,120}?)?'
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund'
    r'\s+Balances'
)

CONFIG = CityConfig(
    city='St. Joseph County, IN',
    # ⚠ `curren t` is what the character grid produces in FY2020/21/22/25 —
    # see the module docstring. `label_fixes` repairs the NAME; this tuple is
    # what decides the row opens a group at all.
    parents=('current', 'curren t', 'debt service'),
    # ⚠⚠ `debt service` is in BOTH tuples on purpose — FY2019 prints it valued at
    # root, FY2020+ as an empty heading. See the docstring.
    root_leaves=('capital outlay', 'debt service'),
    # ⚠ SINGULAR. This issuer prints `Revenue:`, not `Revenues`.
    revenue_section_header='revenue',
    label_fixes={
        # Every one of these was read in a specific document and checked against
        # the rendered page. EXACT match only — no de-spacing heuristic.
        'T axes': 'Taxes',                                    # FY2020-FY2025
        'In t ergo v ern men t al': 'Intergovernmental',      # FY2020-FY2022
        'In t ergo v ern ment al': 'Intergovernmental',       # FY2024
        'In t ergo v ern m en t al': 'Intergovernmental',     # FY2025
        'P rin cip al': 'Principal',                          # FY2020/21/22/25
        'P r in cip al': 'Principal',                         # FY2024
        'Curren t': 'Current',                                # the GROUP HEADING
    },
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
