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

# ⚠ EVERY GAP HERE IS `\s*`, NOT `\s+`, BECAUSE SOME PDFs FUSE THEIR WORDS.
# City of Durham FY2023 renders under pdfplumber as
#   "CITYOFDURHAM,NORTHCAROLINA ... StatementofRevenues,ExpendituresandChangesinFundBalances"
# with no spaces at all — the exact inverse of Asheville FY2021/22, which splits
# every word ("A d valo rem taxes"). A `\s+` title cannot match the fused form,
# so the page is reported "not found" for a statement that is plainly there, and
# the whole coordinate family (this reader, acfrGfComponents, acfrGfCoords) then
# has nothing to say about that year. Same reasoning as the `June\s*30` fix in
# the fiscal-year regexes, which exists because pdftotext drops that space too.
_TITLE = re.compile(
    r'Statement\s*of\s*Revenues\s*,?\s*Expenditures\s*,?\s*and\s*Changes\s*in\s*Fund\s*Balances?',
    re.I)
_NOSPACE = re.compile(r'\s+')
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

# Glyphs shorter than this carry NO VISIBLE INK and cannot be part of the
# printed statement, so they are dropped before rows are assembled.
#
# ⚠ WHY THIS EXISTS. Mecklenburg County's FY2024 and FY2025 statements carry a
# GHOST TEXT RUN: the sentence "The accompanying notes are an integral part of
# this statement." is drawn a second time at size 0.10pt, stacked on top of the
# REVENUES banner. Measured on FY2024 page 47:
#
#     top=171.743  h=0.100  x0=55.00  size=0.10  'T'
#     top=171.743  h=0.100  x0=55.05  size=0.10  'h'
#     top=171.743  h=0.100  x0=55.10  size=0.10  'e'
#     ...  the whole sentence inside 2.2pt of horizontal space ...
#
# pdfplumber merges it with the real banner and emits the single word
# 'TRhe statement.EVENUES', so `REV_BANNER` (which requires a line to read
# exactly "REVENUES") matches nothing, `collect` never opens the revenue
# section, and the reader fails with "indented row with no open parent:
# Annual Comprehensive Financial" — the PAGE HEADER, read as a data row.
#
# ⚠ The expenditure side of the SAME page is unaffected, because the ghost run
# only overlaps the revenue banner. That is why FY2024/FY2025 failed in
# `--mode revenue` and passed in `--mode operating`: a partial failure that
# would have been easy to read as a Mecklenburg quirk rather than a reader bug.
#
# The threshold is deliberately far from both populations — real statement type
# is 8-11pt, the ghost run is 0.10pt — so this cannot silently drop printed
# content. It is a filter on VISIBILITY, not on position or wording, so it
# needs no per-entity configuration.
INK_MIN_HEIGHT = 1.0


def _inked(page):
    """`page` with sub-visible glyphs removed. See INK_MIN_HEIGHT."""
    return page.filter(
        lambda obj: obj.get('object_type') != 'char'
        or (obj.get('height') or 0) > INK_MIN_HEIGHT
    )


def lines_of(page, gap=ROW_GAP, left_margin=None, ocr_leading_one=False):
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
    return rows_from_words(
        _inked(page).extract_words(use_text_flow=False, keep_blank_chars=False),
        gap=gap, left_margin=left_margin, ocr_leading_one=ocr_leading_one)


