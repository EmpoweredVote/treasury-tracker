#!/usr/bin/env python3
"""
Fresno CA Budget PDF Extractor

Extracts General Fund department-level appropriations from Fresno Adopted Budget PDFs
using pdfplumber. Targets the "Appropriations Summary by Department/Primary Funding Source"
page, extracts only the "General Fund Departments" section, and stops before
"Special Revenue Fund Departments".

PDF structure (consistent FY2020-FY2026):
  - One summary page titled "Appropriations Summary by Department/Primary Funding Source"
  - Columns: Department | FY N-2 Actuals | FY N-1 Amended/Adopted | FY N Adopted | % Change
  - "General Fund Departments" section lists GF-funded departments as rows
  - Amounts are in FULL DOLLARS (verified: Police FY2025 = $284,481,700 matches PDF)

FY is derived from PDF filename:
  fy2025-adopted-budget.pdf -> FY 2025

Fund filter: Only "General Fund Departments" rows are extracted. Enterprise, Special Revenue,
and Internal Service Fund departments are not produced. This is the extraction-time filter
(D-04/D-06) — no enterprise rows are emitted at all.
Skipped non-GF rows are logged to stderr.

Amount scale: FULL DOLLARS (verified against FY2025 GF Departments subtotal ~$863M,
and FY2020 subtotal ~$485M — all within the confirmed $400M-$950M operating band).

Revenue: Not available in a cleanly separable General Fund format (deferred per D-07).
The revenue page groups by service category across all funds, not by fund type.

Usage:
  python scripts/extractFresno.py "docs/Fresno/fy2025-adopted-budget.pdf"
  python scripts/extractFresno.py "docs/Fresno/fy2025-adopted-budget.pdf" --mode operating

Security (T-30-05): PDF path from controlled docs/Fresno/ readdir, not user input.
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
    Extract fiscal year from Fresno budget filename.
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


# ── Parse a department row, return the Adopted (3rd numeric) value ────────────
def _extract_label_and_adopted(line):
    """
    Extract department label and the 'Adopted' (3rd integer column) from a row.

    Fresno department rows: Department Name | Actuals | Amended | Adopted | %Change
    % Change is a decimal (e.g. '8.8' or '(69.8)') — integers only are budget amounts.

    Returns (label, adopted_amount) or None.
    """
    # Normalize split numbers first: "4 2,374,186" -> "42,374,186"
    # Only non-zero leading digit: avoid joining "0 1,640,200" (two separate numbers)
    # into "01,640,200". Pattern requires leading digit [1-9] not 0.
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

    # The Adopted amount is the 3rd integer (if available), else the last integer.
    # Format: Actuals | Amended | Adopted | %Change(decimal, skipped)
    if len(int_matches) >= 3:
        adopted = int_matches[2].group()  # 3rd integer = Adopted
    else:
        adopted = int_matches[-1].group()  # fallback: last integer

    value = parse_money(adopted)
    return (label, value)


# ── Extract budget rows from a "Appropriations Summary by Department" page ────
def extract_from_page(page, fiscal_year, mode='operating'):
    """
    Extract General Fund department rows from the Appropriations Summary by
    Department/Primary Funding Source page.

    Only extracts rows in the "General Fund Departments" section.
    Stops at "Special Revenue Fund Departments" boundary.
    Non-GF rows (enterprise, special revenue, internal service) are never produced —
    logged to stderr when the section boundary is hit (D-04/D-06 extraction-time filter).

    mode='operating' is the only supported mode; revenue is deferred per D-07.

    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    if mode != 'operating':
        return []

    text = page.extract_text() or ''

    # Page identification: must contain the appropriations summary by department header
    if 'Appropriations Summary' not in text:
        return []
    if ('Department/Primary Funding Source' not in text and
            'Primary Funding Source' not in text):
        return []
    # Must have General Fund department section
    if 'General Fund Departments' not in text:
        return []

    lines = text.split('\n')
    page_num = page.page_number

    results = []
    in_gf_section = False

    # Prefixes for lines to skip regardless of section
    skip_prefixes = (
        'Appropriations Summary',
        'Department/Primary Funding Source',
        'Including Operating',
        'The total budget',
        'Net City budget',
        'Total Net City Budget',
        'Less:',
        'Subtotal',
        'Note ',
        '% Change',
        'FY 20',
        'FY 2',
        'General Fund Departments',
        'Special Revenue Fund',
        'Internal Service Fund',
        'Enterprise Fund',
        'Public Protection',
        'General Government',
        'Public Ways',
        'Culture and',
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Detect section entry (exact match to avoid false positives)
        if stripped == 'General Fund Departments':
            in_gf_section = True
            continue

        # Stop at any other fund section — log as non-GF boundary
        if in_gf_section and any(stripped.startswith(s) for s in [
            'Special Revenue Fund',
            'Internal Service Fund',
            'Enterprise Fund',
            'Net City Budget',
            'Total Net City',
            'Less: ',
        ]):
            print(f'  [skip] Non-GF section boundary reached: {stripped[:60]}', file=sys.stderr)
            break

        if not in_gf_section:
            continue

        # Skip header / total / separator lines
        if any(stripped.startswith(p) for p in skip_prefixes):
            continue
        if stripped.startswith('-') or stripped.startswith('='):
            continue

        # Skip lines with only numbers / punctuation (column headers, page footers)
        if re.match(r'^[\d,\s\(\)\.\-]+$', stripped):
            continue

        # Skip "Subtotal" rows
        if stripped.lower().startswith('subtotal'):
            continue

        parsed = _extract_label_and_adopted(stripped)
        if parsed is None:
            continue

        label, amount = parsed

        # Skip zero amounts (some departments show 0 in certain years)
        if amount <= 0:
            print(f'  [skip] Non-GF row excluded (zero/neg): {label} = {amount}', file=sys.stderr)
            continue

        # Skip if label looks like a total/section header
        if label.lower().startswith('total') or label.lower().startswith('subtotal'):
            print(f'  [skip] Total/subtotal row: {label}', file=sys.stderr)
            continue

        # Skip if label is too short
        if len(label) <= 2:
            continue

        # Emit the department row (General Fund only — extraction-time filter D-04/D-06)
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
    Parse Fresno Adopted Budget PDF.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    Extracts from the "Appropriations Summary by Department/Primary Funding Source" page.
    Only General Fund Departments rows are emitted (enterprise/special revenue excluded
    at extraction time per D-04/D-06).

    mode: 'operating' is the only supported mode (revenue deferred per D-07).
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print(f'  WARNING: Could not detect fiscal year from filename: {pdf_path}', file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_results = extract_from_page(page, fiscal_year, mode=mode)
            if page_results:
                results.extend(page_results)
                # Found the summary page — no need to scan more pages
                break

    # Post-validation
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    if not results:
        print(f'  WARNING: No rows extracted from {pdf_path}', file=sys.stderr)
        print(f'  Check that the PDF contains "Appropriations Summary by"', file=sys.stderr)
        print(f'  and "Department/Primary Funding Source" + "General Fund Departments"', file=sys.stderr)

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
    parser = argparse.ArgumentParser(description='Fresno budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                        help='Extract operating (expenditures) rows (default: operating). '
                             'Revenue mode is deferred per D-07 -- returns empty results.')
    args = parser.parse_args()

    if args.mode == 'revenue':
        print('  INFO: Revenue extraction is deferred for Fresno (D-07).', file=sys.stderr)
        print('  The Fresno PDF revenue page groups by service category across all funds,', file=sys.stderr)
        print('  not by fund type. No clean General Fund revenue section available.', file=sys.stderr)
        print(json.dumps([]))
        sys.exit(0)

    data = extract_budget(args.pdf_path, mode=args.mode)
    print(json.dumps(data, indent=2))
