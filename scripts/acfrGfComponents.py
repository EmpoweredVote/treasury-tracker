#!/usr/bin/env python3
"""
Independent oracle: read EVERY General Fund COMPONENT row off an ACFR
governmental-funds statement using pdfplumber GLYPH COORDINATES.

`scripts/acfrPrintedTotal.py` reads the printed TOTAL cell and nothing else.
This reads the whole column, so it can arbitrate a disagreement about the
component rows themselves — which is what AUSTIN-TRAVIS-01 left open:

    "acfrPrintedTotal.py already reads these pages correctly, so the remaining
     work is extracting COMPONENTS, not just totals."

It shares no code and no strategy with `scripts/lib/acfrGF.py`:

  acfrGF.py     `pdftotext -table`, which flattens the page onto a CHARACTER
                grid and then assigns each money token to the nearest column
                anchor (or, in 'ordinal' mode, to its slot index).

  this script    the PDF's own glyph x-coordinates. Never sees the character
                 grid, so the grid's artifacts cannot reach it.

-- WHY THIS IS THE RIGHT TOOL FOR EL PASO COUNTY ----------------------------
El Paso County's statements defeat BOTH of acfrGF's strategies, each for a
mechanically identified reason, and no config value fixes either:

  (a) `pdftotext -table` renders the General Fund column at TWO DIFFERENT
      character positions. On FY2020, rows whose later cells are dashes are
      shifted ~20 characters right:

          Sales taxes            109,854,783   ...   ends col 52
          Fees and fines               748,294 ...   ends col 71

      The positional reader anchors on the Total rows and files the shifted
      group under Road and Bridge, so four General Fund rows read $0 and the
      tie fails by EXACTLY their sum (748,294 + 1,937,380 + 2,527,617 +
      2,548,205 = 7,761,496 = the reported delta). Austin FY2002-FY2009 fails
      the same way.

  (b) The county prints its TABOR refund INSIDE the revenue label:
      "Sales taxes net of $4,477,783 TABOR limitation". That embedded figure is
      the FIRST column slot on the line, so the 'ordinal' reader returns
      4,477,783 instead of 122,194,544 — and the FY2024 ordinal delta is
      exactly 122,194,544 - 4,477,783 = 117,716,761. When the label WRAPS
      (FY2016, FY2022) the positional reader counts the same figure as an extra
      revenue component, and its delta equals the TABOR figure to the dollar
      (FY2016 +15,174,442; FY2022 +31,551,234).

  In glyph space neither exists: the column has one x-position, and the label's
  embedded figure is in the LABEL, tens of points away from the column edge.

-- HOW THE GENERAL FUND COLUMN IS IDENTIFIED --------------------------------
NOT by "the leftmost number on the row" — that is sound only for a TOTAL row,
where the General Fund cell is guaranteed populated, and it is precisely wrong
for component rows (a blank or `-` General Fund cell makes the leftmost number
belong to a LATER fund).

Instead the column is located by its EDGE, established from the two printed
total rows independently of each other:

  * if both rows' leftmost money token shares a RIGHT edge, the column is
    right-aligned and every component cell is matched on its right edge;
  * else if both share a LEFT edge, it is left-aligned and matched on x0;
  * else this script REFUSES the page rather than guessing. Alignment varies by
    issuer in this corpus — Seattle left-aligns its money, King County
    right-aligns it — so it is derived per document, never assumed.

Two structural facts make the edge test evidence rather than a fit: it is taken
from two DIFFERENT rows that must agree, and it is taken BEFORE any component
is read, so it cannot be tuned toward a total that ties.

A row with two money tokens on the column edge is reported as an AMBIGUOUS row
and fails the page, instead of silently taking one of them.

Output JSON:
  {statement_page, fiscal_year, alignment, column_edge,
   revenue: [{label, amount, cell}], revenue_total,
   expenditure: [{label, amount, cell}], expenditure_total}
where `cell` is 'number' | 'dash' | 'blank'.

Usage:
  py -3 scripts/acfrGfComponents.py docs/ElPasoCounty/el-paso-county-2020-acfr.pdf
  py -3 scripts/acfrGfComponents.py docs/ColoradoSprings/colorado-springs-2024-acfr.pdf --title-anchor springs
  py -3 scripts/acfrGfComponents.py <pdf> --page 44 --units 1000
"""

