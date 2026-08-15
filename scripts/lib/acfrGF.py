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

                 Deltas are in the SCALED (post-`units`) domain: tie_delta is
                 computed from column_value's already-multiplied output, so for a
                 units=1000 entity a genuine $1 printed-vs-component disagreement
                 must be registered here as 1000, not 1. The exact-match check
                 still fails loud on a wrong constant (it will not silently accept
                 the unscaled 1), but getting the denomination wrong wastes the
                 one registered exception this module allows for a confirmed,
                 document-level rounding artifact.
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
    units        multiplier applied to every extracted amount. Seattle and King
                 County print "(IN THOUSANDS)", so both use units=1000; every
                 other city prints whole dollars and uses the default 1.

                 THIS CANNOT BE VALIDATED BY THE TIE GATE. tie_delta compares a
                 computed sum against a printed total read through the SAME
                 multiplier, so it is 0 whether or not the scaling is right.
                 A wrong `units` ships a silently 1000x-wrong row. It is checked
                 instead by acfrGF.selftest.py and by the loader's per-capita
                 plausibility guard.
    revenue_parents
                 lowercase labels that introduce a group in the REVENUE section
                 (e.g. ('taxes',)). Separate from `parents`, which governs the
                 expenditure section only -- an entity can group one side and
                 not the other, and Seattle does exactly that: `Taxes` is a flat
                 leaf in its 2015-era statements and a parent with five children
                 from 2024.

                 Leaving this empty where the source DOES group is the quiet
                 failure: the parent row is read as a wrapped label and prefixed
                 onto its first child ("Taxes Property taxes"). Amounts are
                 unaffected, so tie_delta stays 0 and only the labels are wrong.
    revenue_group_members
                 lowercase label SUFFIXES that remain inside an open revenue
                 group. Both entities name every member of the tax group so it
                 ends in "taxes" ("Property taxes", "Retail sales and use
                 taxes"), while the first ungrouped source does not
                 ("Licenses and permits") -- so ('taxes',) closes the group in
                 exactly the right place.

                 Required whenever revenue_parents is set. Leaving it empty
                 closes the group after its FIRST child; omitting the close
                 entirely swallows every later source into the group. Both
                 still tie $0 -- only the shape is wrong.
    statement_anchor
                 optional regex identifying the statement page by its SCHEDULE
                 ID rather than its title (Seattle tags every vintage `B-4`).
                 Used in ADDITION to the title match, not instead of it.

                 Needed because Seattle's FY2009-era statement prints
                 "Page 1 of 2" between "...AND CHANGES" and "IN FUND BALANCES",
                 so no title regex can span the wrap. Page 2 of 2 carries the
                 same `B-4`, but `find_statement_page` returns the EARLIEST
                 qualifying page and the General Fund column plus both `Total`
                 rows are wholly on page 1, so page 1 always wins.
    revenue_total_labels
                 lowercase candidate strings for the printed revenue-subtotal
                 row, tried in order, matched case-insensitively. Defaults to
                 `('total revenues',)`, which reproduces every shipped city's
                 behaviour byte-for-byte -- this default is what every city
                 before Bainbridge was implicitly hard-coded to.

                 Bainbridge Island's FY2004, FY2005, FY2007 and FY2008
                 governmental-funds statements print `Total Operating
                 Revenues` instead of `Total Revenues` (FY2010 alone renders
                 it as `Total REVENUES`, still covered by the default's
                 case-insensitive match; FY2011 onward reverts to `Total
                 Revenues`). Bainbridge sets
                 `revenue_total_labels=('total revenues', 'total operating
                 revenues')` to cover both eras from one config.

                 Used in the two places that used to hard-code `'total
                 revenues'`: the page-qualifying gate in
                 `find_statement_page` and the `rev_line` selection in
                 `extract()`. The EXPENDITURE side is deliberately NOT
                 configurable this way -- `'total expenditures'` stays a
                 literal in both places. This asymmetry is what keeps a
                 proprietary-funds statement (business-type activities, which
                 prints `Total Operating Revenues` next to `Total Operating
                 EXPENSES`, never `Total Expenditures`) from ever qualifying:
                 `find_statement_page` requires BOTH a revenue-total match
                 AND the literal `'total expenditures'` to be present on the
                 same page, so widening only the revenue side cannot turn a
                 proprietary page into a false positive.
    section_header_mode
                 'exact' (default) requires the section header to be the WHOLE
                 line. 'prefix' allows trailing text, which Seattle's 2024-era
                 statements need because the `REVENUES` line also carries the
                 fund column headers.

                 'prefix' is guarded by a STRUCTURAL rule, not a list of known
                 title wraps (see `_is_section_header`'s docstring for the
                 full reasoning): what follows the section word is accepted
                 only if it is nothing (or just a trailing ':'/'$'), or if it
                 is separated from the section word by a genuine COLUMN GAP
                 (2+ spaces) -- because `pdftotext -table` renders a real
                 table caption that way, while a wrapped statement title is
                 single-spaced prose no matter which word the wrap happens to
                 land after. This is what makes 'prefix' safe against a wrap
                 point nobody has enumerated yet, not just the ones already
                 seen -- still, before enabling it for a new city, check it
                 against that city's actual wrapped-title line, since the
                 rule is general but not proven against documents nobody has
                 looked at.

                 This structural rule also means 'prefix' correctly rejects a
                 caption-shaped title fragment like "REVENUES AND OTHER
                 FINANCING SOURCES" or "EXPENDITURES AND OTHER FINANCING
                 USES" -- both are single-spaced prose after the section word,
                 not column-gap-separated, so the same rule that rejects a
                 wrapped title rejects these too.
    fy_end       (month_name, day) of the fiscal-year end, used to read the year
                 off the statement. Defaults to ('June', 30). Seattle and King
                 County close on December 31.

                 The year is read from the located STATEMENT PAGE's own "for
                 the year ended <fy_end>, <YYYY>" caption FIRST -- that page is
                 authoritative for the period of the numbers being extracted.
                 Only if the statement page does not state its own period does
                 parse_fy fall back to a whole-document scan, and only after
                 that to a regex over the FILE PATH (which silently mislabels
                 a row whenever a filename is wrong).

                 The whole-document fallback exists for a page that turns out
                 not to state its period, but is NOT safe to prefer: it can
                 latch onto a true but unrelated mention of a different year
                 elsewhere in the document -- a GFOA award paragraph, a
                 comparative reference -- before it ever reaches the
                 statement page's own caption. Observed live: King County's
                 FY2024 and FY2025 ACFRs both render the transmittal letter's
                 own correct self-reference as "...year ended December31,
                 2024" (pdftotext drops the space), which the fiscal-year
                 regex could not match; the whole-document scan then reached
                 a GFOA-award paragraph reading "...for the fiscal year ended
                 December 31, 2023" -- true of the PRIOR year's report, not
                 this one -- and returned 2023 for a document that is FY2024.
                 Fixed by (a) checking the statement page first and (b)
                 widening the month/day gap in the regex to `\\s*` so the
                 dropped-space form matches too.
    """

    def __init__(self, city, parents, root_leaves=(), source_rounding=None,
                 label_fixes=None, units=1, column_strategy='positional',
                 revenue_parents=(), revenue_group_members=(),
                 statement_anchor=None, section_header_mode='exact',
                 fy_end=('June', 30), revenue_total_labels=('total revenues',)):
        if not isinstance(units, int) or isinstance(units, bool):
            raise TypeError(
                'CityConfig.units must be an int, got %r (%s). A float would '
                'silently turn every extracted amount into a float and change '
                'the emitted JSON shape.' % (units, type(units).__name__))
        if column_strategy not in ('positional', 'ordinal'):
            raise ValueError('column_strategy must be "positional" or "ordinal", got %r' % column_strategy)
        if section_header_mode not in ('exact', 'prefix'):
            raise ValueError('section_header_mode must be "exact" or "prefix", got %r' % section_header_mode)
        self.city = city
        self.parents = tuple(p.lower() for p in parents)
        self.root_leaves = tuple(r.lower() for r in root_leaves)
        self.source_rounding = dict(source_rounding or {})
        self.label_fixes = dict(label_fixes or {})
        self.units = units
        self.column_strategy = column_strategy
        self.revenue_parents = tuple(p.lower() for p in revenue_parents)
        self.revenue_group_members = tuple(m.lower() for m in revenue_group_members)
        self.statement_anchor = statement_anchor
        self.section_header_mode = section_header_mode
        self.fy_end = fy_end
        self.revenue_total_labels = tuple(lbl.lower() for lbl in revenue_total_labels)


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


# A COLUMN SLOT is either a money token or a standalone dash-run standing in for
# a $0/blank cell. Counting dashes as slots is what makes ordinal reading exact:
# it keeps every later column in its true position instead of sliding it left.
#
# A dash-run is a slot only when it is flanked by COLUMN spacing -- two or more
# spaces, or the start/end of the line -- on BOTH sides. `-table` separates a
# blank-cell placeholder from its neighbours by column gaps that wide; a prose
# hyphen ("Debt Service - Principal", "Transfers In - General Fund") sits
# between single spaces and is deliberately NOT matched here, so it is never
# mistaken for a column and the label survives intact. An unspaced hyphen
# inside a word ("Non-departmental", "Low-Income Housing") was never a
# candidate either way. The run length is unbounded: capping it would make a
# run of four or more dashes silently vanish instead of counting as one slot
# -- the exact "columns slide left" failure this feature exists to prevent.
_SLOT = re.compile(r'\((?:\d[\d,]*)\)|\$?\s*\d[\d,]*|(?:(?<=^)|(?<=\s\s))[-–—]+(?=\s\s|$)')

def slots(line):
    """Every column slot on `line`, left to right. A dash-run yields 0."""
    out = []
    for m in _SLOT.finditer(line):
        t = m.group().replace('$', '').replace(' ', '').strip()
        if not t:
            continue
        if re.fullmatch(r'[-–—]+', t):
            out.append(0)
            continue
        v = parse_money(t)
        if v is not None:
            out.append(v)
    return out


# ── Labels ────────────────────────────────────────────────────────────────────
def norm_label(raw):
    """Whitespace-normalize, then drop trailing dash placeholders belonging to
    empty columns left of the first money token ("System development charges - -"
    -> "System development charges"). Only TRAILING runs are removed, so
    "Debt Service - Principal" and "Non-departmental" survive intact."""
    s = re.sub(r'\s+', ' ', raw).strip()
    s = re.sub(r'(?:\s+[-–—]+)+$', '', s)
    return s.strip().rstrip(':').strip()

def label_of(line):
    """Row label = text before the first money token."""
    m = _MONEY.search(line)
    raw = line[:m.start()] if m else line
    return norm_label(raw)

def label_of_slots(line):
    """Row label for ordinal mode: text before the first COLUMN SLOT."""
    m = _SLOT.search(line)
    return norm_label(line[:m.start()] if m else line)

_DASH_ROW = re.compile(r'^(?P<label>.*?[^\s\-–—])(?P<dashes>(?:\s+[-–—]+)+)\s*$')

def dash_zero_label(line):
    """Label if `line` is a label followed ONLY by dash placeholders, else None.
    Only meaningful for lines carrying no money tokens (trap 1).

    Fix round 1 / Critical 2: each dash-placeholder REPETITION must allow one
    OR MORE dash characters ([-–—]+, not [-–—]), mirroring the widening already
    applied to norm_label's trailing-dash strip above. King County writes a
    lone '-' per empty cell; Seattle writes '--'. The un-widened version only
    ever matched single dashes, so a Seattle all-'--'-row (no money tokens at
    all) fell through to the wrapped-label branch in `classify` and got glued
    onto the label of the NEXT real row instead of being recorded as a $0 row
    in zero_rows. Confirmed live on Seattle FY2024 p56 Capital Outlay:
    'Physical Environment' and 'Health and Human Services' are genuine $0
    rows that were vanishing into 'Physical Environment Transportation' and
    'Health and Human Services Culture and Recreation'."""
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

def _fy_re(fy_end):
    """Regex matching 'for the [fiscal] year ended <month> <day>, <year>' for
    the given (month_name, day) fiscal-year end.

    The gap between the month name and the day is `\\s*` (zero or more), not
    `\\s+` (one or more). King County's FY2024/FY2025 ACFRs render the
    transmittal letter's own correct self-reference as "...year ended
    December31, 2024." -- `pdftotext` drops the space entirely. Requiring at
    least one space made that correct, in-period mention invisible to the
    regex, which is what let `parse_fy`'s whole-document fallback (see below)
    latch onto a later, correctly-spaced but WRONG-year mention instead."""
    month, day = fy_end
    return re.compile(
        r'(?:for\s+the\s+)?(?:fiscal\s+)?year\s+ended\s+%s\s*%d,\s*(\d{4})' % (month, day), re.I)

def table_pages(pdf_path):
    out = subprocess.run(
        ['pdftotext', '-table', pdf_path, '-'],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    if out.returncode != 0:
        print('  pdftotext failed (%s): %s' % (out.returncode, out.stderr.strip()),
              file=sys.stderr)
        sys.exit(2)
    return out.stdout.split('\f')

def find_statement_page(pages, statement_anchor=None, revenue_total_labels=('total revenues',)):
    """(page_index, page_text) for the primary governmental-funds statement —
    the earliest qualifying page, since basic statements precede supplementary
    schedules. (None, None) if not found.

    `statement_anchor`, when given, is an additional regex (matched against a
    SCHEDULE ID such as Seattle's `B-4`) that can identify the page even where
    the title itself is wrapped across an interrupting "Page X of Y" line and
    so cannot be matched by `_TITLE`. It is used IN ADDITION to the title
    match, never instead of it.

    `revenue_total_labels` (see `CityConfig`) widens which printed revenue
    subtotal counts as qualifying evidence for this page. `'total
    expenditures'` stays a hard-coded literal on the other side of this same
    check on purpose: a proprietary-funds statement prints `Total Operating
    Revenues` next to `Total Operating EXPENSES`, never `Total Expenditures`,
    so requiring the literal keeps that page from ever qualifying even when
    `revenue_total_labels` is widened to include `'total operating
    revenues'`."""
    anchor = re.compile(statement_anchor, re.I | re.M) if statement_anchor else None
    cands = []
    for i, pg in enumerate(pages):
        low = pg.lower()
        if not (_TITLE.search(pg) or (anchor and anchor.search(pg))):
            continue
        if not any(lbl in low for lbl in revenue_total_labels) or 'total expenditures' not in low:
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

def parse_fy(pages, pdf_path, fy_end=('June', 30), statement_page=None):
    """The fiscal year a document reports for, in priority order:

    1. `statement_page`'s own "for the year ended <fy_end>, <YYYY>" caption,
       when given. This is the authoritative period for the numbers actually
       being extracted -- every statement page inspected so far states its
       own period on the page -- and it MUST be tried before anything else,
       because a whole-document scan can land on prose that is true but
       describes a DIFFERENT year. King County's ACFRs contain a GFOA-award
       paragraph reading "...for the fiscal year ended December 31, 2023"
       inside the FY2024 report (the award being described was for the prior
       year's report); before this fix, that paragraph -- appearing earlier
       in the whole-document scan than the correctly-spaced statement page
       text -- won because the statement page's OWN self-reference used the
       dropped-space form `_fy_re` could not yet match. Observed live on
       King County FY2024 (parsed as 2023) and FY2025 (parsed as 2024).
    2. Failing that (a statement page that does not state its own period, or
       no `statement_page` given), the first match anywhere in the document.
       Kept as a fallback, but genuinely last-resort now that the statement
       page is checked first -- carries the same "could match an unrelated
       year" risk described above.
    3. Failing that, a regex over the FILE PATH -- silently mislabels a row
       whenever the filename year is wrong, so this is truly last-ditch.
    """
    pat = _fy_re(fy_end)
    if statement_page is not None:
        m = pat.search(statement_page)
        if m:
            return int(m.group(1))
    for pg in pages:
        m = pat.search(pg)
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


def column_value(line, col_anchors, cfg):
    """The General Fund cell of `line`, scaled to dollars, or None if absent.

    'positional' assigns each number to its nearest column anchor. It is the
    default and what the eight already-loaded cities were parsed with.

    'ordinal' ignores x-positions entirely and takes the FIRST column slot,
    counting dash-runs as occupied columns. Required where `-table` renders a
    value nearer the next column's anchor -- King County FY2018/FY2019 and
    Seattle FY2009, where the positional reader silently drops GF cells and the
    tie fails by exactly the dropped rows.
    """
    if cfg.column_strategy == 'ordinal':
        s = slots(line)
        v = s[0] if s else None
    else:
        v = gf_value(line, col_anchors)
    return None if v is None else v * cfg.units


# ── Row classification ───────────────────────────────────────────────────────
def classify(line, col_anchors, cfg):
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

    gv = column_value(line, col_anchors, cfg)
    lbl = label_of_slots(line) if cfg.column_strategy == 'ordinal' else label_of(line)
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
_END_EXPENDITURES = r'^Total\s+expenditures\b'

def _end_revenues_pattern(revenue_total_labels):
    """Build the revenue SECTION-END regex from `CityConfig.revenue_total_labels`.

    Before `revenue_total_labels` existed, this was the single hard-coded
    literal `r'^Total\\s+revenues\\b'`. Discovered live while unblocking
    Bainbridge's FY2004/2005/2007/2008 (which print `Total Operating
    Revenues`, not `Total Revenues`): fixing only the page-qualifying gate in
    `find_statement_page` and the `rev_line` lookup in `extract()` was NOT
    enough on its own. `build_revenue`'s own section reader still stopped
    only at the old literal, so the revenue section never closed at `Total
    Operating Revenues` and ran away, swallowing EXPENDITURES, OTHER
    FINANCING SOURCES/USES and every row after it into one inflated "revenue"
    tree (observed live: FY2004 computed $44,401,783 against a printed
    $12,636,832 -- the whole rest of the page). This was the THIRD hard-coded
    `'total revenues'` spot, not the two originally identified, and needed
    the same treatment for the fix to actually work end-to-end rather than
    only relocating the correct page.

    Each label becomes `^word1\\s+word2...\\b` (whitespace-tolerant the same
    way the original literal was, and still matched case-insensitively by
    `_section`), joined as alternatives. With the default
    `('total revenues',)` this produces the exact same pattern as the old
    literal, so every city that does not set `revenue_total_labels` is
    unaffected."""
    alts = [r'\s+'.join(re.escape(w) for w in lbl.split()) for lbl in revenue_total_labels]
    return r'^(?:%s)\b' % '|'.join(alts)

# Fix round 1 (Task 6) rejected a title wrap only when it landed "changes in
# fund" on the SAME physical line as the section word, or left the section
# word followed by a comma or by connective-only punctuation ("EXPENDITURES,",
# "REVENUES, EXPENDITURES, AND"). Fix round 2: that was still an ENUMERATED
# set of known wraps, and a wrap one word earlier or later slipped through it
# undetected:
#   _is_section_header('EXPENDITURES AND CHANGES', 'expenditures', 'prefix')     -> was True, must be False
#   _is_section_header('EXPENDITURES AND CHANGES IN', 'expenditures', 'prefix')  -> was True, must be False
#   _is_section_header('EXPENDITURES AND CHANGE', 'expenditures', 'prefix')      -> was True, must be False
#
# Round 2 replaced the enumeration with a premise that turned out to be
# false: that `pdftotext -table` only ever puts a 2+-space COLUMN GAP where
# there is a real table column, and prose is always single-spaced. It is
# not. `SEA2009_PAGE` in acfrGF.selftest.py -- transcribed from the real
# Seattle FY2009 output -- contains, INSIDE THE TITLE:
#   'B-4                                STATEMENT OF REVENUES, EXPENDITURES, AND                 CHANGES'
# where "AND" and "CHANGES" are separated by seventeen spaces. `pdftotext
# -table` produces column-width gaps within justified title text too, so gap
# width ALONE cannot discriminate a caption from a title continuation:
#   _is_section_header('EXPENDITURES  AND CHANGES', 'expenditures', 'prefix')          -> was True, must be False
#   _is_section_header('REVENUES  AND OTHER FINANCING SOURCES', 'revenues', 'prefix')  -> was True, must be False
#   _is_section_header('EXPENDITURES  OF THE GENERAL FUND', 'expenditures', 'prefix')  -> was True, must be False
#
# Fix round 3 adds a SECOND, independent discriminator on top of the column
# gap: a title continuation resumes with a CONNECTIVE word ("and", "of",
# "in", ...); a genuine column caption starts with a caption noun (a fund
# name, "General", a year). `_CONNECTIVE_WORDS` is checked against the first
# word of the remainder, after the gap check, so a column-gap-separated
# remainder is still rejected if that first word is connective tissue rather
# than a caption.
#
# Fix round 4: round 3's connective check only fired when the remainder's
# first non-space TOKEN parsed as lowercase letters. When it did not --
# punctuation or a digit came first -- the match returned None, the
# connective check was silently SKIPPED, and control fell through to an
# unconditional ACCEPT. A guard layer that cannot reach a verdict must not
# silently grant one:
#   _is_section_header('EXPENDITURES   - BUDGET AND ACTUAL', 'expenditures', 'prefix')         -> was True, must be False
#   _is_section_header('EXPENDITURES  (BUDGETARY BASIS) AND CHANGES', 'expenditures', 'prefix') -> was True, must be False
#   _is_section_header('EXPENDITURES  "BUDGETARY BASIS" SCHEDULE', 'expenditures', 'prefix')    -> was True, must be False
# (Every one of these is ALREADY blocked one layer up: `find_statement_page`'s
# `_EXCLUDE` tuple contains 'budgetary' and 'budget and actual', so a
# budget-vs-actual page is never selected as the primary statement and never
# reaches `_is_section_header` at all. The fail-open above was a genuine
# design flaw worth closing on its own merits, not a live data risk in any
# document this module has actually processed.)
#
# The fix distinguishes what kind of token follows the column gap, and
# reaches an explicit verdict for each kind instead of falling through:
#   * a WORD -> the existing `_CONNECTIVE_WORDS` check (round 3, unchanged);
#   * a DIGIT -> accept unconditionally. Comparative statements legitimately
#     caption columns with bare years ("REVENUES   2024   2023"); rejecting
#     any non-word lead would silently empty the revenue side on exactly
#     that real header shape, which is worse than the bug this guard exists
#     to fix. A digit lead is accepted whether or not it looks like a
#     plausible year -- there is no separate "is this really a year" check,
#     because narrowing it that far buys no safety (a bare number is not
#     English prose either way) and risks rejecting a real caption over a
#     guess about its shape;
#   * a recognised SUBTITLE separator (-, en dash, em dash, "(", '"', "'", or
#     a left curly quote) -> reject. A subtitle is introduced exactly this
#     way ("...AND CHANGES IN FUND BALANCES - BUDGET AND ACTUAL"), never a
#     column caption, which is always a bare word or a year;
#   * anything else unrecognised -> reject. This layer now FAILS CLOSED: an
#     unrecognised leading token is treated as "cannot prove this is a
#     caption," not as license to accept it.
#
# Fix round 5: the WORD branch above still failed open for a non-ASCII
# alphabetic lead. `lead.isalpha()` is True for any Unicode letter, but
# `_LEADING_WORD` only matches ASCII [a-z]+, so an accented letter or a
# ligature made the match None, and `not (None and ...)` evaluated to an
# unconditional ACCEPT that never ran the connective test -- the same
# fail-open shape round 4 eliminated, narrowed to non-ASCII letters:
#   _is_section_header('EXPENDITURES  ÉTAT AND CHANGES', 'expenditures', 'prefix')  -> was True, must be False
# Judged low-severity (no instance in any real fixture; a diacritic-mangled
# connective is speculative) but fixed anyway, in two lines, alongside a
# docstring correction: "fails closed" previously described the top-level
# three-way dispatch accurately but did NOT hold inside the word branch,
# which had this silent accept. An inaccurate reassurance that a hole
# cannot exist is worse than the (low-severity) hole itself.
#
# HONESTY ABOUT WHAT THIS IS: layered defence, not a correctness proof. The
# connective list is a small CLOSED set; a genuine column caption that
# happened to begin with one of those words would be wrongly rejected. No
# such caption exists in any document this module has been run against --
# every real caption seen so far begins with a caption noun ("General
# Fund", "Transportation", "Governmental", a year) -- but a future document
# could in principle contain one. The saving grace, and the reason this is
# defence-in-depth rather than a proof: if some future document ever DOES
# evade every layer below, the expenditure section opens at the title,
# swallows the revenue block, and the resulting ~3x-inflated total FAILS THE
# TIE GATE LOUDLY in `extract()` -- it aborts that fiscal year's extraction
# rather than silently shipping wrong figures. That failure mode is what
# makes an imperfect heuristic here an acceptable trade, not a hidden risk.
_CONNECTIVE_WORDS = frozenset((
    'and', 'or', 'of', 'in', 'for', 'the', 'to', 'with', 'changes', 'change',
))
_SUBTITLE_LEAD_CHARS = frozenset(('-', '–', '—', '(', '"', "'", '‘', '“'))
_REST_IS_ONLY_TRAILING_PUNCTUATION = re.compile(r'^[\s:$]*$')
_COLUMN_GAP = re.compile(r'^\s{2,}')
_LEADING_WORD = re.compile(r'^([a-z]+)')

def _is_section_header(line, want, mode='exact'):
    """True when `line` is the section header `want`, ignoring internal
    letter-spacing, a trailing colon and a stray currency symbol.

    'exact' (the default) requires the collapsed line to equal `want` exactly.

    'prefix' allows trailing text after `want`, needed where the header line
    also carries fund column headers (Seattle FY2024-era 'REVENUES  General
    Fund  Transportation ...'). The remainder after `want` is run through
    layered checks, in this order, each independently motivated (see the
    comment above this function for the bypass rounds that produced this
    list):

      1. Reject if the remainder is comma-led ("EXPENDITURES," /
         "REVENUES, EXPENDITURES, AND") -- a comma there marks a title
         phrase cut mid-wrap.
      2. Reject on the substring belt-and-braces: the whole collapsed line
         contains 'changesinfund', 'fundbalance' (singular included --
         Tigard titles its statement "CHANGES IN FUND BALANCE"), or
         'statement'. (Note: `find_statement_page`'s `_EXCLUDE` list already
         keeps budgetary/budget-and-actual PAGES from ever reaching this far
         -- this layer and the ones below are about title wraps on the
         PRIMARY statement page, not a second line of defence against a
         different page being selected.)
      3. Accept if nothing meaningful follows -- only whitespace and an
         optional trailing ':' or '$'.
      4. Reject if there is no genuine COLUMN GAP (2+ spaces) before the
         remainder -- a single space before a real word is prose.
      5. Classify the remainder's first non-space character and dispatch on
         it. The top-level dispatch FAILS CLOSED -- a lead character that is
         none of the three recognised kinds below is rejected, not
         accepted:
           - WORD (an alphabetic lead): a leading ASCII word is extracted
             and rejected if it is a CONNECTIVE from the small closed set in
             `_CONNECTIVE_WORDS` ("...AND CHANGES", "...OF THE GENERAL
             FUND" are title continuations), accepted otherwise. If no
             ASCII word can be extracted at all (a non-ASCII alphabetic
             lead -- an accented letter, a ligature), this branch also
             REJECTS, so the connective test always actually runs before
             this branch can return True. The connective set itself remains
             a small CLOSED list: a genuine caption beginning with a word
             outside that list is accepted, and a hypothetical caption that
             began WITH one of those ten words would be wrongly rejected.
             That is a disclosed, deliberate residual, not a bug -- no such
             caption has been seen in any document this module has
             processed;
           - DIGIT: accepted unconditionally and deliberately. Year and
             fund-number captions ("REVENUES   2024   2023",
             "REVENUES   101   Special Revenue") are legitimate real header
             shapes, and there is no further "is this plausibly a year"
             check -- narrowing it that far buys no real safety and risks
             rejecting a genuine caption over a guess about its shape;
           - a recognised SUBTITLE separator (dash, en/em dash, parenthesis,
             or a straight/curly quotation mark) is rejected -- a subtitle
             is introduced exactly this way
             ("...AND CHANGES IN FUND BALANCES - BUDGET AND ACTUAL"), never
             a column caption.
      6. Otherwise accept.

    What this guard is NOT: a correctness proof. Two things bound the actual
    exposure of its known, disclosed gaps (the connective closed-list residual
    above, and any wrap shape nobody has enumerated yet): `find_statement_page`'s
    `_EXCLUDE` list already keeps a budgetary/budget-and-actual PAGE from ever
    being selected as the primary statement, so that whole class never reaches
    this function at all (see layer 2's note); and if some future document
    ever DOES evade every layer here, the wrongly-opened section swallows the
    other section's block and the resulting inflated total FAILS THE TIE GATE
    LOUDLY in `extract()` -- it aborts that fiscal year's extraction rather
    than silently shipping wrong figures. Those two properties are why an
    imperfect heuristic here is an acceptable trade, not a hidden risk."""
    s = re.sub(r'\s+', '', line).strip().rstrip('$').rstrip(':').lower()
    if mode != 'prefix':
        return s == want

    low = line.strip().lower()
    if not low.startswith(want):
        return False
    rest = low[len(want):]

    if rest.startswith(','):
        return False
    if 'changesinfund' in s or 'statement' in s or 'fundbalance' in s:
        return False
    if _REST_IS_ONLY_TRAILING_PUNCTUATION.match(rest):
        return True
    if not _COLUMN_GAP.match(rest):
        return False

    content = rest.lstrip()
    lead = content[0]
    if lead.isalpha():
        # Fix round 5: `_LEADING_WORD` is ASCII [a-z]+ only, but `lead.isalpha()`
        # is True for any Unicode letter. A non-ASCII alphabetic lead (an
        # accented letter, a ligature) used to leave `word` as None, and
        # `not (None and ...)` evaluated to an unconditional ACCEPT that never
        # ran the connective test -- the same fail-open shape round 4 closed,
        # narrowed to non-ASCII letters. No word identified now means REJECT,
        # not accept: the connective test must actually run before this
        # branch can return True.
        word = _LEADING_WORD.match(content)
        if not word:
            return False
        return word.group(1) not in _CONNECTIVE_WORDS
    if lead.isdigit():
        return True
    if lead in _SUBTITLE_LEAD_CHARS:
        return False
    return False

def _section(lines, start_word, end_pat, mode='exact'):
    """Yield raw lines strictly between the start and end header lines."""
    on = False
    for l in lines:
        st = l.strip()
        if not on and _is_section_header(st, start_word, mode):
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
    """GF revenue-by-source tree. Flat unless cfg.revenue_parents groups it.
    $0 sources are recorded in zero_rows and dropped."""
    root_children, zero_rows = [], []
    parent = None
    # Fix round 1 / Critical 1: whether a data row (zero-valued OR not) has
    # been seen since `parent` last opened. The close guard below gates on
    # THIS, not on `parent['c']` truthiness. A $0 group member never reaches
    # `parent['c']` (it's recorded in zero_rows and dropped instead), so if
    # every genuine member of a group is $0, `parent['c']` stays empty
    # forever and a `parent['c']`-truthiness guard would never fire -- the
    # first unrelated, non-member row would then be silently swallowed into
    # the (visually empty) group instead of closing it.
    parent_seen = False
    pending = ''
    end_revenues = _end_revenues_pattern(cfg.revenue_total_labels)
    for l in _section(lines, _SEC_REVENUES, end_revenues, cfg.section_header_mode):
        kind, lbl, val = classify(l, col_anchors, cfg)
        low = (lbl or '').lower()

        if kind == 'wrapped' and low in cfg.revenue_parents:
            parent = {'n': lbl, 'a': 0, 'c': []}
            parent_seen = False
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

        # Close an open revenue group once a row is no longer one of its
        # members. Checked BEFORE the val==0 branch below and gated on
        # `parent_seen`, not on `parent['c']`, so a group whose members are
        # all $0 (dropped, never added as children) still closes correctly
        # on the first later row that isn't a member.
        if parent is not None and parent_seen and not any(
                low.endswith(sfx) for sfx in cfg.revenue_group_members):
            parent = None
        if parent is not None:
            parent_seen = True

        if val == 0:
            zero_rows.append(full)
            continue

        node = {'n': full, 'a': val}
        if parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    for n in root_children:
        if 'c' in n:
            n['a'] = sum(ch['a'] for ch in n['c'])
    root_children = [n for n in root_children if n.get('c') or 'c' not in n]

    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': root_children}, total, zero_rows


def build_operating(lines, col_anchors, cfg):
    """2-level GF expenditure-by-function tree. Parents named in cfg.parents are
    label-only headers whose value is the sum of their children. Capital-outlay
    placement is governed by cfg.capital_at_root (trap 3)."""
    root_children, zero_rows = [], []
    parent = None
    pending = ''
    for l in _section(lines, _SEC_EXPENDITURES, _END_EXPENDITURES, cfg.section_header_mode):
        if not l.strip():
            continue
        kind, lbl, val = classify(l, col_anchors, cfg)
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
    pi, pg = find_statement_page(pages, cfg.statement_anchor, cfg.revenue_total_labels)
    if pg is None:
        print('  ERROR: primary GF statement not found in %s' % pdf_path, file=sys.stderr)
        sys.exit(3)
    fy = parse_fy(pages, pdf_path, cfg.fy_end, statement_page=pg)
    lines = pg.split('\n')
    rev_line = next((l for l in lines
                      if any(l.strip().lower().startswith(lbl) for lbl in cfg.revenue_total_labels)),
                     None)
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
        printed = column_value(rev_line, col_anchors, cfg)
    else:
        tree, computed, zero_rows = build_operating(lines, col_anchors, cfg)
        printed = column_value(exp_line, col_anchors, cfg)

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
