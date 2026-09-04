#!/usr/bin/env python3
"""
Corroborate a South Carolina city's General Fund totals against the ISSUER'S OWN
derived line — `Excess (deficiency) of revenues over (under) expenditures`.

Usage:
    python scripts/verifyScCityExcess.py _acfr-work/sc-cities/acfr/sumter
    python scripts/verifyScCityExcess.py --json <entity-dir>...

── WHY THIS EXISTS: SUMTER CANNOT HAVE A SECOND-READER CORROBORATOR ───────

The campaign's rule is that an entity moved onto `acfrGfCoords.py` keeps being
corroborated by `acfrGF.py` (`pdftotext -table`) on every year the other reader
can still read — otherwise the move is unfalsifiable, because a coordinate
reader that quietly went wrong would tie at $0 exactly as happily as the grid
reader it replaced. Rock Hill and Spartanburg are corroborated that way.

⚠⚠ **The City of Sumter defeats the character-grid reader in EVERY year, and not
by a little.** `pdftotext -table` renders its statement page letter-spaced:

    Re ve nue s                     the revenue banner
    T otal revenues 85,437,318      the anchor row
    Go v ern men t al               the column headers
    Expe nditure s                  the expenditure banner

`REV_BANNER` (`^revenues?:?$`) and `REV_TOTAL` (`^(?:Total|Net)\\s*revenues\\b`)
cannot match those, and `acfrGF.classify` refuses the page outright when the
printed page number `31` lands in the General Fund column — it fails LOUDLY
rather than shipping a wrong shape, which is the correct behaviour. The
coordinate reader is unaffected because pdfplumber reconstructs `T` + `otal`
into one word from glyph spacing; the character grid never gets the chance.

⚠⚠ AND THE LIBRARY ALREADY REFUSES THE OBVIOUS WORKAROUND. De-letter-spacing the
text layer would be a fuzzy label repair, and `CityConfig.label_fixes` records
why that trade is declined: "a rule that rejoined runs of capitals would happily
corrupt a legitimate label". `repair_ocr_whitespace` closes split THOUSANDS
GROUPS only and never touches letters. So the second reader is unavailable here
on PRINCIPLE, not for want of effort.

── WHAT CORROBORATES INSTEAD, AND WHAT IT IS AND IS NOT WORTH ─────────────

Every statement in this corpus prints a line the issuer DERIVED from the two
totals this campaign extracts:

    Total revenues                                      85,437,318
    Total expenditures                                  64,284,680
    Excess (deficiency) of revenues over (under)
      expenditures                                      21,152,638

and 85,437,318 − 64,284,680 = 21,152,638. This asserts that identity against the
printed figure, per entity-year.

⭐ It is independent of BOTH readers. The figure was computed by the city's
accountants and typeset by its auditor; nothing in either extractor derives it.

⭐ AND IT IS NOT THE TIE GATE WEARING A DIFFERENT HAT. The tie compares each
total against its OWN printed total on the SAME side of the statement, so a whole
side read from the wrong FUND COLUMN still ties at $0 — that is precisely the
Rock Hill two-offset defect. This identity binds the two sides to each other, so
reading either side from a neighbouring column breaks it.

⚠ It is not a full substitute for a second reader and is not claimed as one: two
errors equal in size and identical in sign, one on each side, would survive it.
What it rules out is every SINGLE-side error — which is the class both readers
have actually produced in this campaign (Rock Hill's 432,533 `Fines and
forfeitures`, Summerville's FY2025 20,125, Goose Creek's 36,953,087
double-counted subtotal). Recorded honestly rather than oversold.

⚠ Read directly off the page with the shared coordinate primitives rather than
from either extractor's output, so the check cannot inherit an extractor bug.
"""

import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))

import pdfplumber  # noqa: E402

from acfrGfComponents import (  # noqa: E402
    establish_column, find_statement, gf_cell, lines_of, row_text,
)

# The issuer's own derived line. Both wave-4 cities WRAP this caption across two
# printed rows, so the label is matched on its prefix and the money is taken from
# whichever printed row actually carries it.
#
# ⚠⚠ THE CAPTION IS NOT ONE STRING. Florence alone prints FOUR variants in ten
# years, and one of them DROPS THE WORD `EXCESS` altogether:
#
#     FY2016, FY2021   `EXCESS (DEFICIENCY) OF REVENUES` / `OVER EXPENDITURES`
#     FY2017-FY2020    `DEFICIENCY OF REVENUES`          / `OVER EXPENDITURES`
#     FY2024-FY2025    `Excess (deficiency) of revenues over` / `(under) expenditures`
#     Sumter, all 10   `Excess (deficiency) of revenues over (under) expenditures`
#
# ⚠ And the drop is NOT a rule that could be derived — FY2021 is a deficit year
# too and still prints the full `EXCESS (DEFICIENCY)`. It is issuer styling
# drift, so the pattern accepts either opening rather than inferring intent.
# Anchoring on `Excess` alone silently skipped four of Florence's ten years,
# which read as "this document has no such line" rather than as a miss.
# ⚠⚠ `revenues` IS OPTIONAL ON THIS LINE — wave 5. Hilton Head breaks the caption
# after `of` in ALL NINE of its years, so the first line is just
# `EXCESS (DEFICIENCY) OF` and requiring `of revenues` matched nothing. That
# failed the RIGHT way (`missing a required row`, never a silent skip), but it
# failed on all nine.
#
# ⚠ `excees` is the TOWN'S OWN TYPO in FY2017 (`Excees (deficiency) of`), kept
# verbatim rather than repaired — the Wichita rule. It is listed explicitly, as
# one misspelling of one word in one document, NOT absorbed into a fuzzy match:
# a spell-tolerant anchor here would start matching captions this campaign has
# never seen and could not describe.
EXCESS = re.compile(
    r'^(?:excess|excees|deficiency)\s*(?:\(\s*deficiency\s*\)\s*)?of\s*(?:revenues)?\s*$'
    r'|^(?:excess|excees|deficiency)\s*(?:\(\s*deficiency\s*\)\s*)?of\s*revenues', re.I)
