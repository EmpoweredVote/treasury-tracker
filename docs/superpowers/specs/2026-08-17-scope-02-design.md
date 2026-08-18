# SCOPE-02 — Basis, reporting entity, and one series per (scope, basis)

**Date:** 2026-08-17 · **Status:** design, awaiting review · **Branch:** `feat/scope-02`
**Predecessor:** SCOPE-01, shipped as `v2.24`. Read
`docs/superpowers/plans/SCOPE-01-CLOSEOUT.md` and `SCOPE-01-RECON.md` first.

---

## The goal, in one sentence

**A reader looking at Long Beach sees one continuous spending series instead of a 75% cliff that
never happened** — and the cliff turns out to be caused not by a missing figure, but by two
different kinds of figure being drawn as one line, plus real published data that the database
was structurally unable to hold.

## What this design cost to get right, and why that is recorded here

Three premises were tested and **all three failed** before this document reached its final shape.
They are written down because each one would otherwise be rediscovered.

### Premise 1 — "Total Governmental can be derived from the SCO row." FALSE for 63% of rows.

The Modesto FY2024 reconciliation ties to the dollar
(`$588,042,068 − $296,400,946 = $291,641,122`), so subtracting enterprise/ISF roots looked like a
free, exact derivation across all 23,260 SCO rows. **It only works for FY2017 onward.**

Measured across the corpus, the SCO cities report restructures at FY2017:

| Era | Rows | `Public Utilities` present | ...alongside enterprise roots | Avg PU share |
|---|---|---|---|---|
| **A — FY2003–2016** | 14,752 | 275–286 rows/yr | **0** | 16–19%, max 90.5% |
| **B — FY2017–2024** | 8,508 | 36 rows | 32 | 2.9%, max 16.6% |

Modesto FY2016 → FY2017 shows where the money went:

| Root | FY2016 | FY2017 |
|---|---|---|
| Public Safety | $85.8M | $86.8M |
| **Public Utilities** | **$69.9M** | — |
| **Health** | **$58.1M** | — |
| **Transportation** | **$54.8M** | **$9.4M** |
| Water / Sewer / Transit / Solid Waste / Other / ISF | — | $198.3M |

`Health` vanishes and `Transportation` collapses by $45M, because **solid waste was inside Health
and transit was inside Transportation**. Era A is a *function* taxonomy spanning all funds:
proprietary activity is smeared across governmental-looking roots, and **no subset of era-A roots
equals the enterprise funds.** Era A is structurally underivable by subtraction — not "pending a
probe".

⚠ Note how nearly this went wrong. A regex over root names would have subtracted
`Public Utilities` in era A and produced a figure that was too high in a way no arithmetic gate
could see, sitting between two correct years on the chart.

### Premise 2 — "The seam is a fund-scope change." It is TWO changes stacked.

```
FY2002-2024  CA State Controller - Expenditures        all funds, ACTUALS
FY2025       Long Beach General Fund Operating Budget  general fund, ADOPTED BUDGET
```

SCO publishes **actuals**. The city rows are **adopted budgets**, and several cities carry FY2026
rows — a year that has not closed and for which no ACFR will ever exist. `treasury.budgets` has
no column for this axis. **It is `fund_scope` before SCOPE-01, exactly**: a dimension the data
varies on that the schema cannot express, so the app silently draws across it.

### Premise 3 — "The recent years need new documents." Some of them are already published.

| City | SCO actuals loaded | Own budget rows |
|---|---|---|
| Anaheim / Bakersfield / Long Beach | FY2003–**2024** | FY2025–2026 |
| Oakland | FY2003–**2023** | FY2024–2025 |
| Riverside / Santa Ana | FY2003–**2022** | FY2023–2026 |
| Fresno | FY2003–**2019** | FY2020–2026 |

Zero overlap, and the handover year is exactly where each city's own rows begin. But **SCO
published through FY2024** — Anaheim has those years. So Fresno FY2020–2024, Riverside and Santa
Ana FY2023–2024, and Oakland FY2024 are all-funds actuals that **exist at the source and are
missing from Treasury Tracker**, because the unique index allows one row per
`(municipality_id, fiscal_year, dataset_type, period_label)` and a budget-document row took the
key first (`treasury_sync_budget_tree` is source-safe never-overwrite).

**Part of the seam is data the index kept out.**

---

## Decisions

| Decision | Chosen | Note |
|---|---|---|
| Definition of done | **Reader-facing** — the seams are gone | Infrastructure-only was rejected |
| Series level | **All Funds** | Every SCO year is already all-funds. Total Governmental was chosen first and abandoned when premise 1 failed |
| Basis | **Model it** — `basis` column, series split by it | Cliff disappears with no extraction and no derivation |
| Derived Total Governmental | **Dropped from this milestone** | Only 37% derivable; belongs with SCOPE-03's toggle, on era-B rows |
| Index widening | **Yes — to hold two published figures**, not derived ones | Justified by premise 3, which is real missing data |

