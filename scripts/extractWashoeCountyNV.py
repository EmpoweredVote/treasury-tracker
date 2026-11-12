#!/usr/bin/env python3
"""
Washoe County, NV ACFR — General Fund extractor, COORDINATE-BASED.

Thin wrapper over `scripts/lib/acfrGfCoords.py`. Washoe County is the parent
county of the City of Reno; see `scripts/extractRenoNV.py`.

-- WHY THIS ENTITY READS BY COORDINATES -------------------------------------
The same width-dependent column split measured on Reno. FY2025, page 48,
General Fund column, as `pdftotext -table` renders it:

    Ad valorem              259,273,223     9 digits, one offset
    Other taxes                 662,654     6 digits, a DIFFERENT offset
    Licenses and permits     14,490,574     8 digits, a third

One printed column, several character offsets, so neither an ordinal nor a
positional read of the text layer is safe. Chosen for the WHOLE entity, never
per year by which one happened to tie.

-- STRUCTURE ----------------------------------------------------------------
The county GROUPS its revenue, which most issuers do not: `Taxes:` opens a
parent over `Ad valorem`, `Car rental fee`, `Residiential construction tax`
and `Other taxes`, after which `Special assessments` returns to the root. The
grouping is recovered from glyph indentation with nothing declared.

⚠ `Residiential construction tax` is the county's own spelling, carried
verbatim. Issuer typography is recorded, not corrected — the Milledgeville
rule.

-- WINDOW -------------------------------------------------------------------
FY2019, FY2020, FY2022, FY2023, FY2024, FY2025.

⚠ FY2021 IS NOT A GAP IN THE PUBLISHER, IT IS A GAP IN WHAT WE HAVE FOUND.
The county's ACFR directories answer 403 (exists, listing forbidden) for
FY2019-FY2025 and 404 (absent) for FY2015-FY2018, so FY2021's file is there
and its filename has not been guessed. Do not record it as unpublished.

⚠ FY2024 IS A REISSUE. The county publishes `2024 ACFR Final Revised -
Updated 09-29-25.pdf` (288pp) and `2024 ACFR Reissued Printable Version.pdf`
(319pp), both carrying "Reissued" and a Note 21 on the reissuance. Which one
is authoritative is decided from that note, not from the filename or the
page count — the filename is never the filter.

Usage:
  py -3 scripts/extractWashoeCountyNV.py docs/WashoeCounty/FY2025.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='Washoe County, NV',
    units=1,
    weld=None,
)

if __name__ == '__main__':
    run_cli(CONFIG)
