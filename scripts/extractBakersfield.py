#!/usr/bin/env python3
"""
Bakersfield Budget PDF Extractor

Extracts department-level operating expenditure data from Bakersfield
Adopted Budget PDFs using pdfplumber.

Target: ALL operating funds (~$765M per REQUIREMENTS.md DATA-07), NOT just General Fund.
$765M = General Fund (~$287M) + PUBSAF 1% Sales Tax + Internal Service Funds +
        Enterprise Funds + Special Revenue Funds + others.

Source section: "Resources & Appropriations - Operating Budget - All Funds"
(or "RESOURCES AND APPROPRIATIONS / OPERATING BUDGET - ALL FUNDS" in FY2024-25 style).
The Appropriations subsection lists departments + amounts summing ~$728M (FY25) / ~$765M (FY26).
Both are within the required $600M-$900M sanity band.

FY is detected from PDF filename (ending-year convention):
  fy2024-25-adopted-budget.pdf -> 2025
  fy2025-26-adopted-budget.pdf -> 2026

Usage:
  python scripts/extractBakersfield.py "docs/Bakersfield/fy2024-25-adopted-budget.pdf"
  python scripts/extractBakersfield.py "docs/Bakersfield/fy2025-26-adopted-budget.pdf" --revenue
"""

import sys
import json
import re
import pdfplumber


# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Parse dollar string like '$3,418,795' or '(1,234)' -> integer."""
    if s is None:
        return 0
    s = str(s).strip()
    if not s or s == '-' or s == '$0':
        return 0
    neg = s.startswith('(') or s.startswith('-$') or (
        s.startswith('-') and not s[1:2].startswith('$')
    )
    val = re.sub(r'[$()\s,]', '', s).lstrip('-')
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0


