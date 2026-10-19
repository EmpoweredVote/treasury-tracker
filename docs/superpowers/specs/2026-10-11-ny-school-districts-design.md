# New York school districts onboarding — design

**Date:** 2026-10-11
**Status:** draft, awaiting review
**Scope:** all 719 New York school districts, FY1995–FY2025
**Follows:** [NY cities onboarding](2026-10-10-ny-cities-onboarding-design.md)
(#256 merged, #257 open) and its reconciliation,
`docs/superpowers/plans/NY-CITIES-RECON.md`

---

## 1. Why this exists

The city load answered a question incompletely. Task 12 found that Buffalo's
audited General Fund is **17.2%** larger than what TT publishes under that
label, and Rochester's **19.1%**, because OSC's *city* file omits the
education support payment and the aid behind it. The expenditure side was
traced to **$26 on $488 million**:

```
OSC A-fund 417,528,158 − Other Uses 423,881 + ACFR Education 70,822,758
  = 487,927,035 against an actual 487,927,061
```

The districts are the other half of that partition. **Buffalo City School
District files its own OSC AFR — $916,884,897 General Fund revenue, more than
twice the city's entire General Fund.** TT holds the city half and not the
district half, so a reader sees a smaller number than the city's own ACFR with
nothing on the page explaining why.

Loading the districts does not *fix* that by itself — the labels still need
work (§9) — but it is the prerequisite for ever fixing it, and it roughly
doubles TT's New York coverage on its own merits.

---

## 2. The source — same mechanism, already proven

`https://wwe1.osc.state.ny.us/localgov/findata/level3zip/schooldistrict_all_years.zip`

**111 MB, 32 CSVs, `YYYY_SchoolDistrict.csv`, FY1995–FY2026.** Free, no key,
no auth, no WAF. Downloaded and verified 2026-10-11.

⭐ **The two schema eras split at exactly the same place as the cities** —
`FISCAL_YEAR_END` + `FINANCIAL_STATEMENT` for 1995–2012 (18 files),
`PERIOD_START`/`PERIOD_END` + `ACCOUNT_CODE_SECTION` for 2013–2026 (14 files).
`scripts/lib/nyOsc.mjs` already handles both and needs **no change** for it:
`eraForHeader`, `sectionOf`, `normLabel`, `parseAmount`, `parseCsv`,
`buildNyTree` and `fiscalYearStartMonth` all apply unaltered.

### 2.1 Keep on disk — `docs/NY/school_all_years.zip`, gitignored

Already fetched and on disk, gitignored by the `docs/*` rule:

| File | Size | |
|---|---|---|
| `school_all_years.zip` | 111,027,648 B | sha256 `8dcf85329ee016e7…`, 32 members, integrity-checked |
| `osc-arm-school-districts.pdf` | 1,982,139 B | **the §4 evidence of record** |

Treat it exactly as `city_all_years.zip`: skip-if-present, no per-year endpoint
exists, re-verification is free.

⚠ Delete the manual and every fund classification in §4 loses its basis.

---

## 3. Coverage

**719 distinct district names across FY1995–FY2026**, 690–711 in any one year.

| | |
|---|---|
| FY1995 | 711 |
| FY2012 | 702 |
| FY2013 | 695 |
| FY2021 | 692 |
| FY2025 | **692 — complete** |
| FY2026 | 690, partial (96,759 rows vs 138,102 in FY2025) |

⚠ **Districts do NOT taper the way cities do.** The city load stopped at
FY2021 because filings thin out after it; the districts are complete through
FY2025. **The window is FY1995–FY2025, 31 years**, and the resulting asymmetry
with the city load (FY1995–FY2021) is each source's own completeness, not an
inconsistency to paper over.

---

## 4. ⭐ The fund table is explicit, complete, and in the districts' own manual

⚠⚠ **`scripts/data/nyOscFundPrefixes.mjs` DOES NOT APPLY HERE AND MUST NOT BE
REUSED.** It is cited to the *Accounting and Reporting Manual for Counties,
Cities, Towns, Villages, Libraries and Soil and Water Conservation Districts*.
School districts have **their own manual**:

`https://www.osc.ny.gov/files/local-government/publications/pdf/arm_schools.pdf`
→ keep at `docs/NY/osc-arm-school-districts.pdf`

Unlike the city manual — where the fund letters had to be assembled from prose
across a chapter — the district manual prints a **single explicit table**:

> "The alpha portion of each code, consisting of one or two letters, identifies
> the fund. The following funds are provided for school districts in New York
> State:"

| Type | Fund | Alpha code |
|---|---|---|
| **Governmental** | General | `A` |
| | Special Revenue — School Food Service Programs | `C` |
| | Special Revenue — Miscellaneous Revenue | `CM` |
| | Special Revenue — Special Aid | `F` |
| | Special Revenue — Public Library | `L` |
| | Capital Projects | `H` |
| | Permanent | `PN` |
| | Debt Service | `V` |
| **Fiduciary** | Custodial | `TC` |
| | Private-Purpose Trust | `TE` |

**Those ten are exactly the ten that occur in FY2013–FY2026 data.** Zero
unclassified prefixes from FY2013 onward.

⚠⚠ **`C` IS GOVERNMENTAL HERE AND THIS IS THE TRAP.** For a *city*, food
service and similar fee-based operations sit in an `E_` **enterprise** fund and
are excluded from `total_governmental`. For a *district*, the manual places
School Food Service Programs under **Special Revenue**, which is governmental
and therefore **included**. `C` is 278,779 rows. Carrying the city's instinct
across would understate every district with a lunch program.

⚠ There are **no enterprise and no internal service funds** for districts at
all, so the city registry's largest exclusion class simply does not exist here.

`total_governmental` = `A + C + CM + F + L + H + PN + V`, excluding `TC` and
`TE`.

### 4.1 Three retired codes, confined to the old era

`CS` (2,591 rows), `TN` (2,436) and `B` (908) appear in the data and are **not
in the manual's table**. Distribution of refused `total_governmental` cells:

```
FY1995 928   FY1996 858   FY1997 295   FY1998 377   FY1999 321   FY2000 331
FY2001 325   FY2002-FY2010 ~35/yr      FY2011 1     FY2012 4     FY2013+ 0
```

**3,762 of 43,163 Total Governmental cells (8.71%), every one of them in
FY1995–FY2012.** They follow §5's rule and publish `unknown`.

> ⚠ **Corrected 2026-10-19.** This read `43,168` as written and propagated that
> figure into the plan and into `nyOscSchoolFundPrefixes.mjs`. The denominator
> is **43,163**, the measured `ny-osc-school-general-fund` row count:
> `43,163 + 39,401 = 82,564` (every row loaded) and `43,163 − 39,401 = 3,762`
> (the refused cells) both reconcile, and `43,168` reconciles with neither.
> `8.71%` is unchanged — both denominators round to it, which is why the
> percentage never flagged the error.

⚠ `CS` is retired in the *city* data too, over the same era, and the city
investigation disproved the obvious CS→MS rename. **Do not re-litigate it from
the district side without new evidence**; see `nyOscFundPrefixes.mjs`.

General Fund is unaffected in every year — `A` is unambiguous.

---

## 5. Unknown stays a first-class outcome

Unchanged from the city load and non-negotiable: a district-year containing a
revenue or expenditure prefix the registry cannot classify publishes
`total_governmental` as **`unknown`**, never a sum missing that fund. Omitting
a governmental fund understates; including a fiduciary one overstates. The
destructive direction is "declare two districts comparable".

`aggregateCityYear` in `scripts/lib/nyOsc.mjs` already implements this. It
takes its governmental set from an imported constant, so it generalises by
**injection, not by copying** (§8).

---

## 6. Axes

Identical reasoning to the cities, and identical values:

| Axis | Value |
|---|---|
| `basis` | `actual` |
| `audit_grade` | `self_reported_unaudited` |
| `accounting_basis` | `unknown` |
| `reporting_entity` | `unknown` |
| `derivation` | `derived` |
| `fund_scope` | `general_fund` · `total_governmental` |

⚠ The district AFR is filed by the district under the same General Municipal
Law regime, carries no opinion and no auditor, and OSC asserts no audit status.
`accounting_basis` stays `unknown` for the same reason as the cities: the
manual *directs* modified accrual, which is an instruction and not an outcome.

⚠ **`EXPECTED_ROWS` and `EXPECTED_BASIS_ROWS` both start absent and must be
MEASURED after the load**, not predicted. Both gates failed closed on the city
load (`expected 0, got 6357`) and that is them working.

---

## 7. ⚠⚠ Fiscal calendar — uniform here, and that breaks a city check

**Every district, every year, ends June 30.** One calendar, 719 districts, 31
years — verified across all 32 files.

This is the opposite of the cities, where five distinct year-ends made a
uniform result *proof of a defect*. `verifyNyOscCities.mjs` CHECK 4 therefore
contains:

```js
if (Object.keys(dist).length < 2) {
  fail('every city reports the SAME fiscal start month — …');
}
```

**That check is correct for cities and WRONG for districts.** Running it
unchanged would fail a correct load.

⚠ The fix is **not** to delete the check. For districts the assertion becomes:
every district reports month **7**, and it is still **read per entity per year**
from `PERIOD_START`/`FISCAL_YEAR_END` rather than hardcoded. A district whose
month is not 7 is then a finding, not a tolerance. The FYSM lesson is that a
month must be *measured*; it is not that the measurement must come out varied.

---

## 8. What changes in code, and what must not

The library is already right. The work is to stop it assuming cities.

| File | Change |
|---|---|
| `scripts/lib/nyOsc.mjs` | `aggregateCityYear` and `classifyPrefix` take the prefix registry and governmental set as **parameters**, defaulting to the city ones. No behaviour change for cities. |
| `scripts/data/nyOscSchoolFundPrefixes.mjs` | **New.** The ten funds of §4, each citing the district manual. |
| `scripts/data/nyOscSchoolEntities.mjs` | **New.** 719 districts, generated once, keyed on `MUNICIPAL_CODE`. |
| `scripts/fetchNyOsc.mjs` | Take an archive argument so it fetches either zip. |
| `scripts/loadNyOscSchools.mjs` | **New.** §10's batching. |
| `scripts/verifyNyOscSchools.mjs` | **New.** The five checks, CHECK 4 per §7. |
| `src/data/sourceChipTypes.ts` | **Add `school_district`** — see §9. |
| registries | New `ny-osc-school-*` entries, anchored, with their own evidence. |

⚠ `nyOscFundPrefixes.mjs` is **not edited**. Two publishers, two manuals, two
registries. Merging them would put `C` in one bucket for cities and another for
districts in a single table.

### 8.1 ⚠ Match on the municipal code, never the name

**Two codes carry two spellings each** across the archive:

```
260631600100  "Gates Chili Central School District" / "Gates-Chili Central School District"
140936100300  "Hopevale" / "Hopevale School District"
```

719 names against **717 codes**. Keying on the name would fork both districts;
`treasury_ensure_municipality` keyed on `(source, source_entity_key)` resolves
them to one entity and records the other spelling as an alias automatically.

⚠ The key lives in `treasury.municipality_source_keys`, **not** as a column on
`municipalities` — the city plan asserted otherwise and was wrong twice.

---

## 9. ⚠⚠ The source chip — a prerequisite, not a follow-up

`SOURCE_CHIP_ENTITY_TYPES` in `src/data/sourceChipTypes.ts` does **not**
include `school_district`, and its test pins that under *"is safe on a missing
or unknown entity type"*, grouped with `null` and `''` — because **no school
district has ever carried data**. It is not a product decision like the
deliberate `federal`/`nonprofit` exclusions, which have their own test and
their own stated reason.

Load 719 districts with data and every figure renders **with no provenance** —
no source name, no as-of date, no link. That is exactly the defect that left
**949 PA boroughs and 253 MI villages** showing figures with no provenance, and
exactly the defect that let Austin ship without its as-of date.

**`school_district` must be added to the set, and the enumeration test updated
in the same commit, BEFORE the load runs.** The other five declarations are
already in step: the CHECK constraint accepts it, the TS union names it
(`src/types/budget.ts:164`), `entityListLabel.ts` labels it "School Districts",
ev-accounts' `KNOWN_ENTITY_TYPES` lists it, and `CITY_TIER_TYPES` correctly
omits it (a district is not a city tier).

⚠ Do not add `school_district` to `CITY_TIER_TYPES`. TT sends that set as one
CSV and a type the API rejects **422s the whole query**, rendering a county
children panel empty — which reads as a coverage gap rather than a bug.

---

## 10. Scale, and the batching this needs

```
719 districts × 31 years × 2 datasets × 2 scopes ≈ 89,156 cells
  − 3,762 refused (§4.1)                         ≈ 85,394 budget rows
```

**Roughly 13× the city load (6,357 rows).**

⚠ The city loader issues **one SELECT per write** for its never-overwrite
guard. At this scale that is ~170,000 round trips and a multi-hour run.

**The guard stays; the lookup gets batched.** One query per district-year
covering all four (dataset × scope) combinations, or a single prefetch of
existing NY-OSC-school rows keyed by `(municipality_id, fiscal_year,
dataset_type, fund_scope)`. Same guarantee, a fraction of the traffic.

⚠ The guard must not be dropped. It provably cannot fire today — all 719
districts are new — but a guard that only appears once it is needed is not a
guard, and this is the largest load TT has run.

---

## 11. Verification

The five checks of `verifyNyOscCities.mjs`, with §7's CHECK 4 inversion, plus:

⚠⚠ **The `$0` tie remains forbidden as a check.** OSC publishes no total row
for districts either, so the tie is true by construction.

⚠ **Mutation-test every check before trusting a green run.** The city branch
shipped a test that compared an intersection and then asserted an identity over
idempotent output — it could never fail, and it hid a real $830M label split.
Each of the five was later proven able to fail; do the same here.

### 11.1 The independent oracle

FAC serves audited district ACFRs at the same free endpoint, and **school
districts are the single largest class of Single Audit filer**, so coverage
should be better than the cities'.

⚠ FAC starts at **audit year 2016**, so FY1995–FY2015 has no audit route —
19 of the 31 loaded years. State the gap; do not narrate those years as checked.

⭐ **Buffalo and Rochester are the highest-value reconciliations in this
load**, because they close the loop opened by the city work: if the district's
audited statement and the city's audited Education line can be tied together,
the §1 partition is demonstrated from both sides rather than one.

⚠ Read these PDFs with **pdfplumber glyph coordinates**. `pdftotext -layout`
scrambled Albany and Olean, attaching labels to other rows' figures.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| `C` treated as enterprise, as it is for cities | §4 — separate registry, district manual cited, and a test pinning `C` as governmental |
| 719 districts render with no provenance chip | §9 — source-chip wiring lands **before** the load |
| CHECK 4 fails a correct load on a uniform calendar | §7 — assert month 7 per entity, still read not hardcoded |
| A multi-hour load with a per-row lookup | §10 — batch the guard, keep the guard |
| Name-keyed matching forks 2 districts | §8.1 — key on `MUNICIPAL_CODE` |
| `EXPECTED_*` pasted rather than measured | §6 — both gates fail closed first; that is them working |
| Reusing the city fund registry | §8 — it is not edited, and §4 says why |

---

## 13. Open questions

1. **Does loading districts change what a TT *city* page should say?** §1 is
   the reason this work exists, but the fix — telling a reader that a NY city's
   General Fund excludes its school district — is a product decision this spec
   does not make.
2. **FY2026 is partial** (690 districts, ~70% of FY2025's rows) and is excluded.
   Re-run when OSC's snapshot completes, or wait for the next arc?
3. **`CS`/`TN`/`B`** cost 8.71% of Total Governmental cells in FY1995–FY2012.
   Accept, or attempt to source a pre-2013 district manual that defines them?
