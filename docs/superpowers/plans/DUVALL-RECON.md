# Duvall, WA — recon evidence

**Date:** 2026-10-06 · **MCAG:** 0391 · **Basis:** cash (BARS regulatory), NOT GAAP

Every decision below was read from Duvall's own filings. Nothing was carried
from Redmond — they are both King County, both `WA State Auditor — …`, and they
do not share an accounting basis.

---

## 1. The documents are not GAAP, and the opinion says so twice

The auditor's report is SPLIT, and both halves matter:

> **Unmodified Opinion on the Regulatory Basis of Accounting (BARS Manual)**
> **Adverse Opinion on U.S. GAAP** — "…the financial statements are prepared by
> the City using accounting practices prescribed by the BARS Manual, which is a
> basis of accounting other than GAAP."

Note 1 adds: *"Financial transactions are recognized on a cash basis of
accounting"* and *"Government-wide statements, as defined in GAAP, are not
presented."*

So the figure is **audited** and **not GAAP** — the pair of facts that forced
the `accounting_basis` axis, because `audit_grade` alone cannot carry both.

→ `audit_grade = audited_ocboa`, `accounting_basis = cash`.

## 2. The statement is a different shape from every other WA entity

Caption: **`Fund Resources and Uses Arising from Cash Transactions`**, not
`Statement of Revenues, Expenditures and Changes in Fund Balances`. There is no
fund-balance section; it opens with `Beginning Cash and Investments`.

⚠ The GAAP caption the library's default anchor looks for **does not exist in
this corpus**, so `statement_anchor` is mandatory.

## 3. ⚠⚠ The memo column is printed FIRST

FY2020, read off the page:

```
                      Total for All    001 GENERAL    101 STREET    102
                          Funds             FUND         FUND       TRANSPORTATI
                      (Memo Only)                                   ON BENEFIT
```

`Total for All Funds (Memo Only)` is **column 0**; `001 GENERAL FUND` is
**column 1**.

**A `target_column=0` default would publish ALL-FUNDS money under a General
Fund label and tie at $0 while doing it.** This is the single most dangerous
property of this corpus.

⚠ The header WRAPS: FY2016 and FY2018 print `001 GENERAL` and `FUND` on
separate lines, which is why a one-line regex finds nothing there. The column
exists in every year of the window; only the wrapping varies.

## 4. ⚠ BARS line codes lead every label

```
308              Beginning Cash and Investments
310              Taxes
320              Licenses and Permits
30810            Reserved
388 / 588        Prior Period Adjustments, Net
```

Codes are 3-digit, 5-digit (`30810`), and compound (`388 / 588`).

`leading_account_code=True` is set because that is a true description of the
document.

> ⚠⚠ **CORRECTED 2026-10-06 (Task 6, phase 2).** This section originally said
> that without the flag the library's `_MONEY` pattern reads `310` as a value,
> the tree comes back flat and the total is slightly over. **That is not true
> of this corpus and was never measured.** Setting the flag to `False` and
> re-running **all twenty** real combinations produces **byte-identical**
> totals and identical trees. The reason is geometric: under `pdftotext
> -table` the code sits in its own column ~17 characters from the label and
> nowhere near a column anchor, and the anchors are measured from
> `Total Revenues:`, a row that carries no code at all.
>
> The flag is KEPT — it describes the document and is the documented remedy if
> that geometry ever shifts — but it is **defence in depth, not a guard that
> fires**, and the selftest that pins it says so. The guard that actually
> fires is `target_column=1` plus the shape tests that name the figure.
> Recording this matters because a flag advertised as load-bearing, which
> changes nothing, is the vacuous-gate failure this repo keeps shipping.

The flag exists in the library because Aberdeen SD prints the same chart of
accounts.

## 5. The window is FY2016–FY2025, and the floor rule is what ends it

The audit periods are **biennial** in places, read from
`BeginAuditPeriod`/`EndAuditPeriod` rather than inferred:

| report | covers | report | covers |
|---|---|---|---|
| ARN 69662 | FY2003–FY2004 | ARN 1018682 | FY2014–FY2015 |
| ARN 1009156 | FY2010–FY2011 | ARN 1036127 | **FY2022–FY2023** |
| ARN 1013701 | FY2012–FY2013 | | |

So the readable span is wider than the filing count suggests. The window still
ends at FY2016, because **the statement's shape changes between FY2015 and
FY2016** — the floor rule's era-split clause, the same rule that set Redmond's
window at FY2011.

