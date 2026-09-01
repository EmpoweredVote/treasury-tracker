# Michigan statewide sweep — every city and county, FY2010–FY2025

**2026-08-31.** Scope decided by Chris: **cities and counties now**, villages and
townships later. Michigan's 1,217 townships and 247 villages would have taken the
`/treasury/cities` payload from 88,820 `available_datasets` entries to ~206,000,
and that list is on the critical path of every page load.

## What loaded

**364 entities — 281 cities, 83 counties — 5,771 entity-years, 23,084 rows.**
Two fund scopes per entity-year (`general_fund` published, `total_governmental`
derived as column a + column b) × revenue and expenditure.

Before this, Michigan held **3** municipalities and 142 rows.

## The four defects the sweep found

Each was found by measuring before loading, and each moves $0 — which is exactly
why none of them would have been caught afterwards.

### 1. ⚠⚠ A leading zero that would have created 18 duplicate cities

The municode is `CCTTTT`, so counties 01–09 carry a leading zero. Socrata types
that field as a **NUMBER in fifteen of the sixteen City datasets** — dropping the
zero — and as a **STRING in FY2020**, which keeps it. Harrisville is `12010`
every year except FY2020, where it is `012010`.

Joining on the raw value produced **382 roster entries for 364 real units**: 18
cities each split into a 15-year entity and a phantom FY2020 twin. The phantom
would have carried the one year that also has the known formatted-currency
defect.

⭐ The campaign's rule was "join on `municode`, never on `lu_name`". True, and
**not sufficient** — the stable key needed normalising too.

### 2. ⚠⚠ Six filings emitted TWICE, which look exactly like a known defect

Six filings first appeared as the `KNOWN_DUPLICATED_DETAIL` case: leaves exactly
2.000× the published subtotal, the Detroit FY2015 shape. **They are not it.**

Reading the raw rows rather than trusting the ratio showed **every `field_name`
in those filings appears twice** — subtotals included, values identical. The
whole filing is repeated. Nothing is contradicted; the response was duplicated.

Declaring them as duplicated-detail would have **suppressed a complete and
correct breakdown** because a ratio matched. They are deduplicated instead
(`dedupeFilingRows`), losslessly.

⚠ Detroit FY2015 was re-checked rather than assumed: **620 keys, none repeated.**
It is genuinely the other defect, and its three registry entries stand unchanged.

⚠⚠ **A repeat whose copies disagree is not a repeat.** Farmington Hills FY2018
disagrees with itself on 3 of 264 keys and Keweenaw County FY2016 on 21 of 246.
`dedupeFilingRows` throws rather than pick one; both entity-years are excluded.

### 3. ⚠⚠ The F-65's fiscal month contradicts the audited record for 8 units

`fiscal_year_start_month` is the field this project has got wrong more often than
any other, and every one of those defects moved $0.

`scripts/auditMiF65FiscalMonths.mjs` checked the F-65's self-reported
`fiscalendmonth` against the FAC census — the units' own Single Audit filings:

| | entity-years |
|---|---:|
| census AGREES | 2,141 |
| census CONFLICTS | **27** |
| census UNCOVERED | 3,634 |

**98.8% where measurable.** ⚠ Uncovered is never counted as agreement.

The sharpest case is **Lapeer County**: the census reports month 1 for
1998–2025 while the F-65 claims month 10 from FY2022. Kent and Gladwin Counties
show the F-65 flipping to October at FY2020 where the census records a 9-month
stub year in **2023** and October only from 2024.

All 27 entity-years are excluded, **per year and not per unit** — a unit with one
contradicted year keeps its other fifteen.

⚠ **A hypothesis that was wrong, recorded so nobody re-runs it.** Every conflict
has the F-65 saying month 10, and Michigan's *state* fiscal year starts in
October, which looked like a form default. It is not: the F-65's county
distribution (65.1% January / 33.7% October over 1,322 entity-years) closely
tracks the census's own (72 January / 29 October entities). The conflicts are
localised, not systematic.

### 4. Four units genuinely changed calendar mid-series — and the loader wrote a constant

Lake City (month 4→7 at FY2020), Gladwin and Kent Counties (1→10 at FY2020),
Lapeer County (1→10 at FY2022).

The session-7a loader reads the month from each filing, checks it against **one**
roster constant, and then writes **the constant** — its own comment says "read
from the filing". Those agree only because the check throws otherwise, which is
safe for two entities whose calendars never move and cannot express these four.

`scripts/loadMiStatewideF65.mjs` writes the month **read from the filing being
loaded**, and uses the roster's `monthsByYear` as the cross-check.

## Two more entity-years excluded

* **Marysville FY2016** — published subtotals disagree with their own leaves at
  1.0278× and 1.3952×. Its 316 keys are each present once, so this is not the
  duplicate-filing case; the filing simply does not add up, and nothing here can
  say which figure is wrong.
* **Auburn FY2019** — contains **no Revenue table at all**, 130 rows all T2.
  ⚠ This drops a good expenditure series rather than publish a revenue one that
  does not exist. Writing $0 was never an option: it would state that Auburn
  received nothing.

**Excluded in total: 30 entity-years of 5,801 (0.5%).**

## Verification

* `surveyMiF65Defects.mjs` ran **all 5,775** filings through `buildFiling()`
  before anything loaded: **5,768 clean — 99.88%**.
* Dry run: 5,771 filings, **190,672 checks, 0 failures, 0 census conflicts**.
* ⭐ **The sweep independently reproduces session 7a.** All 16 spot-checked
  Detroit and Wayne County totals (FY2015 and FY2024, both faces, both scopes)
  match the stored values **exactly**, through a different pipeline — bulk fetch,
  deduplication, per-year month. That is the strongest evidence here that the
  extraction is right, and it is why re-writing those 128 rows is a no-op.
* `verify:frozen` before the load: `62654 rows / 3a48ac28…`.

## Access notes

* One dataset per fiscal year per unit type; the 32 City and County ids in
  `fetchMichiganF65.mjs` were **re-verified against the live catalogue** — 0
  mismatches. ⚠ The catalogue federates across Socrata domains; filter on
  `metadata.domain === 'data.michigan.gov'`.
* `fetchMiStatewideF65.mjs` pulls each dataset **once** (32 requests) and splits
  by municode locally, rather than the 5,775 per-entity requests the 7a fetcher
  would have made against a public portal doing us a favour.
* ⚠ The server-side filter is deliberately **wide** — every T1 and T2 row, not
  the two groups the loader wants. A fetcher that pre-decides what matters is a
  fetcher that can silently drop a fund.

## Audit grade

`self_reported_unaudited`, inherited from the existing `mi-treasury-f65` registry
entry with no change. ⚠ That is correct rather than lazy: unlike an ACFR opinion,
which is evidence about one document, this evidence is about **the form's own
instructions** — a property of the source that extends to every filer of it.

## What is still not loaded

* **1,217 townships and 247 villages** — deferred on payload grounds, not data
  grounds. The loader reaches them unchanged.
* The `/treasury/cities` projection fix in ev-accounts is the prerequisite:
  `available_datasets` carries one entry per budget row, and the list is fetched
  on every page load.
