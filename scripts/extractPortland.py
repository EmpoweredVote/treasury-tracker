#!/usr/bin/env python3
"""
Portland Budget PDF Extractor

Supports three modes:
  operating    (default) — extracts bureau-level appropriation data from Vol 1 PDFs
  revenue                — extracts fund-level Resources Total from Vol 2 PDFs
  requirements           — extracts All Funds Requirements categories from Vol 1 PDFs

Usage:
  python scripts/extractPortland.py "docs/Portland/fy2025-26-vol1.pdf"
  python scripts/extractPortland.py "docs/Portland/fy2025-26-vol2.pdf" --mode revenue
  python scripts/extractPortland.py "docs/Portland/fy2025-26-vol1.pdf" --mode requirements
"""

import sys
import json
import re
import pdfplumber

# ── Money parsing ─────────────────────────────────────────────────────────────
def parse_money(s):
    """Parse dollar string like '39,394,224' or '(1,234)' → integer.
    Also handles Vol 2 garbled double-rendered artifact (e.g. '778899,,116666,,330066').
    """
    if s is None:
        return 0
    s = s.strip()
    if not s or s == '-':
        return 0
    if ',,' in s:
        # PDF rendering artifact: every digit doubled, commas doubled.
        # '778899,,116666,,330066' → '789,166,306'
        cleaned = s.replace(',,', ',')
        result = ''
        i = 0
        while i < len(cleaned):
            c = cleaned[i]
            if c.isdigit() and i + 1 < len(cleaned) and cleaned[i + 1] == c:
                result += c
                i += 2
            else:
                result += c
                i += 1
        s = result
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0

# ── Parse fiscal year from "FY 2025-26" → 2026 ───────────────────────────────
def parse_fy(token):
    """
    Portland uses "FY YYYY-YY" format (e.g. "FY 2025-26").
    Returns the ENDING year as an integer: "FY 2025-26" → 2026, "FY 2024-25" → 2025.
    Never returns a concatenated year like 202526.
    """
    # Match "FY 2025-26" or "FY 2024-25"
    m = re.search(r'FY\s+(\d{4})-(\d{2})', token)
    if m:
        century = int(m.group(1)) // 100 * 100  # e.g. 2000
        end_yy = int(m.group(2))                 # e.g. 26
        return century + end_yy                   # e.g. 2026
    return None

# ── Detect fiscal year from page text ─────────────────────────────────────────
def detect_fiscal_year(text):
    """Extract fiscal year from Appropriation Schedule page text."""
    m = re.search(r'Appropriation Schedule\s*-\s*(FY\s+\d{4}-\d{2})', text)
    if m:
        return parse_fy(m.group(1))
    # Fallback: search for any "FY YYYY-YY" pattern on the page
    m = re.search(r'FY\s+(\d{4})-(\d{2})', text)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None

# ── Check if a row is a bureau header (all numeric cols are None) ─────────────
def is_bureau_header(row):
    """Bureau header rows: col[0] is bureau name, all other cols are None/empty."""
    if not row or not row[0]:
        return False
    # Must have at least 5 columns
    if len(row) < 5:
        return False
    # All numeric columns (1 onwards) should be None or empty
    numeric_cols = [row[i] for i in range(1, len(row)) if i < len(row)]
    return all(c is None or (isinstance(c, str) and c.strip() == '') for c in numeric_cols)

# ── Check if a row is a bureau subtotal ──────────────────────────────────────
def is_subtotal_row(row):
    """Subtotal rows end with 'Subtotal' and have numeric data in col[5]."""
    if not row or not row[0]:
        return False
    name = row[0].replace('\n', ' ').strip()
    return name.endswith('Subtotal') or name.endswith('Total')

