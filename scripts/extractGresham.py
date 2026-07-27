#!/usr/bin/env python3
"""
Gresham Budget PDF Extractor

Extracts department-level operating budget, Resources (revenue) categories, or
non-operating Requirements categories from the 'Resources and Requirements
- All Funds' page using pdfplumber text-line parsing (NOT extract_tables).

Amounts are in full dollars (no thousands multiplication).

Every mode is gated by an exact tie against a total the page prints itself —
see assert_tie() and ORACLES below. A mode that cannot tie exits non-zero, and
processGresham.js treats that as a thrown error, so mis-parsed figures cannot
reach the database.

Usage:
  python scripts/extractGresham.py "docs/Gresham/fy2025-26.pdf"
  python scripts/extractGresham.py "docs/Gresham/fy2025-26.pdf" --mode revenue
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


def adopted_from_tokens(num_tokens):
    """Adopted amount = the LAST numeric column, rejoining an OCR-split number.

    Gresham's FY2022-23 PDF splits the leading digit(s) of the final column into
    a separate token:

        Police 36,616,711 37,003,641 43,243,361 45,708,476 45,708,476 4 5,708,476
                                                                      ^^^ ^^^^^^^^^

    so the last two tokens are ['4', '5,708,476'] and must be rejoined to
    45,708,476. Detected by: the second-to-last token is a bare 1-3 digit
    fragment (no comma), and the last token begins with 1-3 digits followed
    immediately by a comma — i.e. it is itself a truncated N,NNN,NNN number.

    HISTORY: extract_budget() previously tested the last token with `^\\d{3,}`,
    which can never match a token starting "1," — so the rejoin never fired and
    every 8-digit FY2023 amount silently lost its leading digit (Police
    $45,708,476 -> $5,708,476), understating that year's operating total by
    exactly $210,000,000. extract_revenue() and extract_requirements() already
    used the correct `^\\d{1,3},` test; this helper is now the single shared
    implementation so the three modes cannot drift apart again.
    """
    if not num_tokens:
        return 0
    raw = num_tokens[-1]
    if (len(num_tokens) >= 2
            and re.match(r'^\d{1,3}$', num_tokens[-2])
            and re.match(r'^\d{1,3},', num_tokens[-1])):
        raw = num_tokens[-2] + num_tokens[-1]
    return parse_money(raw)


# ── Correctness oracles ───────────────────────────────────────────────────────
# Every mode returns a set of rows whose sum equals a total the All Funds page
# prints itself. Checking against that printed figure turns a silent mis-parse
# into a hard failure — without it, the FY2023 leading-digit truncation produced
# a plausible-looking $59,306,991 operating total that the loader accepted and
# reported as success.
#
#   operating     departments                 == 'Operating Total'
#   revenue       Resources categories        == 'Total Resources' - 'Beginning Balance'
#                                                (revenue excludes Beginning Balance,
#                                                 which is prior-year carry-forward,
#                                                 not revenue)
#   requirements  non-operating categories    == 'Non-Operating Total'
#
# HISTORY: this file previously asserted that only `operating` had an exact
# oracle, on the grounds that 'Total Resources' includes Beginning Balance and
# that 'Non-Operating Total' did not equal the six whitelisted requirements
# categories. The first is true but trivially correctable by subtraction; the
# second was simply wrong — it did not tie only because the whitelist was
# MISSING a category. FY2023 prints that row as 'Interfund Transfers' where
# FY2024+ print 'Transfers', so $83,157,453 of FY2023 non-operating spending was
# dropped on the floor and the stored total sat at $379,166,971 against a printed
# $462,324,424. Two of three modes were unguarded because of a note that talked
# itself out of checking; the arithmetic was never actually attempted.

# {(mode, fiscal_year): exact_delta} for city-years where the SOURCE's own
# printed total disagrees with the sum of its own printed components.
#
# Deliberately NOT a tolerance. A blanket "allow small deltas" rule would let a
# genuine mis-parse through; an exact-delta registry cannot. Same convention as
# CityConfig.source_rounding in scripts/lib/acfrGF.py.
#
# FY2026 revenue: the page prints Total Resources $896,226,615, but its eleven
# Resources rows (including Beginning Balance) add up to $897,266,615 — and so
# does the same page's Total Requirements, which is built from an entirely
# separate set of rows (Operating Total $330,652,078 + Non-Operating Total
# $566,614,537). Two independent aggregates agree on $897,266,615; the printed
# Total Resources cell is the outlier, so the $1,040,000 sits in that one cell.
# Verified by adding the printed rows by hand. The emitted total is always the
# COMPONENT SUM, never the printed total, so loaded rows still tie internally.
SOURCE_ROUNDING = {
    ('revenue', 2026): 1_040_000,
}


def assert_tie(mode, rows, printed, oracle_label):
    """Exit non-zero unless `rows` sum exactly to the page's own `printed` total.

    `printed` is None when the oracle row was not found on the page — that is a
    loud warning rather than a failure, because a missing total row means the
    check could not run, not that the rows are wrong.

    A delta registered in SOURCE_ROUNDING for this (mode, fiscal_year) is
    accepted if and only if it matches EXACTLY; anything else — including the
    same year drifting to a different delta — still fails.
    """
    if not rows:
        return
    fiscal_year = rows[0]['fiscal_year']
    if printed is None:
        print(f'  WARNING ({mode} FY{fiscal_year}): no printed "{oracle_label}" row found '
              f'— sum unverified', file=sys.stderr)
        return

    computed = sum(r['adopted_amount'] for r in rows)
    delta = computed - printed
    if delta == 0:
        return

    accepted = SOURCE_ROUNDING.get((mode, fiscal_year))
    if accepted is not None and accepted == delta:
        print(f'  NOTE ({mode} FY{fiscal_year}): rows sum to {computed:,} but the page prints '
              f'{oracle_label} {printed:,}, a difference of {delta:+,} — accepted as a '
              f'registered source discrepancy. Using the component sum.', file=sys.stderr)
        return

    print(f'  TIE FAILURE ({mode} FY{fiscal_year}): rows sum to {computed:,} but the page '
          f'prints {oracle_label} {printed:,} (delta {delta:,})', file=sys.stderr)
    for r in rows:
        print(f"    {r.get('department') or r.get('category')}: {r['adopted_amount']:,}",
              file=sys.stderr)
    sys.exit(1)

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
    printed_operating_total = None
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
                if re.sub(r'\s+', '', s) == 'Resources':
                    in_requirements = False
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
                # Capture the printed 'Operating Total' BEFORE skipping it — it is
                # the correctness oracle for this mode (see the tie check below).
                if dept_normalized == 'Operating Total':
                    printed_operating_total = adopted_from_tokens(num_tokens)
                if dept_normalized in SKIP_ROWS:
                    continue
                # Adopted amount = last column (column 6 = Council Adopted).
                adopted = adopted_from_tokens(num_tokens)
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

    # Departments must sum to the printed 'Operating Total' (see assert_tie).
    assert_tie('operating', results, printed_operating_total, 'Operating Total')

    return results


# ── Extract Resources (revenue) categories from Gresham All Funds page ────────
def extract_revenue(pdf_path):
    """
    Extract revenue categories from the Resources section of the All Funds page.
    Uses page.extract_text() text-line parsing (NOT extract_tables() — that
    returns empty on Gresham's All Funds page).

    Returns list of: { category, adopted_amount, fiscal_year, page_num }
    Excludes: Beginning Balance, Total Resources (sum rows, not revenue categories)
    Amounts are in full dollars (no multiply-by-1000).
    """
    REVENUE_SKIP = {'Total Resources', 'Beginning Balance'}
    NORMALIZE    = {
        # FY2023: long form → canonical short form used in FY2024–FY2026
        'Internal Service Charges': 'Internal Svc Chrg',
        # FY2023 OCR artifacts: mid-word spaces in category names
        'Li censes & Permits': 'Licenses & Permits',
        'In ternal Payments': 'Internal Payments',
    }

    results = []
    printed_total_resources   = None
    printed_beginning_balance = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
            if 'Taxes' not in text:  # skip table-of-contents page
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
            # Extract category rows from Resources section only
            in_resources = False
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                # Normalize OCR spacing before checking section marker.
                # FY2023 has 'Resou rces' (OCR artifact) → normalizes to 'Resources'.
                # FY2024–2026 have 'Resources Proposed Approved Adopted' on one line;
                # normalize-strip produces 'ResourcesProposedApprovedAdopted', so also
                # check for lines that begin with the word 'Resources' followed by a space
                # (but not 'Resources and Requirements').
                s_norm = re.sub(r'\s+', '', s)
                if s_norm == 'Resources' or (
                        s.startswith('Resources ') and
                        not s.startswith('Resources and')):
                    in_resources = True
                    continue
                if s_norm == 'Requirements' or s.startswith('Requirements'):
                    in_resources = False
                    continue
                if not in_resources:
                    continue
                # Each data line: "Category Name  num  num  num  num  num  ADOPTED"
                tokens = s.split()
                if len(tokens) < 2:
                    continue
                # Split: name tokens vs number tokens
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
                # Need at least 6 numeric tokens to be a valid data row
                if not name_tokens or len(num_tokens) < 6:
                    continue
                category = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()
                # Capture the two skipped sum/carry-forward rows BEFORE discarding
                # them — their difference is this mode's oracle (see assert_tie).
                if category == 'Total Resources':
                    printed_total_resources = adopted_from_tokens(num_tokens)
                elif category == 'Beginning Balance':
                    printed_beginning_balance = adopted_from_tokens(num_tokens)
                if category in REVENUE_SKIP:
                    continue
                # Adopted amount = last column.
                # OCR may split e.g. '20,175,800' into tokens ['2', '0,175,800'] or
                # '35,569,000' into ['3', '5,569,000'].  Detect this: second-to-last
                # is a short pure-digit fragment (1-3 digits) and last token starts
                # with 1-3 digits immediately followed by a comma (N,NNN,NNN pattern).
                adopted = adopted_from_tokens(num_tokens)
                if adopted <= 0:
                    continue
                category = NORMALIZE.get(category, category)
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

    # Revenue categories must sum to 'Total Resources' less 'Beginning Balance'.
    # Beginning Balance is prior-year carry-forward, not revenue, so it is the only
    # Resources row this mode excludes — which makes the subtraction exact rather
    # than an approximation. Both rows are required to form the oracle; if either
    # is missing, pass None so assert_tie warns instead of comparing to a bad figure.
    oracle = (None if printed_total_resources is None or printed_beginning_balance is None
              else printed_total_resources - printed_beginning_balance)
    assert_tie('revenue', results, oracle, 'Total Resources - Beginning Balance')

    return results


# ── Extract non-operating Requirements categories from Gresham All Funds page ──
# Whitelist: only these 6 non-operating categories are captured.
# Department rows (Police, Fire, etc.) and sum rows (Operating Total, Non-Operating
# Total, Total Requirements) are skipped by the whitelist automatically.
REQUIREMENTS_CATEGORIES = {
    'Capital Improvement', 'Debt Service', 'Transfers', 'Contingency',
    'Other Requirements', 'Unappropriated',
}

# Canonicalize FY2023's spelling to the FY2024+ one, exactly as extract_revenue's
# NORMALIZE does for 'Internal Service Charges' -> 'Internal Svc Chrg'. Applied
# BEFORE the whitelist test, so REQUIREMENTS_CATEGORIES stays canonical.
#
# FY2023 prints this row as 'Interfund Transfers' (matching the Resources-side
# label, same amount: $83,157,453); FY2024, FY2025 and FY2026 all print
# 'Transfers'. Because only the short form was whitelisted, the row was silently
# dropped from FY2023 and that year loaded $379,166,971 against a printed
# Non-Operating Total of $462,324,424. Normalizing to 'Transfers' also keeps the
# category comparable year-over-year in the UI instead of splitting one line item
# across two labels.
REQUIREMENTS_NORMALIZE = {
    'Interfund Transfers': 'Transfers',
}

def extract_requirements(pdf_path):
    """
    Extract non-operating requirements categories from the Requirements section
    of the 'Resources and Requirements — All Funds' page in Gresham budget PDFs.

    Uses page.extract_text() text-line parsing (NOT extract_tables() — that
    returns empty on Gresham's All Funds page).

    Section gate: in_requirements = True when 'Requirements' header seen,
    False when 'Resources' header seen.  Skips department rows and sum rows
    via REQUIREMENTS_CATEGORIES whitelist.

    Returns list of: { category, adopted_amount, fiscal_year, page_num }
    Amounts are in full dollars (no multiply-by-1000).
    """
    results = []
    printed_non_operating_total = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
            if 'Taxes' not in text:  # skip table-of-contents page
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
            # Extract category rows from Requirements section only.
            # Gate: in_requirements True from 'Requirements' header until 'Resources' header.
            in_requirements = False
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                s_norm = re.sub(r'\s+', '', s)
                # Enter Requirements section
                if s_norm == 'Requirements' or s.startswith('Requirements'):
                    in_requirements = True
                    continue
                # Exit Requirements section when Resources header seen
                if s_norm == 'Resources' or (
                        s.startswith('Resources ') and
                        not s.startswith('Resources and')):
                    in_requirements = False
                    continue
                if not in_requirements:
                    continue
                # Each data line: "Category Name  num  num  num  num  num  ADOPTED"
                tokens = s.split()
                if len(tokens) < 2:
                    continue
                # Split: name tokens vs number tokens
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
                # Need at least 6 numeric tokens (6 columns) to be a valid data row
                if not name_tokens or len(num_tokens) < 6:
                    continue
                category = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()
                # Capture the printed sum row BEFORE the whitelist discards it — it
                # is this mode's oracle (see assert_tie).
                if category == 'Non-Operating Total':
                    printed_non_operating_total = adopted_from_tokens(num_tokens)
                category = REQUIREMENTS_NORMALIZE.get(category, category)
                # Whitelist: skip department rows and sum rows automatically
                if category not in REQUIREMENTS_CATEGORIES:
                    continue
                # Adopted amount = last column.
                # OCR may split e.g. '20,175,800' into ['2', '0,175,800'].
                # Detect: second-to-last is short pure-digit fragment (1-3 digits) and
                # last token starts with 1-3 digits followed by a comma (N,NNN,NNN pattern).
                adopted = adopted_from_tokens(num_tokens)
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

    # The whitelisted categories are exactly the non-operating block, so they must
    # sum to the printed 'Non-Operating Total'. This is what catches a year that
    # renames one of them (the FY2023 'Interfund Transfers' case above).
    assert_tie('requirements', results, printed_non_operating_total, 'Non-Operating Total')

    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Gresham budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--mode', choices=['operating', 'revenue', 'requirements'],
                        default='operating',
                        help='operating=Requirements section departments, '
                             'revenue=Resources section categories, '
                             'requirements=All Funds Requirements non-operating categories')
    args = parser.parse_args()

    if args.mode == 'revenue':
        data = extract_revenue(args.pdf_path)
    elif args.mode == 'requirements':
        data = extract_requirements(args.pdf_path)
    else:
        data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
