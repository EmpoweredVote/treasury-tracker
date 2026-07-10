#!/usr/bin/env python3
"""
Tucson ACFR — General Fund extractor (GAAP actuals).

Builds the General Fund trees from a City of Tucson Annual Comprehensive
Financial Report's governmental-funds *Statement of Revenues, Expenditures and
Changes in Fund Balances*:

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree
                    (Current -> functions; Capital outlay; Capital projects;
                     Debt service -> components)

Extraction uses `pdftotext -table` (poppler) — the same tool the state-ACFR
loaders use. `-layout` scrambles the multi-fund columns and is never used. The
General Fund is always the FIRST data column and is fully present on the
statement's title page (older ACFRs column-split the remaining funds onto a
'(Continued)' page, which is not needed).

Column isolation is positional: the 6 fund columns' right-edges are anchored
from the fully-populated `Total revenues` / `Total expenditures` rows, and every
number on every row is assigned to the nearest column. GF = column 0. This
correctly resolves blank GF cells (e.g. GF `Developer fees` is blank -> 0, not
the Non-Major column's number).

Correctness oracle: the emitted `tie_delta` (computed_total - printed_total) MUST
be 0. A non-zero delta prints the offending rows to stderr and exits non-zero —
a mis-parse can never pass silently downstream.

Labels are read verbatim from each year's statement (normalized for whitespace).
Tucson reorganized function/source names across FYs (e.g. FY2024 "Public safety
and justice services" vs FY2020 "Public Safety and Justice Services"; FY2015
"Non-Departmental" vs later "General government"; FY2015 debt service adds "Debt
Issuance Costs"). The tree reflects the actual printed labels each year — it does
NOT hardcode a single era's vocabulary.

Usage:
  py -3 scripts/extractTucson.py "docs/Tucson/cot-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractTucson.py "docs/Tucson/cot-2024-acfr.pdf" --mode operating
"""

import sys
import re
import json
import subprocess
import argparse

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
# Title may wrap across lines ("...and Changes" / "in Fund Balances"): allow \s+.
_TITLE = re.compile(
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances',
    re.I)
# A self-tying combining/subfund/budgetary page must NOT be mistaken for the
# primary statement (finding #4 in 128-RECON.md).
_EXCLUDE = ('Combining', 'Reconciliation', 'Budgetary', 'Budget and Actual',
            'Proprietary', 'Fiduciary', 'Net Position')