# ── Extract service area → bureau mapping from Vol 1 User's Guide table ──────
def extract_service_area_map(pdf):
    """
    Returns dict: { bureau_name: service_area_name }
    Reads the 'Managing Agency | Fund | Service Area | Fund Type' table
    from the User's Guide section of Portland Vol 1 PDF.
    Uses keyword search for 'Managing Agency' + 'Service Area' to locate
    the first (header) page, then also reads the immediate continuation page
    since the table spans two pages and the second page lacks the header keywords
    (Pitfall 1 guard — page range shifts across fiscal years).
    """
    service_map = {}
    current_bureau = None

    # Step 1: Find the header page (contains both 'Managing Agency' and 'Service Area')
    header_page_idx = None
    # Search pages 9-20 (0-indexed) — FY2025-26: header is on page 11 (0-indexed)
    for page_idx in range(9, min(20, len(pdf.pages))):
        text = pdf.pages[page_idx].extract_text() or ''
        if 'Managing Agency' in text and 'Service Area' in text:
            header_page_idx = page_idx
            break

    if header_page_idx is None:
        return service_map  # table not found; caller will warn via unmapped bureaus

    def _process_table_page(page_idx):
        """Process one page of the managing agency table, updating service_map."""
        nonlocal current_bureau
        page = pdf.pages[page_idx]
        tables = page.extract_tables()
        if not tables:
            return False
        table = tables[0]
        # Verify this looks like the right table (4+ columns)
        if not table or len(table[0]) < 3:
            return False
        for row in table:
            if not row or len(row) < 3:
                continue
            agency = (row[0] or '').strip()
            service_area = (row[2] or '').strip()
            # Skip header row values
            if service_area in ('Service Area', 'SERVICE AREA', ''):
                if agency:
                    current_bureau = agency
                continue
            # Skip '(blank)' service areas (Office of Vibrant Communities pattern)
            if service_area == '(blank)':
                if agency:
                    current_bureau = agency
                continue
            if agency and service_area:
                current_bureau = agency
                service_map[agency] = service_area
            elif not agency and current_bureau and service_area:
                # Continuation row: same bureau, different fund — preserve existing SA
                if current_bureau not in service_map:
                    service_map[current_bureau] = service_area
        return True

    # Step 2: Process the header page
    _process_table_page(header_page_idx)

    # Step 3: Process the continuation page (immediately follows; lacks header keywords)
    next_idx = header_page_idx + 1
    if next_idx < len(pdf.pages):
        _process_table_page(next_idx)

    return service_map


# ── Extract all bureau-level budget rows from one PDF ─────────────────────────
# Design: bureau subtotals only — fund-level rows are excluded.
# To add fund breakdown, see the fund detection logic in _inspect-portland-temp.py.
def extract_budget(pdf_path, service_area_map=None):
    """
    Walk the PDF pages looking for Appropriation Schedule pages.
    Extract bureau subtotal rows with: bureau name, service_area (from the
    User's Guide mapping table on pages 12-13), adopted_amount (Total
    Appropriation column), fiscal_year, page_num.

    service_area_map: optional dict { bureau_name: service_area } built from
    the User's Guide table. If None, it is built automatically via
    extract_service_area_map(). If a bureau is not found in the map,
    service_area defaults to '' (D-06: null collapse at loader level).

    Returns list of dicts: { bureau, service_area, adopted_amount, fiscal_year, page_num }
    """
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        # Build service area map from this PDF if not supplied
        if service_area_map is None:
            service_area_map = extract_service_area_map(pdf)
            print(f'  Service area map: {len(service_area_map)} bureaus', file=sys.stderr)
        current_bureau = None
        in_appropriation_schedule = False

        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue

            # Detect Appropriation Schedule pages
            if 'Appropriation Schedule' in text:
                in_appropriation_schedule = True
                # Try to detect fiscal year from this page
                fy = detect_fiscal_year(text)
                if fy:
                    fiscal_year = fy
            elif in_appropriation_schedule:
                # Check if we've moved past the Appropriation Schedule section
                # Pages after the schedule have different headers
                if any(kw in text for kw in [
                    'Summary of Bureau Expenses by Fund',
                    'Total Resources and Requirements',
                    'Operating and Capital Budget',
                    'Summary of Requirements by Service Area',
                ]):
                    in_appropriation_schedule = False
                    continue

            if not in_appropriation_schedule:
                continue

            tables = page.extract_tables()
            if not tables:
                continue

            # Each Appropriation Schedule page has exactly one table
            table = tables[0]
            if not table:
                continue

            for row in table:
                if not row or not row[0]:
                    continue

                # Normalize the name (remove embedded newlines from cell wrapping)
                name = row[0].replace('\n', ' ').strip()
                if not name:
                    continue

                # Skip the grand Total row at the bottom of the last page
                if name == 'Total':
                    print(f'  [skipped] Grand total row on page {page_num}', file=sys.stderr)
                    continue

                # Track current bureau from header rows
                if is_bureau_header(row):
                    current_bureau = name
                    continue

                # Capture bureau subtotal rows
                if is_subtotal_row(row):
                    if len(row) < 6:
                        print(f'  [skipped] Subtotal row too short ({len(row)} cols) on page {page_num}: {name}',
                              file=sys.stderr)
                        continue

                    adopted_amount = parse_money(row[5]) if row[5] else 0

                    # Skip zero-amount subtotals (e.g. Office of Vibrant Communities with $0 budget)
                    if adopted_amount == 0:
                        print(f'  [skipped] Zero-amount subtotal on page {page_num}: {name}',
                              file=sys.stderr)
                        continue

                    # Derive bureau name: strip " Subtotal" suffix
                    bureau_name = re.sub(r'\s*Subtotal\s*$', '', name).strip()
                    if not bureau_name:
                        print(f'  [skipped] Empty bureau name after strip on page {page_num}: {name}',
                              file=sys.stderr)
                        continue

                    # Validate: bureau name should not be purely numeric
                    if re.match(r'^\d[\d,.\s]*$', bureau_name):
                        print(f'  [skipped] Numeric bureau name on page {page_num}: {bureau_name}',
                              file=sys.stderr)
                        continue

                    results.append({
                        'bureau': bureau_name,
                        'service_area': service_area_map.get(bureau_name, ''),
                        'adopted_amount': adopted_amount,
                        'fiscal_year': fiscal_year,
                        'page_num': page_num,
                    })

    # Post-validation: warn about bureaus with no service_area mapping (mirrors none_fy pattern)
    unmapped = [r['bureau'] for r in results if not r['service_area']]
    if unmapped:
        print(f'  WARNING: {len(unmapped)} bureaus have no service_area mapping: {unmapped}',
              file=sys.stderr)

    # Post-validation: warn about any rows with None fiscal_year
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year — check PDF text for FY marker',
              file=sys.stderr)

    return results


