#!/usr/bin/env python3
"""
Portland Budget PDF Extractor

Extracts bureau-level appropriation data from Portland Adopted Budget Volume 1
PDFs using pdfplumber (no AI). Outputs JSON to stdout.

The Appropriation Schedule (Table 2) spans multiple pages and has this structure:
  Bureau of Emergency Communications          [header row — all None except col 0]
  Emergency Communication Fund  37,208,701  0  1,821,650  363,873  39,394,224
  Bureau of Emergency Communications Subtotal  37,208,701  ...  39,394,224

Columns (0-indexed):
  0: Bureau/Fund name
  1: Program Expenses
  2: Interfund Contingency
  3: Interfund Transfers
  4: Cash Debt Service
  5: Total Appropriation  <-- this is the adopted total we capture

Subtotal rows contain the bureau-level total. Fund sub-rows show fund breakdown.
Amounts are in full dollars — do NOT multiply by 1000.

Usage:
  python scripts/extractPortland.py "docs/Portland/fy2025-26-vol1.pdf"
"""

import sys
import json
import re
import pdfplumber

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Parse dollar string like '39,394,224' or '(1,234)' → integer."""
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

# ── Check if a row is a valid fund-level line (not header, not subtotal) ──────
def is_fund_row(row):
    """Fund rows have a non-empty name and a numeric amount in col[5] (Total Appropriation)."""
    if not row or not row[0]:
        return False
    if is_bureau_header(row):
        return False
    if is_subtotal_row(row):
        return False
    # Must have at least 6 columns with a parseable total
    if len(row) < 6:
        return False
    total = parse_money(row[5]) if row[5] else 0
    return total != 0

# ── Extract all bureau-level budget rows from one PDF ─────────────────────────
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


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python scripts/extractPortland.py <pdf_path>', file=sys.stderr)
        sys.exit(1)

    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
