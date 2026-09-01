# Michigan townships and villages — every remaining local unit, FY2010–FY2025

**2026-09-01.** The second half of the Michigan sweep. PR #124 loaded the state's
281 cities and 83 counties; this loads its **1,240 townships and 253 villages**,
which is every other general-purpose local government the Form F-65 covers.

Scope decided by Chris: townships named with their county, villages typed
`village`, and the `/treasury/cities` panel labelling left as a follow-up.

## What loaded

**1,493 new units — 1,240 townships, 253 villages — 23,343 entity-years,
93,372 rows.** Two fund scopes per entity-year (`general_fund` published,
`total_governmental` derived as column a + column b) × revenue and expenditure.

Michigan now holds **1,856 units**, and the database goes from 111,776 rows to
205,148.

## ⚠⚠ The six things that had to be measured before anything loaded

Each was found by measuring first, and **each of them moves $0** — which is
exactly why none would have been caught afterwards.

### 1. Township names are not unique, so the Census join had to be county-scoped

117 Michigan township names are shared by **302 townships**. `Grant Township`
names **eleven** different governments. `resolveCensus` keyed places on name
alone, which is safe for SUMLEV 162 (incorporated places are unique statewide)
and silently wrong for SUMLEV 061 (minor civil divisions are not): a name-keyed
map keeps ONE row and hands ten other governments its population.

The county comes from the municode, and the mapping is not the obvious one.
`CCTTTT`'s `CC` is an **alphabetical county index 01–83**, while Michigan's
county FIPS codes are the **odd numbers 001–165** — so `fips = 2 × CC − 1`.
⚠ Derived, therefore verified: applied to all 83 county municodes and checked
against the Census county names, it matched **83 of 83**.

### 2. Bare township names would have merged 302 governments into 117 entities

`treasury_ensure_municipality` keys on **(name, state, entity_type)**. All 1,240
townships share one entity_type, so bare names collapse 302 of them into 117
municipalities, silently interleaving their budgets.

Every township is therefore named `Grant Township, Iosco County`. The county is
part of the name, not an annotation. Villages stay bare — all 253 Census village
names are distinct, and no village name collides with a city name.

### 3. `Township Part 1` and `Township Part 2` are disjoint sets of UNITS

Measured across **all sixteen years**, not just FY2024: Part 1 covers 577
municodes, Part 2 covers 663, the **overlap is ZERO**, and their union is exactly
**1,240** — precisely the number of townships the Census counts in Michigan.

They are not two halves of one form. Reading one would halve the roster; joining
them per unit would double every township's money. `foldFilings` now throws if a
municode ever appears under two unit types.

### 4. A trailing type word is part of the name, not a suffix to strip

**Eight Michigan villages are genuinely named `… City`** — Mackinaw City, Cass
City, Union City, Kent City, Copper City, Cement City, Howard City and Minden
City — and the publisher files each under two spellings across the series
(`Mackinaw City` through FY2016, `Village of Mackinaw City` after). A rule that
trimmed a trailing type word renames the village to `Mackinaw`, which matches no
Census row at all: the village resolves to nothing and drops out of the load
without any figure being wrong.

So `displayName` strips **leading** type words only. Townships get a separate
`unitBaseName`, because three Otsego County townships file as bare `Hayes`,
`Livingston` and `Otsego Lake` through FY2019 and gain ` Township` at FY2020 —
one government, one Census join key, whichever year a caller happens to read.

### 5. ⚠⚠ FY2016 Village cannot be read at all

In that one dataset the `field_name` column is a **copy of `field_data`**: every
row carries the amount where the form's grid coordinate belongs. Measured over
the whole dataset — **83,274 of 83,274 rows, and ZERO grid coordinates**. It is
the only one of the 80 whose `field_name` is not typed `text`, which is why the
server-side filter returns HTTP 400.

⚠ **Not recoverable by dropping the filter.** `dedupeFilingRows` keys on
`field_name` + `group`, so with the amount in that column two genuinely different
line items that happen to share a figure inside one fund collapse as a
"duplicate" — silently deleting real money. The coordinate is also the only thing
giving the form's rows their published order.