# ── Strip doubled fund name artifact in older Vol 2 PDFs ─────────────────────
def _dedup_name(name):
    """Remove doubled fund name from older Portland Vol 2 PDFs.

    Older PDFs repeat the fund name in the header cell:
      'Water Fund Water Fund' → 'Water Fund'
      'Portland Clean Energy...FundPortland...' → 'Portland Clean Energy...Fund'
    Safe on normal names: only triggers on exact self-repetition.
    """
    n = len(name)
    # 'XX' pattern (no separator)
    if n % 2 == 0:
        half = n // 2
        if name[:half] == name[half:]:
            return name[:half]
    # 'X X' pattern (space separator at midpoint)
    mid = (n - 1) // 2
    space_idx = name.find(' ', mid)
    if space_idx > 0:
        first, rest = name[:space_idx], name[space_idx + 1:]
        if first == rest:
            return first
    return name

# ── Extract fund-level Resources Total from Vol 2 PDFs ───────────────────────
def extract_revenue(pdf_path):
    """
    Walk Vol 2 PDF pages looking for Fund Summary pages.
    Extract fund name + Resources Total (Adopted, col 6) from each fund.

    Returns list of dicts: { fund, resources_total, fiscal_year, page_num }
    """
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        # Fiscal year from cover page: "Fiscal Year 2025-26" → 2026
        cover_text = pdf.pages[0].extract_text() or ''
        m = re.search(r'Fiscal Year\s+(\d{4})-(\d{2})', cover_text, re.I)
        if m:
            century = int(m.group(1)) // 100 * 100
            fiscal_year = century + int(m.group(2))

        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Fund Summary' not in text or 'Resources Total' not in text:
                continue

            lines = [l.strip() for l in text.split('\n') if l.strip()]

            # Fund name: first line that is not a section header or cover label
            fund_name = None
            skip_patterns = re.compile(
                r'(Service Area Funds|City Funds|City of Portland|Table of Contents'
                r'|Fund Summary|^Resources$|FY \d{4})',
                re.I
            )
            for line in lines[:4]:
                if line and len(line) > 5 and not skip_patterns.search(line):
                    fund_name = _dedup_name(line)
                    break

            if not fund_name:
                print(f'  [skipped] No fund name found on page {page_num}', file=sys.stderr)
                continue

            # Find Resources Total row; Adopted is col 6
            res_total = None
            for table in page.extract_tables():
                if not table:
                    continue
                for row in table:
                    if not row or not row[0]:
                        continue
                    if row[0].strip() == 'Resources Total':
                        val = row[6] if len(row) > 6 else None
                        res_total = parse_money(val)
                        break
                if res_total is not None:
                    break

            if res_total is None:
                print(f'  [skipped] No Resources Total on page {page_num}: {fund_name}',
                      file=sys.stderr)
                continue

            results.append({
                'fund':            fund_name,
                'resources_total': res_total,
                'fiscal_year':     fiscal_year,
                'page_num':        page_num,
            })

    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    return results


