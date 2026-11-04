#!/usr/bin/env python3
"""
extractSanJose.py — San Jose General Fund extractor (v2)

Targets the two consolidated summary tables in each annual Adopted Operating Budget PDF:
  - SUMMARY OF GENERAL FUND SOURCES   (revenue categories, pages ~162-163 in FY2024-25)
  - SUMMARY OF GENERAL FUND USES      (dept expenditures, pages ~165-166 in FY2024-25)

Both tables have 5 numeric columns:
  col1 = prior-2 yr actuals | col2 = prior yr adopted | col3 = prior yr modified
  col4 = prior yr forecast  | col5 = CURRENT yr adopted  <- the one we extract

Amounts are in full dollars (NOT thousands).
FY detected from page header "2024-2025 ADOPTED OPERATING BUDGET" -> end year 2025.

Enterprise fund filtering: not needed — the SUMMARY OF GENERAL FUND USES table
already contains only General Fund department allocations. Enterprise departments
appear as "Special Funds" entries in a different section.

Output: compatible with processSanJose.js — list of one object per PDF:
  [{page_num, fund, col_types: ['adopted'], fiscal_years: [YYYY],
    revenue_items: [{name, amounts: [N]}],
    expenditure_items: [{name, amounts: [N]}]}]

Usage:
  python scripts/extractSanJose.py "docs/SanJose/20242025 Adopted Operating Budget.pdf"
"""

import sys
import json
import re
import pdfplumber

# Section markers — two format variants across fiscal years:
#   Old (FY2016-17 to ~FY2021-22): "SUMMARY OF GENERAL FUND USES/SOURCES"
#   New (FY2022-23+):              "FIVE-YEAR COMPARISON OF GENERAL FUND USES/SOURCES"
# Both table pages also carry a "SOURCE OF FUNDS" / "USE OF FUNDS" column header;
# pie-chart pages with the same title do NOT — use that to avoid false positives.
_USES_MARKERS     = {'SUMMARY OF GENERAL FUND USES',
                     'FIVE-YEAR COMPARISON OF GENERAL FUND USES'}
_USES_CAT_MARKERS = {'SUMMARY OF GENERAL FUND USES BY CATEGORY',
                     'FIVE-YEAR COMPARISON OF GENERAL FUND USES BY CATEGORY'}
_SOURCES_MARKERS  = {'SUMMARY OF GENERAL FUND SOURCES',
                     'FIVE-YEAR COMPARISON OF GENERAL FUND SOURCES'}
CIP_MARKER        = 'CAPITAL IMPROVEMENT PROGRAM'


def _has_marker(text, markers):
    return any(m in text for m in markers)

# Lines to skip inside the table body
_SKIP_RE = re.compile(
    r'^(?:'
    r'CITY OF SAN JOSE'
    r'|2\d{3}-2\d{3}\s'           # "2022-2023 Adopted Modified..." header rows
    r'|1\s+2\s+3'                  # column number header "1 2 3 4 5 2 TO 5"
    r'|USE OF FUNDS'
    r'|SOURCE OF FUNDS'
    r'|GENERAL GOVERNMENT'
    r'|PUBLIC SAFETY'
    r'|CAPITAL MAINTENANCE'
    r'|COMMUNITY SERVICES'
    r'|OTHER EXPENDITURES'
    r'|FUND BALANCE'
    r'|GENERAL REVENUE'
    r'|SPECIAL REVENUE'
    r'|TRANSFERS AND'
    r'|Subtotal\b'
    r'|Total\b'
    r'|TOTAL\b'
    r'|\*\s+As'                    # "* As of June 30, 2024"
    r'|-\s*\d+\s*-'               # page numbers like "- 163 -"
    r')',
    re.IGNORECASE,
)


def parse_fy(text):
    """
    Extract fiscal year ending integer from PDF page header.
    '2024-2025 ADOPTED OPERATING BUDGET' -> 2025
    """
    m = re.search(r'(\d{4})-(\d{4})\s+(?:Adopted|ADOPTED)', text)
    return int(m.group(2)) if m else None


def parse_money(s):
    """Parse '19,031,941' or '(576,480,540)' -> int."""
    s = s.replace(',', '').replace('$', '').replace(' ', '')
    neg = s.startswith('(') and s.endswith(')')
    if neg:
        s = s[1:-1]
    try:
        v = int(float(s))
        return -v if neg else v
    except (ValueError, TypeError):
        return None


