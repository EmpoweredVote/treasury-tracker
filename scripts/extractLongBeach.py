#!/usr/bin/env python3
"""
Long Beach Budget PDF Extractor

Extracts General Fund expenditure and revenue category data from Long Beach
General Fund Summary PDFs (fund-summary-gp section) using pdfplumber.

The fund-summary-gp PDFs contain the "General Fund Group Summary" page with:
  - Revenue categories (Property Taxes, Sales Tax, etc.) for 4 columns:
      Actual FY N-2, Adopted FY N-1, Estimated FY N-1, Adopted FY N
  - Expenditure categories (Salaries, Materials, etc.) for the same 4 columns

This extractor targets the "Adopted FY N" column (last column = current fiscal year).

Long Beach FY runs Oct 1 - Sep 30. FY is derived from PDF filename:
  fy25-fund-summary-gp.pdf -> FY 2025 (stored as integer 2025, ending-year convention D-01)
  fy22-fund-summary-gp.pdf -> FY 2022

Note: The PDF text renderer introduces spaces within numbers, e.g. "4 2,374,186"
for 42,374,186. The parse_money function handles this by stripping spaces from
numeric tokens before parsing.

Port of Long Beach (~$760M) is in Enterprise/Tidelands funds — NOT in General Fund
summary PDFs (fund-summary-gp). Enterprise fund exclusion is automatic by targeting
the correct PDF section. Port departments must never appear in output.

Amount scale: FULL DOLLARS (verified against FY25 total ~$755M).

Usage:
  python scripts/extractLongBeach.py "docs/Long Beach/fy25-fund-summary-gp.pdf"
  python scripts/extractLongBeach.py "docs/Long Beach/fy25-fund-summary-gp.pdf" --mode revenue
"""

import sys
import json
import re
import pdfplumber

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Parse dollar string like '$3,418,795' or '(1,234)' or '4 2,374,186' -> integer.
    Handles PDF rendering artifact where leading digit is separated by a space,
    e.g. '4 2,374,186' -> 42374186 (strip all spaces before parsing).
    """
    if s is None:
        return 0
    s = str(s).strip()
    if not s or s == '-' or s == '$0':
        return 0
    neg = s.startswith('(') or s.startswith('-$') or (
        s.startswith('-') and not s[1:2].startswith('$')
    )
    # Strip ALL whitespace from numeric portion (handles PDF space-in-number artifact)
    val = re.sub(r'[$()\s,]', '', s).lstrip('-')
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0


# ── Detect FY from filename ───────────────────────────────────────────────────
def detect_fy_from_filename(pdf_path):
    """
    Extract fiscal year (ending-year convention, D-01) from Long Beach fund summary filename.
    fy25-fund-summary-gp.pdf -> 2025
    fy22-fund-summary-gp.pdf -> 2022
    fy2025-fund-summary-gp.pdf -> 2025 (if 4-digit form used)
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    # Four-digit year must be checked first: fy2025 -> 2025
    # (two-digit pattern r'fy(\d{2})-' would match 'fy20' inside 'fy2025' and return 2020)
    m4 = re.search(r'fy(\d{4})-', fname)
    if m4:
        return int(m4.group(1))
    # Two-digit year: fy25 -> 2025, fy22 -> 2022
    m = re.search(r'fy(\d{2})-', fname)
    if m:
        return 2000 + int(m.group(1))
    return None


