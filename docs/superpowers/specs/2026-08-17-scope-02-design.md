# SCOPE-02 — Comparable Totals: derived Total Governmental, reporting entity, and one scope per series

**Date:** 2026-08-17 · **Status:** design, awaiting review · **Branch:** `feat/scope-02`
**Predecessor:** SCOPE-01, shipped as `v2.24`. Read
`docs/superpowers/plans/SCOPE-01-CLOSEOUT.md` and `SCOPE-01-RECON.md` first — this document
assumes both.

---

## The goal, in one sentence

**A reader looking at Long Beach sees one continuous spending series instead of a 75% cliff that
never happened**, and the figure that closes the gap is derived by arithmetic we can prove, not
supplied by a guess.

SCOPE-01 made the seam *visible* and *measured* — 26 seams across 15 entities, every one
involving `unknown`. SCOPE-02 closes the CA ones and builds the machinery that makes closing the
rest routine.

## What SCOPE-01 established that this depends on

* `treasury.budgets.fund_scope` on all 79,927 rows; 53,404 classified from 8 evidenced entries.
* **The SCO expenditure and revenue rows are citywide all funds**, tied to the dollar against
  Modesto FY2024: governmental $291,641,122 + enterprise/ISF $296,400,946 = $588,042,068, which is
  SCO's reported total exactly. **That subtraction is the whole basis of this milestone.**
* `fund_scope` is exposed on the budget payload **and on `available_datasets`** — which is what
  makes the read-path fix in §4 possible without touching EV-Accounts.
* `isComparableScope()` is deliberately a list-based predicate rather than an inline
  `!== 'unknown'`, so a second dimension can be threaded through one place.

## Decisions taken before this design was written

| Decision | Chosen | Why it matters downstream |
|---|---|---|
| Definition of done | **Reader-facing** — the seams are gone | Forces the whole chain: derive, widen the index, and fix the read path. Infrastructure alone was rejected |
| Series level | **Total Governmental** | The only level every source can produce, and derivable from SCO for free. All Funds stays stored and visible; General Fund arrives with SCOPE-03 |
| Breadth | **All 533 SCO entities**, 23,260 rows | Same code as doing seven; only the row count differs. Lifts the comparable-at-`total_governmental` pool from 28,410 to ~51,670 |
| Derivation rule | **Evidenced root registry; refuse where unknown** | Coverage becomes a measured result, as `unknown` was in SCOPE-01 |
| Storage | **Second `budgets` row + widened unique index** | Keeps the derived figure first-class so the icicle, tabs, chips and scope label work on it unchanged |

---

## Measurement that shaped the design

Run against all 23,260 SCO rows on 2026-08-17, before any design was fixed.

### Root-category shapes

| Shape | Rows | Years | Side |
|---|---|---|---|
| Enterprise/ISF-named roots | 9,029 | FY2003–2024 | operating + revenue |
| **`Public Utilities`, no enterprise-named root** | **3,942** | **FY2003–2017** | **operating only** |
| Neither | 10,245 | FY2003–2024 | operating + revenue |
| Both | 32 | FY2017 | operating |

### Three populations that cannot derive

* **12 rows carry no categories at all** — nothing to subtract. The same 12 are the only rows
  where the roots fail to sum to `total_budget`.
* **One row's enterprise/ISF roots sum negative** (−6.48% of its total).
* **`Public Utilities`, 3,942 rows.** Expenditure-only, FY2003–2017, essentially never
  co-occurring with enterprise-named roots. It is either the older era's name for the same
  proprietary funds or a governmental function. **A document settles it; a regex guesses.**

### Why a name test is not good enough

`^(enterprise|internal service)` is a heuristic validated on **one city** — Modesto — being
applied to 23,260 rows across 533 entities and 22 fiscal years. That is the exact failure mode
SCOPE-01 exists to prevent, and it is how `special_revenue` got added on a false premise. If
`Public Utilities` is proprietary and we do not subtract it, **3,942 city-years derive too high
and look completely normal on the chart**, sitting between two correct years.

### The bounded piece of good news

**The entire SCO corpus uses 77 distinct root-category names.** All 77 can be classified with
evidence — this is a finishable job, unlike SCOPE-01's 2,084-string tail where stopping early was
the right call.

---

## 1. Data model

