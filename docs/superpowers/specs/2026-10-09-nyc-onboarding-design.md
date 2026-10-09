# New York City onboarding — ACFR, two scopes, 24 years

**Date:** 2026-10-09
**Status:** design, approved in chat 2026-10-09
**Branch:** `feat/nyc-onboarding`
**Spike:** 2026-10-09, reported in chat. Every figure below was **measured**
during that probe against the actual PDFs. Nothing is carried from another
entity and nothing is inferred from a publisher's own description.

Onboard the **City of New York** — TT's first New York local government, and
its largest city entity by an order of magnitude. Source of record is the NYC
Comptroller's ACFR (audited GAAP). Two fund scopes, both datasets, FY2002
through FY2025.

---

## 1. Why the ACFR, and not the two alternatives

Three candidates were probed. Two are ruled out on evidence, not preference.

### 1.1 NYS Comptroller Open Book — cannot serve NYC

OSC publishes revenue, expenditure, debt and tax-cap data for 3,100 local
governments in six classes, back to 1999, as free CSV. It is the obvious
statewide bulk route — the PA DCED / FL DFS / MI F-65 shape — and it is the
right basis for a future `NY-LOCALS-01` milestone.

It **does not carry New York City**. OSC's own download page states the most
recent year available for "City of New York: Summary of Data" is **2010**, and
directs the reader to Checkbook NYC instead. The statewide route and the NYC
route are therefore genuinely separate work, not two paths to the same place.

### 1.2 NYC Open Data (Socrata) — right detail, wrong basis

`data.cityofnewyork.us` dataset `mwzb-yiwb` ("Expense Budget") is live, free and
needs no key, with a deep hierarchy: agency → unit of appropriation → budget
code → object class → object code. That is a richer icicle than the ACFR can
give.

It is **adopted/modified budget**, not audited actuals, and is republished three
times a year as the budget moves. Seeding TT's largest city on budget figures
labelled as actuals is exactly the LA-TRAN error. Deferred — see §7.

### 1.3 NYC ACFR — audited, durable, and it ties

Chosen. Audited GAAP actuals, unmodified opinions, durable per-year URLs back
two decades, and a $0 tie on every year in the window.

---

## 2. The documents

Base: `https://comptroller.nyc.gov/wp-content/uploads/documents/`

All 25 years FY2001–FY2025 were requested; **all returned HTTP 200**. Three
naming eras, plus one year that is not derivable:

| Fiscal years | Filename pattern |
|---|---|
| FY2001–FY2011 | `cafr{YYYY}.pdf` (lowercase) |
| FY2012–FY2020 | `CAFR{YYYY}.pdf` (uppercase) |
| FY2021–FY2024 | `ACFR-{YYYY}.pdf` |
| FY2025 | `ACFR-2025-7-28-2026.pdf` |

⚠⚠ **FY2025's filename cannot be derived from the year.** It carries a date
stamp unrelated to the fiscal year. It must be an explicit entry in the
per-FY `SOURCES` map, and the next year's filename must be **looked up, never
constructed**. A loader that builds FY2026's URL by pattern will 404 or, worse,
silently fetch the wrong document.

Casing is load-bearing: `cafr2015.pdf` returns 404 while `CAFR2015.pdf`
returns 200, and vice versa for 2010. Both were tested in both cases.

### 2.1 Statement and units

The target is each book's **Governmental Funds — Statement of Revenues,
Expenditures, and Changes in Fund Balances**. Six columns:

    General Fund | Capital Projects Fund | General Debt Service Fund |
    Nonmajor Governmental Funds | Adjustments/Eliminations | Total Governmental Funds

- **Units = thousands.** The caption reads `(in thousands)`. Multiply by 1,000
  to store dollars. ⚠ A units error is invisible to the tie gate — every figure
  on the page scales together.
- **FYE June 30** → `source_date = {FY}-06-30`, and
  `fiscal_year_start_month = 7` **set explicitly**. Never left to the column
  default, which has lied on ~18,700 rows before.

### 2.2 Each book prints two years

Every ACFR carries the current year and the prior year side by side. This is a
free third oracle: FY*n* can be read from both the FY*n* book and the FY*n+1*
book and the two must agree. The spike used this and it held everywhere in the
window.

---

## 3. The window: FY2002–FY2025

**24 fiscal years.** FY2001 is excluded.

### 3.1 The floor rule

FY2001's own book is **pre-GASB-34** and does not tie: General Fund
expenditures come to 29,915,559 against a printed 37,264,424, a delta of
**−7,348,865** (thousands). The statement is a different animal — the old
combined all-fund-types presentation — and no column config rescues it.

FY2001's figures *are* readable from the FY2002 book's prior-year column, where
they tie at $0. They are **restated** and differ from what FY2001 itself
printed:

| | FY2001 as printed in FY2001 | FY2001 as printed in FY2002 |
|---|---|---|
| GF revenues | 40,231,872 | 40,198,471 |
| GF expenditures | 37,264,424 | 37,260,303 |

