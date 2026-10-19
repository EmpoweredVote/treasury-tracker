"""Selftests for scripts/lib/nySchoolAcfrGF.py.

Stdlib only -- the reader's pure functions take plain dicts in pdfplumber's
word shape, so none of this needs a PDF or pdfplumber installed.

⚠ Every case here is a failure that ACTUALLY OCCURRED while reconciling
Rochester and Buffalo FY2016-FY2025 against FAC, and every one of them returned
a WRONG NUMBER rather than raising. The geometry is copied from the real
documents, not invented.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import nySchoolAcfrGF as M  # noqa: E402

FAILS = []
RAN = 0


def check(name, got, want):
    global RAN
    RAN += 1
    if got != want:
        FAILS.append(f"{name}\n     got  {got!r}\n     want {want!r}")


def W(text, x0, x1, top=100.0):
    return {'text': text, 'x0': x0, 'x1': x1, 'top': top}


# ---------------------------------------------------------------- trap 1
# Rochester FY2021 p52, "Total revenues", measured coordinates. Fragments of one
# number TOUCH; the next fund starts 36.56pt later.
ROW_TOTAL_REV = [
    W('Total', 100.27, 121.91), W('revenues', 124.74, 161.05),
    W('7', 413.80, 419.01), W('36,920,574', 419.01, 465.91),
    W('9', 502.46, 507.67), W('8,289,978', 507.67, 549.36),
]

check('digit-leading split rejoins into two funds, not one number',
      M.runs_of(ROW_TOTAL_REV), [(736920574.0, 465.91), (98289978.0, 549.36)])

check('label survives with the money stripped',
      M.label_of(ROW_TOTAL_REV), 'total revenues')

# ⚠ The other half of trap 1: a COMMA-leading fragment. Requiring a leading
# digit kept only the "1" and reported other financing sources of 4 where the
# truth was 5,705,200.
check('comma-leading split also rejoins',
      M.runs_of([W('Net', 100.0, 118.0), W('premium', 120.0, 150.0),
                 W('1', 413.80, 419.01), W(',814,378', 419.01, 465.91)]),
      [(1814378.0, 465.91)])

check('a printed dash is a real zero, not a missing cell',
      M.runs_of([W('Surplus', 100.0, 130.0), W('food', 132.0, 150.0),
                 W('-', 462.0, 465.91)]),
      [(0.0, 465.91)])

check('parentheses are negative',
      M.runs_of([W('Transfers', 100.0, 140.0), W('out', 142.0, 155.0),
                 W('(86,316,186)', 410.0, 465.91)]),
      [(-86316186.0, 465.91)])

# ---------------------------------------------------------------- trap 2
# Rochester FY2025: the General Fund prints NO transfers in, so the only figure
# on the row belongs to SPECIAL AID. Taking "the first number" read 7,120,721 as
# the district's own and overstated OSC's expected revenue by exactly that.
GF_X1 = 465.91
ROW_TRANSFERS_IN_BLANK_GF = [
    W('Transfers', 100.0, 140.0), W('in', 142.0, 150.0),
    W('7,120,721', 505.0, 549.36),          # SPECIAL AID's column, not ours
]
check('a blank General Fund cell yields None, NOT the next fund\'s money',
      M.gf_value(M.runs_of(ROW_TRANSFERS_IN_BLANK_GF), GF_X1), None)

check('the same row read at the SPECIAL AID anchor does find it',
      M.gf_value(M.runs_of(ROW_TRANSFERS_IN_BLANK_GF), 549.36), 7120721.0)

check('a populated General Fund cell is found at the anchor',
      M.gf_value(M.runs_of(ROW_TOTAL_REV), GF_X1), 736920574.0)

# The anchor must come off a TOTAL row, which is always printed in every column.
check('anchor_of uses a total row',
      M.anchor_of([('use of money and property', [(282105.0, 465.91)]),
                   ('total revenues', [(736920574.0, 465.91), (98289978.0, 549.36)])]),
      465.91)

check('anchor_of returns None when no total row is present',
      M.anchor_of([('some label', [(1.0, 10.0)])]), None)

# ---------------------------------------------------------------- trap 3
# Only a continuation that RE-PRINTS `General` still carries our column.
check('Buffalo-style continuation (more ROWS) is followed',
      M.continues_general_fund(
          'BOARD OF EDUCATION, CITY OF BUFFALO, NEW YORK\n'
          'STATEMENT ... GOVERNMENTAL FUNDS (CONTINUED)\n'
          'FOR THE YEAR ENDED JUNE 30, 2019\n'
          'Nonmajor Total\nGeneral Special Aid Capital Projects Funds Funds\n'),
      True)

# ⚠ Rochester FY2021 p53 VERBATIM. It carries School Food Service, Debt
# Service, Capital Projects, RJSCB and the Total -- no General Fund at all. It
# is refused on the `continued` test, because the page says neither word.
check('Rochester-style continuation (more COLUMNS, other funds) is REFUSED',
      M.continues_general_fund(
          '____________________\n'
          'School Debt Capital Total Governmental\n'
          'Food Service Service Projects RJSCB Funds\n'),
      False)

# ⚠⚠ AND THE SAME SHAPE THAT DOES SAY "CONTINUED". The case above never
# reaches the `General` test, so on its own it leaves that guard unproven: with
# the guard replaced by `return True` the suite still passed. This one has to
# get past `continued` and be refused on the column header alone, which is the
# only thing standing between a column-continuation and reading SCHOOL FOOD
# SERVICE as the district's General Fund.
check('a continuation that says CONTINUED but carries other funds is REFUSED',
      M.continues_general_fund(
          'ROCHESTER CITY SCHOOL DISTRICT (continued)\n'
          'School Debt Capital Total Governmental\n'
          'Food Service Service Projects RJSCB Funds\n'),
      False)

check('a page that merely says General but is not a continuation is refused',
      M.continues_general_fund('General Fund narrative discussion\n'), False)

# ---------------------------------------------------------------- page choice
check('the real statement page is accepted',
      M.is_statement_page(
          'ROCHESTER CITY SCHOOL DISTRICT\n'
          'STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES\n'
          'GOVERNMENTAL FUNDS\nFOR THE FISCAL YEAR ENDED JUNE 30, 2021\n'
          'Total revenues 736,920,574\n'),
      True)

# ⚠ Rochester prints a General-Fund budgetary schedule on a NON-GAAP BUDGET
# BASIS in every year. Loading one would put budget-basis figures under an
# audited label.
check('the budgetary schedule is refused',
      M.is_statement_page(
          'ROCHESTER CITY SCHOOL DISTRICT\n'
          'SCHEDULE OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCE\n'
          'BUDGET AND ACTUAL (NON-GAAP BUDGET BASIS) - GENERAL FUND\n'
          'FOR THE FISCAL YEAR ENDED JUNE 30, 2021\nTotal revenues 1\n'),
      False)

# ⚠ The statistical section prints a ten-year governmental-funds table whose
# title shares every word with the statement. It carries NO 'budget' keyword, so
# only the 'last ten' test rejects it.
check('the statistical ten-year table is refused',
      M.is_statement_page(
          'ROCHESTER CITY SCHOOL DISTRICT\n'
          'CHANGES IN FUND BALANCES - GOVERNMENTAL FUNDS\n'
          'LAST TEN FISCAL YEARS\n(modified accrual basis of accounting)\n'
          'STATEMENT OF REVENUES total revenues\n'),
      False)

# ---------------------------------------------------------------- harvest
# Rochester FY2021, both pages: the General Fund totals plus the other financing
# block, with the printed net as a self-check.
ROCH_P52 = [
    ('total revenues', [(736920574.0, 465.91), (98289978.0, 549.36)]),
    ('total expenditures', [(602986637.0, 465.91), (97276040.0, 549.36)]),
    ('other financing sources (uses)', []),
    ('net premium on debt issuance', [(1814378.0, 465.91)]),
    ('transfers in', [(3890822.0, 465.91)]),
    ('transfers out', [(-86316186.0, 465.91), (-1013938.0, 549.36)]),
    ('total other financing sources (uses)', [(-80610986.0, 465.91)]),
    ('net change in fund balances', [(53322951.0, 465.91)]),
]
got = M.harvest([(52, ROCH_P52)])
check('harvest: revenues', got['revenues'], 736920574.0)
check('harvest: expenditures', got['expenditures'], 602986637.0)
check('harvest: other financing sources', got['ofs_sources'], 5705200.0)
check('harvest: other financing uses', got['ofs_uses'], -86316186.0)
check('harvest: components rebuild the PRINTED net', got['ofs_check'], 0.0)
check('harvest: pages', got['pages'], [52])

# ⭐ The reconciliation rule itself, on the real figures.
check('OSC revenue == ACFR revenues + other financing sources',
      got['revenues'] + got['ofs_sources'], 742625774.0)
check('OSC expenditure == ACFR expenditures + other financing uses',
      got['expenditures'] - got['ofs_uses'], 689302823.0)

# ⚠ Rows AFTER the other-financing block must not be swept into it.
check('fund balance rows do not leak into other financing',
      M.harvest([(1, ROCH_P52 + [('fund balances - ending', [(135838267.0, 465.91)])])])
      ['ofs_sources'], 5705200.0)

# A netted presentation (Buffalo FY2020+) names itself, so the caller can refuse
# the year instead of reporting a false mismatch.
BUF_NETTED = [
    ('total revenues', [(911684853.0, 258.37)]),
    ('total expenditures', [(756499661.0, 258.37)]),
    ('other financing sources (uses)', []),
    ('transfer to city of buffalo for debt service', [(-9068540.0, 258.37)]),
    ('operating transfers, net', [(-99411075.0, 258.37)]),
    ('total other financing sources (uses)', [(-108479615.0, 258.37)]),
]
netted = M.harvest([(15, BUF_NETTED)])
check('a netted transfers presentation is FLAGGED',
      netted.get('transfers_netted'), True)
check('a gross presentation is not flagged',
      M.harvest([(52, ROCH_P52)]).get('transfers_netted'), None)

# Buffalo FY2019: the other-financing block is on the CONTINUATION page, and the
# columns shift, so each block is anchored separately.
BUF_P25 = [
    ('total revenues', [(911107907.0, 348.87), (116361465.0, 420.0)]),
    ('total expenditures', [(765306358.0, 348.87), (119302436.0, 420.0)]),
]
BUF_P26 = [
    ('excess (deficit) of revenues over expenditures', [(145801549.0, 300.0)]),
    ('other financing sources (uses)', []),
    ('transfer to city of buffalo debt service fund', [(-10429505.0, 300.0)]),
    ('interfund transfers in', [(411262.0, 300.0)]),
    ('interfund transfers out', [(-106832971.0, 300.0)]),
    ('total other financing sources (uses)', [(-116851214.0, 300.0)]),
]
buf = M.harvest([(25, BUF_P25), (26, BUF_P26)])
check('continuation: revenues come from the first page', buf['revenues'], 911107907.0)
check('continuation: sources come from the second page', buf['ofs_sources'], 411262.0)
check('continuation: uses come from the second page', buf['ofs_uses'], -117262476.0)
check('continuation: self-check still closes', buf['ofs_check'], 0.0)
check('continuation: both pages recorded', buf['pages'], [25, 26])

# ---------------------------------------------------------------- report
if FAILS:
    print(f"\n{len(FAILS)} of {RAN} nySchoolAcfrGF selftests FAILED:\n")
    for f in FAILS:
        print(f"  x  {f}")
    sys.exit(1)
print(f"nySchoolAcfrGF: {RAN} selftests passed")
