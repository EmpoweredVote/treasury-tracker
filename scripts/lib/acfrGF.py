#!/usr/bin/env python3
"""
Shared General Fund extractor for city ACFRs (GAAP actuals).

Common machinery behind the per-city `scripts/extract<City>.py` scripts. Each
city script is a thin wrapper supplying a `CityConfig`; everything below is
identical across cities.

Contract (unchanged from the original per-city scripts):
  * `pdftotext -table` only. `-layout` scrambles the multi-fund columns and is
    never used for VALUES — but see `capital_at_root` below, where `-layout` is
    the tool that answers a question `-table` physically cannot.
  * Column isolation is positional: the fund columns' right edges are anchored
    from the fully-populated `Total revenues` / `Total expenditures` rows, and
    every number is assigned to the nearest column. The General Fund is
    column 0.
  * `tie_delta` (computed_total - printed_total) MUST be 0. A non-zero delta
    prints the offending rows to stderr and exits non-zero, so a mis-parse can
    never pass silently downstream.

THE THREE TRAPS THIS MODULE ENCODES
-----------------------------------
All three produce plausible output; two of them produce a $0 tie while being
WRONG. A tie proves arithmetic — never labels, never structure.

1. **Dash-zero rows.** Cities print `-` for a $0 fund cell. `-` is not a money
   token, so a naive parser sees a line with no numbers, treats it as a WRAPPED
   LABEL, and glues it onto the next real row
   ("Assessments - - - Licenses and permits"). Amounts stay correct, so the tie
   still passes and the corruption is silent and label-only. `classify()`
   distinguishes "label + only dashes" (data, GF = $0) from "label + nothing"
   (a genuine wrapped label). $0 rows are dropped from the tree but reported in
   `zero_rows` so the drop is auditable.

2. **Wrapped statement titles.** Some cities wrap the title so a line begins
   "EXPENDITURES AND CHANGES IN FUND BALANCES". Matching `^Expenditures` as a
   PREFIX starts the expenditure section at the title and swallows the entire
   revenue block — a ~3x inflated operating total. Section headers must
   therefore match the WHOLE line (`_SEC_*` below).

3. **Expenditure nesting** (`CityConfig.parents` / `root_leaves`). Cities group
   spending differently, and `pdftotext -table` FLATTENS indentation, so the
   groupings are indistinguishable in the parsed text. Picking wrong still ties
   — it just mis-nests a node and inflates a sibling parent's subtotal. Resolve
   per city with `pdftotext -layout`, which preserves leading whitespace:

       Tualatin                        Sherwood
         Current:            (2 sp)      Current:            (2 sp)
           General government (4 sp)       Administration    (5 sp)
         Capital outlay      (2 sp)      Noncurrent          (2 sp)
         Debt service:       (2 sp)        Capital Outlay    (5 sp)
           Principal         (4 sp)        Debt Service ...  (5 sp)

   -> Tualatin `root_leaves=('capital ',)`; Sherwood nests it, `root_leaves=()`.

   Hillsboro INVERTS the usual arrangement, which is why this is a list of
   labels and not a `capital_at_root` boolean:

       Hillsboro
         Current:            (1 sp)
           General government (2 sp)
         Debt service  12,500 (1 sp)   <- a VALUED LEAF at root, not a parent
         Capital outlay:      (1 sp)   <- a PARENT with its own children
           General government (2 sp)

All text matching is case-insensitive: some cities set the whole statement in
uppercase ("TOTAL REVENUES"). Case-sensitive matching fails CLOSED there
("primary GF statement not found") rather than mis-parsing, but there is no
reason to make each city rediscover that.
"""

import sys
import re
import json
import subprocess
import argparse


