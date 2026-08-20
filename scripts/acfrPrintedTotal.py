#!/usr/bin/env python3
"""
Independent oracle: read the PRINTED General Fund total off an ACFR statement
page using pdfplumber GLYPH COORDINATES.

This exists to check `scripts/lib/acfrGF.py` from the outside. It shares no code
and no strategy with it:

  acfrGF.py           `pdftotext -table`, then assigns every money token to the
                      nearest column ANCHOR derived from the Total rows, then
                      SUMS the component rows and compares that sum to the
                      printed total.

  this script         pdfplumber word coordinates straight from the PDF's own
                      glyph positions, then reads the single printed TOTAL cell
                      and nothing else.

So agreement between the two means a real figure was read twice by different
means, not that one implementation is self-consistent. That distinction matters
here: `tie_delta == 0` proves the components sum to the printed total, which is
an arithmetic property INTERNAL to one parse — it stays 0 under a wrong `units`
multiplier and under wrong nesting.

Why "the first number after the label" is a sound rule FOR A TOTAL ROW: a fund
column whose cell is blank or `-` makes the first number on a row belong to a
LATER column, which is exactly the trap that makes per-row column assignment
hard. The `Total revenues` / `Total expenditures` rows are the one place the
General Fund cell is guaranteed populated — they are what acfrGF.py itself
anchors its columns from — so the leftmost number on those rows is the General
Fund figure. This holds even on Austin's FY2002-FY2009 four-column comparative
layout, which defeats `-table` column assignment entirely.

Output: JSON {statement_page, fiscal_year, revenue_total, expenditure_total},
in the units PRINTED on the page (no scaling — `--units` scales if asked).

Usage:
  python scripts/acfrPrintedTotal.py docs/Austin/austin-2024-acfr.pdf --units 1000
  python scripts/acfrPrintedTotal.py docs/TravisCounty/travis-2025-acfr.pdf
"""

import argparse
import json
import re
import sys

import pdfplumber

_TITLE = re.compile(
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances?',
    re.I)
_EXCLUDE = ('combining', 'reconciliation', 'budgetary', 'budget and actual',
            'proprietary', 'fiduciary', 'net position')
_MONEY = re.compile(r'^\(?\$?\d[\d,]*\)?$')
# A fragment of a money token: digits, commas, and the decorations that can lead
# or trail one. Used only to decide whether two TOUCHING words are two halves of
# one number.
_MONEY_FRAG = re.compile(r'^\(?\$?[\d.,]+\)?$')
MERGE_GAP = 1.5


def strip_leader_dots(tok):
    """Remove DOT-LEADER glyphs that a PDF has interleaved into a number.

    The State of Minnesota's older ACFRs run the row's leader dots straight
    through the figures, so its FY2008 General Fund revenue total extracts as:

        $......1..6..,.6.0..0..,.8..6..4

    which is `16,600,864`. Unrepaired, that token is unparseable, the General
    Fund column drops out of the row, and "the leftmost number" becomes the
    FEDERAL column — 6,271,343 instead of 16,600,864. The harness reported a
    factor of 2647 against a database row that was exactly right.

    THE GUARD IS THE DOT COUNT: two or more dots, and only when removing every
    dot leaves a clean integer (digits and commas). A genuine decimal has ONE
    dot, so "1.5" and "16.5" are never touched. These statements print whole
    thousands with no decimal places in the fund columns anyway.
    """
    if tok.count('.') < 2:
        return tok
    cleaned = tok.replace('.', '')
    core = cleaned.replace('$', '').replace(',', '').strip('()')
    return cleaned if core.isdigit() and core != '' else tok


def parse_money(tok):
    t = strip_leader_dots(tok).replace('$', '').replace(',', '').strip()
    neg = t.startswith('(')
    t = t.strip('()')
    if not t.isdigit():
        return None
    return -int(t) if neg else int(t)


ROW_GAP = 4.0


