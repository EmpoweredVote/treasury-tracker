#!/usr/bin/env python3
"""
City of Los Angeles, CA ACFR — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Audit-grade
milestone, piece 2: this is the AUDITED series the reader can switch TO, beside
the State Controller's unaudited all-funds series Treasury Tracker already
holds for FY2003-FY2025.

⚠⚠⚠ THIS IS A SECOND SERIES, NEVER A CORRECTION OF THE FIRST.

LA-01 proved the ACFR does not reconcile to the Controller's all-funds
construction under any stable scope, and it is not supposed to: they count
different funds. The audited General Fund is ~$6.7B (FY2023); the Controller's
all-funds figure for the same city is ~$23.5B, because it includes the airport,
the port and the utility. Both are right. Anything that presents one as fixing
the other is wrong — see docs/superpowers/specs/2026-10-30-audit-grade-ui-design.md §5.1.

── ⚠⚠ ONE EIN, THREE AUDITEES ───────────────────────────────────────────────

EIN 956000735 carries THREE separate FAC filers, ten years each, thirty filings
in all: `City of Los Angeles`, `Port of Los Angeles` and `LOS ANGELES WORLD
AIRPORTS`. A name-insensitive match on the EIN loads an enterprise fund's book
under the city's name, and every tie would still pass because each document is
internally consistent. `_acfr-work/la-city/manifest.json` is built by filtering
`auditee_name` case-insensitively to exactly `city of los angeles`, and each
PDF's own cover page states the entity and the fiscal year.

⚠ The pre-2023 report ids are Census-era and the SUFFIX REPEATS ACROSS YEARS:
FY2016 through FY2022 are all `...-CENSUS-0000132045`, distinguished only by
the `YYYY-06-` prefix. The Port is `...-0000183054` and the airports
`...-0000190624` in every one of those years. Matching on the suffix alone
would collapse seven years into one.

── UNITS: THOUSANDS ─────────────────────────────────────────────────────────

Every statement page carries `(amounts expressed in thousands)` and the printed
General Fund total revenues for FY2023 is 6,744,996 — thousands for a city of
3.9 million. `units=1000`.

⚠ A units error is INVISIBLE to the tie gate: every figure on the page is
scaled by the same constant, so a wrong `units` ships a silently 1000x-wrong
row that balances perfectly. Checked against the caption on the page, per year.

── TARGET COLUMN: THE GENERAL FUND, WHICH IS COLUMN 0 ───────────────────────

The statement prints General / Special Revenue / Debt Service / ... with the
General Fund first, so the default `target_column=0` is correct and the
`'last'` total-governmental mode is NOT used here.

⚠ That is deliberate, not incidental. Treasury Tracker already holds a
`total_governmental` series for this city — 7,652 rows TT DERIVED from the
Controller's governmental schedule — and the city's own audited "Total
Governmental Funds" includes its redevelopment successor-agency funds, which
the derived one does not. Reading the audited total here would put two
differently-built figures under one label. The General Fund is the scope that
has no such collision.

── STRUCTURE, READ OFF THE PRINTED PAGE WITH `-layout` ──────────────────────

    REVENUES                                  <- FLAT, no group headings
       Property Taxes / Sales Taxes / Utility Users Taxes / Business Taxes /
       Other Taxes / Licenses and Permits / Intergovernmental /
       Charges for Services / Services to Enterprise Funds / Fines /
       Special Assessments / Investment Earnings /
       Change in Fair Value of Investments / Program Income / Other
    EXPENDITURES
       Current                                <- parent (2 spaces)
           General Government / Protection of Persons and Property /
           Public Works / Health and Sanitation / Transportation /
           Cultural and Recreational Services / Community Development
       Capital Outlay                         <- ROOT LEAF (2 spaces, peer of
                                                 Current — not a child of it)
       Debt Service                           <- parent (2 spaces)
           Principal / Interest / Cost of Issuance

⚠ `revenue_parents` is deliberately EMPTY. The five tax lines are root leaves
with no `Taxes:` heading above them — confirmed with `pdftotext -layout`, which
prints every revenue label at the same two-space indent. Inventing a `Taxes`
parent would restructure the issuer's statement while still tying at $0, which
is failure mode 1 in the extractor's own list.

⚠ `Capital Outlay` is a ROOT LEAF and not a child of `Current`. It prints at
the same indent as `Current` and `Debt Service`. Nesting it would tie at $0 and
move real money under the wrong parent.

── ⚠⚠ THE DOCUMENT CONTAINS A SECOND, NON-GAAP STATEMENT ────────────────────

Two pages after the governmental-funds statement comes `Statement of Revenues,
Expenditures and Changes in Fund Balance — Budget and Actual (Non-GAAP
Budgetary Basis)`, whose title begins almost identically. The library's
`_EXCLUDE` list already carries `budget and actual`, and the anchor below
additionally REQUIRES the words `Governmental Funds`, which the budgetary
statement does not carry. Both guards, because failure mode 10 is landing on a
near-identical title and reading a different basis under a GAAP label.

── ⚠⚠ `column_strategy='ordinal'` — FY2016 NEEDS IT AND SAID SO ───────────

The default `positional` strategy anchors each fund column by its x-position.
It read nineteen of these twenty extractions correctly and silently DROPPED one
row on the twentieth: FY2016's `Cost of Issuance` prints its General Fund
figure at a different horizontal offset from `Interest` two rows above it —

    Principal                   --            --       257,291
    Interest                 4,339            --        72,544
    Cost of Issuance           807           109         5,309

— so 807 was assigned to the wrong column and never reached the General Fund
tree. `ordinal`, which counts dash-runs rather than measuring offsets, reads it.

⚠ THE TIE GATE CAUGHT THIS, AND IT IS WHY THE GATE IS NOT OPTIONAL: computed
4,574,165 against a printed 4,574,972, delta exactly -807,000 in the scaled
domain. Every other year still ties at $0 under `ordinal` and every figure in
them is unchanged, so this is a strategy that reads one more document, not a
strategy that reshapes the other nine.

⚠ It was NOT registered in `source_rounding`. The document is not internally
inconsistent — the parser was wrong, the page was right, and an exception would
have hidden a real mis-parse behind a number that looked like a rounding
artifact.

── OBSERVED LABEL DRIFT, DELIBERATELY NOT NORMALISED ───────────────────

The issuer's own wording moves across the series, and these are the publisher's
changes rather than parse artifacts, so they are loaded as printed:

    Utility Users' Taxes            FY2016-FY2022   (apostrophe)
    Utility Users Taxes             FY2023-FY2025   (no apostrophe)
    Property Tax In-Lieu of Sales Tax   FY2016 only
    Change in Fair Value of Investments FY2017, FY2018, FY2021-FY2025
    Program Income                      FY2023, FY2025 only

⚠ DO NOT "FIX" THE APOSTROPHE IN `label_fixes`. That option is for
transcription damage — letter-spaced glyphs that `-table` splits mid-word. This
is the City of Los Angeles renaming its own revenue line, and flattening it
would put a label on the page that no document prints. TT renders one tree per
year, so the two spellings never appear in the same chart.

⚠ The EXPENDITURE tree is exactly three roots in all ten years — Current,
Capital Outlay, Debt Service — which is the shape stability check for a tree
that ties at $0 for the wrong reason.

⚠ A `(Continued)` page follows the real statement and carries the remaining
fund columns. The General Fund column is complete on the FIRST page, so
`multipage` is not needed for `target_column=0` — and must not be switched on
without re-reading, because the continuation's columns are different funds, not
more rows.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ REQUIRES "Governmental Funds". The budgetary statement in the same document
# opens `Statement of Revenues, Expenditures and Changes in Fund Balance` too.
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues,?\s+Expenditures'
    r'[\s\S]{0,400}?Changes\s+in\s+Fund\s+Balances'
    r'[\s\S]{0,200}?Governmental\s+Funds'
)

CONFIG = CityConfig(
    city='City of Los Angeles, CA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    units=1000,
    column_strategy='ordinal',
    fy_end=('June', 30),
    statement_anchor=STATEMENT_ANCHOR,
)

if __name__ == '__main__':
    run_cli(CONFIG)