Loading a restated figure under a year whose own audited document says
something different is a provenance lie. **The window starts at FY2002.**

### 3.2 Measured result across the window

The spike ran a tie gate over every book in the window, both years in each
book, both datasets, both scopes:

> **192 tie checks. 0 failures.**

(24 books × 2 years printed × 2 datasets × 2 scopes.)

Bookends, in thousands:

| | FY2002 GF | FY2024 GF | FY2024 Total Gov |
|---|---|---|---|
| Revenues | 40,385,721 | 112,387,407 | 115,782,787 |
| Expenditures | 39,498,314 | 105,270,980 | 130,706,031 |

---

## 4. Entity

One new row in `treasury.municipalities`.

| Field | Value | Why |
|---|---|---|
| `name` | `New York City` | ⚠ **Not** `New York` — that is the existing state node (`1a7f871c-7f2e-4786-9c55-5ab3409716f4`). A bare "New York" collides in every name-keyed lookup and in `?entity=` alias resolution. |
| `entity_type` | `city` | Existing type. No new `entity_type` declaration, so the six-declaration rule is not engaged. |
| `state` | `NY` | |
| `county_id` | `NULL` | **The nav decision** — see §4.1. |
| `geoid` | `3651000` | FIPS place code. |
| `population` | ~8.26M | For per-capita. Sourced at load, not hardcoded blind. |

### 4.1 Hierarchy — NYC sits beside the state node

TT's usual shape is state → county → city. NYC breaks it: the city is **larger
than every county inside it**, and contains five of them.

**The ordering principle is size, not entity type — large to small.** NYC
therefore occupies the tier a county normally would, directly beneath the New
York state node. If the five boroughs are ever loaded they nest *under* NYC,
not above it.

This needs **no schema change**. `municipalities.county_id` is nullable and
**322 existing cities already carry `NULL`**, so a city hanging directly off its
state is an established, supported shape.

---

## 5. Extraction

### 5.1 A thin wrapper — no shared-library change

`scripts/extractNYC.py`, supplying a `CityConfig` to the existing
`scripts/lib/acfrGF.py`. The one non-default option:

    exclude_ignore=('reconciliation', 'net position')

**Why.** NYC prints the government-wide reconciliation note at the foot of the
genuine primary statement:

> "The reconciliation of the net change in fund balances of governmental funds
> to the change in net position of governmental activities in the Statement of
> Net Position is presented in an accompanying schedule."

That single sentence puts both `reconciliation` and `net position` — two
`_EXCLUDE` terms — on the right page. With the default list, **every year in
the window reports "primary GF statement not found"** and NYC gets no series at
all.

This is not a new failure mode. It is precisely the Buncombe County case, and
`scripts/extractBuncombeCounty.py` already ships the identical pair for the
identical reason. Naming the terms per-entity is narrower than weakening
`_EXCLUDE`, which twenty-odd other entities rely on.

⚠ **A correction to the spike's first reading.** The spike initially reported
that `nonmajor` was a second instance of this trap. That was wrong —
`nonmajor` was an exclusion the throwaway probe had invented for itself. The
real `_EXCLUDE` is `('combining', 'reconciliation', 'budgetary', 'budget and
actual', 'proprietary', 'fiduciary', 'net position')` and has never contained
it. No playbook update is owed.

### 5.2 ⚠⚠ The blank cell — a diagnosed layout hazard

Some expenditure rows print **five cells where their neighbours print six**,
because the Adjustments/Eliminations cell is **empty — not a dash**. FY2015,
`Public safety and judicial`:

    General government          2,468,539  789,667  --  128,008  --  3,386,214   ← 6 cells
    Public safety and judicial  8,826,839  302,856  --  --           9,129,695   ← 5 cells

A reader that materialises `--` as zero and then trusts the token *count* drops
this row. Token count alone cannot tell you *which* column is blank.

**Measured, exactly.** In each of FY2015–FY2018 there is precisely **one**
five-cell row, it is **`Public safety and judicial` every time**, and its Total
Governmental figure is exactly the amount the spike's naive reader lost:

| FY | Five-cell row | Total Gov figure dropped |
|---|---|---|
| 2015 | Public safety and judicial | 9,129,695 |
| 2016 | Public safety and judicial | 9,652,787 |
| 2017 | Public safety and judicial | 10,058,916 |
| 2018 | Public safety and judicial | 10,418,804 |

FY2019 and later are clean — no five-cell rows. The hazard is a four-year
window, one function, not a general property of the corpus.

This hazard touches the **Total Governmental column only** — the General Fund
is column 0 and is never the blank one.

### 5.3 ⚠⚠ The open question this spec does NOT resolve

The spike's 192/192 came from a **throwaway reader** that took the right-most
token on each row as the Total column. That is not necessarily what
`acfrGF.py`'s `target_column='last'` does: the playbook records that its two
strategies resolve `'last'` against **different column counts** — `ordinal`
counts dash-runs, `positional` cannot anchor an all-dash column.

