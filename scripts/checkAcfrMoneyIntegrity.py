#!/usr/bin/env python3
"""
ACFR money-token integrity gate — does the PDF's text layer render DIGITS
faithfully, independent of whether it renders PROSE faithfully?

Knight session 8. Written because the existing quality checks all measure the
wrong thing for this failure, and one of them passed a document whose money was
visibly destroyed.

── ⚠⚠ WHY PROSE QUALITY DOES NOT IMPLY MONEY QUALITY ────────────────────────

City of Biloxi FY2024 scores **43.6 % known-vocabulary, 1.7 welded tokens per
page, 3 numeric statement pages, 1,999 chars/page** — it passes every prose and
density check the campaign has. Its statement page nonetheless reads:

    Property taxes          4,973,!09          <- a lost digit
    Intergovernmental      20,034, 199         <- split thousands group
    Total revenues        I09,091 ,141         <- letter-as-leading-digit

The prose around those numbers is fine, which is precisely why the prose gates
pass. **An OCR engine can read words well and digits badly**, and money is the
only part of an ACFR this project actually loads.

── ⚠⚠ THE FIRST VERSION OF THIS CHECK WAS A FALSE-POSITIVE GENERATOR ────────

Recorded because it nearly shipped. The first pattern was `\\d[,.]\\s+\\d`
("space inside a number"), and it flagged **every document in the corpus**,
including known-clean ones — `pdftotext -table` separates COLUMNS with runs of
spaces, so a row ending in one number and continuing with the next column's
number matches trivially.

It was caught only by running the check against **known-good controls** before
believing it. A detector that fires on everything is indistinguishable from a
detector that fires on nothing. **Always run a new gate against documents you
have already proven good** — the same lesson as session 7b's opinion gate, which
matched `qualifiedopinion` inside `UNqualifiedopinion` and inverted its signal.

The surviving patterns below all score **0.00 % on 66 of 70 session-8
documents** and fire only on the four that are genuinely damaged.

── SCOPE ───────────────────────────────────────────────────────────────────

Only pages that hold a numeric revenues/expenditures/fund-balance statement are
examined. A scanned introductory letter or statistical section is not a reason
to reject a document whose STATEMENTS are clean.

⚠ This gate does NOT replace the tie check. It runs BEFORE extraction, to
explain a failure in advance and to catch the dangerous case where corrupted
digits happen to still sum to the printed total. The tie remains the arbiter of
whether a read is correct.
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

# Signatures that cannot occur in clean `pdftotext -table` output.
# ⚠ Each is anchored INSIDE a digit run. Nothing here may match a column gap.
SIGNATURES = (
    (re.compile(r'\d[!lI|Oo]\d'), 'letter inside digits'),
    (re.compile(r'\b[IlO|]\d{2,}(?:,\d{3})+'), 'letter-as-leading-digit'),
    (re.compile(r'\d,\s\d{3}\b'), 'comma-space in thousands group'),
    (re.compile(r'\d\s,\d{3}\b'), 'space-comma in thousands group'),
)

MONEY = re.compile(r'\b\d{1,3}(?:,\d{3})+\b')

# A statement page, by the same test the extractor's page finder uses.
_STMT_WORDS = ('revenues', 'expenditures', 'fund balance')
_MIN_MONEY_TOKENS = 15

# ⚠ An EXACT threshold, not a vibe. The corpus separates 0.00 % from 3.18 %
# with nothing in between, so anything above zero is worth a human look and
# anything at or above 1 % is a rejection.
DEFAULT_MAX_RATE = 0.01


def statement_pages(pdf_path):
    """Return the text of every page holding a numeric GF-type statement."""
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 'text.txt')
        subprocess.run(['pdftotext', '-q', '-table', pdf_path, out], check=False)
        if not os.path.exists(out):
            return []
        with open(out, encoding='utf-8', errors='replace') as fh:
            pages = fh.read().split('\f')
    keep = []
    for page in pages:
        low = page.lower()
        if all(w in low for w in _STMT_WORDS) and len(MONEY.findall(page)) >= _MIN_MONEY_TOKENS:
            keep.append(page)
    return keep


def scan(pdf_path):
    pages = statement_pages(pdf_path)
    if not pages:
        return None
    tokens = 0
    hits = {}
    for page in pages:
        tokens += len(MONEY.findall(page))
        for rx, name in SIGNATURES:
            found = len(rx.findall(page))
            if found:
                hits[name] = hits.get(name, 0) + found
    suspect = sum(hits.values())
    return {
        'statement_pages': len(pages),
        'money_tokens': tokens,
        'suspect': suspect,
        'rate': suspect / tokens if tokens else 0.0,
        'signatures': hits,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('pdfs', nargs='+')
    ap.add_argument('--max-rate', type=float, default=DEFAULT_MAX_RATE,
                    help='reject above this suspect-token rate (default 0.01)')
    args = ap.parse_args(argv)

    failures = 0
    for pdf in sorted(args.pdfs):
        name = os.path.basename(pdf)
        res = scan(pdf)
        if res is None:
            # ⚠ A document with no readable statement page FAILS. A gate that
            # can measure nothing must never pass.
            print('%-34s NO STATEMENT PAGE  *** FAIL ***' % name)
            failures += 1
            continue
        bad = res['rate'] > args.max_rate
        flag = '  *** MONEY OCR-CORRUPTED ***' if bad else ''
        print('%-34s tokens=%-5d suspect=%-4d rate=%5.2f%%%s %s' % (
            name, res['money_tokens'], res['suspect'], res['rate'] * 100, flag,
            res['signatures'] if res['signatures'] else ''))
        failures += bool(bad)

    print('\n%d of %d document(s) failed the money-integrity gate.'
          % (failures, len(args.pdfs)))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
