"""
Independent second reader for the South Carolina RFA Local Government Finance Report.

WHY THIS EXISTS: `scripts/loadScRfa.mjs` reads a CONVERTED .xlsx through ExcelJS
using a stack-based tree walk. This reads the ORIGINAL BIFF8 .xls through xlrd
using a different algorithm entirely — nearest-preceding-shallower-row for
parentage instead of a stack — and emits the totals it believes were loaded.
`node scripts/verifyScRfa.mjs` then diffs those against what is actually in the
database.

That closes the loop source-file -> database across two independent
implementations AND across the .xls -> .xlsx conversion, so a conversion defect,
a parse defect or a write defect each show up as a non-zero difference. Session 3
established the habit (openpyxl vs the DB, 18/18 exact); session 2 could not do
it at all, and `pdftotext -table` read those PDFs confidently and wrongly.

⚠ This deliberately does NOT import anything from the loader. The moment it
shares code with what it checks, it stops being a second reader — Georgia's
lesson, where LOAD1 was DERIVED from the printed pages by formula, so their
agreement carried no information and only their disagreements did.

Requires: xlrd (BIFF8 reader).

Usage:
    python scripts/tools/scRfaSecondReader.py _acfr-work/sc/xls/ScLgfReport_2024.xls \
        --out _acfr-work/sc/second-reader.json
"""
import argparse
import json
import re
import sys

import xlrd

# The two blocks the loader takes, named exactly as the workbook prints them.
REVENUE_ANCHOR = "Total Revenues (County only)"
EXPENDITURE_ANCHOR = "Total Expenditures (County only)"

# Bond and capital-lease proceeds: financing sources, excluded from revenue.
FINANCING_LEAF = "Bonds & Leases"

LABEL_COLS = 6
YEAR_RE = re.compile(r"^FY\s*(\d{2})(\*?)$")


def cents(v):
    """Round to cents. The .xls -> .xlsx conversion is lossless only at 2dp."""
    if v is None or v == "":
        return 0.0
    if isinstance(v, str):
        v = v.replace("$", "").replace(",", "").strip()
        if not v:
            return 0.0
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return 0.0


def label_of(sheet, r):
    """Return (depth, label) for a row, or (None, None) if it has no label."""
    for c in range(LABEL_COLS):
        v = str(sheet.cell_value(r, c)).strip()
        if v:
            return c, v
    return None, None


def year_columns(sheet):
    """Map fiscal year -> (column, starred). Starred means the publisher's
    non-reporting marker, and such a year is never emitted."""
    for r in range(sheet.nrows):
        found = {}
        for c in range(LABEL_COLS, sheet.ncols):
            m = YEAR_RE.match(str(sheet.cell_value(r, c)).strip())
            if m:
                yy = int(m.group(1))
                found[1900 + yy if yy >= 90 else 2000 + yy] = (c, m.group(2) == "*")
        if len(found) >= 20:
            return found
    raise SystemExit(f"no year header row on sheet {sheet.name}")


def county_info(book):
    """Read the `County Info` submission matrix INDEPENDENTLY.

    ⚠⚠ The workbook carries TWO non-reporting signals that contradict each other,
    and neither is a superset of the other: an asterisk in a county sheet's year
    header, and an `N` in this matrix. A county-year is trustworthy only when
    BOTH say it was reported.

    This reader emits both signals rather than applying the rule, so the
    comparison in verifyScRfa.mjs is driven by THIS reader's own view of what the
    publisher said — not by the loader's. Keys are trimmed: the sheet stores
    `'Richland '` with a trailing space.

    Returns {county: {fy: bool}}.
    """
    sheet = book.sheet_by_name("County Info")
    header = None
    for r in range(sheet.nrows):
        if str(sheet.cell_value(r, 0)).strip() == "County":
            header = r
            break
    if header is None:
        raise SystemExit("County Info: no header row")

    cols = {}
    for c in range(1, sheet.ncols):
        raw = str(sheet.cell_value(header, c)).strip()
        m = YEAR_RE.match(re.sub(r"^FY(\d)", r"FY \1", raw))
        if m:
            yy = int(m.group(1))
            cols[1900 + yy if yy >= 90 else 2000 + yy] = c

    out = {}
    for r in range(header + 1, sheet.nrows):
        name = str(sheet.cell_value(r, 0)).strip()
        if not name:
            continue
        out[name] = {
            fy: str(sheet.cell_value(r, c)).strip().upper() == "Y" for fy, c in cols.items()
        }
    return out


