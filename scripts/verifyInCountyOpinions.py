#!/usr/bin/env python3
"""
Audit-opinion evidence gate for the Indiana county ACFRs (wave 1).

A row may carry `audit_grade = audited_gaap` only where THIS script finds, in
that specific document, the auditor's own opinion on the statements the row is
built from. It reports; it never grades.

Usage:
  python scripts/verifyInCountyOpinions.py
  python scripts/verifyInCountyOpinions.py --entity allen
  python scripts/verifyInCountyOpinions.py --dir _acfr-work/in-counties/acfr

── ⚠⚠ WHY A WORD-PRESENCE GATE IS NOT ENOUGH HERE ─────────────────────────

`scripts/verifyCoKsOpinions.py` answers "is there an unmodified opinion in this
document, and does it contain modified-opinion WORDS". For Colorado and Kansas
that was the right question. Indiana's counties break it, because **modified
opinions here are real, common, and confined to an opinion unit this route does
not load**:

    Allen County    ALL TEN YEARS carry a QUALIFIED opinion on the AGGREGATE
                    DISCRETELY PRESENTED COMPONENT UNITS — the county omits
                    four fire protection districts (two, in the earlier years)
                    that GAAP requires it to present. Governmental Activities,
                    every major fund and the Aggregate Remaining Fund
                    Information are UNMODIFIED in all ten.

    Lake County     FY2020 and FY2021 carry a DISCLAIMER on GOVERNMENTAL
                    ACTIVITIES ($288,186,733 of capital assets with no
                    supporting documentation) and an ADVERSE opinion on the
                    component units. Each MAJOR FUND and the Aggregate Remaining
                    Fund Information are UNMODIFIED.

A word-presence gate flags all twelve identically and downgrades nothing, which
is the `project_audit_grade_reader_facing` defect — a qualified opinion grading
the same as a clean one — in a place where it would actually matter.

⭐ So this gate reads the ISSUER'S OWN OPINION-UNIT HEADINGS instead. Every
Indiana SBOA-audited report prints them as section headings ("Qualified Opinion
on the Aggregate Discretely Presented Component Units", "Unmodified Opinions"),
and most also print a `Summary of Opinions` table. What is loaded here is the
GOVERNMENTAL FUNDS column, so the question is whether any modification names a
FUND-LEVEL unit.

⚠⚠ THE DISCLAIMER ON LAKE'S GOVERNMENTAL ACTIVITIES IS NOT A DISCLAIMER ON ITS
GOVERNMENTAL FUNDS. Governmental Activities is the GOVERNMENT-WIDE statement,
full accrual, and the auditor's stated basis is capital assets and depreciation
— which do not appear in a modified-accrual governmental FUNDS statement at all.
The funds this route reads are covered by the unmodified fund-level opinions.
That reasoning is recorded rather than assumed, and both years are FLAGGED so a
reader sees the disclaimer.

⚠ A modified-opinion WORD is not a modified opinion — "qualified opinion" and
"adverse opinion" appear in boilerplate and in the Single Audit compliance
report. Only a HEADING is read as the auditor's verdict.

⚠⚠ AND `(?<!un)` IS LOAD-BEARING: a bare `qualified` also matches inside
`UNqualified`, the opposite meaning. That inversion reported evidence of a clean
opinion as a defect on 20 documents once already.
"""

import argparse
import json
import os
import re
import subprocess
import sys

#: Force UTF-8 on the console — this file's own output uses ⚠, and the Windows
#: default cp1252 raises UnicodeEncodeError rather than printing the finding.
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:  # pragma: no cover — a stream that cannot be reconfigured
    pass

# ⚠ The auditor's report proper, NOT the table of contents entry (which carries
# dot leaders and a page number) and NOT the two Government Auditing Standards /
# Uniform Guidance reports at the back (whose headings continue "ON INTERNAL
# CONTROL ..." / "ON COMPLIANCE ..."). Marion's report sits ~40 pages in and
# Hamilton's ~25, so a fixed front-matter window misses both.
_AUDITOR_PAGE = re.compile(
    r"^\s*INDEPENDENT\s+AUDITORS?'?S?\s+REPORT\s*(\(Continued\))?\s*$",
    re.I | re.M)

# A SINGLE-kind heading naming one opinion unit — the auditor's verdict.
_HEADING = re.compile(
    r'^\s*((?:Adverse|Disclaimer\s+of|(?<![Uu]n)Qualified|Unmodified)\s+Opinions?)'
    r'(?:\s+on\s+(?:the\s+)?([^\n]{0,120}?))?\s*$',
    re.I | re.M)