def table_pages(pdf_path):
    out = subprocess.run(
        ['pdftotext', '-table', pdf_path, '-'],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    if out.returncode != 0:
        print(f'  pdftotext failed ({out.returncode}): {out.stderr.strip()}', file=sys.stderr)
        sys.exit(2)
    return out.stdout.split('\f')

def find_statement_page(pages):
    """Return (page_index, page_text) for the primary governmental-funds
    Statement of Revenues, Expenditures and Changes in Fund Balances — the
    earliest qualifying page (basic statements precede supplementary schedules).
    Returns (None, None) if not found."""
    cands = []
    for i, pg in enumerate(pages):
        if not _TITLE.search(pg):
            continue
        if 'Total revenues' not in pg or 'Total expenditures' not in pg:
            continue
        if 'General' not in pg or 'Fund' not in pg:
            continue
        if any(x in pg for x in _EXCLUDE):
            continue
        cands.append((i, pg))
    if not cands:
        return None, None
    cands.sort()               # earliest page = primary statement
    return cands[0]

def parse_fy(pages, pdf_path):
    """Fiscal year = 'Year Ended June 30, YYYY' on the statement page, else the
    4-digit year in the filename."""
    for pg in pages:
        m = re.search(r'Year Ended June 30,\s*(\d{4})', pg)
        if m:
            return int(m.group(1))
    m = re.search(r'(20\d{2})', pdf_path)
    return int(m.group(1)) if m else None

# ── GF column reader ─────────────────────────────────────────────────────────
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
    """Flat GF revenue-by-source tree. Buffers label-only lines so a wrapped
    label rejoins its number."""
    children = []
    pending = ''
    for l in _section(lines, r'^Revenues\b', r'^Total\s+revenues\b'):
        if not l.strip():
            continue
        gv = gf_value(l, col_anchors)
        lbl = label_of(l)
        if gv is None:
            # label-only line (wrapped) or a row with a blank GF cell.
            if lbl and not nums_with_pos(l):
                pending = (pending + ' ' + lbl).strip()
            continue
        full = norm_label((pending + ' ' + lbl).strip()) if pending else lbl
        pending = ''
        if full:
            children.append({'n': full, 'a': gv})
    total = sum(c['a'] for c in children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': children}, total, printed

def build_operating(lines, col_anchors, printed):
    """2-level GF expenditure-by-function tree. Parents (Current, Debt service)
    are label-only headers whose value = sum of children (Tucson prints no
    intermediate sub-totals — finding #3 in 128-RECON.md). Capital outlay and
    Capital projects are root-level leaves."""
    root_children = []
    parent = None          # current parent node (dict) or None for root leaves
    pending = ''
    for l in _section(lines, r'^Expenditures\b', r'^Total\s+expenditures\b'):
        st = l.strip()
        if not st:
            continue
        lbl = label_of(l)
        low = lbl.lower()
        has_num = bool(nums_with_pos(l))
        # Parent headers: "Current:" / "Current -" / "Debt service:" / "Debt service -"
        if not has_num and low in ('current', 'debt service'):
            parent = {'n': lbl or st.rstrip(':-').strip(), 'a': 0, 'c': []}
            root_children.append(parent)
            pending = ''
            continue
        gv = gf_value(l, col_anchors)
        if gv is None:
            if lbl and not has_num:
                pending = (pending + ' ' + lbl).strip()   # wrapped label
            continue
        full = norm_label((pending + ' ' + lbl).strip()) if pending else lbl
        pending = ''
        if not full:
            continue
        node = {'n': full, 'a': gv}
        # Capital outlay / Capital projects are root leaves, not Current children.
        if full.lower().startswith('capital '):
            root_children.append(node)
            parent = None
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)
    # roll parent values up from children
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
    # anchor from whichever total row exposes the most columns
    col_anchors = max(anchors(rev_line), anchors(exp_line), key=len)
    if len(col_anchors) < 2:
        print('  ERROR: could not anchor fund columns', file=sys.stderr)
        sys.exit(3)

    if mode == 'revenue':
        tree, computed, _ = build_revenue(lines, col_anchors, gf_value(rev_line, col_anchors))
        printed = gf_value(rev_line, col_anchors)
    else:
        tree, computed, _ = build_operating(lines, col_anchors, gf_value(exp_line, col_anchors))
        printed = gf_value(exp_line, col_anchors)

    tie_delta = computed - (printed or 0)
    result = {
        'fiscal_year': fy,
        'mode': mode,
        'statement_page': pi + 1,
        'tree': tree,
        'computed_total': computed,
        'printed_total': printed,
        'tie_delta': tie_delta,
    }
    if tie_delta != 0:
        print(f'  TIE FAILURE ({mode} FY{fy}): computed {computed} vs printed {printed} '
              f'(delta {tie_delta})', file=sys.stderr)
        # dump leaves for diagnosis
        def leaves(n, d=0):
            print(f'    {"  "*d}{n["n"]}: {n["a"]}', file=sys.stderr)
            for c in n.get('c', []):
                leaves(c, d + 1)
        leaves(tree)
        print(json.dumps(result, indent=2))
        sys.exit(1)
    return result


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Tucson ACFR General Fund extractor')
    ap.add_argument('pdf_path', help='Path to a Tucson ACFR PDF')
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                    help='operating = GF expenditure-by-function tree; '
                         'revenue = GF revenue-by-source tree')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode), indent=2))
