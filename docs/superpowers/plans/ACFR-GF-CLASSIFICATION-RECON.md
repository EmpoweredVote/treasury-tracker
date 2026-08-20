# ACFR General Fund classification — the remaining 260 rows (evidence of record)

**Date:** 2026-08-19
**Purpose:** evidence behind the four registry entries that classify the
sixteen `… ACFR — General Fund …` families left `unknown` after
AUSTIN-TRAVIS-01.

Follows the method established in `AUSTIN-TRAVIS-01-SCOPE-RECON.md`: for each
family, establish **which column of the printed governmental-funds statement the
stored figure is**, by reading the statement with an implementation that shares
no code with the extractor that loaded it.

---

## 0. Scope and the four entries

260 rows across 16 entity families. Grouped into four entries by source family —
the same grouping principle as `state-acfr-gf` (50 separate publishers, one
entry, because the document type and method are identical):

| Entry id | Families | Rows |
|---|---|---|
| `or-city-acfr-gf` | Bend 36, Sherwood 22, Beaverton 12, Hillsboro 10, Tualatin 10, Cornelius 8, Tigard 8 | **106** |
| `az-muni-acfr-gf` | Tucson 20, Marana 12, Oro Valley 12, Sahuarita 12, South Tucson 8 | **64** |
| `seattle-city-acfr-gf` | Seattle 34 | **34** |
| `state-acfr-gf-by-name` | Minnesota 36, Ohio 12, Virginia 8 | **56** |
| | | **260** |

**Unlike `state-acfr-gf`, every member family of every entry here was probed
individually** — this is not two probes standing in for fifty publishers. 15 of
16 families have two or more coordinate-verified fiscal years; the exception is
disclosed in §4.

### 0.1 Patterns are anchored to entity names

Every pattern enumerates its entities explicitly, for the reason recorded in
AUSTIN-TRAVIS-01-SCOPE-RECON §0.1: the general `/ ACFR — General Fund/` claims
1,784 rows, sweeping in families nobody has reconciled. Anchoring means a future
city-ACFR load lands `unknown` until it is evidenced, which is the correct
failure direction.

---

## 1. `fund_scope` = `general_fund`

### 1.1 Method

`scripts/acfrPrintedTotal.py` reads the statement with **pdfplumber glyph
coordinates**; every extractor that loaded these rows uses `pdftotext -table`
and nearest-column-anchor assignment. No shared code, no shared strategy.

Two quantities are reported per probe:

* **col0** — the printed FIRST column, the General Fund on every
  governmental-funds statement in this corpus. `stored / col0` must be **exactly
  1 or exactly 1000**; that ratio is also what confirms the entity's units
  convention, which the $0 tie gate is structurally blind to.
* **Total Governmental** — the discriminator. If the stored figure equalled
  *this*, the scope would be `total_governmental`.

**Result: 54 of 54 readable probes matched col0 EXACTLY.** Not one family stored
a total-governmental figure under a General Fund label.

### 1.2 The verified probes

Figures are as printed (thousands where the factor is 1000). `GF/TG` is the
General Fund as a share of Total Governmental — the proof that the stored figure
is a strict subset.