```sql
-- The one-way door. Nothing before SCOPE-02 could produce a second scope for a
-- city-year, which is exactly why SCOPE-01 deliberately did NOT widen this.
DROP INDEX treasury.idx_budget_municipality_year_type;
CREATE UNIQUE INDEX idx_budget_municipality_year_type
  ON treasury.budgets (municipality_id, fiscal_year, dataset_type, period_label, fund_scope)
  NULLS NOT DISTINCT;

ALTER TABLE treasury.budgets
  ADD COLUMN derivation       text NULL
    CHECK (derivation IS NULL OR derivation IN ('sco_minus_proprietary')),
  ADD COLUMN derived_from_id  uuid NULL REFERENCES treasury.budgets(id) ON DELETE CASCADE,
  ADD COLUMN reporting_entity text NOT NULL DEFAULT 'unknown'
    CHECK (reporting_entity IN ('primary_government','incl_component_units','unknown'));
```

**`derivation IS NULL` means "as published by the source".** Recording it in the database rather
than only in a UI label is what lets a harness find every derived row without knowing the rule
that made it.

**`derived_from_id`** means each derived row can be re-checked against its own parent rather than
against a remembered rule. It is the mechanism behind §5's re-derivation harness.

**`reporting_entity`** is the fourth dimension SCOPE-01 measured and could not express. Stamped
from evidence already gathered:

| Source | `fund_scope` | `reporting_entity` | Evidence |
|---|---|---|---|
| MN OSA | `total_governmental` | `incl_component_units` | Bloomington FY2022; ~7% statewide, ~17–22% TIF-heavy. RECON §4.7 |
| State / city ACFR extracts | `general_fund` | `primary_government` | The statements are the primary government's |
| Ohio AOS | `total_governmental` | **`unknown`** | Expected `primary_government` but UNCONFIRMED — columbus.gov returned 403. RECON §4.8 |
| CA SCO (stored and derived) | `all_funds` / `total_governmental` | **`unknown`** | Not probed. A derived row inherits its parent's value |
| VA APA | `unknown` | `unknown` | Exhibit C includes Education, i.e. the school division |

⚠ **`reporting_entity` defaults to `unknown` and stays there without evidence**, on exactly the
same rule as `fund_scope`. Ohio is *expected* to be `primary_government`; expected is not
evidenced.

### The derived row's category tree

A derived row gets a real tree: the parent's, minus the proprietary root subtrees, with
`percentage` recomputed against the new total and `sort_order` preserved. This is what keeps
`BudgetIcicle`, `BudgetSunburst`, the dataset tabs, `SourceChip` and `ScopeLabel` working on it
with no special-casing.

`data_source` on a derived row is the parent's string with a derivation suffix, so the source chip
never claims the State Controller published a figure it did not:

```
CA State Controller - Expenditures (Total Governmental derived by Treasury Tracker)
```

---

## 2. The derivation gate

`scripts/data/scoRootRegistry.mjs` — the `fundScopeRegistry` pattern one level down. All 77 root
names classified `governmental` / `proprietary` / `unresolved`, each carrying its own evidence
string. **An `unresolved` entry cannot classify**, mirroring SCOPE-01's rule that an unevidenced
registry entry cannot classify.

A row derives only when all four hold:

1. it has root categories at all — excludes the 12 with none;
2. `sum(roots) == total_budget` — excludes those same 12, and catches any future loader drift;
3. **every** root name is classified — `unresolved` blocks the whole row, not just its own amount;
4. the derived result is positive — excludes the negative-sum row.

Anything held back keeps only its `all_funds` row and is **reported**, never silently skipped:

```
derived 19,305 of 23,260 rows (83.0%)
held back  3,955:
   3,942  Public Utilities unresolved  (FY2003-2017, operating)
      12  no root categories
       1  proprietary roots sum negative
```

Those three populations are disjoint as measured, so they add: 3,942 + 12 + 1 = 3,955, and
23,260 − 3,955 = 19,305. **The script asserts that identity before writing** rather than printing
two numbers that do not reconcile.

⚠ **Coverage is a result, not a target.** If the `Public Utilities` probe resolves it as
proprietary, those 3,942 rows derive on the next run with no schema change and no code change —
one registry entry gains evidence.

### Acceptance test

**Modesto FY2024 must derive to exactly `$291,641,122`**, the figure its ACFR prints for Total
Governmental. A derivation that misses it by a dollar is wrong, and the script refuses to write.

The partition gate from `classifyFundScope.mjs` is reused wholesale: expected counts asserted
before any write, `--force` only for a deliberate registry change and printing what it overrides,
`--reset` removing every derived row so the milestone is reversible.

---

## 3. What the derivation is NOT allowed to assume

* **Not that enterprise is a fixed share.** Measured range across the corpus is −6.48% to 88.26%,
  mean 9.76%. No plausibility band can be fitted around that, and none is used.
* **Not that a name containing "Fund" is proprietary.** `Internal Service Fund` is; the county
  loader's `Hospital Enterprise Fund Fund` (duplicated suffix, a known hygiene defect) is; a
  governmental root may also carry the word.