# ── Parse a 4-column table row, return the last column value ─────────────────
def parse_last_column(line):
    """
    Parse a line with 1 text label + 4 numeric columns.
    Returns (label, last_column_value) or None.
    The last column = current fiscal year Adopted amount.

    PDF text has space-separated columns. Numbers may contain spaces
    (artifact: '4 2,374,186' = 42,374,186).

    Strategy: split the line by runs of digits/commas/spaces, take the
    rightmost clean numeric token as the last column.
    """
    line = line.strip()
    if not line or line.startswith('-') or line.startswith('='):
        return None

    # Split into tokens by whitespace
    tokens = line.split()
    if len(tokens) < 2:
        return None

    # Find numeric tokens (digits/commas/parens/dashes only)
    # Numbers can be: "219,726,168" or parts of split numbers like "4" "2,374,186"
    numeric_pattern = re.compile(r'^[\d,\(\)\-]+$')

    # Collect all tokens
    # Strategy: work right-to-left, collecting the last complete numeric value.
    # A "complete" numeric value is one that parses to a non-zero integer.
    # Split numbers appear as "X Y,YYY,YYY" pairs in the token list.

    # First, reconstruct the line removing the label
    # Find the last 4 numeric groups (each may be 1 or 2 tokens)
    # Better approach: find all dollar amounts in the line using regex
    # Numbers in these PDFs: either plain "219,726,168" or split "4 2,374,186"
    # The split pattern: single digit token immediately followed by NNN,NNN token

    # Re-tokenize the line more carefully
    # Find all consecutive "digit-only" or "comma+digit" sequences
    raw = line

    # Replace split-number patterns: single digit followed by space + N,NNN... -> join them
    # Pattern: \b(\d)\s+(\d{1,3}(?:,\d{3})+)\b -> \1\2
    normalized = re.sub(r'\b(\d)\s+(\d{1,3}(?:,\d{3})+)', r'\1\2', raw)

    # Now extract all numeric values (including negative/zero)
    # Numbers: optional minus/paren, digits with commas
    num_pattern = re.compile(r'\([\d,]+\)|[\d,]+')
    # Extract all numbers and their positions
    numbers = num_pattern.findall(normalized)

    if not numbers:
        return None

    # The label is everything before the first number
    first_num_match = num_pattern.search(normalized)
    if not first_num_match:
        return None

    label = normalized[:first_num_match.start()].strip()
    if len(label) < 2:
        return None

    # The last number in the line is the "Adopted current FY" column
    last_num = numbers[-1]
    value = parse_money(last_num)

    return (label, value)


def _extract_label_and_last_value(line):
    """
    Improved label/value extraction that handles commas in label names.
    A number token must start with a digit (not just a comma).
    """
    # Normalize split numbers first: "4 2,374,186" -> "42,374,186"
    normalized = re.sub(r'\b(\d)\s+(\d{1,3}(?:,\d{3})+)', r'\1\2', line.strip())

    # Find numbers: must start with digit (not comma), may be wrapped in parens
    # Pattern: \( digits/commas \) or plain digits/commas starting with digit
    num_pattern = re.compile(r'\(\d[\d,]*\)|\d[\d,]*')
    matches = list(num_pattern.finditer(normalized))

    if not matches:
        return None

    # Label is everything before the first number match
    label = normalized[:matches[0].start()].strip().rstrip(',').strip()
    if len(label) < 2:
        return None

    # Last value = last match
    last_num = matches[-1].group()
    value = parse_money(last_num)

    return (label, value)