| Family | FY | Revenue col0 | Expenditure col0 | × | GF/TG rev | GF/TG exp |
|---|---|---|---|---|---|---|
| City of Bend | 2006 | 26,414,845 | 14,236,241 | 1 | 41.7% | 19.9% |
| City of Bend | 2025 | 73,705,554 | 47,192,049 | 1 | † | † |
| City of Sherwood | 2025 | 17,725,106 | 20,034,416 | 1 | 56.4% | 42.3% |
| City of Sherwood | 2024 | ✓ exact | ✓ exact | 1 | — | — |
| City of Sherwood | 2015 | ✓ exact | ✓ exact | 1 | — | — |
| City of Beaverton | 2020 | 64,927,269 | 64,277,585 | 1 | 58.5% | 37.7% |
| City of Beaverton | 2025 | 84,105,297 | 83,828,091 | 1 | 57.4% | 59.1% |
| City of Hillsboro | 2021 | 109,577,257 | 109,916,367 | 1 | † | † |
| City of Hillsboro | 2025 | 175,243,196 | 165,543,779 | 1 | 66.5%‡ | 74.9%‡ |
| City of Tualatin | 2021 | 20,825,943 | 23,895,226 | 1 | 70.0% | 56.9% |
| City of Cornelius | 2022 | 9,701,886 | 8,293,203 | 1 | † | † |
| City of Cornelius | 2025 | 10,826,496 | 15,037,256 | 1 | 72.8% | 86.9% |
| City of Tigard | 2022 | 43,753,463 | 30,516,074 | 1 | 61.8% | 56.7% |
| City of Tigard | 2025 | 42,104,592 | 41,500,458 | 1 | 50.4% | 51.3% |
| City of Tucson | 2015 | 468,385,932 | 422,167,515 | 1 | 64.7% | 55.1% |
| City of Tucson | 2024 | 773,493,270 | 648,657,363 | 1 | 56.3% | 51.4% |
| Marana | 2019 | 50,147,453 | 39,674,172 | 1 | † | † |
| Marana | 2024 | 94,153,099 | 59,821,670 | 1 | 62.3% | 51.1% |
| Oro Valley | 2019 | 40,924,353 | 35,448,052 | 1 | † | † |
| Oro Valley | 2024 | 59,077,316 | 50,170,504 | 1 | 73.7%‡ | 55.0%‡ |
| Sahuarita | 2019 | 17,760,711 | 15,763,375 | 1 | 64.8% | 52.8% |
| Sahuarita | 2024 | 32,166,628 | 23,924,397 | 1 | 62.7% | 53.2% |
| South Tucson | 2019 | 5,138,816 | 5,034,119 | 1 | † | † |
| South Tucson | 2022 | 6,201,468 | 5,883,806 | 1 | 65.0% | 66.4% |
| City of Seattle | 2024 | ✓ exact | ✓ exact | 1000 | — | — |
| City of Seattle | 2025 | 2,407,090 | 2,300,612 | 1000 | 62.9% | 62.2% |
| State of Minnesota | 2008 | 16,600,864 | 16,086,550 | 1000 | 62.2% | 59.4% |
| State of Minnesota | 2025 | 35,478,861 | 35,114,726 | 1000 | 58.6% | 56.9% |
| State of Ohio | 2020 | 37,891,148 | 36,005,625 | 1000 | † | † |
| State of Ohio | 2025 | 49,343,227 | 49,447,475 | 1000 | 56.7%‡ | 53.8%‡ |
| State of Virginia | 2022 | 29,208,709 | 25,212,453 | 1000 | † | † |
| State of Virginia | 2025 | 31,593,096 | 34,099,267 | 1000 | 46.5%‡ | 47.9%‡ |

† The statement splits its fund columns across two pages, so the rightmost
number on the statement page is *not* the total — see §1.3. col0 is still exact.
‡ Total Governmental recovered from the continued page by the additive identity
in §1.3.

**Every GF/TG share falls between 19.9% and 86.9%.** No family is anywhere near
100%, which is what a mislabelled total-governmental figure would look like.

### 1.3 Continued-page totals — recovered by an additive identity, not by guessing

Four families (Ohio, Oro Valley, Hillsboro, Virginia) print only the first few
fund columns on the statement page and carry the rest, plus `Total`, onto a
continued page that has **no row labels** — they are on the page before. So the
correct row cannot be found by matching text.

`scripts/acfrContinuedTotal.py` finds it by an identity that validates itself:

```
sum(statement page columns) + sum(continued row's leading columns)
    == continued row's LAST column
```

Only the genuine continuation of that statement line satisfies it. **In all four
families, on both sides, exactly ONE candidate row matched** — no ambiguity, no
positional assumption about row order across a page break. Worked example, Ohio
FY2025 revenue: `49,343,227 + 22,263,036 + 239,164 + 1,007,421 + 14,225,823 =
87,078,671`, the printed total, giving a General Fund share of 56.7%.

### 1.4 Two extraction hazards found and fixed

Both produced a *plausible wrong number* rather than an error, which is why they
are recorded rather than quietly patched:

1. **Minnesota labels its revenue subtotal `Net Revenues`, not `Total
   Revenues`** (its revenue lines are stated net of refunds). The oracle
   required "total revenues" and so reported "statement page not found" for a
   document whose statement was right there. Widened to accept `Net Revenues`
   and `Total Operating Revenues`; the expenditure side stays the hard literal
   `total expenditures`, which is what still prevents a proprietary-funds
   statement from qualifying.

2. **Minnesota's FY2008 statement runs its dot leaders straight through the
   figures.** The General Fund revenue total extracts as
   `$......1..6..,.6.0..0..,.8..6..4` — that is `16,600,864`. Unrepaired, the
   token was unparseable, the General Fund column dropped out of the row, and
   "the leftmost number" became the **FEDERAL** column: 6,271,343 instead of
   16,600,864. The harness reported a factor of 2,647 against a database row
   that was exactly right. Fixed by stripping dot runs (guarded on a dot count
   of ≥2, so a real decimal is never touched) and by merging the overlapping
   word fragments the leaders create. Confirmed by the column identity:
   `16,600,864 + 6,271,343 + 3,814,277 = 26,686,484`, the printed total.