class CityConfig:
    """Per-city structural facts that cannot be inferred from `-table` output.

    parents      lowercase labels that introduce a group of child rows in the
                 expenditure section (e.g. ('current', 'debt service')).
                 Matched against whole LABEL-ONLY lines, colon stripped.
    root_leaves  lowercase label PREFIXES for rows that carry a value but belong
                 at the ROOT of the tree, as peers of the parents rather than
                 children of whichever parent happens to be open. Such a row is
                 emitted at root level and closes the open parent.

    The same label can be a parent in one city and a root leaf in another —
    these are genuinely different documents, not different readings of one:

        Bend / Tualatin / Beaverton   parents=('current','debt service')
                                      root_leaves=('capital ',)
        Sherwood                      parents=('current','noncurrent','debt service')
                                      root_leaves=()            # capital nests under Noncurrent
        Hillsboro                     parents=('current','capital outlay')
                                      root_leaves=('debt service',)
                                      # INVERTED: 'Capital outlay:' is a parent with
                                      # children, 'Debt service' is a valued root leaf

    Always determine both with `pdftotext -layout`, which preserves the leading
    whitespace `-table` flattens. Guessing produces a $0 tie with a wrong tree.

    source_rounding
                 {(fiscal_year, mode): exact_delta} for city-years where the
                 SOURCE's own printed total disagrees with the sum of its own
                 printed components. Bend FY2010 revenue prints a total $1 higher
                 than its eight revenue lines add up to; Bend FY2013 operating
                 does the same. Both were confirmed by reading the rows off the
                 page — the components are parsed correctly and the document is
                 internally inconsistent.

                 This is deliberately NOT a tolerance. A blanket "allow small
                 deltas" rule would let a genuine one-digit mis-parse through.
                 Each entry must state the EXACT expected delta, so anything else
                 — including the same year drifting to a different delta — still
                 fails the gate. Every real mis-parse this parser has produced was
                 off by millions ($210,000,000 Gresham, $36,849,624 Bend FY2014,
                 $14,558,532 Sherwood FY2019), never by a dollar.

                 The emitted tree total is always the COMPONENT SUM, never the
                 printed total, so the loaded row still ties against its own line
                 items.
    label_fixes  {exact_observed_label: corrected_label} for transcription
                 artifacts. Some PDFs letter-space their glyphs, so `-table`
                 splits words: Bend's FY2014 statement emits "Public w ays and
                 facilities" and "Urban renew al" where every adjacent year of the
                 same city prints them normally.

                 EXACT match only — no fuzzy repair, no de-spacing heuristic. A
                 heuristic that rejoined single spaces would happily corrupt
                 legitimate multi-word labels. Every entry here is a specific
                 string observed in a specific document and checked against how
                 the same line reads in neighbouring years.
    """

    def __init__(self, city, parents, root_leaves=(), source_rounding=None,
                 label_fixes=None):
        self.city = city
        self.parents = tuple(p.lower() for p in parents)
        self.root_leaves = tuple(r.lower() for r in root_leaves)
        self.source_rounding = dict(source_rounding or {})
        self.label_fixes = dict(label_fixes or {})


# ── Money parsing ─────────────────────────────────────────────────────────────
_MONEY = re.compile(r'\((?:\d[\d,]*)\)|\$?\s*\d[\d,]*')

def parse_money(tok):
    """'$  8,347,443' -> 8347443 ; '(555,070)' -> -555070 ; '' / '-' -> None."""
    t = tok.replace('$', '').replace(' ', '').strip()
    if not t or t == '-':
        return None
    neg = t.startswith('(')
    t = t.strip('()').replace(',', '')
    if not t.isdigit():
        return None
    return -int(t) if neg else int(t)

def nums_with_pos(line):
    """[(value, end_char_pos)] for every money token on the line."""
    out = []
    for m in _MONEY.finditer(line):
        v = parse_money(m.group())
        if v is not None:
            out.append((v, m.end()))
    return out


# ── Labels ────────────────────────────────────────────────────────────────────
def norm_label(raw):
    """Whitespace-normalize, then drop trailing dash placeholders belonging to
    empty columns left of the first money token ("System development charges - -"
    -> "System development charges"). Only TRAILING runs are removed, so
    "Debt Service - Principal" and "Non-departmental" survive intact."""
    s = re.sub(r'\s+', ' ', raw).strip()
    s = re.sub(r'(?:\s+[-–—])+$', '', s)
    return s.strip().rstrip(':').strip()

def label_of(line):
    """Row label = text before the first money token."""
    m = _MONEY.search(line)
    raw = line[:m.start()] if m else line
    return norm_label(raw)

_DASH_ROW = re.compile(r'^(?P<label>.*?[^\s\-–—])(?P<dashes>(?:\s+[-–—])+)\s*$')

def dash_zero_label(line):
    """Label if `line` is a label followed ONLY by dash placeholders, else None.
    Only meaningful for lines carrying no money tokens (trap 1)."""
    m = _DASH_ROW.match(line.rstrip())
    if not m:
        return None
    label = m.group('label').strip()
    if not label or not m.group('dashes').strip():
        return None
    return norm_label(label)


# ── Statement page location ──────────────────────────────────────────────────
# "Balances?" — Tigard titles its statement "CHANGES IN FUND BALANCE" (singular)
# while every other city so far uses the plural. Requiring the plural silently
# fails detection ("primary GF statement not found") rather than mis-parsing.
_TITLE = re.compile(
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances?',
    re.I)
# A combining / subfund / budgetary page must never be mistaken for the primary
# statement. Budgetary pages in particular are budget-basis (and, for biennial
# cities, biennium-basis) and cannot be split per fiscal year.
_EXCLUDE = ('combining', 'reconciliation', 'budgetary', 'budget and actual',
            'proprietary', 'fiduciary', 'net position')
_FY = re.compile(r'(?:for\s+the\s+)?(?:fiscal\s+)?year\s+ended\s+June\s+30,\s*(\d{4})', re.I)

