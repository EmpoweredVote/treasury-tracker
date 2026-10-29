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

⚠⚠ HONOLULU IS NOT HERE. It needs the coordinate reader; see
`scripts/extractHonoluluCoords.py` and the note above the CONFIGS table.

Usage:
  python scripts/extractHiCounty.py --entity maui path/to.pdf --mode revenue
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))

from acfrGF import CityConfig, extract  # noqa: E402

JUNE_30 = ('June', 30)

CONFIGS = {
    # ⚠⚠⚠ HONOLULU IS NOT HERE, AND MUST NOT BE. It is read by the COORDINATE
    # extractor, scripts/extractHonoluluCoords.py, because its dot leaders touch
    # the digits and defeat the "-table" character grid completely: every
    # revenue row lands in zero_rows, the tree comes back EMPTY and the printed
    # total reads 2000.
    #
    # A "honolulu" CityConfig lived here briefly and was DEAD:
    # processHiCounties.js routes Honolulu elsewhere, so nothing used it, while
    # "extractHiCounty.py --entity honolulu <pdf>" stayed a
    # supported invocation that returned a silently empty tree. Worse, the
    # selftest asserted units=1000 and target_column=0 against it, so the pin for
    # the one entity that prints IN THOUSANDS was guarding an object production
    # never touched. The live pin is TestShippedHonoluluCoordsConfig.
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
