#!/usr/bin/env python3
"""
Audit-opinion evidence gate for the Indiana county ACFRs (waves 1 and 2).

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

# ⚠⚠ THE VERDICT HEADING CAN BE BARE WHILE THE AUDITOR NAMES THE UNIT ANYWAY.
#
# Wave 2. St. Joseph FY2020 prints a bare `Adverse Opinion` and Elkhart FY2020 a
# bare `Qualified Opinion` — but each sits directly under its own
# `Basis for <kind> Opinion on <unit>` heading, which DOES name the unit:
#
#     Basis for Adverse Opinion on Aggregate Discretely Presented Component Units
#     Adverse Opinion                       <- bare
#     Unmodified Opinions                   <- governmental activities, each major
#                                              fund, aggregate remaining fund info
#
# The conservative default below — "a modification with no named unit modifies
# everything" — then reported BOTH as fund-level hits. Reading the documents
# showed both name a DISCRETELY PRESENTED COMPONENT UNIT and neither touches the
# funds. Two false positives standing beside the one real signal is exactly the
# dilution this gate was written to avoid, so the basis heading is read.
#
# ⚠ It is a NARROWING of an existing conservative default, never a widening: the
# unit is taken from the auditor's OWN heading, and when there is no such heading
# the in-scope default is unchanged.
_BASIS_HEADING = re.compile(
    r'^\s*Basis\s+(?:for|of)\s+((?:Adverse|Disclaimer\s+of|(?<![Uu]n)Qualified)'
    r'(?:\s+(?:and\s+)?(?:Adverse|Disclaimer\s+of|Disclaimed|(?<![Uu]n)Qualified'
    r'|Unmodified))*)\s+Opinions?\s+on\s+(?:the\s+)?([^\n]{0,160}?)\s*$',
    re.I | re.M)

# ⚠⚠ AND THE UNIT CAN BE NAMED IN NEITHER HEADING — ONLY IN THE VERDICT ITSELF.
#
# Wave 3. Porter County FY2019 prints a bare `Basis for Adverse Opinion` AND a
# bare `Adverse Opinion`, so the wave-2 rule above finds nothing to borrow and
# the conservative default reports a FUND-LEVEL modification. The auditor does
# name the unit — in the opinion sentence:
#
#     Adverse Opinion
#         In our opinion, because of the significance of the matters discussed
#         in the Basis for Adverse Opinion paragraph, the financial statements
#         referred to above DO NOT PRESENT FAIRLY THE FINANCIAL POSITION OF THE
#         AGGREGATE DISCRETELY PRESENTED COMPONENT UNITS of the County, as of
#         December 31, 2019, ...
#
# The county's own `Summary of Opinions` table agrees line for line —
# Governmental Activities, General, Cumulative Bridge, Co Revenue Bond Project,
# Cable Franchise, the Foundation, Foundation Holding Account and Aggregate
# Remaining Funds are all Unmodified; only the Aggregate Discretely Presented
# Component Units are Adverse — and the basis paragraph names the two causes:
# the Porter County Airport's capital-asset estimates and the OMITTED Porter
# County Public Library. Both live only on the government-wide statements.
#
# ⚠ THE THIRD SOURCE IS TRIED LAST AND NARROWS NOTHING ELSE: heading unit first,
# then the matching basis heading, then this. With no verdict sentence either,
# the in-scope default is unchanged. The unit is still the AUDITOR'S OWN WORDS —
# what is relaxed is where on the page they are read from.
#
# ⚠ ANCHORED AT BOTH ENDS AND SENTENCE-BOUND. `[^.]` cannot cross a full stop,
# so a later paragraph about a different unit can never supply this verdict's
# unit; and the tail `of the County, as of` is the auditor's own fixed wording,
# so a sentence that does not have this exact shape matches NOTHING and leaves
# the conservative in-scope default in place — the right direction to fail.
_VERDICT_UNIT = re.compile(
    r'presents?\s+fairly[^.]{0,300}?(?:respective\s+)?financial\s+position\s+of\s+'
    r'(?:the\s+)?([^.]{0,240}?)\s+of\s+the\s+County\s*,\s*as\s+of\b',
    re.I)

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

# ⚠⚠ TWO WAVE-2 DOCUMENTS FAILED THIS PHRASE CHECK WHILE BEING PERFECTLY CLEAN,
# and neither failure was about the audit:
#
#   Tippecanoe FY2019   the AUDITOR'S OWN GRAMMAR — "the financial statements
#                       referred to above PRESENTS fairly, in all material
#                       respects". Allen County's `EXPENDITURES ,AND` typo
#                       (failure mode 12) moved from the issuer's title into the
#                       auditor's sentence.
#   Elkhart FY2024      HYPHENATION ACROSS A LINE BREAK — "present fairly, in all
#                       mate-\nrial respects". Nothing is wrong with the document
#                       at all; `pdftotext` faithfully reproduced the typesetting.
#
# Both reported `fair=0`, which reads as A MEASUREMENT FAILURE and would block
# `audited_gaap` on a clean report if taken at face value. `dehyphenate` joins
# words split across lines before any phrase is matched, and the verb is allowed
# its stray `s`. ⚠ NEITHER relaxation can turn a modified opinion into a clean
# one: this phrase is evidence that a GAAP fair-presentation opinion EXISTS, and
# the modified/unmodified question is decided by the HEADINGS, separately.
_FAIR = re.compile(r'presents?\s+fairly,?\s+in\s+all\s+material\s+respects', re.I)
_HYPHEN_BREAK = re.compile(r'(?<=[a-z])-[ \t]*\r?\n[ \t]*(?=[a-z])')


def dehyphenate(text):
    """Join a word split across a line break. Digits and headings are untouched:
    both sides of the hyphen must be LOWERCASE letters, so `Highways and\nStreets`
    and `2024-\n2025` are left exactly as they are."""
    return _HYPHEN_BREAK.sub('', text)
_GAAP = re.compile(r'accounting\s+principles\s+generally\s+accepted', re.I)
_OCBOA = re.compile(
    r'modified\s+cash\s+basis|regulatory\s+basis|cash\s+basis\s+of\s+accounting'
    r'|basis\s+of\s+accounting\s+other\s+than', re.I)


def _kind_key(kind):
    """`Adverse Opinion` and `Adverse` reduce to the same key.

    ⚠ The verdict heading's captured group INCLUDES the word `Opinion`
    (`Adverse Opinion`) and the basis heading's does not (`Basis for Adverse
    Opinion on ...` captures just `Adverse`). Keying the two dictionaries
    differently is how the first version of this lookup matched nothing at all
    while looking exactly right.
    """
    return re.sub(r'\s+opinions?$', '', kind.strip().lower())


# ⚠⚠ THE SBOA DUAL-OPINION SIGNATURE — what actually makes a report
# regulatory basis.
#
# An Indiana State Board of Accounts regulatory-basis report gives TWO opinions:
# ADVERSE on U.S. generally accepted accounting principles, and unmodified on the
# regulatory basis described in the notes. That adverse-on-GAAP opinion IS the
# definition, it is printed as its own heading, and all seventeen regulatory-basis
# documents in this corpus carry it.
#
# ⚠⚠ IT REPLACES A DISCRIMINATOR THAT RESTED ON A VERB ENDING. The previous rule
# was `an OCBOA phrase AND NO fair-presentation phrase`, and the reason the second
# half held was not about the basis of accounting at all: SBOA writes "the
# financial statement referred to above PRESENTS fairly" (singular — one
# statement) where a private firm writes "the financial statements ... PRESENT
# fairly" (plural). The phrase regex required the plural. Every regulatory-basis
# report DOES state a fair-presentation opinion — on the regulatory basis — so
# the old rule classified 17 documents correctly by accident of grammar, and
# relaxing the verb to `presents?` (needed for Tippecanoe FY2019, where the
# AUDITOR wrote the singular in a GAAP report) silently emptied the whole
# category.
_ADVERSE_ON_GAAP = re.compile(
    r'Adverse\s+Opinions?\s+on\s+(?:the\s+)?(?:U\.?\s?S\.?\s+)?'
    r'(?:Accounting\s+Principles\s+)?Generally\s+Accepted'
    r'(?:\s+Accounting\s+Principles)?', re.I)


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
            'adverse_on_gaap': False, 'auditor_report_page': None,
        }
    # ⚠ Dehyphenate BEFORE anything is matched — see `_FAIR`. Headings are
    # unaffected (the rule needs lowercase letters either side of the hyphen).
    text = dehyphenate(text)

    # The auditor's own `Basis for <kind> Opinion on <unit>` headings, kept per
    # KIND so a bare verdict below can borrow the unit its own basis names.
    basis_units = {}
    for m in _BASIS_HEADING.finditer(text):
        kind = re.sub(r'\s+', ' ', m.group(1)).strip().lower()
        unit = re.sub(r'\s+', ' ', m.group(2)).strip()
        # ⚠ A COMPOUND basis heading (`Basis for Qualified and Unmodified
        # Opinions`) is the umbrella over the whole report and names no single
        # unit — the same trap the verdict headings have. Those never reach here,
        # because this pattern requires ` on <unit>` and the umbrella has none.
        basis_units.setdefault(_kind_key(kind), []).append(unit)

    headings = []
    for m in _HEADING.finditer(text):
        if _COMPOUND_HEADING.match(m.group(0)):
            continue
        kind = re.sub(r'\s+', ' ', m.group(1)).strip()
        unit = re.sub(r'\s+', ' ', (m.group(2) or '')).strip()
        if unit:
            headings.append((kind, unit))
            continue
        # ⚠⚠ EVERY basis heading of this kind, not the first.
        #
        # Allen County FY2020 prints TWO — `Basis for Qualified Opinion on the
        # Discretely Presented Component Unit` and `Basis for Qualified Opinion
        # on the Aggregate Remaining Fund Information` — under ONE bare
        # `Qualified Opinions` verdict. Taking only the first resolved the year
        # to the component unit and marked it OUT OF SCOPE: wave 1's single
        # genuine fund-level modification, silently downgraded by a lookup that
        # answered plausibly. One entry per named unit, so the fund unit is seen.
        #
        # ⚠ Still the conservative default when the auditor named nothing
        # anywhere: no basis heading means one bare, unit-less entry, which the
        # in-scope test below treats as modifying everything.
        borrowed = basis_units.get(_kind_key(kind))
        if not borrowed:
            # ⚠⚠ THIRD AND LAST SOURCE: the verdict's OWN SENTENCE — see
            # `_VERDICT_UNIT`. Porter FY2019 names its unit nowhere else.
            # Bounded by the NEXT heading so one verdict can never read the
            # sentence belonging to another.
            nxt = _HEADING.search(text, m.end())
            para = text[m.end():nxt.start() if nxt else len(text)]
            said = _VERDICT_UNIT.search(para)
            borrowed = [re.sub(r'\s+', ' ', said.group(1)).strip()] if said else ['']
        for u in borrowed:
            headings.append((kind, u))

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
        # ⚠⚠ The SBOA dual opinion — see `_ADVERSE_ON_GAAP`. This, not the
        # absence of a fair-presentation phrase, is what says regulatory basis.
        'adverse_on_gaap': bool(_ADVERSE_ON_GAAP.search(text)),
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
            r['regulatory_basis'] = r['ocboa_phrase'] and r['adverse_on_gaap']
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
