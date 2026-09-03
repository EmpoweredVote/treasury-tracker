#!/usr/bin/env python3
"""
Shared COORDINATE-BASED General Fund extractor for ACFR governmental-funds
statements (GAAP actuals).

Common machinery behind the per-entity `scripts/extract<Entity>Coords.py`
scripts, each a thin wrapper supplying a `CoordsConfig`. Emits the same JSON
contract as `scripts/lib/acfrGF.py` (`fiscal_year`, `mode`, `tree`,
`computed_total`, `printed_total`, `tie_delta`, `zero_rows`), so
`scripts/lib/acfrGfLoad.mjs` drives it exactly like every `-table` extractor.

Reads the page through `scripts/acfrGfComponents.py` — pdfplumber glyph
coordinates — instead of the `pdftotext -table` character grid. It shares no
code and no strategy with `acfrGF.py`:

  acfrGF.py    flattens the page onto a CHARACTER grid, then assigns each money
               token to the nearest column anchor.
  this module  the PDF's own glyph x-coordinates. Never sees the character
               grid, so the grid's artifacts cannot reach it.

── WHEN AN ENTITY BELONGS HERE ─────────────────────────────────────────────
Only on a DIAGNOSED, mechanical failure of the `-table` reader — never because
a year "happened to tie" here and not there. Choosing per year whichever
strategy tied $0 is CURVE-FITTING, the error that got the LA-01 scope verdict
retracted. The choice is made per ENTITY, for a reason stated in that entity's
wrapper, and the other reader is then required to CORROBORATE every year it can
still read (see `scripts/verify-nc.mjs`, `scripts/verify-colorado.mjs`).

The three diagnosed reasons in this corpus, each confirmed by arithmetic that
lands on the dollar:

  TWO-OFFSET COLUMN   `pdftotext -table` renders the General Fund column at two
                      different character positions, so rows whose later cells
                      are dashes sit ~20 characters right and read $0.
                      El Paso County FY2020's four dropped rows sum to
                      7,761,496 = its exact tie delta; Durham County NC
                      FY2006-FY2011 fails identically (FY2008's four dropped
                      rows sum to 1,049,599 + 4,859,005 + 2,062,145 + 659,642 =
                      8,630,391 = its exact delta); Austin FY2002-FY2009 too.

  EMBEDDED LABEL FIGURE
                      El Paso prints its TABOR refund INSIDE the revenue label
                      ("Sales taxes net of $4,477,783 TABOR limitation"), which
                      the ordinal reader returns as the amount.

  LETTER-SPACED GLYPHS
                      The PDF sets character spacing such that `-table` splits
                      every word: Asheville FY2021/FY2022 render
                      "A d valo rem taxes" and "T o t a l e xpe ndit ure s", so
                      no label or section regex can match anything on the page.

In glyph space none of the three exists: the column has ONE x-position, the
label's embedded figure sits tens of points from the column edge, and character
spacing is not a word boundary.

── NESTING COMES FROM THE PAGE, NOT FROM CONFIG ────────────────────────────
`acfrGF.CityConfig` needs `parents` / `root_leaves` / `subparents` declared by
hand because `-table` flattens the leading whitespace that states the
hierarchy. Glyph coordinates keep it, so this module reads the tree off the
printed INDENTATION and needs no structural declaration at all — at ANY depth
the issuer prints. That matters: a tie proves arithmetic and never structure,
so a hand-declared nesting can be wrong while every gate stays green.
"""

import argparse
import json
import pathlib
import re
import sys

import pdfplumber

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from acfrGfComponents import (  # noqa: E402
    collect, establish_column, find_statement, lines_of,
    numbers_on, REV_BANNER, REV_TOTAL, EXP_BANNER, EXP_TOTAL,
)

# Indentation deeper than the section's root by more than this many points is a
# CHILD row. Measured gaps are 5.0pt (El Paso 69.8 -> 74.8) and 8.3pt
# (Asheville 53.6 -> 61.9), and fund columns are 50-90pt apart, so this sits
# clear of both. A row within tolerance of the root x0 is a root-level peer
# even if it is visually a hair off.
INDENT_TOL = 1.5