**FY2016 onward** — the BARS code LEADS the label on one line:

```
30810            Reserved
388 / 588        Prior Period Adjustments, Net
Revenues
```

**FY2015 and earlier** — the code sits on its own line, the label is in a
separate column position, and the section header shares a line with the first
item:

```
Beginning Cash and Investments        Total for All     001 GENERAL
30810                      Reserved
Operating Revenues         Taxes
310                        Licenses and Permits
```

`leading_account_code` assumes the code LEADS the label. The pre-FY2016 era
would need its own config, and the floor rule refuses a second config for an
era split.

⚠ FY2009 is separately unreadable — 26KB of text and **one** money token in the
entire document — but it sits below the floor anyway, so no deviation is
claimed for it.

**Window: FY2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025 = 10
fiscal years, 20 rows, from 9 PDFs** (FY2022 and FY2023 share ARN 1036127).

⚠ FY2003–FY2015 are excluded by the floor rule, **not because they are
unreadable** — FY2010–FY2015 parse fine on a different config. Their
`excludedYears` reasons must say so, or a later reader records Duvall as harder
than it is.

## 6. Amounts are whole dollars in the window

FY2016+ print whole dollars (`5,591,355`). ⚠ FY2015 and earlier print **cents**
(`5,837,971.11`), which would need `decimal_money=True` — another reason the
era boundary is real, and a trap if the window is ever extended downward
without re-reading this section.

## 7. What this predicts for the extractor

```python
statement_anchor       = 'Fund Resources and Uses Arising from Cash Transactions'
leading_account_code   = True     # true of the document; defence in depth, see §4
target_column          = 1        # ⚠ NOT 0 — the memo column is first
target_column_label    = 'General Fund'   # else the tree is rooted "Fund column 1"
target_column_header   = '001 General'    # ⚠ NOT '001 General Fund' — see below
select_fiscal_year     = True     # ⚠⚠ the biennial ARN, see §5 and the note below
units                  = 1
fy_end                 = ('December', 31)
decimal_money          = False    # whole dollars in this window only
multipage              = False    # the GF column is on the FIRST page of the set
revenue_total_labels   = ('total revenues:',)   # ⚠ the trailing colon is printed
source_rounding        = {(2025, 'revenue'): -1, (2025, 'operating'): 1}
```

**⚠ `target_column_header` is `'001 General'`, not `'001 General Fund'.**
`-table` renders the header block COLUMN-WISE, so the neighbouring columns'
text falls BETWEEN `001 General` and `Fund`:

```
                      Total for All                        102
                      Funds             001 General         Transportation
                      (Memo Only)       Fund        101  Street Fund
```

No contiguous match — whitespace-squashed or not — can span those two words.
`001 General` alone is present in every year of the window (FY2016–FY2020 print
it `001  GENERAL`, which squashes the same) and appears on exactly ONE
qualifying page per fiscal year.

**⚠⚠ THE BIENNIAL DOCUMENT PRINTS FY2023 FIRST AND FY2022 SECOND.** Measured on
ARN 1036127: `find_statement_pages` returns chunks `[11, 17]`, and chunk 11 is
**FY2023**. The "earliest qualifying page" rule — the library's default, and
what the plan assumed would be wrong only for FY2023 — would in fact have
published **FY2023's money under the FY2022 label**. The error is inverted from
the obvious guess, which is exactly why the page is selected by the year it
prints rather than by its position.

**⚠ FY2025 disagrees with itself by $1, on BOTH sides, in opposite
directions.** Read off the General Fund column: revenue components sum to
7,260,303 against a printed `Total Revenues: 7,260,304`; expenditure components
sum to 7,101,535 against a printed `Total Expenditures: 7,101,534`. Every
component matches the page digit for digit, so the document is internally
inconsistent — this is not a mis-parse. Both are registered as EXACT deltas,
never as a tolerance, and the roster's `expectedResidues: 2` asserts the count.
The other nine years tie at a bare $0 on both sides.

⚠ The statement repeats across several pages, one per group of funds, with the
same rows and DIFFERENT fund columns. `001 General Fund` is on the FIRST page
every time. Selecting a later page would read a different fund's money under
the General Fund label.

⚠ FY2022 and FY2023 come from ONE PDF carrying both statements. Page selection
must be by the statement's own printed year — see `select_statement_for_fy`.