The 251 village filings of FY2016 are not loaded; each village keeps its other
fifteen years. It is declared in `UNUSABLE_DATASETS` and **skipped by name, never
by catching the status** — swallowing a 400 would also swallow a real outage.

⚠ The unit ROSTER is still read from it: `municode`, `lu_name` and
`fiscalendmonth` are intact, and the roster query never touches `field_name`.

### 6. ⚠⚠ The federal audit census cannot name a Michigan township

`censusMonthFor` keys on an exact entity name, and the FAC census **records no
county**. `Bedford Township` is already in it TWICE with different months
(month 7 in 1998, month 1 in 2023) because Michigan has more than one — and
`buildCensus` merges rows by name, so those two governments become one entry
whose two months then read as a **fiscal-year change that never happened**.

The sharpest case found: **`Shelby Township` appears twice, month 1 and month 4,
and audit year 2024 is in BOTH rows.** One is Macomb County's Shelby Charter
Township; the other is Oceana County's Shelby Township. Checked by hand against
the F-65 — month 1 and month 4 respectively — and both of TT's months are right.

So every unit carries `facCensusName`, **null when the name is not unambiguous**,
and the loader's guard reads that rather than the display name. **312 units are
REFUSED** — reported on their own line, separate from genuinely uncovered, and
never as agreement. A wrong CONFIRMATION is worse than no evidence, because it
reads as a check that passed.

## ⚠ One government filing under two municodes

The **Village of Manchester** (Washtenaw County) files as municode `813030` on
the village form for FY2010–FY2019 and as `812019` on the **city** form, named
`City of Manchester`, from FY2020. TT already held the later half from PR #124.

It is one government, on four independent facts:

* the years are **disjoint and contiguous**;
* the fiscal calendar never moves — `fiscalendmonth` 6 on every filing of both;
* the money is continuous across the handover: General Fund revenue 1,376,675
  (FY2018) / 1,423,356 (FY2019, village form) / **1,440,439** (FY2020, city
  form) / 1,467,397 (FY2021);
* **Michigan has no City of Manchester.** The Census knows only
  `Manchester village`, so `City of Manchester` is the publisher's label, not a
  fact about the government.

⚠ It is the ONLY such pair in the state. All **203** (county, base name) pairs
held by two municodes were checked: 202 are a township filing alongside a
like-named city or village **in the same years** — genuinely different
governments, correctly kept apart — and exactly one has zero year overlap.

The accompanying migration adds `village` to the entity_type CHECK and corrects
that one row from `city`, keeping its id so its 24 existing budget rows stay
attached. **Invariant-neutral**, verified byte-identical either side.

## ⚠⚠ A pre-load survey that runs different gates than the load is not one

`surveyMiF65Defects.mjs` ran `buildFiling()` over all 23,397 filings and reported
**99.75% clean**. The LOADER also runs `filingChecks()`, which asserts a
published grand total EXISTS and that operating + financing reconciles to it —
and **fifteen filings passed the first while failing the second**. They surfaced
in the dry run, not the survey.

The survey now runs `filingChecks` too **and deduplicates first**, the way
`readFiling` does. That second part is not cosmetic: **19 of these filings are
emitted twice by the portal**, and without the dedupe every leaf sum doubles
while the published subtotals stay right — the Detroit FY2015 duplicated-detail
signature, which it is NOT. Declaring those 19 would have suppressed a correct
breakdown. Same trap as the FY2026-08 sweep; same answer: **read the rows, not
the ratio.**

After the fix: **23,343 of 23,343 filings clean.**

## The 58 excluded entity-years (0.25%)

| class | n | what it is |
|---|---:|---|
| subtotal with no breakdown | 22 | every leaf ABSENT (null, not zero) under a root carrying a figure |
| no Revenue table at all | 13 | the Auburn FY2019 class |
| no Expenditure table | 1 | Freeman FY2017 — the mirror of Auburn |
| reconciliation | 1 | Zilwaukee FY2016, operating + financing misses its published total by 660 |
| FY2020 formatting, broken | 9 | a cell holding the bare string `"$"`, or `".00"`, or `".0"` |
| subtotals vs their own leaves | 6 | the Marysville FY2016 class, arbitrary ratios |
| duplicate whose copies disagree | 2 | `dedupeFilingRows` throws rather than pick one |

