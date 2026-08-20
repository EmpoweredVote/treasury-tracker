#!/usr/bin/env python3
"""
City of Austin, TX ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`, which carries the shared
machinery and documents the parsing traps (dash-zero rows, wrapped statement
titles, expenditure nesting, units).

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  2-level GF expenditure-by-function tree

City of Austin specifics
------------------------
* **Fiscal year ends September 30**, not the module default of June 30.

* **Amounts are printed "(In thousands)"** -> `units=1000`. Austin is the
  second entity in this corpus to do so (Seattle and King County are the
  others), and the FIRST where the neighbouring entity in the same milestone
  does NOT: Travis County, the county Austin sits in, prints whole dollars.
  `units` CANNOT be validated by the tie gate — tie_delta compares a computed
  sum against a printed total read through the same multiplier, so it is 0
  either way. A wrong `units` here ships a silently 1000x-wrong row. It is
  checked by the loader's per-capita plausibility guard instead.

* **The statement caption's DIGITS are glyph-ciphered.** Austin's FY2024
  statement page renders its own period as:

      For the year ended September 32, 2222        <- printed 30, 2024

  The money digits on the same page are NOT affected — FY2024's General Fund
  revenue column sums to its printed total of 1,280,826 exactly, and the
  expenditure column to 1,347,127 exactly. Only the decorative header font
  substitutes glyphs. The consequence is confined to `parse_fy`: the
  statement page's own caption (priority 1, the authoritative source) cannot
  be read, so the year falls through to the whole-document scan, which the
  shared module documents as able to latch onto a true-but-unrelated year
  (a GFOA-award paragraph naming the PRIOR year is the live example that
  mislabelled King County). **The loader therefore asserts the extracted
  `fiscal_year` against the year in the filename and aborts the year on a
  mismatch** rather than trusting either read.

* **Expenditure nesting.** `pdftotext -layout` does NOT answer the nesting
  question for Austin — its text stream is flat, with every label at column 0.
  The indentation was read instead from the PDF's own glyph coordinates via
  pdfplumber, which is authoritative (FY2024, statement page 50):

      x0 = 54.5  ->  root level          x0 = 74.5  ->  child
        EXPENDITURES
        Current:                                  <- parent
          General government                (74.5)
          Public safety                     (74.5)
          Transportation, planning, and sustainability
          Public health                     (74.5)
          Public recreation and culture     (74.5)
          Urban growth management           (74.5)
        Debt service:                             <- parent
          Principal                         (74.5)
          Interest                          (74.5)
          Fees and commissions              (74.5)
        Lease and IT subscription financing principal   <- VALUED root leaf
        Interest expense on leases and IT subscriptions <- VALUED root leaf
        Capital outlay-capital project funds            <- VALUED root leaf

  Hence three `root_leaves` prefixes. Note `interest expense on leases` must
  be spelled out far enough to NOT collide with the `Interest` child under
  `Debt service:` — `root_leaves` are matched as label PREFIXES, so a bare
  'interest' would pull the debt-service child up to the root, inflating
  nothing (the tie still holds) while moving real money out of Debt service.

  The lease prefix is `'lease '`, deliberately SHORTER than any one year's
  wording, because Austin renamed the line mid-window and the two spellings
  are three fiscal years apart:

      FY2022        "Lease financing principal"
      FY2023-FY2025 "Lease and IT subscription financing principal"

  Configured to the FY2024 wording alone, FY2022's row failed the prefix test
  and was filed as a CHILD of the still-open `Debt service:` parent instead of
  as its root-level peer. It tied at exactly $0 either way — the only visible
  symptom was a `Debt service` node that existed solely to hold a lease
  payment, in a year where all three real debt-service lines print `--`. This
  is trap #3 in the shared module, observed live in this corpus.

  Every child label under `Current:` and `Debt service:` was checked against
  this prefix: none begins with "lease". (`Lease revenue` exists but is a
  REVENUE source, and `root_leaves` governs the expenditure section only.)

Usage:
  py -3 scripts/extractAustin.py "docs/Austin/austin-2024-acfr.pdf" --mode revenue
  py -3 scripts/extractAustin.py "docs/Austin/austin-2024-acfr.pdf" --mode operating
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Austin, TX',
    parents=('current', 'debt service'),
    root_leaves=(
        'lease ',                      # covers both the FY2022 and FY2023+ wordings
        'interest expense on leases',
        'capital outlay',
    ),
    units=1000,
    fy_end=('September', 30),
)

if __name__ == '__main__':
    run_cli(CONFIG)