import argparse
import json
import re
import sys

import pdfplumber

# Reuse the row clustering, number repair and total-row reading that
# acfrPrintedTotal.py already proved on 54/54 probes. Importing them keeps this
# a SECOND READER OF THE COLUMN rather than a second implementation of
# pdfplumber mechanics — the independence that matters is from acfrGF.py, and
# that is total.
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))
from acfrPrintedTotal import (  # noqa: E402
    lines_of, parse_money, numbers_on, _EXCLUDE, _TITLE,
)

EDGE_TOL = 4.0          # points; adjacent fund columns are 50-90pt apart
ALIGN_TOL = 2.5         # the two total rows must agree this closely
_DASH = re.compile(r'^[-–—]+$')
# A LONE currency symbol, which issuers set to the LEFT of the first row's cell
# and which therefore falls on the label side of the column boundary. Stripping
# it is what keeps the published label "Property taxes" rather than
# "Property taxes $". A token containing digits ("$4,477,783", part of El Paso's
# printed TABOR label) has no chance of matching and is kept.
_BARE_CURRENCY = re.compile(r'^\$+$')

REV_TOTAL = re.compile(r'^(?:Total|Net)\s+(?:operating\s+)?revenues\b', re.I)
EXP_TOTAL = re.compile(r'^Total\s+expenditures\b', re.I)
REV_BANNER = re.compile(r'^revenues?\s*:?\s*$', re.I)
EXP_BANNER = re.compile(r'^expenditures?\s*:?\s*$', re.I)

# Colorado Springs prints its own name down the RIGHT MARGIN of the statement
# heading, so the shared `_TITLE` regex cannot span the title at all (the words
# "EXPENDITURES" and "AND CHANGES" are separated by "COLORADO", not by
# whitespace). Same override as `scripts/extractColoradoSprings.py` carries, and
# for the same reason -- see that file for why it is not a scope loophole: every
# other page this reaches is still rejected by `_EXCLUDE`.
TITLE_ANCHORS = {
    'springs': re.compile(
        r'STATEMENT\s+OF\s+REVENUES,?\s+EXPENDITURES[\s\S]{0,300}?CHANGES\s+IN\s+FUND\s+BALANCES?',
        re.I),
}


def row_text(ws):
    return ' '.join(w['text'] for w in ws)


def find_statement(pdf, title_anchor=None):
    """Earliest page carrying the primary governmental-funds statement.

    Same qualifying rule as acfrGF.find_statement_page and
    acfrPrintedTotal.find_statement — the question being cross-checked is
    "what does the General Fund column of THAT page say", not "which page is
    it". Reading a different page would not be a second read of the same
    figure.
    """
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        low = text.lower()
        if not (_TITLE.search(text) or (title_anchor and title_anchor.search(text))):
            continue
        if not any(lbl in low for lbl in ('total revenues', 'total operating revenues', 'net revenues')):
            continue
        if 'total expenditures' not in low:
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in low for x in _EXCLUDE):
            continue
        return i, page, text
    return None, None, None


def leftmost_money_word(ws):
    """The leftmost word on `ws` that parses as money, with its edges."""
    for w in ws:
        if parse_money(w['text']) is not None:
            return w
    return None


def total_row(rows, label_re):
    for ws in rows:
        if label_re.match(row_text(ws)):
            w = leftmost_money_word(ws)
            if w is not None:
                return ws, w
    return None, None


def establish_column(rows):
    """(alignment, edge) for the General Fund column, or (None, reason).

    Derived from the two printed TOTAL rows — the one place the General Fund
    cell is guaranteed populated — and only accepted when those two independent
    rows agree to within ALIGN_TOL.
    """
    _, rev_w = total_row(rows, REV_TOTAL)
    _, exp_w = total_row(rows, EXP_TOTAL)
    if rev_w is None or exp_w is None:
        return None, 'could not locate both printed total rows'
    if abs(rev_w['x1'] - exp_w['x1']) <= ALIGN_TOL:
        return 'right', (rev_w['x1'] + exp_w['x1']) / 2
    if abs(rev_w['x0'] - exp_w['x0']) <= ALIGN_TOL:
        return 'left', (rev_w['x0'] + exp_w['x0']) / 2
    return None, ('the two total rows agree on neither edge '
                  f'(right {rev_w["x1"]:.1f} vs {exp_w["x1"]:.1f}; '
                  f'left {rev_w["x0"]:.1f} vs {exp_w["x0"]:.1f})')