def lines_of(page):
    """Group words into visual rows by clustering their vertical midpoints.

    NOT a fixed grid. The first version of this function bucketed by
    `round(midpoint / 2.5)`, and that silently returned the WRONG COLUMN on the
    very first document it was pointed at. Austin's FY2024 statement sets the
    General Fund total 1.2pt lower than its own label:

        top=481.490  "Total expenditures"      -> midpoint 485.99 -> bucket 194
        top=482.696  1,347,127   (General)     -> midpoint 487.20 -> bucket 195
        top=481.481  1,534,052   (Nonmajor)    -> midpoint 485.98 -> bucket 194

    The General Fund figure fell out of its own row and the Nonmajor figure
    stayed in, so "the leftmost number on the total row" confidently read
    $1,534,052 thousand — a real number from the wrong fund. Nothing about the
    output looked malformed.

    Any fixed grid has this failure mode: two points 1.2pt apart land in
    different cells whenever a cell boundary happens to fall between them.
    Single-linkage clustering on sorted midpoints has no boundaries to straddle
    — a new row starts only where there is a genuine vertical GAP. Statement
    rows here are ~10.5pt apart and intra-row jitter is ~1.2pt, so ROW_GAP=4.0
    sits an order of magnitude clear of both.
    """
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return []
    for w in words:
        w['_mid'] = (w['top'] + w['bottom']) / 2
    words.sort(key=lambda w: w['_mid'])

    rows, current = [], [words[0]]
    for w in words[1:]:
        if w['_mid'] - current[-1]['_mid'] > ROW_GAP:
            rows.append(current)
            current = [w]
        else:
            current.append(w)
    rows.append(current)
    return [merge_split_numbers(sorted(ws, key=lambda w: w['x0'])) for ws in rows]


def _is_money_fragment(tok):
    """Could `tok` be part of one printed number?

    Dots are tolerated because dot-LEADER runs get welded onto and into figures
    (see `strip_leader_dots`); on Minnesota's FY2008 statement the General Fund
    revenue total arrives as two overlapping words,
    `.....$......1` and `..6..,.6.0..0..,.8..6..4.............$....`,
    which are `16,600,864` once the leaders come out.

    A fragment must still contain at least one DIGIT, so a label's own leader run
    (`Revenues..........`, or a bare `.........`) can never be merged onto the
    figure that follows it — which is what keeps this from gluing text to money.
    """
    if not any(c.isdigit() for c in tok):
        return False
    return _MONEY_FRAG.match(tok.replace('.', '').replace('$', '') or '_') is not None


def merge_split_numbers(ws):
    """Rejoin a single printed number that pdfplumber returned as two words.

    Travis County's FY2018, FY2021 and FY2022 statements split the LEADING DIGIT
    of a total off the rest of the number:

        x0=295.45  '6'            <- x1 ~= 300.3
        x0=300.38  '27,129,640'   <- gap ~= 0.1pt

    Both fragments are one printed `627,129,640`. Read as separate words, the
    "leftmost number on the total row" is `6`, and the harness reported a
    627-million-dollar discrepancy against a database row that was in fact
    correct. (These statements report `size=0.0` for every char, so
    `extract_words`' tolerance heuristics have nothing to scale from — which is
    the likeliest reason the split happens at all.)

    Two guards keep this from gluing unrelated cells together:

      * BOTH neighbours must look like pieces of a number. Label words are never
        merged, so `Total` + `revenues` is untouched and the row-matching regex
        still works.
      * The gap must be under MERGE_GAP (1.5pt), i.e. the glyphs are touching.
        Adjacent fund COLUMNS in this corpus are 50-90pt apart, so no real
        column boundary is anywhere near this threshold.
    """
    out = []
    for w in ws:
        if (out and _is_money_fragment(out[-1]['text']) and _is_money_fragment(w['text'])
                and w['x0'] - out[-1]['x1'] < MERGE_GAP):
            prev = out[-1]
            out[-1] = {**prev, 'text': prev['text'] + w['text'], 'x1': w['x1']}
        else:
            out.append(w)
    return out


