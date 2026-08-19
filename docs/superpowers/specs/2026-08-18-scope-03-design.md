# SCOPE-03 — the series toggle

**Date:** 2026-08-18 · **Status:** design, awaiting review · **Branch:** `feat/scope-03`
**Predecessors:** SCOPE-01 (`v2.24`), SCOPE-02 (`v2.25`). Read
`docs/superpowers/plans/SCOPE-02-CLOSEOUT.md` first — its "What SCOPE-03 inherits"
section is the direct parent of this document.

---

## The goal, in one sentence

**A reader can choose which of an entity's published series they are looking at, instead
of being shown whichever one the app picked for them** — and the control grows on its own
as new sources land, without any further frontend work.

## The headline that survived measurement

The request was framed as "a toggle between General Fund and All Funds and the other
funds." Measured against the live database, that toggle has nothing to switch between:

```sql
-- entity+dataset pairs carrying two DIFFERENT KNOWN fund scopes
0
```

All 2,454 entities carry exactly one known `fund_scope` per dataset. A GF ⇄ TotalGov ⇄
All Funds control built today would render two of its three buttons permanently disabled
for every city in the country.

**But the app is already hiding real published data, and this milestone surfaces it.**
SCOPE-02 made a series `(entity, dataset_type, fund_scope, basis)` and had
`chooseDisplaySeries()` pick exactly one and hold it. That was correct — it is what
removed the Long Beach cliff. Its unavoidable side effect is that **every non-chosen
series became unreachable**:

| | |
|---|---|
| Entity+dataset pairs with more than one series | **28** |
| Entities affected | **17** (plus Longview TX — see §3.1) |
| Budget rows present in the database and unreachable in the UI | **91** |

Named, because these are the UAT surface:

| Entity | Displayed series | Currently unreachable |
|---|---|---|
| San Francisco | All Funds · actuals · FY2003–24 | unknown · adopted · FY2025–26 *(both datasets)* |
| Fresno | All Funds · actuals · FY2003–24 | unknown · adopted · FY2020–26 *(operating only)* |
| Los Angeles | All Funds · actuals · FY2003–20 | unknown · FY2021–26 op / FY2021–25 rev |
| Long Beach, Anaheim, Bakersfield | All Funds · actuals · FY2003–24 | unknown · adopted · FY2025–26 |
| Riverside, Santa Ana | All Funds · actuals · FY2003–24 | unknown · adopted · FY2023–26 |
| Oakland | All Funds · actuals · FY2003–24 | unknown · adopted · FY2024–25 |
| San Diego | All Funds · actuals · FY2003–24 | unknown · adopted · FY2025 |
| Cambridge | General Fund · FY2002–25 | unknown · FY2026 |
| Connecticut, Wisconsin, Massachusetts | General Fund · actuals · FY2002–25 | unknown · pre-GASB-34 years |
| Kentucky, Nevada | General Fund · actuals | unknown · one year each |
| Plano | unknown · FY2018–24 *(revenue)* | unknown · adopted · FY2019–22 |

⚠ **Every one of the 28 pairs differs on `basis`, `fund_scope`, or both — and in 26 of
them the second series is `unknown` on at least one axis.** So the control that ships is
correctly described as a **series** toggle, not a fund-scope toggle. Naming it after
`fund_scope` would misdescribe what it does today and would have to be renamed the moment
a second known scope arrives.

## What this milestone is NOT

Chris's framing, in his words: *"It should allow us to have multiple scopes in the future
as we find more sources."* The deliverable is the **mechanism**, not the data.

| Deferred | Why |
|---|---|
| Derived Total Governmental for era B (~8,500 rows) | Writes to the production database. Not needed to build or prove the mechanism, and the toggle now has 17 real entities to be exercised against without it |
| The enterprise / ISF slice made visible | Same. It is a tree-shape change, independent of series selection |
| Redefining what `detectSeams` means post-series-model | Instrument work; belongs with the seam-backlog triage, not with a UI control |
| Any migration, any figure change, any EV-Accounts change | **Zero.** Verified below |

