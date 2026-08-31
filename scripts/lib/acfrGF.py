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
    empty_rows   labels that, WHEN THE ROW CARRIES NO MONEY AND NO DASH IN ANY
                 COLUMN, are a LINE ITEM THE ISSUER PRINTED EMPTY — not the first
                 line of a wrapped label.

                 A row with no money token is one of three things: a group
                 heading (handled by `parents` / `revenue_parents`), the first
                 line of a two-line label, or a line item that simply carries
                 nothing that year. The default is the wrapped-label reading, and
                 that default is RIGHT for most of this corpus -- Bend's
                 `Community and economic` / `development`, Seattle's `Program
                 Income, Interest, and Miscellaneous`, Beaverton's `Interest on
                 investments` are all genuine two-line labels.

                 Kent is the counter-example, and it cost ten published labels.
                 Its `Lodging` tax line, its `Issuance costs` debt line and (in
                 FY2004) its `Real estate excise tax` line are real line items
                 with nothing in any column, and welding them forward shipped
                 `Lodging Other`, `Real estate excise tax Lodging Other`,
                 `Contributions and Donations Other miscellaneous revenue` and
                 `Issuance costs Capital outlay`. The last of those was worse than
                 a name: the composite no longer STARTED with a `root_leaves`
                 entry, so $193,673 of capital spending was filed inside Debt
                 service. Every one of them tied at $0.

                 A label listed here only takes effect on a year where the row is
                 ACTUALLY valueless, so `real estate excise tax` can be declared
                 without affecting the fifteen years in which it carries a figure.

                 Note this is a DECLARATION, not a derivation: the shapes are told
                 apart from the document itself, independently, by
                 verify-wa-rederive.mjs, which reads the printed indentation out of
                 `pdftotext -lineprinter` and needs no per-city fact at all. That
                 harness is what caught all ten, and it is what will catch a wrong
                 entry here.
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
    exclude_ignore
                 `_EXCLUDE` terms to STOP disqualifying a page for this entity.
                 Defaults to empty, so every entity that does not set it keeps
                 the previous behaviour byte-for-byte.

                 `_EXCLUDE` assumes its terms only ever appear on pages that are
                 NOT the primary statement — a combining schedule, a budgetary
                 comparison, a proprietary or fiduciary statement. Buncombe
                 County breaks that assumption: FY2011-FY2018 print the
                 GOVERNMENT-WIDE RECONCILIATION AT THE FOOT OF THE FUND
                 STATEMENT ITSELF, on the same page, so the genuine primary
                 statement carries both 'reconciliation' and 'net position':

                     Total revenues                          289,342,572
                     Total expenditures                      286,305,444
                     ...
                     Amounts reported for governmental activities in the
                       statement of activities (Exhibit 2) are different:
                     Reconciliation to full accrual basis ...  (59,815,308)
                     Total change in net position ...        $ (48,705,758)

                 With the default list those eight years report "primary GF
                 statement not found" and the county's series has a
                 seven-year hole in the middle. Naming the two terms here is
                 narrower than deleting them from `_EXCLUDE`, which would
                 weaken the check for the other twenty-odd entities that rely
                 on it.

                 The value is VALIDATED against `_EXCLUDE` at construction: a
                 term not in that tuple raises, because a typo would disable
                 nothing while looking like it had.

                 ⚠ This widens which pages can qualify, so it must be paired
                 with evidence that the page chosen is the RIGHT one.
                 `verify-nc.mjs` re-derives every Buncombe year through an
                 independent coordinate reader that finds its own page.
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
    revenue_section_header
                 the section-header word that OPENS the revenue section,
                 default 'revenues'. Boulder County, CO prints the header
                 SINGULAR — `Revenue` — and with the plural hard-coded the
                 section reader matched nothing at all: the revenue tree came
                 back EMPTY while the printed total was still found, so the tie
                 gate failed loudly with a full -283,438,244 delta rather than
                 shipping a wrong shape. That loud failure is the design working.

                 ⚠ This is the same class of fact as `revenue_total_labels`,
                 added for Bainbridge's `Total Operating Revenues`, and it is
                 configured for the same reason: the section word is a property
                 of the ISSUER's chosen wording, not of the statement type.
                 Note the EXPENDITURE side needs no equivalent — every document
                 in this corpus prints `Expenditures` plural, including Boulder
                 County, which is exactly why only one of the two is
                 configurable.
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
                 fy_end=('June', 30), revenue_total_labels=('total revenues',),
                 empty_rows=(), exclude_ignore=(),
                 # ⚠ The literal, not `_SEC_REVENUES`: that constant is defined
                 # further down this module and a default argument is evaluated
                 # when the function is DEFINED, so referring to it here is a
                 # NameError at import. The two are asserted equal below.
                 revenue_section_header='revenues',
                 decimal_money=False, whitespace_repair=False,
                 multipage=False, multipage_max=6,
                 subparents=(), subparent_member_prefixes=(),
                 subparent_close='members',
                 revenue_subparents=(), revenue_group_close='members',
                 subtotal_prefixes=(), leading_account_code=False):
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
        self.revenue_section_header = str(revenue_section_header).lower()
        self.empty_rows = tuple(r.lower() for r in empty_rows)
        unknown = tuple(t for t in exclude_ignore if t.lower() not in _EXCLUDE)
        if unknown:
            raise ValueError(
                'CityConfig.exclude_ignore names %r, which is not in _EXCLUDE %r. '
                'A typo there would silently disable nothing and leave the page '
                'rejected, which reads as "no statement found".' % (unknown, _EXCLUDE))
        self.exclude_ignore = tuple(t.lower() for t in exclude_ignore)
        self.decimal_money = bool(decimal_money)
        self.whitespace_repair = bool(whitespace_repair)
        if revenue_group_close not in ('members', 'numeric_chart', 'next_heading'):
            raise ValueError('revenue_group_close must be "members", '
                             '"numeric_chart" or "next_heading", got %r' % revenue_group_close)
        if subparent_close not in ('members', 'next_heading'):
            raise ValueError('subparent_close must be "members" or "next_heading", '
                             'got %r' % subparent_close)
        self.subparent_close = subparent_close
        self.multipage = bool(multipage)
        self.multipage_max = int(multipage_max)
        self.subparents = tuple(p.lower() for p in subparents)
        self.subparent_member_prefixes = tuple(p.lower() for p in subparent_member_prefixes)
        self.revenue_subparents = tuple(p.lower() for p in revenue_subparents)
        self.revenue_group_close = revenue_group_close
        self.subtotal_prefixes = tuple(p.lower() for p in subtotal_prefixes)
        self.leading_account_code = bool(leading_account_code)
        if (self.subparents and subparent_close == 'members'
                and not self.subparent_member_prefixes):
            # The exact shape of the `revenue_parents`-without-members trap that
            # shipped a wrong Boulder tree at a $0 tie: a group that cannot
            # recognise its own members closes after its first child, and every
            # later sibling silently reparents one level up.
            raise ValueError(
                'subparents requires subparent_member_prefixes: without it a '
                'sub-group closes after its FIRST child and the rest reparent '
                'silently -- and the statement still ties.')


# ── Money parsing ─────────────────────────────────────────────────────────────
_MONEY = re.compile(r'\((?:\d[\d,]*)\)|\$?\s*\d[\d,]*')

# ⚠⚠ DECIMAL (cents-printing) VARIANT — Knight session 8, opt-in only.
#
# Grand Forks County ND FY2016-FY2021 is audited by the ND Office of the State
# Auditor and prints CENTS: `$ 12,716,043.81`. With the whole-dollar `_MONEY`
# above, `156,022.41` matches as TWO tokens -- `156,022` and `41` -- and the
# positional column reader then picks whichever landed in the General Fund
# column. Observed live: `Economic development` came back as **41** and
# `Capital outlay` as **98**. That is a silent two-order-of-magnitude corruption
# and it is exactly the shape that would ship if the tie happened to pass.
#
# It did NOT pass -- the tie failed at -401,161 and the years were held back --
# which is the design working. This variant exists so those years can be read
# correctly rather than excluded.
#
# ⚠ The county switched to Brady Martz at FY2022 and whole dollars came with it,
# so ONE ENTITY NEEDS BOTH REGIMES ACROSS ITS OWN SERIES. Decimal mode is
# therefore safe to leave on for such an entity: a whole-dollar token still
# matches, and is scaled to exact cents with no rounding.
_MONEY_DEC = re.compile(r'\((?:\d[\d,]*(?:\.\d{1,2})?)\)|\$?\s*\d[\d,]*(?:\.\d{1,2})?')

# Module-level because `nums_with_pos`/`slots`/`label_of_slots` are called from
# a dozen places that do not all carry a `cfg`. It is set from cfg at the top of
# `extract()` on EVERY call, so it cannot leak between entities, and the module
# is not concurrent. Default False keeps every pre-session-8 entity bit-identical.
_DECIMAL_MONEY = False

# ⚠⚠ AN ISSUER'S ACCOUNT CODE IS NOT MONEY (opt-in, cfg.leading_account_code).
#
# Aberdeen SD prints the South Dakota municipal chart of accounts, so every line
# begins with its code: `310 Taxes`, `335.01 Bank franchise tax`. `_MONEY`
# matches a bare digit run, so `310` was read as a VALUE and the group headings
# arrived as data rows worth 310, 330, 335, 348, 350 ... Every group heading
# became a $310-ish leaf, no group ever opened, and the revenue tree came back
# completely flat while the total was only 3,752 over -- small enough to look
# like a rounding artifact rather than a destroyed hierarchy.
#
# `_LEADING_PAGE_NUMBER` does not cover this: it requires TWO spaces after the
# number (it exists for footer text interleaved by `-table`), and a chart code is
# followed by exactly one. This is the same class of hazard as the
# `Fire District # 37 Contract` truncation `label_of` documents -- a number that
# belongs to the NAME, not to a column.
_LEADING_CODE = False
_CODE_AT_START = re.compile(r'^\s*\d{3}(?:\.\d{1,2})?(?=\s\S)')


