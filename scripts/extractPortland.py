#!/usr/bin/env python3
"""
Portland Budget PDF Extractor

Supports two modes:
  operating (default) — extracts bureau-level appropriation data from Vol 1 PDFs
  revenue             — extracts fund-level Resources Total from Vol 2 PDFs

Usage:
  python scripts/extractPortland.py "docs/Portland/fy2025-26-vol1.pdf"
  python scripts/extractPortland.py "docs/Portland/fy2025-26-vol2.pdf" --mode revenue
"""

import sys
import json
import re
import pdfplumber

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Parse dollar string like '39,394,224' or '(1,234)' → integer.
    Also handles Vol 2 garbled double-rendered artifact (e.g. '778899,,116666,,330066').
    """
    if s is None:
        return 0
    s = s.strip()
    if not s or s == '-':
        return 0
    if ',,' in s:
        # PDF rendering artifact: every digit doubled, commas doubled.
        # '778899,,116666,,330066' → '789,166,306'
        cleaned = s.replace(',,', ',')
        result = ''
        i = 0
        while i < len(cleaned):
            c = cleaned[i]
            if c.isdigit() and i + 1 < len(cleaned) and cleaned[i + 1] == c:
                result += c
                i += 2
            else:
                result += c
                i += 1
        s = result
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0

# ── Parse fiscal year from "FY 2025-26" → 2026 ───────────────────────────────
def parse_fy(token):
    """
    Portland uses "FY YYYY-YY" format (e.g. "FY 2025-26").
    Returns the ENDING year as an integer: "FY 2025-26" → 2026, "FY 2024-25" → 2025.
    Never returns a concatenated year like 202526.
    """
    # Match "FY 2025-26" or "FY 2024-25"
    m = re.search(r'FY\s+(\d{4})-(\d{2})', token)
    if m:
        century = int(m.group(1)) // 100 * 100  # e.g. 2000
        end_yy = int(m.group(2))                 # e.g. 26
        return century + end_yy                   # e.g. 2026
    return None

# ── Detect fiscal year from page text ─────────────────────────────────────────
def detect_fiscal_year(text):
    """Extract fiscal year from Appropriation Schedule page text."""
    m = re.search(r'Appropriation Schedule\s*-\s*(FY\s+\d{4}-\d{2})', text)
    if m:
        return parse_fy(m.group(1))
    # Fallback: search for any "FY YYYY-YY" pattern on the page
    m = re.search(r'FY\s+(\d{4})-(\d{2})', text)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None

# ── Check if a row is a bureau header (all numeric cols are None) ─────────────
def is_bureau_header(row):
    """Bureau header rows: col[0] is bureau name, all other cols are None/empty."""
    if not row or not row[0]:
        return False
    # Must have at least 5 columns
    if len(row) < 5:
        return False
    # All numeric columns (1 onwards) should be None or empty
    numeric_cols = [row[i] for i in range(1, len(row)) if i < len(row)]
    return all(c is None or (isinstance(c, str) and c.strip() == '') for c in numeric_cols)

# ── Check if a row is a bureau subtotal ──────────────────────────────────────
def is_subtotal_row(row):
    """Subtotal rows end with 'Subtotal' and have numeric data in col[5]."""
    if not row or not row[0]:
        return False
    name = row[0].replace('\n', ' ').strip()
    return name.endswith('Subtotal') or name.endswith('Total')

# ── Extract all bureau-level budget rows from one PDF ─────────────────────────
# Design: bureau subtotals only — fund-level rows are excluded.
# To add fund breakdown, see the fund detection logic in _inspect-portland-temp.py.
def extract_budget(pdf_path):
    """
    Walk the PDF pages looking for Appropriation Schedule pages.
    Extract bureau subtotal rows with: bureau name, service_area (empty for now),
    adopted_amount (Total Appropriation column), fiscal_year, page_num.

    Returns list of dicts: { bureau, service_area, adopted_amount, fiscal_year, page_num }
    """
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        current_bureau = None
        in_appropriation_schedule = False

        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue

            # Detect Appropriation Schedule pages
            if 'Appropriation Schedule' in text:
                in_appropriation_schedule = True
                # Try to detect fiscal year from this page
                fy = detect_fiscal_year(text)
                if fy:
                    fiscal_year = fy
            elif in_appropriation_schedule:
                # Check if we've moved past the Appropriation Schedule section
                # Pages after the schedule have different headers
                if any(kw in text for kw in [
                    'Summary of Bureau Expenses by Fund',
                    'Total Resources and Requirements',
                    'Operating and Capital Budget',
                    'Summary of Requirements by Service Area',
                ]):
                    in_appropriation_schedule = False
                    continue

            if not in_appropriation_schedule:
                continue

            tables = page.extract_tables()
            if not tables:
                continue

            # Each Appropriation Schedule page has exactly one table
            table = tables[0]
            if not table:
                continue

            for row in table:
                if not row or not row[0]:
                    continue

                # Normalize the name (remove embedded newlines from cell wrapping)
                name = row[0].replace('\n', ' ').strip()
                if not name:
                    continue

                # Skip the grand Total row at the bottom of the last page
                if name == 'Total':
                    print(f'  [skipped] Grand total row on page {page_num}', file=sys.stderr)
                    continue

                # Track current bureau from header rows
                if is_bureau_header(row):
                    current_bureau = name
                    continue

                # Capture bureau subtotal rows
                if is_subtotal_row(row):
                    if len(row) < 6:
                        print(f'  [skipped] Subtotal row too short ({len(row)} cols) on page {page_num}: {name}',
                              file=sys.stderr)
                        continue

                    adopted_amount = parse_money(row[5]) if row[5] else 0

                    # Skip zero-amount subtotals (e.g. Office of Vibrant Communities with $0 budget)
                    if adopted_amount == 0:
                        print(f'  [skipped] Zero-amount subtotal on page {page_num}: {name}',
                              file=sys.stderr)
                        continue

                    # Derive bureau name: strip " Subtotal" suffix
                    bureau_name = re.sub(r'\s*Subtotal\s*$', '', name).strip()
                    if not bureau_name:
                        print(f'  [skipped] Empty bureau name after strip on page {page_num}: {name}',
                              file=sys.stderr)
                        continue

                    # Validate: bureau name should not be purely numeric
                    if re.match(r'^\d[\d,.\s]*$', bureau_name):
                        print(f'  [skipped] Numeric bureau name on page {page_num}: {bureau_name}',
                              file=sys.stderr)
                        continue

                    results.append({
                        'bureau': bureau_name,
                        'service_area': '',   # service area grouping not in this table
                        'adopted_amount': adopted_amount,
                        'fiscal_year': fiscal_year,
                        'page_num': page_num,
                    })

    # Post-validation: warn about any rows with None fiscal_year
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year — check PDF text for FY marker',
              file=sys.stderr)

    return results


# ── Strip doubled fund name artifact in older Vol 2 PDFs ─────────────────────
def _dedup_name(name):
    """Remove doubled fund name from older Portland Vol 2 PDFs.

    Older PDFs repeat the fund name in the header cell:
      'Water Fund Water Fund' → 'Water Fund'
      'Portland Clean Energy...FundPortland...' → 'Portland Clean Energy...Fund'
    Safe on normal names: only triggers on exact self-repetition.
    """
    n = len(name)
    # 'XX' pattern (no separator)
    if n % 2 == 0:
        half = n // 2
        if name[:half] == name[half:]:
            return name[:half]
    # 'X X' pattern (space separator at midpoint)
    mid = (n - 1) // 2
    space_idx = name.find(' ', mid)
    if space_idx > 0:
        first, rest = name[:space_idx], name[space_idx + 1:]
        if first == rest:
            return first
    return name

# ── Extract fund-level Resources Total from Vol 2 PDFs ───────────────────────
def extract_revenue(pdf_path):
    """
    Walk Vol 2 PDF pages looking for Fund Summary pages.
    Extract fund name + Resources Total (Adopted, col 6) from each fund.

    Returns list of dicts: { fund, resources_total, fiscal_year, page_num }
    """
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        # Fiscal year from cover page: "Fiscal Year 2025-26" → 2026
        cover_text = pdf.pages[0].extract_text() or ''
        m = re.search(r'Fiscal Year\s+(\d{4})-(\d{2})', cover_text, re.I)
        if m:
            century = int(m.group(1)) // 100 * 100
            fiscal_year = century + int(m.group(2))

        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Fund Summary' not in text or 'Resources Total' not in text:
                continue

            lines = [l.strip() for l in text.split('\n') if l.strip()]

            # Fund name: first line that is not a section header or cover label
            fund_name = None
            skip_patterns = re.compile(
                r'(Service Area Funds|City Funds|City of Portland|Table of Contents'
                r'|Fund Summary|^Resources$|FY \d{4})',
                re.I
            )
            for line in lines[:4]:
                if line and len(line) > 5 and not skip_patterns.search(line):
                    fund_name = _dedup_name(line)
                    break

            if not fund_name:
                print(f'  [skipped] No fund name found on page {page_num}', file=sys.stderr)
                continue

            # Find Resources Total row; Adopted is col 6
            res_total = None
            for table in page.extract_tables():
                if not table:
                    continue
                for row in table:
                    if not row or not row[0]:
                        continue
                    if row[0].strip() == 'Resources Total':
                        val = row[6] if len(row) > 6 else None
                        res_total = parse_money(val)
                        break
                if res_total is not None:
                    break

            if res_total is None:
                print(f'  [skipped] No Resources Total on page {page_num}: {fund_name}',
                      file=sys.stderr)
                continue

            results.append({
                'fund':            fund_name,
                'resources_total': res_total,
                'fiscal_year':     fiscal_year,
                'page_num':        page_num,
            })

    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Portland budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                        help='operating=Vol 1 bureau data, revenue=Vol 2 fund data')
    args = parser.parse_args()

    data = extract_revenue(args.pdf_path) if args.mode == 'revenue' else extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
