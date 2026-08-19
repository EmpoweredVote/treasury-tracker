# SCOPE-03 closeout

**Branch:** `feat/scope-03` · **Date:** 2026-08-18
**Spec:** `docs/superpowers/specs/2026-08-18-scope-03-design.md` · **Plan:** `docs/superpowers/plans/2026-08-18-scope-03.md`
**Status:** built, verified against production data, **awaiting Chris's UAT sign-off**. Not tagged.

---

## The headline

**91 budget rows across 17 entities were sitting in the database, unreachable in the UI. They are reachable now.**

Fresno, live, before and after:

```
BEFORE   [ no control ]              All Funds · actuals  FY2003–24 only
                                     FY2020–26 adopted budget: in the DB, invisible

AFTER    [ All Funds · actuals            FY2003–24 ✓ ]
         [ Scope not established · adopted FY2020–26   ]   ← click it
                                     Money Out $773.8M · Money In absent, and it says why
```

Nothing was loaded to achieve that. SCOPE-02's `chooseDisplaySeries` picks one series and holds it — correct, and it is what killed the Long Beach cliff — but everything it did not pick became invisible. This milestone gives the reader the other choices.

## The measurement that reframed the request

Chris asked for "a toggle between General Funds and All funds and the other funds." Against the live database:

```sql
-- entity+dataset pairs carrying two different KNOWN fund scopes
0
```

All 2,454 entities carry exactly one known `fund_scope` per dataset. **A fixed GF / Total Governmental / All Funds control would have rendered two permanently disabled buttons for every city in the country.**

⚠ **The first measurement was wrong and had to be corrected before the spec was written.** Querying `fund_scope` alone said "nothing to toggle at all". Querying `(fund_scope, basis)` — SCOPE-02's actual series identity — found **28 multi-series pairs across 17 entities**. 26 of the 28 differ on **basis**, not scope.

That is why the shipped control is a **series** toggle and is named as one. It is the same error shape as SCOPE-02's Premise 2, where the seam was assumed to be a scope change and turned out to be two changes stacked: *querying one axis when the data varies on two.*

## What shipped

| | |
|---|---|
| `src/data/seriesSelection.ts` | pure: `listSeries`, `defaultSeries`, `encode`/`decodeSeries`, `seriesPeriodTokens`, `clampYearToSeries`, `spanLabel` |
| `src/components/FundSeriesToggle.tsx` | pills; one non-interactive pill when there is nothing to choose |
| `dataLoader` | `series` parameter, series-aware cache key, `SeriesAbsentError` |
| `App.tsx` | selection state, six call sites threaded, absent tiles, year filtering + clamp |
| `spaUrl` | `?scope=&basis=` deep links, omitted when default |
| `scripts/verify-series-shape.mjs` | detects the Longview shape |
| **Database writes** | **ZERO.** No migration, no row, no EV-Accounts change |
| Tests | 458 passing, 29 files (from 445 / 28) |

## Two silent defects, found by reading and killed by mutation

Neither was visible in any existing test, and both would have gone live the moment the caller could choose a series.

1. **`loadBudgetData`'s cache key omitted `fund_scope` and `basis`.** Harmless while the series was chosen inside the loader; with a caller-supplied series it returns the previously cached *other* series' figure — the non-determinism SCOPE-02 removed from `pickBudgetForSeries`, reintroduced one layer up. **Mutation-verified:** removing the series from the key fails exactly one test, `900 === 100`.
2. **`availableYears` was series-blind**, so the year selector would offer years the series does not cover. ⚠ The filter is applied to `buildPeriodTokens`' **input**, never its output — the FY1976 Transition Quarter token is synthesised from a `period_label` row. Federal is the only TQ entity and has a single series, so no multi-series fixture could catch it; it has its own test.

## Three things caught only by running the real app

**None of these were in the plan.** They are the argument for UAT against production data rather than fixtures.

### 1. ⚠ The default series was coupled to the active tab — a real bug, fixed

`effectiveSeries` derived its fallback from `defaultSeries(datasets, activeDataset)`, so **switching between Money In and Money Out silently switched series**, defeating the shared selection entirely. Measured on Plano TX: landing on Money Out gives `unknown · adopted` (operating FY2019–25); clicking Money In recomputed the default for `revenue`, jumped to `unknown · basis not established` — which has **no operating rows at all** — and blanked both tiles.