def _code_span(line):
    """(start, end) of a leading account code, or None. Enabled per entity."""
    if not _LEADING_CODE:
        return None
    m = _CODE_AT_START.match(line)
    return (m.start(), m.end()) if m else None


def _money_re():
    return _MONEY_DEC if _DECIMAL_MONEY else _MONEY


def parse_money(tok):
    """'$  8,347,443' -> 8347443 ; '(555,070)' -> -555070 ; '' / '-' -> None.

    ⚠ In decimal mode the return is **integer CENTS**, not dollars, so that the
    whole pipeline -- component sums, the printed total, and therefore
    `tie_delta` -- stays in exact integer arithmetic. Rounding each row to
    dollars first would make the tie drift by a few dollars on a large statement
    and force a fake `source_rounding` entry to paper over OUR error rather than
    the source's. Conversion to dollars happens ONCE, at emission, in `extract`.
    """
    t = tok.replace('$', '').replace(' ', '').strip()
    if not t or t == '-':
        return None
    neg = t.startswith('(')
    t = t.strip('()').replace(',', '')
    if not _DECIMAL_MONEY:
        if not t.isdigit():
            return None
        return -int(t) if neg else int(t)
    # Decimal mode: everything becomes cents, including whole-dollar tokens.
    whole, _, frac = t.partition('.')
    if not whole.isdigit() or (frac and not frac.isdigit()):
        return None
    cents = int(whole) * 100 + int((frac + '00')[:2] or 0)
    return -cents if neg else cents


