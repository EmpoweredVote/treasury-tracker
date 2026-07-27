#!/usr/bin/env python3
"""
Tualatin, OR ACFR — General Fund extractor (GAAP actuals).

Builds the General Fund trees from a City of Tualatin Annual Comprehensive
Financial Report's governmental-funds *Statement of Revenues, Expenditures and
Changes in Fund Balances*:

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree
                    (Current -> functions; Debt service -> components;
                     Capital outlay as a root-level leaf)

Same contract as scripts/extractBend.py / extractSherwood.py / extractTucson.py:
`pdftotext -table` only, positional column isolation anchored on the
fully-populated total rows, GF = column 0, and a `tie_delta` that MUST be 0.

WHY THIS IS NOT extractSherwood.py
----------------------------------
Tualatin shares Sherwood's uppercase section headers ("TOTAL REVENUES") and its
wrapped statement title, so it needs Sherwood's case-insensitive, whole-line
section detection — Bend's parser fails to find the statement at all.

But the two cities NEST CAPITAL OUTLAY DIFFERENTLY, and `pdftotext -table`
flattens indentation so the difference is invisible in the parsed text. Checked
against `pdftotext -layout`, which preserves leading whitespace:

    Tualatin                        Sherwood
      Current:            (2 sp)      Current:            (2 sp)
        General government (4 sp)        Administration    (5 sp)
      Capital outlay      (2 sp)  <--  Noncurrent          (2 sp)
      Debt service:       (2 sp)         Capital Outlay    (5 sp)  <--
        Principal         (4 sp)         Debt Service ...  (5 sp)

Tualatin's Capital outlay is a PEER of Current and Debt service (the GASB
convention); Sherwood files it as a CHILD of Noncurrent. Running Sherwood's
parser over Tualatin still ties at $0 — the amount is counted either way — but
it silently mis-nests Capital outlay under Current and inflates the Current
subtotal. A $0 tie proves arithmetic, never structure.

Tualatin's FY2025 statement has no dash-zero GF cells, but the handling is kept:
a `-` marks a $0 fund cell and such a row is DATA (GF = $0), not a wrapped label.
$0 rows are dropped from the tree but reported in `zero_rows`.

Usage:
  py -3 scripts/extractTualatin.py "docs/Tualatin/tualatin-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractTualatin.py "docs/Tualatin/tualatin-2025-acfr.pdf" --mode operating
"""

import sys
import re
import json
import subprocess
import argparse

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

# ── Dash-zero detection ──────────────────────────────────────────────────────
_DASH_ROW = re.compile(r'^(?P<label>.*?[^\s\-–—])(?P<dashes>(?:\s+[-–—])+)\s*$')

def dash_zero_label(line):
    """Label if `line` is a label followed only by dash placeholders, else None."""
    m = _DASH_ROW.match(line.rstrip())
    if not m:
        return None
    label = m.group('label').strip()
    if not label or not m.group('dashes').strip():
        return None
    return norm_label(label)

# ── Statement page location (all matching case-insensitive) ──────────────────
_TITLE = re.compile(
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances',
    re.I)
_EXCLUDE = ('combining', 'reconciliation', 'budgetary', 'budget and actual',
            'proprietary', 'fiduciary', 'net position')
_FY = re.compile(r'(?:for\s+the\s+)?(?:fiscal\s+)?year\s+ended\s+June\s+30,\s*(\d{4})', re.I)

