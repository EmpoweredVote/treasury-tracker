# AUSTIN-TRAVIS-01 — classification reconciliation (evidence of record)

**Date:** 2026-08-19
**Purpose:** the evidence behind the `tx-local-acfr-gf` entries added to
`scripts/data/fundScopeRegistry.mjs`, `basisRegistry.mjs` and
`reportingEntityRegistry.mjs`.

Companion to `AUSTIN-TRAVIS-01-CLOSEOUT.md`, which covers the load itself.
Written in the shape SCOPE-01-RECON.md establishes: one section per axis, each
naming the document read and writing out the figures that actually matched.

---

## 0. What is being classified

The 76 rows loaded by AUSTIN-TRAVIS-01, addressed by one anchored pattern:

```js
/^(City of Austin|Travis County) ACFR — General Fund /
```

Measured against `treasury.budgets` on 2026-08-19:

| Filter | Rows |
|---|---|
| `data_source LIKE 'City of Austin ACFR — General Fund%'` | **32** |
| `data_source LIKE 'Travis County ACFR — General Fund%'` | **44** |
| **claimed by this entry** | **76** |

Each of the 76 rows carries a distinct `data_source` string (the fiscal year is
embedded in it), so 76 rows = 76 strings.

### 0.1 The pattern does not over-match — checked, not assumed

The registry's standing warning is that a reasonable-looking pattern claims rows
no reconciliation covers. The tempting general pattern here is
`/ ACFR — General Fund/`, and it is **wrong**: it matches **1,784** rows.

| Family | Rows | Note |
|---|---|---|
| `% State ACFR — General Fund%` | 1,448 | already owned by `state-acfr-gf` |
| this entry's two entities | 76 | in scope |
| **16 other entity families** | **260** | **NOT in scope — no evidence here** |

Those 260 are city/state ACFR loads from earlier milestones, all currently
`fund_scope = unknown`: City of Bend 36, State of Minnesota 36, City of Seattle
34, City of Sherwood 22, City of Tucson 20, City of Beaverton 12, Marana 12, Oro
Valley 12, Sahuarita 12, State of Ohio 12, City of Hillsboro 10, City of Tualatin
10, City of Cornelius 8, City of Tigard 8, South Tucson 8, State of Virginia 8.

They are left `unknown` deliberately. This reconciliation read the Austin and
Travis statements; it did not read Bend's or Tucson's, and the registry's rule is
that a scope is asserted only for what was actually reconciled. **Anchoring to
the two entity names is what keeps this entry honest** — and it also means a
future Texas city ACFR load will land `unknown` until someone evidences it, which
is the intended failure direction.