def nums_with_pos(line):
    """[(value, end_char_pos)] for every money token on the line."""
    out = []
    span = _code_span(line)
    for m in _money_re().finditer(line):
        if span and m.start() < span[1]:
            continue
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

# ⚠ The decimal twin of `_SLOT`. It MUST stay in lockstep with `_MONEY_DEC`:
# if a cents token were one slot to the money reader and two to the slot reader,
# ordinal column counting would slide every later column left by one — the very
# failure the dash-run rule above exists to prevent.
_SLOT_DEC = re.compile(
    r'\((?:\d[\d,]*(?:\.\d{1,2})?)\)|\$?\s*\d[\d,]*(?:\.\d{1,2})?'
    r'|(?:(?<=^)|(?<=\s\s))[-–—]+(?=\s\s|$)')


def _slot_re():
    return _SLOT_DEC if _DECIMAL_MONEY else _SLOT


def slots(line):
    """Every column slot on `line`, left to right. A dash-run yields 0."""
    out = []
    span = _code_span(line)
    for m in _slot_re().finditer(line):
        if span and m.start() < span[1]:
            continue
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
    """Row label = text before the first money token that ENDS the label.

    A NUMBER CAN BE PART OF A NAME, and cutting at the first money token alone
    got that wrong: Kent FY2004-FY2010 print an intergovernmental line called
    `Fire District # 37 Contract`, whose `37` matches _MONEY, so six published
    years carried a line item named `Fire District #` -- a truncation no
    arithmetic gate can see, since the figure and the tie are untouched.

    A number inside a name is followed by more of the name; a column value is
    followed only by other columns' figures, dashes and dollar signs. So the
    label ends at the first money token after which no WORD remains.

    This is narrower than it looks: measured across all eighteen entities that
    use this module, the only rows it moves are Kent's six `Fire District #`
    rows. `label_of_slots` (the ordinal path) cuts at a COLUMN SLOT rather than a
    money token and is untouched, so no ordinal city is affected either.
    """
    raw = line
    for m in _money_re().finditer(line):
        if not re.search(r'[A-Za-z]{2,}', line[m.end():]):
            raw = line[:m.start()]
            break
    return norm_label(raw)

def label_of_slots(line):
    """Row label for ordinal mode: text before the first COLUMN SLOT."""
    span = _code_span(line)
    m = next((x for x in _slot_re().finditer(line)
              if not (span and x.start() < span[1])), None)
    return norm_label(line[:m.start()] if m else line)

_DASH_ROW = re.compile(r'^(?P<label>.*?[^\s\-–—])(?P<dashes>(?:\s+[-–—]+)+)\s*$')
_DASH_ONLY = re.compile(r'^[-–—]+$')

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


# A page-footer PAGE NUMBER can land at the very start of a data row's
# rendered line, ahead of its real label -- `pdftotext -table` interleaves
# physically separate footer text onto the same output line whenever it
# shares a y-coordinate band with a table row. Confirmed live on Bainbridge
# Island's FY2004 ('16 ... Transportation ... 75 ...'), FY2005 ('16 ...
# Transportation ... 7,270 ...'), FY2007 ('21 ... Economic environment ...
# 2,323,355 ...') and FY2008 ('16 ... Health and human services ...
# 452,200 ...'). Before this fix, the bare page number was read as the row's
# first money token / column slot, `label_of`/`label_of_slots` returned
# everything strictly BEFORE it -- empty, since the page number sits at
# position 0 -- and the row was silently dropped, taking its true value with
# it and leaving no trace in `zero_rows`.
#
# Recognised ONLY when a bare digit run at the very start of the line is
# separated from what follows by a genuine COLUMN GAP (2+ spaces -- the same
# discriminator `_is_section_header`'s 'prefix' mode already uses to tell a
# real column caption from prose) and that next thing is a letter. This is
# deliberately narrow, NOT a general "strip leading digits" rule: a
# legitimate label that itself starts with digits ("911 Dispatch",
# "4Culture") is separated from what follows by a single space or no space
# at all, never a 2+-space column gap, so `_LEADING_PAGE_NUMBER` does not
# match it and it is left completely untouched.
#
# DISCLOSED RESIDUAL: this function is not the only place a digit-led label
# can go wrong. `_MONEY`/`_SLOT` match a bare digit run as a "money token"
# regardless of what immediately follows it, so a label like "4Culture" or
# "911 Dispatch" was ALREADY ambiguous to `label_of`/`label_of_slots` before
# this fix existed -- that pre-existing ambiguity is untouched by this
# function (confirmed: it does not modify either example). What CHANGED with
# this round's Trap 5 fix in `classify()` is that a row shaped like that,
# if it ever reached the primary GF statement page, would now RAISE instead
# of silently vanishing (a real, confirmed King County FY2024 caption reads
# "2016A LTGO Bond 4Culture Building" -- but on a debt schedule, never the
# governmental-funds statement page `find_statement_page` selects). Verified
# by running every already-shipped entity using this library against every
# ACFR on disk (162 combinations across Beaverton, Bend, Cornelius,
# Hillsboro, Sherwood, Tigard, Tualatin, Seattle and King County, both
# modes): zero raised. Not fixed further here -- fixing the deeper
# tokenizer ambiguity was judged a larger, separately-scoped change than
# this round approved; if a future document's GF statement page ever does
# contain such a label, `classify` will raise loudly naming the offending
# line rather than silently dropping it, which is the safe failure mode
# either way.
_LEADING_PAGE_NUMBER = re.compile(r'^(\d{1,4})(\s{2,})(?=[A-Za-z])')

