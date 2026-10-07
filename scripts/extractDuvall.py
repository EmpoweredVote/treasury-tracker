#!/usr/bin/env python3
"""City of Duvall, WA — General Fund extractor (MCAG 0391).

⚠⚠ DUVALL IS NOT GAAP. It files on the BARS regulatory basis and its auditor
issues TWO opinions in the same report: unmodified on that regulatory basis,
and ADVERSE on U.S. GAAP. Note 1 states "Financial transactions are recognized
on a cash basis of accounting" and "Government-wide statements, as defined in
GAAP, are not presented." The rows this extractor feeds carry
accounting_basis='cash' and audit_grade='audited_ocboa' for that reason — the
figure is AUDITED and it is NOT GAAP, and no single axis can carry both facts.

Every field below was read off Duvall's own statements. NOTHING is inherited
from Redmond, which shares King County and the `WA State Auditor — …` publisher
prefix with Duvall and shares neither a basis, a caption, a column order nor a
scale. Full evidence: docs/superpowers/plans/DUVALL-RECON.md.

── WHY EACH FIELD IS WHAT IT IS ─────────────────────────────────────────────

statement_anchor
    The statement is captioned `Fund Resources and Uses Arising from Cash
    Transactions`. ⚠ The GAAP caption `_TITLE` matches — `Statement of
    Revenues, Expenditures and Changes in Fund Balances` — DOES NOT EXIST
    anywhere in this corpus, so without an anchor no page qualifies at all.

target_column = 1, NOT 0
    ⚠⚠ THE SINGLE MOST DANGEROUS PROPERTY OF THIS CORPUS. The memo column is
    printed FIRST:

        Total for All     001 General     101 Street Fund     102
            Funds             Fund                            Transportation
        (Memo Only)

    `Total for All Funds (Memo Only)` is column 0 and `001 General Fund` is
    column 1. A `target_column=0` default would publish ALL-FUNDS money under a
    General Fund label — FY2024 revenue 28,652,633 instead of 7,074,922 — and
    would TIE AT EXACTLY $0 while doing it, because the memo column is
    internally consistent. Nothing arithmetic downstream can see that error;
    the only thing that catches it is naming the figure, which
    TestDuvallShape does.

target_column_label = 'General Fund'
    Without it, `scope_label` calls a non-zero column `Fund column 1` — the
    honest default for an index with no name in the document. Here the column
    IS named on the page, so the tree is rooted "General Fund Revenue by
    Source" like every other entity. ⚠ This is a CLAIM, and it is sound only
    because TestDuvallShape reads 5,941,972 (General Fund Taxes) and refuses
    8,108,336 (the memo cell one position to its left) out of that same column.

target_column_header = '001 General Fund'
    ⚠⚠ The statement REPEATS, once per group of funds, with identical row
    labels and DIFFERENT fund columns, and `001 General Fund` is on the FIRST
    page every time. Selecting a later page would read a different fund's money
    under the General Fund label. Exactly one page per fiscal year prints this
    header, which is what makes the biennial year-selection below unambiguous.

select_fiscal_year = True
    ⚠⚠ DUVALL IS AUDITED BIENNIALLY. ARN 1036127 is ONE document carrying a
    complete statement for FY2022 AND for FY2023, saved under both filenames
    (identical bytes — the sha manifest pins one digest under two paths, which
    is correct and must not be "fixed"). Taking the earliest qualifying page
    would publish FY2022's money under the FY2023 label and tie at $0. The page
    is chosen by its own printed `For the Year Ended December 31, <FY>`.

leading_account_code = True
    BARS line codes LEAD every label: `310 Taxes`, `30810 Reserved`,
    `388 / 588 Prior Period Adjustments, Net`, so the flag is a true
    description of the document.

    ⚠ IT IS DEFENCE IN DEPTH HERE, NOT THE THING THAT MAKES THE PARSE CORRECT,
    and that is a CORRECTION to what DUVALL-RECON.md §4 originally claimed.
    Measured 2026-10-06: setting it False and re-running all twenty real
    combinations gives BYTE-IDENTICAL totals. The reason is geometric — under
    `pdftotext -table` the code sits in its own column about 17 characters from
    the label and nowhere near a column anchor, and the anchors are measured
    from `Total Revenues:`, a row that carries no code at all. The flag is kept
    because it is true and is the documented remedy if that geometry shifts,
    but it is NOT a guard that currently fires. The guard that does fire is
    `target_column=1` plus the shape tests that name the figure.

parents / root_leaves / revenue_parents — ALL EMPTY
    The BARS statement is FLAT. There is no `Current:` / `Debt service:`
    grouping on either side; every row is a root peer under `Revenues` or
    `Expenditures`. Declaring a parent here would nest rows under a heading
    that is not on the page and still tie at $0.

revenue_total_labels / the section headers — NOTE THE TRAILING COLONS
    The statement prints `Total Revenues:` and `Total Expenditures:`, with
    colons, under bare `Revenues` and `Expenditures` headers.

units = 1, decimal_money = False
    FY2016+ print whole dollars (`5,591,355`). ⚠ FY2015 and earlier print CENTS
    (`5,837,971.11`) and sit below the floor; if the window is ever extended
    downward, re-read DUVALL-RECON.md §6 before touching either field.

multipage = False
    The repeats are OTHER FUNDS, not a continuation. Joining them would add
    other funds' money to the General Fund tree.

⚠ WINDOW: FY2016–FY2025, ten years from nine documents. FY2003–FY2015 are
excluded by the FLOOR RULE, not by defect — FY2010–FY2015 parse fine on a
different config in which the BARS code sits on its own line and the amounts
carry cents. scripts/lib/waRoster.mjs is the only authority on the window and
records a reason per year.

Usage:
  <python> scripts/extractDuvall.py "docs/Duvall/duvall-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Duvall, WA',
    # FLAT on both sides — see the docstring.
    parents=(),
    root_leaves=(),
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='positional',
    # ⚠⚠ NOT 0. The memo column is printed FIRST.
    target_column=1,
    target_column_label='General Fund',
    target_column_header='001 General',
    select_fiscal_year=True,
    leading_account_code=True,
    units=1,
    decimal_money=False,
    multipage=False,
    fy_end=('December', 31),
    statement_anchor=r'Fund Resources and Uses Arising from Cash Transactions',
    revenue_section_header='revenues',
    revenue_total_labels=('total revenues:',),
    # ⚠⚠ FY2016-FY2019 WRAP THE LABEL THE OTHER WAY. They print
    #     550   Natural and Economic   578,415   578,415   -   -
    #           Environment
    #     560   Social Services          2,556     2,556   -   -
    # so the value is on the FIRST line and `Environment` trails it. The
    # library's default welds a valueless line FORWARD, which published
    # `Environment Social Services` — a real figure under a name that appears
    # in no document — and left the row it belongs to truncated to `Natural and
    # Economic`. Both tie at $0 with the wrong name: the LA TRAN shape, where
    # the money is right and only the label lies. FY2020+ print
    # `Natural/Economic Environment` on one line and are unaffected.
    trailing_label_continuations=('environment',),
    # ── TWO ACCEPTANCES, BOTH CONFIRMED BY READING THE PAGE ─────────────────
    # FY2025 is the only year in the window where Duvall's own printed total
    # disagrees with its own printed components, and it does so on BOTH sides,
    # in OPPOSITE directions. Read off the General Fund column of
    # docs/Duvall/duvall-2025-acfr.pdf:
    #
    #   revenue   6,222,683 + 317,401 + 245,394 + 235,498 + 15,145 + 224,182
    #             = 7,260,303; the page prints `Total Revenues: 7,260,304`
    #   operating 1,399,285 + 3,396,364 + 434,264 + 866,414 + 50,177 + 955,031
    #             = 7,101,535; the page prints `Total Expenditures: 7,101,534`
    #             (530 Utilities is a bare dash in this column)
    #
    # Every component matches the page digit for digit, so the document is
    # internally inconsistent by a dollar — it is not a mis-parse. The other
    # NINE years tie at a bare $0 on both sides.
    #
    # ⚠ These are EXACT deltas, not a tolerance: any other value, including the
    # same year drifting to a different delta, still fails the gate. Every real
    # mis-parse this parser has produced was off by millions, never by a dollar.
    # ⚠ The LOADED total is the component sum, never the printed total, so the
    # stored row still ties against its own line items at $0.
    # ⚠ The roster's `expectedResidues: 2` asserts this count, so silently
    # dropping or widening either entry fails verify-wa-audit check (b).
    source_rounding={
        (2025, 'revenue'): -1,
        (2025, 'operating'): 1,
    },
)

if __name__ == '__main__':
    run_cli(CONFIG)
