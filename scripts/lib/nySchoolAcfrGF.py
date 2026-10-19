"""Read the General Fund column of a NY school district's governmental-funds
statement, out of the district's own AUDITED ACFR.

This is the independent oracle of
`docs/superpowers/specs/2026-10-11-ny-school-districts-design.md` §11.1. It does
NOT build a loadable tree -- it answers one question per district-year: does the
figure TT publishes from OSC's AFR agree with the district's audited statement?

⭐ THE RECONCILIATION RULE, measured on Rochester FY2016-FY2025:

    OSC revenue      ==  ACFR `Total revenues`     + other financing SOURCES
    OSC expenditure  ==  ACFR `Total expenditures` + other financing USES

OSC's AFR folds other financing sources and uses INTO revenue and expenditure;
the ACFR reports them below the line. Rochester FY2021 shows it exactly:
736,920,574 + (1,814,378 premium + 3,890,822 transfers in) = 742,625,774, which
is TT's figure to the dollar, and 602,986,637 + 86,316,186 transfers out =
689,302,823, likewise.

⚠⚠ WHY GLYPH COORDINATES, NOT TEXT. §11.1 says `pdftotext -layout` scrambled
Albany and Olean. Three further failure modes were MEASURED here, each of which
silently returns a wrong number rather than failing:

1. THE TEXT LAYER SPLITS NUMERALS, and both ways: "7"+"36,920,574"
   (digit-leading) and "1"+",814,378" (COMMA-leading). A pattern requiring a
   leading digit keeps only the "1" and reports other financing sources of 4
   where the truth is 5,705,200. Measured on Rochester FY2021 p52, fragments of
   ONE number TOUCH (gap 0.00) while adjacent columns sit 36.56pt apart, so
   "re-join while the gap is <= 1pt" is a measured rule, not a guessed one.
   A regex over the flattened line fuses two funds into one 17-digit number.

2. ⚠⚠ A BLANK GENERAL FUND CELL PROMOTES THE NEXT FUND'S MONEY. Rochester
   FY2025 prints no General Fund transfers-in, so the only figure on that row is
   SPECIAL AID's 7,120,721. Taking "the first number on the row" read that as
   the district's own and overstated OSC's expected revenue by exactly it. The
   General Fund is therefore chosen by COLUMN POSITION, anchored on a TOTAL row
   (always populated in every column); a row with no run at that x has a BLANK
   General Fund cell and contributes nothing.

3. ⚠⚠ A STATEMENT CONTINUES TWO DIFFERENT WAYS, and only one still holds the
   General Fund:
     Buffalo FY2019 p26 -- same COLUMNS, more ROWS. The entire Other Financing
       block lives there. Missing it lost that fund's 411,262 interfund
       transfers in and made a $2 reconciliation look like a $411,260 one.
     Rochester FY2021 p53 -- same ROWS, more COLUMNS. Its first money column is
       SCHOOL FOOD SERVICE. Reading it as the General Fund substitutes another
       fund's money outright.
   The distinguisher is whether the continuation re-prints a `General` column
   header. Each page is anchored SEPARATELY, because the columns shift.

⚠ WHAT THIS CANNOT CHECK. When an ACFR presents transfers NET -- Buffalo does
from FY2020 ("Operating transfers, net") -- the gross inflow is not in the
document, so OSC's figure cannot be reconstructed from the statement at all.
That is a limit of the ACFR's presentation, NOT evidence against OSC. Such a
year must be reported as NOT RECONCILABLE, never as a mismatch.

⚠ pdfplumber is imported lazily inside `read()` so every pure function here
stays stdlib-only and the selftests run anywhere.
"""
import re

EXCLUDE = ('combining', 'budgetary', 'budget and actual', 'non-gaap',
           'proprietary', 'fiduciary', 'net position', 'last ten', 'custodial')
TITLE_MUST = ('statement of revenues', 'governmental funds')
FRAG = re.compile(r'^\(?\$?[\d,][\d,]*\)?$|^-$|^\$$|^\)$|^\($')

MERGE_GAP = 1.0   # measured: fragments of one number touch (gap 0.00)
COL_TOL = 8.0     # measured: adjacent columns are ~36pt apart

# Rows whose General Fund cell is ALWAYS printed, so the column can be anchored
# on them even when ordinary rows leave it blank.
TOTAL_ROW = ('total revenues', 'total expenditures', 'total other financing', 'excess')


def is_frag(text):
    """Is this word part of a money figure?"""
    return bool(FRAG.match(text))


def runs_of(words):
    """[(value, x1)] per money figure on one row, split fragments re-joined.

    `words` are dicts with 'text', 'x0', 'x1' -- pdfplumber's shape.
    """
    frags = sorted([w for w in words if is_frag(w['text']) and w['text'] != '$'],
                   key=lambda w: w['x0'])
    groups, cur = [], []
    for w in frags:
        if cur and w['x0'] - cur[-1]['x1'] > MERGE_GAP:
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)

    out = []
    for g in groups:
        s = ''.join(w['text'] for w in g)
        x1 = g[-1]['x1']
        if s in ('-', ')', '('):
            out.append((0.0, x1))      # a printed dash is a real zero
            continue
        neg = '(' in s or ')' in s
        t = s.replace('(', '').replace(')', '').replace(',', '').replace('$', '')
        if not t or not t.isdigit():
            continue
        out.append((-float(t) if neg else float(t), x1))
    return out


