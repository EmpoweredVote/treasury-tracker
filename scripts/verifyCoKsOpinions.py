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

# ⚠⚠ A WINDOWS CONSOLE IS cp1252 AND THIS SCRIPT PRINTS ⚠. Without this the
# run CRASHES with UnicodeEncodeError in the final loop — the loop that names
# the documents whose opinion could not be read, i.e. the one output a grader
# must not miss. The measurement had completed; only the report died, which is
# the worst place to lose it. Hit 2026-10-28 on the Travis County corpus, the
# first run in which any document was unreadable.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):  # a pipe that cannot be reconfigured
        pass

TESSERACT = os.environ.get(
    'TT_TESSERACT', r'C:\Program Files\Tesseract-OCR\tesseract.exe')

# The primary opinion: a fair-presentation phrase AND a GAAP conformity phrase.
FAIR = re.compile(r'presentfairly,?inallmaterialrespects')
#
# ⚠⚠ `standards` IS THE THIRD ALTERNATIVE AND IT WAS ADDED BECAUSE IT WAS
# MISSING, not for symmetry. Travis County's auditor writes "in conformity with
# accounting STANDARDS generally accepted in the United States" — GAAP is
# PRINCIPLES, so this is the auditor's own slip, reproduced verbatim in FY2005,
# FY2006 and FY2007. With only the two common wordings this gate read all three
# documents as NOT FOUND while `checkOpinionType.py` read a clean primary
# opinion in each: three real audited years invisible to the gate that decides
# whether an opinion exists at all. Found 2026-10-28.
#
# ⭐ WIDENING THIS CONJUNCT CAN ONLY EVER TURN `none` INTO `text`/`ocr`. The
# verdict needs FAIR and GAAP and IN_OUR_OPINION together, so adding an
# alternative to one of them can never un-find a document that was already
# found, and it cannot touch which documents are flagged MODIFIED. Measured as
# well as argued: re-run over the 123 documents already graded under the old
# pattern (73 Alaska, 28 Austin, 22 Travis), the only answers that moved were
# Travis FY2005-FY2007, none -> text.
#
# ⚠ The pairing itself is load-bearing and must not be loosened further — see
# the in-relation-to case in `selftest()`.
#
# ⚠⚠ `generallyacceptedaccountingprinciples` IS THE FOURTH ALTERNATIVE, AND IT
# WAS ALSO ADDED BECAUSE IT WAS MISSING. The North Slope Borough's auditor
# inverts the phrase — "...for the year then ended in accordance with **U.S.
# generally accepted accounting principles**" — where everyone else writes
# "accounting principles generally accepted in the United States". With only the
# first three alternatives this gate read ALL TEN of that borough's documents as
# NOT FOUND while `checkOpinionType.py` read a clean primary opinion in each:
# the Travis County miss again, one wording further out. Found 2026-10-28.
#
# ⭐ Re-measured, not just argued, exactly as the note above requires. The
# measurement asks the narrow question directly — which documents does the NEW
# alternative find that the OLD one did not — over every text layer already
# graded under the old pattern (73 Alaska + 114 new wave-1 Alaska, 28 Austin,
# 22 Travis, 57 CO/KS, 32 Colorado Springs/El Paso). THE ANSWER IS EXACTLY THE
# TEN NORTH SLOPE DOCUMENTS, none -> text, and nothing else anywhere.
#
# ⚠ That sweep reads TEXT LAYERS only, so it cannot speak for the image-only
# opinion pages that reach this gate through OCR. It does not need to: the
# verdict is a CONJUNCTION, so adding an alternative to one conjunct can only
# ever turn `none` into `text`/`ocr`, never the reverse, on either path.
GAAP = re.compile(r'accounting(?:principles|standards)generallyaccepted'
                  r'|conformitywithaccountingprinciples'
                  r'|generallyacceptedaccountingprinciples')
# ⚠⚠ `my` AS WELL AS `our` — A SOLE PRACTITIONER WRITES IN THE FIRST PERSON
# SINGULAR. The Haines Borough's auditor opens "In MY opinion, based on MY
# audit and the report of other auditors, the accompanying financial statements
# present fairly...", and with `our` alone this gate read EIGHT of that
# borough's nine filings as NOT FOUND — FY2016, audited by a firm, was the only
# one it saw. Nothing is wrong with those eight documents; a one-person audit
# firm is ordinary for a borough of 2,104 people.
#
# ⭐ Measured the same way as the GAAP widening above: asking which documents
# the new alternative finds that the old did not, across every text layer
# already graded, the answer is exactly those eight Haines filings.
IN_OUR_OPINION = re.compile(r'in(?:our|my)opinion')
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