def extract_5th_amount(line):
    """
    Parse one table data row: return (dept_name, adopted_amount) or (None, None).

    Row format:  "Department Name [$ ]A [$ ]B [$ ]C [$ ]D [$ ]E  X.X%"
    Note: the '$' sign only appears on the first item in each sub-section — other
    rows (e.g. "Sales Tax 343,472,084 ...") have bare numbers. We find the first
    large number (5+ char sequence) to split name from amounts.
    """
    # Strip trailing percentage: "6.6%", "(3.2%)", "19.6%"
    clean = re.sub(r'\s+\(?-?\d+\.\d+%?\)?$', '', line)

    # Find all large number tokens (5+ chars of digits+commas covers 4-digit+ amounts)
    amounts = re.findall(r'\(?\d[\d,]{3,}\)?', clean)
    if len(amounts) < 5:
        return None, None

    # Department name = everything before the first large number
    m = re.search(r'\(?\d[\d,]{3,}\)?', clean)
    dept = clean[:m.start()].strip().rstrip('$').strip()
    if len(dept) < 2:
        return None, None

    v = parse_money(amounts[4])     # 5th column = current-year Adopted Budget
    if v is None or abs(v) < 1000:  # ignore noise / page numbers
        return None, None

    return dept, v


# ── Wrapped department names ─────────────────────────────────────────────────
#
# ⚠⚠ A NAME THAT WRAPS IN THE PDF LOSES HALF OF ITSELF, AND THE TWO HALVES FAIL
# DIFFERENTLY. `page.extract_text()` returns physical lines, and a row is only
# recognised by its five amounts, so a department whose name spans two lines
# breaks one of two ways (both observed on p165-166 of the FY2024 book):
#
#   HEAD-WRAP — the amounts land on the SECOND line:
#       'Parks, Recreation and Neighborhood Services'        <- no amounts, dropped
#       'Department                      123,327,077'        <- name becomes 'Department'
#     Visible: `Department` appeared twice as a root and the duplicate-root
#     counter in scripts/lib/totalsTie.mjs caught it.
#
#   TAIL-WRAP — the amounts land on the FIRST line:
#       'City Manager - Office of Economic Development  6,409,746'
#       'and Cultural Affairs'                               <- no amounts, dropped
#     ⚠⚠⚠ INVISIBLE. The stored name is a truncation that reads as a complete,
#     plausible department. Nothing in this repo can detect it: it is not a
#     duplicate, it ties, and it is spelled correctly. It was found only by
#     printing every non-parsing line while chasing the head-wrap.
#
# ⚠ THE RULE MUST BE NARROW. These pages sit next to a NARRATIVE legend page
# (p164) whose every line is a prose fragment — 'provide for the overall
# management and', 'the Public Works and Transportation'. Joining those to a
# row would invent department names out of body copy. Two things keep that from
# happening: resolution runs PER PAGE over an ordered entry list, and the legend
# page contributes ZERO rows, so neither rule has anything to attach to. The
# capitalisation test below is the second line of defence, not the first.

# A row whose whole name is one of these is a wrap tail, never a department.
_BARE_TAIL = {'department', 'departments', 'office', 'offices'}

# Connector words a genuine name-tail may start with.
_TAIL_START = re.compile(r'^(?:and\b|&)', re.IGNORECASE)


def _is_bare_tail(name):
    """'Department' is never a department name — it is the end of one."""
    return name.strip().lower() in _BARE_TAIL


def _is_name_tail(text):
    """
    Could this amount-less line be the END of the name on the line above?

    Requires a continuation opener (or a lowercase first letter), a capitalised
    word somewhere (prose fragments like 'provide for the overall management
    and' have none), and no sentence-ending period.
    """
    t = text.strip()
    if not t or len(t) > 45 or t.endswith('.'):
        return False
    if not (_TAIL_START.match(t) or t[:1].islower()):
        return False
    words = re.findall(r"[A-Za-z][A-Za-z'&-]*", t)
    return any(w[:1].isupper() for w in words)


def resolve_wrapped_names(entries):
    """
    Rejoin names split across two physical lines.

    `entries` is one page's surviving lines IN ORDER, each either
    {'kind': 'row', 'name', 'amount'} or {'kind': 'text', 'text'}.
    Returns the rows, with wrapped names repaired. Text entries that are not
    consumed as a wrap half are discarded, exactly as before.
    """
    rows = []
    i = 0
    n = len(entries)
    while i < n:
        e = entries[i]
        nxt = entries[i + 1] if i + 1 < n else None

        if e['kind'] == 'text':
            # HEAD-WRAP: this line is the start of the NEXT row's name.
            if nxt and nxt['kind'] == 'row' and _is_bare_tail(nxt['name']):
                rows.append({'kind': 'row',
                             'name': f"{e['text'].strip()} {nxt['name'].strip()}",
                             'amount': nxt['amount']})
                i += 2
                continue
            i += 1
            continue

        # TAIL-WRAP: the NEXT line finishes this row's name.
        if nxt and nxt['kind'] == 'text' and _is_name_tail(nxt['text']):
            rows.append({'kind': 'row',
                         'name': f"{e['name'].strip()} {nxt['text'].strip()}",
                         'amount': e['amount']})
            i += 2
            continue

        rows.append(e)
        i += 1
    return rows