* **Not that the revenue and expenditure sides share a taxonomy.** They demonstrably do not —
  `Public Utilities` appears only on the expenditure side. The registry is keyed on
  `(name, dataset_type)`.

---

## 4. Read path and display scope

### The concrete break

`src/data/dataLoader.ts:64` selects a budget with
`budgets.find(b => b.dataset_type === dataset && ...)`. The API returns a year's rows ordered only
by `fiscal_year DESC`, so with two rows differing solely in `fund_scope`, **Long Beach FY2024
would display $2.4B or $2.3B depending on Postgres row order** — silent, non-deterministic, and
indistinguishable from a data bug.

### No EV-Accounts change is required

`getCities` already emits `fund_scope` inside `available_datasets`
(`backend/src/lib/treasuryService.ts:439`), and `mapBudget` already carries it on the budget
payload. Both were added by SCOPE-01 Task 9. **The entire read-path fix lives in Treasury
Tracker**, which removes the cross-repo deployment ordering this milestone would otherwise need.

### The rule: one display scope per SERIES, not per year

**Picking per-year is what created the seam.** Each year independently showed "whatever that year
had", and the handover from an all-funds source to a General-Fund document produced a cliff.

For each `(entity, dataset_type)`, choose the scope with the widest fiscal-year coverage, ties
broken `total_governmental > all_funds > general_fund`, and hold it across the whole series.

⚠ **`unknown` is never chosen while any established scope is available for that series**, even if
`unknown` has more years — it is the absence of a scope, not a scope, so preferring it on coverage
would reintroduce exactly the mixing this milestone removes. A series whose only scope is
`unknown` displays as it does today, labelled "scope not established".

```
Long Beach operating
  all_funds            FY2002-2024   (23 years)
  total_governmental   FY2002-2025   (24 years, 23 derived + 1 extracted)
  chosen: total_governmental
  → one continuous series, one scope label, no seam
```

A year missing the chosen scope renders as a **gap**, which is honest, rather than being filled
from another scope, which is the lie SCOPE-01 was built to expose.

### The comparison guard

`isComparableScope()` widens to take both dimensions. Two figures are comparable only when their
fund scope **and** their reporting entity agree:

```ts
isComparable(a, b) =>
  a.fundScope === b.fundScope
  && a.reportingEntity === b.reportingEntity
  && !NON_COMPARABLE_SCOPES.includes(a.fundScope)
  && a.reportingEntity !== 'unknown'
```

⚠ **This is stricter than today and will reduce the comparable pool**, because `reporting_entity`
starts at `unknown` almost everywhere. That is correct: SCOPE-01 measured MN OSA running ~7–22%
high against an ACFR-derived `total_governmental`, and pretending otherwise is the same class of
error at a smaller magnitude. As with SCOPE-01, there is **no cross-entity comparison surface in
the app today** (RECON §10.1), so this lands as a guard, not a visible reduction.

### Summation guards

Any aggregate over `treasury.budgets` must now constrain scope or it double-counts. Every existing
aggregate is enumerated and fixed in the plan; a lint-style test asserts no new unconstrained
`sum(total_budget)` is added.

---

## 5. Verification

### The figure digest has to be redefined or it stops meaning anything

SCOPE-01's invariant is `sha256(id | total_budget)` over every row, asserted never to move.
**19,000 new rows move it by design**, and a baseline rewritten to accommodate that would defeat
the check permanently. It splits in two:

| Digest | Keyed on | Rule |
|---|---|---|
| **`preexisting`** | `(id, total_budget)` over the **id set frozen at v2.24** | THE INVARIANT. A row that existed before SCOPE-02 must still be byte-identical. Must never move |
| `derived` | `(id, total_budget)` over rows with `derivation IS NOT NULL` | A change detector. May move when a registry change explains it |

The frozen id set is committed as data, not recomputed — recomputing it from "rows that exist now"
would make it vacuous.

### Harnesses

| Harness | Asserts | Mutation test |
|---|---|---|
| `verify-derived-totals.mjs` | re-derives every derived row from its parent's categories, **importing nothing from the classifier**, and compares to what is stored | flip one derived total; must fire on exactly that row |
| `verify-scope-duplicates.mjs` | **inverted.** Legal pattern is now: at most one row per `(muni, fy, dataset_type, period_label, fund_scope)`, and **at most one row with `derivation IS NULL`** per city-year-dataset | add a second non-derived row; must fire. ⚠ The SCOPE-01 assertion still passing would now itself be the bug |
| `verify-scope-seams.mjs` | **the acceptance test flips.** It currently *requires* finding the seven; it must now require their absence | reintroduce a seam; must fire |
| `verify-fund-scope.mjs` | extended: every derived row has a `derived_from_id`, a `derivation`, and a parent that exists | orphan a derived row; must fire |