def edge_of(w, alignment):
    return w['x1'] if alignment == 'right' else w['x0']


def gf_cell(ws, alignment, edge):
    """(amount, kind, error) for the General Fund cell of one row.

    kind is 'number' | 'dash' | 'blank'. A blank or dash cell is a real $0 —
    the issuer printed nothing there — and is NOT the leftmost number on the
    row, which is the trap this whole script exists to avoid.
    """
    on_edge = [w for w in ws if abs(edge_of(w, alignment) - edge) <= EDGE_TOL]
    money = [w for w in on_edge if parse_money(w['text']) is not None]
    if len(money) > 1:
        return None, None, f'AMBIGUOUS: {len(money)} money tokens on the column edge'
    if money:
        return parse_money(money[0]['text']), 'number', None
    if any(_DASH.match(w['text']) for w in on_edge):
        return 0, 'dash', None
    return 0, 'blank', None


def all_column_edges(rows, alignment):
    """Every fund column's edge, taken from the two printed TOTAL rows.

    The total rows are the one place every fund column is populated, so they
    state the grid. Used to tell a REAL line item whose General Fund cell is
    empty (it still has cells in other funds) from a CONTINUED LABEL (which has
    no cell in any fund).
    """
    edges = []
    for lre in (REV_TOTAL, EXP_TOTAL):
        for ws in rows:
            if lre.match(row_text(ws)):
                edges += [edge_of(w, alignment) for w in ws if parse_money(w['text']) is not None]
                break
    return edges


def on_any_column(ws, alignment, edges):
    """True when the row has a cell (number or dash) on ANY fund column edge."""
    for w in ws:
        if parse_money(w['text']) is None and not _DASH.match(w['text']):
            continue
        if any(abs(edge_of(w, alignment) - e) <= EDGE_TOL for e in edges):
            return True
    return False


def column_left(rows, alignment, edge):
    """Left extent of the General Fund column, measured from its own cells.

    The label/column boundary must NOT be a fixed guess. It was 95pt at first,
    and that silently TRUNCATED THE ISSUER'S OWN LABELS: El Paso's
    "Sales taxes net of $4,477,783 TABOR limitation" published as
    "Sales taxes net of $4,477,783", because the trailing words sit in the gap
    between the label area and the column. The amount was right and the tie was
    $0 — a label-only defect, invisible to every arithmetic check.

    So the boundary is derived: the smallest x0 of any cell actually found ON the
    column edge. Nothing left of that can be part of a General Fund figure, and
    everything left of it is label.
    """
    xs = []
    for ws in rows:
        for w in ws:
            if abs(edge_of(w, alignment) - edge) <= EDGE_TOL and (
                    parse_money(w['text']) is not None or _DASH.match(w['text'])):
                xs.append(w['x0'])
    if xs:
        return min(xs)
    return (edge - 95.0) if alignment == 'right' else (edge - 4.0)


def label_indent(ws, label_bound):
    """x0 of the row's leftmost LABEL word — the printed indentation, in points.

    This is the true glyph indentation, not the leading-space count `pdftotext
    -table` flattens away. Expenditure nesting is read off it directly, which is
    why `scripts/extractElPasoCountyCoords.py` needs no hand-declared `parents`
    / `root_leaves` config: the document states its own hierarchy and this is
    where it says it. A tie proves arithmetic, never structure — indentation is
    the structural evidence.
    """
    xs = [w['x0'] for w in ws if w['x1'] <= label_bound]
    return round(min(xs), 2) if xs else None