# ⚠⚠ A COMPOUND HEADING IS THE SECTION TITLE, NOT A VERDICT. Allen prints
# `Qualified and Unmodified Opinions` and Lake FY2021 prints `Adverse,
# Disclaimed, and Unmodified Opinions` as the umbrella over the whole report,
# then gives each unit its own single-kind heading below. Reading the umbrella as
# a verdict marked every Allen year as modified IN SCOPE — a false positive that
# would have buried the one signal this gate exists to surface.
_COMPOUND_HEADING = re.compile(
    r'^\s*(?:Adverse|Disclaimer\s+of|Disclaimed|(?<![Uu]n)Qualified|Unmodified)'
    r'(?:\s*,)?(?:\s+(?:and\s+)?(?:Adverse|Disclaimer\s+of|Disclaimed|'
    r'(?<![Uu]n)Qualified|Unmodified))+\s+Opinions?\s*$',
    re.I | re.M)

# The opinion units whose figures this route actually loads. A modification
# naming one of these means the loaded numbers are themselves qualified.
_FUND_UNITS = re.compile(
    r'general\s+fund|major\s+fund|remaining\s+fund\s+information|governmental\s+funds?\b',
    re.I)

# Units outside what a governmental-FUNDS row reports.
#
# ⚠ `component` WITHOUT requiring the word `unit`: Allen FY2022's heading wraps
# mid-phrase and `pdftotext -layout` renders it `Qualified Opinions on the
# Discretely Presented Component`. Requiring `component unit` classified that as
# a FUND-LEVEL modification — a false positive sitting beside the one real hit,
# which is the worst place for it.
_OUT_OF_SCOPE_UNITS = re.compile(
    r'component|business[-\s]type\s+activities|governmental\s+activities'
    r'|proprietary|fiduciary|enterprise'
    # ⚠⚠ THE SBOA DUAL OPINION. A regulatory-basis report gives an ADVERSE
    # opinion "on U.S. Generally Accepted Accounting Principles" and an
    # unmodified one on the regulatory basis. That is a statement about the
    # FRAMEWORK, not about a fund — and those documents are excluded from this
    # route by IN_COUNTY_BASIS_GAPS anyway.
    r'|generally\s+accepted\s+accounting\s+principles|regulatory\s+basis',
    re.I)

_FAIR = re.compile(r'present\s+fairly,?\s+in\s+all\s+material\s+respects', re.I)
_GAAP = re.compile(r'accounting\s+principles\s+generally\s+accepted', re.I)
_OCBOA = re.compile(
    r'modified\s+cash\s+basis|regulatory\s+basis|cash\s+basis\s+of\s+accounting'
    r'|basis\s+of\s+accounting\s+other\s+than', re.I)


def pdf_pages(path):
    out = subprocess.run(['pdftotext', '-layout', path, '-'],
                         capture_output=True, text=True, errors='replace').stdout
    return out.split('\f')


def auditor_report_text(pages, window=8):
    """The auditor's report, located by its own heading.

    Returns (text, first_page_index) or ('', None). ⚠ The heading must be alone
    on its line: the table-of-contents entry carries dot leaders and a page
    number, and the two back-of-report Government Auditing Standards / Uniform
    Guidance opinions continue onto the same line.
    """
    for i, p in enumerate(pages):
        if _AUDITOR_PAGE.search(p):
            return '\n'.join(pages[i:i + window]), i
    return '', None


