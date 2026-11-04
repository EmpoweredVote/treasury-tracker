"""Selftests for the wrapped-name repair in scripts/extractSanJose.py.

⚠ Every case here is taken from the REAL line sequence of
`docs/SanJose/20232024 Adopted Operating Budget  WEB.pdf`, pages 164-166 —
the table pages and the narrative legend page that sits beside them. The prose
fragments are copied from p164 verbatim, because the danger in a
rejoin-the-previous-line rule is not that it fails to join, it is that it joins
BODY COPY to a row and invents a department that does not exist.

⚠⚠ The TAIL-WRAP case ('and Cultural Affairs') was INVISIBLE in production:
it produced `City Manager - Office of Economic Development`, a truncation that
reads as a complete department name, ties its total, and is not a duplicate.
No gate in this repo could have found it. Only the HEAD-WRAP half announced
itself, by leaving two roots both called `Department`.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import extractSanJose as M  # noqa: E402

FAILS = []
RAN = 0


def check(name, got, want):
    global RAN
    RAN += 1
    if got != want:
        FAILS.append(f"{name}\n     got  {got!r}\n     want {want!r}")


def row(name, amount):
    return {'kind': 'row', 'name': name, 'amount': amount}


def text(t):
    return {'kind': 'text', 'text': t}


def names(entries):
    return [(r['name'], r['amount']) for r in M.resolve_wrapped_names(entries)]


# ── HEAD-WRAP: the amounts land on the second line ───────────────────────────
# p166, verbatim. Both of these became a root literally named 'Department'.
check(
    'head-wrap: Parks',
    names([text('Parks, Recreation and Neighborhood Services'),
           row('Department', 123327077)]),
    [('Parks, Recreation and Neighborhood Services Department', 123327077)],
)
check(
    'head-wrap: Planning',
    names([text('Planning, Building and Code Enforcement'),
           row('Department', 17742369)]),
    [('Planning, Building and Code Enforcement Department', 17742369)],
)

# ── TAIL-WRAP: the amounts land on the first line ────────────────────────────
# p165, verbatim. The stored name silently lost ' and Cultural Affairs'.
check(
    'tail-wrap: Economic Development',
    names([row('City Manager - Office of Economic Development', 6409746),
           text('and Cultural Affairs')]),
    [('City Manager - Office of Economic Development and Cultural Affairs', 6409746)],
)

# ── The rule must NOT fire on ordinary rows ──────────────────────────────────
check(
    'untouched: a complete row followed by a complete row',
    names([row("City Attorney's Office", 17856689),
           row("City Auditor's Office", 2922493)]),
    [("City Attorney's Office", 17856689), ("City Auditor's Office", 2922493)],
)
check(
    'untouched: section header before a row',
    names([text('PUBLIC SAFETY DEPARTMENTS'), row('Fire Department', 280269287)]),
    [('Fire Department', 280269287)],
)

# ⚠⚠ THE CASE THAT MATTERS MOST. p164 is a narrative legend whose lines are
# prose fragments. If one of them ever sits next to a parsed row, the rule must
# refuse it — a joined name here would be a department invented from body copy.
for prose in ['provide for the overall management and',
              'the safety of the public through crime and',
              'fire prevention and suppression efforts of',
              'provide programs that affect citizens on a',
              'expenses, capital contributions, transfers',
              'Departments.']:
    check(
        f'prose refused after a row: {prose[:28]!r}',
        names([row('Fire Department', 280269287), text(prose)]),
        [('Fire Department', 280269287)],
    )

# 'the Public Works and Transportation' is the hardest prose line: it starts
# lowercase AND carries capitalised words, so only the structural guard (it
# never follows a row on the legend page) separates it from a real tail. The
# rule DOES accept it in isolation; this test pins that known limit rather than
# pretending otherwise.
check(
    'KNOWN LIMIT: capitalised prose that starts lowercase is accepted',
    names([row('Fire Department', 280269287), text('the Public Works and Transportation')]),
    [('Fire Department the Public Works and Transportation', 280269287)],
)

# ── Tail-shape rules ─────────────────────────────────────────────────────────
check('bare tail: Department', M._is_bare_tail('Department'), True)
check('bare tail: case-insensitive', M._is_bare_tail('  DEPARTMENT '), True)
check('bare tail: a real name is not one', M._is_bare_tail('Fire Department'), False)
check('name tail: and-opener', M._is_name_tail('and Cultural Affairs'), True)
check('name tail: no capitalised word', M._is_name_tail('provide for the overall and'), False)
check('name tail: sentence end refused', M._is_name_tail('and Cultural Affairs.'), False)
check('name tail: overlong refused', M._is_name_tail('and ' + 'X' * 60), False)
check('name tail: a new ALL-CAPS section is not a tail',
      M._is_name_tail('PUBLIC SAFETY DEPARTMENTS'), False)

# ── A text entry is consumed once, never twice ───────────────────────────────
check(
    'a tail is not also used as the next head',
    names([row('City Manager - Office of Economic Development', 6409746),
           text('and Cultural Affairs'),
           row('Finance Department', 23363689)]),
    [('City Manager - Office of Economic Development and Cultural Affairs', 6409746),
     ('Finance Department', 23363689)],
)

# ── The full p165 General Government block, in document order ────────────────
check(
    'p165 General Government block',
    names([
        text('GENERAL GOVERNMENT DEPARTMENTS'),
        row("City Attorney's Office", 17856689),
        row("City Auditor's Office", 2922493),
        row("City Clerk's Office", 3857447),
        row("City Manager's Office", 23042825),
        row('City Manager - Office of Economic Development', 6409746),
        text('and Cultural Affairs'),
        row('Finance Department', 23363689),
        row('Human Resources Department', 15048902),
    ]),
    [("City Attorney's Office", 17856689),
     ("City Auditor's Office", 2922493),
     ("City Clerk's Office", 3857447),
     ("City Manager's Office", 23042825),
     ('City Manager - Office of Economic Development and Cultural Affairs', 6409746),
     ('Finance Department', 23363689),
     ('Human Resources Department', 15048902)],
)

# ── END-TO-END over real page text ───────────────────────────────────────────
#
# ⚠⚠ THESE EXIST BECAUSE THE TESTS ABOVE DID NOT CATCH THE FIX BEING REVERTED.
# Mutating the one line that KEEPS an amount-less line — the entire repair —
# left all of the hand-built cases green, because they construct entry lists
# directly and never run the collection step. A guard that cannot fail when the
# thing it guards is removed is not a guard. This text is copied verbatim from
# p165/p166 of the FY2024 book, including the wraps.

P165 = """CITY OF SAN JOSE
2023-2024 ADOPTED OPERATING BUDGET
SUMMARY OF GENERAL FUND USES
1 2 3 4 5 2 TO 5
USE OF FUNDS Actuals Budget Budget* Budget Budget (Decrease)
GENERAL GOVERNMENT DEPARTMENTS
City Attorney's Office 15,458,618 17,369,004 17,899,571 14,802,245 17,856,689 2.8%
City Manager - Office of Economic Development 5,638,221 5,903,054 6,000,000 6,100,000 6,409,746 8.6%
and Cultural Affairs
Finance Department 20,215,451 21,781,539 22,000,000 22,500,000 23,363,689 7.3%
Total General Government Departments 118,012,765 134,800,543 138,657,874 126,561,175 144,689,076 7.3%
"""

P166 = """CITY OF SAN JOSE
2023-2024 ADOPTED OPERATING BUDGET
COMMUNITY SERVICES DEPARTMENTS
Library Department 38,344,421 40,945,754 41,624,422 43,249,227 46,409,083 13.3%
Parks, Recreation and Neighborhood Services
Department 82,101,880 104,521,534 104,448,950 106,264,161 123,327,077 18.0%
Planning, Building and Code Enforcement
Department 13,545,150 17,641,914 17,583,935 16,741,913 17,742,369 0.6%
Housing Department 428,868 617,658 623,374 580,951 600,949 -2.7%
"""


def e2e(page_text):
    return [(r['name'], r['amounts'][0]) for r in M.rows_from_page_text(page_text)]


check(
    'END-TO-END p165: tail-wrap repaired, totals still dropped',
    e2e(P165),
    [("City Attorney's Office", 17856689),
     ('City Manager - Office of Economic Development and Cultural Affairs', 6409746),
     ('Finance Department', 23363689)],
)

check(
    'END-TO-END p166: both head-wraps repaired, no root named "Department"',
    e2e(P166),
    [('Library Department', 46409083),
     ('Parks, Recreation and Neighborhood Services Department', 123327077),
     ('Planning, Building and Code Enforcement Department', 17742369),
     ('Housing Department', 600949)],
)

# The defect itself, stated as an assertion: no root may be a bare wrap tail.
for page in (P165, P166):
    for r in M.rows_from_page_text(page):
        check(f'no bare-tail root survives: {r["name"]!r}', M._is_bare_tail(r['name']), False)

if FAILS:
    print(f'FAILED {len(FAILS)} of {RAN}:\n')
    for f in FAILS:
        print(f'  - {f}')
    sys.exit(1)
print(f'ok - {RAN} extractSanJose selftests passed')
