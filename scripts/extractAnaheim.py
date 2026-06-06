#!/usr/bin/env python3
"""
Anaheim CA Budget PDF Extractor

Extracts General Fund department-level appropriations from Anaheim Adopted Budget PDFs
using pdfplumber. Targets the "General Fund Expenditures by Function" page, which is a
dedicated General-Fund-only table (no enterprise rows mixed in).

PDF structure (consistent FY2024/25 and FY2025/26 verified):
  - Page titled "General Fund Budget Information • General Fund Expenditures by Function"
  - Columns: Department | FY N-2 Actual | FY N-1 Adopted | FY N-1 Amended | FY N Adopted
  - The 4th numeric column is the "Adopted" amount for the budget year
  - Amounts are in FULL DOLLARS (verified: Police FY2024/25 = $195,307,626 matches PDF)
  - Total GF for FY2024/25 = $490,937,159 (~$491M); FY2025/26 = $530,352,785 (~$530M)

FY is derived from PDF filename:
  fy2025-adopted-budget.pdf -> FY 2025 (ending year)
  fy2026-adopted-budget.pdf -> FY 2026 (ending year)

Fund filter: The "General Fund Expenditures by Function" page is EXCLUSIVELY GF — it
contains Police, Fire & Rescue, Public Works, Planning & Building, Housing & Community
Development, Community Services, City Council, City Administration, City Attorney,
City Clerk, Finance, Human Resources. Enterprise funds (Public Utilities enterprise,
Water Utility, Electric Utility, etc.) appear only on the "Expenditures by Fund" page —
they NEVER appear on the GF function table. This is the extraction-time filter (D-06).

Revenue: "General Fund Revenues by Category" page has clean GF-only revenue by category.
Categories include: Transient Occupancy Taxes, Sales and Use Taxes, Property Taxes,
Business License Taxes, Property Transfer Taxes, Fees/Permits/Other Charges, Fines,
Transfers from Other Funds, Intergovernmental, Intragovernmental, Reimbursements,
Use of Money and Property.

Usage:
  python scripts/extractAnaheim.py "docs/Anaheim/fy2025-adopted-budget.pdf"
  python scripts/extractAnaheim.py "docs/Anaheim/fy2025-adopted-budget.pdf" --mode revenue

Security (T-31-06): PDF path from controlled docs/Anaheim/ readdir, not user input.
Security (T-31-04): Amount scale verified full dollars; toFullDollars not needed.
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
    Extract fiscal year (ending year) from Anaheim budget filename.
    fy2025-adopted-budget.pdf -> 2025
    fy2026-adopted-budget.pdf -> 2026
    fy25-adopted-budget.pdf   -> 2025 (two-digit fallback)
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    # Four-digit year must be checked first: fy2025 -> 2025
    m4 = re.search(r'fy(\d{4})-', fname)
    if m4:
        return int(m4.group(1))
    # Two-digit year: fy25 -> 2025
    m = re.search(r'fy(\d{2})-', fname)
    if m:
        return 2000 + int(m.group(1))
    return None


# ── Parse a department row, return the adopted (4th numeric) value ────────────
def _extract_label_and_adopted(line):
    """
    Extract department label and the 'Adopted' (4th integer column) from a row.

    Anaheim department rows: Department | FY N-2 Actual | FY N-1 Adopted | FY N-1 Amended | FY N Adopted
    % Change columns are NOT present in Anaheim (unlike Fresno). Four dollar columns.

    Returns (label, adopted_amount) or None.
    """
    # Normalize split numbers first: "4 2,374,186" -> "42,374,186"
    # Only non-zero leading digit: avoid joining "0 1,640,200" (two separate numbers)
    normalized = re.sub(r'\b([1-9])\s+(\d{1,3}(?:,\d{3})+)', r'\1\2', line.strip())

    # Find numbers: must start with digit, may be wrapped in parens
    num_pattern = re.compile(r'\(\d[\d,]*\)|\d[\d,.]*')
    matches = list(num_pattern.finditer(normalized))

    if not matches:
        return None

    # Label is everything before the first number match
    label = normalized[:matches[0].start()].strip().rstrip(',').strip()
    if len(label) < 2:
        return None

    # Collect integer-valued matches (budget amounts), ignore decimal % change values
    int_matches = [m for m in matches if '.' not in m.group()]

    if len(int_matches) < 1:
        return None

    # The Adopted amount is the 4th integer (if available), else the last integer.
    # Format: Actual | Adopted (prior) | Amended (prior) | Adopted (current)
    if len(int_matches) >= 4:
        adopted = int_matches[3].group()  # 4th integer = current year Adopted
    elif len(int_matches) >= 3:
        adopted = int_matches[2].group()  # 3rd integer fallback
    else:
        adopted = int_matches[-1].group()  # last integer fallback

    value = parse_money(adopted)
    return (label, value)


# ── Extract operating rows from "General Fund Expenditures by Function" page ──
def extract_operating_from_page(page, fiscal_year):
    """
    Extract General Fund department rows from the "General Fund Expenditures by Function"
    page. This page is GF-only — enterprise, special revenue, and internal service funds
    are NOT present here (they appear on separate pages).

    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    text = page.extract_text() or ''

    # Page identification: must contain the GF expenditures by function header
    # AND actual department data — not just a TOC reference.
    # The real page has "KEEPING US SAFE" section header and dollar amounts.
    if 'General Fund Expenditures by Function' not in text:
        return []
    if 'Police' not in text or 'Fire' not in text:
        return []
    # TOC pages list items with page numbers but no dollar signs
    if '$' not in text:
        return []
    # Must have the actual section header present (not just TOC reference)
    if 'KEEPING US SAFE' not in text:
        return []

    lines = text.split('\n')
    page_num = page.page_number

    results = []
    in_function_table = False

    # Section headers / total rows to skip
    skip_exact = {
        'General Fund Expenditures by Function',
        'General Fund Budget Information',
        'General Fund Budget Information • General Fund Expenditures by Function',
        'KEEPING US SAFE',
        'Keeping Us Safe Total',
        'PROVIDING THE NECESSITIES',
        'Providing the Necessities Total',
        'Providing The Necessities Total',
        'ENSURING QUALITY OF LIFE',
        'Ensuring Quality of Life Total',
        'ADMINISTERING EFFICIENT GOVERNMENT',
        'Administering Efficient Government Total',
        'SUPPORTING ACTIVITIES',
        'Supporting Activities Total',
    }

    # Column header prefixes to skip
    skip_prefixes = (
        'FY 20',
        'FY 2',
        'Actual',
        'Adopted',
        'Amended',
        '% Change',
        'Total $',
        'May not sum',
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Detect start of the function table section
        if 'General Fund Expenditures by Function' in stripped:
            in_function_table = True
            continue

        if not in_function_table:
            continue

        # Skip exact-match section headers / totals
        if stripped in skip_exact:
            continue

        # Skip lines starting with column-header patterns
        if any(stripped.startswith(p) for p in skip_prefixes):
            continue

        # Skip lines with only numbers / punctuation / separators
        if re.match(r'^[\d,\s\(\)\.\-\$%]+$', stripped):
            continue

        # Skip if line is a "Total" row (function subtotals and grand total)
        stripped_lower = stripped.lower()
        if stripped_lower.startswith('total'):
            continue

        # Stop at pie chart / footnote text
        if stripped.startswith('May not sum') or stripped.startswith('FY 20'):
            break

        # Skip separator and footer lines
        if stripped.startswith('-') or stripped.startswith('=') or stripped.startswith('FY 2024'):
            continue

        # Skip page number lines (single integer at end)
        if re.match(r'^\d{1,3}$', stripped):
            continue

        # Skip lines with only symbols and dashes used in section headers
        if re.match(r'^[A-Z\s&]+$', stripped) and len(stripped) > 3:
            # All-caps line = section header (KEEPING US SAFE, etc.)
            continue

        parsed = _extract_label_and_adopted(stripped)
        if parsed is None:
            continue

        label, amount = parsed

        # Skip zero or negative amounts
        if amount <= 0:
            print(f'  [skip] Zero/neg amount: {label} = {amount}', file=sys.stderr)
            continue

        # Skip if label looks like a total/subtotal
        label_lower = label.lower()
        if label_lower.startswith('total') or label_lower.startswith('subtotal'):
            print(f'  [skip] Total/subtotal row: {label}', file=sys.stderr)
            continue

        # Skip if label is too short
        if len(label) <= 2:
            continue

        # Clean up label: strip trailing '$' artifacts from PDF column alignment
        label = label.rstrip('$').strip()

        # Skip if label is now empty or too short after cleanup
        if len(label) <= 2:
            continue

        # Skip "Total" rows (subtotals for each function group)
        if 'Total' in label:
            print(f'  [skip] Function total row: {label}', file=sys.stderr)
            continue

        # Skip garbled/repeated-character text (PDF rendering artifacts for pie chart)
        # Detect: many consecutive repeated characters or non-ASCII in department name
        if re.search(r'(.)\1{3,}', label):
            print(f'  [skip] Garbled PDF artifact: {label[:40]}', file=sys.stderr)
            continue

        # Emit row (GF only — this page is exclusively GF, D-06 extraction-time filter)
        results.append({
            'department': label,
            'fund': 'General Fund',
            'adopted_amount': amount,
            'fiscal_year': fiscal_year,
            'page_num': page_num,
        })
        print(f'  [row] {label}: ${amount:,}', file=sys.stderr)

    return results


# ── Extract revenue rows from "General Fund Revenues by Category" page ────────
def extract_revenue_from_page(page, fiscal_year):
    """
    Extract General Fund revenue rows from the "General Fund Revenues by Category" page.
    This page is GF-only and has clean revenue categories.

    Categories: Transient Occupancy Taxes, Sales and Use Taxes, Property Taxes,
    Business License Taxes, Property Transfer Taxes, Fees/Permits/Other Charges,
    Fines, Transfers from Other Funds, Intergovernmental, Intragovernmental,
    Reimbursements, Use of Money and Property.

    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    text = page.extract_text() or ''

    # Page identification: must have revenue table with dollar amounts (not just TOC ref)
    if 'General Fund Revenues by Category' not in text:
        return []
    if 'Transient Occupancy' not in text:
        return []
    if '$' not in text:
        return []
    if 'TAX REVENUES' not in text:
        return []

    lines = text.split('\n')
    page_num = page.page_number

    results = []
    in_revenue_table = False

    # Section headers / total rows to skip
    skip_exact = {
        'General Fund Revenues by Category',
        'General Fund Budget Information • General Fund Revenues by Category',
        'TAX REVENUES',
        'Total Tax Revenues',
        'OTHER REVENUES',
        'Total Other Revenues and Financial Sources',
        'Total General Fund Sources',
        'TRANSFERS',
    }

    skip_prefixes = (
        'FY 20',
        'FY 2',
        'Actual',
        'Adopted',
        'Amended',
        'Net General Fund',
        'Less Transfers',
        'Total Transfers',
        'May not sum',
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if 'General Fund Revenues by Category' in stripped:
            in_revenue_table = True
            continue

        if not in_revenue_table:
            continue

        if stripped in skip_exact:
            continue

        if any(stripped.startswith(p) for p in skip_prefixes):
            continue

        if re.match(r'^[\d,\s\(\)\.\-\$%]+$', stripped):
            continue

        stripped_lower = stripped.lower()
        if stripped_lower.startswith('total') or stripped_lower.startswith('net'):
            continue

        # Stop at transfers section or footnotes
        if stripped.startswith('Less') or stripped.startswith('May not sum'):
            break

        # Skip separator lines
        if stripped.startswith('-') or stripped.startswith('='):
            continue

        if re.match(r'^\d{1,3}$', stripped):
            continue

        # All-caps = section header
        if re.match(r'^[A-Z\s]+$', stripped) and len(stripped) > 3:
            continue

        parsed = _extract_label_and_adopted(stripped)
        if parsed is None:
            continue

        label, amount = parsed

        if amount <= 0:
            print(f'  [skip] Revenue zero/neg: {label} = {amount}', file=sys.stderr)
            continue

        label_lower = label.lower()
        if label_lower.startswith('total') or label_lower.startswith('subtotal'):
            print(f'  [skip] Revenue total row: {label}', file=sys.stderr)
            continue

        if len(label) <= 2:
            continue

        # Clean up label: strip trailing '$' artifacts from PDF column alignment
        label = label.rstrip('$').strip()

        # Skip if label is now empty or too short after cleanup
        if len(label) <= 2:
            continue

        # Skip garbled/repeated-character text (PDF rendering artifacts for pie chart)
        # Pattern: char repeated 3+ times total (e.g., PPP, rrr, ooo) = triple-encoding
        if re.search(r'(.)\1{2,}', label):
            print(f'  [skip] Garbled PDF artifact: {label[:40]}', file=sys.stderr)
            continue

        results.append({
            'department': label,
            'fund': 'General Fund',
            'adopted_amount': amount,
            'fiscal_year': fiscal_year,
            'page_num': page_num,
        })
        print(f'  [revenue row] {label}: ${amount:,}', file=sys.stderr)

    return results


# ── Extract budget data from PDF ──────────────────────────────────────────────
def extract_budget(pdf_path, mode='operating'):
    """
    Parse Anaheim Adopted Budget PDF.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    For mode='operating': extracts from "General Fund Expenditures by Function" page.
    For mode='revenue': extracts from "General Fund Revenues by Category" page.

    Both pages are GF-only in Anaheim's budget structure. Enterprise funds (Utilities,
    Convention/Sports, Golf) appear only on the citywide "Expenditures by Fund" page
    and are NEVER emitted by this extractor (D-06 extraction-time filter).
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print(f'  WARNING: Could not detect fiscal year from filename: {pdf_path}', file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if mode == 'operating':
                page_results = extract_operating_from_page(page, fiscal_year)
            else:
                page_results = extract_revenue_from_page(page, fiscal_year)

            if page_results:
                results.extend(page_results)
                # Found the target page — stop scanning
                break

    # Post-validation
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    if not results:
        print(f'  WARNING: No rows extracted from {pdf_path} (mode={mode})', file=sys.stderr)
        if mode == 'operating':
            print(f'  Check that the PDF contains "General Fund Expenditures by Function"', file=sys.stderr)
            print(f'  with "Police" and "Fire" on the same page.', file=sys.stderr)
        else:
            print(f'  Check that the PDF contains "General Fund Revenues by Category"', file=sys.stderr)
            print(f'  with "Transient Occupancy" on the same page.', file=sys.stderr)

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


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Anaheim budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                        help='Extract operating (expenditures) or revenue rows (default: operating).')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path, mode=args.mode)
    print(json.dumps(data, indent=2))