Both fixes were regression-checked against the 76 Austin/Travis rows, which
still verify 76/76.

### 1.5 A third hazard: an incomplete TLS chain, not a missing document

`archives.obm.ohio.gov` serves Ohio's state ACFRs without the intermediate
certificate. Node rejects it (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) and git-bash
curl rejects it (exit 60) because both carry their own CA bundles. PowerShell
succeeds, because it validates against the Windows store and completes the chain
via AIA. The harness now falls back fetch → curl → PowerShell. **Verification
stays on in all three paths** — nothing passes `-k`.

---

## 2. `basis` = `actual`

**Documents:** the 16 entities' own ACFRs (South Tucson's are titled "Annual
Financial Report"), for closed fiscal years.

**Figures:** every stored figure is the printed General Fund column of a
governmental-funds *Statement of Revenues, Expenditures and Changes in Fund
Balances* — a year-end GAAP actual, tying exactly across the 54 probes in §1.2.

These are not appropriations. The same documents present budget against actual
in a separate **budgetary comparison schedule**, and the extraction path
excludes any page whose title carries `Budgetary` or `Budget and Actual`
(`acfrGF.py` `_EXCLUDE`, mirrored in `acfrPrintedTotal.py`), so the budget
schedule is structurally unreachable. The latest fiscal year in any family is
FY2025, which closed 2025-06-30 for every one of these entities.

---

## 3. `reporting_entity` = `primary_government`

**The structural argument, identical to `state-acfr-gf`, `wa-sao` and
`tx-local-acfr-gf`:** the stored figure is a column of the **fund** financial
statements. Under GASB 34, discretely presented component units appear only in
the government-wide statements, in their own separate column — never in a
governmental-funds column. Every statement read in §1.2 is titled
"Governmental Funds". So the stored figure cannot contain a discrete component
unit.

This is a standards-level property of the statement, not a per-document reading,
and it is the same basis on which the three pre-existing `primary_government`
entries rest. It was additionally spot-verified against Note 1 in the two
entities examined in detail for AUSTIN-TRAVIS-01, where the blended units'
own "Reporting Fund" designations put them in proprietary and nonmajor special
revenue funds — never the General Fund.

**Contrast that makes the axis meaningful:** `mn-osa` is
`incl_component_units` because the Minnesota *State Auditor* re-aggregates
HRA/EDA/TIF activity that a city's own ACFR presents separately (+21.7% on
Bloomington FY2022). Note that the **State of Minnesota** entry here is a
different thing entirely — the state's own ACFR, read from its own fund
statement — and is `primary_government`.

---

## 4. Disclosed limits

* **City of Tualatin (10 rows) has ONE coordinate-verified year, FY2021**, not
  two. FY2025's statement title is wrapped in a way the oracle's title regex
  cannot span, and pdfplumber is pathologically slow on the FY2022/FY2023 files
  (minutes per page), so a second year was not obtained within this pass. The
  other four years rest on their extractor's own $0 tie gate. This is the
  weakest evidence in the set and is called out rather than averaged away.
* **Three probe years could not be read at all** and are not counted as
  evidence: Seattle FY2009 and FY2010, Sherwood FY2014, Tualatin FY2025. In each
  the statement title is interrupted or wrapped — `acfrGF.py` already documents
  Seattle's FY2009-era statement printing "Page 1 of 2" between "…AND CHANGES"
  and "IN FUND BALANCES", which is why Seattle's own extractor identifies the
  page by its `B-4` schedule id instead. Both affected families are evidenced by
  two other years each.
* **`reporting_entity` rests on a standards argument**, not on having read 16
  separate Note 1 sections. Stated plainly here so a future reader can raise the
  bar if they want to.

---

## 5. A separate defect found — FIXED 2026-08-19

**All 260 rows carried `fiscal_year_start_month = 1`, and for 226 of them that
was wrong.** Every Oregon city, every Arizona municipality, and the Minnesota,
Ohio and Virginia state nodes close on **June 30**, so the year starts in July
(7). Seattle's 34 rows are genuinely a calendar year (Dec 31 → 1) and were
already right — by luck, since 1 is also the column default.

*(An earlier draft of this section said 253. That was arithmetic error: 260 − 34
Seattle = **226**. The corrected figure is what was applied.)*

Fixed by `scripts/fixAcfrFiscalYearStartMonth.mjs`. The value is **derived from
each row's own `source_date`**, not from a per-family lookup table that would be
a second place to get a fiscal calendar wrong:

```
start_month = (month_of(source_date) % 12) + 1
2025-06-30 -> 7      2025-12-31 -> 1      2025-09-30 -> 10
```

Every one of these loaders stamped `source_date` with the fiscal-year END, and
the rule was checked against the documents themselves, not just the database:
Bend FY2025 "Year Ended June 30, 2025", Tucson FY2024 "Fiscal Year Ended
June 30, 2024", Seattle FY2025 "Fiscal Year Ended December 31, 2025", and
Minnesota / Ohio / Virginia FY2025 all "Fiscal Year Ended June 30, 2025".

Guards: scope limited to the enumerated families; `source_date` must be present,
must be the **last day of its month** (a period end always is, an issue date
usually is not), and its year must equal `fiscal_year`; the derived month must be
one of {1, 7, 10}. **All 336 rows passed every guard** — 0 null dates, 0
non-month-ends, 0 year mismatches. 226 updated, `--verify` reports 336 checked /
0 wrong, and no figure or classification moved.

### 5.1 The 50-state ACFR family — 1,386 rows, ALSO FIXED 2026-08-19

The same defect, same rule, same script (scope extended to
`/ State ACFR — General Fund/`). **1,386 of the family's 1,448 rows changed**;
Alabama's 48 and Michigan's 14 were already correct at 10.

| | Rows | Period end | → |
|---|---|---|---|
| 44 states | 1,342 | `06-30` | **7** |
| **New York** | 44 | `03-31` | **4** |
| Alabama, Michigan | 62 | `09-30` | 10 (already correct) |

New York is the reason `ALLOWED_MONTHS` needed a fourth value, and the guard
rejecting `4` beforehand is exactly what surfaced it instead of silently stamping
it `7`. Both unusual calendars were verified against the documents themselves,
not just the database:

* **New York** — "Fiscal Year Ended **March 31**, 2005", FY2005 ACFR (osc.ny.gov)
* **California** — "Fiscal Year Ended **June 30**, 2025", FY2025 ACFR (sco.ca.gov),
  as a check on the 44-state common case

`--verify` reports **1,784 rows checked / 0 wrong**. Whole-table distribution is
now `{1: 17,565, 4: 44, 7: 62,115, 10: 291}`. No figure and no classification
moved — the state family's 1,448 `total_budget` values still sum to
$31,672,041,568,010, and New York and California remain `general_fund`.

#### A stronger guard was added at the same time

A month whitelist alone is weak: it would accept `7` for a state whose
`source_date` was wrong in a way that still landed on June 30. So the script now
also asserts **per-family consistency** — every row in a source family must
derive the *same* start month, or the run aborts. Each family spans up to 24
fiscal years, so a `source_date` wrong enough to shift the month would have to be
wrong identically across all of them to survive. No family tripped it.

### 5.2 What is still mis-stamped — 107 rows, deliberately out of scope

Four groups remain, fully characterised. **105 of the 107 are safely derivable**;
they were left because each belongs to a different milestone and would widen this
pass a fourth time.

| Group | Rows | Period end | Would derive | Safe? |
|---|---|---|---|---|
| City adopted-budget documents (Portland, Gresham, Troutdale) | 51 | `06-30` | 7 | yes — Oregon cities, and the fiscal calendar is independent of `basis: adopted` |
| Pre-GASB-34 `Connecticut State CAFR` rows | 34 | `06-30` | 7 | yes — Connecticut closes June 30 regardless of statement vintage |
| `Texas State ACFR — General REVENUE Fund` | 20 | `08-31` | **9** | yes — Texas closes Aug 31; needs a *fifth* month value |
| `NASBO State Expenditure Report` | 2 | `06-30` | 7 | **no** — an aggregate across states with different calendars, so one month cannot be right for it |

Note the Texas rows are a genuinely different thing from the 50-state ACFR
family: the fund is the **General Revenue Fund**, the state's own name for its
principal operating fund, and it is unclassified for `fund_scope` by standing
ruling. Its fiscal calendar is nevertheless unambiguous.

---

## 6. Row-count gates added

| Constant | File | Added |
|---|---|---|
| `EXPECTED_ROWS` | `scripts/classifyFundScope.mjs` | `or-city-acfr-gf: 106`, `az-muni-acfr-gf: 64`, `seattle-city-acfr-gf: 34`, `state-acfr-gf-by-name: 56` |
| `EXPECTED_BASIS_ROWS` | `scripts/stampBudgetAxes.mjs` | same four |
| `EXPECTED_REPORTING_ENTITY_ROWS` | `scripts/stampBudgetAxes.mjs` | same four |

All four are **new** families; no pre-existing count moved.