# ⚠ The continuation row, which is where the money sits whenever the caption
# wraps: `OVER EXPENDITURES`, `(under) expenditures`, `over (under) expenditures`.
#
# ⚠⚠ AND `REVENUES OVER (UNDER) EXPENDITURES` — wave 5. Hilton Head puts the word
# `revenues` on the CONTINUATION rather than on the caption line, so the money row
# starts with `Revenues`, not with `over`/`under`. The optional prefix is anchored
# to the start of the line and still requires an `over`/`under` and `expenditures`
# after it, so it cannot match `Total revenues` or any other revenue row.
EXCESS_CONT = re.compile(
    r'^(?:revenues\s*)?\(?\s*(?:over|under)\s*\)?\s*'
    r'(?:\(?\s*(?:over|under)\s*\)?\s*)?expenditures', re.I)
TOTAL_REV = re.compile(r'^(?:Total|Net)\s*(?:operating\s*)?revenues\b', re.I)
TOTAL_EXP = re.compile(r'^Total\s*expenditures\b', re.I)


def read_page(pdf_path):
    """(total_revenues, total_expenditures, printed_excess, error) off the page."""
    with pdfplumber.open(pdf_path) as pdf:
        _idx, page, _text = find_statement(pdf)
        if page is None:
            return None, None, None, 'primary GF statement not found'
        rows = lines_of(page)
        alignment, edge = establish_column(rows)
        if alignment is None:
            return None, None, None, 'General Fund column not established: %s' % edge
        # ⚠ `gf_cell` returns (amount, kind, error) and reports a DASH or a BLANK
        # cell as a real 0 — so "no money printed here" has to be read off `kind`,
        # never off a None amount. That distinction is the whole point of the
        # helper (it refuses to fall back to the leftmost number on the row).
        def cell(ws):
            amount, kind, err = gf_cell(ws, alignment, edge)
            if err:
                return None, err
            return (amount if kind == 'number' else None), None

        rev = exp = exc = None
        for n, ws in enumerate(rows):
            txt = row_text(ws).strip()
            if rev is None and TOTAL_REV.match(txt):
                rev, err = cell(ws)
                if err:
                    return None, None, None, 'Total revenues: %s' % err
            if exp is None and TOTAL_EXP.match(txt):
                exp, err = cell(ws)
                if err:
                    return None, None, None, 'Total expenditures: %s' % err
            if exc is None and (EXCESS.match(txt) or EXCESS_CONT.match(txt)):
                got, err = cell(ws)
                if err:
                    return None, None, None, 'Excess row: %s' % err
                # ⚠ The caption wraps in both wave-4 cities. Where the row holding
                # the LABEL prints no figure, the money is on the following
                # printed row — read it there rather than calling the row empty.
                if got is None and n + 1 < len(rows):
                    got, err = cell(rows[n + 1])
                    if err:
                        return None, None, None, 'Excess continuation: %s' % err
                exc = got
        return rev, exp, exc, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dirs', nargs='+')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    records, failures = [], []
    for d in args.dirs:
        for pdf in sorted(pathlib.Path(d).glob('*.pdf')):
            rev, exp, exc, err = read_page(str(pdf))
            rec = {'pdf': pdf.as_posix(), 'total_revenues': rev,
                   'total_expenditures': exp, 'printed_excess': exc}
            if err:
                rec['error'] = err
                failures.append('%s: %s' % (pdf.stem, err))
            elif rev is None or exp is None or exc is None:
                rec['error'] = 'missing a required row'
                failures.append('%s: missing rev=%s exp=%s excess=%s'
                                % (pdf.stem, rev, exp, exc))
            else:
                rec['derived'] = rev - exp
                rec['delta'] = (rev - exp) - exc
                if rec['delta'] != 0:
                    failures.append(
                        '%s: revenues %d - expenditures %d = %d, but the issuer '
                        'prints %d (delta %d)'
                        % (pdf.stem, rev, exp, rev - exp, exc, rec['delta']))
            records.append(rec)
            if not args.json:
                if rec.get('delta') == 0:
                    print('  %-22s %14s - %14s = %14s  == printed'
                          % (pdf.stem, format(rev, ','), format(exp, ','),
                             format(rev - exp, ',')))
                else:
                    print('  %-22s FAILED  %s'
                          % (pdf.stem, rec.get('error', 'delta %s' % rec.get('delta'))))

    if args.json:
        print(json.dumps(records, indent=2))
        return 0 if failures else 0

    print()
    print('%d of %d entity-years reproduce the printed excess exactly.'
          % (len(records) - len(failures), len(records)))
    if failures:
        print()
        for f in failures:
            print('  FAIL %s' % f)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