class CoordsConfig:
    """Per-entity facts for the coordinate reader.

    city            display name stamped into the emitted JSON.
    units           multiplier applied to every amount. ⚠ NOT checkable by the
                    tie gate, which compares a sum against a printed total read
                    through the SAME multiplier and is therefore 0 whether or
                    not the scaling is right. Checked by the loader's per-capita
                    plausibility guard.
    weld            `collect`'s wrapped-label policy, opt-in and per issuer.

                      'disclosure' — the two printed lines share ONE indent and
                        one of them carries an embedded figure (El Paso's TABOR
                        wrap).
                      'indent'     — the continuation is printed DEEPER than the
                        prefix and carries the money (City of Charlotte's
                        'Engineering and property / management'). Told from a
                        group heading by indent LEVEL: a heading sits at the
                        section root, a wrapped prefix at the child level.
                      None         — weld nothing.

                    ⚠ Turning one on where it is not needed risks fusing two
                    genuine line items, which ties at $0 while publishing a
                    label the issuer never printed.
    exclude_ignore  `_EXCLUDE` terms to stop disqualifying a page, for issuers
                    that print an excluded phrase ON the primary statement.
    title_anchor    optional extra regex qualifying the statement page where
                    the printed title cannot be matched left-to-right.
    label_fixes     {exact_observed_label: corrected_label}, applied to the
                    EMITTED tree only — it never changes an amount, a nesting
                    decision or a tie.

                    ⚠ EXACT MATCH ONLY. No fuzzy repair and no de-spacing
                    heuristic: a rule that rejoined runs of capitals would
                    happily corrupt a legitimate label, and `acfrGF.CityConfig`
                    already records why that trade is refused. Every entry must
                    be a specific string observed in a specific document and
                    checked against how the SAME line reads in neighbouring
                    years of the same issuer.

                    ⚠ WHY IT IS NEEDED HERE, and why no structural rule replaces
                    it. Mecklenburg County FY2025 prints

                        ind=65.0  blank   'Customer satisfaction and'
                        ind=75.0  number  'management'      40,249,095

                    which is a WRAPPED LABEL — but `Debt Service` on the same
                    page has an identical signature (blank at the root indent,
                    followed by a deeper row) and is a GROUP HEADING. At the
                    section root the two are structurally indistinguishable, so
                    `weld='indent'` deliberately refuses to act there. The money
                    is correct either way; only the printed NAME is lost, and a
                    declared fix is the honest repair.

    collapse_children
                    exact PARENT labels (as they read AFTER `label_fixes`) whose
                    single child is a wrapped-label artifact rather than a real
                    line item, and which should therefore be published as a LEAF.

                    ⚠ Renaming alone cannot fix this. Mecklenburg FY2025 prints
                    'Customer satisfaction and' / 'management' as a wrapped
                    label; the reader reads it as a parent with one child, and a
                    `label_fixes` entry corrects the parent's NAME while leaving
                    a child literally called `management` underneath it.

                    ⚠ IT IS DECLARED, NOT INFERRED. "A root-level heading with
                    exactly one child is a wrapped label" is true of all 21
                    Mecklenburg documents and is still only a fact about 21
                    documents — a genuine single-child group (a Debt Service
                    section with only Principal in it) would be silently
                    flattened by such a rule. Naming the parent makes the claim
                    checkable and keeps it from spreading.

                    REFUSES to act unless the node really has exactly one child,
                    so a document that changes shape fails loudly instead of
                    quietly dropping figures.

    indent_tol      points of slack allowed when deciding whether a row sits at
                    the SECTION ROOT. Defaults to the module's INDENT_TOL (1.5),
                    which suits an issuer whose root-level headings are printed
                    at one x-position.

                    ⚠ Raise it ONLY on a MEASURED root spread, and only far
                    enough to cover it. Mecklenburg County FY2005-FY2011 print
                    `Current` about 2pt deeper than its own sibling headings
                    `Debt Service` and `Capital Outlay`, so `min(indents)` lands
                    on the shallower pair and `Current` reads as a child with no
                    parent open. Measured across that era:

                        FY      root spread   root -> first child
                        2005       1.92            3.84
                        2006       2.90            3.80
                        2007       1.90            3.80
                        2008       1.82            3.68
                        2009       1.84            3.67
                        2010       1.93            3.83
                        2011       2.03            4.08

                    A tolerance must be at least the spread and less than
                    spread + gap, so this era admits 2.90 <= tol < 5.50 and the
                    entity declares 4.0 — 1.10pt above the widest spread and
                    1.50pt below the tightest child gap.

                    ⚠ It is PER ENTITY and not a new global default on purpose.
                    El Paso County's root->child gap is 5.0pt, so a shared 4.0
                    would leave that entity 1pt of margin where it currently has
                    3.5. The same figure is safe here and marginal there, which
                    is exactly what a per-entity fact is for.
    """

    def __init__(self, city, units=1, weld=None, exclude_ignore=(), title_anchor=None,
                 indent_tol=None, label_fixes=None, collapse_children=()):
        if not isinstance(units, int) or isinstance(units, bool):
            raise TypeError(
                'CoordsConfig.units must be an int, got %r (%s). A float would '
                'silently turn every extracted amount into a float and change '
                'the emitted JSON shape.' % (units, type(units).__name__))
        if weld not in (None, 'disclosure', 'indent'):
            raise ValueError("CoordsConfig.weld must be None, 'disclosure' or 'indent', got %r" % (weld,))
        self.city = city
        self.units = units
        self.weld = weld
        self.exclude_ignore = tuple(t.lower() for t in exclude_ignore)
        self.title_anchor = title_anchor
        if indent_tol is not None and not (indent_tol > 0):
            raise ValueError('CoordsConfig.indent_tol must be positive, got %r' % (indent_tol,))
        self.indent_tol = INDENT_TOL if indent_tol is None else float(indent_tol)
        self.label_fixes = dict(label_fixes or {})
        self.collapse_children = tuple(collapse_children or ())
        for observed, corrected in self.label_fixes.items():
            if not observed or not corrected:
                raise ValueError('CoordsConfig.label_fixes entries must both be non-empty, '
                                 'got %r -> %r' % (observed, corrected))
            if observed == corrected:
                raise ValueError('CoordsConfig.label_fixes entry %r is a no-op; remove it '
                                 'rather than leaving a rule that asserts nothing.' % (observed,))


