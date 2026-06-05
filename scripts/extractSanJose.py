#!/usr/bin/env python3
"""
San Jose Budget PDF Extractor

Extracts General Fund summary data from San Jose Adopted Operating Budget PDFs
using pdfplumber (no AI). Outputs JSON to stdout.

Enterprise funds (Airport, Wastewater, Water, Environmental Services, etc.) are
filtered at extraction time — D-03 requirement.

Performance: early-exit page skip (`if 'General Fund' not in text[:200]: continue`)
ensures 400+ page PDFs extract in under 30 seconds — Pitfall 3 mitigation.

The General Fund Summary page structure (amounts in thousands of dollars):
    Adopted       Est Actual    Proposed
    FY 2024-25    FY 2024-25    FY 2025-26
  Revenues
    Taxes                        712,345   723,456   745,678
    ...
  Total Revenues               1,234,567 1,245,678 1,267,890
  Expenditures
    Police                       400,000   410,000   425,000
    ...
  Total Expenditures           1,234,567 1,245,678 1,267,890

Usage:
  python scripts/extractSanJose.py "docs/SanJose/fy2024-25-adopted-operating-budget.pdf"
"""

import sys
import json
import re
import pdfplumber

# ── Enterprise funds excluded at extraction time (D-03) ───────────────────────
# These fund names (or partial matches) trigger page-level skip.
# Exact strings determined from FY2024-25 PDF inspection — update if newer years differ.
EXCLUDED_FUNDS = {
    'Airport Fund',
    'Airport',
    'San José-Santa Clara Regional Wastewater Facility Fund',
    'Wastewater',
    'Water Fund',
    'Water',
    'Environmental Services Fund',
    'Environmental Services',
    'Convention Center Fund',
    'Golf and Tennis Fund',
    'Parking Fund',
    'Retirement Fund',
    'Workers Compensation',
    'Liability Fund',
    'Fleet Management Fund',
    'Information Technology Fund',
    'Municipal Water Fund',
}

# The accepted fund — must appear in page text as a fund label
GENERAL_FUND_MARKERS = {'General Fund'}

# ── Money parsing (from extractFremont.py lines 28-37) ───────────────────────
def parse_money(s):
    if s is None:
        return 0
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

# ── Parse fiscal year from "FY 2024-25" → 2025 ───────────────────────────────
# (from extractPortland.py lines 54-66 — same "FY YYYY-YY" format)
def parse_fy(token):
    """
    San Jose uses "FY 2024-25" format (same as Portland "FY YYYY-YY").
    Returns the ENDING year as an integer: "FY 2024-25" → 2025, "FY 2023-24" → 2024.
    """
    m = re.search(r'FY\s+(\d{4})-(\d{2})', token)
    if m:
        century = int(m.group(1)) // 100 * 100  # e.g. 2000
        end_yy = int(m.group(2))                 # e.g. 25
        return century + end_yy                   # e.g. 2025
    return None

# ── Map column header word to type ───────────────────────────────────────────
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
    if 'revised' in s:
        return 'revised'
    return 'unknown'

# ── Detect fund from page text ────────────────────────────────────────────────
def _detect_fund(text):
    """
    Detect the fund name from the first 400 characters of page text.
    Returns the fund name string or None.
    San Jose pages often start with the fund name as a header.
    """
    # Look for "General Fund" as a fund label near page top
    # Also look for enterprise fund names to identify exclusions
    for fund in ['General Fund'] + list(EXCLUDED_FUNDS):
        # Check first 400 chars where the fund label typically appears
        if fund in text[:400]:
            # Make sure it's a fund heading (not just mentioned in description)
            # General Fund pages have "General Fund" prominent at top
            return fund
    return None