# ── Skip set for All Funds Requirements extraction ───────────────────────────
# Row names in PORTLAND_REQUIREMENTS_SKIP are section headers, sum rows, or
# balance-sheet items that must not appear as expenditure categories.
# Security (T-23-02): PDF path from controlled docs/ readdir, not user input.
PORTLAND_REQUIREMENTS_SKIP = {
    'Resources', 'Requirements',
    'External Revenues', 'Internal Revenues',
    'Bureau Expenditures', 'Fund Expenditures',
    'Total External Revenues', 'Total Internal Revenues', 'Total Resources',
    'Less Intracity Transfers', 'Total NET Budget',
    'Total Bureau Expenditures', 'Total Fund Expenditures',
    'Total Requirements', 'Ending Fund Balance', 'Beginning Fund Balance',
}

# ── Detect fiscal year from the All Funds Resources/Requirements page ──────────
def _detect_fy_allfunds(text):
    """Detect fiscal year from the 'Total City Budget — Resources and Requirements' page.

    The page header area contains lines like:
      'Actuals Actuals Revised Propose d Adopte d'
      'FY 2022-23 FY 2023-24 FY 2024-25 FY 2025-26 FY 2025-26'

    The Adopted column is the LAST FY column, so we extract all FY matches and
    return the last one (rightmost = Adopted year).  detect_fiscal_year() returns
    the first match, which is always the first Actuals year — wrong for this page.
    """
    matches = re.findall(r'FY\s+(\d{4})-(\d{2})', text)
    if not matches:
        return None
    # Last match is the Adopted column FY
    start_str, end_str = matches[-1]
    century = int(start_str) // 100 * 100
    return century + int(end_str)