def apply_label_fixes(nodes, fixes, applied):
    """Rewrite declared labels in-place, recording each hit.

    Applied to the finished tree so it cannot influence nesting, amounts or the
    tie — it is a rename and nothing else. A declared fix that never matches is
    reported by `run_cli` as an error, because a rule that stops firing has
    either been fixed upstream (and should be deleted) or is now missing a defect
    it used to catch.
    """
    if not fixes:
        return
    for node in nodes:
        if node.get('n') in fixes:
            applied.add(node['n'])
            node['n'] = fixes[node['n']]
        if node.get('c'):
            apply_label_fixes(node['c'], fixes, applied)


def collapse_declared_children(nodes, names, applied):
    """Publish a declared single-child parent as a LEAF.

    The parent keeps its own amount, which already equals the child's, so no
    figure moves and the tie is untouched. Raises if the node does not have
    exactly one child — a shape change must fail loudly, not silently drop rows.
    """
    if not names:
        return
    for node in nodes:
        if node.get('n') in names and 'c' in node:
            kids = node.get('c') or []
            if len(kids) != 1:
                raise ValueError(
                    'collapse_children declared %r but it has %d children (%r). '
                    'The document has changed shape; re-read the page rather than '
                    'widening this rule.'
                    % (node['n'], len(kids), [k.get('n') for k in kids]))
            if kids[0]['a'] != node['a']:
                raise ValueError(
                    'collapse_children %r: child amount %r != parent amount %r'
                    % (node['n'], kids[0]['a'], node['a']))
            applied.add(node['n'])
            del node['c']
        elif node.get('c'):
            collapse_declared_children(node['c'], names, applied)


