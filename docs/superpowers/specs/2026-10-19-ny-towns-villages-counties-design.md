# Finishing New York — towns, villages and counties — design

Chris's pick, 2026-10-19. Decision made beforehand; this document is the
measurement, not the argument.

Prior art, all merged: **#256** (library) · **#257** (61 cities) · **#258**
(717 school districts) · **#271/#272** (district ACFR reconciliation).
Reference: `reference_ny_osc_local_government_data` memory.

---

## 1. Why this exists

TT holds **780 New York governments** today — 717 school districts, 62 cities
(61 from OSC + NYC from its own ACFRs) and the state node. It holds **no town,
no village and no county**.

Measured from the archives on 2026-10-19:

| class | governments | TT holds |
|---|---:|---|
| Town | **933** | 0 |
| Village | **561** | 0 |
| County | **57** | 0 |

**1,551 governments, roughly two-thirds of New York, are missing.** This load
adds them from the same publisher, the same report and the same manual that
#257 already proved.

The 57 counties are New York's 62 minus the five New York City boroughs, which
OSC does not file here. There is nothing to reconcile against
`project_nyc_onboarding` and no collision with it.

---

## 2. The source — three siblings of a zip TT already reads

Free, no key, no auth, no ToS gate. A bare GET on a static file; the
ColdFusion "form" at `financial-data-for-local-governments.cfm` merely 302s
there (see §2 of the cities' design).

```
https://wwe1.osc.state.ny.us/localgov/findata/level3zip/town_all_years.zip     86,265,241 B
https://wwe1.osc.state.ny.us/localgov/findata/level3zip/village_all_years.zip  46,475,210 B
https://wwe1.osc.state.ny.us/localgov/findata/level3zip/county_all_years.zip   18,877,770 B
```

Each holds **32 members**, `{year}_{Class}.csv` for FY1995–FY2026, with the
**same two schema eras at the same 2012/2013 boundary** as the city and school
archives. `scripts/lib/nyOsc.mjs` therefore applies unchanged except for the
year-range guard (§8.1).

One new column: **`CLASS_DESCRIPTION`** (`Town` / `Village` / `County`). It is
read for an assertion only, never to type an entity — the entity type comes
from **which file the row is in**, per
`project_pick_up_next`'s "never type an entity from the publisher's own
City/Town word".

### 2.1 Kept on disk — `docs/NY/`, gitignored (`docs/*`)

`town_all_years.zip`, `village_all_years.zip`, `county_all_years.zip`, beside
the three files #257/#258 already keep. The whole FY1995–2026 series is ONE
file per class; there is no per-year endpoint, so a present file is a complete
file.

⚠ Delete `osc-accounting-and-reporting-manual-2021.pdf` and every claim in §4
loses its evidence.

---

## 3. Coverage, measured

Entities filing revenue/expenditure rows per year:

| | Town | Village | County |
|---|---:|---:|---:|
| FY1995 | 929 | 556 | 57 |
| FY2005 | 926 | 552 | 57 |
| FY2015 | 923 | 545 | 57 |
| FY2021 | 909 | 525 | 57 |
| FY2024 | 883 | 499 | 57 |
| FY2025 | 833 | 468 | 56 |
| FY2026 | **0** | 294 | **0** |

Every class files every year FY1995–FY2025. The decline after FY2022 is filing
lag against a **2026-09-30** snapshot, not missing government.

**Entity-years in the load window (FY1995–FY2025): Town 28,480 · Village
16,774 · County 1,766 = 47,020.**

### 3.1 ⚠ FY2026 is REFUSED, and only villages have any

Town and county FY2026 members are **empty** — nothing to decide. The village
member carries **294 of 561 villages (52%)**, those whose fiscal year ended by
the snapshot. Each such filing is a complete year, but a 52%-coverage year is
the same partial snapshot #258 refused for the districts at ~70%, and it is
recorded the same way: **not loaded, loadable in full later.**

### 3.2 ⭐ Roster = 933 / 561 / 57 from EVERY account-code section

The districts load was bitten twice by the difference between a government
being **present** and being **loadable** (`readYear` keeps only REVENUE and
EXPENDITURE, and the short "Hopevale" spelling filed neither, so a roster built
from `readYear` silently dropped an alias). That check was run here:

```
Town    present=933  loadable=933  present-only=[]
Village present=561  loadable=561  present-only=[]
County  present= 57  loadable= 57  present-only=[]
```

**Both routes agree and no code is published under two spellings** — 0
multi-name codes in all three classes, against the districts' two. No alias row
is needed anywhere in this load.

---

## 4. ⭐⭐ The fund table — read by GLYPH COORDINATES, because `-layout` lies

Every classification below comes from **ARM ch. 5, "Classification and Coding"**
(`docs/NY/osc-accounting-and-reporting-manual-2021.pdf`, PDF page index 19–20),
corroborated by the ch. 4 prose.

⚠⚠ **`pdftotext -layout` SCRAMBLES THIS TABLE.** It prints the Fund column and
the Alpha Code column as two independent vertical runs that do not line up
row-for-row. Read naively it pairs `Highway-Part-Town` with `FX`, `Road
Machinery` with `G`, and **`Special Districts` with `SF`**. Read by glyph
y-centre (`pdfplumber`, 2.5 pt tolerance) every row pairs on one baseline, e.g.

```
y= 591.0  County Road@190          | D@412
y= 604.1  Highway-Town-Wide@190    | DA@409
y= 511.4  Workers' Compensation@161| S@413
```

The alignment is confirmed **25 ways**: it reproduces every one of the 25
entries the city registry already derived independently from ch. 4 prose
citations (CB, CD, CL, CM, CP, CR, CT, CU, FX, G, L, H, PN, V, EA, EE, EF, EH,
EI, EL, EM, EP, ER, ES, ET, EW, M, MS, TC, TE, K, W). A misalignment could not
do that.

### 4.1 ⚠⚠⚠ `S` IS NOT THE SPECIAL-DISTRICT FAMILY

`S_` is the Special Districts family and is **governmental**. Bare **`S` is
Workers' Compensation and is PROPRIETARY**. ARM ch. 4, verbatim:

> Workers Compensation Fund (S) — used to account for workers' compensation
> risk-sharing pools. **This fund can only be used by counties and should be
> reported as an internal service fund.**

`S` carries **6,214 revenue/expenditure lines, in every one of the 31 years, in
counties only**. Had it been swept into the `S_` family on the strength of its
letter, every New York county's Total Governmental would have been inflated by
its workers' compensation pool for the entire series — a silent overstatement
that ties at $0 against itself.

### 4.2 The new entries

Governmental — **special revenue** (ARM ch. 4: *"Funds that are legally
mandated to be kept separately (e.g., town highway, county road, county road
machinery, town special districts, and sewer funds) should be reported as
special revenue funds."*)

| code | fund | ARM |
|---|---|---|
| `B` | General Fund Town-Outside-Village | *"used by towns which contain a village(s) to record transactions which are required by statute to be charged to the area of the town outside the village(s)"* |
| `CN` | Health Related Facilities | listed in the `C_` Miscellaneous Funds sentence |
| `D` | County Road (County Only) | Highway Law §114 |
| `DA` | Highway, Town-Wide (Town Only) | Highway Law §141 |
| `DB` | Highway, Part-Town (Town Only) | Highway Law §277 |
| `DM` | Road Machinery (County Only) | Highway Law §133 |
| `SD` `SF` `SL` `SM` `SP` `SR` `SS` `ST` `SW` | Special Districts: Drainage, Fire Protection, Lighting, Miscellaneous, **Park**, Refuse and Garbage, Sewer, **Public Parking**, Water | *"account for those transactions for operation and maintenance of legally created special districts. A separate fund must be maintained for each special district."* |

⚠ **`SP` is Park and `ST` is Public Parking** — the opposite of the guess the
`CP`/`EP` = Parking pattern invites.

Proprietary — **excluded**:

| code | fund |
|---|---|
| `S` | Workers' Compensation (internal service, counties only) |

### 4.3 ⭐ The manual's class restrictions are FALSIFIABLE, and were tested

The ARM says which class may use each fund. Counting lines across all 31 years:

| claim | measured |
|---|---|
| `S` counties only | **County 6,214 · Town 0 · Village 0** ✅ |
| `DM` County Only | **County 20,452 · else 0** ✅ |
| `DB`, `B` Town Only | **Town 210,738 / 259,199 · else 0** ✅ |
| `D` County Only | County 46,942 · **Town 9** ⚠ |
| `DA` Town Only | Town 519,264 · **County 1** ⚠ |

**Ten lines in 6.5 million break the manual's rule.** Both strays are on
*governmental* funds, so neither changes any classification — but they are the
reason the registry is **shared across the three classes rather than restricted
per class**. A per-class registry would blank 10 entity-years over a filer's
typo on a fund whose type is not in doubt, and blanking is not free (§5).

### 4.4 What stays out

`CS`, `EB`, `C`, `F`, `T` are **not in the 2021 ARM** and get no entry. `CS` in
particular has already been investigated and the obvious fix disproved — see
the long note in `scripts/data/nyOscFundPrefixes.mjs`; do not add it without
new evidence. The cost is measured in §5.

`TA`, `TC`, `TE`, `TN`, `TX` are fiduciary and already carry ARM ch. 4
citations in the city registry; they are excluded either way.

---

## 5. Unknown stays a first-class outcome

An unclassifiable prefix anywhere in an entity-year's section drives that
entity-year's `total_governmental` to **`unknown`** — never a total summed
short. `general_fund` is unaffected (`A` is unambiguous and returns first).

| class | entity-years | blanked | % | cause |
|---|---:|---:|---:|---|
| Town | 28,480 | 808 | 2.84% | `CS` 807 (FY1995–2000) · `EB` 3 · `T` 1 |
| Village | 16,774 | 651 | 3.88% | `CS` 650 (FY1995–2001) · `F` 1 · `C` 1 |
| County | 1,766 | 171 | 9.68% | `CS` 166 (FY1995–2001) · `EB` 5 |

**1,630 of 47,020 entity-years (3.47%)**, every one of them in FY1995–2001,
exactly the shape the cities showed (7.01%, all FY1995–2000).

---

## 6. ⚠⚠⚠ Three village-years file TWO fiscal periods under one `CALENDAR_YEAR`

`PERIOD_END − PERIOD_START` over every modern-era row, grouped by entity-year:

| entity | FY | periods filed | days |
|---|---|---|---|
| Village of Schoharie | 2020 | 2019-06-01 → 2020-05-31 **and** 2020-06-01 → 2020-12-31 | **365 + 213** |
| Village of Kiryas Joel | 2021 | 2020-06-01 → 2021-05-31 **and** 2021-06-01 → 2021-12-31 | **364 + 213** |
| Village of Middleburgh | 2021 | 2020-06-01 → 2021-05-31 **and** 2021-06-01 → 2021-12-31 | **364 + 213** |
| Village of Bloomingburg | 2023 | 2022-06-01 → 2023-07-31 | **425** |

All four are fiscal-calendar transitions. Every other entity-year in all three
classes is exactly one period of 364 or 365 days.

**The first three are the dangerous shape, and a per-row check does not see
them.** The loader groups an entity-year's rows and sums them; with two periods
present it sums a full year *and* a seven-month stub and publishes **nineteen
months as one year**. Nothing raises, and the total ties against itself.

⚠⚠ A first-row check — which is what this load shipped first — passes Schoharie
outright, because Schoharie's full-year rows come **first** in file order.
Kiryas Joel and Middleburgh happen to put the stub first and would have been
caught; Schoharie would have published a ~58% overstatement silently. The check
therefore takes **the whole entity-year**, and the test pins the two periods
**in order** so a later simplification back to one row cannot pass.

All four entity-years are **refused and named**. TT has no surface that says
which months a figure covers, so keeping only the twelve-month half would mean
TT silently choosing which of the publisher's two filings a reader sees — a
reinterpretation, which this module does not do.

### 6.1 ⭐ The old era hides none

FY1995–2012 has no `PERIOD_START`/`PERIOD_END`, so the day-count test **cannot**
run there. A transition is still detectable by another route: it requires
`FISCAL_YEAR_END` to change. Measured across every entity and every consecutive
pair of old-era years:

```
Town 0 changes · Village 0 changes · County 0 changes
```

So the old era is not merely unchecked — it is **affirmatively clean**, and the
refusal set is exactly those four village-years.

---

## 7. Fiscal calendars — two uniform classes and one that is not

Read per entity per year, never carried between entities
(`project_fysm_column_default_one_defect`).

* **Town**: January start, every entity, every year (`FISCAL_YEAR_END` 12/31 →
  `PERIOD_START` 01-01). 3,860,139 lines, no exception.
* **County**: January start, every entity, every year. 691,217 lines, no
  exception.
* **Village**: **not uniform** — June start dominates (FYE May 31, Village Law
  §4-400), with March, January, August, July, December and April all present.

⚠⚠ The cities' CHECK 4 asserts the month set is *not* uniform and so would FAIL
a correct town or county load; #258 met this and **inverted it rather than
deleting it**. Same here, per class: assert the measured shape, and keep
reading the value per entity either way. A gate asserting one shared month is
asserting conformity to a hardcode, not measuring anything.

---

## 8. What changes in code

```
scripts/lib/nyOsc.mjs                          per-class archive constants + year ranges
scripts/data/nyOscMunicipalFundPrefixes.mjs    NEW — §4, the third NY registry
scripts/data/nyOscMunicipalEntities.mjs        NEW — generated roster, 1,551 governments
scripts/buildNyOscMunicipalEntities.mjs        NEW — the generator
scripts/fetchNyOsc.mjs                         --towns / --villages / --counties
scripts/seedNyOscMunicipal.mjs                 NEW — seeder, --class
scripts/loadNyOscMunicipal.mjs                 NEW — loader, --class --from --to
scripts/verifyNyOscMunicipal.mjs               NEW — verifier, --class
scripts/data/{fundScope,basis,auditGrade}Registry.mjs   three new entries each
tests/nyOscMunicipal*.test.mjs                 NEW
```

### 8.1 `readYear`'s year guard is hardcoded City-vs-School

It is a ternary over two constant pairs. It becomes a **per-class table**, so
`readYear(zip, year, 'Town')` is range-checked against the town archive rather
than silently borrowing the school range.

### 8.2 ⚠⚠ `assertRosterHasNoNyc` MUST NOT be reused verbatim

It refuses any name matching `/new york/i`. The village roster contains
**`Village of New York Mills`** — a real, distinct government in Oneida County.
The guard for these classes refuses an entity whose **bare name is exactly**
`New York`, and the three classes cannot collide with NYC anyway (NYC is a
city; these are towns, villages and counties).

### 8.3 Names

`ENTITY_NAME` is uniformly `Town of X` / `Village of X` / `County of X` — one
prefix, 100% of rows, all three classes. The stored display name is the bare
`X`, matching the cities (`Albany`, not `City of Albany`).

⚠ **Ten town names are each shared by two towns** — Albion, Ashland, Brighton,
Chester, Clinton, Dickinson, Franklin, Fremont, Greenville, Lewis. Villages and
counties have **zero** collisions. `treasury_ensure_municipality` keys on
`(name, state, entity_type)`, so a bare `Albion` would collapse two governments
into one row carrying both budgets. Those ten pairs are **county-qualified**,
in Pennsylvania's measured form: `Albion, Orleans County`. Qualification is
computed **from the data**, not from this list, and the generator then asserts
global uniqueness within each class.

Cross-class name sharing (223 town/village pairs) is **not** a collision —
`entity_type` differs, and they are genuinely different governments.

⚠⚠ **Strip exactly one prefix, never repeatedly.** OSC prints **`Village of
Village of The Branch`**, because that Suffolk County village is legally named
*Village of The Branch*. One strip gives the right answer; a loop gives "The
Branch", which names nothing. It is Pennsylvania's `GROVE CITY BORO` → "Grove
City" trap in a second state. The exception is **declared**, and the generator
asserts **both directions**: a declaration matching no government is a stale
rule nobody notices, and an undeclared doubling is a name silently mangled.

### 8.4 Identity and source keys

`MUNICIPAL_CODE` is OSC's own stable id and is the `source_entity_key`.
**Measured: the codes are globally unique across all three classes** — zero
codes appear in more than one file. Source keys are still one per class
(`NY_OSC_TOWN`, `NY_OSC_VILLAGE`, `NY_OSC_COUNTY`), because
`treasury_ensure_municipality` refuses a key that reaches across kinds of
government and that refusal is worth having.

---

## 9. Axes — a distinct source name per class, and why not to share the cities'

These governments file **the same AFR under the same manual** as the 61 cities,
so reusing `New York OSC Annual Financial Report` would resolve `fund_scope`,
`basis` and `audit_grade` correctly on the existing anchored patterns.

**It is still wrong.** Those three registry entries carry *evidence prose about
cities* — "All 61 cities carry an A fund", "392,234 revenue/expenditure lines
into 368,870 governmental". A town inheriting that string would publish a
provenance claim that was never measured about towns, and the Total
Governmental fund list genuinely differs by class (towns use `B`/`DA`/`DB`/`S_`,
counties use `D`/`DM`/`S`, villages use none of them).

So, mirroring `New York OSC School District Annual Financial Report`:

```
New York OSC Town Annual Financial Report — {Revenues|Expenditures}, {General Fund|Total Governmental} (FY#### actual, self-reported)
New York OSC Village Annual Financial Report — …
New York OSC County Annual Financial Report — …
```

⚠ The city pattern is anchored `^New York OSC Annual Financial Report —`, so it
cannot claim `New York OSC Town Annual…` and vice versa. **A test asserts that
cross-claim is impossible in both directions**, for all four NY source-name
families.

Axis values, identical to the cities and for the same reasons:

* `fund_scope` — `general_fund` (prefix `A`) / `total_governmental` (§4) /
  `unknown` (§5)
* `basis` — `actual`; the AFR reports a closed fiscal period (§6 proves the
  period is a full year wherever it is loaded)
* `audit_grade` — `self_reported_unaudited`; filed by the government under GML
  Article 3, no audit flag, no opinion, no auditor in the dataset
* `accounting_basis` — stays `unknown`. ARM ch. 3 directs modified accrual, but
  an instruction is not an outcome and no opinion establishes any of these
  1,551 governments achieved it.
* `derivation` — `derived`. **No total row exists anywhere in this source**, so
  every TT total is Σ items by construction (§11).

---

## 10. Scale

| class | entity-years | upper bound rows | rev/exp lines parsed |
|---|---:|---:|---:|
| County | 1,766 | ~6,700 | 691,217 |
| Village | 16,774 | ~66,000 | 1,920,053 |
| Town | 28,480 | ~112,100 | 3,860,139 |
| **total** | **47,020** | **~184,800** | **6,471,409** |

Upper bound = entity-years × 2 datasets × 2 scopes, less the refused
`total_governmental` cells (§5), less the 16 cells of the four refused
entity-years (§6), less entity-years with an empty tree.
**The loader's `--dry-run` measures the real figure; nothing here is pasted
into an expectation.**

⚠ The §5 entity-year counts do **not** multiply cleanly by two. A prefix is
refused **per section**, so an entity-year carrying `CS` only in its
expenditure rows loses its expenditure `total_governmental` and keeps its
revenue one. Measured on the counties: 171 blanked entity-years yield **328**
refused cells, not 342.

Measured for the counties (dry run, then the load): **6,736 rows** = 1,766
entity-years × 4, less 328 refused cells, less 0 empty trees. All 1,766 report
fiscal start month 1, and none is refused as non-annual.

This is **2.2× the district load**, TT's largest to date, and it grows
`treasury.budgets` from 397,682 rows by roughly 46%.

⚠⚠ From #258, measured: **~3 min/year in a fresh process, and a single process
spanning the whole series is ~2× slower and gets MEMORY-KILLED.** Load in
**foreground** chunks of one to two years — a foreground command is not a
background shell, so the memory reaper does not target it. The never-overwrite
guard is batched one read per fiscal year, not one per row; at this scale a
per-row SELECT would be ~370,000 extra round trips.

### 10.1 Order of work

**One branch, one PR, three loads in increasing size.** A PR boundary does not
de-risk a load — the rows are written to the live database either way, so what
protects the data is the ORDER of execution, not the number of pull requests.
Each class is loaded and fully verified before the next begins, and each gets
its own commit carrying its own measured `EXPECTED_ROWS`.

1. **Library, registry, roster, seeder, loader, verifier, tests + COUNTIES.**
   57 governments, ~6,700 rows — the whole mechanism end to end at 3.6% of the
   cost, including the one class that uses `S`, `D` and `DM`.
2. **VILLAGES.** ~66,000 rows; the only class with a non-uniform calendar and
   the only one with refused stub years.
3. **TOWNS.** ~112,100 rows; the `B`/`DA`/`DB`/`S_` class and the ten
   county-qualified names.

---

## 11. Verification

Per class, after each load, adapted from `verifyNyOscSchools.mjs`:

1. **Entity count** — the database holds exactly the roster's governments under
   this source key.
2. **Row count** — budget rows per fiscal year match a re-derivation from the
   archive, not a pasted constant.
3. **Scope split** — `general_fund` cells = entity-years with an `A` fund;
   `total_governmental` cells = that minus the refused set of §5, **and the
   per-year shortfall is asserted against §5's table**.
4. **Fiscal calendar** — the measured shape of §7, per class, inverted for the
   two uniform classes.
5. **Totals re-derived to the cent** from the archive for a sample of
   entity-years, against what the database holds.

Then the standing ceremony: register the rows in both expectation tables,
`npm run verify:frozen` (expect `62587 / 60098de6` **UNCHANGED** — this load
moves no existing figure), `npm run check:forks`, `npm run build`.

⚠⚠ `treasury_sync_city_budget` keys on **fund_scope + basis**, not
`data_source`. This load writes TWO scopes; omitting either parameter
DUPLICATES on a re-run.

### 11.1 ⚠⚠ What verification does NOT establish

**OSC publishes line items only. No total row exists anywhere in this source**,
so "total = sum of items" is true by construction and proves nothing. CHECK 5
proves TT read OSC faithfully. It does **not** prove OSC is right.

The districts got that second proof in #272 — reconciliation against their own
audited ACFRs via the Federal Audit Clearinghouse, which established the rule
*OSC revenue = ACFR Total revenues + other financing SOURCES*. The counties are
the natural candidate here: 57 governments, all Single Audit filers, all in FAC
from audit year 2016. **That is a follow-up, scoped separately, and until it
exists these figures are faithful readings of an unaudited filing — which is
exactly what `self_reported_unaudited` says.**

---

## 12. Risks

* **Scale.** ~184,800 writes. Mitigated by per-year chunking, a batched
  never-overwrite guard, and a smallest-first PR order that proves the chain on
  57 governments.
* **A wrong fund classification is silent.** Mitigated by reading the ARM by
  coordinates, by the 25-way cross-check against the city registry, and by
  testing the manual's own falsifiable class claims (§4.3).
* **`CS` remains unresolved**, so 3.47% of entity-years publish `unknown` for
  `total_governmental`. That is the honest outcome, not a shortfall.
* **The ten town-name collisions are identity-load-bearing.** Qualification is
  computed from the data and global uniqueness is asserted by the generator
  before a single write.

## 13. Open questions

* **County ACFR reconciliation (§11.1)** — scoped, not included.
* **FY2026 villages** — 294 complete filings, refused as a 52% snapshot (§3.1).
  Loadable in full once OSC's next snapshot lands.
* **Fire districts** — `firedistrict_all_years.zip` (8.0 MB) is a fourth
  sibling and is out of scope. `special_district` exists as an entity type with
  three members; whether New York's fire districts belong in TT is a separate
  decision.
