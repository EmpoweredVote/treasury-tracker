#!/usr/bin/env python3
"""
INDEPENDENT glyph-level re-derivation of NYC's printed statement figures.

Corroboration only -- `scripts/extractNYC.py` remains the loader's reader.
This exists because `exclude_ignore=('reconciliation','net position')` WIDENS
which pages can qualify, and the library's own docstring requires that be
paired with evidence that the page chosen is the right one.

── WHY NOT `scripts/lib/acfrGfCoords.py` ───────────────────────────────────

That module was the obvious choice and it does not fit, for two measured
reasons (2026-10-09):

  1. It is GENERAL-FUND-ONLY. `CoordsConfig` has no `target_column`, so it
     could never corroborate the total-governmental series at all.
  2. It cannot read this issuer unaided. Its `REV_TOTAL` / `EXP_TOTAL`
     anchors do not match, because NYC letter-spaces its glyphs: the row
     reads `T otal revenues`, not `Total revenues`. And pdfplumber sees the
     underline rules as underscore glyphs merged into the word text --
     `_1_1_2_,_3_8_7_,4_0_7_` -- exactly as `pdftotext -table` does.

     ⚠ That second point corrects an assumption worth recording: the glyph
     reader is NOT immune to the underline rules. Both readers need the same
     repair. What it IS independent on is PAGE CHOICE and COLUMN ASSIGNMENT,
     which is precisely what `exclude_ignore` and the positional/ordinal
     question put at risk.

Making acfrGfCoords read NYC would mean editing shared anchors relied on by
the eight entities already on it. This file instead does its own reading, with
its own repairs, touching nothing shared.

── WHAT IT CHECKS ──────────────────────────────────────────────────────────

For one PDF and fiscal year, using pdfplumber (a different library from
poppler's `pdftotext`), finding its own page from scratch:

  * the page index of the Governmental Funds statement for THAT year
  * the printed `Total revenues`   in the FIRST money column (General Fund)
    and in the LAST money column   (Total Governmental Funds)
  * the printed `Total expenditures` in both

Emits JSON. `scripts/verify-nyc.mjs` compares it against the loader's reader.

Usage:
  py -3 scripts/verifyNycGlyphs.py "docs/NYC/nyc-2024-acfr.pdf" 2024
"""

import json
import re
import sys

import pdfplumber

# Underline rules arrive as underscore glyphs merged into the word text.
_RULES = re.compile(r'_+')
# Letter-spacing splits words anywhere, so every test squashes whitespace.
_WS = re.compile(r'\s+')
_MONEY = re.compile(r'\((\d[\d,]*)\)|(\d[\d,]*)')


def squash(s):
    return _WS.sub('', _RULES.sub('', s)).lower()


def row_text(words):
    return ' '.join(w['text'] for w in words)


# ⚠⚠ A CELL IS NOT A WORD. pdfplumber shatters NYC's figures across several
# "words": FY2023 renders 110,943,170 as `1` + `10943170`, and that year's
# Total expenditures row comes back as eight fragments. Reading per word gave
# 10,943,170 for a printed 110,943,170 -- a plausible-looking number, an order
# of magnitude low. Cells are therefore rebuilt by HORIZONTAL GAP.
_CELL_GAP = 3.0   # pt. Intra-cell fragments abut; columns are ~10pt+ apart.


def money_cells(words):
    """Every money value on a row, left to right, as ints.

    Fragments are clustered into cells by x-gap first, then parsed, so a figure
    split across several glyph runs is read whole.
    """
    clusters = []
    for w in sorted(words, key=lambda x: x['x0']):
        if clusters and w['x0'] - clusters[-1][-1]['x1'] <= _CELL_GAP:
            clusters[-1].append(w)
        else:
            clusters.append([w])

    out = []
    for cl in clusters:
        t = _RULES.sub('', ''.join(x['text'] for x in cl)).replace('$', '').strip()
        m = _MONEY.fullmatch(t)
        if not m:
            continue
        neg, pos = m.group(1), m.group(2)
        v = int((neg or pos).replace(',', ''))
        out.append(-v if neg else v)
    return out


def rows_of(page):
    buckets = {}
    for w in page.extract_words():
        buckets.setdefault(round(w['top'] / 3), []).append(w)
    return [sorted(v, key=lambda w: w['x0']) for _, v in sorted(buckets.items())]


def find_page(pdf, fiscal_year):
    """The Governmental Funds statement page for `fiscal_year`, found from
    scratch: title present, budgetary pages rejected, and the printed caption
    matching the requested year."""
    want_caption = squash(f'for the year ended june 30, {fiscal_year}')
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        flat = squash(text)
        if 'governmentalfunds' not in flat:
            continue
        if 'statementofrevenues,expenditures' not in flat:
            continue
        # ⚠ The General-Fund BUDGET AND ACTUAL schedule also carries both total
        # rows, and its last column is a VARIANCE. Reject it explicitly.
        if 'budgetandactual' in flat or 'combining' in flat:
            continue
        head = flat.split('statementofrevenues,expenditures', 1)[0]
        if 'nonmajor' in head or 'combining' in head:
            continue
        if want_caption not in flat:
            continue
        if 'totalrevenues' not in flat or 'totalexpenditures' not in flat:
            continue
        return i, page
    return None, None


def total_cells(rows, which):
    for ws in rows:
        if squash(row_text(ws)).startswith(which):
            cells = money_cells(ws)
            if len(cells) >= 2:
                return cells
    return None


def main():
    path, fy = sys.argv[1], int(sys.argv[2])
    with pdfplumber.open(path) as pdf:
        idx, page = find_page(pdf, fy)
        if page is None:
            print(json.dumps({'error': f'no Governmental Funds statement for FY{fy} in {path}'}))
            sys.exit(3)
        rows = rows_of(page)
        rev = total_cells(rows, 'totalrevenues')
        exp = total_cells(rows, 'totalexpenditures')
    if not rev or not exp:
        print(json.dumps({'error': 'could not read both printed total rows'}))
        sys.exit(3)

    print(json.dumps({
        'fiscal_year': fy,
        'page_index': idx,
        'general_fund': {'revenue': rev[0] * 1000, 'operating': exp[0] * 1000},
        'total_governmental': {'revenue': rev[-1] * 1000, 'operating': exp[-1] * 1000},
        'revenue_columns': len(rev),
        'operating_columns': len(exp),
    }))


if __name__ == '__main__':
    main()
