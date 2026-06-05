#!/usr/bin/env python3
"""
Riverside CA Budget PDF Extractor

Extracts department-level General Fund expenditure data from City of Riverside
biennial Adopted Budget PDFs using pdfplumber.

Riverside's biennial PDFs present each department's budget in its own section.
Each department has a "Budget Summary by Fund" table (or equivalent summary)
listing totals by fund. This extractor scans department sections for
"101 - General Fund" rows in those tables.

Each biennial PDF covers two fiscal years (the two "Adopted" columns):
  fy2024-26-adopted-budget.pdf -> FY2024/25 + FY2025/26 -> (2025, 2026)
  fy2022-24-adopted-budget.pdf -> FY2022/23 + FY2023/24 -> (2023, 2024)

Amount scale: Riverside PDFs express amounts in FULL DOLLARS (not thousands).
Emits raw parsed integers -- no scale conversion needed in processor.

Enterprise/proprietary funds (RPU Electric, Water, Sewer, Airport, Refuse, etc.)
are excluded at extraction time (D-05/D-06). The Public Utilities Department
(electric/water/sewer) sections lack a standard "101 - General Fund" budget
line in their budget summaries.

Usage:
  python scripts/extractRiverside.py "docs/Riverside/fy2024-26-adopted-budget.pdf"
"""