def block_rows(sheet, anchor):
    """The anchor row index and the body rows of one block."""
    start = None
    for r in range(sheet.nrows):
        d, lab = label_of(sheet, r)
        if d == 0 and lab == anchor:
            start = r
            break
    if start is None:
        raise SystemExit(f"anchor not found on {sheet.name}: {anchor}")
    body = []
    for r in range(start + 1, sheet.nrows):
        d, lab = label_of(sheet, r)
        if lab is None:
            continue
        if d == 0:
            break
        body.append((r, d, lab))
    return start, body


def ancestors_of(body, i):
    """Indices of row i's ancestors, found by walking BACKWARDS to the nearest
    row of smaller depth, repeatedly. Deliberately not the loader's stack."""
    out = []
    _, depth, _ = body[i]
    want = depth - 1
    j = i - 1
    while j >= 0 and want >= 1:
        if body[j][1] == want:
            out.append(j)
            want -= 1
        j -= 1
    return out


def block_total(sheet, body, col, exclude_leaf=None):
    """Sum the depth-1 roots for one year, after removing an excluded leaf from
    itself and from every ancestor."""
    amounts = {i: cents(sheet.cell_value(r, col)) for i, (r, _, _) in enumerate(body)}
    excluded_total = 0.0

    if exclude_leaf is not None:
        for i, (_, _, lab) in enumerate(body):
            if lab != exclude_leaf:
                continue
            excluded_total = round(excluded_total + amounts[i], 2)
            for a in ancestors_of(body, i):
                amounts[a] = round(amounts[a] - amounts[i], 2)
            amounts[i] = 0.0

    total = 0.0
    for i, (_, depth, _) in enumerate(body):
        if depth == 1:
            total = round(total + amounts[i], 2)
    return total, round(excluded_total, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xls")
    ap.add_argument("--out", required=True)
    ap.add_argument("--sheets", default="Richland,Horry")
    # ⚠ `--all-counties` reads every county sheet in the workbook, for the
    # statewide sweep. NON_COUNTY sheets are named rather than inferred.
    ap.add_argument("--all-counties", action="store_true")
    ap.add_argument("--first", type=int, default=2012)
    ap.add_argument("--last", type=int, default=2024)
    args = ap.parse_args()

    book = xlrd.open_workbook(args.xls)
    info = county_info(book)

    if args.all_counties:
        non_county = {
            "About the Report", "Sources and Notes", "County Info", "Municipal Info",
            "Special Purpose District Info", "State Summary",
        }
        names = [n for n in book.sheet_names() if n not in non_county]
    else:
        names = [n.strip() for n in args.sheets.split(",")]

    rows = []
    for name in names:
        sheet = book.sheet_by_name(name)
        years = year_columns(sheet)
        rev_anchor, rev_body = block_rows(sheet, REVENUE_ANCHOR)
        exp_anchor, exp_body = block_rows(sheet, EXPENDITURE_ANCHOR)

        for fy in range(args.first, args.last + 1):
            if fy not in years:
                continue
            col, starred = years[fy]
            if starred:
                continue
            rev_total, financing = block_total(sheet, rev_body, col, FINANCING_LEAF)
            exp_total, _ = block_total(sheet, exp_body, col)
            rows.append({
                "sheet": sheet.name,
                "fiscal_year": fy,
                "revenue": rev_total,
                "operating": exp_total,
                "financing_excluded": financing,
                "published_revenue": cents(sheet.cell_value(rev_anchor, col)),
                "published_operating": cents(sheet.cell_value(exp_anchor, col)),
                # ⚠ The SECOND signal, read here rather than inherited: `N` in
                # the County Info matrix. None means this reader found no matrix
                # row at all, which is itself worth surfacing.
                "submitted": info.get(name.strip(), {}).get(fy),
            })

    if not rows:
        sys.exit("REFUSING: read zero entity-years. A reader that measures nothing must fail.")

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, indent=1, sort_keys=True)
    print(f"second reader: {len(rows)} entity-year(s) -> {args.out}")


if __name__ == "__main__":
    main()