# ── Extract All Funds Requirements categories from Vol 1 PDFs ────────────────
def extract_requirements(pdf_path):
    """
    Walk Vol 1 PDF pages looking for 'Total City Budget — Resources and Requirements' page.
    Extracts expenditure category rows (Personnel Services, External/Internal Materials and
    Services, Capital Outlay, Debt Service, Contingency, Fund Transfers - Expense,
    Debt Service Reserves) from the table at Adopted column (index 5).

    Multi-page: FY2026 spans pages 116-117; accumulates rows across both pages.
    Uses page.extract_tables() (NOT text-line parsing — this page extracts cleanly).

    Page detection: 'Total City Budget' + 'Resources and Requirements' + 'Personnel Services'
    The 'Personnel Services' guard eliminates the Table-of-Contents false positive.

    Continuation page: found_data_page=True AND 'Total City Budget' + 'Resources and
    Requirements' in text AND 'Personnel Services' NOT in text.

    Section gating: The table contains both Resources and Requirements rows.  Only rows
    that appear AFTER the 'Requirements' section header row are captured.  Rows that appear
    before (i.e., in the Resources section) are skipped even if their name is not in
    PORTLAND_REQUIREMENTS_SKIP.

    Fiscal year: The All Funds page lists multiple FY columns; the Adopted column is the
    LAST (rightmost) FY shown.  Use _detect_fy_allfunds() not detect_fiscal_year().

    Returns list of dicts: { category, adopted_amount, fiscal_year, page_num }
    """
    results = []
    fiscal_year = None
    found_data_page = False
    in_requirements_section = False
    total_requirements_value = None   # for fallback reconciliation check
    total_requirements_page = None

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''

            is_data_page = (
                'Total City Budget' in text and
                'Resources and Requirements' in text and
                'Personnel Services' in text  # eliminates TOC false positive
            )
            is_continuation = (
                found_data_page and
                'Total City Budget' in text and
                'Resources and Requirements' in text and
                'Personnel Services' not in text  # continuation: only Requirements rows remain
            )

            if not (is_data_page or is_continuation):
                if found_data_page:
                    break  # past the table — no need to scan further
                continue

            found_data_page = True

            # Detect fiscal year once from the first data page.
            # Use _detect_fy_allfunds() to get the Adopted (last/rightmost) FY column.
            if fiscal_year is None:
                fy = _detect_fy_allfunds(text)
                if fy:
                    fiscal_year = fy

            # On continuation pages, we are already in the Requirements section.
            if is_continuation:
                in_requirements_section = True

            tables = page.extract_tables()
            if not tables:
                continue

            # Track whether we've passed the Resources section's 'Total NET Budget' row.
            # In all Portland Vol 1 formats (FY2022–FY2026), the Resources section ends
            # with 'Total NET Budget' and the Requirements section follows immediately.
            # Older FYs (2022-2024) use empty-string section headers; newer FYs use
            # 'Requirements'/'Requirements\nBureau Expenditures'. Both cases are handled
            # by gating on 'past_resources_net_budget' rather than looking for a named
            # 'Requirements' header row.
            past_resources_net_budget = False

            for row in tables[0]:
                # row[0] may be None (no cell) or an empty string (blank section header)
                raw_name = row[0] if row and row[0] is not None else ''

                # Normalize: replace newlines within cell, then take only first segment.
                # Handles FY2026 compound keys like 'Requirements\nBureau Expenditures'.
                name_first = raw_name.split('\n')[0].strip()
                name = name_first.replace('\n', ' ').strip()

                # Always capture the 'Total Requirements' value for reconciliation,
                # even though it stays in the skip set and won't appear in final results.
                if name == 'Total Requirements' and len(row) >= 6 and row[5] is not None:
                    v = parse_money(row[5])
                    if v > 0:
                        total_requirements_value = v
                        total_requirements_page = page_num

                # Section gate strategy: The Resources section always ends with
                # 'Total NET Budget'.  After the first occurrence of 'Total NET Budget'
                # (within the Resources section), all subsequent rows are Requirements rows.
                # A second 'Total NET Budget' row exists at the end of Requirements —
                # we can safely collect all rows between the two occurrences.
                if name == 'Total NET Budget':
                    if not past_resources_net_budget:
                        past_resources_net_budget = True
                    # else: second occurrence — end of Requirements; still fine to continue
                    continue

                # Also handle explicit 'Requirements' section header rows (FY2026 format)
                if name == 'Requirements' or raw_name.startswith('Requirements'):
                    in_requirements_section = True
                    continue  # skip header row

                # Rows before the Resources section's 'Total NET Budget' are Resources rows.
                # Also: on the first data page, use 'past_resources_net_budget' as the gate.
                if not past_resources_net_budget and not in_requirements_section:
                    continue

                # Once past Resources, all non-empty, non-skip rows are Requirements rows.
                if not name:
                    continue  # skip blank section header rows

                # Skip section header names and sum/balance rows
                if name in PORTLAND_REQUIREMENTS_SKIP:
                    continue

                # Guard: Adopted column is index 5 (0-based); skip short or empty rows
                if len(row) < 6 or row[5] is None:
                    continue

                adopted = parse_money(row[5])
                if adopted <= 0:
                    continue

                results.append({
                    'category':       name,
                    'adopted_amount': adopted,
                    'fiscal_year':    fiscal_year,
                    'page_num':       page_num,
                })

    # Reconciliation check: warn if no data found
    if not results:
        print('  WARNING: extract_requirements() returned 0 rows — check page detection',
              file=sys.stderr)
        return results

    # Verify summed line items reconcile to within 1% of published Total Requirements.
    # If not, use the fallback: return a single 'Total Requirements' row from the
    # published grand-total cell (from the continuation/same page rows captured above).
    if total_requirements_value is not None:
        line_sum = sum(r['adopted_amount'] for r in results)
        pct_diff = abs(line_sum - total_requirements_value) / total_requirements_value * 100
        if pct_diff > 1.0:
            print(
                f'  INFO: Line-item sum ${line_sum:,} differs from published '
                f'Total Requirements ${total_requirements_value:,} by {pct_diff:.2f}% '
                f'(>1%) — using fallback single-row capture.',
                file=sys.stderr
            )
            # Fallback: single row representing the gross Total Requirements figure
            results = [{
                'category':       'Total Requirements',
                'adopted_amount': total_requirements_value,
                'fiscal_year':    fiscal_year,
                'page_num':       total_requirements_page,
            }]
        else:
            print(
                f'  INFO: Line-item sum ${line_sum:,} reconciles with published '
                f'Total Requirements ${total_requirements_value:,} ({pct_diff:.2f}%)',
                file=sys.stderr
            )

    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Portland budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue', 'requirements'],
                        default='operating',
                        help='operating=Vol 1 bureau data, revenue=Vol 2 fund data, '
                             'requirements=Vol 1 All Funds Requirements categories')
    args = parser.parse_args()

    if args.mode == 'revenue':
        data = extract_revenue(args.pdf_path)
    elif args.mode == 'requirements':
        data = extract_requirements(args.pdf_path)
    else:
        data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