def _recover_label_past_leading_page_number(line):
    """If `line` begins with a bare page-number token followed by a genuine
    column gap and then a letter, blank out just that token (replace it with
    spaces of the SAME LENGTH) so the real label and values behind it parse
    normally. Returns `line` completely unchanged otherwise.

    The digit run is REPLACED with spaces rather than deleted so every later
    character keeps its exact original absolute position -- required for
    `column_strategy='positional'`, which anchors values by x-coordinate read
    from a DIFFERENT line (the totals row) and would silently misalign if
    this line's length changed."""
    m = _LEADING_PAGE_NUMBER.match(line)
    if not m:
        return line
    digits = m.group(1)
    return (' ' * len(digits)) + line[len(digits):]


# A RENDERED HORIZONTAL RULE that lands in the text layer to the LEFT of a row's
# label, which `label_of` then swallows as part of the label.
#
# Confirmed live on Bainbridge Island FY2013 revenue (PDF page 32): the
# "Interest and Investment Revenue" row renders as
#
#     _________________________________________________  Interest and Investment    Revenue    46,648 ...
#
# and shipped to the database as a category AND line item literally named
# "_________________________________________________ Interest and Investment
# Revenue". The FIGURE was never wrong -- 46,648 is the correct General Fund
# value and the row tied at $0 -- which is exactly why nothing caught it: this
# is the same class as the dash-zero trap, a LABEL corruption that leaves
# tie_delta at 0 and therefore passes every arithmetic gate. It reached
# production display.
#
# Deliberately narrow, matching `_LEADING_PAGE_NUMBER`'s shape and reasoning:
# THREE or more underscores in the line's LEFT MARGIN (leading whitespace only
# before them), separated from what follows by a genuine 2+-space COLUMN GAP,
# followed by a letter. No legitimate financial-statement label begins that way;
# a label containing an underscore ("Fund_Balance") has neither a margin-anchored
# run nor a column gap after it, so it is untouched.
#
# Leading whitespace is ALLOWED before the run (unlike `_LEADING_PAGE_NUMBER`,
# whose token starts at column 0) because `pdftotext -table` indents every row
# of these statements by the page's left margin -- the rule is drawn inside that
# margin, not at column 0.
_LEADING_RULE = re.compile(r'^(\s*)(_{3,})(\s{2,})(?=[A-Za-z])')


def _recover_label_past_leading_rule(line):
    """Blank out a rendered rule glued to the left of a row's label, with spaces
    of the SAME LENGTH so every later character keeps its exact original
    absolute position (required by `column_strategy='positional'`, which anchors
    values by x-coordinate read from a different line). Returns `line`
    completely unchanged otherwise."""
    m = _LEADING_RULE.match(line)
    if not m:
        return line
    start, rule = m.start(2), m.group(2)
    return line[:start] + (' ' * len(rule)) + line[start + len(rule):]


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

def find_statement_page(pages, statement_anchor=None, revenue_total_labels=('total revenues',),
                        exclude_ignore=()):
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
        if any(x in low for x in _EXCLUDE if x not in exclude_ignore):
            continue
        cands.append((i, pg))
    if not cands:
        return None, None
    cands.sort()
    return cands[0]

# A real printed figure is comma-grouped or carries cents. A repeated page
# header contains only bare integers -- a year, a page number, a "(Continued)".
_FORMATTED_FIGURE = re.compile(r'\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}\b')


def _strip_continuation_header(page):
    """Drop a continuation page's repeated title and column-header block.

    ⚠⚠ WITHOUT THIS, JOINING PAGES INVENTS ROWS. Brown County repeats
    `BROWN COUNTY / STATEMENT OF REVENUES, EXPENDITURES ... / For the Year Ended
    December 31, 2024 / (Continued)` and its whole column-header block at the
    top of every continuation page. Fed into the row parser those became data:
    a row literally named `... For the Year Ended December` worth **31**, and a
    second welding the entire column header onto the first real label,
    `General Road and Bridge Debt Service ... Funds Director of Equalization`
    worth 530,277.

    That is worse than a missing row -- it is a FABRICATED one, and it is the
    reason a multi-page join cannot simply concatenate.

    The cut rule keys on the first line carrying a FORMATTED figure (comma
    groups or cents). Headers hold only bare integers -- years, page numbers --
    so the boundary is unambiguous, and nothing before it on a continuation page
    is ever a data row.
    """
    lines = page.split('\n')
    for i, ln in enumerate(lines):
        if _FORMATTED_FIGURE.search(ln):
            return '\n'.join(lines[i:])
    return ''


def find_statement_span(pages, cfg):
    """(start_index, joined_text) for a statement that SPANS SEVERAL PAGES.

    Knight session 8, opt-in via `CityConfig.multipage`. Two entities in that
    session print a governmental-funds statement across more than one page, and
    `find_statement_page` rejects both outright because it requires a revenue
    total AND `total expenditures` on the SAME page:

        City of Aberdeen SD   p26 revenues + `Total revenues`
                              p27 expenditures + `Total expenditures`
        Brown County SD       p18-p19 revenues, p20-p21 expenditures
                              (p20 repeats the title with "(Continued)")

    ⚠⚠ THE JOIN IS BOUNDED ON EVERY SIDE, because a runaway join would weld a
    LATER statement's rows onto this one and still tie against whichever total
    it happened to find:

      1. It starts only at a page `find_statement_page`'s own tests would
         accept apart from the both-totals rule -- title/anchor match, `general`
         and `fund` present, and NOT excluded by `_EXCLUDE`.
      2. It stops the moment the accumulated text holds BOTH a revenue total and
         `total expenditures`. It never absorbs a page it does not need.
      3. It refuses to cross into any page `_EXCLUDE` rejects. That is what
         stops Brown County at p21: p22 is `STATEMENT OF NET POSITION`, and
         `net position` is already an `_EXCLUDE` term.
      4. It is capped at `multipage_max` pages (default 6).
      5. If it runs out of pages without both totals it returns (None, None) --
         a partial join is never returned. A gate that can measure nothing must
         fail, not pass.
    """
    anchor = re.compile(cfg.statement_anchor, re.I | re.M) if cfg.statement_anchor else None
    for i, pg in enumerate(pages):
        low = pg.lower()
        if not (_TITLE.search(pg) or (anchor and anchor.search(pg))):
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in low for x in _EXCLUDE if x not in cfg.exclude_ignore):
            continue
        joined = pg
        for j in range(i + 1, min(i + cfg.multipage_max, len(pages))):
            jl = joined.lower()
            if (any(lbl in jl for lbl in cfg.revenue_total_labels)
                    and 'total expenditures' in jl):
                break
            nxt = pages[j]
            if any(x in nxt.lower() for x in _EXCLUDE if x not in cfg.exclude_ignore):
                break
            joined = joined + '\n' + _strip_continuation_header(nxt)
        jl = joined.lower()
        if (any(lbl in jl for lbl in cfg.revenue_total_labels)
                and 'total expenditures' in jl):
            return i, joined
    return None, None


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


