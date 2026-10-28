#!/usr/bin/env python3
"""
Alaska's six largest boroughs — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`), holding one
`CityConfig` per borough and selected with `--entity`.

⚠ WHY ONE FILE AND NOT SIX. The repo's convention is one wrapper per entity
(`extractWichitaKS.py`, `extractBoulderCO.py`, ...), and that convention earns
its keep when each entity's document is genuinely different. These six are a
single cohort — same state, same statement, same fiscal year end, all fetched
through one route on the same day — and six files would be six copies of the
same twelve lines. The per-entity FACTS still live in their own CONFIGS entry
with their own comments, which is what the convention actually protects.

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
