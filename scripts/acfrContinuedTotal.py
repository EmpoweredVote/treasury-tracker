#!/usr/bin/env python3
"""
Recover the printed TOTAL (all governmental funds) column when a statement
splits its fund columns across two pages.

Several issuers print only the first few fund columns on the statement page and
carry the rest, plus the `Total` column, onto a "(Continued)" page — Ohio,
Oro Valley, Hillsboro and Virginia all do it in this corpus. On such a document
the rightmost number on the statement page is NOT the total (it is whichever
fund happened to fit), so `acfrPrintedTotal.py`'s last column cannot be used as
the general-fund-vs-total-governmental discriminator.

The continued page carries no row LABELS — they are on the page before — so the
right row cannot be found by matching text. It is found by an ADDITIVE IDENTITY
instead, which is self-validating: for the correct row,

    sum(statement page columns) + sum(continued row's leading columns)
        == continued row's LAST column

Any other row fails that equation, and a row that satisfies it has proved it is
the same statement line — no positional guessing, no trusting row order across a
page break. A candidate is reported only when the identity holds EXACTLY.

Usage:
  python scripts/acfrContinuedTotal.py <pdf> --page 50 --continued 51
  python scripts/acfrContinuedTotal.py <pdf> --page 50            # continued = page+1
"""

import argparse
import json
import re
import sys

import pdfplumber

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from acfrPrintedTotal import lines_of, numbers_on, parse_money  # noqa: E402

_REV = re.compile(r'^(?:Total|Net)\s+(operating\s+)?revenues\b', re.I)
_EXP = re.compile(r'^Total\s+expenditures\b', re.I)


def rows_of(page):
    return lines_of(page)


def all_number_rows(page):
    """Every row on a label-less continued page, as its list of money values."""
    out = []
    for ws in rows_of(page):
        vals = [v for v in (parse_money(w['text']) for w in ws) if v is not None]
        if len(vals) >= 2:
            out.append(vals)
    return out


def find_total(front_cols, cont_rows):
    """Rows on the continued page whose last column completes `front_cols`."""
    front = sum(front_cols)
    hits = []
    for vals in cont_rows:
        *lead, last = vals
        if front + sum(lead) == last:
            hits.append({'total': last, 'continued_columns': vals})
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--page', type=int, required=True, help='1-based statement page')
    ap.add_argument('--continued', type=int, default=None, help='1-based continued page (default: page+1)')
    args = ap.parse_args()
    cont_no = args.continued or args.page + 1

    with pdfplumber.open(args.pdf_path) as pdf:
        stmt = pdf.pages[args.page - 1]
        cont = pdf.pages[cont_no - 1]
        rev_front, _ = numbers_on(rows_of(stmt), _REV)
        exp_front, _ = numbers_on(rows_of(stmt), _EXP)
        cont_rows = all_number_rows(cont)

    if not rev_front or not exp_front:
        print(json.dumps({'error': 'total rows not found on the statement page'}))
        sys.exit(3)

    out = {
        'statement_page': args.page,
        'continued_page': cont_no,
        'revenue': {
            'front_columns': rev_front,
            'front_sum': sum(rev_front),
            'candidates': find_total(rev_front, cont_rows),
        },
        'expenditure': {
            'front_columns': exp_front,
            'front_sum': sum(exp_front),
            'candidates': find_total(exp_front, cont_rows),
        },
    }
    for side in ('revenue', 'expenditure'):
        c = out[side]['candidates']
        out[side]['unique'] = len(c) == 1
        if len(c) == 1:
            gf = out[side]['front_columns'][0]
            out[side]['general_fund'] = gf
            out[side]['total_governmental'] = c[0]['total']
            out[side]['gf_share_pct'] = round(gf / c[0]['total'] * 100, 1)
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