### The dollar tie

Modesto FY2024 derived `operating` = **$291,641,122**, matching the ACFR's printed Total
Governmental. Asserted in the script and in the harness, from the document, not from the
derivation.

---

## 6. The post-SCO years

The SCO series ends at FY2024, so the seven seam cities need Total Governmental from their own
ACFRs for the years past their handover — Long Beach, Anaheim and Bakersfield from FY2025;
Riverside and Santa Ana from FY2023; Oakland from FY2024; Fresno from FY2020.

⚠ **The exact per-city year sets are enumerated from the seam detector's output in the plan, not
assumed here.** The handover years above come from `verify-scope-seams.mjs`; whether SCO also
still carries a row for a given post-handover year is a per-city fact to be measured, and it
decides whether that year needs extraction or already derives.

`scripts/extractModesto.py` is the template — **46/46 rows tie at exactly $0, FY2002–FY2025** — and
the Total Governmental column sits adjacent to the General Fund column on the same statement, so
this is a column change, not a new extraction shape.

The CA-CITIES-01 traps carry over unchanged and are not rediscovered:

* **`pdftotext -layout` misaligns Modesto** — it pairs $162,667,321 with "Parks and recreation"
  where the rendered image shows Public safety. Use `-table`. This is the *inverse* of the WA
  finding. Neither renderer is trustworthy by default; the rendered image is.
* **Per-city `statement_anchor`, never a widened shared regex.** FY2024/FY2025 title the statement
  in the plural, and `find_statement_page` returns the earliest qualifying page — relaxing the
  shared `_TITLE` could silently change what 168 verified PDFs extract.
* **The MD&A reprints the statement's exact title** over a summarized table. Select by content.

---

## 7. Scope boundaries

**In:** the derivation registry and script; the schema changes; `reporting_entity` stamped where
evidence exists; the display-scope rule; the comparison and summation guards; the four harnesses;
the digest split; Total Governmental extraction for the seven cities' post-SCO years.

**Out, deliberately:**

| Deferred | To | Why |
|---|---|---|
| The GF ⇄ Total Governmental ⇄ All Funds toggle | SCOPE-03 | This milestone makes the default series honest; the toggle makes every level reachable |
| MA DLS — 16,816 rows | its own milestone | **Higher value than anything in SCOPE-02** (moves `general_fund` from 2.2% to ~23%) but entirely independent of it: one ACFR from a town that runs its own schools |
| VA Exhibit B1 | its own milestone | A completeness defect, not a scope one |
| The remaining 19 seams | after this | Nevada, Kentucky and the revenue-side twins. **Split the queue first** — small or positive steps are sources awaiting a registry entry, not cliffs |
| Ohio / VA `reporting_entity` probes | when a document is available | Both blocked on a fetch; `unknown` until then |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **The index widening is permanent** and the double-count hazard it creates never goes away | Enumerated aggregates, a lint-style guard against new ones, and an inverted duplicate detector that is mutation-tested in both directions |
| Day-one coverage is ~83%, not 100% | Reported as a result. `Public Utilities` needs one SCO report read; resolving it is a registry edit, not a code change |
| A derived figure is indistinguishable from a published one on a chart | `derivation` in the database, the suffix in `data_source`, and a "derived" treatment on the scope chip. All three, because the UI label alone drifts |
| The display-scope rule could flip a series between runs as coverage changes | The choice is deterministic given the data, and the harness records the chosen scope per series so a flip shows up as a diff |
| `reporting_entity` starting at `unknown` makes the stricter guard bite widely | Correct and intended; no comparison surface exists today, so nothing visible regresses |

---

## 9. Definition of done

1. Long Beach, Anaheim, Riverside, Santa Ana, Oakland, Fresno and Bakersfield each show **one
   continuous series at one scope**, and `verify-scope-seams.mjs` requires **the absence of those
   seven specifically** — not of all 26. The other 19 are out of scope and must still be found, so
   a detector that reports zero seams overall has broken, not succeeded.
2. Modesto FY2024 derives to **$291,641,122** exactly.
3. Derived-row coverage is **reported**, with every held-back population named and counted.
4. The `preexisting` figure digest is **unchanged** — no row that existed at v2.24 has moved.
5. All four harnesses pass, each mutation-tested.
6. `npm run build` clean and the full suite green — **run `npm run build`, not `tsc --noEmit`**,
   which does not build the project references CI builds.