def rows_from_page_text(text):
    """
    Turn ONE table page's text into [{'name', 'amounts': [N]}].

    ⚠⚠ PURE ON PURPOSE, AND THE REASON IS A TEST THAT PASSED WHEN IT SHOULD NOT
    HAVE. While `resolve_wrapped_names` lived here inline, the selftest built
    its entry lists by hand, so reverting the one line that KEEPS an amount-less
    line — the whole fix — left all 22 tests green. The collection step and the
    repair have to be exercised together or the repair is not actually guarded.
    Taking page text in and rows out is what makes that possible without a PDF.
    """
    skip_subsection = False  # True while inside the FUND BALANCE sub-section
    # ⚠ Collected IN ORDER — a wrapped name's two halves are adjacent lines, so
    # order is the only thing that can reunite them.
    entries = []

    for raw_line in text.split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        if _SKIP_RE.match(line):
            continue
        # Skip section header lines themselves (both format variants)
        if _has_marker(line, _USES_MARKERS) or _has_marker(line, _SOURCES_MARKERS):
            continue

        # Skip FUND BALANCE sub-section items (carryover, encumbrance reserve)
        # These are balance sheet items, not revenue sources
        if re.match(r'^FUND BALANCE\b', line, re.IGNORECASE):
            skip_subsection = True
            continue
        if re.match(r'^(?:GENERAL REVENUE|SPECIAL REVENUE|TRANSFERS AND)\b', line, re.IGNORECASE):
            skip_subsection = False
            continue
        if skip_subsection:
            continue

        name, amount = extract_5th_amount(line)
        if name is None:
            # ⚠ KEPT, not dropped. Discarding a line with no amounts here is
            # precisely how half of a wrapped department name was lost.
            entries.append({'kind': 'text', 'text': line})
            continue
        entries.append({'kind': 'row', 'name': name, 'amount': amount})

    out = []
    for row in resolve_wrapped_names(entries):
        # Double-check: skip any Total/Subtotal rows that slipped through
        if re.match(r'^(?:Total|Subtotal|TOTAL)\b', row['name'], re.IGNORECASE):
            continue
        out.append({'name': row['name'], 'amounts': [row['amount']]})
    return out


def extract_budget(pdf_path):
    fiscal_year    = None
    first_page     = None
    revenue_items  = []
    expend_items   = []

    in_uses    = False
    in_sources = False
    done       = False

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            if done:
                break
            # Hard page cap: summary sections land between pages ~160-215 depending on year
            if page_num > 250:
                break

            text = page.extract_text() or ''
            if not text.strip():
                continue

            # Detect FY from any page header
            if fiscal_year is None:
                fy = parse_fy(text)
                if fy:
                    fiscal_year = fy
                    if first_page is None:
                        first_page = page_num

            # Exit: past both summary sections (use a title-level check — plain
            # "CAPITAL IMPROVEMENT PROGRAM" appears in narrative text on early pages)
            if 'SUMMARY OF CAPITAL IMPROVEMENT PROGRAM' in text.upper():
                done = True
                continue

            # Classify this page (require column-header confirmation to avoid pie-chart false positives)
            upper = text.upper()
            is_uses_cat = _has_marker(text, _USES_CAT_MARKERS)
            # Table pages carry "SOURCE OF FUNDS" / "USE OF FUNDS" as a column header;
            # pie-chart pages with the same title do not.
            is_sources  = _has_marker(text, _SOURCES_MARKERS) and 'SOURCE OF FUNDS' in upper and not is_uses_cat
            is_uses     = _has_marker(text, _USES_MARKERS)    and 'USE OF FUNDS'    in upper and not is_uses_cat

            if is_uses_cat:
                # BY CATEGORY signals we have all the source/use data we need.
                # Stop entirely — don't continue into FIVE-YEAR COMPARISON pages
                # which duplicate the same values and would double-count.
                done = True
                continue
            if is_sources:
                in_sources = True
                in_uses = False
            if is_uses:
                in_uses = True
                in_sources = False

            if not in_uses and not in_sources:
                continue

            target = expend_items if in_uses else revenue_items
            target.extend(rows_from_page_text(text))

    if not fiscal_year:
        print(f'WARNING: could not detect fiscal year from {pdf_path}', file=sys.stderr)
        return []

    if not revenue_items and not expend_items:
        print(f'WARNING: no items extracted from {pdf_path}', file=sys.stderr)
        return []

    return [{
        'page_num':           first_page or 1,
        'fund':               'General Fund',
        'col_types':          ['adopted'],
        'fiscal_years':       [fiscal_year],
        'revenue_items':      revenue_items,
        'expenditure_items':  expend_items,
    }]


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python scripts/extractSanJose.py <pdf_path>', file=sys.stderr)
        sys.exit(1)

    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
