#!/usr/bin/env python3
"""
Santa Ana CA Budget PDF Extractor

Extracts General Fund department-level appropriations from Santa Ana Adopted Budget PDFs
using pdfplumber. Targets the "City of Santa Ana General Fund Expenditure Summary" pages,
which present GF departments with account-unit-level detail and a "Subtotal" row per
department. The extractor reads department labels (header line) + the 4th numeric column
from each "Subtotal" row.

PDF structure (consistent FY2022-23 through FY2025-26 verified):
  - Pages titled "City of Santa Ana General Fund Expenditure Summary"
  - Columns: Acct. Unit | DEPARTMENT & DIVISION | FY N-3 Actual | FY N-2 Actual |
             FY N-1 Adopted | FY N Adopted (or "Proposed" for FY22-23 labeling quirk)
  - The 4th numeric column is the current FY Adopted amount
  - Each department section ends with a "Subtotal" row (that 4th value = dept total)
  - Amounts are in FULL DOLLARS (verified: Police FY2024-25 Subtotal = $162,545,030 matches PDF)
  - TOTAL GENERAL FUND USES FY2024-25 = $406,773,060 (~$407M)

FY is derived from PDF filename using multi-pattern detect:
  fy2025-adopted-budget.pdf  -> 2025  (ending year)
  fy25-26-something.pdf      -> 2026  (ending year, two-digit start + 1)
  /2024/path/file.pdf        -> 2025  (folder year + 1 fallback)

Fund filter: The "General Fund Expenditure Summary" pages are EXCLUSIVELY GF — Water,
Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, and Federal Clean
Water Protection enterprise funds appear on separate fund pages and NEVER appear on the
GF Expenditure Summary page. This is the extraction-time filter (D-06).

Revenue: "City of Santa Ana General Fund Revenue Summary" pages have clean GF-only revenue
by category. Extractable as "Total <CATEGORY>" rows (e.g., Total TAXES, Total FINES).

Usage:
  python scripts/extractSantaAna.py "docs/Santa Ana/fy2025-adopted-budget.pdf"
  python scripts/extractSantaAna.py "docs/Santa Ana/fy2025-adopted-budget.pdf" --mode revenue

Security (T-31-11): PDF path from controlled docs/Santa Ana/ readdir, not user input.
Security (T-31-09): Amount scale verified full dollars; toFullDollars not needed.
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
    Extract fiscal year (ending year) from Santa Ana budget filename.
    Santa Ana filenames are inconsistent (V6, V13, V26 version suffixes);
    use normalized fy-prefixed filenames saved by the download step.

    fy2025-adopted-budget.pdf      -> 2025 (ending year)
    fy25-26-budget-draft.pdf       -> 2026 (ending year: 25 + 1 = 26)
    fy2025-26-budget-draft.pdf     -> 2026 (ending year: 2025 + 1 = 2026)
    /2024/filename.pdf             -> 2025 (folder year + 1 fallback)
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()

    # Pattern 1: fy2025-26... or fy2024-25... (4-digit start year, dash, 2-4 digit end)
    m4_range = re.search(r'fy(\d{4})-(\d{2,4})', fname)
    if m4_range:
        # Return ending year: fy2024-25 -> 2025; fy2025-26 -> 2026
        start = int(m4_range.group(1))
        end_part = m4_range.group(2)
        if len(end_part) == 2:
            return start + 1  # FY2024-25 -> 2025
        else:
            return int(end_part)  # FY2024-2025 -> 2025

    # Pattern 2: fy2025- (4-digit single year — our normalized filename convention)
    m4 = re.search(r'fy(\d{4})-', fname)
    if m4:
        return int(m4.group(1))

    # Pattern 3: fy25-26 (two-digit start, two-digit end)
    m2_range = re.search(r'fy(\d{2})-(\d{2})', fname)
    if m2_range:
        return 2000 + int(m2_range.group(1)) + 1  # fy25-26 -> 2026

    # Pattern 4: fy25- (two-digit single year)
    m2 = re.search(r'fy(\d{2})-', fname)
    if m2:
        return 2000 + int(m2.group(1))

    # Fallback: look for year pattern in path components (e.g., /2024/file.pdf -> 2025)
    full_path = pdf_path.replace('\\', '/')
    m_year = re.search(r'/(20\d{2})/', full_path)
    if m_year:
        return int(m_year.group(1)) + 1  # folder year is FY start; ending year is +1

    return None


# ── Extract adopted amount from a "Subtotal" line (4th numeric column) ────────
def _extract_4th_numeric(line):
    """
    Extract the 4th integer value from a 'Subtotal' line (the current-FY Adopted amount).

    Santa Ana Subtotal rows: Subtotal | FY N-3 Actual | FY N-2 Actual | FY N-1 Adopted | FY N Adopted
    The 4th numeric column is the Adopted amount for the budget year.

    Returns integer or None.
    """
    # Normalize split numbers: "4 2,374,186" -> "42,374,186"
    normalized = re.sub(r'\b([1-9])\s+(\d{1,3}(?:,\d{3})+)', r'\1\2', line.strip())

    # Find numbers: integers and parenthesized negatives only (not decimals)
    num_pattern = re.compile(r'\(\d[\d,]*\)|\d[\d,]+')
    matches = list(num_pattern.finditer(normalized))

    # Filter to integer-only matches (exclude decimal % values)
    int_matches = [m for m in matches if '.' not in m.group()]

    if len(int_matches) < 1:
        return None

    # 4th integer (index 3) is the adopted amount; fall back to last if fewer columns
    if len(int_matches) >= 4:
        raw = int_matches[3].group()
    elif len(int_matches) >= 3:
        raw = int_matches[2].group()
    else:
        raw = int_matches[-1].group()

    return parse_money(raw)


# ── Extract operating rows from "General Fund Expenditure Summary" pages ──────
def extract_operating_from_pdf(pdf, fiscal_year):
    """
    Extract General Fund department subtotals from the GF Expenditure Summary pages.
    Each department has multiple account-unit rows followed by a "Subtotal" row.
    We emit one row per department using (label, subtotal_amount).

    The GF Expenditure Summary pages are exclusively GF — enterprise funds
    (Water, Sewer, Refuse, Sanitation, Parking, Transportation Center, Federal Clean
    Water Protection) appear on separate fund pages and are NEVER present here.

    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    results = []
    pending_label = None  # last department header label seen
    in_gf_summary = False

    # Skip labels that are not real departments
    skip_labels = {
        'City of Santa Ana, California',
        'City of Santa Ana General Fund Expenditure Summary',
        'General Fund Expenditure Summary',
        'Acct. Unit',
        'DEPARTMENT & DIVISION',
        'ACTUAL',
        'ADOPTED',
        'PROPOSED',
        'Table of Contents',
        'General Fund Budget Information',
    }

    # Skip prefixes for column header rows
    skip_prefixes = (
        'FY ', 'ACTUAL', 'ADOPTED', 'PROPOSED', 'Table of',
        'Acct.', 'DEPARTMENT',
    )

    # Words/phrases that appear as line-wrapped continuations of account-unit detail rows.
    # These look like department headers but are NOT — they're the second line of a
    # wrapped label like "01114485 HOMELAND SECURITY & EMERGENCY\nMANAGEMENT" or
    # "01110131 FIN/MGMT SVS-MUNICIPAL UTILITY\nSERVICES".
    # Also includes page navigation footers like "Return To Table Of Contents".
    CONTINUATION_PATTERNS = re.compile(
        r'^(ENHANCEMENT|MANAGEMENT|ENHANCEMENTS?|Enhancement|'
        r'ENGINEERING-SERVICE ENHANCEMENT|ENGINEERING|'
        r'SERVICE ENHANCEMENT|Service Enhancement|Service Enhancements?|'
        r'SERVICES?|SERVICE|'
        r'Return To Table Of Contents|Table Of Contents)$',
        re.IGNORECASE
    )

    # Full-line skip patterns (exact match or startswith for known non-department lines)
    FULL_LINE_SKIPS = {
        'Return To Table Of Contents',
        'Return to Table of Contents',
    }

    # City/page header patterns to skip
    CITY_HEADER = re.compile(r'^City of Santa Ana', re.IGNORECASE)

    for page in pdf.pages:
        text = page.extract_text() or ''

        if 'General Fund Expenditure Summary' not in text:
            # If we were in a GF summary section, this signals end of it
            if in_gf_summary:
                in_gf_summary = False
                pending_label = None
            continue

        # This page is part of the GF Expenditure Summary
        in_gf_summary = True
        page_num = page.page_number
        lines = text.split('\n')

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Skip the page header and section header
            if 'General Fund Expenditure Summary' in stripped:
                continue

            # Skip city/page header (e.g., "City of Santa Ana, California Budget Overview...")
            if CITY_HEADER.match(stripped):
                continue

            # Skip full-line page navigation footers
            if stripped in FULL_LINE_SKIPS:
                continue

            # Skip column header rows
            if stripped in skip_labels:
                continue
            if any(stripped.startswith(p) for p in skip_prefixes):
                continue

            # "Subtotal" row: emit a row using the pending department label
            if stripped.startswith('Subtotal'):
                if pending_label:
                    amount = _extract_4th_numeric(stripped)
                    if amount and amount > 0:
                        results.append({
                            'department': pending_label,
                            'fund': 'General Fund',
                            'adopted_amount': amount,
                            'fiscal_year': fiscal_year,
                            'page_num': page_num,
                        })
                        print(f'  [row] {pending_label}: ${amount:,}', file=sys.stderr)
                    else:
                        print(f'  [skip] Subtotal has no valid amount for: {pending_label}',
                              file=sys.stderr)
                    pending_label = None  # consumed
                else:
                    # Library subtotal appears at top of page 70 (page break mid-section).
                    # The Library label was set on page 69 and carried over.
                    print(f'  [skip] Subtotal without pending label: {stripped[:60]}',
                          file=sys.stderr)
                continue

            # "TOTAL GENERAL FUND USES" signals end of GF department section.
            # NOTE: "TOTAL GENERAL FUND EXPENDITURES" appears in older PDFs (FY2022-23)
            # BEFORE the Interfund Transfers section — do NOT stop there, only at USES.
            if 'TOTAL GENERAL FUND USES' in stripped:
                print(f'  [stop] Found TOTAL GENERAL FUND USES: {stripped[:60]}', file=sys.stderr)
                pending_label = None
                break

            # "TOTAL GENERAL FUND EXPENDITURES" in FY2022-23 PDF is NOT the final stop —
            # Interfund Transfers appears after it. Skip this line as a total/summary row.
            if 'TOTAL GENERAL FUND EXPENDITURES' in stripped:
                print(f'  [skip] Intermediate total (not final stop): {stripped[:60]}',
                      file=sys.stderr)
                pending_label = None  # reset label; Interfund will be next department
                continue

            # Account unit rows: start with 8-digit code like "01103010 CITY MANAGER ..."
            # These are detail rows under a department — skip, we use Subtotal for totals
            if re.match(r'^\d{8}\s+', stripped):
                continue

            # Skip rows that are purely numeric (amounts with no label)
            if re.match(r'^[\d,\s\(\)\.\-]+$', stripped):
                continue

            # Skip single-digit or two-digit page numbers
            if re.match(r'^\d{1,3}$', stripped):
                continue

            # Skip garbled repeated-character text (PDF rendering artifacts)
            if re.search(r'(.)\1{2,}', stripped) and len(stripped) < 20:
                print(f'  [skip] Garbled artifact: {stripped[:40]}', file=sys.stderr)
                continue

            # Skip continuation words from wrapped account-unit labels
            # These are line-wrapped tails of lines like:
            #   "01114485 HOMELAND SECURITY & EMERGENCY\nMANAGEMENT"
            # They look like department headers but are NOT.
            if CONTINUATION_PATTERNS.match(stripped):
                print(f'  [skip] Continuation word: {stripped}', file=sys.stderr)
                continue

            # This line is a department section header (e.g., "City Manager", "Police Department")
            # It must not start with a digit and must have some alphabetic content.
            # Handle multi-line labels like "Interfund\nTransfers" (FY2022-23 structure):
            # if the previous pending_label was a single word and the current line is also
            # a single word continuation (no digits, no spaces with numbers), merge them.
            if re.search(r'[A-Za-z]', stripped) and not stripped[0].isdigit():
                # Avoid picking up column header lines that slipped through
                if len(stripped) > 2 and stripped not in skip_labels:
                    # Check if this looks like a continuation of a split label:
                    # previous label was a single word (no spaces, no digits) and
                    # current word also has no digits — merge them.
                    if (pending_label and
                            ' ' not in pending_label and
                            not re.search(r'\d', pending_label) and
                            not re.search(r'\d', stripped) and
                            stripped not in ('Fund', 'Department', 'Services', 'Agency',
                                             'Center', 'Works', 'Development', 'Building') and
                            pending_label not in ('Library', 'Police', 'Fire', 'Museum')):
                        # This is a multi-line label split — merge
                        pending_label = pending_label + ' ' + stripped
                        print(f'  [label merge] {pending_label}', file=sys.stderr)
                    else:
                        pending_label = stripped
                        print(f'  [label] {pending_label}', file=sys.stderr)

    return results


