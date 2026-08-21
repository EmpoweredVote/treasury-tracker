#!/usr/bin/env python3
"""
El Paso County, CO ACFR — General Fund extractor, COORDINATE-BASED.

Emits the same JSON contract as `scripts/lib/acfrGF.py` (`fiscal_year`, `mode`,
`tree`, `computed_total`, `printed_total`, `tie_delta`, `zero_rows`), so
`scripts/lib/acfrGfLoad.mjs` drives it exactly like every other extractor. It
reads the page through `scripts/acfrGfComponents.py` — pdfplumber glyph
coordinates — instead of the `pdftotext -table` character grid.

-- WHY THIS ENTITY NEEDS ITS OWN EXTRACTOR ----------------------------------
El Paso County's statements defeat BOTH of acfrGF's column strategies, each for
a mechanically identified reason, and no CityConfig value reaches either. Both
were confirmed by arithmetic that lands on the dollar:

  positional  `pdftotext -table` renders the General Fund column at TWO
              character offsets — rows whose later cells are dashes sit ~20
              characters right. The reader anchors on the Total rows and files
              the shifted group under Road and Bridge, so those General Fund
              cells read $0. FY2020's four dropped rows sum to 748,294 +
              1,937,380 + 2,527,617 + 2,548,205 = 7,761,496, which IS the
              reported tie delta. (Austin FY2002-FY2009 fails identically; the
              AUSTIN-TRAVIS-01 closeout names coordinate isolation as the fix.)

  ordinal     the county prints its TABOR refund INSIDE the revenue label —
              "Sales taxes net of $4,477,783 TABOR limitation". That embedded
              figure is the FIRST column slot, so the ordinal reader returns it
              as the amount: FY2024's delta is exactly
              122,194,544 - 4,477,783 = 117,716,761. Where the label WRAPS
              (FY2016, FY2022) the positional reader counts the same figure as
              an extra revenue component and its delta equals the TABOR figure
              to the dollar (+15,174,442 and +31,551,234).

In glyph space neither defect exists: the column has ONE x-position, and the
label's embedded figure sits in the label, tens of points from the column edge.

Choosing per-year whichever strategy happened to tie $0 would have been
CURVE-FITTING — the error that got the LA-01 scope verdict retracted. What is
used instead is agreement with an independent reader, checked component by
component; see `scripts/verify-colorado.mjs` CHECK 1.

-- NESTING COMES FROM THE PAGE, NOT FROM CONFIG -----------------------------
`acfrGF.CityConfig` needs `parents` / `root_leaves` declared by hand because
`-table` flattens the leading whitespace that states the hierarchy. Glyph
coordinates keep it, so this extractor reads the tree off the printed
INDENTATION and needs no structural declaration at all. FY2020, measured:

    Current:                     x0 = 69.8   <- root
      General government         x0 = 74.8   <- child
      ...
    Debt service:                x0 = 69.8   <- root
      Principal                  x0 = 74.8   <- child
    Capital outlay               x0 = 69.8   <- root, VALUED leaf

That is the same shape the hand-written config declared, now derived from the
document rather than asserted about it — which matters because a tie proves
arithmetic and never structure.

-- WINDOW -------------------------------------------------------------------
Reads FY2005 and FY2009-FY2025. Two eras are NOT readable and are excluded with
a diagnosed cause, not a shrug:

  FY2000-FY2004  IMAGE-ONLY SCANS. `pdftotext` returns 0 characters for all
                 five; there is no text layer to read. Needs OCR, which would
                 put a transcription step into a provenance chain that is
                 currently byte-exact.

  FY2006-FY2008  a DIFFERENT STATEMENT. Those years title it "Statement of
                 Revenues and Changes in Fund Balances" — no "Expenditures" —
                 and split the fund columns HORIZONTALLY ACROSS TWO PAGES
                 (General / Road and Bridge / Human Services on one, Capital
                 Projects / Other / Total on the next). The page also
                 letter-spaces its own column headers ("S e r v ic e s"). Both
                 the page-qualifying rule and the single-page column model are
                 wrong for that era; it is a separate build, not a config
                 change.

Usage:
  py -3 scripts/extractElPasoCountyCoords.py docs/ElPasoCounty/el-paso-county-2024-acfr.pdf --mode revenue
  py -3 scripts/extractElPasoCountyCoords.py docs/ElPasoCounty/el-paso-county-2020-acfr.pdf --mode operating
"""

import argparse
import json
import pathlib
import sys

import pdfplumber

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from acfrGfComponents import (  # noqa: E402
    collect, establish_column, find_statement, lines_of,
    numbers_on, REV_BANNER, REV_TOTAL, EXP_BANNER, EXP_TOTAL,
)
import re  # noqa: E402

def clean_label(label):
    """Strip a TRAILING COLON from a printed label.

    Punctuation only, never wording. The county prints its expenditure group
    heading as "Current:" in most years and "Current" in others, and a category
    named `Current:` in the UI is the issuer's typography leaking into a chart
    legend. `acfrGF._is_section_header` already ignores a trailing colon for the
    same reason, so this keeps the two readers' labels comparable — which
    matters because `verify-colorado.mjs` compares them.
    """
    return label.rstrip(':').strip()


CITY = 'El Paso County, CO'
UNITS = 1  # whole dollars; the county prints full figures