def table_pages(pdf_path):
    out = subprocess.run(
        ['pdftotext', '-table', pdf_path, '-'],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    if out.returncode != 0:
        print(f'  pdftotext failed ({out.returncode}): {out.stderr.strip()}', file=sys.stderr)
        sys.exit(2)
    return out.stdout.split('\f')

def find_statement_page(pages):
    """(page_index, page_text) for the primary governmental-funds statement —
    earliest qualifying page. (None, None) if not found."""
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
    actually closest to anchor[0] (a blank GF cell means the row's first number
    belongs to a later column)."""
    best, best_d = None, None
    for v, p in nums_with_pos(line):
        col = min(range(len(col_anchors)), key=lambda k: abs(p - col_anchors[k]))
        if col == 0:
            d = abs(p - col_anchors[0])
            if best_d is None or d < best_d:
                best, best_d = v, d
    return best

def norm_label(raw):
    s = re.sub(r'\s+', ' ', raw).strip()
    # Drop trailing dash placeholders belonging to empty columns left of the
    # first money token. Only trailing runs, so "Debt Service - Principal" and
    # "Non-departmental" are untouched.
    s = re.sub(r'(?:\s+[-–—])+$', '', s)
    return s.strip().rstrip(':').strip()

def label_of(line):
    m = _MONEY.search(line)
    raw = line[:m.start()] if m else line
    return norm_label(raw)

# ── Row classification ───────────────────────────────────────────────────────
def classify(line, col_anchors):
    """('data'|'wrapped'|'skip', label, value). A row whose GF cell is blank but
    which has numbers in other columns is 'data' with value 0 — the source
    genuinely reports $0 for the General Fund."""
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

# Section headers must be the WHOLE line. Sherwood wraps its statement title
# across two lines, the second being "EXPENDITURES AND CHANGES IN FUND BALANCES"
# — a prefix match on "Expenditures" starts the section at the TITLE and
# swallows the entire revenue block into the expenditure tree.
_SEC_REVENUES     = r'^Revenues\s*:?\s*$'
_SEC_EXPENDITURES = r'^Expenditures\s*:?\s*$'
_END_REVENUES     = r'^Total\s+revenues\b'
_END_EXPENDITURES = r'^Total\s+expenditures\b'

def _section(lines, start_pat, end_pat):
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

# ── Tree builders ────────────────────────────────────────────────────────────
# Tualatin's expenditure groupings. Capital outlay is deliberately ABSENT --
# it is a root-level peer, handled below, not a parent header.
_PARENTS = ('current', 'debt service')

def build_revenue(lines, col_anchors):
    children, zero_rows = [], []
    pending = ''
    for l in _section(lines, _SEC_REVENUES, _END_REVENUES):
        kind, lbl, val = classify(l, col_anchors)
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            pending = norm_label(f'{pending} {lbl}')
            continue
        full = norm_label(f'{pending} {lbl}') if pending else lbl
        pending = ''
        if not full:
            continue
        if val == 0:
            zero_rows.append(full)
            continue
        children.append({'n': full, 'a': val})
    total = sum(c['a'] for c in children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': children}, total, zero_rows

def build_operating(lines, col_anchors):
    """2-level tree. Capital outlay is emitted as a ROOT-LEVEL leaf and closes
    the open parent -- it is a peer of Current and Debt service in Tualatin's
    statement (verified via `pdftotext -layout` indentation), not a child."""
    root_children, zero_rows = [], []
    parent = None
    pending = ''
    for l in _section(lines, _SEC_EXPENDITURES, _END_EXPENDITURES):
        if not l.strip():
            continue
        kind, lbl, val = classify(l, col_anchors)
        low = (lbl or '').lower()

        if kind == 'wrapped' and low in _PARENTS:
            parent = {'n': lbl, 'a': 0, 'c': []}
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            pending = norm_label(f'{pending} {lbl}')
            continue

        full = norm_label(f'{pending} {lbl}') if pending else lbl
        pending = ''
        if not full:
            continue
        if val == 0:
            zero_rows.append(full)
            continue

        node = {'n': full, 'a': val}
        if full.lower().startswith('capital '):
            root_children.append(node)   # root-level peer; closes the parent
            parent = None
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    for n in root_children:
        if 'c' in n:
            n['a'] = sum(ch['a'] for ch in n['c'])
    # Drop parents left childless by all-$0 children.
    root_children = [n for n in root_children if n.get('c') or 'c' not in n]

    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Expenditure by Function', 'a': total, 'c': root_children}, total, zero_rows

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
        tree, computed, zero_rows = build_revenue(lines, col_anchors)
        printed = gf_value(rev_line, col_anchors)
    else:
        tree, computed, zero_rows = build_operating(lines, col_anchors)
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
        'zero_rows': zero_rows,
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
    ap = argparse.ArgumentParser(description='Tualatin, OR ACFR General Fund extractor')
    ap.add_argument('pdf_path', help='Path to a City of Tualatin ACFR PDF')
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                    help='operating = GF expenditure-by-function tree; '
                         'revenue = GF revenue-by-source tree')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode), indent=2))