def label_of(words):
    """The row's text label, money fragments removed."""
    return ' '.join(w['text'] for w in words if not is_frag(w['text'])).strip().lower()


def rows_from_words(words, tol=2.5):
    """[(label, runs)] for a page, grouped into printed rows by baseline."""
    buckets = {}
    for w in words:
        key = next((k for k in buckets if abs(k - w['top']) <= tol), w['top'])
        buckets.setdefault(key, []).append(w)
    rows = []
    for _, ws in sorted(buckets.items()):
        ws = sorted(ws, key=lambda w: w['x0'])
        rows.append((label_of(ws), runs_of(ws)))
    return rows


def anchor_of(rows):
    """The General Fund column's right edge, read off a TOTAL row.

    ⚠ Never off an arbitrary row: an ordinary row may leave the General Fund
    blank, in which case its leftmost figure belongs to another fund.
    """
    for label, runs in rows:
        if runs and any(label.startswith(t) for t in TOTAL_ROW):
            return runs[0][1]
    return None


def gf_value(runs, anchor):
    """The General Fund figure on a row, or None when that cell is BLANK."""
    hits = [v for v, x1 in runs if abs(x1 - anchor) <= COL_TOL]
    return hits[0] if hits else None


def is_statement_page(text):
    """Is this the governmental-funds statement, and not a look-alike?"""
    low = text.lower()
    head = low[:600]
    if not all(m in head for m in TITLE_MUST):
        return False
    if any(x in head for x in EXCLUDE):
        return False
    return 'total revenues' in low


def continues_general_fund(text):
    """Does this continuation page still carry the General Fund column?

    ⚠ Rochester's continuation carries OTHER funds (School Food Service first),
    so 'it says continued' is NOT sufficient -- it must re-print `General`.

    ⚠ On the measured corpus Rochester's p53 says NEITHER word, so it is the
    `continued` test that actually refuses it there. The `General` test is
    defence in depth for a column-continuation that DOES announce itself; the
    selftest exercises that case directly, because without such a case the
    guard can be deleted with every test still green.
    """
    low = text.lower()
    if 'continued' not in low[:500]:
        return False
    return bool(re.search(r'\bgeneral\b', low[:900]))


def harvest(blocks):
    """Fold [(pageno, rows)] into the General Fund's totals.

    Each block is anchored on its OWN total row, because columns shift between
    pages of one statement.
    """
    res = {'pages': [p for p, _ in blocks]}
    sources = uses = 0.0
    seen_total = False
    for idx, (_, rows) in enumerate(blocks):
        anchor = anchor_of(rows)
        if anchor is None:
            continue
        if idx == 0:
            res['gf_col_x1'] = round(anchor, 2)
        in_ofs = False
        for label, runs in rows:
            v = gf_value(runs, anchor)
            if label.startswith('total revenues') and v is not None:
                res.setdefault('revenues', v)
            elif label.startswith('total expenditures') and v is not None:
                res.setdefault('expenditures', v)
            elif label.startswith('other financing'):
                in_ofs = True
            elif in_ofs and label.startswith('total other financing'):
                if v is not None:
                    res['ofs_net_printed'] = v
                    seen_total = True
                in_ofs = False
            elif in_ofs and label.startswith('net change in fund'):
                in_ofs = False
            elif in_ofs and v:
                if v > 0:
                    sources += v
                else:
                    uses += v
            # ⚠ A NETTED presentation names itself; record it so the caller can
            # refuse the year rather than report a false mismatch.
            if in_ofs and 'transfers, net' in label:
                res['transfers_netted'] = True
    res['ofs_sources'], res['ofs_uses'] = sources, uses
    if seen_total:
        # The components must rebuild the PRINTED net, or the read is wrong.
        res['ofs_check'] = round(sources + uses - res['ofs_net_printed'], 2)
    return res


def read(path):
    """Read one ACFR. Returns the General Fund totals, or an `error`."""
    import pdfplumber     # lazy: keeps the pure functions stdlib-only

    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ''
            if not is_statement_page(text):
                continue
            blocks = [(i + 1, rows_from_words(page.extract_words()))]
            for j in range(i + 1, min(i + 3, len(pdf.pages))):
                nxt = pdf.pages[j]
                if not continues_general_fund(nxt.extract_text() or ''):
                    break
                blocks.append((j + 1, rows_from_words(nxt.extract_words())))
            res = harvest(blocks)
            res['title'] = ' / '.join(l.strip() for l in text.splitlines()[:4] if l.strip())
            if 'revenues' not in res or 'expenditures' not in res:
                res['error'] = 'statement found but totals not readable'
            return res
    return {'error': 'no governmental-funds statement page found'}


if __name__ == '__main__':
    # ⚠ JSON on stdout ONLY — scripts/reconcileNyOscSchoolsFac.mjs parses this.
    # pdfplumber writes font warnings to stderr for several of these documents;
    # they must not reach stdout or the caller's JSON.parse fails.
    import sys as _sys
    import json as _json
    print(_json.dumps(read(_sys.argv[1])))
