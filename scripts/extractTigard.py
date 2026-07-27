#!/usr/bin/env python3
"""
Tigard, OR ACFR — General Fund extractor (GAAP actuals).

Thin per-city wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps.

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  flat GF expenditure-by-function tree

Tigard specifics
----------------
* **Singular "FUND BALANCE" in the statement title.** Tigard heads its statement
  "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCE" where every
  other city so far uses the plural "BALANCES". The shared `_TITLE` pattern now
  accepts `Balances?`. Before that, detection failed outright ("primary GF
  statement not found") — a safe failure, but an opaque one.

* **Flat expenditure section — no parents at all.** Tigard prints every function
  at the same indentation with no `Current:` grouping, confirmed with
  `pdftotext -layout`:

      EXPENDITURES                (0 sp)
        Community services        (2 sp)
        Public works              (2 sp)
        Community development     (2 sp)
        Policy and administration (2 sp)
        Capital improvements      (2 sp)
        Debt service              (2 sp)

  Hence `parents=()` and `root_leaves=()`: every row lands at the root. The
  operating tree is therefore ONE level deep, not two — the icicle has no
  drill-down for Tigard, the same accepted limitation as the flat-source states.

* `Public works`, `Capital improvements` and `Debt service` are $0 in the
  General Fund (they live in other funds) and are reported in `zero_rows`.

SOURCE DISCOVERY NOTE
---------------------
tigard-or.gov sits behind a WAF that returns 403 to `curl` for both GET and HEAD
regardless of headers — almost certainly TLS fingerprinting. The PDFs must be
fetched through a real browser; see `scripts/fetchViaBrowser.mjs`. The site's
document links carry no fiscal year, only opaque ids
(`/home/showpublisheddocument/<id>/<ticks>`), so each downloaded file's fiscal
year was confirmed from the document itself rather than from the link.

Usage:
  py -3 scripts/extractTigard.py "docs/Tigard/tigard-2025-acfr.pdf" --mode revenue
  py -3 scripts/extractTigard.py "docs/Tigard/tigard-2025-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Tigard, OR',
    parents=(),
    root_leaves=(),
)

if __name__ == '__main__':
    run_cli(CONFIG)