def target_cell_is_dash_zero(line, col_anchors, cfg):
    """True when `line`'s TARGET (General Fund) cell is an explicit DASH
    PLACEHOLDER -- an empty cell the issuer wrote as `-` -- rather than a
    printed number.

    Trap 6 -- a SECTION HEADING carrying a stray dash-zero in the target
    column. `classify` reports both shapes below identically, as
    ('data', label, 0):

        Debt service                        -            <- heading, dash-zero
        Debt service                       12,500        <- valued root leaf

    They are NOT the same row. `build_operating` needs to tell them apart to
    decide whether a `parents`-matched label opens a group or is a leaf, and
    a bare `val == 0` test cannot: a genuine printed `0` in the target column
    also arrives as ('data', label, 0), and a real printed zero is a VALUE,
    not an empty cell. This predicate answers only the narrow question "is
    the target cell a dash placeholder", leaving that decision to the caller.

    CONFIRMED LIVE (Kitsap County FY2011, FY2012 and FY2013): the
    governmental-funds statement's `Debt service` heading line -- which
    `pdftotext -lineprinter` shows at the ROOT indent, alongside `Current:`
    and `Capital outlay`, with `Principal` and `Interest and other charges`
    indented under it -- carries a lone `-` in the General Fund column.
    Without this distinction the heading was read as a valued $0 leaf, was
    dropped into `zero_rows`, never opened its group, and FY2013's
    `Interest and other charges` ($416) fell to whatever parent was still
    open (`Current`). 17 of Kitsap's 18 loaded years file it correctly;
    FY2011/FY2012 escaped mis-attribution only because their debt-service
    children happen to be $0 too. MONEY IS UNAFFECTED either way -- the $416
    is counted exactly once and the tie stays $0 -- so this is a tree-SHAPE
    defect that no arithmetic gate can catch.

    Both column strategies are handled, because the dash placeholder is what
    makes an empty cell VISIBLE and either reader can meet one:
      * no money tokens anywhere on the line -> the row is a label followed
        only by dashes, so the target cell is a dash by construction (this
        is the shape all three confirmed Kitsap years take);
      * 'ordinal' -> the FIRST column slot must itself be a dash-run;
      * 'positional' -> no money token may resolve to column 0 (else the
        cell holds a number), and some dash-run must resolve to column 0.
    """
    line = _recover_label_past_leading_page_number(line)
    line = _recover_label_past_leading_rule(line)
    if not nums_with_pos(line):
        return dash_zero_label(line) is not None
    if cfg.column_strategy == 'ordinal':
        m = _slot_re().search(line)
        return bool(m) and _DASH_ONLY.match(m.group().strip()) is not None
    if not col_anchors or gf_value(line, col_anchors) is not None:
        return False
    for m in _slot_re().finditer(line):
        if not _DASH_ONLY.match(m.group().strip()):
            continue
        col = min(range(len(col_anchors)), key=lambda k: abs(m.end() - col_anchors[k]))
        if col == 0:
            return True
    return False


# ── Row classification ───────────────────────────────────────────────────────
def classify(line, col_anchors, cfg):
    """('data'|'wrapped'|'skip', label, value).

    A row whose GF cell is blank but which HAS numbers in other columns is
    'data' with value 0 — the source genuinely reports $0 for the General Fund
    (trap 1).

    A genuinely blank line, a rule/underline row, or any other line with NO
    money tokens at all is still skipped quietly, exactly as before --
    see the `not nums_with_pos(line)` branch below, which this fix does not
    touch. That is a DIFFERENT case from the one below it.

    Trap 5 -- silently dropping a row that HAS a real General Fund value.
    Before a row's value/label are read, a leading page-footer PAGE NUMBER is
    stripped if present (`_recover_label_past_leading_page_number`), which
    fixes the known cause (see that function's docstring). But if a row
    STILL carries a real GF value (`gv is not None`, i.e. `column_value`
    successfully read one) and STILL resolves to no usable label after that
    repair, this now RAISES instead of silently discarding the row -- a
    row with a real value is never allowed to vanish without a trace again.
    This is deliberately narrower than "any row with numbers but no label":
    the `gv is None` case just below it (numbers exist elsewhere on the row,
    but the General Fund cell itself is genuinely blank) is UNCHANGED and
    still returns 'skip' when unlabeled, because that shape is the
    ordinary, already-safe "other funds have money, GF does not" case ten
    shipped entities already rely on -- widening the loud-failure to cover
    it too would risk crashing entities that currently extract correctly."""
    if not line.strip():
        return 'skip', '', None

    line = _recover_label_past_leading_page_number(line)
    line = _recover_label_past_leading_rule(line)

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
    if not lbl:
        raise ValueError(
            'acfrGF.classify: row has a General Fund value (%r) but no usable '
            'label (even after checking for a leading page-number token) -- '
            'refusing to silently drop it. Offending line: %r' % (gv, line))
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
# ⚠ `CityConfig.revenue_section_header` defaults to the LITERAL 'revenues'
# because a default argument is evaluated where the function is defined, which
# is above this line. Kept honest by an assertion rather than a comment alone.
assert _SEC_REVENUES == 'revenues', (
    'CityConfig.revenue_section_header duplicates this literal as its default; '
    'change both or neither.')
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


