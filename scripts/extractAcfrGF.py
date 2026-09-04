#!/usr/bin/env python3
"""
Generalized ACFR General-Fund extractor (GAAP actuals) — Pima-municipality edition.

City-agnostic sibling of `extractTucson.py`. Builds the General Fund trees from any
municipal Annual Comprehensive Financial Report's governmental-funds *Statement of
Revenues, Expenditures and Changes in Fund Balances*:

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree
                    (section headers -> functions; standalone leaves e.g. Capital
                     outlay; Debt service -> components)

WHY A SEPARATE SCRIPT: `extractTucson.py` is the shipped, verified loader for the
City of Tucson (processTucson.js depends on it) — it stays untouched. This module
reuses its column engine but DERIVES the 2-level expenditure structure from each
statement's own section headers (label-only rows ending in ':') instead of a
hardcoded Tucson function list, so smaller towns with different/simpler function
sets extract correctly. Regression oracle: this extractor must still tie Tucson
FY2024 at $0 in both modes.

Extraction uses `pdftotext -table` (poppler) — never `-layout` (it scrambles the
multi-fund columns). The General Fund is always the FIRST data column. Column
isolation is positional: the fund columns' right-edges are anchored from the
fully-populated `Total revenues` / `Total expenditures` rows, and every number is
assigned to the nearest column. GF = column 0. Blank GF cells resolve to 0 (the
row's first number belongs to a later fund column).

Correctness oracle: the emitted `tie_delta` (computed_total - printed_total) MUST
be 0. A non-zero delta prints the offending rows to stderr and exits non-zero — a
mis-parse can never pass silently downstream.

Usage:
  python scripts/extractAcfrGF.py "docs/OroValley/OroValley-FY2024.pdf" --mode revenue
  python scripts/extractAcfrGF.py "docs/Marana/Marana-FY2024.pdf" --mode operating
"""

import sys
import re
import json
import subprocess
import argparse
from pathlib import Path

# ── Money parsing ─────────────────────────────────────────────────────────────
_MONEY = re.compile(r'\((?:\d[\d,]*)\)|\$?\s*\d[\d,]*')

def parse_money(tok):
    """'$  405,003,757' -> 405003757 ; '(1,234)' -> -1234 ; '' / '-' -> None."""
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

# ── Statement page location ─────────────────────────────────────────────────
_TITLE = re.compile(
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances',
    re.I)
# A self-tying combining/subfund/budgetary page must NOT be mistaken for the
# primary governmental-funds statement.
_EXCLUDE = ('Combining', 'Budgetary', 'Budget and Actual', 'Budget to Actual',
            'Proprietary', 'Fiduciary', 'Net Position', 'Cash Flows')

def table_pages(pdf_path):
    out = subprocess.run(
        ['pdftotext', '-table', pdf_path, '-'],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    if out.returncode != 0:
        print(f'  pdftotext failed ({out.returncode}): {out.stderr.strip()}', file=sys.stderr)
        sys.exit(2)
    return out.stdout.split('\f')


# ⚠⚠ An index into `table_pages` is NOT a page number — `pdftotext` emits
# spurious EMPTY chunks for some pages, so the index runs AHEAD of the physical
# page. Hilton Head FY2019 reported page 58 for a statement physically on 48.
# The resolver is shared with `lib/acfrGF.py` rather than copied, because this
# defect existed in both files independently and a second copy is how it would
# come back. See the long note there.
#
# ⚠ MEASURED ON THIS SCRIPT'S OWN CORPUS: all 23 Pima-municipality documents
# render exactly one chunk per page, so this correction is INERT for every
# document processPimaCities.js loads today. Applied anyway — the next document
# is the one that trips it, and an inert correctness fix costs nothing.
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from acfrGF import physical_page_for  # noqa: E402

def find_statement_page(pages):
    """Return (page_index, page_text) for the primary governmental-funds
    Statement of Revenues, Expenditures and Changes in Fund Balances — the
    earliest qualifying page (basic statements precede supplementary schedules).
    Returns (None, None) if not found."""
    cands = []
    for i, pg in enumerate(pages):
        low = pg.lower()
        if not _TITLE.search(pg):
            continue
        if 'total revenues' not in low or 'total expenditures' not in low:
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in pg for x in _EXCLUDE):
            continue
        cands.append((i, pg))
    if not cands:
        return None, None
    cands.sort()               # earliest page = primary statement
    return cands[0]