## The precondition is already met — no API and no database work

Confirmed by reading the code rather than assuming:

* `Municipality.available_datasets[]` already carries `fiscal_year`, `dataset_type`,
  `period_label`, `fund_scope`, `basis`, `reporting_entity`
  (`src/types/budget.ts:152`). This is what the control enumerates from, and it is
  already in the payload the app fetches on load.
* `/treasury/cities/:id/budgets?fiscal_year=` returns whole rows carrying `fund_scope`
  and `basis`, and `pickBudgetForSeries(budgets, dataset, periodLabel, series)`
  (`src/data/dataLoader.ts:130`) **already addresses a row by series** and already
  returns `undefined` — not a substitute — when the series has no row for that year.
* SCOPE-02 widened the unique index to include `fund_scope` and `basis`, so a
  second-scope row can already coexist with the first without either overwriting the
  other.

**SCOPE-02 built the whole foundation. This milestone is the control on top of it.**

---

## 1. Architecture

Two new files, both small, plus threading in `App.tsx`.

```
src/data/seriesSelection.ts        pure: enumerate, default, validate, encode/decode
src/components/FundSeriesToggle.tsx  presentational: pills + absent-side note
```

`App.tsx` owns the selected series as state and syncs it to the URL. `loadBudgetData`
gains an explicit `series` parameter.

**Why the logic is not in `App.tsx`:** it is already 1,468 lines, and the pure half needs
to be unit-testable beside `budgetSeries.test.ts` without a DOM. `seriesSelection.ts`
depends on `budgetSeries.ts` and `fundScopeVocabulary.ts`; nothing depends back on it
except `App.tsx` and the component. The dependency runs one way, as SCOPE-02 Ruling 1
required after the import-cycle near-miss.

### `seriesSelection.ts`

```ts
export interface AvailableSeries {
  key: SeriesKey;                       // { fundScope, basis } — SCOPE-02's identity
  label: string;                        // from seriesLabel(), e.g. "All Funds · actuals"
  /** Per-dataset coverage. A dataset absent from this map has no row in this series. */
  coverage: Map<string, { years: number[]; min: number; max: number }>;
}

export function listSeries(datasets: DatasetEntry[]): AvailableSeries[];
export function encodeSeries(k: SeriesKey): { scope: string; basis: string };
export function decodeSeries(scope: string | null, basis: string | null,
                             available: AvailableSeries[]): SeriesKey | null;
```

`listSeries` returns the **union** of `(fund_scope, basis)` pairs across `operating` and
`revenue`, ordered by total coverage descending so the widest series reads first.

**Union, not intersection** — because Chris's rule is that a series present on only one
side stays reachable, with the other side rendering absent. An intersection would make
Fresno's FY2020–26 adopted operating figures permanently invisible, which is the defect
this milestone exists to remove.

**Salaries is excluded from series enumeration.** All 7,886 salary rows are
`fund_scope='unknown'`, and `dataset_type='salaries'` is a two-level tree with no `i`
array — a different shape from the budget tree entirely. It keeps its current behaviour
and its own tab.

---

## 2. The default changes nothing for anybody

Initial selection = today's `chooseDisplaySeries()` result for the active dataset.

This is the load-bearing invariant of the milestone: **on first paint, every entity on the
site shows exactly the figure it shows today — with exactly one measured exception,
§3.1.** 2,436 of 2,454 entities have a single series across both datasets and render a
single non-interactive pill. The 17 multi-series entities render a real toggle already
resting on the series they display today.

⚠ `chooseDisplaySeries` must not be modified. Its rule — evidenced beats unevidenced
regardless of coverage — is what keeps the default honest, and it is pinned by
`budgetSeries.test.ts`. This milestone consumes it; it does not renegotiate it.

---

## 3. Absent, never substituted