_CHART_CODE = re.compile(r'^(\d{3}(?:\.\d{1,2})?)\b')


def _chart_member(group_label, row_label):
    """Is `row_label`'s account code inside `group_label`'s, per the issuer's
    numeric chart of accounts? Used only by revenue_group_close='numeric_chart'.

        330 Intergovernmental revenue  <- 331, 334, 335, 336, 338  ✓
                                       <- 340 Charges for goods    ✗
        335 State shared revenue       <- 335.01 .. 335.08         ✓
                                       <- 336 State payments       ✗

    A decimal heading (`335`) owns exactly the codes that extend it with a dot.
    A round heading (`330`) owns the codes sharing its first two digits. Either
    label lacking a leading code means the rule cannot decide, and it returns
    False -- closing the group rather than guessing it stays open.
    """
    g = _CHART_CODE.match(group_label.strip())
    r = _CHART_CODE.match(row_label.strip())
    if not g or not r:
        return False
    gc, rc = g.group(1), r.group(1)
    if rc.startswith(gc + '.'):
        return True
    if '.' in gc:
        return False
    return gc.endswith('0') and rc[:2] == gc[:2] and rc != gc


def build_revenue(lines, col_anchors, cfg):
    """GF revenue-by-source tree. Flat unless cfg.revenue_parents groups it.
    $0 sources are recorded in zero_rows and dropped."""
    root_children, zero_rows = [], []
    parent = None
    subparent = None
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
    for l in _section(lines, cfg.revenue_section_header, end_revenues, cfg.section_header_mode):
        kind, lbl, val = classify(l, col_anchors, cfg)
        low = (lbl or '').lower()

        if kind == 'wrapped' and low in cfg.revenue_parents:
            parent = {'n': lbl, 'a': 0, 'c': []}
            subparent = None
            parent_seen = False
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'wrapped' and low in cfg.revenue_subparents and parent is not None:
            subparent = {'n': lbl, 'a': 0, 'c': []}
            parent['c'].append(subparent)
            pending = ''
            continue
        # Trap 6, on the REVENUE side. `build_operating` has had this branch since
        # Kitsap FY2011-FY2013; this section did not, and Kent FY2024 is the same
        # shape: p.41 prints a lone `-` in the General Fund column on the
        # `Intergovernmental revenue` HEADING row, so it arrives as ('data',
        # label, 0) rather than 'wrapped', the group never opens, and -- because
        # the heading is not one of its own `revenue_group_members` -- it also
        # CLOSED the previous group. Federal grants, State grants, State shared
        # revenues and Other governments then stood as four ROOT categories
        # against the four children every neighbouring year prints. Same dollars,
        # same $0 tie, wrong shape.
        #
        # Gated exactly as the operating one is: the label must match a configured
        # `revenue_parents` entry AND the General Fund cell must be an explicit
        # dash placeholder, so a valued row whose name happens to match a parent
        # stays a leaf.
        if (kind == 'data' and val == 0 and low in cfg.revenue_parents
                and target_cell_is_dash_zero(l, col_anchors, cfg)):
            parent = {'n': lbl, 'a': 0, 'c': []}
            parent_seen = False
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            # A declared line item printed empty in every column -- not a label
            # fragment. See CityConfig.empty_rows for what welding these cost.
            if low in cfg.empty_rows:
                zero_rows.append(lbl)
                pending = ''
                continue
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
        flow = full.lower()
        if cfg.revenue_group_close == 'numeric_chart':
            # ⚠⚠ MEMBERSHIP BY THE ISSUER'S OWN CHART OF ACCOUNTS (opt-in).
            #
            # Aberdeen SD prints a standard South Dakota municipal chart in
            # which the group heading is a round code and its members share the
            # heading's first two digits: `330 Intergovernmental revenue` holds
            # 331, 334, 335, 336 and 338; `310 Taxes` holds 311-319.
            #
            # A suffix-based `revenue_group_members` cannot express this -- the
            # six children of `310 Taxes` end in "taxes", "taxes", "tax deed
            # revenue" and "delinquent taxes", sharing no usable suffix -- and a
            # GLOBAL prefix list cannot either, because `340 Charges...` must
            # CLOSE 330 while `335.01` must stay inside it. Membership has to be
            # relative to the OPEN group's own code, which is what this does.
            #
            # It reads the rule off the issuer's published numbering rather than
            # inventing one, and it is confined to entities that declare it.
            if parent is not None and parent_seen:
                if not _chart_member(parent['n'], full):
                    parent = None
                    subparent = None
            if subparent is not None and not _chart_member(subparent['n'], full):
                subparent = None
        elif cfg.revenue_group_close == 'next_heading':
            # Groups persist until another DECLARED heading opens one. Correct
            # where the issuer's revenue sections are exhaustive -- Brown County
            # prints `Taxes:`, `Intergovernmental Revenue:` (with a `State
            # Shared Revenue:` sub-heading), `Charges for Goods and Services:`,
            # `Fines and Forfeits:` and `Miscellaneous Revenue:`, and every
            # revenue line sits under one of them.
            pass
        elif parent is not None and parent_seen and not any(
                low.endswith(sfx) for sfx in cfg.revenue_group_members):
            parent = None
            subparent = None
        if parent is not None:
            parent_seen = True

        if val == 0:
            zero_rows.append(full)
            continue

        node = {'n': full, 'a': val}
        if subparent is not None:
            subparent['c'].append(node)
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    def _rollup(n):
        if 'c' in n:
            for ch in n['c']:
                _rollup(ch)
            n['c'] = [ch for ch in n['c'] if ch.get('c') or 'c' not in ch]
            n['a'] = sum(ch['a'] for ch in n['c'])
    for n in root_children:
        _rollup(n)
    root_children = [n for n in root_children if n.get('c') or 'c' not in n]

    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': root_children}, total, zero_rows