**Task 1 of the implementation plan is to verify that `acfrGF.py`'s own
`'last'` reproduces 96/96 on NYC, before anything is written.** It is an open
question, deliberately not assumed away.

If it does not reproduce, §5.2 is a *diagnosed mechanical failure of the
`-table` reader*, which is the stated bar for moving an entity to
`scripts/lib/acfrGfCoords.py` (pdfplumber glyph x-coordinates, which read a
blank cell correctly because they never consult a token count).

⚠⚠ **That choice is made per ENTITY, on a stated reason — never per year.**
Picking whichever reader tied $0 in a given year is curve-fitting, the error
that got the LA-01 scope verdict retracted.

---

## 6. Two scopes, two series

Each year is extracted **twice**:

| `target_column` | `fund_scope` | FY2024 revenue (thousands) |
|---|---|---|
| `0` | `general_fund` | 112,387,407 |
| `'last'` | `total_governmental` | 115,782,787 |

SCOPE-02 widened the unique index so one city-year can hold two published
figures, so this needs no schema work.

**Why both.** NYC's General Fund is 97.1% of total governmental *revenue* but
only **80.5% of total governmental expenditure** — the Capital Projects Fund
spent $14.5B in FY2024 alone. A GF-only load would render the largest municipal
capital program in the United States invisible while appearing complete.

### 6.1 Row shape

    24 fiscal years × 2 datasets (operating, revenue) × 2 scopes = 96 budget rows

`dataset_type='operating'` is spend-by-function; `dataset_type='revenue'` is
revenue-by-source. Both are new on this entity — there is no NASBO or prior
series to replace, so both are pure inserts.

### 6.2 Grading

Every row is **audited GAAP actuals**, `basis` stamped accordingly, each with a
per-year `source_url` and `source_date`. No self-reported or unaudited rows.
The opinion is **unmodified** across the window — the spike confirmed the
"present fairly, in all material respects" language in FY2002, FY2010, FY2018,
FY2024 and FY2025.

⚠ An opinion gate must not match `qualified` inside `unqualified`. That has
bitten before.

---

## 7. Out of scope

- **The five boroughs.** Bronx, Kings, Queens, New York and Richmond counties
  are not independent governments and publish no ACFR of their own. Nothing to
  load.
- **NYC Open Data agency-level detail** (§1.2). A later enrichment pass for
  icicle depth, on a clearly budget-basis label. Not this work.
- **The rest of New York's ~1,500 locals via OSC Open Book** (§1.1). A real
  milestone, and genuinely separate — OSC cannot serve NYC.
- **Checkbook NYC** (actual per-transaction spending). Not evaluated in the
  spike.
- Any change to `scripts/lib/acfrGF.py`. §5.1 is a per-entity config, not a
  library edit.

---

## 8. Verification

1. **Per-FY tie gate, refusing to write.** Each year's extracted category sum
   must equal the printed `Total revenues` / `Total expenditures` for the
   column being read. `validate(fy)` returns false and the loader
   `process.exit(2)` on any mismatch. Both scopes, both datasets — 96 checks.
2. **Independent corroboration.** `exclude_ignore` *widens* which pages can
   qualify, and the library's own docstring requires that it be paired with
   evidence the chosen page is the right one. Re-derive every year through
   `scripts/lib/acfrGfCoords.py`, which shares no code and no strategy with the
   `-table` reader. This is the Buncombe / `verify-nc.mjs` pattern.
3. **Cross-book agreement.** FY*n* read from the FY*n* book must equal FY*n*
   read from the FY*n+1* book (§2.2), for all 23 overlapping pairs.
4. **Idempotence.** A second run writes 0 net new rows.
5. **Live UAT** on the rendered city page before the milestone is tagged.

---

## 9. Things that will bite

- **FY2025's filename is not derivable** (§2). Look the next one up; never
  construct it.
- **The blank Adjustments cell** (§5.2) silently removes a whole function from
  Total Governmental expenditures. It is caught by the tie gate only because
  the gate compares against the *printed* total.
- **`fiscal_year_start_month` must be set to 7 explicitly.** The column default
  has lied before.
- **Units are thousands** and a units error ties at $0.
- **`treasury_sync_city_budget` keys on fund_scope+basis, not data_source.**
  With two scopes on one city-year this matters more here than usual — omitting
  a key on a re-run duplicates rows.
- **A budget-row key that omits the SOURCE silently relabels.**
- **`py` / `python` on PATH may be Microsoft Store stubs.** Use
  `scripts/lib/pythonBin.mjs` `resolvePython()`, never a hardcoded path.
- **`docs/*` is gitignored** — this spec and its plan are force-added
  (`git add -f`).
- **No shebang on anything under `scripts/lib/`.**
- **FY2018's audit-opinion page has an interleaved text layer**
  (`deritaollrys,atchceepfitnedanicniathl...`). The statement pages themselves
  are clean, but an automated opinion-detection gate will misread that page.
- **Branch and open a PR.** Never push directly to `main`.