# ── Extract all General Fund summary pages from one PDF ─────────────────────
def extract_budget(pdf_path):
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue

            # ── PERFORMANCE: early-exit for non-General-Fund pages ────────────
            # Pitfall 3 mitigation: San Jose PDFs are 400+ pages covering 100+ funds.
            # Skip pages that don't have "General Fund" near the top.
            # This keeps extraction time under 30 seconds.
            if 'General Fund' not in text[:200]:
                continue

            # Must have both revenue and expenditure markers to be a summary page
            has_revenues = 'Total Revenues' in text or 'Total Revenue' in text
            has_expenditures = 'Total Expenditures' in text or 'Total Expenditure' in text
            if not has_revenues or not has_expenditures:
                continue

            # ── Enterprise fund filter (D-03) ─────────────────────────────────
            # Detect which fund this page belongs to.
            # Pages for excluded enterprise funds are skipped entirely.
            detected_fund = _detect_fund(text)
            if detected_fund is None:
                # Can't determine fund — skip to be safe
                continue
            if detected_fund in EXCLUDED_FUNDS:
                # Enterprise fund page — skip (D-03: filter at extraction time)
                continue
            if detected_fund not in GENERAL_FUND_MARKERS:
                # Unknown fund that isn't explicitly in our accepted set — skip
                continue

            # ── Parse this page as a General Fund summary ─────────────────────
            lines = [l.strip() for l in text.split('\n')]

            # ── Find column headers (adapted from extractFremont.py lines 86-132) ──
            # Line 1 example: "Adopted  Est Actual  Proposed"
            # Line 2 example: "FY 2023-24  FY 2023-24  FY 2024-25"
            col_types = None
            fiscal_years = None
            header_end = None

            KW_PATTERNS = [
                ('adopted',   r'\bAdopted\b'),
                ('revised',   r'\bRevised\b'),
                ('actual',    r'\b(?:Est\.?\s*)?Actual\b'),
                ('proposed',  r'\bProposed\b'),
                ('projected', r'\bProjected\b'),
            ]

            for i, line in enumerate(lines):
                if i + 1 >= len(lines):
                    continue
                next_line = lines[i + 1]

                # Try both orderings: col-types line then fy-tokens, or reverse
                candidates = []
                if re.search(r'\b(?:Adopted|Proposed|Projected|Revised)\b', line, re.I):
                    candidates.append((line, next_line))
                if re.search(r'\b(?:Adopted|Proposed|Projected|Revised)\b', next_line, re.I):
                    candidates.append((next_line, line))

                matched = False
                for col_line, fy_line in candidates:
                    # San Jose uses "FY YYYY-YY" format
                    fy_tokens = re.findall(r'FY\s+\d{4}-\d{2}', fy_line)
                    if len(fy_tokens) not in (2, 3, 4):
                        continue
                    type_matches = []
                    for kw, pattern in KW_PATTERNS:
                        for m in re.finditer(pattern, col_line, re.I):
                            type_matches.append((m.start(), kw))
                    type_matches.sort()
                    col_types_candidate = [kw for _, kw in type_matches]
                    fiscal_years_candidate = [parse_fy(t) for t in fy_tokens]
                    if (len(col_types_candidate) == len(fy_tokens)
                            and all(fiscal_years_candidate)):
                        col_types = col_types_candidate
                        fiscal_years = fiscal_years_candidate
                        header_end = i + 2
                        matched = True
                        break

                if matched:
                    break

            if not col_types or not fiscal_years or len(col_types) not in (2, 3, 4):
                # Could be a single-column or differently structured page — skip
                print(f'  WARNING: page {page_num} matched General Fund markers but header parse failed',
                      file=sys.stderr)
                continue

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

            body = lines[header_end:]

            # ── Parse revenue items (from extractFremont.py lines 161-176) ────
            revenue_items = []
            in_rev = False
            for line in body:
                if re.match(r'^Revenues$', line, re.I):
                    in_rev = True
                    continue
                if re.match(r'^Total Revenues?', line, re.I):
                    break
                if not in_rev or not line:
                    continue
                if line.endswith(':'):       # skip "Taxes:" sub-header
                    continue
                row = parse_line(line)
                if row:
                    revenue_items.append(row)

            # ── Parse expenditure items (from extractFremont.py lines 178-195) ─
            expenditure_items = []
            in_exp = False
            for line in body:
                if re.match(r'^(?:Departmental )?Expenditures$', line, re.I):
                    in_exp = True
                    continue
                if re.match(r'^Total Expenditures?', line, re.I):
                    break
                if not in_exp or not line:
                    continue
                if re.match(r'^Non-departmental Expenditures$', line, re.I):
                    continue
                row = parse_line(line)
                if row:
                    expenditure_items.append(row)

            if revenue_items or expenditure_items:
                results.append({
                    'page_num': page_num,
                    'fund': 'General Fund',
                    'col_types': col_types,
                    'fiscal_years': fiscal_years,
                    'revenue_items': revenue_items,
                    'expenditure_items': expenditure_items,
                })

    # Warn on any None fiscal_year rows (from PATTERNS.md shared pattern)
    for r in results:
        none_fy = [fy for fy in r.get('fiscal_years', []) if fy is None]
        if none_fy:
            print(f'  WARNING: page {r["page_num"]} has None fiscal_year — check PDF text for FY marker',
                  file=sys.stderr)

    return results


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extractSanJose.py <pdf_path>', file=sys.stderr)
        sys.exit(1)

    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
