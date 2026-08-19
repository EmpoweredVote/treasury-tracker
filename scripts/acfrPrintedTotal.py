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
_MONEY_FRAG = re.compile(r'^\(?\$?[\d,]+\)?$')
MERGE_GAP = 1.5


def parse_money(tok):
    t = tok.replace('$', '').replace(',', '').strip()
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
        if (out and _MONEY_FRAG.match(out[-1]['text']) and _MONEY_FRAG.match(w['text'])
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
        if 'total revenues' not in low and 'total operating revenues' not in low:
            continue
        if 'total expenditures' not in low:
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in low for x in _EXCLUDE):
            continue
        return i, page, text
    return None, None, None


def first_number_on(rows, label_re):
    """Leftmost money value on the first row whose text starts with `label_re`."""
    for ws in rows:
        text = ' '.join(w['text'] for w in ws)
        if not label_re.match(text):
            continue
        for w in ws:
            if _MONEY.match(w['text']):
                v = parse_money(w['text'])
                if v is not None:
                    return v, text
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--units', type=int, default=1)
    args = ap.parse_args()

    with pdfplumber.open(args.pdf_path) as pdf:
        idx, page, text = find_statement(pdf)
        if page is None:
            print(json.dumps({'error': 'primary GF statement page not found'}))
            sys.exit(3)
        rows = lines_of(page)
        rev, rev_row = first_number_on(rows, re.compile(r'^Total\s+(operating\s+)?revenues\b', re.I))
        exp, exp_row = first_number_on(rows, re.compile(r'^Total\s+expenditures\b', re.I))
        m = re.search(r'year\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)

    if rev is None or exp is None:
        print(json.dumps({'error': 'printed total row not located',
                          'revenue_row': rev_row, 'expenditure_row': exp_row}))
        sys.exit(4)

    print(json.dumps({
        'statement_page': idx + 1,
        'fiscal_year': int(m.group(1)) if m else None,
        'revenue_total': rev * args.units,
        'expenditure_total': exp * args.units,
        'units': args.units,
    }, indent=2))


if __name__ == '__main__':
    main()
