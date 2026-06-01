#!/usr/bin/env python3
"""
Troutdale Budget PDF Extractor

Extracts department-level operating budget from the 'General Fund / Fund Summary
/ ACCOUNT 01.00' page and revenue categories from the 'All Funds Combined /
Fund Summary' page using pdfplumber text-line parsing (NOT extract_tables).

Key differences from extractGresham.py:
  - Fiscal year parsed from YYYY-YY (dash) format, not YYYY/YY (slash)
  - Operating extraction targets General Fund page (ACCOUNT 01.00), not All Funds
  - Subtotal rows (PUBLIC SAFETY, COMMUNITY DEVELOPMENT, PARKS & FACILITIES)
    and a second FINANCE row must be excluded
  - Dollar sign ($) appears as a standalone token between name and first number
  - Section markers are UPPERCASE (REQUIREMENTS / RESOURCES)

Amounts are in full dollars (no thousands multiplication).

Usage:
  python scripts/extractTroutdale.py "docs/Troutdale/fy2025-26.pdf"
  python scripts/extractTroutdale.py "docs/Troutdale/fy2025-26.pdf" --mode revenue
"""

import sys
import json
import re
import pdfplumber

# ── Rows to skip (totals, subtotals, non-department categories) ───────────────
SKIP_ROWS = {
    # Totals / non-line items
    'TOTAL REQUIREMENTS', 'APPROPRIATIONS:',
    # Non-operating / non-department categories
    'TRANSFERS', 'CONTINGENCY', 'UNAPPROPRIATED', 'OTHER',
    # Subtotal rows — composite of child departments (double-count if included)
    'PUBLIC SAFETY',           # = Police Ops + PD Building + Solid Waste
    'COMMUNITY DEVELOPMENT',   # = Planning + Tourism & Economic Development
    'PARKS & FACILITIES',      # = Parks & Greenways + Facilities
    # FINANCE: two rows exist — first is Finance dept, second is Finance+InfoSvcs subtotal
    # Second FINANCE row is handled by finance_count guard (see extract_budget)
}

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Handle OCR artifacts: '3 5,569,000' -> 35569000, '4 ,197,000' -> 4197000.
    Strips all whitespace, $, parens, commas — handles OCR spaces inside numbers.
    """
    if not s or not s.strip() or s.strip() == '-':
        return 0
    cleaned = re.sub(r'[\$\(\)\s,]', '', s.strip())
    neg = s.strip().startswith('(')
    try:
        return int(round(float(cleaned) * (-1 if neg else 1)))
    except ValueError:
        return 0

# ── Parse fiscal year from column header line (YYYY-YY dash format) ──────────
def parse_fy_from_header(header_line):
    """
    Parse fiscal year from Troutdale column header line.
    Handles: '2022-23 2023-24 2024-25 2025-26 2025-26 2025-26'
    Returns ending year integer of the LAST pattern (= Adopted column).
    e.g. '2025-26' -> 2026

    NOTE: Troutdale uses YYYY-YY (dashes), NOT YYYY/YY (slashes) like Gresham.
    Using the Gresham slash regex returns zero matches on Troutdale PDFs.
    """
    matches = re.findall(r'(\d{4})-(\d{2})(?!\d)', header_line)
    if not matches:
        return None
    last = matches[-1]
    century = (int(last[0]) // 100) * 100
    return century + int(last[1])

# ── Extract department-level operating budget from Troutdale General Fund page ─
def extract_budget(pdf_path):
    """
    Extract department-level operating budget from the Troutdale General Fund
    Fund Summary page (ACCOUNT 01.00).

    Uses page.extract_text() text-line parsing (NOT extract_tables() — that
    returns empty on Troutdale's General Fund and All Funds Combined pages).

    Key difference from Gresham: Troutdale's All Funds Combined Requirements section
    lists expenditure categories (Personnel, Materials), not departments. Must target
    the General Fund page (ACCOUNT 01.00) for department-level data.

    Returns list of: { department, adopted_amount, fiscal_year, page_num }
    Amounts are in full dollars (no multiply-by-1000).
    """
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            # Target the General Fund Fund Summary page specifically
            if 'GENERAL FUND' not in text or 'FUND SUMMARY' not in text:
                continue
            if 'ACCOUNT 01.00' not in text:
                continue  # Skip other fund pages that also say FUND SUMMARY

            # Parse fiscal year from column headers (first 8 lines of page)
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)
                if fy:
                    fiscal_year = fy
                    break
            if not fiscal_year:
                print(f'  WARNING: Could not parse fiscal year on page {page_num}', file=sys.stderr)
                continue

            # Extract department rows from Requirements section only
            in_requirements = False
            finance_count = 0
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                # Troutdale uses UPPERCASE section markers
                # Normalize whitespace before checking (guard against OCR spacing)
                if re.sub(r'\s+', '', s) == 'REQUIREMENTS':
                    in_requirements = True
                    continue
                if not in_requirements:
                    continue

                # Each data line: "DEPT NAME  $  num  num  num  num  num  ADOPTED"
                # Troutdale rows have standalone '$' token between name and first number
                tokens = s.split()
                if len(tokens) < 2:
                    continue

                # Split: name tokens vs number tokens
                # Strip dollar signs AND commas before numeric check (Troutdale-specific:
                # rows contain standalone '$' tokens that Gresham does not have)
                name_tokens = []
                num_tokens = []
                in_nums = False
                for t in tokens:
                    clean_t = re.sub(r'[\$,]', '', t)
                    if not in_nums and (re.match(r'^\d+$', clean_t) or t == '-' or t == '$'):
                        in_nums = True
                    if in_nums:
                        num_tokens.append(t)
                    else:
                        name_tokens.append(t)

                # Need at least 6 numeric tokens (6 columns: actual, actual, budget,
                # budget, budget, adopted) to be a valid department data row.
                if not name_tokens or len(num_tokens) < 6:
                    continue

                dept = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()

                # Skip totals, subtotals, and non-department rows
                if dept in SKIP_ROWS or dept.endswith(':'):
                    continue

                # Handle FINANCE duplication: the General Fund page has two FINANCE rows.
                # First = Finance department ($939,995 FY2026), keep it.
                # Second = Finance+Information Services subtotal ($1,389,227), skip it.
                # Verified: 939,995 + 449,232 = 1,389,227 for FY2026.
                if dept == 'FINANCE':
                    finance_count += 1
                    if finance_count > 1:
                        continue  # Skip Finance+InfoSvcs subtotal row

                # Adopted amount = last column (column 6 = Adopted).
                # OCR may split e.g. '61,494,586' into tokens ['6', '1,494,586'].
                # Detect this: if the second-to-last token is a short pure-digit fragment
                # (1-3 digits, no comma), concatenate it with the last token.
                adopted_raw = num_tokens[-1]
                if (len(num_tokens) >= 2
                        and re.match(r'^\d{1,3}$', num_tokens[-2])
                        and re.match(r'^\d{3,}', num_tokens[-1])
                        and ',' in num_tokens[-1]):
                    adopted_raw = num_tokens[-2] + num_tokens[-1]
                adopted = parse_money(adopted_raw)

                if adopted <= 0:
                    print(f'  [skipped] Zero/negative amount: {dept}', file=sys.stderr)
                    continue

                results.append({
                    'department': dept,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })

            if results:
                break  # Found real data on this page — done

    # Post-validation: warn about any rows with None fiscal_year
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year — check PDF header',
              file=sys.stderr)

    return results


# ── Extract Resources (revenue) categories from All Funds Combined page ───────
def extract_revenue(pdf_path):
    """
    Extract revenue categories from the Resources section of the
    'CITY-WIDE FUND SUMMARY ALL FUNDS COMBINED' page.

    Uses page.extract_text() text-line parsing (NOT extract_tables() — that
    returns empty on Troutdale's All Funds Combined page).

    Guard: skips General Fund page (ACCOUNT 01.00) which also contains a
    FUND SUMMARY and RESOURCES section but has only ~$17.5M (General Fund only),
    not the full all-funds ~$33.7M revenue.

    Excludes: BEGINNING FUND BALANCE (~$47.5M) and TOTAL RESOURCES (sum row).
    Including Beginning Fund Balance inflates total to ~$81M instead of ~$33.7M.

    Returns list of: { category, adopted_amount, fiscal_year, page_num }
    Amounts are in full dollars (no multiply-by-1000).
    """
    REVENUE_SKIP = {'BEGINNING FUND BALANCE', 'TOTAL RESOURCES',
                    'BEGINNING FUND BALANCE $'}  # $ may attach to parsed name

    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            # Target the All Funds Combined Fund Summary page
            if 'ALL FUNDS COMBINED' not in text or 'FUND SUMMARY' not in text:
                continue
            # Guard: General Fund page also has FUND SUMMARY — skip it
            if 'ACCOUNT 01.00' in text:
                continue

            # Parse fiscal year from column headers (first 8 lines of page)
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)  # same YYYY-YY dash function
                if fy:
                    fiscal_year = fy
                    break
            if not fiscal_year:
                print(f'  WARNING: Could not parse fiscal year on page {page_num}', file=sys.stderr)
                continue

            # Extract category rows from Resources section only
            in_resources = False
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                # Troutdale uses UPPERCASE section markers
                if s == 'RESOURCES':
                    in_resources = True
                    continue
                if s == 'REQUIREMENTS':
                    in_resources = False
                    continue
                if not in_resources:
                    continue

                # Each data line: "CATEGORY NAME  $  num  num  num  num  num  ADOPTED"
                tokens = s.split()
                if len(tokens) < 2:
                    continue

                # Split: name tokens vs number tokens
                # Strip dollar signs AND commas before numeric check (Troutdale-specific)
                name_tokens = []
                num_tokens = []
                in_nums = False
                for t in tokens:
                    clean_t = re.sub(r'[\$,]', '', t)
                    if not in_nums and (re.match(r'^\d+$', clean_t) or t == '-' or t == '$'):
                        in_nums = True
                    if in_nums:
                        num_tokens.append(t)
                    else:
                        name_tokens.append(t)

                # Need at least 6 numeric tokens to be a valid data row
                if not name_tokens or len(num_tokens) < 6:
                    continue

                category = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()

                if category in REVENUE_SKIP:
                    continue

                # Adopted amount = last column.
                # OCR may split numbers — detect and concatenate fragments.
                adopted_raw = num_tokens[-1]
                if (len(num_tokens) >= 2
                        and re.match(r'^\d{1,3}$', num_tokens[-2])
                        and re.match(r'^\d{1,3},', num_tokens[-1])):
                    adopted_raw = num_tokens[-2] + num_tokens[-1]
                adopted = parse_money(adopted_raw)

                if adopted <= 0:
                    continue

                results.append({
                    'category':       category,
                    'adopted_amount': adopted,
                    'fiscal_year':    fiscal_year,
                    'page_num':       page_num,
                })

            if results:
                break  # Found real data on this page — done

    # Post-validation: warn about any rows with None fiscal_year
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year — check PDF header',
              file=sys.stderr)

    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Troutdale budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                        help='operating=Requirements section departments, revenue=Resources section categories')
    args = parser.parse_args()

    data = extract_revenue(args.pdf_path) if args.mode == 'revenue' else extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
