#!/usr/bin/env python3
"""
Oakland Budget PDF Extractor

Extracts department-level GPF (General Purpose Fund) expenditure data from
Oakland biennial Adopted Policy Budget PDFs using pdfplumber.

Oakland's PDF contains a "Summary Table By Fund" section with a definitive list
of departmental appropriations by fund. Fund FD_1010 = General Purpose Fund.
This provides clean, authoritative per-department GPF amounts for both biennial FYs.

The extractor scans all pages in the "Fund Summary" section, collecting all
"General Funds FD_1010" rows. Department names may wrap to preceding lines.

Amount scale: Oakland PDFs express amounts in FULL DOLLARS (not thousands).
Emits raw parsed integers — no scale conversion needed in processor.

Usage:
  python scripts/extractOakland.py "docs/Oakland/fy2023-25-adopted-budget.pdf"
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


# ── Detect biennial FY years from PDF filename ────────────────────────────────
def detect_biennial_fys(pdf_path):
    """
    Detect the two adopted fiscal years from the PDF filename.
    fy2023-25-adopted-budget.pdf -> (2024, 2025)
    fy2024-25-midcycle-adopted-budget.pdf -> (2024, 2025)
    fy2021-23-adopted-budget.pdf -> (2022, 2023)
    Returns (fy_biennial_1, fy_biennial_2) tuple.
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    m = re.search(r'fy(\d{4})-(\d{2,4})', fname)
    if m:
        start_year = int(m.group(1))
        end_suffix = m.group(2)
        end_year = ((start_year // 100) * 100 + int(end_suffix)) if len(end_suffix) == 2 \
                   else int(end_suffix)
        return (start_year + 1, end_year)
    return (None, None)


# ── Detect FY columns from "FUND SUMMARY" table header text ───────────────────
def detect_fy_from_header(text):
    """
    Parse FY columns from the fund summary table header.

    FY2023-25 biennial PDF header:
      "Fund Group Fund Department FY23-24 Biennial FY24-25 Biennial"
      -> (2024, 2025)

    FY2024-25 midcycle PDF header:
      "Fund Group Fund Department FY24-25 Biennial Adopted Total FY24-25 Midcycle Adopted Total"
      -> (2025, 2025) — same FY, two different amendment levels

    Returns (fy1, fy2) or (None, None).
    """
    # Standard biennial: two distinct FY columns
    matches = re.findall(r'FY(\d{2})-(\d{2})\s+Biennial', text)
    if len(matches) >= 2:
        fy_vals = [2000 + int(m[1]) for m in matches[:2]]
        # If both columns are the same FY (midcycle), return (fy, fy)
        return (fy_vals[0], fy_vals[1])
    if len(matches) == 1:
        fy1 = 2000 + int(matches[0][1])
        return (fy1, fy1 + 1)

    # Midcycle: "FY24-25 Biennial Adopted Total" and "FY24-25 Midcycle Adopted Total"
    m_midcycle = re.search(r'FY(\d{2})-(\d{2})\s+(?:Biennial|Midcycle)\s+Adopted', text)
    if m_midcycle:
        fy = 2000 + int(m_midcycle.group(2))
        return (fy, fy)

    return (None, None)


# ── Find the Fund Summary start page ─────────────────────────────────────────
def find_fund_summary_page(pdf, max_scan=400):
    """
    Scan up to max_scan pages to find the "FUND SUMMARY" section.
    Returns (start_page_idx, end_page_idx) or (None, None).
    Oakland FY2023-25 PDF: Fund Summary ~pages 239-241 (0-indexed)
    Oakland FY2024-25 midcycle PDF: Fund Summary ~pages 273-280 (0-indexed)
    """
    found_start = None
    for i in range(min(max_scan, len(pdf.pages))):
        text = pdf.pages[i].extract_text() or ''
        if ('FUND SUMMARY' in text or 'Summary Table By Fund' in text) and 'FD_' in text:
            found_start = i
            break
        elif ('FUND SUMMARY' in text or 'Summary Table By Fund' in text) and found_start is None:
            # Found the intro page; data starts on next page
            found_start = i

    if found_start is None:
        return None, None

    # Find the end: look for the grand total line or "SPECIAL REVENUE FUNDS" without FD_1010
    for i in range(found_start, min(found_start + 20, len(pdf.pages))):
        text = pdf.pages[i].extract_text() or ''
        if re.search(r'^\$1[,\d]+\s+\$1[,\d]+', text, re.MULTILINE):
            return found_start, i + 1
        if i > found_start + 5 and 'FD_1010' not in text and 'GENERAL FUNDS' not in text:
            if 'CAPITAL PROJECT' in text or 'ESTIMATED' in text or 'Departmental Summaries' in text:
                return found_start, i

    return found_start, min(found_start + 15, len(pdf.pages))


# ── Extract all FD_1010 rows from the Fund Summary section ───────────────────
def extract_budget(pdf_path):
    """
    Walk the "Summary Table By Fund" section in the PDF.
    Collect all "General Funds FD_1010" rows for the biennial FY columns.

    For speed: first locates the Fund Summary section (typically within first
    300 pages), then only processes those pages (~3-15 pages total).

    Returns list of dicts:
      { department, fund, adopted_amount, fiscal_year, page_num }
    All rows have fund = "General Purpose Fund" (D-06 invariant).
    """
    fy1, fy2 = detect_biennial_fys(pdf_path)
    results = []

    # Collect lines from the fund summary section across pages
    all_lines = []
    page_nums = {}  # line_index -> page_num
    in_fund_summary = False

    with pdfplumber.open(pdf_path) as pdf:
        # Fast-path: locate Fund Summary section first
        summary_start, summary_end = find_fund_summary_page(pdf)
        if summary_start is None:
            print('  WARNING: Fund Summary section not found in PDF', file=sys.stderr)
            return []

        for page_idx in range(summary_start, summary_end):
            page = pdf.pages[page_idx]
            text = page.extract_text()
            if not text:
                continue

            page_num = page_idx + 1

            # Detect entry into fund summary section (in case start page is intro only)
            if 'FUND SUMMARY' in text or 'Summary Table By Fund' in text or 'FD_1010' in text:
                in_fund_summary = True

            if not in_fund_summary:
                continue

            # Detect and refine FY columns from the table header
            if 'FY' in text and ('Biennial' in text or 'Adopted' in text):
                detected_fy1, detected_fy2 = detect_fy_from_header(text)
                if detected_fy1 and not fy1:
                    fy1 = detected_fy1
                if detected_fy2 and not fy2:
                    fy2 = detected_fy2

            # Collect lines from this page
            for line in text.split('\n'):
                line = line.strip()
                if line:
                    page_nums[len(all_lines)] = page_num
                    all_lines.append(line)

            # Stop after passing the General Funds section
            if re.search(r'^\$1[,\d]+\s+\$1[,\d]+', text, re.MULTILINE):
                break

    if not fy1:
        print('  WARNING: Could not detect biennial FY columns from PDF', file=sys.stderr)
        return []

    if not fy2:
        fy2 = fy1 + 1

    # Now parse the collected lines to extract FD_1010 rows
    # Pattern: lines like "General Funds FD_1010 DeptName $amt1 $amt2"
    # OR: previous line has dept name prefix, then "General Funds FD_1010 SufixName $amt1 $amt2"
    i = 0
    prev_line = ''
    while i < len(all_lines):
        line = all_lines[i]
        p_num = page_nums.get(i, 0)

        if 'FD_1010' in line and 'General Funds' in line:
            # Extract the part after "FD_1010"
            rest = re.sub(r'^.*?FD_1010\s*', '', line).strip()

            # Try to parse: "DeptSuffix $amt1 $amt2"
            m = re.match(r'^(.+?)\s+(-?\$?[\d,]+)\s+(-?\$?[\d,]+)\s*$', rest)
            if m:
                dept_suffix = m.group(1).strip()
                amt1 = parse_money(m.group(2))
                amt2 = parse_money(m.group(3))

                # Build full dept name: prev_line (if it's a name prefix) + suffix
                # A line is a "name prefix" if it doesn't contain FD_, Fund, $, or digits
                dept = _build_dept_name(prev_line, dept_suffix)
            else:
                # No amounts on this line — amounts might be on the next line
                # rest is the entire dept name (possibly including line-break suffix)
                dept_parts = [rest] if rest else []
                j = i + 1
                amt1 = amt2 = 0
                while j < len(all_lines):
                    next_line = all_lines[j]
                    m2 = re.match(r'^(-?\$?[\d,]+)\s+(-?\$?[\d,]+)\s*$', next_line)
                    if m2:
                        amt1 = parse_money(m2.group(1))
                        amt2 = parse_money(m2.group(2))
                        i = j  # advance past the amounts line
                        break
                    elif 'FD_' in next_line or 'Fund Group' in next_line:
                        break  # next entry, no amounts found
                    else:
                        dept_parts.append(next_line.strip())
                    j += 1

                dept_suffix = ' '.join(dept_parts).strip() if dept_parts else 'Unknown'
                dept = _build_dept_name(prev_line, dept_suffix)

            # Skip zero or header rows
            if dept and (amt1 > 0 or amt2 > 0):
                # Clean up dept name
                dept = _clean_dept_name(dept)

                if fy1 == fy2:
                    # Midcycle PDF: both columns are the same FY.
                    # Use the SECOND column (midcycle adopted) as authoritative.
                    # If amt2 is 0 (some entries only have col1), fall back to amt1.
                    canonical_amt = amt2 if amt2 > 0 else amt1
                    results.append({
                        'department':     dept,
                        'fund':           'General Purpose Fund',
                        'adopted_amount': canonical_amt,
                        'fiscal_year':    fy1,
                        'page_num':       p_num,
                    })
                else:
                    # Biennial PDF: two distinct FY columns.
                    if amt1 > 0:
                        results.append({
                            'department':     dept,
                            'fund':           'General Purpose Fund',
                            'adopted_amount': amt1,
                            'fiscal_year':    fy1,
                            'page_num':       p_num,
                        })
                    if amt2 > 0:
                        results.append({
                            'department':     dept,
                            'fund':           'General Purpose Fund',
                            'adopted_amount': amt2,
                            'fiscal_year':    fy2,
                            'page_num':       p_num,
                        })

        # Only update prev_line for non-FD_ lines that look like dept name prefixes
        if 'FD_' not in line and 'Fund Group' not in line and not re.match(r'^\$', line):
            if re.match(r'^[A-Z][a-zA-Z\s,&/\-]+$', line) and len(line) < 60:
                prev_line = line
            else:
                prev_line = ''
        else:
            prev_line = ''

        i += 1

    # Post-validation
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


# ── Build full department name from prefix line and suffix ────────────────────
def _build_dept_name(prev_line, suffix):
    """
    Combine a prefix line (if it looks like a dept name prefix) with the suffix
    from the FD_1010 row.

    E.g.: prev_line="Human Resources", suffix="Management Department"
    -> "Human Resources Management Department"
    """
    prev = prev_line.strip() if prev_line else ''

    # Only use prev_line as prefix if it's a plausible dept name prefix
    # (not a table header, not numbers, not a fund label)
    skip_prefixes = {'Fund Group Fund Department', 'GENERAL FUNDS', 'SPECIAL REVENUE FUNDS',
                     'ENTERPRISE FUNDS', 'CAPITAL PROJECT FUNDS', 'INTERNAL SERVICE FUNDS',
                     'FUND SUMMARY', 'General Funds'}
    if prev and prev not in skip_prefixes and not re.match(r'^\$', prev):
        # If suffix starts with something that looks like it's a continuation
        # (like "Department", "Standards", etc.), combine them
        return (prev + ' ' + suffix).strip()

    return suffix.strip()


# ── Clean up department name ─────────────────────────────────────────────────
def _clean_dept_name(name):
    """Remove artifacts from department names."""
    # Remove trailing fund codes
    name = re.sub(r'\s+FD_\w+.*$', '', name)
    # Remove leading/trailing whitespace
    name = name.strip()
    # Collapse multiple spaces
    name = re.sub(r'\s+', ' ', name)
    return name


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Oakland budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