def parse_fy(pages, pdf_path):
    """Fiscal year = '(Fiscal) Year Ended June 30, YYYY' on the statement page
    (case-insensitive), else the 4-digit year in the filename."""
    for pg in pages:
        m = re.search(r'Year\s+Ended\s+June\s+30,\s*(\d{4})', pg, re.I)
        if m:
            return int(m.group(1))
    m = re.search(r'(20\d{2})', pdf_path)
    return int(m.group(1)) if m else None

# ── GF column reader (verbatim from extractTucson.py — already city-agnostic) ──
def anchors(line):
    return [p for _, p in nums_with_pos(line)]

def gf_value(line, col_anchors):
    """GF value on this line = the number nearest column 0, but only if that
    number is actually closest to anchor[0] (a blank GF cell means the row's
    first number belongs to a later column -> GF is 0)."""
    best, best_d = None, None
    for v, p in nums_with_pos(line):
        col = min(range(len(col_anchors)), key=lambda k: abs(p - col_anchors[k]))
        if col == 0:
            d = abs(p - col_anchors[0])
            if best_d is None or d < best_d:
                best, best_d = v, d
    return best  # None if GF cell blank

def norm_label(raw):
    return re.sub(r'\s+', ' ', raw).strip().rstrip(':-').strip()

def label_of(line):
    """The row label = text before the first money token (whitespace-normalized)."""
    m = _MONEY.search(line)
    raw = line[:m.start()] if m else line
    return norm_label(raw)

_DASH_CELL = re.compile(r'(?:\s|^)[-–—](?=\s|$)')

def has_blank_cells(line):
    """True if the row carries dash placeholder cells (a real data row whose GF
    column is blank/$0), as opposed to a pure label continuation. Prevents a
    $0-GF line item's label from bleeding into the next valued row's label."""
    return bool(_DASH_CELL.search(line))

def is_subtotal(label):
    """Intermediate 'Total current' / 'Total debt service' subtotal rows must be
    excluded from leaves (they double-count). The section-ending 'Total revenues'
    / 'Total expenditures' rows are handled by _section's end pattern."""
    return label.strip().lower().startswith('total ')

def is_section_header(raw_stripped, has_num):
    """A section header (expenditure parent) is a label-only row whose raw text
    ends with ':' (e.g. 'Current:', 'Debt service:'), OR the bare known words.
    Wrapped-label continuations are label-only WITHOUT a trailing colon."""
    if has_num:
        return False
    low = raw_stripped.rstrip().lower()
    if low.endswith(':'):
        return True
    return low.rstrip(':-').strip() in ('current', 'debt service')

# ── Tree builders ────────────────────────────────────────────────────────────
def _section(lines, start_pat, end_pat):
    """Yield raw lines strictly between the start and end header lines."""
    on = False
    for l in lines:
        st = l.strip()
        if not on and re.match(start_pat, st, re.I):
            on = True
            continue
        if on and re.match(end_pat, st, re.I):
            return
        if on:
            yield l