def build_operating(lines, col_anchors, cfg):
    """2-level GF expenditure-by-function tree. Parents named in cfg.parents are
    label-only headers whose value is the sum of their children. Capital-outlay
    placement is governed by cfg.capital_at_root (trap 3)."""
    root_children, zero_rows = [], []
    parent = None
    # ⚠ The THIRD level (opt-in, cfg.subparents). Brown County SD prints
    # `Public Safety:` -> `Law Enforcement:` -> `Sheriff`; with a two-level
    # reader every one of those grandchildren flattens up into Public Safety.
    # `subparent` is closed by: a new parent, a root leaf, a printed subtotal,
    # or a row whose label matches none of `subparent_member_prefixes`.
    subparent = None
    subtotal_failures = []
    pending = ''
    for l in _section(lines, _SEC_EXPENDITURES, _END_EXPENDITURES, cfg.section_header_mode):
        if not l.strip():
            continue
        kind, lbl, val = classify(l, col_anchors, cfg)
        low = (lbl or '').lower()

        if kind == 'wrapped' and low in cfg.parents:
            parent = {'n': lbl, 'a': 0, 'c': []}
            subparent = None
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'wrapped' and low in cfg.subparents and parent is not None:
            subparent = {'n': lbl, 'a': 0, 'c': []}
            parent['c'].append(subparent)
            pending = ''
            continue
        # Trap 6 -- a `parents`-matched SECTION HEADING carrying a stray
        # dash-zero in the General Fund column. Such a line reaches
        # `classify` as ('data', label, 0), indistinguishable by value alone
        # from a valued $0 leaf, so without this branch the heading is
        # dropped into `zero_rows`, its group never opens, and every child
        # under it falls to whichever parent is still open. Confirmed live on
        # Kitsap County FY2011/FY2012/FY2013 -- see
        # `target_cell_is_dash_zero`'s docstring for the page geometry that
        # settles it and for why the tie gate cannot catch it.
        #
        # DELIBERATELY NARROW, and both halves of the condition matter:
        #   * the label must match a CONFIGURED `parents` entry, so a
        #     dash-zero row that is not a configured heading (Kitsap's
        #     Transportation, Health & Human Services, Economic Environment,
        #     Principal ...) still goes to `zero_rows` exactly as before;
        #   * the target cell must be an explicit DASH placeholder, so a
        #     `parents`-matched label carrying a REAL value stays a leaf --
        #     which is what keeps Hillsboro's valued `Debt service` root leaf
        #     and every other shipped entity unmoved.
        if (kind == 'data' and val == 0 and low in cfg.parents
                and target_cell_is_dash_zero(l, col_anchors, cfg)):
            parent = {'n': lbl, 'a': 0, 'c': []}
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            # A declared line item printed empty in every column. Kent FY2005 and
            # FY2009 print `Issuance costs` under `Debt service:` with nothing in
            # any column; welded forward it became `Issuance costs Capital outlay`,
            # which no longer matched `root_leaves` and so moved $193,673 of
            # capital spending into the debt-service subtotal.
            if low in cfg.empty_rows:
                zero_rows.append(lbl)
                pending = ''
                continue
            pending = norm_label('%s %s' % (pending, lbl))
            continue

        full = _fix_label(norm_label('%s %s' % (pending, lbl)) if pending else lbl, cfg)
        pending = ''
        if not full:
            continue
        flow = full.lower()

        # ⚠⚠ A PRINTED GROUP SUBTOTAL (opt-in, cfg.subtotal_prefixes).
        # Aberdeen prints `Total general government`, `Total public safety`,
        # `Total public works` ... after each numbered group. Loaded as leaves
        # they DOUBLE-COUNT the whole statement; skipped silently they are a
        # wasted oracle. So they are neither: each one is CHECKED against the
        # sum of the group it closes, and a mismatch fails the extraction.
        # This is the campaign's own rule -- assert every subtotal against its
        # OWN leaves, not just the grand total -- enforced by the parser.
        if cfg.subtotal_prefixes and any(flow.startswith(p) for p in cfg.subtotal_prefixes):
            group = subparent if subparent is not None else parent
            if group is not None:
                got = sum(ch['a'] for ch in group['c'])
                if val != got:
                    subtotal_failures.append((full, val, got))
            subparent = None
            parent = None
            continue

        if val == 0:
            zero_rows.append(full)
            continue

        node = {'n': full, 'a': val}
        if any(flow.startswith(pfx) for pfx in cfg.root_leaves):
            root_children.append(node)   # root-level peer; closes both levels
            parent = None
            subparent = None
        elif subparent is not None:
            # 'next_heading': every row belongs to the sub-group until another
            #   DECLARED heading (parent, subparent, root leaf or subtotal)
            #   closes it. Correct where sub-groups are exhaustive, as in Brown
            #   County's chart -- every leaf there sits under some sub-heading.
            # 'members': the row stays only while its label matches a declared
            #   prefix; otherwise the sub-group closes and the row belongs to
            #   the PARENT, not to the root.
            if (cfg.subparent_close == 'next_heading'
                    or any(flow.startswith(pfx) for pfx in cfg.subparent_member_prefixes)):
                subparent['c'].append(node)
            else:
                subparent = None
                parent['c'].append(node)
        elif parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    # Roll up innermost-first so a three-level tree totals correctly.
    def _rollup(n):
        if 'c' in n:
            for ch in n['c']:
                _rollup(ch)
            n['c'] = [ch for ch in n['c'] if ch.get('c') or 'c' not in ch]
            n['a'] = sum(ch['a'] for ch in n['c'])
    for n in root_children:
        _rollup(n)
    # Drop parents left childless by all-$0 children (an honest absence, e.g. a
    # year with no General Fund debt service).
    root_children = [n for n in root_children if n.get('c') or 'c' not in n]

    if subtotal_failures:
        # ⚠ A printed subtotal disagreeing with its own children means the group
        # was mis-assembled. Refuse loudly -- the grand total can still tie while
        # rows sit under the wrong parent.
        for name, printed, got in subtotal_failures:
            print('  SUBTOTAL FAILURE: %s printed %s but its children sum to %s (delta %s)'
                  % (name, f'{printed:,}', f'{got:,}', f'{got - printed:+,}'), file=sys.stderr)
        sys.exit(1)

    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Expenditure by Function', 'a': total, 'c': root_children}, total, zero_rows


