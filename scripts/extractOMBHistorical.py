#!/usr/bin/env python3
"""
OMB Historical Tables extractor (Phase 44, Plan 02).

Usage: python extractOMBHistorical.py <hist01z1.xlsx> <hist08z1.xlsx>
Emits JSON array to stdout:
  [{fiscal_year, receipts, outlays, surplus_or_deficit,
    mandatory, discretionary_defense, discretionary_nondefense, net_interest}, ...]
All amounts normalized to DOLLARS.

Layout facts (verified against FY2027-edition files, 2026-06-12):
- hist01z1 is "(in millions of dollars)"; hist08z1 is "(in billions of dollars)".
  Units are READ from each file's line-2 text, never assumed.
- Headers are merged multi-row (rows 3-6 in 1-based terms); columns are located
  by header TEXT, never by position.
- Year rows: first cell is exactly a 4-digit year. This excludes range rows
  ("1789-1849"), the TQ transition quarter, and estimate rows ("2026 estimate").
- 8.1 'Mandatory' (the subtotal that includes undistributed offsetting receipts)
  + defense + nondefense + net interest sums EXACTLY to total outlays.
- Emit only years present in BOTH files (8.1 starts 1962), actuals only (<= 2025
  hard stop; estimate rows are already excluded by the 4-digit rule).
"""
import json
import re
import sys
import warnings

warnings.filterwarnings("ignore")
import openpyxl  # noqa: E402

MAX_ACTUAL_YEAR = 2025  # hard stop: never emit OMB estimate years


def norm(cell):
    """Normalize a header cell: collapse whitespace/newlines, lowercase."""
    return re.sub(r"\s+", " ", str(cell or "")).strip().lower()


def read_sheet(path):
    ws = openpyxl.load_workbook(path).active
    return list(ws.iter_rows(values_only=True))


def units_multiplier(rows, path):
    for r in rows[:4]:
        t = norm(r[0])
        if "in millions of dollar" in t:
            return 1_000_000
        if "in billions of dollar" in t:
            return 1_000_000_000
    sys.stderr.write(f"FATAL: no units line found in {path}\n")
    sys.exit(1)


def find_col(rows, header_text, search_rows=8):
    """Find the column index whose (normalized) header matches header_text."""
    target = norm(header_text)
    for r in rows[:search_rows]:
        for idx, cell in enumerate(r):
            if norm(cell) == target:
                return idx
    sys.stderr.write(f"FATAL: header '{header_text}' not found\n")
    sys.exit(1)


def year_rows(rows):
    out = {}
    for r in rows:
        first = str(r[0] or "").strip()
        if re.fullmatch(r"\d{4}", first) and int(first) <= MAX_ACTUAL_YEAR:
            out[int(first)] = r
    return out


def to_num(v, year, field):
    try:
        return float(v)
    except (TypeError, ValueError):
        sys.stderr.write(f"FATAL: non-numeric {field} for {year}: {v!r}\n")
        sys.exit(1)


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: extractOMBHistorical.py <hist01z1.xlsx> <hist08z1.xlsx>\n")
        sys.exit(1)

    r11 = read_sheet(sys.argv[1])
    r81 = read_sheet(sys.argv[2])
    mult11 = units_multiplier(r11, sys.argv[1])
    mult81 = units_multiplier(r81, sys.argv[2])

    # Table 1.1 columns — the FIRST 'receipts'/'outlays'/'surplus or deficit (-)'
    # triplet is the Total group (On-/Off-Budget groups repeat the labels later).
    c_receipts = find_col(r11, "Receipts")
    c_outlays = find_col(r11, "Outlays")
    c_deficit = find_col(r11, "Surplus or Deficit (-)")

    # Table 8.1 columns by header text.
    c_total81 = find_col(r81, "Total Outlays")
    c_defense = find_col(r81, "National Defense")
    c_nondef = find_col(r81, "Non- defense")
    c_mand = find_col(r81, "Mandatory")  # subtotal incl. undistributed offsetting receipts
    c_ni = find_col(r81, "Net Interest")

    y11 = year_rows(r11)
    y81 = year_rows(r81)
    years = sorted(set(y11) & set(y81))
    if not years or years[0] != 1962 or years[-1] != MAX_ACTUAL_YEAR:
        sys.stderr.write(f"FATAL: unexpected year span {years[:1]}..{years[-1:]}\n")
        sys.exit(1)

    out = []
    for y in years:
        a, b = y11[y], y81[y]
        rec = to_num(a[c_receipts], y, "receipts") * mult11
        out_ = to_num(a[c_outlays], y, "outlays") * mult11
        def_ = to_num(a[c_deficit], y, "deficit") * mult11
        total81 = to_num(b[c_total81], y, "8.1 total") * mult81
        mand = to_num(b[c_mand], y, "mandatory") * mult81
        ddef = to_num(b[c_defense], y, "defense") * mult81
        dnon = to_num(b[c_nondef], y, "nondefense") * mult81
        ni = to_num(b[c_ni], y, "net interest") * mult81

        # Validations (halt on violation)
        if abs((rec - out_) - def_) > 2 * mult11:  # rounding tolerance: 2 units
            sys.stderr.write(f"FATAL {y}: receipts-outlays != deficit ({rec - out_} vs {def_})\n")
            sys.exit(1)
        if abs((mand + ddef + dnon + ni) - total81) > 0.005 * total81:
            sys.stderr.write(f"FATAL {y}: BEA components do not sum to 8.1 total within 0.5%\n")
            sys.exit(1)
        if abs(out_ - total81) > 0.001 * out_:
            sys.stderr.write(f"FATAL {y}: 1.1 outlays vs 8.1 total drift > 0.1% ({out_} vs {total81})\n")
            sys.exit(1)

        out.append({
            "fiscal_year": y,
            "receipts": rec,
            "outlays": out_,
            "surplus_or_deficit": def_,
            "mandatory": mand,
            "discretionary_defense": ddef,
            "discretionary_nondefense": dnon,
            "net_interest": ni,
        })

    json.dump(out, sys.stdout)
    sys.stderr.write(f"OK: {len(out)} years ({years[0]}-{years[-1]})\n")


if __name__ == "__main__":
    main()
