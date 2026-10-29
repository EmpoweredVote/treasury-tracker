#!/usr/bin/env python3
"""
Alaska's organized boroughs — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`), holding one
`CityConfig` per borough and selected with `--entity`.

⚠ WHY ONE FILE AND NOT TWELVE. The repo's convention is one wrapper per entity
(`extractWichitaKS.py`, `extractBoulderCO.py`, ...), and that convention earns
its keep when each entity's document is genuinely different. These twelve are a
single cohort — same state, same statement, same fiscal year end, all fetched
through one route — and twelve files would be twelve copies of the same twelve
lines. The per-entity FACTS still live in their own CONFIGS entry with their own
comments, which is what the convention actually protects.

── ⚠⚠ EVERY BOROUGH PRINTS A PRIOR-YEAR SUMMARIZED COLUMN ─────────────────

Kodiak's FY2024 statement is captioned "(With summarized financial information
for the year ended June 30, 2023)" and prints a 2023 column as the LAST column
of the table. Several of these boroughs do the same.

The General Fund is column 0 and `target_column` is left at its default 0, so
this parser is unaffected — but a future total-governmental read of these
documents MUST NOT assume last-column-is-total, or it will silently load the
PRIOR YEAR. The same trap bit the Anchorage FY2012-era statements.

── ⚠ UNITS: WHOLE DOLLARS FOR ALL SIX ─────────────────────────────────────

No statement page in this cohort carries an "in thousands" caption, and the
printed figures are whole dollars (Kodiak FY2024 General Fund total revenues
10,463,649 for a borough of 12,654). `units=1`, the default.

⚠ Read per entity, never carried: the AK STATE ACFR in this same repo IS in
thousands. The tie gate is structurally blind to a units error — the loader's
per-capita guard is what catches it.

── FISCAL YEAR: ALL SIX END JUNE 30 ──────────────────────────────────────

Confirmed by `fy_end_date` on all 60 FAC filings. ⚠⚠ Anchorage, in this same
`ak-local-acfr-gf` family, ends DECEMBER 31 — never carry the month across.

Usage:
  python scripts/extractAkBorough.py --entity kodiak path/to.pdf --mode revenue
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, extract  # noqa: E402

JUNE_30 = ('June', 30)

# ── DOCUMENT GAPS — published, audited, and NOT EXTRACTABLE ────────────────
#
# Keyed (entity, fiscal_year, mode); `None` as the mode means both sides. Each
# entry records the CAUSE. These are reported at load time and NEVER written as
# $0 — the Sedgwick County FY2019 precedent, where a born-digital document
# simply would not yield its numbers.
#
# ⚠⚠ Mat-Su was checked against a SECOND PUBLISHER before being declared lost:
# the borough's own matsugov.us copies (FY22 doc id 24094, FY23 id 24097) carry
# the IDENTICAL collapse, so the damage is in the document as issued rather than
# in the Federal Audit Clearinghouse's copy. Quality is a property of the COPY,
# and here both copies are the same.
KNOWN_DOCUMENT_GAPS = {
    ('matsu', 2022, None):
        "`pdftotext -table` cannot resolve the column grid: the row renders as "
        "`Principal - - - 16,635,000 167,750- - ...` with no column geometry, so "
        "every row whose General Fund cell is a DASH takes the next fund's "
        "figure. Verified identical in the borough's own matsugov.us copy.",
    ('matsu', 2023, None):
        "Same column-grid collapse as FY2022 (`Principal - -173,933 -- - ...`). "
        "The General Fund TOTAL reads correctly and `Current` sums to it exactly, "
        "but the debt-service rows take a later fund's figures. Verified "
        "identical in the borough's own matsugov.us copy.",
    ('fnsb', 2018, 'revenue'):
        "The `Revenues` section-header line ABSORBS the first data row's value — "
        "it prints `Revenues  $108,870,262` with `Taxes` on the next line carrying "
        "nothing — so the header cannot match and the revenue tree comes back "
        "empty. The EXPENDITURE side of the same page is unaffected and loads.",
    ('fnsb', 2019, None):
        "The statement page's label column and numeric columns occupy SEPARATE "
        "text blocks (the Charlotte defect): `Revenues total` and `Expenditures "
        "total` appear in a whole-document extraction with no adjacent numbers, "
        "and no single page yields them at all. 1,250 chars/page, so the text "
        "layer is dense — this is a layout defect, not a scan.",
    # ⚠⚠ THE MOST DANGEROUS DEFECT IN THIS COHORT, AND THE DENSITY GUARD
    # PASSES IT. Sitka's FY2018 filing has a CIPHERED TEXT LAYER: the embedded
    # fonts carry a broken ToUnicode map, so every glyph extracts as a wrong
    # character on all 177 pages. The word `Sitka` appears ZERO times in a
    # whole-document extraction of a document whose own PDF title is
    # "Formatted City and Bor...heets and CAFR Footnotes FY2018".
    #
    # It reads at ~1,900 chars/page, so `fetchAkBoroughs.mjs`'s image-scan
    # guard (<400 c/p) sees a healthy text layer. The AUDITEE IDENTITY guard is
    # what caught it, which is the reason that guard exists: a ciphered page
    # yields spurious NUMBERS, not an empty tree.
    #
    # ⚠ The borough's own copy was checked, per the Mat-Su precedent, and is
    # unreachable: cityofsitka.com sits behind an Akamai WAF that returns 403
    # to every non-browser client, including full browser headers.
    ('sitka', 2018, None):
        "Ciphered text layer — the PDF's embedded fonts have a broken ToUnicode "
        "map, so all 177 pages extract as wrong characters at a healthy ~1,900 "
        "chars/page. Caught by the fetcher's auditee-identity guard, not by its "
        "density guard. The borough's own copy is behind an Akamai WAF (403).",
    # ⚠⚠ TWO MORE OF THE SAME DEFECT, FOUND IN WAVE 2. That makes THREE ciphered
    # text layers in the Alaska corpus, and they do not share a year, an issuer
    # or an auditor.
    #
    # ⚠⚠⚠ PDF PRODUCER METADATA DOES NOT PREDICT THEM, and it looks as though it
    # should: all three are `PScript5.dll` + `Acrobat Distiller`. So are clean
    # files — Sitka FY2019 carries the IDENTICAL producer string to its own
    # ciphered FY2018 and extracts perfectly. A producer-based detector would be
    # false on both sides. The fetcher's AUDITEE-IDENTITY guard remains the only
    # reliable one, which is precisely why it reads the document's own text
    # rather than trusting the index.
    ('bristolbay', 2024, None):
        "Ciphered text layer — 119 pages at ~1,750 chars/page in which the word "
        "`Bristol` appears ZERO times. The density guard passes it; the "
        "auditee-identity guard rejected it, so no PDF is on disk.",
    ('yakutat', 2018, None):
        "Ciphered text layer — 99 pages at ~1,650 chars/page in which `Yakutat` "
        "appears ZERO times, though the PDF's own title is \"City and Borough of "
        "Yakutat 18 Final (s).pdf\". The density guard passes it; the "
        "auditee-identity guard rejected it, so no PDF is on disk.",
}

CONFIGS = {
    # Mat-Su prints `Current:` and `Debt service` as parents and `Capital
    # outlay` as a valued root leaf beside them. Its General Fund column is a
    # dash for both debt service and capital outlay, so `Current` is the only
    # root that survives — confirmed against the printed page, not inferred.
    'matsu': CityConfig(
        city='Matanuska-Susitna Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        fy_end=JUNE_30,
    ),

    # ⚠⚠ FAIRBANKS PRINTS ITS TOTAL ROWS WITH THE WORDS REVERSED —
    # `Revenues total` and `Expenditures total`, not `Total revenues` /
    # `Total expenditures`. The expenditure side was a hard literal at five
    # sites in acfrGF.py until this entity; see that module's
    # `expenditure_total_labels` note. With the literal in place this borough's
    # statement page could not be found AT ALL — a loud failure, not a wrong
    # tree, which is the design working.
    #
    # ⚠ `Principle retirement` is the ISSUER'S SPELLING. Loaded as published;
    # correcting it here would be inferring intent.
    'fnsb': CityConfig(
        city='Fairbanks North Star Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        # ⚠ BOTH WORD ORDERS, because the borough changed its own wording
        # mid-series: FY2016-2018 and FY2020+ print `Revenues total` /
        # `Expenditures total`, while other years print the conventional
        # `Total revenues` / `Total expenditures`. Declaring only the reversed
        # pair left the conventional years with no findable statement page.
        revenue_total_labels=('revenues total', 'total revenues'),
        expenditure_total_labels=('expenditures total', 'total expenditures'),
        # ⚠⚠ FY2017 SPLITS A NUMBER: the Education row prints `54, 169,000`,
        # with a space after the comma, so the parser read 169,000 and dropped
        # the leading 54 — a silent $54,000,000 understatement that the tie gate
        # caught as an exact -54,000,000 delta. `repair_ocr_whitespace` closes
        # the split.
        whitespace_repair=True,
        # ⚠⚠ AND IT PRINTS NO `Expenditures` CAPTION AT ALL — the statement runs
        # straight from `Revenues total` into `Current`. Without this the
        # expenditure section matched NOTHING: the tree came back empty while
        # the printed total was still found, so the tie gate failed loudly at
        # the full -107,678,872 rather than shipping a wrong shape. Same loud
        # failure Boulder County's singular `Revenue` header produced.
        expenditures_follow_revenue_total=True,
        # ── The borough's own statements disagree with themselves by $1–$2 ──
        #
        # ⚠ EXACT deltas, never a tolerance. Each is the issuer's own printed
        # total disagreeing with the sum of its own printed components in the
        # General Fund column, verified row by row off the page.
        #
        # ⭐ The borough's OWN `Excess (deficiency) of revenues over
        # expenditures` row is the arbiter, and on FY2020, FY2021, FY2023 and
        # FY2024 it AGREES WITH THE COMPONENT SUM rather than with the printed
        # total — the statement's own arithmetic says the components are right
        # and the total cell is off. FY2024 is the clearest case:
        #     printed revenues 143,693,622 − printed expenditures 107,678,872
        #       = 36,014,750, but the printed excess row reads 36,014,751;
        #     143,693,622 − COMPONENT SUM 107,678,871 = 36,014,751 exactly.
        #
        # The emitted tree total is always the COMPONENT SUM, never the printed
        # total, so every loaded row still ties against its own line items.
        #
        # ⚠⚠ FY2018 REVENUE IS DELIBERATELY NOT HERE. Its delta is the full
        # printed total (−129,635,826) because the tree comes back EMPTY — a
        # document defect, not a rounding artifact — and it is declared a GAP
        # instead. Registering it here would paper over a missing read, which is
        # the one thing this mechanism must never be used for.
        source_rounding={
            (2016, 'revenue'): 1,
            (2016, 'operating'): 1,
            (2017, 'revenue'): -1,
            (2018, 'operating'): 2,
            (2020, 'revenue'): 1,
            (2021, 'revenue'): -1,
            (2022, 'operating'): -1,
            (2023, 'revenue'): 1,
            (2023, 'operating'): -1,
            (2024, 'operating'): -1,
        },
        fy_end=JUNE_30,
    ),

    # ⚠ Kenai prints NO `Current:` heading — its functions sit at ROOT level,
    # with only `Debt service:` as a parent. The same shape Anchorage used
    # before FY2017. Its revenue side DOES group, under `Intergovernmental:`
    # with children `Federal` and `State`.
    # ⚠⚠ `ordinal`, NOT the default `positional`. FY2019 renders two of its
    # General Fund cells at a different x-position from every other row on the
    # same page — `Other revenues 797,852` and `Public safety 705,112` sit about
    # 26 characters right of the column the Total rows anchor. A positional
    # reader cannot see them, and dropped EXACTLY those two amounts: the tie
    # gate failed at -797,852 and -705,112, naming the missing cells to the
    # dollar. `ordinal` counts token slots instead of measuring positions and
    # reads all ten years at $0, so this is a strategy change that FIXES one
    # year and leaves the other nine byte-identical (verified both ways).
    'kpb': CityConfig(
        city='Kenai Peninsula Borough, AK',
        parents=('debt service',),
        root_leaves=(),
        revenue_parents=('intergovernmental',),
        revenue_group_members=('federal', 'state'),
        column_strategy='ordinal',
        fy_end=JUNE_30,
    ),

    # ⚠ Juneau also prints no `Current:` heading, and its root leaf is
    # `Capital projects`, NOT `Capital outlay` — a config copied from a sibling
    # borough would leave that row to reparent silently onto Debt service
    # WHILE THE STATEMENT STILL TIED AT $0. Failure mode 2 from the extractor
    # howto, live in this cohort.
    #
    # ⚠ `State sources` and `Federal sources` sit at ROOT here, unlike Kodiak
    # and Kenai where they nest under an intergovernmental heading, so
    # `revenue_parents` is deliberately empty.
    # ⚠⚠ AND FY2016-FY2020 LETTER-SPACE THE SECTION HEADER: the statement
    # prints `REV ENUES`, not `REVENUES`, so the revenue section matched
    # NOTHING and the tree came back empty while the printed total was still
    # found — five years failing loudly at the full printed total.
    # `whitespace_repair` is what closes the split glyphs. FY2021+ print the
    # header normally and are byte-identical with the repair on.
    'juneau': CityConfig(
        city='City and Borough of Juneau, AK',
        parents=('debt service',),
        root_leaves=('capital projects',),
        # ⚠ The split header also carries the FUND COLUMN NAMES on the same
        # line (`REV ENUES   General   Sales Tax`), which is what `prefix` mode
        # exists for. Both facts are needed together: `exact` de-spaces but
        # rejects the trailing column names, `prefix` tolerates them but, until
        # this entity, matched the raw line and so could not see through the
        # letter-spacing. See `_is_section_header` in acfrGF.py.
        section_header_mode='prefix',
        fy_end=JUNE_30,
    ),

    # Ketchikan Gateway is the plainest of the six: `Current:` and
    # `Debt Service:` as parents, `Capital Outlay` as a valued root leaf.
    'kgb': CityConfig(
        city='Ketchikan Gateway Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        fy_end=JUNE_30,
    ),

    # Kodiak groups its two intergovernmental sources under a heading, and
    # prints `Capital outlay:` as a PARENT with children (Schools / General)
    # rather than as a valued root leaf — the Hillsboro shape, inverted from
    # Anchorage's.
    'kodiak': CityConfig(
        city='Kodiak Island Borough, AK',
        parents=('current', 'capital outlay', 'debt service'),
        root_leaves=(),
        revenue_parents=('intergovernmental',),
        revenue_group_members=('sources',),
        fy_end=JUNE_30,
    ),

    # ── WAVE 1 ────────────────────────────────────────────────────────────
    #
    # Six more boroughs, added 2026-10-28. Every shape below was read off the
    # printed page with `pdftotext -layout` across ALL of that borough's years,
    # not inferred from one year and not copied from a sibling — the Juneau
    # lesson in this same file is that a borrowed `root_leaves` reparents a real
    # row silently while the statement still ties at $0.

    # ⚠ `Capital projects` (Juneau's spelling), not `Capital outlay`, and
    # FY2016 adds a SECOND root leaf: `Special revenues` sits beside
    # `Capital projects` as a peer of Current/Debt service that year only. Both
    # are dashes in the General Fund column in every year, so neither changes a
    # dollar — they are declared because the alternative is that a year where
    # one DOES carry money files it inside Debt service at a $0 tie.
    # ⚠ Revenue is flat: property taxes, intergovernmental, charges for
    # services, investment earnings, economic impact assistance and other all
    # sit at root with no heading over them.
    'northslope': CityConfig(
        city='North Slope Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital projects', 'special revenues'),
        fy_end=JUNE_30,
    ),

    # ⚠⚠ THE ONLY THREE-LEVEL EXPENDITURE TREE IN ALASKA. Northwest Arctic
    # prints `Education:` as a sub-heading INSIDE `Current:`, with `Payments to
    # School District` (and in FY2016 an `Other`) under it. Without
    # `subparents` those grandchildren flatten up into Current and the
    # Education grouping the borough published disappears — at a $0 tie.
    #
    # ⚠⚠ `capital outlay` IS BOTH A PARENT AND A ROOT LEAF, because this
    # borough prints it both ways in its own series: FY2016 renders
    # `Capital outlay:` as a heading over `Payments to School District` and
    # `Design and construction`, while FY2021 prints `Capital outlay` as a
    # valued row at root. `parents` matches LABEL-ONLY lines and `root_leaves`
    # matches VALUED ones, so declaring both reads each year as printed.
    #
    # ⚠ `revenue_group_close='next_heading'`, not the default `members`: the
    # revenue section is exhaustive — every source sits under `Local sources:`
    # or `Intergovernmental:` — and the members of Local sources share no
    # usable suffix (`Payment in lieu of taxes`, `Borough usage fee`,
    # `Investment income`, `Other`). Brown County's shape.
    'nwarctic': CityConfig(
        city='Northwest Arctic Borough, AK',
        parents=('current', 'debt service', 'capital outlay'),
        root_leaves=('capital outlay',),
        subparents=('education',),
        subparent_member_prefixes=('payments to school district', 'other'),
        # ⚠⚠ `'intergovernmental: .'` IS THE SAME HEADING, DAMAGED. In FY2016 a
        # stray dot sits in the Debt Service column on the heading's own row, so
        # `-table` renders the line as `Intergovernmental:` followed by a lone
        # `.` and the label arrives as `Intergovernmental: .`. Undeclared, the
        # heading is read as a wrapped label and welded onto its first child
        # (`Intergovernmental: . Direct federal sources`), BOTH intergovernmental
        # sources then nest under `Local sources:` — and the revenue tree still
        # ties at $0. The St. Joseph County `Curren t :` shape, in this cohort.
        #
        # ⚠ The MATCH is made against the damaged string, and `label_fixes`
        # decides what the node is CALLED. Two declarations because they answer
        # two questions; see `CityConfig.label_fixes`.
        revenue_parents=('local sources', 'intergovernmental', 'intergovernmental: .'),
        label_fixes={'Intergovernmental: .': 'Intergovernmental'},
        revenue_group_close='next_heading',
        fy_end=JUNE_30,
    ),

    # Plainest of the six: `Current:` and `Debt service:` as parents,
    # `Capital outlay` as a valued root leaf, flat revenue.
    'petersburg': CityConfig(
        city='Petersburg Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        fy_end=JUNE_30,
    ),

    # ⚠ Sitka groups ONLY its tax lines. `Taxes:` opens over `Commercial
    # passenger excise tax`, `Real and personal property`, `Sales and bed` and
    # `Tobacco` (`Tobacco and marijuana` from FY2022), and the group must close
    # on `State sources`, which follows immediately.
    #
    # ⚠⚠ The members share NO common suffix, so each is named. `personal
    # property` is deliberately the suffix rather than `property`: the ungrouped
    # `Uses of property` four rows later would otherwise stay inside the tax
    # group, and the statement would still tie at $0.
    'sitka': CityConfig(
        city='City and Borough of Sitka, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        revenue_parents=('taxes',),
        revenue_group_members=('excise tax', 'personal property', 'sales and bed',
                               'tobacco', 'marijuana'),
        fy_end=JUNE_30,
    ),

    # Flat revenue, `Current:` + `Debt service:`, `Capital outlay` at root.
    'wrangell': CityConfig(
        city='City and Borough of Wrangell, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        fy_end=JUNE_30,
    ),

    # ⚠⚠ TWO ISSUER TEMPLATES IN ONE SERIES. FY2016 is a different statement
    # from FY2019+ and the gap between them is where the auditor changed:
    #
    #   FY2016   `Combining Statement of Revenues, Expenditures and Changes in
    #            Fund Balance`, departmental expenditure lines (Mayor's office,
    #            Assembly, Clerk and planning management, Finance, Resource
    #            department …) under `Current:`, and `Capital outlays`,
    #            `Principle`, `Interest`, `Trust fund` as root-level peers.
    #   FY2019+  the cohort's standard Exhibit B-3: `General government`,
    #            `Infrastructure`, `Education`, `Community services`, `Health
    #            and welfare` under `Current:`, `Debt service` as a parent.
    #
    # ⭐ ONE CONFIG STILL READS BOTH, AND THAT WAS CHECKED RATHER THAN HOPED:
    # FY2016's four root-level peers are ALL DASHES in the General Fund column
    # (they belong to the Capital Improvements, Debt Service and Trust funds),
    # so they drop as $0 rows and never contend for a parent. Declaring
    # `interest` or `principle` as a root leaf to suit FY2016 would have been
    # the wrong fix — in FY2019+ those two carry real General Fund money as
    # children of `Debt service`, and a root-leaf declaration would have lifted
    # them out of it in every one of those years.
    #
    # ⚠ `Intergovernmental:` only appears from FY2023; the earlier years print
    # `Federal government` / `State of Alaska` flat at root. A revenue parent
    # that never matches is inert, so one config covers both.
    # ⚠⚠⚠ AND IN FY2016 THE ISSUER CALLS ITS PRIMARY STATEMENT A COMBINING
    # ONE. `_EXCLUDE` carries `'combining'` because a combining schedule is
    # normally a SUPPLEMENTARY nonmajor-funds page, and loading one would
    # publish the wrong funds. This borough breaks that assumption the way
    # Buncombe County breaks `'reconciliation'`: its FY2016 Exhibit B-3 is
    # titled "Combining Statement of Revenues, Expenditures, and Changes in
    # Fund Balance", and the report's own MD&A says "The next statements
    # (Exhibits B-1 through B-5) are fund financial statements" — B-3 IS a
    # basic financial statement.
    #
    # ⚠ The document also carries a genuine supplementary combining schedule at
    # **Exhibit J-2**, which this widening lets qualify too. It is harmless
    # here and the reason is structural, not luck: `find_statement_page`
    # returns the EARLIEST qualifying page, basic statements precede
    # supplementary schedules, and B-3 sits ~37 pages ahead of J-2.
    #
    # ⭐ The widening was checked, not assumed: FY2019-FY2025 extract
    # BYTE-IDENTICAL totals with and without it, so it buys FY2016 and moves
    # nothing else.
    'aleutianseast': CityConfig(
        city='Aleutians East Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        revenue_parents=('intergovernmental',),
        revenue_group_members=('federal', 'state of alaska'),
        exclude_ignore=('combining',),
        fy_end=JUNE_30,
    ),

    # ── WAVE 2 ────────────────────────────────────────────────────────────

    # Flat revenue, `Current:` the only group, `Capital outlay` a valued root
    # leaf. `debt service` is declared because later years print it and an
    # undeclared parent silently reparents its children; in FY2023 it simply
    # never matches, which costs nothing.
    'bristolbay': CityConfig(
        city='Bristol Bay Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        fy_end=JUNE_30,
    ),

    # ⚠ A DIFFERENT TEMPLATE FROM THE REST OF ALASKA — all-caps section
    # headings (`REVENUES`, `EXPENDITURES`) and BOTH revenue sides grouped:
    # `Taxes` over Property/Sales, and `Intergovernmental` over three grant
    # lines. `Current` and `Debt service` print WITHOUT colons here.
    #
    # ⚠⚠ `members`, NOT `next_heading`. The revenue section is NOT exhaustive:
    # `Rentals, Service and admission fees`, `Licenses and permits`,
    # `Investment earnings (loss)` and `Contributions and other` all sit
    # ungrouped AFTER the two headings, so `next_heading` would swallow four
    # ungrouped sources into Intergovernmental — and still tie at $0.
    #
    # ⚠⚠⚠ AND ITS TITLE IS PLURAL — `STATEMENTS OF REVENUES, EXPENDITURES, AND
    # CHANGES IN FUND BALANCES`. The shared `_TITLE` in acfrGF.py requires the
    # SINGULAR `Statement of`, so NONE of Haines's nine years could find their
    # own statement page: all 18 extractions failed loudly with "primary GF
    # statement not found", which is the design working.
    #
    # ⭐ FIXED PER ENTITY, NOT BY WIDENING THE SHARED REGEX. `_TITLE` is read by
    # ~25 entities and `find_statement_page` returns the EARLIEST qualifying
    # page, so admitting the plural globally could only ADD candidate pages —
    # and a newly-qualifying page EARLIER than the right one silently moves
    # another entity's figures. `statement_anchor` is OR'd with the title for
    # exactly this kind of per-issuer variation, and the other filters (both
    # printed totals, `general` + `fund`, `_EXCLUDE`) still have to pass.
    # Measured: pages 1, 8 and 9 of the FY2024 filing carry the plural title and
    # only page 8 survives those filters.
    'haines': CityConfig(
        city='Haines Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        statement_anchor=r'statements\s+of\s+revenues',
        revenue_parents=('taxes', 'intergovernmental'),
        revenue_group_members=('property', 'sales', 'grants and contracts',
                               'payments in lieu of taxes'),
        fy_end=JUNE_30,
    ),

    # Flat revenue, `Current:` and `Capital outlay` at root.
    # ⚠ `Education -` is printed on its own line with its value on the NEXT
    # line (`contribution to School District`), so the default forward-wrap
    # welds them into `Education - contribution to School District`. That is
    # the label the borough prints; nothing is invented.
    'yakutat': CityConfig(
        city='City and Borough of Yakutat, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        fy_end=JUNE_30,
    ),

    # ⚠ The Northwest Arctic revenue shape: `Local sources:` and
    # `Intergovernmental:` over everything, exhaustively, with members sharing
    # no usable suffix (`Taxes`, `Permit fees`, `Charges for services`,
    # `Investment earnings (loss)`, `Other`). Hence `next_heading`.
    # ⚠ Expenditures are DEPARTMENTAL (Assembly, Administration, Planning
    # commission, Elections …) under `Current:`, with `Debt service:` beside
    # it and no capital root leaf.
    'lakepen': CityConfig(
        city='Lake and Peninsula Borough, AK',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        revenue_parents=('local sources', 'intergovernmental'),
        revenue_group_close='next_heading',
        fy_end=JUNE_30,
    ),
}


def main():
    ap = argparse.ArgumentParser(description='Alaska borough ACFR General Fund extractor')
    ap.add_argument('pdf_path')
    ap.add_argument('--entity', required=True, choices=sorted(CONFIGS))
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode, CONFIGS[args.entity]), indent=2))


if __name__ == '__main__':
    main()
