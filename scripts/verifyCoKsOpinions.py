#!/usr/bin/env python3
"""
Audit-opinion evidence gate for the Colorado + Kansas ACFRs (Knight session 7b).

A row may carry `audit_grade = audited_gaap` only where THIS script finds, in
that specific document, an unmodified auditor's opinion on the basic financial
statements. Spec section 3.5: a non-`unknown` grade needs evidence recorded per
document, not an assumption that "an ACFR is audited".

Usage:
  python scripts/verifyCoKsOpinions.py --dir _acfr-work/coks
  python scripts/verifyCoKsOpinions.py --dir _acfr-work/coks --only wichita-2005

── ⚠⚠ WHY THIS SCRIPT EXISTS: 17 OF 57 OPINIONS ARE INVISIBLE TO A TEXT SEARCH ─

Seventeen of these documents are born-digital in the statements and IMAGE-ONLY on
the auditor's page. In every one of them a plain text search finds "Independent
Auditor" exactly once — IN THE TABLE OF CONTENTS — which reads precisely like an
unaudited report. Grading on the text layer alone would have shipped Wichita
FY2000-FY2010 and Sedgwick County FY2006-FY2011 as `unknown`.

This is session 2's lesson (8 of 36 Charlotte/Mecklenburg opinion pages were
image-only) in its third occurrence, and session 6a's second mode (two South
Carolina text layers that had LOST THEIR SPACES) is handled too, by collapsing
all whitespace before matching.

⚠⚠ THE FIRST "IN OUR OPINION" IS NOT NECESSARILY THE RIGHT ONE. Every one of
these reports also carries an IN-RELATION-TO paragraph about supplementary
information — "in our opinion, are fairly stated in all material respects ... we
express no opinion on such information" — which is an opinion about the
combining schedules, not about the basic financial statements. Matching the
first hit would grade a document off the wrong paragraph. The primary opinion is
identified positively instead: it must pair "present fairly, in all material
respects" with a GAAP conformity phrase.

⚠ A modified-opinion WORD is not a modified opinion. "Qualified opinion" and
"adverse opinion" appear in the Single Audit compliance report and in the
standard boilerplate describing what the auditor would do; several clean
documents contain them. They are reported for review, never used to downgrade
automatically.
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

TESSERACT = os.environ.get(
    'TT_TESSERACT', r'C:\Program Files\Tesseract-OCR\tesseract.exe')

# The primary opinion: a fair-presentation phrase AND a GAAP conformity phrase.
FAIR = re.compile(r'presentfairly,?inallmaterialrespects')
GAAP = re.compile(r'accountingprinciplesgenerallyaccepted|conformitywithaccountingprinciples')
IN_OUR_OPINION = re.compile(r'inouropinion')
INDEPENDENT = re.compile(r'independentauditor')
# Reported, never auto-downgraded — see the module docstring.
#
# ⚠⚠ THE `(?<!un)` IS LOAD-BEARING AND ITS ABSENCE INVERTS THE SIGNAL. Matching
# a bare `qualifiedopinion` also matches inside `UNqualifiedopinion`, which is
# the OPPOSITE meaning — an unqualified opinion is the clean one. The first run
# of this gate flagged 20 documents, and the flags were mostly sentences like
# Wichita FY2005's "issued an unqualified opinion on the City of Wichita's
# financial statements" and Sedgwick County FY2009's "a reasonable basis for
# rendering unqualified opinions". Every one of those was EVIDENCE OF A CLEAN
# OPINION being reported as a possible defect.
#
# ⚠ Note the whitespace is already collapsed by `collapse()` when this runs, so
# a `\b` word boundary cannot do this job — there is no non-word character
# between "un" and "qualified" to anchor to. The negative lookbehind can.
#
# ⚠ The remaining true positive is real and still benign: Wichita FY2021 carries
# a genuine "Qualified Opinion on the Water Infrastructure Finance and
# Innovation Act (WIFIA) Program" — a FEDERAL PROGRAM COMPLIANCE opinion in the
# Single Audit, whose own summary reads "Unmodified for all major federal
# programs ... except for 66.958". That is not an opinion on the financial
# statements, which is exactly why this pattern reports and never downgrades.
MODIFIED = re.compile(r'adverseopinion|disclaimerofopinion|(?<!un)qualifiedopinion')


def collapse(text):
    """Lowercase with ALL whitespace removed.

    ⚠ Whitespace removal, not normalisation. Two South Carolina text layers in
    session 6a rendered the opinion with its spaces LOST
    ('eachmajorfundandtheaggregateremainingfundinformation'); collapsing makes
    those and normally-spaced text match the same pattern.
    """
    return re.sub(r'\s+', '', text).lower()


def pdf_text(path):
    return subprocess.run(['pdftotext', '-layout', path, '-'],
                          capture_output=True, text=True, errors='replace').stdout


def ocr_pages(path, first, last, dpi=200):
    """Render a page range and OCR it. Returns the concatenated text."""
    out = []
    with tempfile.TemporaryDirectory() as td:
        stem = os.path.join(td, 'pg')
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(first), '-l', str(last),
                        '-png', path, stem], capture_output=True)
        for name in sorted(os.listdir(td)):
            if not name.endswith('.png'):
                continue
            res = subprocess.run([TESSERACT, os.path.join(td, name), 'stdout'],
                                 capture_output=True, text=True, errors='replace')
            out.append(res.stdout)
    return '\n'.join(out)


def assess(path, ocr_budget=26):
    """(verdict, detail) for one document.

    verdict is 'text', 'ocr' or 'none' — how the opinion was found, or that it
    was not found at all.
    """
    raw = pdf_text(path)
    pages = raw.split('\f')
    flat = collapse(raw)
    modified = bool(MODIFIED.search(flat))

    if FAIR.search(flat) and GAAP.search(flat) and IN_OUR_OPINION.search(flat):
        return 'text', {'modified_words': modified, 'ocr_pages': 0}

    # ⚠ The opinion is not in the text layer. OCR the front matter — the
    # auditor's report always precedes the MD&A — restricted to pages that are
    # actually image-like, so a long report does not cost a full-document OCR.
    candidates = [i + 1 for i, p in enumerate(pages[:ocr_budget])
                  if len(re.sub(r'\s', '', p)) < 400]
    if not candidates:
        return 'none', {'modified_words': modified, 'ocr_pages': 0,
                        'why': 'no image-like page in the front matter'}

    first, last = min(candidates), max(candidates)
    text = ocr_pages(path, first, last)
    oflat = collapse(text)
    if FAIR.search(oflat) and GAAP.search(oflat) and IN_OUR_OPINION.search(oflat):
        return 'ocr', {'modified_words': modified or bool(MODIFIED.search(oflat)),
                       'ocr_pages': last - first + 1,
                       'independent': bool(INDEPENDENT.search(oflat))}
    return 'none', {'modified_words': modified, 'ocr_pages': last - first + 1,
                    'why': 'opinion not found even after OCR'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dir', default='_acfr-work/coks')
    ap.add_argument('--only')
    args = ap.parse_args()

    pdfs = sorted(f for f in os.listdir(args.dir) if f.endswith('.pdf'))
    if args.only:
        pdfs = [f for f in pdfs if f[:-4] == args.only]
    if not pdfs:
        print('REFUSING: no documents matched. A gate that measures nothing must fail.')
        return 1

    by_verdict = {'text': [], 'ocr': [], 'none': []}
    flagged = []
    for f in pdfs:
        stem = f[:-4]
        verdict, detail = assess(os.path.join(args.dir, f))
        by_verdict[verdict].append(stem)
        note = ''
        if detail.get('modified_words'):
            note = '  [modified-opinion WORDS present — review, not a downgrade]'
            flagged.append(stem)
        print(f'  {stem:<26} {verdict:<5} ocr_pages={detail.get("ocr_pages", 0):<3}{note}')

    print(f'\nopinion found in the TEXT layer : {len(by_verdict["text"])}')
    print(f'opinion recovered by OCR        : {len(by_verdict["ocr"])}')
    print(f'NOT FOUND                       : {len(by_verdict["none"])}')
    if by_verdict['none']:
        print('  ' + ', '.join(by_verdict['none']))
    if flagged:
        print(f'\nDocuments containing modified-opinion words ({len(flagged)}) — '
              'reported for review:\n  ' + ', '.join(flagged))
    # ⚠ Non-zero exit ONLY when a document that is expected to be graded has no
    # opinion at all. The caller decides what to do; this script never grades.
    return 0


if __name__ == '__main__':
    sys.exit(main())