The default is now seeded once per entity, from whichever dataset the reader arrives on, and held. Verified: `SERIES STABLE ACROSS TABS: true`.

### 2. `erasableSyntaxOnly` rejects constructor parameter properties

`SeriesAbsentError` was written as `constructor(readonly dataset: string, …)`. **`npm test` passed. `npm run build` failed** with TS1294 — precisely why the plan forbids `npx tsc --noEmit` as the gate.

### 3. Los Angeles was already broken, and this milestone fixes it

LA lands on FY2026; its evidenced series ends FY2020. Verified by running `main` in a throwaway worktree side by side:

| | `main` (before) | `feat/scope-03` (after) |
|---|---|---|
| LA landing | **no tiles at all, error text on page** | tiles render, Money Out absent *with the reason*, second pill reaches FY2021–26 |
| LA FY2024 | **no tiles, error text** | same as above |
| Fresno FY2024 | $1.4B / $1.5B | $1.4B / $1.5B — **identical** |

`loadBudgetData` used to *throw* when the displayed series had no row for the year, which trips the error screen. `SeriesAbsentError` makes that state explicable instead. **A pre-existing bug on a top-5 city page, fixed as a side effect.**

## The §3.1 ruling, visible

Chris ruled 2026-08-18 that Longview TX honours the shared-selection rule: its Money In (`unknown` basis) and Money Out (`adopted`) sit on different bases and are not a pair.

```
Longview TX   [ Scope not established · adopted FY2026 ✓ ]  Money Out $104.8M
              [ Scope not established · basis n/e FY2026 ]  Money In  absent, explained
```

`verify-series-shape.mjs`, run against production, reports **exactly one** such entity — matching the spec's measurement. No existing harness would have found a second: the seam detectors compare *within* a dataset, never across two. Mutation-verified.

## UAT evidence (local frontend, production API)

| Entity | Result |
|---|---|
| Seattle, Natick, Bloomington, US Federal | single pill, **figures unchanged** |
| San Francisco | 2 pills, both tiles, $15.3B / $15.8B |
| **Fresno** | 2 pills; second pill → Money Out **$773.8M**, Money In absent + note; URL gains `&scope=unknown&basis=adopted` |
| Los Angeles | 2 pills, spans differ per side (FY2003–20 / FY2021–26) |
| Cambridge | 2 pills, second covers FY2026 only |
| Connecticut | 2 pills, `FY1988–2001` — the century-boundary rule working — $25.1B / $23.6B |
| Plano | 2 pills, series stable across tabs |
| **Longview** | the §3.1 ruling, as above |

## Incidental fix — a NUL byte in `.planning/STATE.md`

`STATE.md` contained a raw `U+0000`, so git classified it as **binary** and its diff and blame were destroyed. It sat **inside the line warning against NUL bytes**, written as a literal while documenting "never write the byte".

Removed with a byte-preserving replacement (`sed` silently stripped all 833 CRs on the first attempt; `perl` with `binmode` did not). The commit shows a whole-file diff because git never CRLF-normalises a *binary* blob and now normalises a *text* one — verified line-by-line that **exactly one line changed**.

⚠ SCOPE-02 recorded this defect firing three times and said "it wants a lint". This is the fourth. **The lint is still not written**, and it should be the next small task.

## What SCOPE-04 inherits

1. **Derived Total Governmental for era B** (FY2017+, ~8,500 rows) — a level in the toggle. Era A is structurally underivable; do not retry.
2. **The enterprise slice made visible.** The roots are already named (`Water Enterprise Fund`, `Internal Service Fund`, …) on era-B rows.
3. **A seam definition that survives the series model**, plus the ~19 remaining seams.
4. **A NUL-byte lint.** Four occurrences across three milestones.
5. **No component tests exist and none can be written** — `vitest.config.ts` is `environment: 'node'` and its `include` never collects `.test.tsx`, with no testing-library or DOM environment. A `.test.tsx` file **silently does not run**. Adding the toolchain is a decision for Chris; until then, push testable logic into pure modules.

## Open items

- [ ] **Chris's UAT sign-off**
- [ ] `v2.26` tag — **in the same step as `.planning/`**. v2.21 never reached `.planning/`, v2.22 was never tagged, v2.23 read "awaiting UAT" for a day after its tag existed, and SCOPE-02's ten rulings survived only because someone checked a gitignored workspace before deleting it. Five milestones, four misses.
