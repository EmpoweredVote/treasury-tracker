#!/usr/bin/env python3
"""
Mecklenburg County, NC ACFR — General Fund extractor, COORDINATE-BASED.

Thin wrapper over `scripts/lib/acfrGfCoords.py`, which carries the shared
machinery and states the rule for when an entity belongs on the coordinate
reader at all.

-- WHY THIS ENTITY READS BY COORDINATES -------------------------------------
Identical mechanism to the City of Charlotte: the text layer emits the LABEL
column and the NUMERIC columns as separate blocks, so a line-based reader pairs
each label with the row below it. FY2023, `pdftotext -layout`, measured:

    REVENUES                     $ 1,303,781,250 $ 346,979,301 ...
        Taxes                                  -             - ...
        Law Enforcement Service District taxes -             - ...

`1,303,781,250` is printed on the `REVENUES` banner line and is Taxes' figure.

⚠ THIS TIES AT $0 WHILE BEING COMPLETELY WRONG — the offset permutes the
label→value pairing without changing the multiset of figures, so the sum, the
printed-total check and the leaf-multiset check are all unmoved. See the same
note in `extractCharlotteCoords.py`.

-- UNITS: WHOLE DOLLARS -----------------------------------------------------
The county prints full figures ("1,303,781,250"), with no "in thousands"
caption on the statement pages. `units=1`. Contrast the City of Charlotte,
which prints the same statement in THOUSANDS — the two entities in this
milestone use DIFFERENT units, which is exactly why the value is declared per
entity and never carried across.

-- ⚠ THE BUDGETARY DECOY ----------------------------------------------------
Mecklenburg prints a second, BUDGET-AND-ACTUAL General Fund statement
(FY2023 pages 56-58) on the budgetary basis, immediately after the GAAP
governmental-funds statement on page 54. `_EXCLUDE` already disqualifies a
budgetary page, so no `exclude_ignore` is set here; the GAAP statement is the
one that must be read.

-- STRUCTURE IS READ, NOT DECLARED ------------------------------------------
Nesting comes from the printed glyph indentation, so no `parents` /
`root_leaves` config is needed. The county prints `Debt service` as a group
heading over `Principal payments` / `Interest and fiscal charges`, with
`Capital outlay` as a valued root peer.

-- WINDOW -------------------------------------------------------------------
FY2005-FY2025, all twenty-one years the county publishes, unbroken.

Usage:
  py -3 scripts/extractMecklenburgCoords.py docs/MecklenburgCounty/mecklenburg_fy2023.pdf --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'lib'))
from acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='Mecklenburg County, NC',
    units=1,          # whole dollars; the county prints full figures
    weld=None,        # no embedded-disclosure label construction in this corpus
    # ⚠ TWO DOCUMENTS PRINT LABELS THE READER CANNOT RECOVER, and BOTH tie at $0
    # while shipping a name the issuer never printed. Every correction below is
    # transcribed from how the SAME line reads in FY2005 and FY2007, which agree
    # with each other exactly.
    #
    #  FY2006 — the whole document FUSES its words (it is the same year whose
    #  period caption reads "FORTHEYEARENDEDJUNE30,2006"). Thirteen labels ship
    #  without spaces.
    #
    #  FY2025 — 'Customer satisfaction and' / 'management' is a WRAPPED label
    #  whose money sits on the deeper second line. It is NOT fixed by
    #  weld='indent' because its prefix sits at the SECTION ROOT, where a wrap
    #  and a group heading (`Debt Service`, same page, same signature) are
    #  structurally indistinguishable. The amount is already correct; only the
    #  printed name is lost.
    label_fixes={
        # FY2006, fused glyphs
        'Administrativecharges': 'Administrative charges',
        'Chargesforservices': 'Charges for services',
        'Interestearnedoninvestments': 'Interest earned on investments',
        'Licensesandpermits': 'Licenses and permits',
        'DebtService': 'Debt Service',
        'AdministrativeServices': 'Administrative Services',
        'BusinessPartners': 'Business Partners',
        'CommunityServices': 'Community Services',
        'CustomerSatisfactionandManagement': 'Customer Satisfaction and Management',
        'DetentionandCourtSupportServices': 'Detention and Court Support Services',
        'FinancialServices': 'Financial Services',
        'HealthandHumanServices': 'Health and Human Services',
        'LandUseandEnvironmentalServices': 'Land Use and Environmental Services',
        'Interestandfiscalcharges': 'Interest and fiscal charges',
        'Principalpayments': 'Principal payments',
        # FY2025, wrapped label
        'Customer satisfaction and': 'Customer satisfaction and management',
    },
    # FY2025 only: the wrapped label above is read as a parent with a single
    # child literally named `management`. Renaming fixes the parent; this
    # publishes it as the LEAF it actually is. Refuses to act if the node ever
    # has more than one child.
    collapse_children=('Customer satisfaction and management',),
    indent_tol=4.0,   # ⚠ FY2005-FY2011 print `Current` ~2pt deeper than its own
                      # sibling headings; measured spread/gap table is in
                      # CoordsConfig's docstring. FY2012+ need only the 1.5
                      # default, but the value is declared PER ENTITY, so the
                      # whole series reads through one rule rather than the
                      # reader changing behaviour mid-series.
)

if __name__ == '__main__':
    run_cli(CONFIG)