# ── Orchestration ────────────────────────────────────────────────────────────
# ── OCR whitespace repair (opt-in) ────────────────────────────────────────────
#
# Knight session 8. City of Biloxi's post-FY2020 filings are scans, and their
# OCR splits thousands groups with a single space: `4, 363 ,800`, `20,034, 199`,
# `77, 153,727`. Every publisher's copy is the same scan (FAC, the city's own
# site, and the MS State Auditor), so there is no cleaner copy to prefer.
#
# ⚠⚠ THE SAFETY ARGUMENT, WHICH IS THE WHOLE POINT:
#
#   1. It repairs ONLY a comma adjacent to EXACTLY ONE space. `pdftotext -table`
#      separates COLUMNS with runs of two or more spaces, so a single space can
#      never be a column boundary. A two-space gap is left untouched.
#   2. It requires a digit on one side and a full three-digit group on the
#      other, so it can only ever close a thousands separator.
#   3. IT NEVER INVENTS, DELETES OR ALTERS A DIGIT -- it only removes a space.
#      `4, 363 ,800` -> `4,363,800` is the same digits in the same order.
#   4. It cannot rescue a LOST digit. `4,973,!09` and `I09,091,141` are left
#      exactly as they are and will fail to parse, so the tie gate still fails
#      loudly on Biloxi FY2024. That is correct: a lost digit is unrecoverable
#      and must not be guessed.
#   5. The TIE GATE independently validates every repair. If a repair joined two
#      figures that were not one figure, the component sum would stop matching
#      the printed total. Nothing here is trusted on its own.
_WS_REPAIR = (
    (re.compile(r'(?<=\d), (?=\d{3}\b)'), ','),   # `20,034, 199` -> `20,034,199`
    (re.compile(r'(?<=\d) ,(?=\d{3}\b)'), ','),   # `77 ,153,727` -> `77,153,727`
)


def repair_ocr_whitespace(text):
    """Close single-space-split thousands groups. Digits are never changed."""
    for rx, repl in _WS_REPAIR:
        text = rx.sub(repl, text)
    return text


def _to_dollars(cents):
    """Exact cents -> dollars, half-up, sign-symmetric. Never floats."""
    if cents is None:
        return None
    neg = cents < 0
    v = (abs(cents) + 50) // 100
    return -v if neg else v


def _tree_to_dollars(node):
    node['a'] = _to_dollars(node['a'])
    for child in node.get('c', []):
        _tree_to_dollars(child)


def extract(pdf_path, mode, cfg):
    global _DECIMAL_MONEY, _LEADING_CODE
    # Set from cfg on EVERY call so a previous entity's mode cannot leak.
    _DECIMAL_MONEY = cfg.decimal_money
    _LEADING_CODE = cfg.leading_account_code
    pages = table_pages(pdf_path)
    if cfg.whitespace_repair:
        pages = [repair_ocr_whitespace(p) for p in pages]
    if cfg.multipage:
        pi, pg = find_statement_span(pages, cfg)
    else:
        pi, pg = find_statement_page(pages, cfg.statement_anchor, cfg.revenue_total_labels,
                                     cfg.exclude_ignore)
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
    # ⚠⚠ A MULTI-PAGE STATEMENT CAN CHANGE COLUMN GEOMETRY BETWEEN ITS PAGES.
    # Brown County FY2024 prints `Total Revenues` with the General Fund column
    # near character 40 on p19 and `Total Expenditures` near character 60 on
    # p21. One shared anchor set therefore misreads whichever section it was not
    # derived from -- observed as printed_total == 0 on the expenditure side and
    # a -13m to -17m revenue delta. Each section is anchored on ITS OWN total
    # row instead, and only for multipage entities, so every single-page entity
    # keeps the previous `max(...)` behaviour byte-for-byte.
    if cfg.multipage:
        rev_anchors, exp_anchors = anchors(rev_line), anchors(exp_line)
        if len(rev_anchors) < 2:
            rev_anchors = exp_anchors
        if len(exp_anchors) < 2:
            exp_anchors = rev_anchors
        col_anchors = rev_anchors if mode == 'revenue' else exp_anchors
    else:
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
    # ⚠ The tie above was checked in EXACT CENTS. Convert only now, and only
    # once, so no rounding can ever reach the arithmetic that proves the read.
    # `tie_delta_cents` is retained because a decimal entity's registered
    # `source_rounding` deltas live in the cents domain, not the dollar one.
    if _DECIMAL_MONEY:
        result['tie_delta_cents'] = tie_delta
        result['money_domain'] = 'cents_verified_dollars_emitted'
        _tree_to_dollars(result['tree'])
        result['computed_total'] = _to_dollars(computed)
        result['printed_total'] = _to_dollars(printed)
        result['tie_delta'] = _to_dollars(tie_delta)
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