def rows_from_words(words, gap=ROW_GAP, left_margin=None, ocr_leading_one=False):
    """The pure half of `lines_of` — clustering over plain word dicts.

    Split out so the three per-entity knobs below can be tested without a PDF.
    All three default to the behaviour every shipped entity already had, and
    each is opt-in for ONE diagnosed issuer.

    ⚠⚠ `gap` — SINGLE-LINKAGE CHAINS, and that is a real defect, not a
    theoretical one. A row grows while each successive word is within `gap` of
    the PREVIOUS one, so a word printed BETWEEN two statement rows bridges them.
    City of North Charleston FY2016 prints another fund's figure `9,566,068.`
    3.40pt below one row and 3.47pt above the next: two legal hops, one merged
    row, `Property Licenses taxes and pennits` for 4,419,364,731,548,834.

    ⚠ Lower it only on MEASURED evidence, and know the upper bound: across 51
    statement pages of this corpus the widest real row spans 3.42pt and the
    widest DATA row 0.50pt, while a label and its own money can sit 1.2pt apart
    (the Austin case in `lines_of`'s docstring). North Charleston declares 3.0.

    ⚠⚠ `left_margin` — page furniture poisons the INDENT BASELINE. North
    Charleston FY2024 prints a bare `N` and a leader run `,........` at x0 ~32
    where every real row starts at 58.96. `_nested` takes `min(indents)` as the
    section root, so those two glyphs drag the root band 26pt left and every
    genuine row reads as "an indented row with no open parent". Dropping words
    that start left of a declared margin fixes both that and the bridging.
    ⚠ It must clear the junk in EVERY year without cutting a label in ANY of
    them; this issuer's root headings print at 65.73 (FY2024) and 42.05
    (FY2025), so the declared value is 35.

    ⚠⚠ `ocr_leading_one` — a leading `1` rendered as the LETTER `I`, joined back
    onto the figure it abuts. `acfrGF._WS_REPAIR` REFUSES this shape
    (`I09,091,141`, Biloxi FY2024) because a lost digit must never be guessed,
    and that refusal stands. Nothing is guessed here: North Charleston FY2021
    prints `I` `13,143,394` for its General Fund total, and the eight
    expenditure components are independently clean and sum to 113,143,394 —
    the printed digits with the `I` read as `1`. THE TIE GATE IS WHAT VALIDATES
    IT, exactly as it validates `_WS_REPAIR`: were the reading wrong the
    components would stop matching and the extraction would fail loudly.
    ⚠ It only ever fires where the letter TOUCHES the figure (<= 6pt, about one
    character), so a column marker or footnote reference standing apart from the
    money is left exactly as printed. Opt-in, because it is safe only where an
    independent sum can confirm it.
    """
    if left_margin is not None:
        words = [w for w in words if w['x0'] >= left_margin]
    if not words:
        return []
    words = list(words)
    for w in words:
        w['_mid'] = (w['top'] + w['bottom']) / 2
    words.sort(key=lambda w: w['_mid'])

    rows, current = [], [words[0]]
    for w in words[1:]:
        if w['_mid'] - current[-1]['_mid'] > gap:
            rows.append(current)
            current = [w]
        else:
            current.append(w)
    rows.append(current)
    return [merge_split_numbers(_join_leading_one(sorted(ws, key=lambda w: w['x0'])))
            if ocr_leading_one else merge_split_numbers(sorted(ws, key=lambda w: w['x0']))
            for ws in rows]


_LEADING_ONE = ('I', 'l', '|')


def _join_leading_one(ws):
    """Fold a standalone `I`/`l`/`|` onto the money token it abuts. See above."""
    out, i = [], 0
    while i < len(ws):
        w = ws[i]
        nxt = ws[i + 1] if i + 1 < len(ws) else None
        if (w['text'] in _LEADING_ONE and nxt is not None
                and parse_money(nxt['text']) is not None
                and 0 <= nxt['x0'] - w['x1'] <= 6.0):
            joined = dict(nxt)
            joined['text'] = '1' + nxt['text']
            joined['x0'] = w['x0']
            out.append(joined)
            i += 2
            continue
        out.append(w)
        i += 1
    return out


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


def _is_lone_open_paren(tok):
    """A bare `(` — an accounting negative whose sign was split off its digits.

    ⚠ This is a SIGN FLIP, the quietest defect class this corpus has produced.
    Asheville's FY2022 statement emits its negative investment earnings as TWO
    words 0.1pt apart:

        x0=277.1  '('            <- x1 = 279.1
        x0=279.2  '372,058)'     <- gap = 0.1pt

    `_is_money_fragment` requires at least one DIGIT, so the lone `(` is not a
    fragment and never merges. The reader then sees `372,058)` — a trailing
    parenthesis with no opening one — and `parse_money` falls through to its
    unsigned alternative and returns +372,058 for a printed (372,058).

    Nothing about the output looks malformed. It was caught only because the
    revenue components then over-summed the printed total by exactly
    2 x 372,058 = 744,116; had this row been the LAST component, or had the
    statement not printed a total, the sign would have shipped inverted.

    Kept separate from `_is_money_fragment` rather than folded into it: that
    predicate is also used to decide whether the PRECEDING token may absorb the
    next, and a bare `(` must never be absorbed BACKWARD onto a completed
    number. It may only merge FORWARD onto the digits it belongs to.

    A lone `)` is deliberately NOT handled. It would have to merge backward,
    and `parse_money` already reads `(372,058` and `372,058)` identically, so
    a split closing paren does not change the sign.
    """
    return tok == '('


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
        elif (out and _is_lone_open_paren(out[-1]['text']) and _is_money_fragment(w['text'])
                and w['x0'] - out[-1]['x1'] < MERGE_GAP):
            # A NEGATIVE whose opening parenthesis was split off its digits.
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
        # ⚠ Matched with whitespace COLLAPSED, because a PDF that fuses its
        # words renders these as 'totalrevenues' / 'totalexpenditures'. City of
        # Durham FY2023 does exactly that, and a literal-substring test reports
        # 'statement page not found' for a statement that is plainly there.
        flat = _NOSPACE.sub('', low)
        if not any(_NOSPACE.sub('', lbl) in flat
                   for lbl in ('total revenues', 'total operating revenues', 'net revenues')):
            continue
        if 'totalexpenditures' not in flat:
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


# ── SCOPE-04: the Total Governmental column ─────────────────────────────────
_GOVERNMENTAL = re.compile(r'governmental', re.I)
# How far a column HEADER's centre may sit from the centre of the figure beneath
# it. Adjacent fund columns in this corpus are 50-90pt apart, so 40pt cannot
# reach the neighbouring column while still tolerating a header that is wider
# than its figure ("Total Governmental Funds" set over an 11-digit number).
HEADER_ALIGN_TOL = 40.0