def find_statement(pdf):
    """Earliest page carrying the primary governmental-funds statement.

    Same qualifying rule as acfrGF.find_statement_page — title present, BOTH
    printed totals present, 'general' and 'fund' present, and none of the
    _EXCLUDE words — because the question being cross-checked is 'what does the
    General Fund column of THAT page say', not 'which page is it'. Picking a
    different page would not be an independent read of the same figure.
    """
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        low = text.lower()
        if not _TITLE.search(text):
            continue
        # The revenue-subtotal label VARIES by issuer and the variants are not
        # cosmetic: the State of Minnesota's governmental-funds statement prints
        # "Net Revenues" (its revenue lines are stated net of refunds), and
        # Bainbridge-era filings print "Total Operating Revenues". Requiring only
        # "total revenues" silently reports "statement page not found" for a
        # document whose statement is right there.
        #
        # The EXPENDITURE side stays the hard literal 'total expenditures' on
        # purpose — same asymmetry acfrGF.py documents. A proprietary-funds
        # statement prints "Total Operating Revenues" next to "Total Operating
        # EXPENSES", never "Total Expenditures", so widening only the revenue
        # side cannot let a proprietary page qualify as the governmental one.
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


def numbers_on(rows, label_re):
    """(all money values, row text) for the first row matching `label_re`.

    Returned left to right, i.e. in printed COLUMN ORDER. For a governmental-funds
    statement the General Fund is column 0 and the rightmost value is normally the
    Total Governmental column — normally, not always: an issuer that splits its
    fund columns across two pages (Travis County) prints only the first few
    columns on the statement page and carries `Total` onto the continued page. So
    callers get the whole row and decide, rather than being handed a "total" this
    script guessed at.
    """
    for ws in rows:
        text = ' '.join(w['text'] for w in ws)
        if not label_re.match(text):
            continue
        # `parse_money` is the single arbiter of what counts as money — it
        # returns None for anything else, including a bare '-' cell. Gating on a
        # regex FIRST (as this did originally) meant a dot-shredded token was
        # rejected before parse_money ever got the chance to repair it.
        vals = [v for v in (parse_money(w['text']) for w in ws) if v is not None]
        if vals:
            return vals, text
    return None, None


def first_number_on(rows, label_re):
    """Leftmost money value on the first row whose text starts with `label_re`."""
    vals, text = numbers_on(rows, label_re)
    return (vals[0] if vals else None), text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--units', type=int, default=1)
    # Skip the page search and read the page given (1-based). `find_statement`
    # calls extract_text() on every page, which on a 300-page ACFR costs minutes;
    # this is for when the statement page is already known (from a prior run, or
    # from a cheap `pdftotext` scan).
    #
    # It does NOT weaken the cross-check. What makes this an independent read is
    # that the VALUE and its COLUMN come from the PDF's own glyph coordinates —
    # page selection is a lookup, and `find_statement` deliberately mirrors
    # acfrGF's own page-qualifying rule anyway, since reading a different page
    # would not be a second read of the same figure.
    ap.add_argument('--page', type=int, default=None, help='1-based statement page (skips the search)')
    args = ap.parse_args()

    with pdfplumber.open(args.pdf_path) as pdf:
        if args.page:
            idx = args.page - 1
            page = pdf.pages[idx]
            text = page.extract_text() or ''
        else:
            idx, page, text = find_statement(pdf)
        if page is None:
            print(json.dumps({'error': 'primary GF statement page not found'}))
            sys.exit(3)
        rows = lines_of(page)
        rev_cols, rev_row = numbers_on(rows, re.compile(r'^(?:Total|Net)\s+(operating\s+)?revenues\b', re.I))
        exp_cols, exp_row = numbers_on(rows, re.compile(r'^Total\s+expenditures\b', re.I))
        m = re.search(r'year\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)

    if not rev_cols or not exp_cols:
        print(json.dumps({'error': 'printed total row not located',
                          'revenue_row': rev_row, 'expenditure_row': exp_row}))
        sys.exit(4)

    print(json.dumps({
        'statement_page': idx + 1,
        'fiscal_year': int(m.group(1)) if m else None,
        # Column 0 = General Fund. Kept under the original names so
        # verify-austin-travis.mjs keeps working unchanged.
        'revenue_total': rev_cols[0] * args.units,
        'expenditure_total': exp_cols[0] * args.units,
        # Every printed column, left to right, UNSCALED — so a caller can see the
        # Total Governmental column (the discriminator that decides General Fund
        # vs total_governmental scope) and can derive the unit factor itself
        # instead of being told one.
        'revenue_columns': rev_cols,
        'expenditure_columns': exp_cols,
        'units': args.units,
    }, indent=2))


if __name__ == '__main__':
    main()
