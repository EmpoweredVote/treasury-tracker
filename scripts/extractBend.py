#!/usr/bin/env python3
"""
Bend, OR ACFR — General Fund extractor (GAAP actuals).

Builds the General Fund trees from a City of Bend Annual Comprehensive
Financial Report's governmental-funds *Statement of Revenues, Expenditures and
Changes in Fund Balances (Deficits)*:

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree
                    (Current -> functions; Debt service -> components;
                     Capital outlay as a root-level leaf)

Modelled on scripts/extractTucson.py (Phase 128) and sharing its contract:
`pdftotext -table` only (`-layout` scrambles the multi-fund columns), positional
column isolation anchored on the fully-populated `Total revenues` /
`Total expenditures` rows, GF = column 0, and a `tie_delta` that MUST be 0.

WHY THIS IS NOT extractTucson.py — the dash-zero row
----------------------------------------------------
Bend prints an em-dash placeholder for a $0 fund cell:

    Assessments                    -            -           -           -
    Licenses and permits        83,460          -           -           -

`-` is not a money token, so the Tucson extractor sees `Assessments` as a line
with no numbers and buffers it as a *wrapped label*, which then glues onto the
next real row: `"Assessments - - - Licenses and permits"`. The AMOUNTS stay
correct, so `tie_delta` is still 0 — the corruption is silent and label-only.
This extractor distinguishes the two cases explicitly:

  * label + only dash placeholders   -> a real data row whose GF cell is $0
  * label + nothing at all           -> a wrapped label, buffer it

$0 rows are dropped from the emitted tree (they carry no signal and would render
as empty icicle segments) but every one is reported in `zero_rows` so the drop is
auditable rather than invisible.

Bend's General Fund is a COMBINED fund
--------------------------------------
The statement's column is headed `General Fund*`. Bend's GF combines subfunds
(the ACFR carries a "Combining Balance Sheet - General Fund" and a "General Fund
Revenue Stabilization Fund"). This is why the GF figures here do NOT match the
`Schedule of Expenditures and Other Uses by Appropriation Levels`, which is the
narrower legal-appropriation scope. This extractor deliberately reads the GAAP
primary statement — the same basis as every other TT city — and never the
budgetary schedule, which is biennium-budget basis and cannot be split per FY.

Usage:
  py -3 scripts/extractBend.py "docs/Bend/bend-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractBend.py "docs/Bend/bend-2025-acfr.pdf" --mode operating
"""

import sys
import re
import json
import subprocess
import argparse

# ── Money parsing ─────────────────────────────────────────────────────────────
_MONEY = re.compile(r'\((?:\d[\d,]*)\)|\$?\s*\d[\d,]*')

def parse_money(tok):
    """'$  53,713,119' -> 53713119 ; '(32,005,256)' -> -32005256 ; '' / '-' -> None."""
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

# ── Dash-zero detection (the Bend-specific bit) ──────────────────────────────
# A row like "Assessments      -      -      -      -" is DATA (GF = 0), not a
# wrapped label. Require a non-empty label followed only by dash placeholders.
_DASH_ROW = re.compile(r'^(?P<label>.*?[^\s\-–—])(?P<dashes>(?:\s+[-–—])+)\s*$')

def dash_zero_label(line):
    """Return the label if `line` is a label followed only by dash placeholders,
    else None. Only meaningful for lines carrying no money tokens."""
    m = _DASH_ROW.match(line.rstrip())
    if not m:
        return None
    label = m.group('label').strip()
    # Guard against a label that merely ends in a hyphen ("Non-").
    if not label or not m.group('dashes').strip():
        return None
    return norm_label(label)

# ── Statement page location ─────────────────────────────────────────────────
_TITLE = re.compile(
    r'Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances',
    re.I)
# A combining/subfund/budgetary page must never be mistaken for the primary
# statement (Bend has all three, and the budgetary one is biennium basis).
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
    """(page_index, page_text) for the primary governmental-funds statement —
    the earliest qualifying page (basic statements precede supplementary
    schedules). (None, None) if not found."""
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
    cands.sort()
    return cands[0]

