#!/usr/bin/env python3
"""
NC-DURHAM-AVL-01 scope evidence probe.

Answers the ONE question that decides `fund_scope`: is the figure this
milestone stored the GENERAL FUND column of the governmental-funds statement,
or some wider column?

The registries require EVIDENCE, not assertion, so this reads each statement
independently of both loaders and prints:

  * the General Fund column's printed Total revenues / Total expenditures,
  * the TOTAL GOVERNMENTAL column's, and
  * a SELF-VALIDATING CHECK that every fund column sums exactly to the total.

⚠ WHY THE SUM CHECK IS THE POINT. Reading "the rightmost number on the total
row" and calling it Total Governmental is a guess — on a statement whose
columns are Nonmajor / Total it is right, and on one whose last column is a
nonmajor fund it is silently wrong by the size of that fund. Requiring the
other columns to ADD UP to the candidate makes the identification
self-checking: if the arithmetic does not close, the probe says so and refuses
to name a total rather than reporting a plausible wrong number.

⚠ THESE STATEMENTS SPLIT HORIZONTALLY. All four NC entities print more fund
columns than fit one page, so the General Fund sits on page N and the Total
Governmental column on page N+1 — with the label column repeated or, on some
issuers, absent. The probe therefore reads BOTH pages and pools their columns.

Usage:
  py -3 scripts/ncScopeProbe.py docs/DurhamCity/durham-city-2024-acfr.pdf
  py -3 scripts/ncScopeProbe.py <pdf> --page 46
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from acfrPrintedTotal import lines_of, parse_money, _TITLE, _EXCLUDE  # noqa: E402
from acfrContinuedTotal import all_number_rows, find_total  # noqa: E402

import pdfplumber  # noqa: E402

REV = re.compile(r'^Total\s+revenues\b', re.I)
EXP = re.compile(r'^Total\s+expenditures\b', re.I)


def row_text(ws):
    return ' '.join(w['text'] for w in ws)


def totals_on(page, rx):
    """Every money figure on the row matching `rx`, left to right."""
    for ws in lines_of(page):
        if rx.match(row_text(ws).strip()):
            out = []
            for w in ws:
                v = parse_money(w['text'])
                if v is not None:
                    out.append(v)
            return out
    return []


def find_page(pdf, exclude_ignore=()):
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        low = text.lower()
        if not _TITLE.search(text):
            continue
        if 'total revenues' not in low or 'total expenditures' not in low:
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in low for x in _EXCLUDE if x not in exclude_ignore):
            continue
        return i, page
    return None, None


def identify_total(cols):
    """(total, components) where the components sum EXACTLY to the total.

    Tries each figure as the candidate Total Governmental column and requires
    every OTHER figure to add up to it. Returns (None, None) when no figure
    satisfies that, which is the honest answer for a statement with no total
    column on the pages read.
    """
    for i, cand in enumerate(cols):
        others = cols[:i] + cols[i + 1:]
        if others and sum(others) == cand:
            return cand, others
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--page', type=int, default=None)
    ap.add_argument('--exclude-ignore', action='append', default=None)
    args = ap.parse_args()

    with pdfplumber.open(args.pdf_path) as pdf:
        if args.page:
            idx, page = args.page - 1, pdf.pages[args.page - 1]
        else:
            idx, page = find_page(pdf, tuple(args.exclude_ignore or ()))
        if page is None:
            print(json.dumps({'error': 'statement page not found'}))
            sys.exit(3)

        rev = totals_on(page, REV)
        exp = totals_on(page, EXP)
        # The continuation page carries the remaining fund columns.
        cont = idx + 1
        n_pages = len(pdf.pages)
        rev_c, exp_c, cont_number_rows = [], [], []
        if cont < n_pages:
            rev_c = totals_on(pdf.pages[cont], REV)
            exp_c = totals_on(pdf.pages[cont], EXP)
            cont_number_rows = all_number_rows(pdf.pages[cont])

        text = page.extract_text() or ''
        m = re.search(r'year\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)

    # ⚠ TRY THE FRONT PAGE ALONE FIRST. Some issuers fit every fund column AND
    # the Total on one page (Buncombe FY2015: five funds then 360,732,789,
    # which is exactly their sum). Pooling a continuation page's figures into
    # that set breaks the identity — no element equals the sum of the rest any
    # more — and the probe would report "no total found" for a statement whose
    # total is printed right there. Only pool when the front page alone does
    # not close.
    def resolve(front, cont, cont_rows):
        t, parts = identify_total(front)
        if t is not None:
            return front, t, parts
        pooled = front + cont
        t, parts = identify_total(pooled)
        if t is not None:
            return pooled, t, parts
        # ⚠ THE LABEL-LESS CONTINUED PAGE. Buncombe County carries its remaining
        # fund columns onto a page with NO row labels at all — they are on the
        # page before — so `totals_on` matches nothing there and the pooled set
        # is just the front page again. `acfrContinuedTotal.find_total` locates
        # the right row by the additive identity instead
        # (front_sum + leading columns == last column), which is self-validating:
        # no other row on the page satisfies it, so nothing is guessed from row
        # order across the page break.
        hits = find_total(front, cont_rows) if front else []
        if len(hits) == 1:
            return front + hits[0]['continued_columns'][:-1], hits[0]['total'], None
        return front, None, None

    cont_rows = []
    if idx + 1 < n_pages:
        cont_rows = cont_number_rows

    rev_all, rev_total, rev_parts = resolve(rev, rev_c, cont_rows)
    exp_all, exp_total, exp_parts = resolve(exp, exp_c, cont_rows)

    out = {
        'pdf': pathlib.Path(args.pdf_path).name,
        'statement_page': idx + 1,
        'continuation_page': cont + 1 if rev_c else None,
        'fiscal_year': int(m.group(1)) if m else None,
        'general_fund_revenue': rev_all[0] if rev_all else None,
        'general_fund_expenditure': exp_all[0] if exp_all else None,
        'total_governmental_revenue': rev_total,
        'total_governmental_expenditure': exp_total,
        'revenue_columns': rev_all,
        'expenditure_columns': exp_all,
        'columns_sum_exactly': rev_total is not None and exp_total is not None,
    }
    if rev_total and rev_all:
        out['gf_share_of_total_revenue'] = round(100 * rev_all[0] / rev_total, 1)
    if exp_total and exp_all:
        out['gf_share_of_total_expenditure'] = round(100 * exp_all[0] / exp_total, 1)
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
