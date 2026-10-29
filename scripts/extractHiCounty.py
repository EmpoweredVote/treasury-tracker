#!/usr/bin/env python3
"""
Hawaii's four counties — General Fund extractor.

Thin wrapper over `scripts/lib/acfrGF.py` (`pdftotext -table`), holding one
`CityConfig` per county and selected with `--entity`.

⚠ ONE FILE, FOUR CONFIGS. The repo's convention is one wrapper per entity, and
it earns its keep when each document is genuinely different. These four are a
single cohort — one state, one route, one fiscal calendar — so the per-entity
FACTS live in their own CONFIGS entry with their own comments, which is what
the convention actually protects.

── ⚠⚠⚠ UNITS ARE READ PER ENTITY, FROM THE STATEMENT'S OWN CAPTION ────────

A `units` error is INVISIBLE to the tie gate: computed and printed are both
scaled by `cfg.units`, so a 1000x-wrong row ships behind a green $0 tie. Only
the loader's per-capita ceiling and `TestShippedHiCountyConfigs` stand in
the way.

⚠⚠ ALL FOUR DOCUMENTS CONTAIN THE WORD "THOUSANDS" SOMEWHERE — in the
statistical section, which is NOT the statement. Kaua'i's reads
"LAST TEN FISCAL YEARS (VALUED IN THOUSANDS - UNAUDITED)" and its statement is
in whole dollars. Grepping the document for "thousands" is the wrong test; the
caption on the STATEMENT PAGE is the right one, cross-checked against the
magnitude of the printed figures.

── ⚠ FISCAL YEAR: ALL FOUR END JUNE 30 ───────────────────────────────────

Confirmed by `fy_end_date` on all 38 FAC filings.

Usage:
  python scripts/extractHiCounty.py --entity honolulu path/to.pdf --mode revenue
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
# ⚠ Hawaii County's own site (hawaiicounty.gov) returns 403 to every client
# tried, browser headers included, so the Mat-Su second-publisher check has the
# Sitka/Akamai outcome: no second copy of these two is reachable.
KNOWN_DOCUMENT_GAPS = {
    ('hawaii', 2018, None):
        "Image-only scan — 238 chars/page against a healthy band of 1,779-2,208 "
        "across the other 36 filings. Rejected by the fetcher's density guard, "
        "so no PDF is on disk.",
    ('hawaii', 2023, None):
        "Image-only scan — 250 chars/page. Same cause and same guard as FY2018.",
}

CONFIGS = {
    # ⚠⚠ HONOLULU IS THE ONLY ONE IN THOUSANDS. Its statement page is captioned
    # "( Amounts in thousands )" and its General Fund revenue prints 2,088,725
    # — $2.09 BILLION for a city-county of 998,747. Read off the page, not
    # carried from a sibling.
    #
    # ⚠⚠⚠ LABELS ARE NOT UNIQUE ACROSS PARENTS HERE. `Miscellaneous:` is
    # printed TWICE — once as a revenue group (Recoveries, Interest, Other) and
    # once UNDER `Current:` (Retirement and health benefits, Other) — and
    # `Other` is a child of both. `Capital Outlay:` then repeats five function
    # names that already appear under `Current:` (General government, Public
    # safety, Highways and streets, Human services, Culture-recreation).
    # Parenting by label alone produces a wrong tree that ties at $0.
    'honolulu': CityConfig(
        city='City and County of Honolulu, HI',
        parents=('current', 'capital outlay', 'debt service'),
        root_leaves=(),
        # `Current:` > `Miscellaneous:` > {Retirement and health benefits, Other}
        # ⚠ REQUIRED, and the library refuses without it: a sub-group with no
        # declared members closes after its FIRST child and the rest reparent
        # silently, while the statement still ties. The two members are the
        # only rows between the heading and `Capital Outlay:`, which closes the
        # group by being a parent.
        subparents=('miscellaneous',),
        subparent_member_prefixes=('retirement', 'other'),
        # Revenues > `Miscellaneous:` > {Recoveries, Interest, Other}. The three
        # share no usable suffix, and the group is closed by `Total Revenues`.
        revenue_parents=('miscellaneous',),
        revenue_group_close='next_heading',
        units=1000,
        fy_end=JUNE_30,
    ),

    # ⚠ WHOLE DOLLARS despite "(Dollars in Thousands)" appearing elsewhere in
    # the document: the statement prints Taxes 508,927,947 for a county of
    # 163,688. In thousands that would be $508 billion.
    #
    # Revenue carries a `Taxes` group — Property, Transient accommodations,
    # Franchise, Fuel, Public service company, General excise — every member of
    # which ends in "tax" or "taxes", and the next source
    # (`Licenses and permits`) does not.
    'maui': CityConfig(
        city='County of Maui, HI',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        revenue_parents=('taxes',),
        revenue_group_members=('tax', 'taxes'),
        # ⚠⚠ `_EXCLUDE` REJECTED THE RIGHT PAGE. Maui lists its transfers out
        # by destination, and one of those destinations is a line item printed
        # `Proprietary Funds`. The exclusion exists to keep a PROPRIETARY-FUNDS
        # STATEMENT from qualifying; here the same word is a transfer's payee
        # on the governmental-funds statement itself. Without this the page is
        # rejected and the extractor reports "primary GF statement not found" —
        # a loud failure, not a wrong tree, which is the design working.
        exclude_ignore=('proprietary',),
        # ⚠⚠ A WRONG TREE THAT TIED AT $0 IN THREE OF TEN YEARS. Maui prints
        # `Current:`, `Capital outlay` and `Debt Service:` at ONE x-position
        # (79.6 on FY2020 p50) with only the colon marking a heading, and in
        # FY2020-FY2022 it prints `Capital outlay` in the MIDDLE of the current
        # functions — confirmed against glyph coordinates (FY2020: `Capital` at
        # y=260.0, between `Public safety` 251.7 and `Social welfare` 268.4),
        # so it is the document and not the reader. A closing root leaf threw
        # the five functions printed after it out to the root, leaving
        # `Current` with two children while every figure stayed correct and the
        # statement tied at exactly $0.
        # ⚠ `Debt Service:` still closes `Current`, because a PARENT closes it.
        root_leaf_closes_parent=False,
        units=1,
        fy_end=JUNE_30,
    ),

    # ⚠⚠ HAWAII COUNTY SPLITS ITS OWN NUMBERS. FY2019 prints
    # `$  313 ,631,189` — a space BEFORE the comma — so the parser read 313 and
    # dropped the rest, a silent $313 MILLION understatement that surfaced as a
    # tiny +14,666 delta rather than a loud failure. The mirror image of the
    # Fairbanks defect (`54, 169,000`, space AFTER the comma) that
    # `repair_ocr_whitespace` was written for.
    'hawaii': CityConfig(
        city='County of Hawaii, HI',
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        whitespace_repair=True,
        units=1,
        fy_end=JUNE_30,
    ),

    'kauai': CityConfig(
        city="County of Kaua'i, HI",
        parents=('current', 'debt service'),
        root_leaves=('capital outlay',),
        units=1,
        fy_end=JUNE_30,
    ),
}


def main():
    ap = argparse.ArgumentParser(description='Hawaii county ACFR General Fund extractor')
    ap.add_argument('pdf_path')
    ap.add_argument('--entity', required=True, choices=sorted(CONFIGS))
    ap.add_argument('--mode', choices=['operating', 'revenue'], default='operating')
    args = ap.parse_args()
    print(json.dumps(extract(args.pdf_path, args.mode, CONFIGS[args.entity]), indent=2))


if __name__ == '__main__':
    main()