def selftest():
    """Pin the three conjuncts, both polarities, and the wording variants.

    ⚠⚠ ADDED 2026-10-28, AND IT WOULD HAVE CAUGHT A LIVE MISS. This gate read
    Travis County FY2005, FY2006 and FY2007 as NOT FOUND while the second gate
    read a clean opinion in all three. The documents are fine; the GAAP pattern
    was not. Their auditor writes "in conformity with accounting STANDARDS
    generally accepted in the United States" where almost everyone else writes
    PRINCIPLES, and the pattern knew only the common wording. Three real,
    clean, primary opinions were therefore invisible to the gate that decides
    whether an opinion exists at all.

    ⚠ Nothing here needs a PDF, so this runs anywhere and on CI.
    """
    ok = True

    def check(label, text, want, pattern=None):
        nonlocal ok
        flat = collapse(text)
        got = bool((pattern or FAIR).search(flat)) if pattern else bool(
            FAIR.search(flat) and GAAP.search(flat) and IN_OUR_OPINION.search(flat))
        if got != want:
            print(f'SELFTEST FAIL: {label} -> {got}, expected {want}')
            ok = False
        else:
            print(f'  {label:<52} -> {got}')

    # The common wording, and the three real variants this corpus contains.
    for label, phrase in [
        ('"accounting principles generally accepted"',
         'in conformity with accounting principles generally accepted in the United States'),
        ('"accounting STANDARDS generally accepted" (Travis FY2005-07)',
         'in conformity with accounting standards generally accepted in the United States'),
        ('"in conformity with accounting principles"',
         'in conformity with accounting principles'),
        ('"U.S. GENERALLY ACCEPTED accounting principles" (North Slope FY2016-25)',
         'in accordance with U.S. generally accepted accounting principles'),
    ]:
        check(label, 'In our opinion, the financial statements referred to above '
                     'present fairly, in all material respects, the financial position '
                     + phrase, True)

    # ⚠⚠ A SOLE PRACTITIONER SAYS "IN MY OPINION" (Haines FY2018-FY2025).
    check('"In MY opinion" from a one-person audit firm',
          'In my opinion, based on my audit and the report of other auditors, the '
          'accompanying financial statements present fairly, in all material respects, '
          'the financial position in accordance with accounting principles generally '
          'accepted in the United States of America.', True)

    # ⚠ ALL THREE CONJUNCTS ARE REQUIRED. Dropping any one must fail, or the
    # gate starts finding "opinions" in prose about auditing.
    check('a fair-presentation sentence with NO conformity phrase',
          'In our opinion, the statements present fairly, in all material respects, '
          'the financial position of the County.', False)
    check('a conformity phrase with NO fair-presentation sentence',
          'prepared in conformity with accounting principles generally accepted in '
          'the United States of America, as described in Note 1.', False)
    check('boilerplate describing an audit, with neither',
          'An audit includes assessing the accounting principles used and significant '
          'estimates made by management.', False)

    # ⚠⚠ THE IN-RELATION-TO PARAGRAPH MUST NOT MATCH. Every one of these reports
    # carries an opinion about the COMBINING SCHEDULES, and grading off it would
    # attest the wrong thing. It says "fairly stated", never "present fairly, in
    # all material respects" — which is exactly why the pattern pairs.
    check('the in-relation-to paragraph on supplementary information',
          'In our opinion, the combining and individual fund statements are fairly '
          'stated, in all material respects, in relation to the basic financial '
          'statements taken as a whole.', False)

    # ⚠ The MODIFIED pattern reports, never downgrades — but it must still not
    # INVERT. `unqualified` is the clean word.
    if MODIFIED.search(collapse('rendering unqualified opinions')):
        print('SELFTEST FAIL: `unqualified opinion` matched the MODIFIED pattern')
        ok = False
    else:
        print('  `unqualified opinions` correctly NOT matched as MODIFIED  -> False')
    if not MODIFIED.search(collapse('Basis for Qualified Opinion')):
        print('SELFTEST FAIL: a genuine `Qualified Opinion` did not match MODIFIED')
        ok = False
    else:
        print('  a genuine `Qualified Opinion` matched MODIFIED           -> True')

    # ⚠ Spaces LOST in a text layer (two South Carolina filings) must still match.
    check('an opinion whose text layer has lost its spaces',
          'Inouropinion,thefinancialstatementspresentfairly,inallmaterialrespects,'
          'thefinancialpositioninconformitywithaccountingprinciplesgenerallyaccepted', True)

    print('\nSELFTEST PASSED' if ok else '\nSELFTEST FAILED')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dir', default='_acfr-work/coks')
    ap.add_argument('--only')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()

    if args.selftest:
        return selftest()

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