def parse_fy(pages, pdf_path):
    """Fiscal year from 'fiscal year ended June 30, YYYY' on the statement page,
    else the 4-digit year in the filename."""
    for pg in pages:
        m = re.search(r'(?:fiscal\s+)?[Yy]ear\s+[Ee]nded\s+June\s+30,\s*(\d{4})', pg)
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
    belongs to a later column -> GF is absent, not that number)."""
    best, best_d = None, None
    for v, p in nums_with_pos(line):
        col = min(range(len(col_anchors)), key=lambda k: abs(p - col_anchors[k]))
        if col == 0:
            d = abs(p - col_anchors[0])
            if best_d is None or d < best_d:
                best, best_d = v, d
    return best

def norm_label(raw):
    # Bend's -table output sometimes injects run-on spaces inside a label
    # ("Community and economic       development").
    s = re.sub(r'\s+', ' ', raw).strip()
    # Drop trailing dash placeholders belonging to empty columns to the LEFT of
    # the first money token ("System development charges - -" -> "System
    # development charges"). Only trailing runs are removed, so a hyphenated
    # word ("Non-departmental") is untouched.
    s = re.sub(r'(?:\s+[-–—])+$', '', s)
    return s.strip().rstrip(':').strip()

def label_of(line):
    """Row label = text before the first money token."""
    m = _MONEY.search(line)
    raw = line[:m.start()] if m else line
    return norm_label(raw)

# ── Row classification ───────────────────────────────────────────────────────
def classify(line, col_anchors):
    """(kind, label, value) where kind is one of:
         'data'    -> a value row (value may be 0 for a dash-zero GF cell)
         'wrapped' -> a label-only continuation line
         'skip'    -> blank / unusable
       A row whose GF cell is blank but which HAS numbers in other columns is
       'data' with value 0 — the source genuinely reports $0 for the GF."""
    if not line.strip():
        return 'skip', '', None

    has_nums = bool(nums_with_pos(line))

    if not has_nums:
        dz = dash_zero_label(line)
        if dz is not None:
            return 'data', dz, 0          # all-dash row: every fund is $0
        lbl = label_of(line)
        return ('wrapped', lbl, None) if lbl else ('skip', '', None)

    gv = gf_value(line, col_anchors)
    lbl = label_of(line)
    if gv is None:
        # Numbers exist but none belong to the GF column -> GF cell is a dash.
        return ('data', lbl, 0) if lbl else ('skip', '', None)
    return 'data', lbl, gv

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

# ── Tree builders ────────────────────────────────────────────────────────────
def build_revenue(lines, col_anchors):
    """Flat GF revenue-by-source tree. $0 sources are recorded and dropped."""
    children, zero_rows = [], []
    pending = ''
    for l in _section(lines, r'^Revenues\b', r'^Total\s+revenues\b'):
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
    """2-level GF expenditure-by-function tree. 'Current' and 'Debt service' are
    label-only parents whose value is the sum of their children; 'Capital outlay'
    is a root-level leaf. $0 rows are recorded and dropped."""
    root_children, zero_rows = [], []
    parent = None
    pending = ''
    for l in _section(lines, r'^Expenditures\b', r'^Total\s+expenditures\b'):
        st = l.strip()
        if not st:
            continue
        kind, lbl, val = classify(l, col_anchors)
        low = (lbl or '').lower()

        # Parent headers arrive as label-only lines with no dashes.
        if kind == 'wrapped' and low in ('current', 'debt service'):
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
            root_children.append(node)     # root-level leaf, closes the parent
            parent = None
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    # Roll parent values up, then drop parents left empty by all-$0 children.
    for n in root_children:
        if 'c' in n:
            n['a'] = sum(ch['a'] for ch in n['c'])
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
    ap = argparse.ArgumentParser(description='Bend, OR ACFR General Fund extractor')
    ap.add_argument('pdf_path', help='Path to a City of Bend ACFR PDF')
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating',
                    help='operating = GF expenditure-by-function tree; '
                         'revenue = GF revenue-by-source tree')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode), indent=2))