def assess(path):
    """What the auditor said, from that auditor's own section headings."""
    pages = pdf_pages(path)
    text, page_index = auditor_report_text(pages)
    if not text:
        # ⚠ Absence of the heading is a MEASUREMENT FAILURE, not a clean report.
        # Report it; never let it read as "no modifications found".
        return {
            'headings': [], 'modified': [], 'modified_in_scope': [],
            'has_unmodified_fund_opinion': False, 'fair_presentation_phrase': False,
            'gaap_conformity_phrase': False, 'ocboa_phrase': False,
            'auditor_report_page': None,
        }
    headings = []
    for m in _HEADING.finditer(text):
        if _COMPOUND_HEADING.match(m.group(0)):
            continue
        kind = re.sub(r'\s+', ' ', m.group(1)).strip()
        unit = re.sub(r'\s+', ' ', (m.group(2) or '')).strip()
        headings.append((kind, unit))

    modified = [(k, u) for k, u in headings if not re.match(r'^unmodified', k, re.I)]
    # ⚠ A modification with NO named unit modifies everything — treat it as
    # in-scope. Silence about the unit is not evidence that funds are excluded.
    in_scope = [(k, u) for k, u in modified
                if _FUND_UNITS.search(u) or not _OUT_OF_SCOPE_UNITS.search(u)]
    unmodified_fund = any(
        re.match(r'^unmodified', k, re.I) and (not u or _FUND_UNITS.search(u))
        for k, u in headings)

    return {
        'headings': headings,
        'modified': modified,
        'modified_in_scope': in_scope,
        'has_unmodified_fund_opinion': unmodified_fund,
        'fair_presentation_phrase': bool(_FAIR.search(text)),
        'gaap_conformity_phrase': bool(_GAAP.search(text)),
        # ⚠⚠ ONE OCBOA HIDES IN A GAAP COHORT — Brown County SD. And in Indiana
        # it is not hiding at all: 459 of 562 county filings are regulatory
        # basis. A GAAP document should not carry these phrases about ITSELF.
        'ocboa_phrase': bool(_OCBOA.search(text)),
        'auditor_report_page': page_index,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dir', default=os.path.join('_acfr-work', 'in-counties', 'acfr'))
    ap.add_argument('--entity')
    ap.add_argument('--json', action='store_true', help='emit the findings as JSON')
    args = ap.parse_args()

    if not os.path.isdir(args.dir):
        print(f'REFUSING: {args.dir} does not exist. Fetch the documents first.')
        return 1

    keys = sorted(d for d in os.listdir(args.dir)
                  if os.path.isdir(os.path.join(args.dir, d)))
    if args.entity:
        keys = [k for k in keys if k == args.entity]
    if not keys:
        print('REFUSING: no entity matched. A gate that measures nothing must fail.')
        return 1

    findings = {}
    checked = 0
    unreadable = []
    in_scope_hits = []
    out_of_scope_hits = []
    regulatory_basis = []

    for key in keys:
        d = os.path.join(args.dir, key)
        pdfs = sorted(f for f in os.listdir(d) if f.endswith('.pdf'))
        for f in pdfs:
            stem = f[:-4]
            r = assess(os.path.join(d, f))
            findings[stem] = r
            checked += 1
            # ⚠⚠ A REGULATORY-BASIS REPORT IS NOT AN UNREADABLE ONE. It states
            # no GAAP fair-presentation opinion because it is not a GAAP report:
            # there is no governmental-funds statement in it to grade. Counting
            # it as a measurement failure would bury the real ones.
            r['regulatory_basis'] = r['ocboa_phrase'] and not r['fair_presentation_phrase']
            if r['regulatory_basis']:
                regulatory_basis.append(stem)
            elif not (r['fair_presentation_phrase'] and r['gaap_conformity_phrase']):
                unreadable.append(stem)
            flags = []
            if r['auditor_report_page'] is None:
                flags.append('AUDITOR REPORT NOT LOCATED')
            if r['ocboa_phrase']:
                flags.append('OCBOA-PHRASE')
            for kind, unit in r['modified']:
                where = 'IN SCOPE' if (kind, unit) in r['modified_in_scope'] else 'out of scope'
                flags.append(f'{kind}{" on " + unit if unit else ""} [{where}]')
            if r['regulatory_basis']:
                pass
            elif r['modified_in_scope']:
                in_scope_hits.append(stem)
            elif r['modified']:
                out_of_scope_hits.append(stem)
            print(f'  {stem:<18} fair={int(r["fair_presentation_phrase"])} '
                  f'gaap={int(r["gaap_conformity_phrase"])} '
                  f'fundopinion={int(r["has_unmodified_fund_opinion"])}'
                  + ('   ' + ' | '.join(flags) if flags else ''))

    print(f'\n{checked} document(s) read.')
    if regulatory_basis:
        print(f'\nREGULATORY-BASIS reports ({len(regulatory_basis)}) — no GAAP '
              'governmental-funds statement exists in these, so this route cannot load them '
              'and their opinions are not graded here. ⭐ Their presence CORROBORATES '
              'IN_COUNTY_BASIS_GAPS from the documents themselves, independently of FAC\'s '
              f'metadata:\n  {", ".join(regulatory_basis)}')
    if unreadable:
        print(f'\n⚠ NO fair-presentation + GAAP phrase pair found in {len(unreadable)}: '
              + ', '.join(unreadable))
    if out_of_scope_hits:
        print(f'\nModified opinions OUTSIDE the loaded scope ({len(out_of_scope_hits)}) — '
              'reported, and to be recorded per entity-year, never silently dropped:\n  '
              + ', '.join(out_of_scope_hits))
    if in_scope_hits:
        print(f'\n⚠⚠ MODIFIED OPINIONS ON A FUND-LEVEL UNIT ({len(in_scope_hits)}) — these '
              'touch the figures this route loads:\n  ' + ', '.join(in_scope_hits))

    if args.json:
        print('\n' + json.dumps(findings, indent=1))

    # ⚠ A gate that measured nothing must FAIL, not pass.
    if checked == 0:
        print('REFUSING: zero documents read.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
