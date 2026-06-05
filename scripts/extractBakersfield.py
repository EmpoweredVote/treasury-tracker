#!/usr/bin/env python3
"""
Bakersfield Budget PDF Extractor

Extracts department-level operating expenditure data from Bakersfield
Adopted Budget PDFs using pdfplumber.

Target: General Fund ONLY (~$412M FY2025, ~$427M FY2026), NOT all operating funds.
Scope matches the GF revenue extraction (~$372M) for comparable Money In / Money Out.

Source section: "Resources and Appropriations - General Fund"
(or "RESOURCES AND APPROPRIATIONS / GENERAL FUND" in FY2024-25 style).
This is the same page used by extract_revenue(). The Appropriations block lists:
  Police, Fire, Public Works, Recreation & Parks, Development Services,
  Economic & Community Development, General Government, Non-Departmental,
  Contingencies, Transfers Out — summing to ~$412M (FY25) / ~$427M (FY26).

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


# ── Find "General Fund" resources & appropriations page ───────────────────────
def find_general_fund_page(pdf):
    """
    Scan pages to find the "Resources and Appropriations - General Fund" tabular page.
    Returns the page index (0-based) where the GF department-level data lives.

    FY2024-25 style: "RESOURCES AND APPROPRIATIONS / GENERAL FUND"
    FY2025-26 style: "Resources and Appropriations / General Fund"

    Both PDFs place this at page 32 (index 31). The page contains:
    - Resources block: Property Tax, Sales Tax, PSVS, etc.
    - Appropriations block: Police, Fire, Public Works, etc.

    Detection: must have General Fund heading + Property Tax tabular data (with numbers)
               + Police + Total Resources line (confirms it's the tabular page, not narrative).
    """
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        text_upper = text.upper()
        if ('GENERAL FUND' in text_upper
                and 'PROPERTY TAX' in text_upper
                and re.search(r'Property Tax\s+[\d,]+', text)
                and 'POLICE' in text_upper
                and 'TOTAL RESOURCES' in text_upper.replace('\n', ' ')):
            return i
    return None


# ── Extract operating budget rows from the General Fund section ───────────────
def extract_budget(pdf_path):
    """
    Parse Bakersfield Adopted Budget PDF for General Fund operating department totals.
    Target: ~$412M (FY2025) or ~$427M (FY2026) — General Fund only, matches GF revenue scope.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    PDF layout (confirmed from FY2024-25 and FY2025-26):
    Page 32 in both PDFs. Contains Resources (revenue) and Appropriations (by department).
    We parse the Appropriations block only.

    FY2025-26 Appropriations block departments (page 32):
      Police, Fire, (Total Public Safety — SKIP), Development Services,
      Economic & Community Development, General Government, Non Departmental Activity,
      Public Works, Recreation & Parks, (Total Operations — SKIP),
      Contingencies, Transfers Out
    Summing to ~$427M.

    FY2024-25 Appropriations block (same structure, FY25 adopted column):
      Police, Fire, (Total Public Safety — SKIP), Public Works, Recreation and Parks,
      Development Services, Economic and Community Development, General Government,
      Non-Departmental, (Total Operations — SKIP), Contingencies, Transfers Out
    Summing to ~$412M.

    Each row format: "DeptName PriorYear1 PriorYear2 CurrentYear"
    Numbers may have internal spaces: "412, 196,800" = 412196800
    Dollar signs appear only in some rows. Last column = current FY adopted amount.
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print('  WARNING: Could not detect fiscal year from filename', file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        page_idx = find_general_fund_page(pdf)
        if page_idx is None:
            print('  WARNING: Could not find "General Fund" resources & appropriations section',
                  file=sys.stderr)
            return []

        page = pdf.pages[page_idx]
        page_num = page_idx + 1
        text = page.extract_text() or ''

        lines = text.split('\n')

        in_appropriations = False
        pending_label = None  # carries over a label-only line (no numbers) for split-line depts

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Detect start of Appropriations block (comes after Resources block on same page)
            if re.match(r'^Appropriations?\s*$', stripped, re.IGNORECASE):
                in_appropriations = True
                pending_label = None
                continue

            if not in_appropriations:
                continue

            # Detect end of Appropriations block:
            # "TOTAL APPROPRIATIONS" or "Note:" footer (handles both capitalization styles)
            if re.match(r'^(TOTAL\s+APPROPRIATIONS|Total\s+Appropriations|Note\s*:)', stripped, re.IGNORECASE):
                break

            # ── Split-line dept name handling ─────────────────────────────────
            # FY2024-25: "Economic and Community" appears alone on one line (no numbers),
            # followed by "Development 12,849,017 11, 043,719 17,165,251" on the next.
            # Carry the label-only line as a prefix for the next line.
            if not re.search(r'\d', stripped):
                # Label-only line — hold as prefix
                pending_label = stripped
                continue

            # Combine with pending_label if we have one
            if pending_label is not None:
                stripped = pending_label + ' ' + stripped
                pending_label = None

            # ── Parse the department row ──────────────────────────────────────
            # The row has format: "DeptName N1 N2 N3" where numbers may have spaces
            # e.g.: "General Government 28, 132, 728 28, 101, 017 29,402,699"
            # e.g.: "Non Departmental Activity 8,177, 124 1,450,347 1, 181, 281)"
            # e.g.: "Transfers Out 38,453,035 22, 751, 482 19, 915,664"
            # e.g.: "Contingencies 3,165,000 700,000" (2 columns only = $0 current FY)
            #
            # Require exactly 3 columns (prior2, prior1, current). Lines with only 2 columns
            # (like Contingencies when no current-year budget is set) yield $0 and are skipped.

            # Step 1: Remove $ signs (they appear before some columns)
            normalized = re.sub(r'\$\s*', '', stripped)

            # Require at least 3 distinct numeric tokens (3 columns) to ensure a current-FY
            # column exists. A numeric token is a whitespace-delimited word consisting only
            # of digits and commas (possibly preceded by a dollar sign we already removed).
            # e.g. "Contingencies 3,165,000 700,000" has 2 tokens → skip (no FY value).
            # We split on whitespace then count word-tokens that are purely digit/comma.
            tokens = re.findall(r'[\d,]+', normalized)
            # Remove tokens that are just a year-style 4-digit number from the header area
            # (e.g. "2022", "2023") — those appear before the first department row, so
            # by the time we're in_appropriations we won't encounter them. Still, be safe.
            numeric_tokens = [t for t in tokens if re.match(r'^[\d,]+$', t) and len(t) >= 3]
            if len(numeric_tokens) < 3:
                # Only 1-2 number columns — no current FY value; treat as $0 (skip)
                continue

            # Find the position where numbers begin: first standalone number group
            # (preceded by a letter-ending word)
            m = re.match(
                r'^(.+?)'                           # dept name (non-greedy, must start with letter)
                r'\s+'
                r'(\d[\d,\s]*\d|\d)'               # first number (may have internal spaces)
                r'(?:\s+\$?\s*\d[\d,\s]*\d|\d)*'  # optional more numbers
                r'\s+\$?\s*'
                r'(\d[\d,\s]*\d|\d)\s*[\)]*\s*$',  # last number = current FY (may have trailing paren)
                normalized
            )

            if m:
                dept_raw = m.group(1).strip()
                last_amount_str = re.sub(r'\s', '', m.group(3))

                # Detect negative value: trailing ) in the original normalized line
                # e.g. "Non Departmental Activity 8,177, 124 1,450,347 1, 181, 281)"
                # means the last amount (FY26) is negative: ($1,181,281)
                is_negative = normalized.rstrip().endswith(')')
                if is_negative:
                    last_amount_str = last_amount_str.rstrip(')')
                amount = parse_money(last_amount_str)
                if is_negative:
                    amount = -amount

                dept = re.sub(r'\s+', ' ', dept_raw).strip()

                # Skip rows that start with numbers
                if re.match(r'^\d', dept):
                    continue

                # Skip subtotal rows ("Total Public Safety", "Total Operations")
                # but keep "Transfers Out" and "Contingencies"
                skip_patterns = [
                    r'^(Total\s+Public\s+Safety|Total\s+Operations)',
                    r'^(Adopted|Actual|FY\d|Sources|Type|Resources?|Beginning)',
                ]
                skip = any(re.match(p, dept, re.IGNORECASE) for p in skip_patterns)

                # Include row if not skipped and amount is non-zero
                # (negative Non-Departmental transfers are valid and should be included)
                if not skip and amount != 0 and len(dept) > 2:
                    results.append({
                        'department':     dept,
                        'fund':           'General Fund',
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
