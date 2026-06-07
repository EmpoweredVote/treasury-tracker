#!/usr/bin/env python3
"""
extractCA.py — California LAO General Fund extractor

Reads 'Pivot Table Data' sheet from Historical_Expenditures.xlsx.
Filters Fund == 'General Fund', maps FY string to ending-year int,
groups by DOF Agency (top-level) -> Department (second-level).
Emits JSON array to stdout for processCA.js to consume.

Source: https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx
Column structure (0-indexed):
  0: Dept. Code
  1: Department
  2: Function
  3: Fiscal Year  (e.g. '2025-26')
  4: Fund         (filter: 'General Fund')
  5: DOF Agency   (top-level category)
  6: Debt Service?
  7: Amount       (in THOUSANDS — processCA.js multiplies by 1000)

Usage:
  python scripts/extractCA.py [--fy 2026] [--dry-run]
  python scripts/extractCA.py --fy 2022 --fy 2023 --fy 2024 --fy 2025 --fy 2026
"""

import sys
import json
import argparse
import os
import openpyxl

# ── File path ─────────────────────────────────────────────────────────────────
# Relative to repo root (cwd when invoked by processCA.js).
# processCA.js resolves the main worktree root via git rev-parse --git-common-dir
# and sets cwd accordingly, so this relative path always resolves correctly.
XLSX_PATH = 'docs/California/Historical_Expenditures.xlsx'
SHEET = 'Pivot Table Data'

# Column index map (0-indexed, verified by direct Excel inspection 2026-06-07)
COLS = {
    'dept_code':   0,
    'department':  1,
    'function':    2,
    'fiscal_year': 3,
    'fund':        4,
    'dof_agency':  5,
    'debt_service': 6,
    'amount':      7,
}


def fy_to_int(fy_str):
    """'2025-26' -> 2026 (ending calendar year = app fiscal_year convention)"""
    if not fy_str:
        return None
    parts = fy_str.split('-')
    if len(parts) != 2:
        return None
    try:
        start_year = int(parts[0])
        end_suffix = parts[1].strip()
        if len(end_suffix) != 2:
            return None  # reject malformed input like '2025-6'
        end_two = int(end_suffix)
        # Reconstruct full ending year: same century as start_year,
        # but advance century if the two-digit suffix is less than the
        # last two digits of start_year (century rollover).
        start_two = start_year % 100
        century = (start_year // 100) * 100
        if end_two < start_two:
            century += 100  # e.g. 2099-00 -> 2100 + 0 = 2100
        return century + end_two
    except (ValueError, TypeError):
        return None


def extract_budget(requested_fys=None, dry_run=False):
    """
    Extract General Fund rows from the LAO Excel.

    Parameters
    ----------
    requested_fys : list[int] | None
        If provided, only rows for these fiscal years are included.
        If None, all available fiscal years are included.
    dry_run : bool
        If True, print row count and total per FY to stderr and return [].
        If False, return list of row dicts.

    Returns
    -------
    list[dict] | []
        Each dict: { fiscal_year, dof_agency, department, amount_thousands }
        Empty list in dry-run mode.
    """
    if not os.path.exists(XLSX_PATH):
        print(f'ERROR: Excel file not found: {XLSX_PATH}', file=sys.stderr)
        print('Run processCA.js from the repo root, or ensure docs/California/'
              'Historical_Expenditures.xlsx exists.', file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb[SHEET]

    rows_out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        # Filter: General Fund only (Pitfall — T-33-05)
        if row[COLS['fund']] != 'General Fund':
            continue
        # Skip null-amount rows (Pitfall 4 — ~100 null rows for GF 2025-26)
        if not row[COLS['amount']]:
            continue
        # Map FY string to integer
        fy = fy_to_int(str(row[COLS['fiscal_year']] or ''))
        if not fy:
            continue
        # If specific FYs requested, skip others
        if requested_fys and fy not in requested_fys:
            continue

        rows_out.append({
            'fiscal_year':      fy,
            'dof_agency':       row[COLS['dof_agency']],
            'department':       row[COLS['department']],
            'amount_thousands': row[COLS['amount']],   # THOUSANDS — processCA.js x1000
        })

    wb.close()

    if dry_run:
        # Group by FY, print summary to stderr
        fy_groups = {}
        for r in rows_out:
            fy_groups.setdefault(r['fiscal_year'], []).append(r)
        for fy in sorted(fy_groups):
            group = fy_groups[fy]
            total_thousands = sum(r['amount_thousands'] for r in group)
            total_billions = total_thousands / 1_000_000  # thousands -> billions
            print(f'FY{fy}: {len(group)} rows, '
                  f'total ~${total_billions:,.1f}B (thousands sum: {total_thousands:,})',
                  file=sys.stderr)
        return []

    return rows_out


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='California LAO General Fund extractor — emits JSON to stdout'
    )
    parser.add_argument(
        '--fy', type=int, action='append',
        help='Fiscal year(s) to extract (e.g. --fy 2026). Default: all years.'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Print row count and total per FY to stderr; do not emit JSON'
    )
    args = parser.parse_args()

    data = extract_budget(args.fy, args.dry_run)
    if not args.dry_run:
        print(json.dumps(data))