def clean_label(label):
    """Strip a TRAILING COLON from a printed label.

    Punctuation only, never wording. Issuers print a group heading as "Current:"
    in some years and "Current" in others, and a category named `Current:` in
    the UI is the issuer's typography leaking into a chart legend.
    `acfrGF._is_section_header` already ignores a trailing colon for the same
    reason, so this keeps the two readers' labels COMPARABLE — which matters
    because the verifiers diff them against each other.
    """
    return label.rstrip(':').strip()


def build_revenue_tree(rows, revenue_parents=(), indent_tol=INDENT_TOL):
    """Revenue children, read off the printed indentation.

    Flat for most issuers: every source is a root child. Where an issuer GROUPS
    its revenue (Asheville prints a `Taxes:` heading over `Ad valorem taxes` and
    `Other taxes`), the group is read from indentation exactly as the
    expenditure side is — no `revenue_parents` declaration is needed, because
    glyph coordinates preserve the indent that states it.

    `revenue_parents` is accepted only so a caller can ASSERT an expected
    grouping; it is not required and is not used to create structure.

    Zero rows are dropped and reported, matching acfrGF's `zero_rows` field.
    """
    indents = [r['indent'] for r in rows if r['indent'] is not None]
    if not indents:
        return [], [], ['no label indentation could be measured']
    root_x = min(indents)
    grouped = any(r['indent'] is not None and r['indent'] > root_x + indent_tol for r in rows)

    if not grouped:
        children, zeros = [], []
        for r in rows:
            if r['amount'] == 0:
                zeros.append(r['label'])
                continue
            children.append({'n': clean_label(r['label']), 'a': r['amount']})
        return children, zeros, []

    tree, zeros, errors = _nested(rows, root_x, indent_tol)
    if revenue_parents:
        got = {n['n'].lower() for n in tree if 'c' in n}
        missing = [p for p in revenue_parents if p.lower() not in got]
        if missing:
            errors.append('expected revenue group(s) %r not found; read %r' % (missing, sorted(got)))
    return tree, zeros, errors


def build_operating_tree(rows, indent_tol=INDENT_TOL):
    """As many levels as the issuer prints, read off the printed indentation.

    A row with money is a VALUED LEAF at the level it is printed (Capital
    outlay, where the issuer puts it at root; Summerville's `Culture and
    recreation`, printed as a peer of the sub-groups). A row with a blank or
    dash cell opens a GROUP, and the rows printed deeper than it are its
    children. A group that ends up with no non-zero descendant is DROPPED
    rather than published as an empty node — the same choice acfrGF makes.
    """
    indents = [r['indent'] for r in rows if r['indent'] is not None]
    if not indents:
        return [], [], ['no label indentation could be measured']
    return _nested(rows, min(indents), indent_tol)


