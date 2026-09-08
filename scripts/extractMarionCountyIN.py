#!/usr/bin/env python3
"""
Marion County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). The FIRST member
of the `in-county-acfr` family, and the FIRST entity anywhere in TT to use
`target_column='last'`.

── ⚠⚠ WHY TOTAL GOVERNMENTAL FUNDS AND NOT THE GENERAL FUND ────────────────

Every other entity in this library extracts the General Fund. Indiana's counties
do not, for a measured reason: Gateway's AFR — TT's statewide Indiana source —
is an all-funds treasury cash report, so a county auditor's custodial money
(property tax settled and local income tax distributed for every OTHER taxing
unit in the county) is inside it. Marion County FY2023 loads 3.3x the county's
own audited governmental-funds revenue because of that, and a true own-funds
scope is NOT derivable from the Gateway extract.

⚠ A General Fund extraction would add almost nothing here. Gateway's General Fund
receipts for Marion FY2025 are $302,836,808.87 against this document's
$304,421,719 — 0.5% apart on a cash-vs-GAAP basis. Gateway's General Fund was
never the problem; the inflation is entirely in the non-General funds. The
governmental-funds total is the figure that answers the question.

── ⚠⚠ THE STATEMENT ANCHOR MUST DEMAND "GOVERNMENTAL FUNDS" ────────────────

This document contains FOUR statements whose titles begin the same way:

    p.45  Statement of Revenues, Expenditures, and Changes in Fund Balances
          - GOVERNMENTAL FUNDS                                      <- the one
    p.96  Schedule of ... - Budget and Actual - General Fund        (budgetary)
    p.101 Schedule of ... - Budget and Actual - County Public Safety Income Tax
    p.114 Statement of ... - GENERAL FUND                           <- the trap
    p.119 Combining Statement of ... - Nonmajor Governmental Funds

The library's `_EXCLUDE` list catches 'combining', 'budgetary' and 'budget and
actual', but NOT a plain General-Fund-only statement. Landing on p.114 would
give a page with ONE fund column, and `target_column='last'` would happily read
it — returning the General Fund under a total-governmental label, tying at $0,
with nothing anywhere to say the scope was wrong. So the anchor REQUIRES the
words "Governmental Funds" rather than merely tolerating them.

⚠ This is failure mode 4 ("picking up a budgetary schedule") in a new costume:
same silent-wrong-scope shape, different neighbouring statement.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on this document, not
carried from another entity — and the printed total governmental revenue for
FY2025 is 463,520,173, already whole dollars for a county of ~977,000.
`units=1` (the default).

── STRUCTURE, READ FROM THE PRINTED PAGE ────────────────────────────────────

    Revenues:                                <- FLAT, no grouping
        Taxes / Intergovernmental / Interest / Charges for services /
        Traffic violations and court fees / Miscellaneous
    Expenditures:
        Current:                             <- parent
            Administration and finance / Protection of people and property /
            Corrections / Judicial / Culture and recreation /
            Real estate and assessments / Health and welfare
        Debt service:                        <- parent
            Redemption of notes, financed purchase and subscription
                obligations               <- ⚠ WRAPPED LABEL over two lines
            Interest / Lease payments and other
        Capital outlay                       <- root leaf, peer of the parents

⚠ `revenue_parents` is deliberately EMPTY: the revenue section prints no group
headings, so every source is a root leaf. Inventing a `Taxes:` parent here would
be structure the issuer did not print.

── ⚠ THE COLUMN COUNT IS A PROPERTY OF THE YEAR ────────────────────────────

FY2025 prints SIX fund columns but its `Total revenues` row exposes only FOUR
money tokens, because the two GASB 100 "(formerly a major fund)" columns —
Federal Grants and Circle City Forward Lease, both moved major -> nonmajor
effective 2025-01-01 — are entirely dash-zero. `target_column='last'` resolves
against the columns actually present, which is exactly why it is `'last'` and
not an index.

── ⚠⚠ THIS COUNTY CARRIES FOUR RECORDED ANOMALY FLAGS ─────────────────────

See `scripts/data/inGatewayAnomalies.mjs`. They describe the GATEWAY series, not
this document — but FY2012's double-reported settlement and FY2019's $1.99B
payroll clearing are both Gateway artefacts that this audited series should NOT
reproduce. If an extracted year here matches a flagged Gateway figure, something
is wrong.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠ Requires "Governmental Funds" — see the module docstring. A looser anchor
# matches the General-Fund-only statement on p.114 and silently changes scope.
STATEMENT_ANCHOR = (
    r'Statement\s+of\s+Revenues,?\s+Expenditures,?\s+and\s+Changes\s+in\s+Fund'
    r'\s+Balances[\s\S]{0,200}?Governmental\s+Funds'
)

CONFIG = CityConfig(
    city='Marion County, IN',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