def build_revenue(lines, col_anchors, printed):
    """Flat GF revenue-by-source tree. A row's leaf is the label of the line
    that carries the GF value; a line with no GF value is a $0-GF line item and
    is skipped (NOT buffered into the next row's label — these municipalities'
    statements have no genuine multi-line-wrapped labels, and buffering caused
    cross-row label bleed, e.g. OV 'Development impact fees Special assessments
    Intergovernmental'). Intermediate subtotal rows are skipped."""
    children = []
    for l in _section(lines, r'^Revenues\b', r'^Total\s+revenues\b'):
        if not l.strip():
            continue
        gv = gf_value(l, col_anchors)
        if gv is None:
            continue
        full = label_of(l)
        if full and not is_subtotal(full):
            children.append({'n': full, 'a': gv})
    total = sum(c['a'] for c in children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': children}, total, printed

def build_operating(lines, col_anchors, printed):
    """2-level GF expenditure-by-function tree. Section headers (label-only rows
    ending in ':', e.g. 'Current:' / 'Debt service:') become parents whose value
    = sum of children. Standalone leaves (e.g. 'Capital outlay') sit at root.
    Intermediate 'Total <section>' subtotals are skipped. Structure is DERIVED
    from the statement, not a hardcoded function list."""
    root_children = []
    parent = None          # current parent node (dict) or None for root leaves
    for l in _section(lines, r'^Expenditures\b', r'^Total\s+expenditures\b'):
        st = l.strip()
        if not st:
            continue
        has_num = bool(nums_with_pos(l))
        lbl = label_of(l)
        # Section header -> new parent
        if is_section_header(st, has_num):
            parent = {'n': lbl or st.rstrip(':-').strip(), 'a': 0, 'c': []}
            root_children.append(parent)
            continue
        gv = gf_value(l, col_anchors)
        if gv is None:
            continue   # $0-GF line item (or a blank row) — skip, never buffer
        full = label_of(l)
        if not full or is_subtotal(full):
            continue
        node = {'n': full, 'a': gv}
        # 'Capital outlay' / 'Capital projects' are root leaves, not section children.
        if full.lower().startswith('capital '):
            root_children.append(node)
            parent = None
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)
    # drop any empty parents (a ':' header with no GF children), roll values up
    root_children = [n for n in root_children if not ('c' in n and not n['c'])]
    for n in root_children:
        if 'c' in n:
            n['a'] = sum(ch['a'] for ch in n['c'])
    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Expenditure by Function', 'a': total, 'c': root_children}, total, printed

# ── Orchestration ────────────────────────────────────────────────────────────
def extract(pdf_path, mode):
    pages = table_pages(pdf_path)
    pi, pg = find_statement_page(pages)
    if pg is None:
        print(f'  ERROR: primary GF statement not found in {pdf_path}', file=sys.stderr)
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
        printed = gf_value(rev_line, col_anchors)
        tree, computed, _ = build_revenue(lines, col_anchors, printed)
    else:
        printed = gf_value(exp_line, col_anchors)
        tree, computed, _ = build_operating(lines, col_anchors, printed)

    tie_delta = computed - (printed or 0)
    result = {
        'fiscal_year': fy,
        'mode': mode,
        'statement_page': (physical_page_for(pdf_path, pages, pi) or pi + 1),
        'statement_page_index': pi + 1,
        'tree': tree,
        'computed_total': computed,
        'printed_total': printed,
        'tie_delta': tie_delta,
    }
    if tie_delta != 0:
        print(f'  TIE FAILURE ({mode} FY{fy}): computed {computed} vs printed {printed} '
              f'(delta {tie_delta})', file=sys.stderr)
        def leaves(n, d=0):
            print(f'    {"  "*d}{n["n"]}: {n["a"]}', file=sys.stderr)
            for c in n.get('c', []):
                leaves(c, d + 1)
        leaves(tree)
        print(json.dumps(result, indent=2))
        sys.exit(1)
    return result


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Generalized ACFR General Fund extractor')
    ap.add_argument('pdf_path', help='Path to a municipal ACFR PDF')
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                    help='operating = GF expenditure-by-function tree; '
                         'revenue = GF revenue-by-source tree')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode), indent=2))