def _nested(rows, root_x, indent_tol=INDENT_TOL):
    """Shared root/child walk for both sections — as many levels as the page prints.

    A row carrying money is a LEAF at whatever level it is printed. A row with
    an empty or dashed General Fund cell OPENS a group there, and the rows
    printed DEEPER than it belong to it; it is dropped if nothing does.

    ⚠⚠ WHY THIS IS NOT A TWO-LEVEL WALK ANY MORE. The Town of Summerville SC
    prints THREE levels — `Current:` > `General Government:` > `Administrative`
    — with `Culture and recreation` a VALUED LEAF sitting at the middle level.
    A root/child reader drops the three valueless sub-headings and promotes
    their twelve children into `Current`, which leaves the leaf multiset
    unchanged and therefore ties at EXACTLY $0 while publishing a shape the
    town never printed. Same class of error as Boulder's `revenue_parents`
    without `revenue_group_members`, and the reason this module reads nesting
    off the page rather than off a declaration.

    ⚠ DEPTH IS RELATIVE TO THE OPEN GROUP, not to the section root. Only the
    OUTERMOST level is decided by the root band (`root_x + indent_tol`); every
    row below it is compared against the group it would sit inside. A row that
    is deeper than the root band with no group open is an error, exactly as
    before — that is how a too-small `indent_tol` still fails loudly.

    ⚠ Handles the case where two DIFFERENT parents carry IDENTICAL child
    labels: Asheville prints `Principal` and `Interest and other charges` under
    both `Debt service:` and `Lease/subscription debt service:`. Because
    children are appended to whichever parent is open, the two pairs stay
    separate and no label collision occurs. A dict keyed on label would have
    merged them and silently halved the reported category count.
    """
    tree, zeros, errors = [], [], []
    stack = []            # open groups, outermost first

    def close(entry):
        """Finish one group: roll its amount up, or drop it if nothing landed."""
        node = entry['node']
        if not node['c']:
            # ⚠ A group with nothing under it is an ABSENCE, not a $0 category.
            # A NON-root one is dropped here, in document order, which is where
            # the two-level reader recorded a $0 child. A root-level one is left
            # for the end-of-loop filter below, so `zeros` keeps the order that
            # reader produced.
            if entry['container'] is not tree:
                # ⚠ By IDENTITY, not equality: two childless groups printed
                # under one parent with the same label are equal dicts, and
                # list.remove would take whichever came first.
                for i, sib in enumerate(entry['container']):
                    if sib is node:
                        del entry['container'][i]
                        break
                zeros.append(node['n'])
            return
        node['a'] = sum(ch['a'] for ch in node['c'])

    for r in rows:
        if r['indent'] is None:
            errors.append('row with no measurable indent: %s' % r['label'][:40])
            continue
        # Close every open group this row is not printed INSIDE.
        while stack and not (r['indent'] > stack[-1]['indent'] + indent_tol):
            close(stack.pop())
        if stack:
            container = stack[-1]['node']['c']
        elif r['indent'] <= root_x + indent_tol:
            container = tree
        else:
            errors.append('indented row with no open parent: %s' % r['label'][:40])
            continue
        if r['amount'] != 0:
            container.append({'n': clean_label(r['label']), 'a': r['amount']})
            continue
        # Ambiguous by value alone (a $0 leaf and a group heading both read 0),
        # so it is opened as a group and dropped above if nothing deeper
        # follows. Publishing it as a $0 leaf would invent a category the issuer
        # did not report.
        node = {'n': clean_label(r['label']), 'a': 0, 'c': []}
        container.append(node)
        stack.append({'indent': r['indent'], 'node': node, 'container': container})
    while stack:
        close(stack.pop())

    kept = []
    for node in tree:
        if 'c' in node and not node['c']:
            zeros.append(node['n'])
            continue
        kept.append(node)
    return kept, zeros, errors


def leaf_sum(tree):
    total = 0
    for node in tree:
        total += sum(c['a'] for c in node['c']) if 'c' in node else node['a']
    return total