# Indentation deeper than the section's root by more than this many points is a
# CHILD row. Measured gap is 5.0pt (69.8 -> 74.8) and fund columns are 50-90pt
# apart, so this sits clear of both. A row within tolerance of the root x0 is a
# root-level peer even if it is visually a hair off.
INDENT_TOL = 1.5


def build_revenue_tree(rows):
    """Flat: every revenue source is a root child. Zero rows are dropped and
    reported, matching acfrGF's own behaviour (its `zero_rows` field)."""
    children, zeros = [], []
    for r in rows:
        if r['amount'] == 0:
            zeros.append(r['label'])
            continue
        children.append({'n': clean_label(r['label']), 'a': r['amount']})
    return children, zeros


def build_operating_tree(rows):
    """Two levels, read off the printed indentation.

    A root-level row with money is a VALUED ROOT LEAF (Capital outlay). A
    root-level row with a blank or dash cell opens a PARENT, and the indented
    rows that follow are its children. A parent that ends up with no non-zero
    child is DROPPED rather than published as an empty node — the same choice
    acfrGF makes, and why Travis County's FY2004-FY2011 emit no Debt service.
    """
    indents = [r['indent'] for r in rows if r['indent'] is not None]
    if not indents:
        return [], [], ['no label indentation could be measured']
    root_x = min(indents)

    tree, zeros, errors = [], [], []
    open_parent = None
    for r in rows:
        if r['indent'] is None:
            errors.append(f'row with no measurable indent: {r["label"][:40]}')
            continue
        is_root = r['indent'] <= root_x + INDENT_TOL
        if is_root:
            open_parent = None
            if r['cell'] == 'number' and r['amount'] != 0:
                tree.append({'n': clean_label(r['label']), 'a': r['amount']})
            elif r['amount'] == 0:
                # Ambiguous by value alone (a $0 root leaf and a group heading
                # both read 0), so it is opened as a parent and dropped below if
                # nothing indented follows. Publishing it as a $0 leaf would
                # invent a category the county did not report.
                open_parent = {'n': clean_label(r['label']), 'a': 0, 'c': []}
                tree.append(open_parent)
            continue
        # Child row.
        if open_parent is None:
            errors.append(f'indented row with no open parent: {r["label"][:40]}')
            continue
        if r['amount'] == 0:
            zeros.append(r['label'])
            continue
        open_parent['c'].append({'n': clean_label(r['label']), 'a': r['amount']})
        open_parent['a'] += r['amount']

    kept = []
    for node in tree:
        if 'c' in node:
            if not node['c']:
                zeros.append(node['n'])
                continue
        kept.append(node)
    return kept, zeros, errors


def leaf_sum(tree):
    total = 0
    for node in tree:
        total += sum(c['a'] for c in node['c']) if 'c' in node else node['a']
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--mode', choices=('revenue', 'operating'), required=True)
    ap.add_argument('--page', type=int, default=None)
    args = ap.parse_args()

    with pdfplumber.open(args.pdf_path) as pdf:
        if args.page:
            idx, page = args.page - 1, pdf.pages[args.page - 1]
            text = page.extract_text() or ''
        else:
            idx, page, text = find_statement(pdf)
        if page is None:
            print('  ERROR: primary GF statement not found in %s' % args.pdf_path, file=sys.stderr)
            sys.exit(3)
        rows_all = lines_of(page)
        alignment, edge = establish_column(rows_all)
        if alignment is None:
            print('  ERROR: General Fund column not established: %s' % edge, file=sys.stderr)
            sys.exit(4)

        if args.mode == 'revenue':
            comps, errs, welds = collect(rows_all, REV_BANNER, REV_TOTAL, alignment, edge, UNITS, weld='disclosure')
            printed_cols, _ = numbers_on(rows_all, REV_TOTAL)
            children, zeros = build_revenue_tree(comps)
            root_name = 'General Fund Revenue by Source'
        else:
            comps, errs, welds = collect(rows_all, EXP_BANNER, EXP_TOTAL, alignment, edge, UNITS, weld='disclosure')
            printed_cols, _ = numbers_on(rows_all, EXP_TOTAL)
            children, zeros, more = build_operating_tree(comps)
            errs = errs + more
            root_name = 'General Fund Expenditure by Function'

        m = re.search(r'year\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)

    if errs:
        for e in errs:
            print('  ROW ERROR: %s' % e, file=sys.stderr)
        sys.exit(5)
    if not printed_cols:
        print('  ERROR: printed total row not located', file=sys.stderr)
        sys.exit(6)

    printed_total = printed_cols[0] * UNITS
    computed_total = leaf_sum(children)
    tie_delta = computed_total - printed_total

    result = {
        'city': CITY,
        'fiscal_year': int(m.group(1)) if m else None,
        'mode': args.mode,
        'statement_page': idx + 1,
        'reader': 'pdfplumber-coordinates',
        'alignment': alignment,
        'column_edge': round(edge, 2),
        'tree': {'n': root_name, 'a': computed_total, 'c': children},
        'computed_total': computed_total,
        'printed_total': printed_total,
        'tie_delta': tie_delta,
        'zero_rows': zeros,
        'welded_labels': welds,
    }

    if tie_delta != 0:
        print('  TIE FAILURE (%s FY%s): computed %d vs printed %d (delta %d)'
              % (args.mode, result['fiscal_year'], computed_total, printed_total, tie_delta),
              file=sys.stderr)
        print(json.dumps(result, indent=2))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