import sys
import json
import re
import pdfplumber

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Parse dollar string like '$3,418,795' or '(1,234)' or '-' -> integer."""
    if s is None:
        return 0
    s = str(s).strip()
    if not s or s == '-' or s == '$0' or s == '$-' or s == '$ -':
        return 0
    neg = s.startswith('(') or s.startswith('-$') or (
        s.startswith('-') and not s[1:2].startswith('$')
    )
    val = re.sub(r'[$()\s,]', '', s).lstrip('-')
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0


# ── Detect biennial FY years from PDF filename ────────────────────────────────
def detect_biennial_fys(pdf_path):
    """
    Detect the two adopted fiscal years from the PDF filename.

    Riverside FY convention: FY XXXX/YY means the fiscal year that starts
    July 1 of XXXX and ends June 30 of (XXXX+1). We store it as (XXXX+1).

    fy2024-26-adopted-budget.pdf -> (2025, 2026)  [FY2024/25 and FY2025/26]
    fy2022-24-adopted-budget.pdf -> (2023, 2024)  [FY2022/23 and FY2023/24]
    fy2018-20-adopted-budget.pdf -> (2019, 2020)  [FY2018/19 and FY2019/20]

    Returns (fy_biennial_1, fy_biennial_2) tuple as 4-digit integers.
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    m = re.search(r'fy(\d{4})-(\d{2,4})', fname)
    if m:
        start_year = int(m.group(1))
        end_suffix = m.group(2)
        end_year = ((start_year // 100) * 100 + int(end_suffix)) if len(end_suffix) == 2 \
                   else int(end_suffix)
        # first adopted FY = start_year + 1, second = end_year
        return (start_year + 1, end_year)
    return (None, None)


# ── Detect the column years from a table header line ─────────────────────────
def detect_column_fys_from_header(text):
    """
    Parse the FY column headers from a budget summary page.

    Looks for a dedicated header line like:
    "FY 2021/22 FY 2022/23 FY 2023/24 FY 2024/25 FY 2025/26 Note"
    Returns the last two FY years (which are the Adopted columns).

    Returns (fy1, fy2) or (None, None) if not found.
    """
    for line in text.split('\n'):
        line = line.strip()
        # A header line has multiple consecutive FY patterns
        matches = re.findall(r'FY\s+(\d{4})/(\d{2})', line)
        if len(matches) >= 4:
            # Convert "FY 2024/25" -> 2025 (the ending year of the FY)
            fy_years = [2000 + int(m[1]) if int(m[1]) < 50 else 1900 + int(m[1])
                        for m in matches]
            # The last two are the Adopted columns
            return (fy_years[-2], fy_years[-1])
    return (None, None)


# ── Normalize department name ─────────────────────────────────────────────────
def _normalize_dept_name(name):
    """Convert ALL-CAPS header text to Title Case department name."""
    if not name:
        return 'Unknown'
    name = name.strip()
    # Normalize special characters (curly apostrophes, etc.)
    name = name.replace('’', "'").replace('‘', "'").replace('�', "'")
    # Convert all-caps to title case
    if name == name.upper() and len(name) > 3:
        name = name.title()
        # Fix common abbreviations that get mis-cased
        name = re.sub(r'\bAnd\b', 'and', name)
        name = re.sub(r'\b&\b', '&', name)
        name = re.sub(r'\bOf\b', 'of', name)
        name = re.sub(r'\bThe\b', 'the', name)
    name = re.sub(r'\s+', ' ', name)
    return name


# ── Extract dollar amounts from a GF table row line ──────────────────────────
def extract_gf_amounts(line):
    """
    Extract dollar amounts from a "101 - General Fund $ X $ X $ X $ X $ X" line.

    Handles:
    - Full amounts:   "$123,456,789"
    - Zero dashes:    "$-" or "$ -" or "-"
    - Negatives:      "(123,456)"
    - Note numbers:   trailing "1" or "1, 2, 3" after amounts

    Returns a list of integers (all amounts on the line, left to right).
    """
    # Remove the "101 - General Fund" prefix
    rest = re.sub(r'^.*?101\s*-\s*General Fund\s*', '', line)

    # Split by "$" to get individual amount tokens
    # Each "$" introduces an amount; also handle cases where "-" stands alone
    amounts = []

    # Find all $ + amount patterns (including $ -)
    tokens = re.findall(r'\$\s*(-|\([\d,]+\)|[\d,]+)', rest)
    for tok in tokens:
        amounts.append(parse_money(tok))

    return amounts


# ── Is this a budget summary page? ───────────────────────────────────────────
def is_budget_summary_page(text):
    """Return True if this page contains a department-level budget summary table."""
    return ('Budget Summary by Fund' in text or
            'Budget Summary by Expenditure Category' in text)


# ── Extract budget data from all department sections ──────────────────────────
def extract_budget(pdf_path):
    """
    Walk all department sections in the PDF.
    For each department's budget summary table, extract the
    "101 - General Fund" row and emit two rows (one per adopted FY).

    Returns list of dicts:
      { department, fund, adopted_amount, fiscal_year, page_num }
    All rows have fund = "General Fund" (D-05/D-06 invariant).
    """
    fy1_from_name, fy2_from_name = detect_biennial_fys(pdf_path)

    if not fy1_from_name:
        print('  WARNING: Could not detect biennial FY columns from PDF filename',
              file=sys.stderr)
        return []

    print(f'  Biennial FYs from filename: {fy1_from_name}, {fy2_from_name}',
          file=sys.stderr)

    results = []

    # Dept header patterns: these are the ALL-CAPS section titles
    # that appear as the second line after "City of Riverside ... Biennial Budget"
    DEPT_HEADER_RE = re.compile(
        r"^(?:"
        r"CITY (?:ATTORNEY|CLERK|COUNCIL|MANAGER)[''’\s]?"  # City offices
        r"|COMMUNITY (?:&|AND) ECONOMIC DEVELOPMENT"                  # CED
        r"|FINANCE(?:\s+DEPARTMENT)?"                           # Finance
        r"|FIRE(?:\s+DEPARTMENT)?"                              # Fire
        r"|GENERAL SERVICES(?:\s+DEPARTMENT)?"                  # General Services
        r"|HOUSING (?:&|AND) HUMAN SERVICES"                         # Housing
        r"|HUMAN RESOURCES(?:\s+DEPARTMENT)?"                   # HR
        r"|INNOVATION (?:&|AND) TECHNOLOGY"                          # I&T
        r"|MARKETING AND COMMUNICATIONS"                        # Marketing
        r"|MAYOR[''’\s]?S? OFFICE"                        # Mayor
        r"|MUSEUM OF RIVERSIDE"                                 # Museum
        r"|PARKS,? RECREATION"                                  # Parks
        r"|POLICE(?:\s+DEPARTMENT)?"                            # Police
        r"|PUBLIC LIBRARY"                                      # Library
        r"|PUBLIC WORKS(?:\s+DEPARTMENT)?"                      # Public Works
        r"|NON-DEPARTMENTAL"                                    # Non-Departmental
        r"|NON-CLASSIFIED"                                      # Non-Classified
        r").*$",
        re.IGNORECASE | re.UNICODE
    )

    # Enterprise fund departments to skip (D-05/D-06)
    ENTERPRISE_RE = re.compile(
        r'PUBLIC UTILITIES|ELECTRIC|WATER(?!.*GENERAL|.*GFT)|SEWER|AIRPORT|REFUSE|RPU',
        re.IGNORECASE
    )

    current_dept = 'Unknown'
    # Track which (dept, fy) pairs we've already emitted to avoid duplicates
    seen = set()

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)

        # Heuristic: department detail starts ~55% through the PDF
        # For a 585-page PDF: ~325; for 537-page: ~300
        # Start a bit earlier to catch any leading dept section pages
        scan_start = max(0, total_pages // 2 - 75)

        for page_idx in range(scan_start, total_pages):
            page = pdf.pages[page_idx]
            text = page.extract_text()
            if not text:
                continue

            page_num = page_idx + 1
            lines = [l.strip() for l in text.split('\n')]
            # Remove empty lines
            lines = [l for l in lines if l]

            # ── Detect department header ──────────────────────────────────────
            # Typical page structure:
            #   lines[0] = "City of Riverside YYYY-YYYY Biennial Budget"
            #   lines[1] = "DEPT NAME" (or sub-section name)
            if len(lines) >= 2 and 'City of Riverside' in lines[0]:
                candidate = lines[1]
                # Normalize curly apostrophes before matching
                candidate_norm = candidate.replace('’', "'").replace(
                    '‘', "'").replace('�', "'")

                if DEPT_HEADER_RE.match(candidate_norm):
                    if ENTERPRISE_RE.search(candidate_norm):
                        print(f'  [skip] Non-GF row excluded: '
                              f'Enterprise dept -- {candidate}', file=sys.stderr)
                    else:
                        new_dept = _normalize_dept_name(candidate)
                        if new_dept != current_dept:
                            current_dept = new_dept
                            print(f'  [dept] {current_dept} (page {page_num})',
                                  file=sys.stderr)

            # ── Only process budget summary pages ─────────────────────────────
            if not is_budget_summary_page(text):
                continue

            # Find the "101 - General Fund" line
            gf_line = None
            for line in lines:
                if '101 - General Fund' in line and '$' in line:
                    gf_line = line
                    break

            if not gf_line:
                # No GF line -- enterprise fund section or internal-service-only dept
                print(f'  [skip] Non-GF row excluded: No 101-GF line on page {page_num} '
                      f'(dept={current_dept}) -- enterprise or no-GF section',
                      file=sys.stderr)
                continue

            # Detect column FY headers from this page to validate alignment
            col_fy1, col_fy2 = detect_column_fys_from_header(text)
            if col_fy1 and col_fy2:
                # Use column-detected FYs if they match the filename-derived FYs
                # (some departments have shifted history -- skip those)
                if col_fy1 == fy1_from_name and col_fy2 == fy2_from_name:
                    fy1, fy2 = col_fy1, col_fy2
                elif col_fy2 < fy1_from_name:
                    # This page's column headers are for a prior biennial -- skip it
                    print(f'  [skip] Page {page_num} has prior-biennial columns '
                          f'({col_fy1}/{col_fy2} vs expected {fy1_from_name}/{fy2_from_name}) '
                          f'-- skipping', file=sys.stderr)
                    continue
                else:
                    # Use filename-derived FYs as fallback
                    fy1, fy2 = fy1_from_name, fy2_from_name
            else:
                fy1, fy2 = fy1_from_name, fy2_from_name

            # Extract amounts from the GF line
            amounts = extract_gf_amounts(gf_line)

            if len(amounts) < 4:
                print(f'  WARNING: page {page_num} GF line has {len(amounts)} amounts '
                      f'(need >=4): {gf_line!r}', file=sys.stderr)
                continue

            # Columns: [FY-2 Actual, FY-1 Actual, FY0 Actual, FY1 Adopted, FY2 Adopted]
            amt1 = amounts[3]   # Fourth amount = first adopted year (FY1)
            amt2 = amounts[4] if len(amounts) >= 5 else None  # Fifth = second adopted (FY2); None = not applicable

            dept = current_dept

            # Emit row for FY1
            key1 = (dept, fy1)
            if key1 not in seen:
                seen.add(key1)
                results.append({
                    'department':     dept,
                    'fund':           'General Fund',
                    'adopted_amount': amt1,
                    'fiscal_year':    fy1,
                    'page_num':       page_num,
                })
                print(f'  [row] dept={dept!r} fy={fy1} amount={amt1:,} page={page_num}',
                      file=sys.stderr)
            else:
                print(f'  [dedup] dept={dept!r} fy={fy1} page={page_num} -- '
                      f'already emitted', file=sys.stderr)

            # Emit row for FY2
            if fy2 and amt2 is not None:
                key2 = (dept, fy2)
                if key2 not in seen:
                    seen.add(key2)
                    results.append({
                        'department':     dept,
                        'fund':           'General Fund',
                        'adopted_amount': amt2,
                        'fiscal_year':    fy2,
                        'page_num':       page_num,
                    })
                    print(f'  [row] dept={dept!r} fy={fy2} amount={amt2:,} page={page_num}',
                          file=sys.stderr)
                else:
                    print(f'  [dedup] dept={dept!r} fy={fy2} page={page_num} -- '
                          f'already emitted', file=sys.stderr)

    # Post-validation: warn on None fiscal_year
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    return results


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Riverside CA budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