Chris's rule, verbatim: *"If you select a source, like All Funds or General Funds, you
should show the In/Out for that source. If it doesn't have one or the other, leave the
other data absent. When you click the other chip, then both the Money In and Money Out
get refreshed."*

So the selection is **shared across Money In and Money Out**, and a side that lacks the
chosen series renders an explicit absent state naming what is missing — never a fallback
to a different series. Two figures on screen are therefore always at the same level, or
one of them is empty. There is no third possibility.

⚠ **The one real code change this forces.** `pickBudgetForSeries` already returns
`undefined` correctly, but `loadBudgetData` turns that into a **thrown error**
(`dataLoader.ts:67`). A thrown error is indistinguishable from a network failure at the
call site, so the UI would show a failure state where the honest answer is "this series
has no Money In figure for FY2025." `loadBudgetData` must return a distinguishable
absent result for this one case, leaving genuine fetch failures throwing as they do now.

Fresno is the live proof: its operating dataset has two series and its revenue dataset has
one. Selecting `unknown · adopted` there must render Money Out for FY2020–26 and Money In
as absent.

### 3.1 ⚠ Longview TX — the one page this milestone changes, and the open decision

**This is the only measured place where the shared-selection rule removes a figure that is
on screen today.** It was found by asking how many entities render more than one pill
(**18**) rather than how many have a multi-series dataset (**17**), and the two numbers
disagree by exactly one.

```
Longview, TX    operating   unknown · adopted budget        FY2026   1 row
                revenue     unknown · basis not established FY2026   1 row
```

Neither dataset is multi-series, so `chooseDisplaySeries` runs independently per dataset
today and **both tiles render**. Under the union rule the entity offers two pills, each
covering exactly one dataset — so whichever pill is selected, the other tile goes absent.
No other entity in the database has this shape.

Two readings, and they lead to different pages:

* **Honour the rule (recommended).** The two figures genuinely sit on different bases:
  one is a FY2026 adopted budget, the other has no established basis. Rendering them as a
  Money In / Money Out pair invites exactly the subtraction across bases that SCOPE-02
  exists to prevent, and this milestone would be knowingly preserving a miniature of the
  defect it inherits. The reader loses nothing — both figures stay reachable, one pill
  each — and gains an explicit statement that they are not a pair. Cost: one live page
  shows one tile where it showed two, and the first-paint invariant carries an exception.
* **Exempt single-series datasets.** A dataset offering no choice always renders its only
  series regardless of selection. First paint is then provably unchanged everywhere. Cost:
  it contradicts the shared-selection rule as stated, and it re-permits a cross-basis pair
  on the one page where the data proves the pair is unsound.

**RULED 2026-08-18 — Chris: honour the rule (the first reading).**

Longview's Money In and Money Out are not a pair and the app will stop presenting them as
one. Selecting either pill renders that dataset and marks the other absent, with the same
copy every other absent side uses. Both figures stay reachable; neither is deleted.

Consequences carried into the rest of this document:

* The first-paint invariant (§2) is stated **with this exception**, not as an absolute.
* The Definition of Done names Longview explicitly rather than asserting "no page changes".
* A detector for the shape — *entity renders more than one pill while no single dataset is
  multi-series* — is in scope, so the next one is found by a harness rather than by a
  reader. There is exactly one today and nothing would report a second.

---

## 4. Two things that would break silently, and their fixes

Both were found by reading the code, and neither is visible in any test that exists today.

### 4.1 The cache key omits the series

```ts
const cacheKey = `${municipalityName}-${municipalityState}-${year}-${dataset}-${periodLabel ?? ''}`;
```

`dataLoader.ts:31`. No `fund_scope`, no `basis`. Today that is harmless because the series
is chosen deterministically inside the loader and never varies for a given key. **The
moment the caller can choose, switching series returns the previously cached other-series
figure** — the same class of non-determinism SCOPE-02 removed from `pickBudgetForSeries`,
reintroduced one layer up. The key gains both fields.

### 4.2 `availableYears` is series-blind