# ── Extract revenue rows from "General Fund Revenue Summary" pages ────────────
def extract_revenue_from_pdf(pdf, fiscal_year):
    """
    Extract General Fund revenue category totals from GF Revenue Summary pages.
    Rows follow the pattern: "Total <CATEGORY>" with 4 columns (same layout as expenditures).
    The 4th column is the current FY Adopted amount.

    Revenue categories: CHARGES FOR SERVICES, FINES, FRANCHISE FEES, INTERGOVERNMENTAL,
    LICENSES & PERMITS, MISCELLANEOUS, TAXES, TRANSFERS-IN, USE OF MONEY.

    Total General Fund Sources FY2024-25 = $406,527,340 (~$406.5M).

    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    results = []
    in_revenue_summary = False

    for page in pdf.pages:
        text = page.extract_text() or ''

        if 'General Fund Revenue Summary' not in text:
            if in_revenue_summary:
                in_revenue_summary = False
            continue

        in_revenue_summary = True
        page_num = page.page_number
        lines = text.split('\n')

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # "Total <CATEGORY>" rows are what we emit
            if re.match(r'^Total [A-Z]', stripped):
                # Skip "TOTAL GENERAL FUND SOURCES/USES/REVENUES" master totals
                if 'TOTAL GENERAL FUND' in stripped.upper() or 'Total GENERAL' in stripped:
                    print(f'  [stop] Revenue master total: {stripped[:60]}', file=sys.stderr)
                    break

                # Extract category name after "Total " — stop at first digit/comma
                # e.g., "Total CHARGES FOR SERVICES 17,933,843 ..." -> "CHARGES FOR SERVICES"
                m = re.match(r'^Total\s+([A-Z][A-Z\s&/-]+?)(?:\s+[\d,\(].*)?$', stripped)
                if not m:
                    # Fallback: take everything up to the first digit
                    m2 = re.match(r'^Total\s+(.+)', stripped)
                    if not m2:
                        continue
                    raw = m2.group(1)
                    # Strip trailing numbers
                    category_raw = re.sub(r'\s+[\d,\(\)\s]+$', '', raw).strip()
                else:
                    category_raw = m.group(1).strip()

                # Extract the 4th numeric value
                amount = _extract_4th_numeric(stripped)
                if amount and amount > 0:
                    results.append({
                        'department': category_raw,
                        'fund': 'General Fund',
                        'adopted_amount': amount,
                        'fiscal_year': fiscal_year,
                        'page_num': page_num,
                    })
                    print(f'  [revenue] {category_raw}: ${amount:,}', file=sys.stderr)
                continue

            # Also stop at TOTAL GENERAL FUND SOURCES
            if stripped.startswith('TOTAL GENERAL FUND'):
                print(f'  [stop] Revenue total: {stripped[:60]}', file=sys.stderr)
                break

    return results


# ── Extract budget data from PDF ──────────────────────────────────────────────
def extract_budget(pdf_path, mode='operating'):
    """
    Parse Santa Ana Adopted Budget PDF.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    For mode='operating': extracts department subtotals from GF Expenditure Summary pages.
    For mode='revenue': extracts category totals from GF Revenue Summary pages.

    Both page types are GF-only in Santa Ana's budget structure. Enterprise funds (Water,
    Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean
    Water Protection) appear only on separate enterprise fund pages and are NEVER emitted
    by this extractor (D-06 extraction-time filter).
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    if fiscal_year is None:
        print(f'  WARNING: Could not detect fiscal year from filename: {pdf_path}',
              file=sys.stderr)

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        if mode == 'operating':
            results = extract_operating_from_pdf(pdf, fiscal_year)
        else:
            results = extract_revenue_from_pdf(pdf, fiscal_year)

    # Post-validation
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    if not results:
        print(f'  WARNING: No rows extracted from {pdf_path} (mode={mode})',
              file=sys.stderr)
        if mode == 'operating':
            print(f'  Check that the PDF contains "General Fund Expenditure Summary"',
                  file=sys.stderr)
        else:
            print(f'  Check that the PDF contains "General Fund Revenue Summary"',
                  file=sys.stderr)

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
    parser = argparse.ArgumentParser(description='Santa Ana budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                        help='Extract operating (expenditures) or revenue rows (default: operating).')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path, mode=args.mode)
    print(json.dumps(data, indent=2))