def money_cells(rows, label_re):
    """(value, x_centre) for every money cell on the first row matching `label_re`.

    Same rule and same arbiter as `numbers_on` — this one keeps the COORDINATE,
    which is what lets a caller pick a column by its printed header rather than
    by ordinal position.
    """
    for ws in rows:
        text = ' '.join(w['text'] for w in ws)
        if not label_re.match(text):
            continue
        cells = []
        for w in ws:
            v = parse_money(w['text'])
            if v is not None:
                cells.append((v, (w['x0'] + w['x1']) / 2))
        if cells:
            return cells, text
    return None, None


def total_governmental_x(rows, money_xs):
    """Centre of the Total Governmental column, or None.

    ⚠ NOT "the rightmost number on the row". That is true for most issuers and
    WRONG for the ones that matter: Travis County splits its fund columns across
    two pages and prints only the first few on the statement page, so the
    rightmost value there is a Nonmajor fund. Reading the wrong column would
    produce a real number from the wrong fund — the exact failure `lines_of`
    documents, and nothing about the output would look malformed.

    So the column is located by its printed HEADER and then TIED TO A REAL
    COLUMN: a `/governmental/i` header only counts if some money cell on the
    total row sits under it. That self-validation is also what keeps the page
    TITLE ("... Governmental Funds", centred above everything) from being
    mistaken for a column header — it aligns with no single column.

    The rightmost qualifying header wins: on a statement that prints both
    "Nonmajor Governmental Funds" and "Total Governmental Funds", Total is
    always the last column.
    """
    best = None
    for ws in rows:
        for w in ws:
            if not _GOVERNMENTAL.search(w['text']):
                continue
            xc = (w['x0'] + w['x1']) / 2
            near = [mx for mx in money_xs if abs(mx - xc) <= HEADER_ALIGN_TOL]
            if not near:
                continue
            aligned = min(near, key=lambda mx: abs(mx - xc))
            if best is None or aligned > best:
                best = aligned
    return best


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
    # SCOPE-04. `general_fund` is column 0 and is the DEFAULT, so every existing
    # caller (verify-austin-travis.mjs, acfrGF.selftest.py) is untouched.
    # `total_governmental` reads the column under the `/governmental/i` header
    # instead -- the oracle for a derived Total Governmental figure.
    ap.add_argument('--column', choices=('general_fund', 'total_governmental'),
                    default='general_fund',
                    help='which printed fund column to report (default: general_fund)')
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
        rev_re = re.compile(r'^(?:Total|Net)\s+(operating\s+)?revenues\b', re.I)
        exp_re = re.compile(r'^Total\s+expenditures\b', re.I)
        rev_cells, rev_row = money_cells(rows, rev_re)
        exp_cells, exp_row = money_cells(rows, exp_re)
        rev_cols = [v for v, _ in rev_cells] if rev_cells else None
        exp_cols = [v for v, _ in exp_cells] if exp_cells else None
        m = re.search(r'year\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)

        tg_x = None
        if args.column == 'total_governmental' and rev_cells and exp_cells:
            # One column for the whole statement: locate it from the union of
            # both total rows' cells so a blank cell on one row cannot move it.
            tg_x = total_governmental_x(rows, [x for _, x in rev_cells + exp_cells])

    if not rev_cols or not exp_cols:
        print(json.dumps({'error': 'printed total row not located',
                          'revenue_row': rev_row, 'expenditure_row': exp_row}))
        sys.exit(4)

    if args.column == 'total_governmental':
        # ⚠ REFUSE rather than fall back to the rightmost column. A silent
        # fallback would report a Nonmajor fund as Total Governmental on exactly
        # the split-column statements this selector exists to handle.
        if tg_x is None:
            print(json.dumps({'error': 'Total Governmental column header not found on the statement page',
                              'revenue_row': rev_row, 'expenditure_row': exp_row}))
            sys.exit(5)

        def pick(cells):
            hit = [v for v, x in cells if abs(x - tg_x) < 0.01]
            return hit[0] if hit else None

        rev_tg, exp_tg = pick(rev_cells), pick(exp_cells)
        if rev_tg is None or exp_tg is None:
            print(json.dumps({'error': 'Total Governmental column has no figure on one of the total rows',
                              'revenue_row': rev_row, 'expenditure_row': exp_row}))
            sys.exit(5)
        print(json.dumps({
            'statement_page': idx + 1,
            'fiscal_year': int(m.group(1)) if m else None,
            'column': 'total_governmental',
            'revenue_total': rev_tg * args.units,
            'expenditure_total': exp_tg * args.units,
            'revenue_columns': rev_cols,
            'expenditure_columns': exp_cols,
            'units': args.units,
        }, indent=2))
        return

    print(json.dumps({
        'statement_page': idx + 1,
        'fiscal_year': int(m.group(1)) if m else None,
        'column': 'general_fund',
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