---

## 1. Data model

```sql
ALTER TABLE treasury.budgets
  ADD COLUMN basis text NOT NULL DEFAULT 'unknown'
    CHECK (basis IN ('actual','adopted','unknown')),
  ADD COLUMN reporting_entity text NOT NULL DEFAULT 'unknown'
    CHECK (reporting_entity IN ('primary_government','incl_component_units','unknown'));

-- Lets ONE city-year hold both a published actuals figure and a published
-- budget figure. SCOPE-01 deliberately did not widen this because nothing then
-- produced a second row; premise 3 shows something does, and that something is
-- real data currently excluded.
DROP INDEX treasury.idx_budget_municipality_year_type;
CREATE UNIQUE INDEX idx_budget_municipality_year_type
  ON treasury.budgets (municipality_id, fiscal_year, dataset_type, period_label, fund_scope, basis)
  NULLS NOT DISTINCT;
```

### `basis`, stamped from evidence

Same rule as `fund_scope`: **no evidence, no value.** `unknown` is a legitimate result.

| Source family | `basis` | Evidence |
|---|---|---|
| CA SCO (all four strings) | `actual` | The Cities/Counties Annual Report collects reported financial transactions for a closed year |
| WA SAO, state/city ACFR extracts | `actual` | Audited statements of a closed year; the strings say "actual" |
| MN OSA, Ohio AOS | `actual` | Both are year-end reporting forms |
| `X Operating/Revenue Budget FY####` (city documents) | `adopted` | The documents are adopted budgets. **165 rows / 129 strings / 30 entities**, measured 2026-08-17 |
| MA DLS | `unknown` | Not probed |
| Everything else | `unknown` | |

⚠ **A fiscal year at or beyond the current one cannot be `actual`.** Several cities carry FY2026
rows; a harness asserts no row is `actual` for a year that has not closed, which is a cheap check
that would have caught this class of mislabelling at load time.

### `reporting_entity`, stamped from evidence

| Source | `reporting_entity` | Evidence |
|---|---|---|
| MN OSA | `incl_component_units` | Bloomington FY2022; ~7% statewide, ~17–22% TIF-heavy. RECON §4.7 |
| State / city ACFR extracts | `primary_government` | The statements are the primary government's |
| Ohio AOS | **`unknown`** | Expected `primary_government`, UNCONFIRMED — columbus.gov returned 403 |
| CA SCO, VA APA | **`unknown`** | Not probed |

Expected is not evidenced. Both columns default to `unknown` and stay there without a document.

---

## 2. The backfill — loading what the index kept out

Re-run the SCO loader for the city-years it previously skipped: **Fresno FY2020–2024, Riverside
FY2023–2024, Santa Ana FY2023–2024, Oakland FY2024**, operating and revenue.

⚠ **Whether SCO actually holds a filing for each of those city-years is a source fact to be
confirmed at load time, not assumed here.** SCO published the years; whether a given city filed
is measured, and any gap is recorded rather than filled.

This is the only new data in the milestone: no extraction, no derivation, no new document family.
It is also a **general** fix — the same index collision may have silently dropped rows for other
entities, so the loader reports every previously-skipped key it now writes.

---

## 3. The display rule

### The concrete break to fix first

`src/data/dataLoader.ts:64` picks a budget with `budgets.find(b => b.dataset_type === dataset)`.
Once a city-year has two rows, that returns whichever Postgres ordered first — **Long Beach FY2024
would display $2.4B or $2.3B non-deterministically.** This must be fixed in the same change that
widens the index, not after.

### One series per (fund_scope, basis)

**A series is identified by `(entity, dataset_type, fund_scope, basis)`, and one series is never
continued by another.** Appending an adopted General Fund budget onto an all-funds actuals series
is the defect; the cliff is an artifact of joining them.

```
Long Beach operating
  All Funds · actuals          FY2002-2024   ────────────────
  General Fund · adopted       FY2025-2026                 ──
  two labelled series, no cliff
```

The default series for an entity is the one with the widest fiscal-year coverage, ties broken
`actual > adopted` then `total_governmental > all_funds > general_fund`.

⚠ **`unknown` on either axis is never chosen as the default while an evidenced series exists**,
even if it has more years — it is the absence of a value, not a value. An entity whose only
series is `unknown` displays as it does today.

### No EV-Accounts change is required

`getCities` already emits `fund_scope` in `available_datasets`
(`backend/src/lib/treasuryService.ts:439`) and `mapBudget` carries it on the budget payload — both
from SCOPE-01 Task 9. **`basis` and `reporting_entity` do need adding to those same eight sites**,
which is the one cross-repo change; it is additive and the database is shared, so there is no
deployment ordering to coordinate.

