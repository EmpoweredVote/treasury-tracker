#!/usr/bin/env python3
"""
Fremont Budget PDF Extractor

Extracts General Fund summary data from Fremont Proposed/Adopted Operating
Budget PDFs using pdfplumber (no AI). Outputs JSON to stdout.

The General Fund Summary page has this structure (in thousands of dollars):
    Adopted  Est Actual  Proposed
    FY 23/24  FY 23/24  FY 24/25
  Revenues
    Property Tax        135,743  141,012  147,306
    ...
  Expenditures
    Police              117,653  108,889  122,981
    ...

Usage:
  python scripts/extractFremont.py "docs/Fremont/FY 202425 Proposed Operating Budget.pdf"
"""

import sys
import json
import re
import pdfplumber

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    s = s.strip()
    if not s or s == '-':
        return 0
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0

# ── Regex: line label + 3 or 4 money columns ─────────────────────────────────
_NUM = r'(?:\(\d{1,3}(?:,\d{3})*\)|\d{1,3}(?:,\d{3})*|-)'
_LINE_RE3 = re.compile(rf'^(.+?)\s+({_NUM})\s+({_NUM})\s+({_NUM})\s*$')
_LINE_RE4 = re.compile(rf'^(.+?)\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s*$')

# ── Parse fiscal year from "FY 23/24" → 2024 ─────────────────────────────────
def parse_fy(token):
    # Handle both "FY 24/25" (2-digit) and "FY 2024/25" (4-digit) year formats
    m = re.search(r'FY\s+\d{2,4}/(\d{2})', token)
    return 2000 + int(m.group(1)) if m else None

# ── Map a column header word to a column type ─────────────────────────────────
def col_type(s):
    s = s.lower()
    if 'actual' in s:
        return 'actual'
    if 'adopted' in s:
        return 'adopted'
    if 'proposed' in s:
        return 'proposed'
    if 'projected' in s:
        return 'projected'
    return 'unknown'

# ── Extract all budget summary pages from one PDF ────────────────────────────
def extract_budget(pdf_path):
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue

            # Must contain the main budget summary markers
            if 'General Fund Proposed Budget' not in text and 'General Fund Adopted Budget' not in text:
                continue
            if 'Total Revenues' not in text or 'Total Expenditures' not in text:
                continue

            # Skip the multi-year forecast table — it has 4 columns and different semantics
            if 'General Fund Proposed Budget and Forecast' in text:
                continue

            lines = [l.strip() for l in text.split('\n')]

            # ── Find column header (two consecutive lines) ────────────────────
            # Line 1 example: "Adopted Est Actual Proposed"
            # Line 2 example: "FY 23/24 FY 23/24 FY 24/25"
            col_types = None
            fiscal_years = None
            header_end = None

            KW_PATTERNS = [
                ('adopted',   r'\bAdopted\b'),
                ('revised',   r'\bRevised\b'),
                ('actual',    r'\bActual\b'),
                ('proposed',  r'\bProposed\b'),
                ('projected', r'\bProjected\b'),
            ]

            for i, line in enumerate(lines):
                if i + 1 >= len(lines):
                    continue
                next_line = lines[i + 1]

                # Try both orderings: (col-types line, fy-tokens line)
                # Older PDFs: col-types on line i, FY tokens on line i+1
                # FY2025/26+: FY tokens on line i, col-types on line i+1
                candidates = []
                if re.search(r'\b(?:Adopted|Proposed|Projected|Revised)\b', line, re.I):
                    candidates.append((line, next_line))
                if re.search(r'\b(?:Adopted|Proposed|Projected|Revised)\b', next_line, re.I):
                    candidates.append((next_line, line))

                matched = False
                for col_line, fy_line in candidates:
                    fy_tokens = re.findall(r'FY\s+\d{2,4}/\d{2}', fy_line)
                    if len(fy_tokens) not in (3, 4):
                        continue
                    type_matches = []
                    for kw, pattern in KW_PATTERNS:
                        for m in re.finditer(pattern, col_line, re.I):
                            type_matches.append((m.start(), kw))
                    type_matches.sort()
                    col_types = [kw for _, kw in type_matches]
                    fiscal_years = [parse_fy(t) for t in fy_tokens]
                    if len(col_types) == len(fy_tokens) and all(fiscal_years):
                        header_end = i + 2
                        matched = True
                        break

                if matched:
                    break

            if not col_types or not fiscal_years or len(col_types) not in (3, 4):
                continue

            def fix_spaced_numbers(line):
                # Some Fremont PDFs insert a space after the first digit of each number.
                # e.g. "1 06,016" → "106,016", "8 ,888" → "8,888", "2 34" → "234"
                # (?<!\d) lookbehind ensures we only fix digits at the START of a token,
                # never mid-number (so cross-column spaces are untouched).
                line = re.sub(r'(?<!\d)(\d) (\d{0,2},\d{3})', r'\1\2', line)
                line = re.sub(r'(?<!\d)(\d) (\d{1,2})(?!\d)', r'\1\2', line)
                return line

            body = [fix_spaced_numbers(l) for l in lines[header_end:]]

            ncols = len(col_types)
            line_re = _LINE_RE4 if ncols == 4 else _LINE_RE3
            grp_end = ncols + 2  # last capture group index + 1

            def parse_line(line):
                m = line_re.match(line)
                if not m:
                    return None
                return {
                    'name': m.group(1).strip(),
                    'amounts': [parse_money(m.group(j)) for j in range(2, grp_end)],
                }

            # ── Parse revenue items ────────────────────────────────────────
            revenue_items = []
            in_rev = False
            for line in body:
                if re.match(r'^Revenues$', line, re.I):
                    in_rev = True
                    continue
                if re.match(r'^Total Revenues', line, re.I):
                    break
                if not in_rev or not line:
                    continue
                if line.endswith(':'):       # skip "Taxes:" sub-header
                    continue
                row = parse_line(line)
                if row:
                    revenue_items.append(row)

            # ── Parse expenditure items ────────────────────────────────────
            expenditure_items = []
            in_exp = False
            for line in body:
                # Handle both "Expenditures" (older) and "Departmental Expenditures" (FY25/26+)
                if re.match(r'^(?:Departmental )?Expenditures$', line, re.I):
                    in_exp = True
                    continue
                if re.match(r'^Total Expenditures', line, re.I):
                    break
                if not in_exp or not line:
                    continue
                # Skip sub-headers like "Non-departmental Expenditures"
                if re.match(r'^Non-departmental Expenditures$', line, re.I):
                    continue
                row = parse_line(line)
                if row:
                    expenditure_items.append(row)

            if revenue_items or expenditure_items:
                results.append({
                    'page_num': page_num,
                    'col_types': col_types,
                    'fiscal_years': fiscal_years,
                    'revenue_items': revenue_items,
                    'expenditure_items': expenditure_items,
                })

    return results


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extractFremont.py <pdf_path>', file=sys.stderr)
        sys.exit(1)

    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