⭐ **The 22 are recoverable and deliberately not recovered.** In 21 of them the
filing's own category subtotals still sum EXACTLY to its published grand total,
so the category figures are corroborated and only the within-category detail is
missing — and TT already renders childless roots. Publishing them needs a new
rule in `lib/michiganF65.mjs` ("all leaves absent" is a different fact from
"leaves disagree"), which is a change to proven extraction code for 22 filings in
23,397. It belongs to its own session. ⚠ Yankee Springs FY2015 is the exception:
its revenue subtotals do not sum to its grand total (1,282,158 vs 876,107).

⚠ 15 of the 22 are **Branch County townships in FY2012 alone** — a
filing-software artifact, not 22 independent accidents.

⚠ **A declared exclusion that names nothing excludes nothing.** One entry was
written with a municode belonging to a different township: well-formed, naming a
real unit, and excluding nothing. Only reconciling the drop count against the
registry found it. That reconciliation is now a test.

## ⭐ Verified against independent audited statements

The gates prove internal consistency, not truth. Two townships were compared
against their own **audited ACFRs**, pulled as PDFs from the Federal Audit
Clearinghouse, chosen to cover both township parts and both dominant calendars.

**Hampton Charter Township** (Part 1, January calendar), year ended 31 Dec 2025:

| | F-65 as loaded | audited ACFR |
|---|---:|---:|
| General Fund revenue | 5,445,837 | 5,445,837 |
| General Fund expenditure | 4,185,479 | 4,185,479 |
| Total governmental revenue | 6,598,004 | 6,598,004 |
| Total governmental expenditure | 5,205,645 | 5,205,645 |

**All four exact to the dollar.**

**Redford Charter Township** (Part 2, April calendar), year ended 31 Mar 2025:
both EXPENDITURE figures exact (48,356,140 and 65,777,460), and both revenue
figures differ by an amount that reconciles line by line — **692,031** in the
General Fund is exactly `Leases entered into` 633,375 plus `Sale of capital
assets` 58,656, and **832,997** across governmental funds is 633,375 plus
199,622.

⚠ That difference is a **property of the source, not a defect**: the F-65 files
lease and asset-sale proceeds as REVENUE where GAAP files them as OTHER FINANCING
SOURCES. The F-65's own `TOTAL OTHER FINANCING SOURCES` is transfers only —
25,000 in Redford's General Fund, exactly the ACFR's `Transfers in`. It is
further evidence for the `self_reported_unaudited` grade these rows carry.

⭐ The fiscal calendars corroborate independently too: Allendale, Redford,
Hampton, Grosse Ile and Chassell all match the audit PERIOD in their own federal
filings.

## Verification

* `surveyMiF65Defects.mjs`: **23,343 of 23,343 filings clean**.
* Dry run across all 16 years: 23,343 filings, **620,687 checks, 0 failures, 0
  census conflicts**.
* Fetch reconciliation: 23,343 expected entity-years, 23,343 files on disk, **0
  missing, 0 extra**.
* All 80 dataset ids re-verified against the live catalogue: **0 mismatches**.
* 1,890 tests pass (100 files).

## Access notes

* All 80 ids (16 years × 5 unit types) are in `fetchMichiganF65.mjs`.
* ⚠⚠ The catalogue federates, and **"looks like Michigan" is not the filter**: it
  now also returns **nine `mi-treasury.data.socrata.com` datasets** named
  `2016 F65 DATA` — a Michigan Treasury Socrata domain carrying an older,
  differently-shaped extract with no unit-type split. Filter on the EXACT domain
  `data.michigan.gov`.
* The fetch is driven **per unit type per fiscal year in a retry loop**. A single
  47-dataset run loses every dataset when one request fails; this keeps what
  already landed.
* The load is driven **per year** — 23,343 filings parsed at once does not fit in
  the heap, and a failure halfway through one run does not say which year broke.

## What this does NOT do

* ⚠ **`/treasury/cities` still says "Cities in Michigan"** over what is now 1,774
  Michigan entries. The panel filters by exclusion, so townships and villages
  land there automatically. Deferred deliberately, to keep this a data change.
* The 22 recoverable "subtotal with no breakdown" filings, above.