def run_cli(cfg):
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path')
    ap.add_argument('--mode', choices=('revenue', 'operating'), required=True)
    ap.add_argument('--page', type=int, default=None)
    args = ap.parse_args()

    with pdfplumber.open(args.pdf_path) as pdf:
        if args.page:
            idx, page = args.page - 1, pdf.pages[args.page - 1]
            text = page.extract_text() or ''
        else:
            idx, page, text = find_statement(pdf, cfg.title_anchor, cfg.exclude_ignore)
        if page is None:
            print('  ERROR: primary GF statement not found in %s' % args.pdf_path, file=sys.stderr)
            sys.exit(3)
        rows_all = lines_of(page)
        alignment, edge = establish_column(rows_all)
        if alignment is None:
            print('  ERROR: General Fund column not established: %s' % edge, file=sys.stderr)
            sys.exit(4)

        if args.mode == 'revenue':
            comps, errs, welds = collect(rows_all, REV_BANNER, REV_TOTAL,
                                         alignment, edge, cfg.units, weld=cfg.weld)
            printed_cols, _ = numbers_on(rows_all, REV_TOTAL)
            children, zeros, more = build_revenue_tree(comps, indent_tol=cfg.indent_tol)
            root_name = 'General Fund Revenue by Source'
        else:
            comps, errs, welds = collect(rows_all, EXP_BANNER, EXP_TOTAL,
                                         alignment, edge, cfg.units, weld=cfg.weld)
            printed_cols, _ = numbers_on(rows_all, EXP_TOTAL)
            children, zeros, more = build_operating_tree(comps, indent_tol=cfg.indent_tol)
            root_name = 'General Fund Expenditure by Function'
        errs = errs + more

        # Declared label repairs — a rename only; see CoordsConfig.label_fixes.
        applied = set()
        apply_label_fixes(children, cfg.label_fixes, applied)
        unused = sorted(set(cfg.label_fixes) - applied)
        collapsed = set()
        collapse_declared_children(children, set(cfg.collapse_children), collapsed)

        # ── Fiscal year off the statement page ──────────────────────────────
        # PRIMARY: the issuer's own period caption. ⚠ 'year ended' alone is too
        # narrow for this corpus — Mecklenburg County prints
        #   FY2013  "FOR THE PERIOD ENDED JUNE 30, 2013"     (period, not year)
        #   FY2010  "GOVERNMENTAL FUNDS JUNE 30, 2010"       (no caption phrase)
        #   FY2011  same as FY2010
        # and all three returned None, which the loader's fiscal-year assertion
        # would then reject as a mis-filed document.
        m = re.search(r'(?:year|period)\s+ended\s+\w+\s*\d{1,2},\s*(\d{4})', text, re.I)
        if not m:
            # FALLBACK: the DOMINANT printed date on the statement page. Measured
            # on the four years that reach it — Mecklenburg FY2006/2010/2011/2013
            # — each page carries EXACTLY ONE `Month D, YYYY` and it is the
            # correct year, so there is nothing for a comparative column to win.
            # ⚠ Applied only when a single year strictly dominates; a tie returns
            # None rather than picking one, because latching a true-but-unrelated
            # year is how King County FY2024 once loaded as FY2023.
            years = re.findall(r'[A-Za-z]+\s+\d{1,2},\s*(\d{4})', text)
            if years:
                counts = {y: years.count(y) for y in set(years)}
                ranked = sorted(counts.items(), key=lambda kv: -kv[1])
                if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
                    m = re.match(r'(\d{4})', ranked[0][0])
        if not m:
            # FUSED TEXT. Mecklenburg FY2006 emits the whole caption without
            # spaces -- 'FORTHEYEARENDEDJUNE30,2006' -- so both attempts above
            # find nothing. Same defect class as City of Durham FY2023, which is
            # why `_NOSPACE` already exists for the statement-page test; this
            # applies it to the period caption too.
            m = re.search(r'(?:YEAR|PERIOD)ENDED[A-Za-z]+\d{1,2},(\d{4})',
                          re.sub(r'\s+', '', text), re.I)

    if errs:
        for e in errs:
            print('  ROW ERROR: %s' % e, file=sys.stderr)
        sys.exit(5)
    if not printed_cols:
        print('  ERROR: printed total row not located', file=sys.stderr)
        sys.exit(6)

    printed_total = printed_cols[0] * cfg.units
    computed_total = leaf_sum(children)
    tie_delta = computed_total - printed_total

    result = {
        'city': cfg.city,
        'fiscal_year': int(m.group(1)) if m else None,
        'mode': args.mode,
        'statement_page': idx + 1,
        'reader': 'pdfplumber-coordinates',
        'alignment': alignment,
        'column_edge': round(edge, 2),
        'tree': {'n': root_name, 'a': computed_total, 'c': children},
        'computed_total': computed_total,
        'printed_total': printed_total,
        'tie_delta': tie_delta,
        'zero_rows': zeros,
        'welded_labels': welds,
        # ⚠ Declared label fixes that did NOT fire on THIS year. Non-empty is
        # normal per year — a repair declared for one document will not match
        # its neighbours. What must hold is that every declared fix fires on at
        # least ONE year of the series; a rule that fires nowhere has either
        # been fixed upstream (delete it) or has stopped catching the defect it
        # was written for. That check is series-level and belongs in the
        # verifier, not here.
        'unused_label_fixes': unused,
        'collapsed_parents': sorted(collapsed),
    }

    if tie_delta != 0:
        print('  TIE FAILURE (%s FY%s): computed %d vs printed %d (delta %d)'
              % (args.mode, result['fiscal_year'], computed_total, printed_total, tie_delta),
              file=sys.stderr)
        print(json.dumps(result, indent=2))
        sys.exit(1)

    print(json.dumps(result, indent=2))
