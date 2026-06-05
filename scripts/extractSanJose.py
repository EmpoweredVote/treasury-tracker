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
            skip_subsection = False  # True while inside FUND BALANCE sub-section

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
                    continue
                # Double-check: skip any Total/Subtotal rows that slipped through
                if re.match(r'^(?:Total|Subtotal|TOTAL)\b', name, re.IGNORECASE):
                    continue

                target.append({'name': name, 'amounts': [amount]})

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
