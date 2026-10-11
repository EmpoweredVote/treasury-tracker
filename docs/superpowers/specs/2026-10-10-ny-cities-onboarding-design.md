# New York cities onboarding — design

**Date:** 2026-10-10
**Status:** draft, awaiting review
**Scope:** all 61 New York cities other than New York City
**Related:** [NYC onboarding](2026-10-09-nyc-onboarding-design.md) (PR #243), SCOPE-01/02 axis work

---

## 1. Goal

Load General Fund **and** Total Governmental revenue and expenditure series for
**every New York city except NYC** — 61 entities — from a single free statewide
source, for **FY1995–FY2021**, the window in which all 61 filed.

New York currently has exactly two rows in `treasury.municipalities`: the state
node and New York City. This spec takes NY from 2 entities to 63.

### Non-goals

* **NYC is out.** It is already loaded from its own ACFRs (PR #243) and is
  absent from this source entirely — OSC files it as a separate `cityny`
  dataset. There is no collision and no reconciliation to do.
* **Counties, towns, villages, fire districts and school districts are out.**
  They are available by the identical mechanism (§2) and are the obvious
  follow-on, but each is a separate load with its own fund letters and its own
  verification. Shipping 61 cities first proves the pipeline.
* **FY2022+ is out of the initial load.** Those years are still filling in
  (§3). Adding them later is a re-run, not a rework.

---

## 2. The source

**NY Office of the State Comptroller, Local Government Financial Data.**
Free, no key, no auth, no ToS gate, no rate limit encountered.

### ⚠ The download form is not a form

`wwe1.osc.state.ny.us/localgov/findata/financial-data-for-local-governments.cfm`
posts to `detailedzip.cfm` and looks like a stateful ColdFusion/ASP.NET app.
It is not. The POST responds **302 → a static file**:

```
https://wwe1.osc.state.ny.us/localgov/findata/level3zip/city_all_years.zip
```

A plain `GET` on that URL returns the file. No ViewState, no session, no
handshake. This is the third ViewState-looking app in TT's history that turned
out to be a static file behind a redirect (PA DCED, Georgia, now NY) — the
standing lesson applies: **probe before classifying an app by its framework.**

Sibling files, all confirmed HTTP 200 on a bare GET:

| File | Size |
|---|---|
| `city_all_years.zip` | 12.5 MB |
| `county_all_years.zip` | 18.9 MB |
| `village_all_years.zip` | 46.5 MB |
| `town_all_years.zip` | 86.3 MB |
| `firedistrict_all_years.zip` | 8.0 MB |
| `schooldistrict_all_years.zip` | 111 MB |

The zip holds one CSV per year, `YYYY_City.csv`, **1995–2026** (32 files).

### 2.1 ⭐ Kept on disk — `docs/NY/`, gitignored

Fetched 2026-10-10. `docs/*` is gitignored, so these sit on disk the way
`docs/NYC/*.pdf` does and are never committed:

| File | Size | SHA-256 |
|---|---|---|
| `city_all_years.zip` | 12,497,143 B | `b210d3eaa1cce6f4d06920f28a54a8279b559e91f1b8887d15d88bb139c0c84e` |
| `osc-accounting-and-reporting-manual-2021.pdf` | 1,614,494 B | the §5 evidence of record |
| `osc-chart-of-accounts-2021-05.pdf` | 1,092,113 B | account-code reference |

The fetch script must **skip any file already present**, so re-verification is
free. The archive is the complete 1995–2026 series in one file — there is no
per-year fetching to do and no reason to re-download 12.5 MB.

⚠ The two PDFs are the documentary basis for every fund classification in §5
and for the basis grade in §6. If they are deleted, those claims lose their
evidence and the registry entries must not be trusted until re-sourced.

---

## 3. Coverage

**61 distinct entities across the archive — every NY city except NYC.**

| Years | Cities filing |
|---|---|
| 1995–2021 | **61 every year** |
| 2022 | 59 |
| 2023 | 58 |
| 2024 | 57 |
| 2025 | 51 |
| 2026 | 3 |

The taper is filing lag against a `SNAPSHOT_DATE` of 2026-09-30, not missing
data. **FY1995–FY2021 is the complete window** and is what this spec loads:
27 fiscal years × 61 cities.

---

## 4. ⚠⚠ The schema changes in 2013 — two eras, one parser each

This is the PA DCED "pre-2015 is a different report" trap and the Ohio AOS
"county workbooks differ from city" trap, in a third state. **The column sets
are not the same and must not share a code path without an explicit adapter.**

| | **1995–2012** (18 files) | **2013–2026** (14 files) |
|---|---|---|
| Period | `FISCAL_YEAR_END` — `MM/DD`, **no year** | `PERIOD_START` + `PERIOD_END` — full ISO dates |
| Section | `FINANCIAL_STATEMENT` + `FINANCIAL_STATEMENT_SEGMENT` | `ACCOUNT_CODE_SECTION` |
| Category case | `GENERAL GOVERNMENT` (**UPPERCASE**) | `General Government` (**Title Case**) |

Columns common to both: `CALENDAR_YEAR`, `MUNICIPAL_CODE`, `ENTITY_NAME`,
`CLASS_DESCRIPTION`, `COUNTY`, `ACCOUNT_CODE`, `ACCOUNT_CODE_NARRATIVE`,
`LEVEL_1_CATEGORY`, `LEVEL_2_CATEGORY`, `OBJECT_OF_EXPENDITURE`, `AMOUNT`,
`SNAPSHOT_DATE`.

### 4.1 Section mapping

New era `ACCOUNT_CODE_SECTION` ∈ {`REVENUE`, `EXPENDITURE`, `GL`, `FBNP`}.
Old era maps as:

| `FINANCIAL_STATEMENT` | → section |
|---|---|
| `STATEMENT OF REVENUES AND OTHER SOURCES` | `REVENUE` |
| `STATEMENT OF EXPENDITURES AND OTHER USES` | `EXPENDITURE` |
| `BALANCE SHEET` | *excluded* |
| `CHANGE IN EQUITY` | *excluded* |

`GL` and `FBNP` (new era) and `BALANCE SHEET`/`CHANGE IN EQUITY` (old era) are
balance-sheet and fund-balance rows — **7,663 of 20,234 rows in FY2024 alone**.
Sweeping them into a revenue or expenditure tree would double-count badly.
Only `REVENUE` and `EXPENDITURE` rows are loaded.

### 4.2 ⚠ The label-case trap

`LEVEL_1_CATEGORY` is UPPERCASE before 2013 and Title Case after. Loaded
as-is, a single city's icicle would grow **two parallel branches** —
`GENERAL GOVERNMENT` for FY1995–2012 and `General Government` for FY2013+ —
and every category would appear twice across the series.

**Labels must be normalised to a single casing** before the tree is built, and
a test must assert that the distinct `LEVEL_1_CATEGORY` set is identical
either side of the 2012/2013 boundary once normalised. This is a weld-class
defect in the same family as the NYC `Current Operations:` finding: it moves no
money, so it ties at exactly $0 while being visibly wrong to a reader.

---

## 5. Fund scope

### 5.1 The fund is the account code prefix

Every `ACCOUNT_CODE` begins with a fund letter — `A1001`, `EW2140`, `H5031`.
**35 distinct prefixes** appear across the city archive. OSC's
[Accounting and Reporting Manual](https://www.osc.ny.gov/files/local-government/publications/pdf/arm.pdf)
Chapter 4, *Funds and Supplemental Schedules*, names each one and its type.
**The ARM is the evidence of record for every classification below** — no
prefix is classified by inference from its spending pattern.

### 5.2 General Fund

> "General Fund (A) — the principal operating fund of a local government. It
> includes all financial resources not accounted for and reported in another
> fund and is used to account for the ordinary day-to-day operations financed
> through taxes and other general revenues." — ARM ch. 4

`fund_scope = general_fund` is the `A` prefix alone. **All 61 cities carry an
`A` fund with both revenue and expenditure in every loaded year** (verified
against FY2021).

### 5.3 Total Governmental

`fund_scope = total_governmental` is the union of the governmental fund types
the ARM names:

| Type | Prefixes **observed in city data** | ARM wording |
|---|---|---|
| General | `A` | "the principal operating fund" |
| Special revenue | `CB`, `CD`, `CL`, `CM`, `CP`, `CR`, `CT`, `CU`, `FX`, `G`, `L` | "Special Revenue Funds include —" |
| Capital projects | `H` | "the capital projects fund (H)" |
| Debt service | `V` | "A single debt service fund will be maintained…" |
| Permanent | `PN` | "only earnings, not principal, may be used" |

⚠ The ARM also defines governmental prefixes that **cities never use** and
which do not occur anywhere in the city archive: `B` (general fund
town-outside-village), `D`/`DA`/`DB`/`DM` (highway and county road), `CN`
(health related facilities) and the `S_` special district family — all of them
town- or county-only. The registry should **not** silently accept them for a
city. If one ever appears, it is a sign the file changed, and §5.4's refusal
should fire.

**Excluded, with the ARM's own grouping:**

| Prefixes | Why |
|---|---|
| `EA EE EF EH EI EL EM EP ER ES ET EW` | "Enterprise Funds (E_) include Airports (EA), Electric Utilities (EE)…" — **proprietary** |
| `M` | Internal service fund — **proprietary** |
| `MS` | Self-Insurance. ARM ch. 4 places it in the proprietary group, and its own rows use **`Net Position`**, not fund balance — proprietary terminology |
| `TA TC TE TN TX` | "Fiduciary Funds … moneys received by the local government which must be held" |
| `K`, `W` | Not funds. The Schedules of Non-Current Governmental **Assets** (`K`) and **Liabilities** (`W`). They appear **only** in `GL`/`BALANCE SHEET` rows and never in revenue or expenditure, so §4.1's filter already removes them — but they are named here so a future reader does not "fix" their absence |

Across FY1995–2021 this splits 392,234 revenue/expenditure lines into
**368,870 governmental** and **23,364 excluded**.

### 5.4 ⚠ An unresolved prefix makes the year `unknown`, not short

`CS` (512 lines across the window) and any prefix not in the table above is
**not yet resolved against the ARM**. The destructive direction here is
declaring two cities comparable when they are not, so:

> If a city-year contains a revenue or expenditure prefix the registry cannot
> classify, that city-year's `total_governmental` is written as **`unknown`**,
> not silently summed without it.

Omitting an unclassified governmental fund understates the total; including an
unclassified proprietary fund overstates it. Both are wrong, and `unknown` is
a correct outcome — this is the rule `scripts/lib/fundScope.mjs` exists to
enforce. `general_fund` is unaffected, since `A` is unambiguous.

The loader must **fail loudly listing the unknown prefixes**, not skip quietly.

---

## 6. Basis and audit grade

⚠⚠ **These are FOUR independent axes and an earlier draft of this spec
conflated two of them.** `self_reported_unaudited` is an **`audit_grade`**
value; it is not a legal `accounting_basis`, whose vocabulary is
`gaap | modified_cash | cash | unknown`. Measurement and assurance are separate
questions — `scripts/lib/budgetAxes.mjs` says so at length, and the OCBOA
migration exists because they were once confused. The axes for this load:

| Axis | Value | Why |
|---|---|---|
| `basis` | **`actual`** | Closed-year reported actuals. The AFR reports what happened, not an appropriation |
| `audit_grade` | **`self_reported_unaudited`** | Filed *by the local government*. No opinion, no auditor, no audit flag in the dataset, and OSC's AFR page asserts no audit status |
| `accounting_basis` | **`unknown`** | See below |
| `reporting_entity` | **`unknown`** | Nothing read yet establishes whether component units are consolidated |
| `derivation` | **`derived`** | OSC publishes line items and **no total row**, so every total TT shows is a sum TT computed. `published` would misdescribe it |

### 6.1 ⚠ Why `accounting_basis` is `unknown`, not `gaap`

The ARM ch. 3 directs governmental funds to **modified accrual**, which is the
GAAP measurement focus — so `gaap` is tempting. It is not supported. Modified
accrual is the *measurement focus the ARM instructs*; whether a given city's
filing achieved GAAP is exactly what an audit opinion would establish, and
there is none. Asserting `gaap` would convert an instruction into an outcome
across 61 cities at once.

`unknown` is a correct outcome rather than a shortfall. An individual city can
be raised later on the evidence of its own ACFR — one city at a time, the way
the IN county route did it.

⚠ Every registry here creates an entry **only when its evidence is created**.
This spec authorises the `audit_grade` and `basis` entries, whose evidence is
named above. It does **not** authorise an `accounting_basis` entry.

---

## 7. Fiscal calendar — read, never assumed

The source gives the fiscal period per entity per year. NY cities do **not**
share one calendar; FY2024 alone shows five distinct year-ends:

| Year end | Rows (FY2024) |
|---|---|
| Dec 31 | 14,115 |
| Jun 30 | 4,226 |
| Mar 31 | 1,397 |
| Jul 31 | 249 |
| May 31 | 246 |

`fiscal_year_start_month` is derived from `PERIOD_START` (2013+) or from
`FISCAL_YEAR_END` + 1 month (1995–2012, where only `MM/DD` is given).

⚠ Per the FYSM arc: **a uniform result is not a correct result.** A gate that
asserts all 61 cities share a month would be asserting conformity to a
hardcode. The gate must instead assert that each entity's month is internally
consistent across its own years, and **report** the distribution rather than
flatten it. ⚠ Never carry a target month between entities.

---

## 8. Entity seeding

* **61 `treasury.municipalities` rows**, `entity_type = 'city'`, `state = 'NY'`.
* **Placement:** TT tiers by **size, not entity type**. These cities are all
  smaller than their containing counties (unlike NYC), so they nest normally.
  The CSV's `COUNTY` column gives the parent directly — no geocoding.
* **Keys:** `MUNICIPAL_CODE` (e.g. `010201000000` for Albany) is a stable OSC
  identifier and becomes `source_entity_key`. ⚠ Unlike MN OSA's counties, NY
  gives us a real id for every class — use it rather than matching on name.
* **Population:** from Census PEP via the existing `censusPep.mjs`, not from
  this source, which carries none.
* Seeding goes through `ensureMunicipality()`.

---

## 9. What gets written

Per city, per fiscal year, per dataset, per scope:

```
61 cities × 27 years × 2 datasets (operating, revenue) × 2 scopes
  = 6,588 budget rows at full coverage
```

Each row holds a hierarchy built from
`LEVEL_1_CATEGORY → LEVEL_2_CATEGORY → OBJECT_OF_EXPENDITURE`, which is a real
3-level tree and drills down properly in the icicle — unlike the flat Ohio AOS
sources, which dim to empty on a leaf click.

Writes go through `treasury_sync_city_budget`.

> ⚠⚠ **`treasury_sync_city_budget` keys on `fund_scope` + `basis`, NOT on
> `data_source`.** Omitting either parameter makes a re-run **duplicate** every
> row instead of updating it. This load writes two scopes, so it is directly
> exposed. Both parameters are mandatory on every call.

---

## 10. Verification

### 10.1 ⚠⚠ The tie is tautological and cannot be the test

OSC publishes **no total row**. TT's total is `Σ items` by construction, so
"total equals the sum of its items" is true automatically and proves nothing.
This is the Austin/Travis finding and it applies in full force here.

Verification needs an **independent oracle**: the cities' own ACFRs.

### 10.2 Evidence already obtained

City of Albany FY2024, account `A1120` (sales-tax distribution):

| Source | Figure |
|---|---|
| OSC AFR | **$46,685,814** |
| Albany's own Q4 2024 quarterly report | **$46,686 thousand** |

Match. (Albany's broader category subtotals differ from OSC's — OSC's uniform
chart of accounts groups differently. That is categorization, not error, and
the spec records it so a future reader does not chase it as a defect.)

### 10.3 Required before merge

1. **ACFR reconciliation on a sample of ≥5 cities** spanning both schema eras
   and at least three different fiscal calendars, General Fund revenue and
   expenditure totals, against the city's own audited statements.
2. **Era-boundary label test** — the normalised distinct `LEVEL_1_CATEGORY`
   set is identical either side of FY2012/FY2013 (§4.2).
3. **Scope test** — `general_fund ≤ total_governmental` for every city-year,
   and every excluded prefix is absent from the governmental sum.
4. **Completeness test** — all 61 cities present in all 27 years, both
   datasets, both scopes.
5. **Fiscal-calendar test** — per §7: internal consistency per entity, and the
   distribution reported, not flattened.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Two schema eras silently merged | §4 — explicit per-era adapter, era-boundary test |
| Label case splits every icicle branch in two | §4.2 — normalise, then assert equality across the boundary |
| An unclassified fund prefix quietly shortens a total | §5.4 — refuse loudly, write `unknown` |
| Tautological `$0` tie mistaken for verification | §10.1 — ACFR oracle required |
| Re-run duplicates rows | §9 — both RPC key parameters mandatory |
| Basis asserted without evidence | §6 — registry entry requires its citation or stays `unknown` |
| A uniform fiscal month treated as success | §7 — consistency per entity, not across entities |

---

## 12. Open questions for review

1. **`CS` and any other unresolved prefix** (§5.4) — resolve from the ARM
   during implementation, or ship with those city-years as `unknown`
   `total_governmental`? The spec currently says `unknown`.
2. **`derivation = derived` for the General Fund scope** (§6). Defensible
   either way: the line items are published, the total is not. Worth a second
   opinion before it is stamped on 6,588 rows.
3. **Counties next, or towns and villages?** Counties are 18.9 MB and 57
   entities; villages are 46.5 MB and several hundred. Out of scope here, but
   the ordering affects how the shared library is factored.

---

## 13. Scripts (proposed)

```
scripts/lib/nyOsc.mjs          era detection, section mapping, label
                               normalisation, fund-prefix registry (ARM-cited)
scripts/fetchNyOsc.mjs         GET the static zip; skip if present
scripts/seedNyCities.mjs       61 municipalities from MUNICIPAL_CODE + COUNTY
scripts/loadNyOscCities.mjs    build trees, write both scopes
scripts/verifyNyOscCities.mjs  the five tests in §10.3
```

⚠ No shebang on any module a test imports — it breaks `npm test` on Windows
and a test guards it.
