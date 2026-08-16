#!/usr/bin/env python3
"""
City of Bellevue, WA — General Fund extractor (GAAP actuals).
Thin wrapper over scripts/lib/acfrGF.py.
Source is the WA State Auditor's bound financial statements (MCAG 0374).

⚠ BELLEVUE INVERTS THE TREE SHAPE EVERY OTHER WA ENTITY USES
--------------------------------------------------------------
Tacoma, Spokane and Vancouver all print `Capital outlay` as a valued ROOT LEAF
sitting beside `Current:` and `Debt service:`. Bellevue prints it as a PARENT
with its own function children:

    Expenditures:
      Current:
        General government / Public safety / Physical environment /
        Transportation / Economic environment / Health & human services /
        Culture & recreation
      Debt service:
        Principal / Interest & fiscal charges
      Capital outlay:                          <- A PARENT, NOT A LEAF
        General government / Public safety / Physical environment /
        Transportation / Economic environment / Culture & recreation

So all three GASB characters are parents and NOTHING sits at root carrying a
value: `root_leaves=()`. This is the Hillsboro arrangement the library's own
CityConfig docstring warns about -- the same label is a parent in one city and a
root leaf in another, and these are genuinely different documents rather than
different readings of one.

Getting it backwards would still tie at $0. Listing `capital outlay` in
root_leaves would read the FIRST capital child as the entire capital line and
strand the remaining five under whatever parent was open -- identical dollars,
wrong shape, and no arithmetic gate can see it.

Note also that the SAME function name appears under both `Current:` and
`Capital outlay:` (General government, Public safety, Transportation and
Economic environment all appear twice). The tree keys leaves by
parent-and-label, so the two are distinct nodes; a reader that keyed on the
label alone would silently collapse them.

* AMOUNTS ARE IN THOUSANDS -> units=1000. The page says so explicitly
  ("(in thousands)") and FY2023 prints Taxes & special assessments as 210,259.
  Bellevue and Tacoma are the two thousands-denominated cities in this
  milestone; Spokane and Vancouver print whole dollars. The tie gate is
  unit-invariant and cannot tell them apart, so the loader's per-capita band is
  the only guard that fires on a wrong multiplier.

* The General Fund is the LEFTMOST money column in every loaded year. Column
  counts run 2-5; nothing here depends on that count.

* The revenue side is FLAT -- eleven sibling sources under a `Revenues:`
  section header, no `Taxes:` parent.

* `Debt service:` and `Capital outlay:` print a DASH in the General Fund column
  on their heading rows in FY2015 and FY2016. The library treats a
  character-word heading carrying a zero as a heading rather than a leaf, so
  those years need nothing special.

NINE OF TWENTY-ONE FILINGS ARE UNREADABLE — THE WORST RATIO IN THIS MILESTONE
------------------------------------------------------------------------------
The window is FY2008-FY2023 with four isolated holes. Every exclusion is a
source-document defect; none is a config gap.

  FY2004-FY2007   IMAGE-ONLY SCANS. No statement page carries any text; the
                  only money-bearing pages in each document are the Schedule of
                  Expenditures of Federal Awards. FOUR CONSECUTIVE unreadable
                  years, which is what ends the window at FY2008 under the
                  milestone's floor rule.

  FY2011, FY2017, FY2019, FY2024
                  Statement pages carry no digits. FY2024 is the plainest: its
                  text renders as consonant soup ("ZtZ", "'Zt^Z", "&Zz") with
                  no numerals at all. Each is ISOLATED -- both neighbours read
                  cleanly -- so the walk continues past them.

  FY2014          A DIFFERENT DEFECT, and worth naming separately because the
                  digits ARE present. That text layer both collapses spaces and
                  INJECTS them inside words and numbers:

                      "Ca s h&equi tyi npool edi nves tments"
                      "$1 5,205"        <- one cell, rendered as two numbers

                  Recovering it needs a de-spacing heuristic, which
                  scripts/lib/acfrGF.py explicitly refuses to have: rejoining
                  single spaces would happily corrupt legitimate multi-word
                  labels. `label_fixes` cannot help either -- the damage is in
                  the MONEY, not the labels. Isolated (FY2013 and FY2015 both
                  read cleanly), so it is documented and skipped.

  FY2025          Source timing: the SAO holds no City of Bellevue filing.

That leaves 12 loadable years. Row count is an output of recon, not a target,
and no year here was recovered by doing work the floor rule forbids.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Bellevue, WA',
    # ALL THREE characters are parents. See the inversion note above.
    parents=('current', 'debt service', 'capital outlay'),
    # Deliberately empty: nothing in Bellevue's expenditure section sits at
    # root carrying a value.
    root_leaves=(),
    # Eleven sibling revenue sources; no group to open.
    revenue_parents=(),
    revenue_group_members=(),
    # ⚠ 'ordinal', NOT the library default 'positional', and this is
    # load-bearing rather than stylistic.
    #
    # FY2008 and FY2009 render the General Fund column in DISJOINT HORIZONTAL
    # ZONES under `-table`: on FY2008 p.34 the Taxes figure sits at one x, the
    # Licenses figure far to its right, Intergovernmental somewhere else again,
    # while the neighbouring LEOFF I Reserve column stays put. No x-range
    # anchored on the totals row can enclose them, so the positional reader
    # found an empty band and computed a General Fund total of ZERO against a
    # printed 143,577 -- loudly wrong, but only because the shortfall was total.
    # This is the same `-table` pathology v2.22 documented on Kitsap
    # FY2004-FY2016.
    #
    # Ordinal is safe here because NO Bellevue row is ever short: every data row
    # in all twelve loaded years exposes exactly as many cells as its totals
    # row, with dashes where a fund has no activity. That is the precondition
    # ordinal needs and the one Tacoma FY2019/FY2023 and Spokane FY2005/FY2007
    # violate.
    column_strategy='ordinal',
    units=1000,
    fy_end=('December', 31),
    # ELEVEN registered cases, more than any other entity in this repo, and the
    # reason is structural rather than sloppy: Bellevue prints IN THOUSANDS, so
    # each component is independently rounded to the nearest thousand and their
    # sum need not equal the separately-rounded printed total. Six of the twelve
    # loaded years land a dollar off on one side or both.
    #
    # This retires an assumption Tacoma's config made explicit -- that a
    # thousands-denominated issuer "cannot" produce residues because its
    # components are already rounded. Tacoma's zero was an empirical fact about
    # Tacoma, not a law about the denomination.
    #
    # EVERY ONE was adjudicated by rendering the page at 200dpi and re-adding
    # the General Fund column off the IMAGE, never off the text layer, which is
    # the thing under suspicion. Deltas are in the SCALED domain (units=1000),
    # so a one-dollar-in-thousands disagreement registers as 1000.
    source_rounding={
        # FY2008 p.34 (bound p.31), "Page 1 of 3".
        # exp: 17,880 + 74,100 + 153 + 22,839 + 1,019 + 5,144 + 22,424
        #      + (Principal dash) + 17 (Interest) + (all Capital outlay dashes)
        #      = 143,576; page prints Total expenditures 143,577.
        (2008, 'operating'): -1000,
        # rev: 111,717 + 340 + 19,058 + 13,740 + 443 + 464 + (7) + 1,162
        #      + (Judgments dash) + 33 + 386 = 147,336; page prints 147,335.
        (2008, 'revenue'): 1000,
        # FY2009 p.33 (bound p.30), "Page 1 of 2".
        # exp: 19,251 + 74,815 + 114 + 22,990 + 3,673 + 5,996 + 22,765
        #      + (all Debt service and Capital outlay dashes) = 149,604; page
        #      prints Total expenditures 149,605.
        (2009, 'operating'): -1000,
        # rev: 107,169 + 262 + 17,975 + 15,271 + 53 + 221 + (44) + 1,464 + 46
        #      + 8 + 425 = 142,850; page prints 142,849.
        (2009, 'revenue'): 1000,
        # FY2012 p.37 (bound p.34), "Page 1 of 2".
        # exp: 17,961 + 78,634 + 98 + 24,598 + 3,768 + 6,289 + 29,598
        #      + (Debt service dashes) + 3 (Capital outlay Public safety)
        #      + 1 (Capital outlay Transportation) = 160,950; page prints
        #      Total expenditures 160,949.
        (2012, 'operating'): 1000,
        # rev: 118,300 + 425 + 19,445 + 20,004 + 1,832 + 69 + 73 + 4,721 + 10
        #      + 236 = 165,115; page prints 165,114.
        (2012, 'revenue'): 1000,
        # FY2013 p.33 (bound p.30), "Page 1 of 2". The expenditure side of this
        # same page ties EXACTLY (170,846), which is why only the revenue side
        # is registered.
        # rev: 124,231 + 455 + 18,050 + 22,773 + 1,106 + 82 + (93) + 4,762 + 13
        #      + 508 = 171,887; page prints 171,886.
        (2013, 'revenue'): 1000,
        # FY2015 p.35 (bound "Page 35").
        # exp: 22,195 + 87,207 + 1,022 + 29,034 + 4,598 + 6,968 + 34,887
        #      + (Debt service dashes) + 3 (Capital outlay Transportation)
        #      = 185,914; page prints Total expenditures 185,915.
        (2015, 'operating'): -1000,
        # rev: 140,733 + 508 + 19,679 + 26,121 + 2,035 + 124 + (16) + 5,979 + 8
        #      + 144 = 195,315; page prints 195,316.
        (2015, 'revenue'): -1000,
        # FY2016 p.33 (bound "Page 33").
        # exp: 20,559 + 88,157 + 165 + 25,010 + 10,374 + 5,240 + 32,087
        #      + (Debt service dashes) + 175 (Capital outlay Public safety)
        #      = 181,767; page prints Total expenditures 181,768.
        (2016, 'operating'): -1000,
        # rev: 145,857 + 413 + 20,163 + 16,343 + 2,847 + 232 + (49) + 6,313
        #      + (Judgments dash) + 17 + 570 = 192,706; page prints 192,705.
        (2016, 'revenue'): 1000,
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
