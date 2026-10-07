# Redmond, WA — recon evidence

**Date:** 2026-10-06 · **MCAG:** 0425 · **Window:** FY2011–FY2024 less FY2017–FY2019 (11 years)

Every decision below was read from Redmond's own statements. None was carried
from another entity — deriving a config from a neighbour is how Kent's band
would have rejected a correct Everett load.

---

## 1. Page identity — ONE candidate in all 11 years

`findStatementPage()` returned exactly one candidate page per year. Ambiguous
page identity is fatal, not a warning: during WA-CITIES-01 Task 5, nine of ten
silent wrong-page hits tied at $0.

| FY | page idx | FY | page idx | FY | page idx |
|---|---|---|---|---|---|
| 2011 | 24 | 2015 | 31 | 2022 | 39 |
| 2012 | 26 | 2016 | 32 | 2023 | 33 |
| 2013 | 28 | 2020 | 33 | 2024 | 42 |
| 2014 | 31 | 2021 | 38 | | |

**No wrong-page trap exists in this corpus.** Unlike Spokane (whose `Schedule of
General Fund Accounts` Total column equals the basic statement's GF column) and
Vancouver FY2021 (an identically-titled p.2), Redmond prints the governmental
funds statement once.

## 2. Units — whole dollars, all 11 years

`unitsOf()` returned `1` for every year. No "(in thousands)" caption anywhere.
Like Spokane, Vancouver, Kent and Everett; **unlike Tacoma and Bellevue**.

⚠ The tie gate is unit-invariant, so the per-capita band is the only guard that
fires on a wrong multiplier. Redmond's band is derived in Task 5.

## 3. Tree shape — read from true printed geometry

`printedIndents()` (`-lineprinter` true geometry, not `-layout`, which reflows
this issuer's pages badly). **Three levels, consistent across the whole window:**

| | FY2011 | FY2016 | FY2024 |
|---|---|---|---|
| section header (`revenues`, `expenditures`) | x=34 | x=55 | x=45 |
| level 1 (`taxes`, `current`, `capitaloutlay`, `debtservice`) | x=37 | x=58 | x=48 |
| level 2 (`generalgovernment`, `principal`) | x=40 | x=60 | x=50 |

The absolute offsets shift between years; **the three-level relationship does
not.**

**Decisions:**
- `parents = ('current', 'debt service')` — both sit at level 1 with level-2
  children beneath them, in every year checked.
- `root_leaves = ('capital outlay',)` — sits at level 1, a **peer** of the two
  parents, carrying its own value.
- `revenue_parents = ()` / `revenue_group_members = ()` — the revenue side is
  flat in every year: every item sits at level 1 with no group heading and no
  wrapped label.

⚠ This is the same shape as Everett, **and that is a finding, not an
assumption.** Bellevue prints `Capital outlay` as a PARENT where five other WA
cities print it as a valued root leaf, and the wrong guess still ties at $0.

⚠ Child labels vary by year and the structure does not: FY2011 prints `security
of persons and property`, `physical environment`, `mental physical health`;
FY2024 prints `public safety`, `social services`. Different rows, same tree.

## 4. Column strategy — POSITIONAL, `target_column = 0`

**`ordinal` is unsafe here.** The documented test is "no incomplete rows ⇒
ordinal is safe" (Everett passed it with zero in 21 filings). Redmond fails it
in every year: rows carry 3 cells where the statement's widest row carries 5,
because a fund with no amount in a column is printed blank rather than dashed.

| FY | widest row | rows with fewer cells |
|---|---|---|
| 2011 | 5 | 30 |
| 2016 | 5 | 33 |
| 2020 | 5 | 20 |
| 2024 | 5 | 28 |

So `column_strategy='positional'`.

**`target_column = 0`** — the General Fund is the **leftmost** money column:
`General Fund | Capital Improvements Program Fund | Other Governmental Funds |
Total Governmental Funds`.

⚠ Positional dies when `-table` scatters a column across disjoint horizontal
zones (Bellevue FY2008/09, Kitsap FY2004–16). The tie gate in Task 6 is what
proves it did not happen here; if a year fails to tie, this is the first thing
to re-examine.

## 5. Label hazards — none found

- **Leading margin rule welding onto a label** (3+ underscores, 2+ space gap,
  then a letter): **not present.** `_recover_label_past_leading_rule` found this
  in WA SAO filings only, so it was checked explicitly here. No label on any of
  the 11 statement pages begins with underscores.
- **A number inside a label** (`Fire District # 37 Contract`): the only
  digit-bearing labels are `Transfers in (Note 10)` / `Transfers out (Note 10)`,
  which sit in the OTHER FINANCING SOURCES section, below `Total expenditures`
  and outside both extracted sections.
- **A row printed empty in every column:** none observed. Redmond prints a value
  or a dash in the General Fund column on every line item inside both sections.

## 6. What this predicts for the extractor

```python
parents=('current', 'debt service')
root_leaves=('capital outlay',)
revenue_parents=()
revenue_group_members=()
column_strategy='positional'
target_column=0
units=1
fy_end=('December', 31)
```

No `statement_anchor` (the caption is the library default form in all 11 years —
the singular `Changes in Fund Balance` appears only in FY2006, which is outside
the window). No `label_fixes` (no letter-spacing, no page furniture, no damaged
headings). No `empty_rows`. No `multipage` (the two-page split is FY2007–FY2010,
also outside the window).