def table_pages(pdf_path):
    out = subprocess.run(
        ['pdftotext', '-table', pdf_path, '-'],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    if out.returncode != 0:
        print('  pdftotext failed (%s): %s' % (out.returncode, out.stderr.strip()),
              file=sys.stderr)
        sys.exit(2)
    return out.stdout.split('\f')

def find_statement_page(pages):
    """(page_index, page_text) for the primary governmental-funds statement —
    the earliest qualifying page, since basic statements precede supplementary
    schedules. (None, None) if not found."""
    cands = []
    for i, pg in enumerate(pages):
        low = pg.lower()
        if not _TITLE.search(pg):
            continue
        if 'total revenues' not in low or 'total expenditures' not in low:
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in low for x in _EXCLUDE):
            continue
        cands.append((i, pg))
    if not cands:
        return None, None
    cands.sort()
    return cands[0]

def parse_fy(pages, pdf_path):
    for pg in pages:
        m = _FY.search(pg)
        if m:
            return int(m.group(1))
    m = re.search(r'(20\d{2})', pdf_path)
    return int(m.group(1)) if m else None


# ── GF column reader ─────────────────────────────────────────────────────────
def anchors(line):
    return [p for _, p in nums_with_pos(line)]

def gf_value(line, col_anchors):
    """GF value = the number nearest column 0, but only if that number is
    actually closest to anchor[0]. A blank GF cell means the row's first number
    belongs to a later column, so GF is absent rather than that number."""
    best, best_d = None, None
    for v, p in nums_with_pos(line):
        col = min(range(len(col_anchors)), key=lambda k: abs(p - col_anchors[k]))
        if col == 0:
            d = abs(p - col_anchors[0])
            if best_d is None or d < best_d:
                best, best_d = v, d
    return best


# ── Row classification ───────────────────────────────────────────────────────
def classify(line, col_anchors):
    """('data'|'wrapped'|'skip', label, value).

    A row whose GF cell is blank but which HAS numbers in other columns is
    'data' with value 0 — the source genuinely reports $0 for the General Fund
    (trap 1)."""
    if not line.strip():
        return 'skip', '', None

    if not nums_with_pos(line):
        dz = dash_zero_label(line)
        if dz is not None:
            return 'data', dz, 0
        lbl = label_of(line)
        return ('wrapped', lbl, None) if lbl else ('skip', '', None)

    gv = gf_value(line, col_anchors)
    lbl = label_of(line)
    if gv is None:
        return ('data', lbl, 0) if lbl else ('skip', '', None)
    return 'data', lbl, gv


# Section headers must match the WHOLE line (trap 2), compared with ALL internal
# whitespace removed (trap 4).
#
# Trap 4 — letter-spaced headers. Some PDFs render the header with spacing
# between glyphs, so `-table` emits "Re ve nue s" / "Expe nditure s" rather than
# "Revenues". A literal match then never fires, the section never opens, and the
# tree comes back EMPTY with a huge tie delta (Bend FY2014: revenue computed $0
# against a printed $36,849,624). Collapsing whitespace before comparing fixes it
# without loosening anything: the wrapped-title line from trap 2 collapses to
# "expendituresandchangesinfundbalances", which still does not equal
# "expenditures".
_SEC_REVENUES     = 'revenues'
_SEC_EXPENDITURES = 'expenditures'
_END_REVENUES     = r'^Total\s+revenues\b'
_END_EXPENDITURES = r'^Total\s+expenditures\b'

def _is_section_header(line, want):
    """True when `line` is exactly the section header `want`, ignoring internal
    letter-spacing, a trailing colon and a stray currency symbol."""
    s = re.sub(r'\s+', '', line).strip().rstrip('$').rstrip(':').lower()
    return s == want

def _section(lines, start_word, end_pat):
    """Yield raw lines strictly between the start and end header lines."""
    on = False
    for l in lines:
        st = l.strip()
        if not on and _is_section_header(st, start_word):
            on = True
            continue
        if on and re.match(end_pat, st, re.I):
            return
        if on:
            yield l


# ── Tree builders ────────────────────────────────────────────────────────────
def _fix_label(label, cfg):
    """Repair a known transcription artifact (exact match only)."""
    return cfg.label_fixes.get(label, label)