`App.tsx:228` builds the year list from **all** of `available_datasets` via
`buildPeriodTokens`. With a selectable series, the year selector would offer years the
selected series does not cover, and clicking one would land on an absent state that reads
as a bug rather than a fact.

The year list is filtered to the union of the selected series' coverage across the
datasets it has. Switching to a narrower series clamps the selected year to the nearest
available year within it and says so, rather than silently landing somewhere else.

⚠ `buildPeriodTokens` also handles the FY1976 Transition Quarter `period_label` row. The
filter must be applied to its **input**, not to its output tokens, or the TQ token is
dropped or orphaned. Federal is the only entity with TQ rows and it has a single series,
so this cannot be caught by the multi-series fixtures — it needs its own test.

---

## 5. URL state

`?scope=…&basis=…` join the existing `?entity/year/dataset/lens`.

This means `IDENTIFYING_PARAMS` and `buildBudgetSearch` in `src/utils/spaUrl.ts` both
gain the two keys. ⚠ That module exists because Treasury spent 90 days recording every
visitor against the bare host, and a published engagement rate had to be withdrawn for
want of a denominator. **Adding an identifying param changes what counts as a
navigation**: switching series will now push history and capture a pageview, which is
correct — it is a real view change — but `resolveUrlSync`'s `changed` guard must be
re-proven against the new key set, not assumed to still hold.

Params are omitted entirely when the selection equals the default, so today's URLs are
byte-identical to today's and no existing bookmark changes meaning. Anything invalid — a
garbage value, or a series that entity does not have — falls back to the default, matching
how `?dataset=` is already validated at `App.tsx:286`.

**The selection does not persist across entities.** A series Modesto has, Natick will not;
carrying it over would drop the reader into an absent state on arrival. Each entity
resolves its own default.

---

## 6. Reader-facing copy

All new wording goes in `src/data/fundScopeVocabulary.ts`, which is SCOPE-01's single
reviewable home for everything the app says about scope. **Nothing is authored inline in
JSX.** Chris reviews that file before it ships, as he did for SCOPE-01 Task 10.

Three new strings are needed: the absent-side note, the year-clamp note, and a one-line
explanation of what the control is for. `seriesLabel()` and `FUND_SCOPE_COPY` already
exist and are reused unchanged.

⚠ **The degenerate label case.** Plano's revenue dataset has two series that are *both*
`fund_scope='unknown'`, differing only on basis (`unknown` vs `adopted`). Rendered through
`seriesLabel()` alone they read `Scope not established · basis not established` and
`Scope not established · adopted budget` — distinguishable, but only just, and both start
with the same five words. The pill carries its **year span** as a second line
(`FY2018–24` vs `FY2019–22`), which is what actually separates them for a reader. This is
why the pills show coverage and not only a name.

⚠ **Tailwind tokens.** `ScopeLabel.tsx` carries a standing warning worth repeating here:
there is no `ev-blue` scale and the gray steps are three-digit (`ev-gray-050`). A wrong
colour class is dropped **silently** — the build, `tsc`, and the full suite all stay green
while the chip renders unstyled. The new component reuses `TONE` and `VERIFIED_TONE`
exported from `ScopeLabel.tsx` rather than authoring new class strings.

---

## 7. Testing

| Level | What |
|---|---|
| `seriesSelection.test.ts` | one / two / three series; union across datasets; one-sided series; mismatched year spans; ordering; `unknown`-only entities; the Plano both-unknown case; encode/decode round-trip; invalid params falling back |
| `dataLoader` tests | cache key varies by series (**mutation-tested** — prove it fails without the fix); absent result distinguished from fetch failure |
| `spaUrl` tests | the new params are identifying; default selection omits them; `changed` still false on a same-view deep link |
| Component | pills render from real series; single-series renders one non-interactive pill; absent-side note appears |
| Year filtering | narrower series clamps the year; **the FY1976 TQ token survives filtering** |