*(Noted in passing, not acted on: three of those families are STATE ACFRs whose
labels read `State of Minnesota ACFR — …` rather than `… State ACFR — …`, so
`state-acfr-gf`'s pattern misses them. That is a pre-existing gap in another
entry, outside this milestone's scope.)*

---

## 1. `fund_scope` = `general_fund`

**Method — the same one `state-acfr-gf` and `wa-sao` use.** These ACFRs *are* the
source the loader read, so the reconciliation is not against a second reporter.
It establishes **which column of the statement the stored figure is**, which is
the question that decides scope. The discriminator is the printed *Total
Governmental* column on the same row of the same statement: if the stored figure
equalled that, the scope would be `total_governmental`.

Three probes across two entities, two unit conventions, and both of Austin's
label eras.

### 1.1 City of Austin FY2024 — statement p50, Exhibit B-2, "(In thousands)"

| Row | General Fund | Nonmajor | Total Governmental | GF share |
|---|---|---|---|---|
| Total revenues | **1,280,826** | 935,569 | 2,216,395 | 57.8% |
| Total expenditures | **1,347,127** | 1,534,052 | 2,881,179 | 46.8% |

Stored: `$1,280,826,000` and `$1,347,127,000` — the General Fund column
**exactly**, scaled by the printed "(In thousands)".

Columns sum exactly: `1,280,826 + 935,569 = 2,216,395` and
`1,347,127 + 1,534,052 = 2,881,179`, confirming the Total Governmental column
was read correctly and that the General Fund is a strict subset of it.

### 1.2 City of Austin FY2015 — statement p50, "(In thousands)"

Deliberately a second Austin year, from the earlier of the two label eras
(FY2010–FY2017 print six `Current` functions; FY2018+ print five):

| Row | General Fund | Nonmajor | Total Governmental | GF share |
|---|---|---|---|---|
| Total revenues | **736,921** | 329,347 | 1,066,268 | 69.1% |
| Total expenditures | **878,869** | 417,947 | 1,296,816 | 67.8% |

Stored: `$736,921,000` and `$878,869,000` — **exact**. Columns sum exactly
(`736,921 + 329,347 = 1,066,268`; `878,869 + 417,947 = 1,296,816`).

### 1.3 Travis County FY2024 — statement pp58–59, whole dollars

Travis prints six major fund columns across two pages, with the General Fund
first on p58 and the `Total` column on the continued page p59:

| Row | General Fund | Total Governmental | GF share |
|---|---|---|---|
| Total revenues | **1,030,822,292** | 1,309,590,625 | 78.7% |
| Total expenditures | **888,757,389** | 1,318,378,253 | 67.4% |

Stored: `$1,030,822,292` and `$888,757,389` — **exact**.

All seven columns sum to the printed total exactly, on both sides:

* revenues `1,030,822,292 + 109,443,335 + 111,447,942 + 4,521,051 + 4,410,693 + 8,098,091 + 40,847,221 = 1,309,590,625` ✓
* expenditures `888,757,389 + 108,997,405 + 109,380,269 + 108,898,522 + 33,576,499 + 26,595,832 + 42,172,337 = 1,318,378,253` ✓

Cross-check on the Total Governmental figures: `1,309,590,625 − 1,318,378,253 =
−8,787,628`, which is the printed "Excess (deficiency) of revenues over
expenditures" total on the same statement.

### 1.4 Why not any other scope

`general_fund` is exact on all three probes. `total_governmental` would be wrong
by 42.2% / 53.2% (Austin FY2024), 30.9% / 32.2% (Austin FY2015) and 21.3% /
32.6% (Travis FY2024). `all_funds` is further still — neither statement includes
proprietary funds at all (Austin Energy, Austin Water, the airport and Travis's
TCHFC and internal service funds are all outside the governmental-funds
statement).

**Two units, one conclusion.** Austin prints in thousands and Travis in whole
dollars. The tie holding on both confirms the loader normalised units per
document rather than assuming one scale — the same property `wa-sao` gets from
Spokane-vs-Tacoma. This matters here because `units` is invisible to the tie
gate (see the closeout, §2 FY1998–FY2001).

---

## 2. `basis` = `actual`

**Document:** the two entities' ACFRs — audited Annual Comprehensive Financial
Reports for closed fiscal years, both with an unmodified opinion.

**Figures:** every stored figure is the printed General Fund column of the
governmental-funds *Statement of Revenues, Expenditures and Changes in Fund
Balances* — a year-end GAAP actual, tying exactly at §1.1–1.3 above. These are
statements of what was received and spent, not appropriations: the same
documents' budgetary comparison schedules present budget and actual in separate
columns, and it is the fund statement, never the budget schedule, that was read
(`acfrGF.py` excludes any page whose title carries `Budgetary` or `Budget and
Actual`).

The whole window is closed: FY2025 ended 2025-09-30 and both FY2025 reports are
published and audited. No row is a forecast or an adopted appropriation.

---

## 3. `reporting_entity` = `primary_government`

**Document:** Note 1 (Summary of Significant Accounting Policies — Reporting
Entity) and the Overview of the Financial Statements in each FY2024 ACFR.

**The structural argument, identical to `wa-sao` and `state-acfr-gf`:** the
stored figure is the printed General Fund column of the *fund* financial
statements. Under GASB 34, discretely presented component units appear only in
the government-wide statements, in their own separate column — never in a
governmental-funds column. So the stored figure cannot contain them.

Both documents say so in terms:

* **Austin** — nine discretely presented component units (ABLE, ACE, Austin
  Transit Partnership, Sobriety Center, Central Housing LP, Hyde Park Housing LP,
  Rally Austin, Retreat at North Bluff LP, Waller Creek LGC): *"these entities
  are legally separate entities that do not meet the GASB reporting requirements
  for inclusion as part of the City's operations; therefore, data from these
  units are shown separately from data of the City."*
* **Travis County** — *"the government-wide financial statements include not
  only the County itself (known as the primary government), but also the
  following legally separate entities … which are blended."*

**Corroboration on the blended units** (which, unlike discrete ones, *are* inside
the primary government's funds by GASB 34, exactly as they are for every other
`primary_government` entry in this registry): Austin's Note 1 names a "Reporting
Fund" per blended unit, and the ones it names are **not the General Fund** —
Austin Energy (a major *proprietary* fund), the Austin Housing Finance
Corporation fund (a *nonmajor special revenue* fund) and the Urban Renewal Agency
fund (a *nonmajor special revenue* fund). Travis's blended units are eight
governmental entities plus TCHFC, which is reported in *business-type* activities
via an enterprise fund. Travis's General Fund is one of six major governmental
funds.

**Contrast with the case that forced this axis to exist:** MN OSA is
`incl_component_units` because the OSA re-aggregates HRA/EDA/TIF activity that
the city's own ACFR presents separately — Bloomington FY2022 reads $148.3M at OSA
versus $121.8M total governmental in the ACFR, +21.7%. Nothing of that kind
happens here: the figure is read *from* the ACFR's own fund statement, not
re-aggregated from a state chart of accounts.

---

## 4. Row-count gates updated

| Constant | File | Added |
|---|---|---|
| `EXPECTED_ROWS` | `scripts/classifyFundScope.mjs` | `'tx-local-acfr-gf': 76` |
| `EXPECTED_BASIS_ROWS` | `scripts/stampBudgetAxes.mjs` | `'tx-local-acfr-gf': 76` |
| `EXPECTED_REPORTING_ENTITY_ROWS` | `scripts/stampBudgetAxes.mjs` | `'tx-local-acfr-gf': 76` |

76 is a **new** family, not a change to an existing measurement — no pre-existing
count moved, so the partition gates for every other entry are untouched.
