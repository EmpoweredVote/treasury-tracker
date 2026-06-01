#!/usr/bin/env python3
"""
Gresham Budget PDF Extractor

Extracts department-level operating budget from the 'Resources and Requirements
- All Funds' page using pdfplumber text-line parsing (NOT extract_tables).

Amounts are in full dollars (no thousands multiplication).

Usage:
  python scripts/extractGresham.py "docs/Gresham/fy2025-26.pdf"
"""

import sys
import json
import re
import pdfplumber

# ── Rows to skip (totals, non-operating, and revenue/Resources lines) ──────────
SKIP_ROWS = {
    # Totals
    'Operating Total', 'Non-Operating Total', 'Total Requirements', 'Total Resources',
    # Non-operating requirements
    'Capital Improvement', 'Debt Service', 'Transfers', 'Contingency',
    'Other Requirements', 'Unappropriated',
    # Resources (revenue) rows — exclude from operating load
    'Taxes', 'Licenses & Permits', 'Intergovernmental', 'Charges for Services',
    'Utility License Fees', 'Miscellaneous Income', 'Internal Payments',
    'Interfund Transfers', 'Internal Svc Chrg', 'Internal Service Charges',
    'Financing Proceeds', 'Beginning Balance',
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

# ── Parse fiscal year from column header line ─────────────────────────────────
def parse_fy_from_header(header_line):
    """
    Parse fiscal year from column header line.
    Handles: '2022/23 2023/24 2024/25 2025/26 2025/26 2025/26'
             '2019/20 2020/2021 2021/2022 2022/2023 2022/2023 2022/2023'
    Returns ending year integer of the LAST pattern (= Adopted column).
    """
    # Match YYYY/YYYY (4+4) or YYYY/YY (4+2, not followed by digit)
    matches = re.findall(r'\d{4}/(?:\d{4}|\d{2})(?!\d)', header_line)
    if not matches:
        return None
    last = matches[-1]
    m4 = re.match(r'(\d{4})/(\d{4})', last)
    if m4:
        return int(m4.group(2))
    m2 = re.match(r'(\d{4})/(\d{2})', last)
    if m2:
        return int(m2.group(1)) // 100 * 100 + int(m2.group(2))
    return None

# ── Extract department-level operating budget from Gresham All Funds page ─────
def extract_budget(pdf_path):
    """
    Extract department-level operating budget from Gresham All Funds page.
    Uses page.extract_text() text-line parsing (NOT extract_tables() — that
    returns empty on Gresham's All Funds page).

    Returns list of: { department, adopted_amount, fiscal_year, page_num }
    Amounts are in full dollars (no multiply-by-1000).
    """
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
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
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                # Normalize OCR spacing before checking section marker
                # FY2022-23 has 'Requi rements' (OCR artifact) not 'Requirements'
                if re.sub(r'\s+', '', s) == 'Requirements':
                    in_requirements = True
                    continue
                if not in_requirements:
                    continue
                # Each data line: "Dept Name  num  num  num  num  num  ADOPTED"
                tokens = s.split()
                if len(tokens) < 2:
                    continue
                # Split: name tokens (no commas/dashes alone) vs number tokens
                # A token is numeric if it matches ^[\d,]+$ or equals '-'
                name_tokens = []
                num_tokens = []
                in_nums = False
                for t in tokens:
                    if not in_nums and (re.match(r'^[\d,]+$', t) or t == '-'):
                        in_nums = True
                    if in_nums:
                        num_tokens.append(t)
                    else:
                        name_tokens.append(t)
                # Need at least 6 numeric tokens (6 columns: actual, actual, revised,
                # proposed, approved, adopted) to be a valid department data row.
                # Footer lines like "FY 2025/26 Adopted Budget Page 11" only have 1 num.
                if not name_tokens or len(num_tokens) < 6:
                    continue
                dept = ' '.join(name_tokens)
                # Normalize OCR name artifacts (older PDFs have spaces mid-word)
                dept_normalized = re.sub(r'\s+', ' ', dept).strip()
                if dept_normalized in SKIP_ROWS:
                    continue
                # Adopted amount = last column (column 6 = Council Adopted).
                # OCR may split e.g. '61,494,586' into tokens ['6', '1,494,586'].
                # Detect this: if the second-to-last token is a short pure-digit fragment
                # (1-3 digits, no comma), concatenate it with the last token.
                adopted_raw = num_tokens[-1]
                if (len(num_tokens) >= 2
                        and re.match(r'^\d{1,3}$', num_tokens[-2])
                        and re.match(r'^\d', num_tokens[-1])):
                    adopted_raw = num_tokens[-2] + num_tokens[-1]
                adopted = parse_money(adopted_raw)
                if adopted <= 0:
                    print(f'  [skipped] Zero/negative amount: {dept_normalized}', file=sys.stderr)
                    continue
                results.append({
                    'department': dept_normalized,
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


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extractGresham.py <pdf_path>', file=sys.stderr)
        sys.exit(1)
    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
