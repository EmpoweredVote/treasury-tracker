#!/usr/bin/env python3
"""
City of Bainbridge Island, WA — General Fund extractor (GAAP actuals).

COVERS FY2012-FY2025. For FY2004, FY2005, FY2007 and FY2008 (an era with a
genuinely different expenditure tree shape), use
scripts/extractBainbridgeEarly.py instead.

FOUR fiscal years in the FY2004-FY2025 span have no loadable filing, all four
for SOURCE-DOCUMENT reasons, none for a parser reason:
  * FY2006 -- image-only scan (excluded upstream, no ARN).
  * FY2009 -- statement pages are digit-bearing but ciphered (broken embedded
    font, no usable ToUnicode CMap); the bounded contiguous-offset decode
    attempted in Task 6 found no substitution map that tied. No ARN.
  * FY2010 -- found in Task 8. The governmental-funds statement (PDF page 28)
    decodes through a constant +29 byte shift: "&,7<2)%$,1%5,'*(,6/$1'" is
    "CITY OF BAINBRIDGE ISLAND". The labels recover; the MONEY DOES NOT (a
    byte scan finds zero control/high characters, so the digits are absent
    from the text stream, not merely mis-mapped). Same defect class as Kitsap
    FY2017-2019. Excluded in scripts/processBainbridge.js.
  * FY2011 -- found in Task 8. The two governmental-funds statement pages
    (25-26) contain only the SAO page footer; `pdfimages -list` shows the
    statement bodies are CCITT stencil scans. Same class as FY2006. Excluded
    in scripts/processBainbridge.js.
See "Known limitations" in
docs/superpowers/specs/2026-08-14-bainbridge-island-kitsap-onboarding-design.md.

Thin wrapper over scripts/lib/acfrGF.py.

Source is the WA State Auditor's bound financial statements, not a
self-published ACFR: SAO binds full statements for every filer except large
GAAP filers that publish their own (Seattle, King County).

Bainbridge specifics (FY2012-FY2025)
-------------------------------------
* AMOUNTS ARE WHOLE DOLLARS -> units=1 (the default). Opposite of Seattle and
  King County, which print "(IN THOUSANDS)". The tie gate is unit-invariant and
  reads $0 either way, so this is checked by the selftest and by the loader's
  per-capita guard, never by the tie.
* Statement is on ONE page with the General Fund as the leftmost money column.
* Revenue side is FLAT -- there is no `Taxes:` parent, so revenue_parents stays
  empty. Setting it would hunt for a group this issuer does not print.
* Expenditure tree: `Current` is the only parent; `Debt Service - Principal`,
  `Debt Service - Interest` and `Capital Outlay` are VALUED ROOT LEAVES.
* `Transportation` is a dash-zero in the GF column in FY2025 and neighbouring
  years -- handled by the library, asserted by the selftest.
* revenue_total_labels is left at its default (`('total revenues',)`), which
  every year FY2012-FY2025 satisfies. Unlike the early era, which needs
  `'total operating revenues'` added and therefore has its own config in
  scripts/extractBainbridgeEarly.py.

  CORRECTION (Task 8): an earlier revision of this docstring claimed "FY2010
  alone in this era renders the caption as `Total REVENUES` (different case)".
  That observation was made against **page 68 of the FY2010 filing, the
  BUDGETARY COMPARISON SCHEDULE -- General Fund** (the Streets fund's own
  Budgetary Comparison Schedule immediately follows at page 69) -- a
  budget-basis page that `_EXCLUDE` deliberately rejects -- not against the
  GAAP governmental-funds statement, whose text layer in that filing is
  unreadable (see FY2010 above). The claim is removed rather than corrected
  in place because it implied FY2010 was a working year, which it never was.

  CORRECTION (Task 8 review, closed): the page numbers in the paragraph above
  and in the FY2010 bullet were originally miscited as "PDF page 57" (GAAP
  statement) and "page 128" (Budgetary Comparison Schedule). Page 57 of that
  filing is in fact a clean-text Revenue Obligation Debt note, and the filing
  has only 72 pages total, so page 128 does not exist. Verified directly
  against docs/BainbridgeIsland/bainbridge-2010-acfr.pdf: the ciphered GAAP
  statement (the +29 shift decodes its footer "25") is PDF page 28, and the
  Budgetary Comparison Schedule -- General Fund is PDF page 68 (Streets is
  page 69). The substance of both findings is unchanged; only the page
  numbers were wrong.

Usage:
  py -3 scripts/extractBainbridge.py "docs/BainbridgeIsland/bainbridge-2025-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Bainbridge Island, WA',
    parents=('current',),
    root_leaves=('debt service', 'capital outlay'),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='ordinal',
    units=1,
    fy_end=('December', 31),
    # Task 8: 17 of this era's 28 loadable FY x mode combinations carry a
    # printed-total artifact. EVERY entry below was adjudicated by RENDERING
    # the statement page (pdftoppm -r 160) and reading the General column off
    # the image, not off the text layer. In every case the extractor's
    # component list matched the page line for line -- labels, values and
    # dash-zeros -- and the disagreement was between the page's own components
    # and the page's own printed total. Exact deltas only, never a tolerance:
    # a year that drifts to a different delta still fails the gate loudly.
    #
    # The cause is consistent and benign: the SAO statements round each printed
    # component independently AND round the grand total independently from
    # cents-bearing ledger values, so the two disagree by a dollar or two.
    source_rounding={
        # FY2012 op, PDF p23 (doc page 20): 3,073,906 + 639,257 + 3,761,541
        # + 450,453 + (Transportation dash) + 261,909 + 977,836 + 238,361
        # + 155,172 + 41,471 + 216,757 = 9,816,663; page prints 9,816,665.
        # Same page's revenue components sum exactly to its printed 15,265,437.
        (2012, 'operating'): -2,
        # FY2013 op, PDF p23->p32 ("Page 32"): 3,665,731 + 611,466 + 3,717,644
        # + 345,560 + 3,648 + 269,669 + 828,802 + 292,545 + 156,743 + 33,102
        # + 185,705 = 10,110,615; page prints 10,110,616.
        (2013, 'operating'): -1,
        # FY2014 op, PDF p29 ("Page 29"): 4,100,672 + 592,302 + 3,830,799
        # + 353,169 + 9,854 + 272,722 + 872,754 + 297,623 + 158,881 + 21,598
        # + 459,073 = 10,969,447; page prints 10,969,448.
        (2014, 'operating'): -1,
        # FY2014 rev, PDF p29: 6,870,693 + 7,218,054 + 111,820 + 608,016
        # + 302,496 + 472,394 + 62,070 + 92,614 = 15,738,157; page prints
        # 15,738,156.
        (2014, 'revenue'): 1,
        # FY2015 op, PDF p31 ("Page 31"): 4,100,753 + 649,812 + 4,055,747
        # + 810,442 + (Transportation dash) + 272,783 + 1,092,291 + 310,533
        # + 100,000 + 13,556 + 740,335 = 12,146,252; page prints 12,146,253.
        (2015, 'operating'): -1,
        # FY2015 rev, PDF p31: 6,979,100 + 7,437,152 + 111,339 + 633,732
        # + 379,005 + 437,314 + 77,717 + 123,373 = 16,178,732; page prints
        # 16,178,733.
        (2015, 'revenue'): -1,
        # FY2016 rev, PDF p29 ("Page 29"): 7,115,240 + 7,659,879 + 89,808
        # + 644,155 + 674,162 + 415,385 + 114,394 + 94,914 = 16,807,937; page
        # prints 16,807,936. Same page's expenditure components sum exactly to
        # its printed 11,935,945.
        (2016, 'revenue'): 1,
        # FY2017 op, PDF p29 ("Page 29"): 4,026,952 + 643,074 + 5,079,219
        # + 1,049,737 + 5,842 + 253,274 + 1,275,970 + 446,547 + (Principal
        # dash) + 2,283 + 679,606 = 13,462,504; page prints 13,462,502. Same
        # page's revenue components sum exactly to its printed 17,740,574.
        (2017, 'operating'): 2,
        # FY2018 op, PDF p30 ("Page 30"): 4,395,350 + 702,714 + 5,562,764
        # + 860,241 + 36,041 + 259,248 + 1,547,671 + 622,406 + (Principal
        # dash) + 1,627 + 470,404 = 14,458,466; page prints 14,458,465.
        (2018, 'operating'): 1,
        # FY2020 op, PDF p32 ("Page 32"): 4,742,866 + 690,112 + 6,594,036
        # + 802,407 + 2,422 + 416,964 + 1,185,736 + 552,985 + (Principal dash)
        # + 1,164 + 564,277 = 15,552,969; page prints 15,552,970.
        (2020, 'operating'): -1,
        # FY2020 rev, PDF p32: 7,902,663 + 9,076,786 + 31,103 + 602,175
        # + 1,672,881 + 323,357 + 215,935 + 215,977 = 20,040,877; page prints
        # 20,040,876.
        (2020, 'revenue'): 1,
        # FY2021 op, PDF p34 ("Page 34"): 5,235,863 + 616,799 + 5,974,553
        # + 686,079 + 6,347 + 516,779 + 1,101,555 + 561,325 + (Principal dash)
        # + 546 + 71,818 = 14,771,664; page prints 14,771,666.
        (2021, 'operating'): -2,
        # FY2021 rev, PDF p34: 8,061,834 + 10,436,343 + 24,629 + 655,275
        # + 741,911 + 322,056 + 76,459 + 143,306 = 20,461,813; page prints
        # 20,461,812.
        (2021, 'revenue'): 1,
        # FY2022 rev, PDF p31 ("Page 31"): 8,117,599 + 11,899,875 + 29,070
        # + 661,783 + 550,602 + 330,285 + 463,737 + 365,252 = 22,418,203; page
        # prints 22,418,202.
        (2022, 'revenue'): 1,
        # FY2024 op, PDF p29 ("Page 29"): 7,055,930 + 683,767 + 6,886,661
        # + 972,814 + (Transportation dash) + 877,786 + 1,687,771 + 627,400
        # + (Principal dash) + 4,062 + 354,559 = 19,150,750; page prints
        # 19,150,749.
        (2024, 'operating'): 1,
        # FY2024 rev, PDF p29: 8,404,876 + 11,979,273 + 50,340 + 655,581
        # + 706,743 + 305,272 + 1,702,600 + 344,960 = 24,149,645; page prints
        # 24,149,646.
        (2024, 'revenue'): -1,
        # FY2025 op, PDF p23 ("Page 23"): 7,996,984 + 804,040 + 7,036,357
        # + 924,903 + (Transportation dash) + 1,424,106 + 1,806,075 + 640,860
        # + 30,508 + 3,966 + 133,497 = 20,801,296; page prints 20,801,297.
        (2025, 'operating'): -1,
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