def build_revenue(lines, col_anchors, cfg):
    """Flat GF revenue-by-source tree. $0 sources are recorded and dropped."""
    children, zero_rows = [], []
    pending = ''
    for l in _section(lines, _SEC_REVENUES, _END_REVENUES):
        kind, lbl, val = classify(l, col_anchors)
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            pending = norm_label('%s %s' % (pending, lbl))
            continue
        full = _fix_label(norm_label('%s %s' % (pending, lbl)) if pending else lbl, cfg)
        pending = ''
        if not full:
            continue
        if val == 0:
            zero_rows.append(full)
            continue
        children.append({'n': full, 'a': val})
    total = sum(c['a'] for c in children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': children}, total, zero_rows


def build_operating(lines, col_anchors, cfg):
    """2-level GF expenditure-by-function tree. Parents named in cfg.parents are
    label-only headers whose value is the sum of their children. Capital-outlay
    placement is governed by cfg.capital_at_root (trap 3)."""
    root_children, zero_rows = [], []
    parent = None
    pending = ''
    for l in _section(lines, _SEC_EXPENDITURES, _END_EXPENDITURES):
        if not l.strip():
            continue
        kind, lbl, val = classify(l, col_anchors)
        low = (lbl or '').lower()

        if kind == 'wrapped' and low in cfg.parents:
            parent = {'n': lbl, 'a': 0, 'c': []}
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            pending = norm_label('%s %s' % (pending, lbl))
            continue

        full = _fix_label(norm_label('%s %s' % (pending, lbl)) if pending else lbl, cfg)
        pending = ''
        if not full:
            continue
        if val == 0:
            zero_rows.append(full)
            continue

        node = {'n': full, 'a': val}
        if any(full.lower().startswith(pfx) for pfx in cfg.root_leaves):
            root_children.append(node)   # root-level peer; closes the parent
            parent = None
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    for n in root_children:
        if 'c' in n:
            n['a'] = sum(ch['a'] for ch in n['c'])
    # Drop parents left childless by all-$0 children (an honest absence, e.g. a
    # year with no General Fund debt service).
    root_children = [n for n in root_children if n.get('c') or 'c' not in n]

    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Expenditure by Function', 'a': total, 'c': root_children}, total, zero_rows


# ── Orchestration ────────────────────────────────────────────────────────────
def extract(pdf_path, mode, cfg):
    pages = table_pages(pdf_path)
    pi, pg = find_statement_page(pages)
    if pg is None:
        print('  ERROR: primary GF statement not found in %s' % pdf_path, file=sys.stderr)
        sys.exit(3)
    fy = parse_fy(pages, pdf_path)
    lines = pg.split('\n')
    rev_line = next((l for l in lines if l.strip().lower().startswith('total revenues')), None)
    exp_line = next((l for l in lines if l.strip().lower().startswith('total expenditures')), None)
    if not rev_line or not exp_line:
        print('  ERROR: Total revenues/expenditures rows not found', file=sys.stderr)
        sys.exit(3)
    col_anchors = max(anchors(rev_line), anchors(exp_line), key=len)
    if len(col_anchors) < 2:
        print('  ERROR: could not anchor fund columns', file=sys.stderr)
        sys.exit(3)

    if mode == 'revenue':
        tree, computed, zero_rows = build_revenue(lines, col_anchors, cfg)
        printed = gf_value(rev_line, col_anchors)
    else:
        tree, computed, zero_rows = build_operating(lines, col_anchors, cfg)
        printed = gf_value(exp_line, col_anchors)

    tie_delta = computed - (printed or 0)
    # A registered source-rounding case must match its expected delta EXACTLY.
    accepted = cfg.source_rounding.get((fy, mode))
    accepted = accepted if (accepted is not None and accepted == tie_delta) else None
    result = {
        'fiscal_year': fy,
        'mode': mode,
        'statement_page': pi + 1,
        'tree': tree,
        'computed_total': computed,
        'printed_total': printed,
        'tie_delta': tie_delta,
        'source_rounding_accepted': accepted,
        'zero_rows': zero_rows,
    }
    if accepted is not None:
        print(f'  NOTE ({mode} FY{fy}): printed total {printed:,} disagrees with the sum of '
              f'its own components {computed:,} by {tie_delta:+,} -- accepted as a registered '
              f'source rounding error. Using the component sum.', file=sys.stderr)
    if tie_delta != 0 and accepted is None:
        print('  TIE FAILURE (%s FY%s): computed %s vs printed %s (delta %s)'
              % (mode, fy, computed, printed, tie_delta), file=sys.stderr)
        def leaves(n, d=0):
            print('    %s%s: %s' % ('  ' * d, n['n'], n['a']), file=sys.stderr)
            for c in n.get('c', []):
                leaves(c, d + 1)
        leaves(tree)
        print(json.dumps(result, indent=2))
        sys.exit(1)
    return result


def run_cli(cfg):
    """Standard CLI shared by every per-city extractor."""
    ap = argparse.ArgumentParser(
        description='%s ACFR General Fund extractor' % cfg.city)
    ap.add_argument('pdf_path', help='Path to a City of %s ACFR PDF' % cfg.city)
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                    help='operating = GF expenditure-by-function tree; '
                         'revenue = GF revenue-by-source tree')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode, cfg), indent=2))