**UAT is against production data, not fixtures.** The 17 entities above are real and
already deployed. San Francisco is the clean symmetric case (two series, both datasets);
**Fresno is the absent-side case**; Los Angeles has different spans on each side; Cambridge
is a single-year second series; Connecticut is the benign pre-GASB-34 boundary;
**Longview TX is §3.1** and must be looked at directly, whichever way it is ruled.

⚠ **The Longview shape needs its own unit fixture regardless of the ruling**: two datasets,
one series each, series differing. It is the case that distinguishes "count multi-series
datasets" from "count entities rendering more than one pill", and no other production
entity exercises it — so if Longview's data ever changes, only the fixture protects it.

⚠ This supersedes the plan agreed in brainstorming, where UAT was to be fixture-only
because production was believed to have no multi-series entity. That belief came from
querying `fund_scope` alone and not `(fund_scope, basis)` — **the same shape of error as
SCOPE-02's Premise 2**, where the seam was assumed to be a scope change and turned out to
be two changes stacked. A dev-only fixture flag is therefore **not needed** and is dropped
from the design.

---

## 8. Scope boundaries

**In:** `seriesSelection.ts`; `FundSeriesToggle.tsx`; series threading through the six
`loadBudgetData` call sites in `App.tsx`; the cache-key fix; the absent-result fix; the
`availableYears` filter and year clamp; the two URL params; the copy; the tests; and
`verify-series-shape.mjs` (§3.1, §9).

**Out:** every database write, every migration, every EV-Accounts change, derived Total
Governmental, the enterprise slice, the seam-definition fix, and any change to
`chooseDisplaySeries`'s ranking rule.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **The cache-key defect ships unfixed** and two cities show each other's figures | Mutation-tested: the test must be proven to fail before the fix is trusted. This is the highest-severity item in the milestone |
| A reader reads two pills as "two answers, one of them wrong" | They are both correct and answer different questions — the existing `FUND_SCOPE_EXPLAINER` already makes this argument and is reachable from the chip. Worth watching at UAT with a real entity rather than assuming |
| The control reads as a fund-scope toggle when 26 of 28 live cases differ on basis | Named a **series** toggle throughout, and the pill states basis explicitly. Renaming later would be worse than naming it correctly now |
| Switching series now captures a pageview, moving engagement figures | Correct behaviour, but it changes a published metric's meaning. Flag it to whoever reads the Treasury funnel before it ships |
| The FY1976 TQ token breaks and no multi-series fixture catches it | Its own test, called out in §4.2 |
| Shipping a control that most entities render as a single inert pill | Accepted and intended. 17 entities exercise it today; the rest light up as sources land, with no further frontend work — which is the whole point of the milestone |
| **A Longview-shaped entity appears in a future load and silently loses a tile** | Not detectable by any existing harness. §3.1 having been ruled, a `verify-series-shape.mjs` check for "entity renders >1 pill but no dataset is multi-series" ships with this milestone and is mutation-tested against a synthetic second case |

---

## 10. Definition of done

1. On every entity, first paint shows **the same figure it shows today**, with the single
   exception ruled on in §3.1. Verified across a sample including all 17 multi-series
   entities and Longview TX.
2. San Francisco renders two pills; selecting the second shows FY2025–26 on **both**
   Money In and Money Out.
3. Fresno renders two pills; selecting `unknown · adopted` shows Money Out for FY2020–26
   and Money In **absent**, with the reason stated.
4. Switching series never returns a cached figure from the other series — proven by a
   test that fails without the cache-key fix.
5. The year selector offers only years the selected series covers; switching to a narrower
   series clamps and says so; the FY1976 TQ token still renders for Federal.
6. `?scope=&basis=` deep-links restore a selection; a default selection emits neither
   param; invalid values fall back without error.
7. `npm run build` clean — **not `npx tsc --noEmit`**, which is not the CI gate and does
   not build the project references.
8. No migration, no row written, no EV-Accounts commit. `figures_frozen` is untouched
   because nothing writes to the database at all.