def label_of(ws, label_bound):
    """Printed row label: every word that lies LEFT of the fund columns.

    The cut is `column_left` — the General Fund column's own measured left edge.
    This is what keeps El Paso's TABOR disclosure ("Sales taxes net of
    $4,477,783 TABOR limitation") intact AS A LABEL, in full: the embedded
    figure sits in the label area, so it is neither dropped from the label, nor
    truncated out of it, nor mistaken for the amount.
    """
    words = [w['text'] for w in ws if w['x1'] <= label_bound and not _BARE_CURRENCY.match(w['text'])]
    return ' '.join(words).strip()


def section_rows(rows, banner_re, total_re):
    """Rows strictly between a section banner and that section's total row.

    Falls back to "everything before the total row" when the issuer prints no
    banner (some years label the sections only by indentation), because the
    total row is the boundary that actually matters.
    """
    start = None
    end = None
    for i, ws in enumerate(rows):
        t = row_text(ws)
        if start is None and banner_re.match(t):
            start = i + 1
        if total_re.match(t):
            end = i
            break
    if end is None:
        return []
    return rows[(start if start is not None and start < end else 0):end]


INDENT_MATCH_TOL = 1.5


def collect(rows, banner_re, total_re, alignment, edge, units, weld=None):
    """General Fund line items of one section.

    `weld='disclosure'` rejoins a label the issuer wrapped across two printed
    lines. It is OPT-IN: the default is to weld NOTHING and to report a dangling
    fragment as an error, so a caller can never get a silently mis-joined label
    by omission. Welds are always listed in the return value.

    -- WHY THE WELD EXISTS (a real defect, found by reading the output) -------
    El Paso County discloses its TABOR refund inside the revenue label, and in
    some years that label WRAPS across two printed lines:

        Sales taxes (net of $15,174,442 TABOR      <- no General Fund cell
        limitation)                        61,837,624

    Read row-by-row, the money lands on the SECOND line, so the published
    category was literally named `limitation)` (FY2016), `limitation`
    (FY2022) and `$15,174,442` (FY2017) — while the amounts were correct and
    the tie stayed at exactly $0. That is the Kent wrapped-label defect class
    the shared module documents: a tie proves arithmetic, never labels.

    -- HOW A WRAP IS TOLD FROM A GROUP HEADING -------------------------------
    Both are rows with no money in the General Fund column, so the cell alone
    cannot separate them. Two coordinate facts do:

      * `cell == 'blank'` — nothing at all on the column edge. This issuer
        writes a genuinely EMPTY cell as an explicit DASH ('Highway user
        taxes' reads `cell='dash'`), so 'blank' means the row has no cell of
        its own, which is what a continued label looks like.
      * SAME INDENT as the row that follows. A group heading sits SHALLOWER
        than its children by a measured 5.0pt ('Current:' at x0=69.8, its
        children at 74.8), so it is never welded and the expenditure nesting
        survives. A wrapped label's two lines share one x0 exactly.

    Both conditions must hold, and the following row must carry an actual
    number, so a heading, a dash-cell line item, and a stray rule are all left
    alone. Welds are reported in the output so they can be reviewed rather than
    trusted.
    """
    section = section_rows(rows, banner_re, total_re)
    label_bound = column_left(rows, alignment, edge) - 2.0
    col_edges = all_column_edges(rows, alignment)
    parsed = []
    for ws in section:
        amount, kind, err = gf_cell(ws, alignment, edge)
        label = label_of(ws, label_bound)
        parsed.append({
            'label': label,
            'amount': None if err else amount,
            'cell': kind,
            'indent': label_indent(ws, label_bound),
            'error': err,
            'raw': row_text(ws)[:60],
            # Does the LABEL itself carry a printed figure? El Paso's multi-line
            # labels are multi-line precisely because they disclose a TABOR
            # refund inside the label; this is what identifies them.
            'label_money': any(c.isdigit() for c in label),
            # Does the row occupy the column grid at all?
            'on_grid': on_any_column(ws, alignment, col_edges),
        })

    out, errors, welds = [], [], []
    pending = []          # label fragments awaiting the row that carries money
    for i, r in enumerate(parsed):
        if r['error']:
            errors.append(f'{r["label"] or r["raw"]}: {r["error"]}')
            pending = []
            continue
        if not r['label']:
            # No label left of the columns: a continuation of the column area or
            # a stray rule, not a line item. Never silently summed.
            continue

        nxt = parsed[i + 1] if i + 1 < len(parsed) else None
        is_wrap_prefix = (
            weld == 'disclosure'
            and r['cell'] == 'blank'
            and nxt is not None and not nxt['error']
            and nxt['cell'] == 'number'
            and r['indent'] is not None and nxt['indent'] is not None
            and abs(r['indent'] - nxt['indent']) <= INDENT_MATCH_TOL
            # GUARD 1 — the prefix must not occupy the column grid. A REAL line
            # item with an empty General Fund cell still prints cells in the
            # other funds ('Highway user taxes' and 'Public works' both do, at
            # the Road-and-Bridge edge), and welding one forward published
            # 'Highway user taxes Intergovernmental' and 'Public works Health
            # and welfare' — two complete labels fused into one, tying $0.
            and not r['on_grid']
            # GUARD 2 — the wrap must be caused by an embedded DISCLOSURE
            # FIGURE, in the prefix or in the continuation. Every genuine
            # multi-line label in this corpus is a TABOR disclosure and carries
            # one ('Sales taxes net of $31,551,234 TABOR limitation'; FY2017
            # puts the figure on the second line). Without this, 'Outside
            # agencies' — a real line item blank in EVERY column, so GUARD 1
            # cannot see it — was welded onto 'Auxiliary services'.
            and (r['label_money'] or nxt['label_money'])
        )
        if is_wrap_prefix:
            pending.append(r['label'])
            continue

        label = ' '.join([*pending, r['label']]) if pending else r['label']
        if pending:
            welds.append(label)
        pending = []
        out.append({'label': label, 'amount': r['amount'] * units,
                    'cell': r['cell'], 'indent': r['indent']})
    if pending:
        errors.append(f'label fragment never joined to a valued row: {pending!r}')
    return out, errors, welds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--units', type=int, default=1)
    ap.add_argument('--page', type=int, default=None, help='1-based statement page (skips the search)')
    ap.add_argument('--title-anchor', choices=sorted(TITLE_ANCHORS), default=None)
    args = ap.parse_args()

    anchor = TITLE_ANCHORS.get(args.title_anchor)

    with pdfplumber.open(args.pdf_path) as pdf:
        if args.page:
            idx = args.page - 1
            page = pdf.pages[idx]
            text = page.extract_text() or ''
        else:
            idx, page, text = find_statement(pdf, anchor)
        if page is None:
            print(json.dumps({'error': 'primary GF statement page not found'}))
            sys.exit(3)
        rows = lines_of(page)
        alignment, edge = establish_column(rows)
        if alignment is None:
            print(json.dumps({'error': f'General Fund column not established: {edge}'}))
            sys.exit(4)
        rev_cols, _ = numbers_on(rows, REV_TOTAL)
        exp_cols, _ = numbers_on(rows, EXP_TOTAL)
        revenue, rev_err, rev_weld = collect(rows, REV_BANNER, REV_TOTAL, alignment, edge, args.units)
        expenditure, exp_err, exp_weld = collect(rows, EXP_BANNER, EXP_TOTAL, alignment, edge, args.units)
        m = re.search(r'year\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)

    result = {
        'statement_page': idx + 1,
        'fiscal_year': int(m.group(1)) if m else None,
        'alignment': alignment,
        'column_edge': round(edge, 2),
        'units': args.units,
        'revenue': revenue,
        'revenue_total': (rev_cols[0] * args.units) if rev_cols else None,
        'revenue_component_sum': sum(r['amount'] for r in revenue),
        'expenditure': expenditure,
        'expenditure_total': (exp_cols[0] * args.units) if exp_cols else None,
        'expenditure_component_sum': sum(r['amount'] for r in expenditure),
        'errors': rev_err + exp_err,
        # Labels rejoined from a wrapped printed label, listed so a weld is
        # reviewable rather than invisible.
        'welded_labels': rev_weld + exp_weld,
    }
    print(json.dumps(result, indent=2))
    # A page whose components do not reproduce its own printed totals is
    # reported, not hidden — but it is the CALLER's job to decide, so this exits
    # 0 and the caller compares. Exiting non-zero here would make the oracle
    # itself a tie gate, and the tie is what it exists to be independent of.


if __name__ == '__main__':
    main()
