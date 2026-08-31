#!/usr/bin/env python3
"""
Second implementation: what TYPE of auditor's opinion is this?

⚠⚠ WHY THIS EXISTS. `verifyCoKsOpinions.py` proves an opinion is PRESENT. It
cannot prove the opinion is CLEAN, and it does not claim to. Its positive test
pairs "present fairly, in all material respects" with a GAAP conformity phrase —
and a QUALIFIED opinion contains both, because its sentence reads "except for
the effects of the matter described ..., the financial statements present fairly,
in all material respects ... in accordance with accounting principles generally
accepted in the United States".

So a document can pass that gate and still not be clean. Harrison County MS is
the campaign's proof: ten loaded rows carry an "except for" opinion and grade as
plain `audited_gaap`. This script is the check that would have caught it.

It reads the OPINION PARAGRAPH ITSELF rather than the whole document, which is
what makes it different from a bare word search:

  * `verifyCoKsOpinions.py` searches the WHOLE document, so its MODIFIED pattern
    fires on Single Audit compliance opinions and on boilerplate describing what
    an auditor would do — noise it deliberately reports rather than acts on.
  * This searches a WINDOW around the fair-presentation sentence, where a
    modifier can only mean the opinion on the basic financial statements.

⚠ Two report formats, and only one is headed. Post-AU-C (roughly FY2012 on) the
auditor's report carries a literal heading — "Unmodified Opinion", "Qualified
Opinion". Older reports have no heading at all and the only marker is the words
"except for" inside the opinion sentence. Both are checked; neither alone is
enough.

⚠⚠ THE `(?<!un)` IS LOAD-BEARING, exactly as in verifyCoKsOpinions.py. A bare
`qualified` also matches inside `UNqualified`, which is the OPPOSITE meaning.
Session 7b's gate reported evidence of CLEAN opinions as defects for this reason.
A detector must be tested against BOTH polarities — see --selftest, which fails
the script if the patterns cannot tell the two apart.

Usage:
  python scripts/checkOpinionType.py --dir _acfr-work/co-springs-epc
  python scripts/checkOpinionType.py --selftest

OCR text is cached beside each PDF as `<stem>.opinion.txt` so a re-run is free.
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

TESSERACT = os.environ.get(
    'TT_TESSERACT', r'C:\Program Files\Tesseract-OCR\tesseract.exe')

FAIR = re.compile(r'presentfairly,?inallmaterialrespects')
# The qualifier that matters, in the two forms a report can carry it.
EXCEPT_FOR = re.compile(r'exceptfor')
QUALIFIED = re.compile(r'(?<!un)qualifiedopinion')
ADVERSE = re.compile(r'adverseopinion')
DISCLAIMER = re.compile(r'disclaimerofopinion|donotexpressanopinion')
# The positive marker of a clean opinion in a headed report.
CLEAN_HEAD = re.compile(r'unmodifiedopinion|unqualifiedopinion')

# ⚠ How far around the fair-presentation sentence to read. A qualified opinion
# names its exception in the sentence immediately before "present fairly", and
# the heading sits above that. 1,200 collapsed characters covers both without
# reaching the next section — the Single Audit's own opinions are pages away.
WINDOW = 1200


def collapse(text):
    """Lowercase with ALL whitespace removed — see verifyCoKsOpinions.collapse."""
    return re.sub(r'\s+', '', text).lower()


def pdf_text(path):
    return subprocess.run(['pdftotext', '-layout', path, '-'],
                          capture_output=True, text=True, errors='replace').stdout


def ocr_front_matter(path, cache, budget=26, dpi=200):
    """OCR the image-like front-matter pages, cached to `cache`."""
    if os.path.exists(cache):
        with open(cache, encoding='utf-8') as fh:
            return fh.read()
    pages = pdf_text(path).split('\f')
    candidates = [i + 1 for i, p in enumerate(pages[:budget])
                  if len(re.sub(r'\s', '', p)) < 400]
    if not candidates:
        return ''
    out = []
    with tempfile.TemporaryDirectory() as td:
        stem = os.path.join(td, 'pg')
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(min(candidates)),
                        '-l', str(max(candidates)), '-png', path, stem],
                       capture_output=True)
        for name in sorted(os.listdir(td)):
            if name.endswith('.png'):
                res = subprocess.run([TESSERACT, os.path.join(td, name), 'stdout'],
                                     capture_output=True, text=True, errors='replace')
                out.append(res.stdout)
    text = '\n'.join(out)
    with open(cache, 'w', encoding='utf-8') as fh:
        fh.write(text)
    return text


def windows(flat):
    """Every WINDOW-sized slice centred on a fair-presentation phrase."""
    return [flat[max(0, m.start() - WINDOW):m.start() + 200]
            for m in FAIR.finditer(flat)]


def classify(flat):
    """(verdict, markers) read from the opinion paragraph, not the document."""
    wins = windows(flat)
    if not wins:
        return 'no-opinion-sentence', []
    markers = []
    for w in wins:
        if EXCEPT_FOR.search(w):
            markers.append('except for')
        if QUALIFIED.search(w):
            markers.append('Qualified Opinion heading')
        if ADVERSE.search(w):
            markers.append('Adverse Opinion')
        if DISCLAIMER.search(w):
            markers.append('Disclaimer')
    clean_head = any(CLEAN_HEAD.search(w) for w in wins)
    if markers:
        return 'MODIFIED', sorted(set(markers))
    return ('clean', ['unmodified/unqualified heading'] if clean_head else
            ['no modifier near the opinion sentence'])


def selftest():
    """⚠ A detector must be tested against BOTH polarities, or it can invert."""
    clean = collapse("""
        Unqualified Opinion. In our opinion, the financial statements referred to
        above present fairly, in all material respects, the respective financial
        position of the governmental activities in accordance with accounting
        principles generally accepted in the United States of America. We issued
        an unqualified opinion on the City's financial statements.""")
    qualified = collapse("""
        Qualified Opinion. In our opinion, except for the effects of the matter
        described in the Basis for Qualified Opinion paragraph, the financial
        statements referred to above present fairly, in all material respects,
        the respective financial position in accordance with accounting
        principles generally accepted in the United States of America.""")
    ok = True
    v, m = classify(clean)
    if v != 'clean':
        print(f'SELFTEST FAIL: a clean opinion classified as {v} {m}'); ok = False
    else:
        print(f'  clean opinion      -> {v}  {m}')
    v, m = classify(qualified)
    if v != 'MODIFIED':
        print(f'SELFTEST FAIL: a qualified opinion classified as {v} {m}'); ok = False
    else:
        print(f'  qualified opinion  -> {v}  {m}')
    # ⚠ The inversion guard: "unqualified" must NOT read as "qualified".
    if QUALIFIED.search(collapse('unqualified opinion')):
        print('SELFTEST FAIL: `unqualified opinion` matched the QUALIFIED pattern'); ok = False
    else:
        print('  `unqualified opinion` correctly NOT matched as qualified')
    print('\nSELFTEST PASSED' if ok else '\nSELFTEST FAILED')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dir')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()

    if args.selftest:
        return selftest()
    if not args.dir:
        print('REFUSING: pass --dir or --selftest.')
        return 1

    pdfs = sorted(f for f in os.listdir(args.dir) if f.endswith('.pdf'))
    if not pdfs:
        print('REFUSING: no documents matched. A gate that measures nothing must fail.')
        return 1

    modified, clean, unread = [], [], []
    for f in pdfs:
        stem = f[:-4]
        path = os.path.join(args.dir, f)
        flat = collapse(pdf_text(path))
        source = 'text'
        if not FAIR.search(flat):
            flat = collapse(ocr_front_matter(
                path, os.path.join(args.dir, stem + '.opinion.txt')))
            source = 'ocr'
        verdict, markers = classify(flat)
        if verdict == 'MODIFIED':
            modified.append((stem, markers))
        elif verdict == 'clean':
            clean.append(stem)
        else:
            unread.append(stem)
        print(f'  {stem:<26} {source:<4} {verdict:<20} {", ".join(markers)}')

    print(f'\nclean (no modifier in the opinion paragraph) : {len(clean)}')
    print(f'MODIFIED                                     : {len(modified)}')
    print(f'opinion sentence not readable                : {len(unread)}')
    for stem, markers in modified:
        print(f'  ⚠ {stem}: {", ".join(markers)}')
    for stem in unread:
        print(f'  ⚠ {stem}: could not read an opinion sentence — do NOT grade')

    # ⚠ A gate that can measure nothing must FAIL, not pass.
    if not clean and not modified:
        print('\nREFUSING: no document yielded a readable opinion.')
        return 1
    # Non-zero when anything needs a human before grading.
    return 1 if (modified or unread) else 0


if __name__ == '__main__':
    sys.exit(main())
