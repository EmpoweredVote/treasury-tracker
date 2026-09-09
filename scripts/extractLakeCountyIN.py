#!/usr/bin/env python3
"""
Lake County, Indiana ACFR — TOTAL GOVERNMENTAL FUNDS extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`). Wave 1 of the
Indiana county ACFR route; see `scripts/extractMarionCountyIN.py` for why this
family reads the Total Governmental Funds column rather than the General Fund.

── ⚠⚠ ONLY TWO OF LAKE'S EIGHT FILINGS ARE GAAP AT ALL ────────────────────

Lake County is the reason this route measures basis per FILING rather than per
government. Of its eight accepted FAC filings, **six are State Board of Accounts
regulatory-basis reports** — `Statement of Receipts, Disbursements, and Cash and
Investment Balances - Regulatory Basis`, which is Gateway's own cash data with an
audit opinion on it, containing no governmental-funds statement to read. Only
**FY2020 and FY2021** carry the GASB 34 presentation:

    FY2016, FY2017, FY2018, FY2022, FY2023, FY2024   regulatory basis  -> not loadable here
    FY2020, FY2021                                   GAAP              -> loaded

Both signals in FAC's own metadata agree on every one of the 562 Indiana county
filings — `gaap_results` contains `not_gaap` exactly when `sp_framework_basis` is
non-empty — and the documents themselves confirm it. The gap is declared in
`IN_COUNTY_BASIS_GAPS`; it is a BASIS gap, not a coverage gap and not a
document-quality gap, and it is never a $0.

⚠⚠ SO THE COVER TITLE IS NOT THE TEST. Allen County's GAAP filings also carry a
plain SBOA `ANNUAL FINANCIAL REPORT` cover; Lake's regulatory-basis ones carry a
`FINANCIAL STATEMENT AUDIT REPORT` cover. The basis is read from the STATEMENTS.

── STRUCTURE, READ FROM THE PRINTED PAGE (FY2020, FY2021) ───────────────────

    Revenues                                 <- FLAT, no grouping, 16 sources
        General Property Taxes / Local Income Tax /
        Financial Institution Tax Distribution /
        Motor Vehicle/Aircraft Excise Tax Distribution /
        Commercial Vehicle Excise Tax Distribution (CVET) /
        Casino/Riverboard Distribution / Motor Vehicle Highway Distribution /
        Local Road and Street Distribution / Licenses and Permits /
        Fines, Forfeitures, and Fees / Charges for Services /
        Intergovernmental / Earnings on Investments and Deposits /
        Refunds and Reimbursements / Interfund Loans / Other Receipts
    Expenditures
        General government / Public Safety / Highways and streets /
        Sanitation / Health and welfare / Culture and recreation   <- ROOT LEAVES
        Debt Service:                        <- parent
            Principal - General Obligation Bonds /
            Principal - First Mortgage Bonds / Principal - Capital Leases /
            Interest on Debt Service
        Capital Outlay:                      <- parent
            General government / Public Safety / Highway & streets /
            Health and welfare / Culture & recreation

⚠⚠ THREE COUNTIES, THREE EXPENDITURE SHAPES. Marion prints `Current:` and `Debt
service:` as parents with `Capital outlay` a root LEAF; Allen and Hamilton print
all three as parents; Lake prints NO `Current:` heading at all — its six function
lines are peers of the two parents. A `parents=('current', …)` entry copied from
a neighbouring county matches nothing here, which is failure mode 2 exactly: the
statement would still tie to the cent.

⚠ `root_leaves` is empty because Lake's six function lines are printed BEFORE the
first parent opens, so they are already root children. Nothing has to close.

⚠ `Interfund Loans` is printed INSIDE the revenue section, above `Total
revenues`, and is loaded as published. Reclassifying it as a transfer would be
inferring intent — the Milledgeville rule.

── UNITS: WHOLE DOLLARS ─────────────────────────────────────────────────────

No units caption appears on the statement page — checked on this document — and
FY2020's printed total governmental revenue is 351,845,744 for a county of
~503,000. `units=1` (the default).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, run_cli  # noqa: E402

# ⚠⚠ LAKE PRINTS "Governmental Funds" BEFORE THE TITLE, NOT AFTER IT:
#     `Governmental Funds - Statement of Revenues, Expenditures and Changes in
#      Fund Balances`
# The Marion/Allen/Hamilton anchor requires the words to FOLLOW `Fund Balances`
# and matches nothing here. The requirement is the same — failure mode 10, a
# General-Fund-only statement must not qualify — only the order differs.
STATEMENT_ANCHOR = (
    r'Governmental\s+Funds\s*[-‐-―]\s*Statement\s+of\s+Revenues\s*,?\s*'
    r'Expenditures\s*,?\s*and\s+Changes\s+in\s+Fund\s+Balances?'
)

CONFIG = CityConfig(
    city='Lake County, IN',
    parents=('debt service', 'capital outlay'),
    root_leaves=(),
    fy_end=('December', 31),
    statement_anchor=STATEMENT_ANCHOR,
    target_column='last',
)

if __name__ == '__main__':
    run_cli(CONFIG)