# ── Detect FY from filename ────────────────────────────────────────────────────
def detect_fy_from_filename(pdf_path):
    """
    Extract fiscal year (ending-year convention) from Bakersfield PDF filename.
    fy2024-25-adopted-budget.pdf -> 2025
    fy2025-26-adopted-budget.pdf -> 2026
    Pattern: fy{YYYY}-{YY} -> century + ending two digits
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    m = re.search(r'fy(\d{4})-(\d{2})', fname)
    if m:
        century = (int(m.group(1)) // 100) * 100
        return century + int(m.group(2))
    return None


# ── Parse a money token that may contain spaces (e.g., "412, 196,800") ───────
_MONEY_TOKEN_RE = re.compile(r'^\$?\s*(?:\d[\d,\s]*\d|\d)(?:\)?)$')


def is_money_token(s):
    """Return True if s looks like a monetary amount (possibly with internal spaces)."""
    clean = s.strip()
    if not clean:
        return False
    # Remove $, parens, spaces, commas — what's left should be digits
    digits = re.sub(r'[\$\(\)\s,]', '', clean)
    return digits.isdigit() and len(digits) >= 1


def extract_last_amount(parts):
    """
    From a list of whitespace-split tokens, extract the last money amount.
    Handles amounts like ["412,", "196,800"] that were split by internal spaces.
    Returns (dept_name, amount) or (None, 0) if not parseable.
    """
    # Rejoin and try to extract amounts from the end
    # Strategy: scan from end, collect contiguous tokens that form money strings
    # Stop when we hit a token that's clearly a dept name word

    # First join all consecutive number/comma tokens from the end into one amount
    money_parts = []
    name_parts = list(parts)

    while name_parts:
        last = name_parts[-1].strip().rstrip(')')
        # A token is a "money part" if it's digits with commas or starts with $
        if re.match(r'^\$?[\d,]+$', last) or re.match(r'^\$?[\d,]+\)?$', last):
            money_parts.insert(0, name_parts.pop())
        else:
            break

    if not money_parts:
        return None, 0

    amount_str = ''.join(money_parts)
    amount = parse_money(amount_str)
    dept = ' '.join(name_parts).strip()
    return dept, amount


# ── Find "Operating Budget - All Funds" section page ─────────────────────────
def find_operating_all_funds_page(pdf):
    """
    Scan pages to find the "Operating Budget - All Funds" appropriations section.
    Returns the page index (0-based) where the department-level appropriations table lives.

    FY2024-25 style: "RESOURCES AND APPROPRIATIONS / OPERATING BUDGET - ALL FUNDS"
    FY2025-26 style: "Resources & Appropriations / Operating Budget - All Funds"
    Both are on the same page and contain dept rows (Police, Fire, etc.)
    """
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        text_upper = text.upper()
        if ('OPERATING' in text_upper and 'ALL FUNDS' in text_upper
                and ('POLICE' in text_upper or 'FIRE' in text_upper)
                and ('PUBLIC WORKS' in text_upper or 'GENERAL GOVERNMENT' in text_upper)):
            return i
    return None


# ── Extract operating budget rows from the all-funds section ──────────────────
def extract_budget(pdf_path):
    """
    Parse Bakersfield Adopted Budget PDF for all-funds operating department totals.
    Target: ~$728M (FY2025) or ~$765M (FY2026) across all operating funds.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    PDF layout (confirmed from FY2024-25 and FY2025-26):
    The page has two sections: Resources (fund types) and Appropriations (by department).
    We parse the Appropriations block only.

    Each row format: "DeptName PriorYear1 PriorYear2 CurrentYear"
    Numbers may have internal spaces: "412, 196,800" = 412196800
    Dollar signs appear only in some rows. Last column = current FY adopted amount.
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print('  WARNING: Could not detect fiscal year from filename', file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        page_idx = find_operating_all_funds_page(pdf)
        if page_idx is None:
            print('  WARNING: Could not find "Operating Budget - All Funds" section', file=sys.stderr)
            return []

        page = pdf.pages[page_idx]
        page_num = page_idx + 1
        text = page.extract_text() or ''

        lines = text.split('\n')

        in_appropriations = False

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Detect start of Appropriations block
            if re.match(r'^Appropriations?\s*$', stripped, re.IGNORECASE):
                in_appropriations = True
                continue

            if not in_appropriations:
                continue

            # Detect end of Appropriations block
            # "Total ...", "Appropriation Total", "Successor Agency" (footer row), "Formerly..."
            if re.match(r'^(Total\b|Appropriations?\s+Total|Formerly\s+Redevelopment)', stripped, re.IGNORECASE):
                break

            # Skip pure header/label lines (no numbers)
            if not re.search(r'\d', stripped):
                continue

            # ── Parse the department row ──────────────────────────────────────
            # The row has format: "DeptName N1 N2 N3" where numbers may have spaces
            # e.g.: "General Government 53,861, 430 $ 82,485,341 $ 84,768,062"
            # e.g.: "Non- Departmental & Transfers 102,584,242 96,079,074 79,076,736"
            # e.g.: "General Government 80,673, 680 $ 73,897,483 $ 82,612, 125"
            #
            # Strategy: normalize spaces in number groups, then split on numbers

            # Step 1: Remove $ signs (they appear before some columns)
            normalized = re.sub(r'\$\s*', '', stripped)

            # Step 2: Identify all number tokens (digit sequences with commas/spaces)
            # A number token pattern: starts with digit, may have commas, spaces, digits
            # We tokenize by splitting at word boundaries around numbers

            # Split into tokens. Numbers with internal spaces like "53,861, 430" are tricky.
            # Approach: find the department name (text before first standalone number),
            # then parse the remaining as 2-3 columns of numbers.

            # Find the position where numbers begin: first standalone number group
            # (preceded by a letter-ending word)
            m = re.match(
                r'^(.+?)'                           # dept name (non-greedy, must start with letter)
                r'\s+'
                r'(\d[\d,\s]*\d|\d)'               # first number (may have internal spaces)
                r'(?:\s+\$?\s*\d[\d,\s]*\d|\d)*'  # optional more numbers
                r'\s+\$?\s*'
                r'(\d[\d,\s]*\d|\d)\s*$',          # last number = current FY
                normalized
            )

            if m:
                dept_raw = m.group(1).strip()
                last_amount_str = re.sub(r'\s', '', m.group(3))
                amount = parse_money(last_amount_str)

                dept = re.sub(r'\s+', ' ', dept_raw).strip()

                # Skip rows that start with numbers (those are fund-type rows in Resources)
                if re.match(r'^\d', dept):
                    continue

                # Skip obvious non-department rows
                skip_patterns = [
                    r'^(Total|Adopted|Actual|FY\d|Sources|Type|Resources?|Successor)',
                ]
                skip = any(re.match(p, dept, re.IGNORECASE) for p in skip_patterns)

                if not skip and amount > 100_000 and len(dept) > 2:
                    results.append({
                        'department':     dept,
                        'fund':           'All Operating Funds',
                        'adopted_amount': amount,
                        'fiscal_year':    fiscal_year,
                        'page_num':       page_num,
                    })

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


# ── Extract revenue rows from General Fund resources section ──────────────────
def extract_revenue(pdf_path):
    """
    Parse Bakersfield Adopted Budget PDF for General Fund revenue data.
    Source: "Resources and Appropriations - General Fund" Resources block.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    Categories: Property Tax, Sales Tax, PSVS Sales Tax, Other Taxes,
    Licenses & Permits, Intergovernmental, Charges for Service, Fines, Misc.
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print('  WARNING: Could not detect fiscal year from filename', file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        # Find the General Fund resources page:
        # Has "General Fund" heading + "Property Tax" + tabular amounts + "Appropriations" block
        # The page we want has the tabular data (not just narrative text)
        target_page_idx = None
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ''
            text_upper = text.upper()
            # Must have Property Tax as a tabular row (with numbers)
            if ('GENERAL FUND' in text_upper
                    and 'PROPERTY TAX' in text_upper
                    and re.search(r'Property Tax\s+[\d,]+', text)
                    and 'POLICE' in text_upper
                    and 'TOTAL RESOURCES' in text_upper.replace('\n', ' ')):
                target_page_idx = i
                break

        if target_page_idx is None:
            print('  WARNING: Could not find General Fund resources section', file=sys.stderr)
            return []

        page = pdf.pages[target_page_idx]
        page_num = target_page_idx + 1
        text = page.extract_text() or ''
        lines = text.split('\n')

        in_resources = False

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Start of Resources block
            if re.match(r'^Resources\s*$', stripped, re.IGNORECASE):
                in_resources = True
                continue

            # End of Resources block
            if in_resources and re.match(r'^Appropriations?\s*$', stripped, re.IGNORECASE):
                break
            if in_resources and re.match(r'^(Beginning|Transfers|Total)', stripped, re.IGNORECASE):
                continue

            if not in_resources:
                continue

            if not re.search(r'\d', stripped):
                continue

            # Parse revenue category rows (same format as operating rows)
            normalized = re.sub(r'\$\s*', '', stripped)
            m = re.match(
                r'^(.+?)'
                r'\s+'
                r'(\d[\d,\s]*\d|\d)'
                r'(?:\s+\$?\s*\d[\d,\s]*\d|\d)*'
                r'\s+\$?\s*'
                r'(\d[\d,\s]*\d|\d)\s*$',
                normalized
            )

            if m:
                category_raw = m.group(1).strip()
                last_amount_str = re.sub(r'\s', '', m.group(3))
                amount = parse_money(last_amount_str)

                category = re.sub(r'\s+', ' ', category_raw).strip()

                skip_patterns = [
                    r'^(Total|Adopted|Actual|FY\d|Sources|Type)',
                ]
                skip = any(re.match(p, category, re.IGNORECASE) for p in skip_patterns)

                if not skip and amount > 100_000 and len(category) > 2:
                    results.append({
                        'department':     category,
                        'fund':           'General Fund Revenue',
                        'adopted_amount': amount,
                        'fiscal_year':    fiscal_year,
                        'page_num':       page_num,
                    })

    # Deduplicate
    seen = set()
    deduped = []
    for row in results:
        key = (row['department'], row['fiscal_year'])
        if key not in seen:
            seen.add(key)
            deduped.append(row)
        else:
            print(f'  [dedup] Skipping duplicate: {row["department"]} FY{row["fiscal_year"]}',
                  file=sys.stderr)

    return deduped


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Bakersfield budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--revenue', action='store_true',
                        help='Extract revenue data instead of operating expenditures')
    args = parser.parse_args()

    if args.revenue:
        data = extract_revenue(args.pdf_path)
    else:
        data = extract_budget(args.pdf_path)

    print(json.dumps(data, indent=2))