# ── Extract expenditure rows from a General Fund Summary page ─────────────────
def extract_from_page(page, fiscal_year, mode='operating'):
    """
    Extract either expenditure (mode='operating') or revenue (mode='revenue') rows
    from a General Fund Group Summary page.

    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    text = page.extract_text() or ''
    if 'General Fund Group Summary' not in text:
        return []

    # Skip Uplands Oil Fund Group pages
    if 'Uplands Oil Fund Group Summary' in text:
        return []

    # Also skip if Port or Harbor appears as the primary fund
    if 'Port' in text[:200] or 'Harbor' in text[:200]:
        return []

    lines = text.split('\n')
    page_num = page.page_number

    results = []

    # Determine which section to extract from
    if mode == 'revenue':
        section_start_marker = 'Revenues:'
        # Stop at expenditure section headers OR total lines
        section_stop_markers = ['Expenditures:', 'Uses:', 'Total Revenues', 'Total Resources']
    else:
        section_start_marker = 'Expenditures:'
        # Stop at summary/balance lines
        section_stop_markers = ['Net Increase', 'Total Expenditures', 'Beginning Funds',
                                 'Total Uses', 'Ending Funds']

    # Also look for "Uses:" as the expenditure section header (FY22 format)
    if mode == 'operating':
        uses_markers = ['Uses:', 'Expenditures:']
    else:
        uses_markers = ['Resources:', 'Revenues:']

    in_section = False
    skip_lines = {'Total Revenues', 'Total Expenditures', 'Total Resources', 'Total Uses',
                  'Net Increase', 'Beginning Funds', 'Ending Funds', 'Addition to',
                  'Additions to', 'Adjustments', 'Carryover', 'Intrafund Transfers Out',
                  'Depreciation and Non Cash', 'Purchase of Gas', 'Other Financing',
                  '-' * 10, '=' * 10}

    skip_prefixes = ('*', 'Note:', 'City of', 'Purpose:', 'The ', 'These ', 'Assumptions',
                     'General Fund Group', 'Uplands', 'FY ', 'Actual', 'Revenues:',
                     'Expenditures:', 'Uses:', 'Resources:', 'Revenue:')

    for line in lines:
        stripped = line.strip()

        # Detect section entry
        if any(stripped.startswith(m) for m in uses_markers):
            in_section = True
            continue

        if not in_section:
            continue

        # Stop at section boundary
        if any(stripped.startswith(m) for m in section_stop_markers):
            break

        # Skip header and separator lines
        if not stripped or stripped.startswith('-') or stripped.startswith('='):
            continue
        if any(stripped.startswith(p) for p in skip_prefixes):
            continue
        if any(stripped.startswith(s) for s in skip_lines):
            continue

        # Skip lines that are obviously headers or notes
        if re.match(r'^(Actual|Adopted|Estimated|FY\s)', stripped):
            continue

        parsed = _extract_label_and_last_value(stripped)
        if parsed is None:
            continue

        label, amount = parsed

        # Filter zero and negative amounts (skip transfers-out, depreciation, etc.)
        if amount <= 0:
            continue

        # Skip if label is too short or looks like a total/section header
        if len(label) <= 2:
            continue
        if label.lower().startswith('total'):
            continue

        # Port/Harbor exclusion (safety net)
        # Use word boundary to avoid matching "support", "report", "transport"
        if re.search(r'\b(port of|harbor department|port authority)\b', label, re.IGNORECASE):
            print(f'  [skip] Port/Harbor row excluded: {label}', file=sys.stderr)
            continue

        results.append({
            'department':     label,
            'fund':           'General Fund',
            'adopted_amount': amount,
            'fiscal_year':    fiscal_year,
            'page_num':       page_num,
        })

    return results


# ── Extract budget data from PDF ──────────────────────────────────────────────
def extract_budget(pdf_path, mode='operating'):
    """
    Parse Long Beach General Fund Summary PDF.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    mode: 'operating' for expenditure categories, 'revenue' for revenue categories
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print(f'  WARNING: Could not detect fiscal year from filename: {pdf_path}', file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_results = extract_from_page(page, fiscal_year, mode=mode)
            results.extend(page_results)

    # Post-validation: warn if fiscal_year is None
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    # Deduplicate by (department, fiscal_year)
    seen = set()
    deduped = []
    for row in results:
        key = (row['department'], row['fiscal_year'])
        if key not in seen:
            seen.add(key)
            deduped.append(row)
        else:
            print(f'  [dedup] Skipping duplicate: {row["department"]} FY{row["fiscal_year"]} '
                  f'(page {row["page_num"]})', file=sys.stderr)

    return deduped


# ── Revenue extraction (alias) ────────────────────────────────────────────────
def extract_revenue(pdf_path):
    """
    Extract revenue category rows from Long Beach General Fund Summary PDF.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    return extract_budget(pdf_path, mode='revenue')


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Long Beach budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                        help='Extract operating (expenditures) or revenue rows (default: operating)')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path, mode=args.mode)
    print(json.dumps(data, indent=2))