### The comparison guard

`isComparableScope()` becomes a three-dimensional predicate. Two figures are comparable only when
fund scope, reporting entity **and** basis all agree, and none is `unknown`. It stays a list-based
predicate in one place, which is why SCOPE-01 wrote it that way.

---

## 4. Guards

| Guard | Why |
|---|---|
| Every aggregate over `treasury.budgets` constrains scope **and** basis | Two rows per city-year is now legal, so any unconstrained `sum(total_budget)` double-counts. Existing aggregates are enumerated and fixed; a test asserts no new unconstrained one appears |
| No `basis = 'actual'` for an unclosed fiscal year | Cheap, and catches the FY2026 mislabelling class at load time |
| `dataLoader` selects by `(dataset_type, fund_scope, basis)`, never `dataset_type` alone | The non-determinism above |

---

## 5. Verification

### The figure digest

Adding backfilled rows moves a digest asserted never to move. It splits: the **invariant** is
`sha256(id | total_budget)` over the **id set frozen at v2.24** — a row that existed then must
still be byte-identical — and a second digest over rows created since is a change detector. The
frozen id set is committed as data; recomputing it from "rows that exist now" would make it
vacuous.

| Harness | Asserts | Mutation test |
|---|---|---|
| `verify-scope-duplicates.mjs` | **inverted from SCOPE-01.** Legal: at most one row per `(muni, fy, dataset_type, period_label, fund_scope, basis)`, and **at most one row per (city-year, dataset_type, basis)** | add a colliding row; must fire. ⚠ The SCOPE-01 assertion still passing would now itself be the bug |
| `verify-scope-seams.mjs` | **the acceptance test flips** — it currently *requires* finding the seven; it must now require **their absence specifically**, not of all 26. A detector reporting zero seams overall has broken, not succeeded | reintroduce a seam; must fire |
| `verify-basis.mjs` | every source family maps to an evidenced `basis`; no `actual` in an unclosed year; coverage reported with `unknown` counted, never hidden | flip one row to `actual` in FY2026; must fire |
| `verify-fund-scope.mjs` | extended for `reporting_entity` coverage | |

---

## 6. Scope boundaries

**In:** the `basis` and `reporting_entity` columns, stamped where evidence exists; the index
widening; the SCO backfill; the display rule and the `dataLoader` fix; the three-dimensional
comparison guard; the summation guards; the harnesses; the digest split; the eight EV-Accounts
sites.

**Out, deliberately:**

| Deferred | To | Why |
|---|---|---|
| Derived Total Governmental | SCOPE-03 | Only era B (37%) is derivable, and it is most useful as a *level in the toggle* rather than as a default series |
| The GF ⇄ TotalGov ⇄ All Funds toggle | SCOPE-03 | |
| All-funds actuals extracted from city ACFRs | later | Would extend the actuals series past the SCO window. Not needed for the goal once basis is modelled |
| MA DLS — 16,816 rows | its own milestone | **Still the highest-value single task available** and independent of this one |
| VA Exhibit B1 | its own milestone | A completeness defect, not a scope one |
| The remaining 19 seams | after this | Split the queue first — small or positive steps are sources awaiting a registry entry, not cliffs |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **The index widening is permanent**, and every future aggregate can double-count | Enumerated aggregates, a test against new unconstrained ones, and an inverted duplicate detector mutation-tested both ways |
| Splitting one line into two labelled series may read as *losing* data | It is the honest presentation, and no figure is removed. Worth checking at UAT with a real chart rather than assuming |
| The backfill may find SCO has no filing for some city-years | Recorded as a measured gap, not filled |
| `basis`/`reporting_entity` start `unknown` almost everywhere, so the stricter guard bites widely | Correct and intended; there is still no cross-entity comparison surface in the app (RECON §10.1), so nothing visible regresses |
| A third axis could be lurking, as basis was | Possible. The two found so far — scope and basis — were both invisible until measured. `verify-scope-seams.mjs` remains the instrument that would expose a third |

---

## 8. Definition of done

1. Long Beach, Anaheim, Riverside, Santa Ana, Oakland, Fresno and Bakersfield each render **one
   continuous series per (scope, basis)** with no cliff, and `verify-scope-seams.mjs` requires the
   absence of **those seven specifically**.
2. The SCO backfill has run; every previously-skipped key is either loaded or **recorded as a
   measured source gap**.
3. `basis` and `reporting_entity` coverage is **reported**, with `unknown` counted openly.
4. No row that existed at v2.24 has moved — the frozen-id digest is unchanged.
5. Every harness passes, each mutation-tested.
6. `npm run build` clean and the suite green — **`npm run build`, not `tsc --noEmit`**, which does
   not build the project references CI builds.
