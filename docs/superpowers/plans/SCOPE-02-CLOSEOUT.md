# SCOPE-02 closeout

**Branch:** merged to `main` via PR #16 (`7209e6a`) and PR #17 (`0156d72`) · **Date:** 2026-08-18
**Spec:** `docs/superpowers/specs/2026-08-17-scope-02-design.md` · **Plan:** `docs/superpowers/plans/2026-08-17-scope-02.md`
**Status:** built, verified, merged, live. Awaiting UAT sign-off before the `v2.25` tag.

---

## The headline

**Fresno's spending no longer falls 44% in a year it didn't.**

```
BEFORE   FY2018  $822M · FY2019  $874M · FY2020  $485M   ← the cliff
AFTER    FY2018  $822M · FY2019  $874M · FY2020  $938M · FY2021 $1,079M
         FY2022 $1,187M · FY2023 $1,380M · FY2024 $1,474M
```

The FY2020 figure was the city's **adopted General Fund budget** drawn as the next point on a State Controller **all-funds actuals** line. Two different kinds of figure, rendered as one series.

## The three premises that failed

SCOPE-02 was specced twice. Every premise the first draft rested on was tested and broke, and each break made the milestone smaller and better founded. This is the substance of the milestone, not a preamble to it.

### 1. "Total Governmental can be derived from the SCO row." False for 63% of rows.

Modesto FY2024 ties to the dollar (`$588,042,068 − $296,400,946 = $291,641,122`), so subtracting enterprise/ISF roots looked like a free exact derivation across all 23,260 SCO rows. **It only works from FY2017 onward.** The SCO cities report restructures that year:

| Era | Rows | `Public Utilities` present | ...alongside enterprise roots | Avg share |
|---|---|---|---|---|
| **A — FY2003–2016** | 14,752 | 275–286 rows/yr | **0** | 16–19%, max 90.5% |
| **B — FY2017–2024** | 8,508 | 36 | 32 | 2.9% |

Modesto FY2016→FY2017 shows where the money went: `Health` vanishes and `Transportation` collapses by $45M, because **solid waste was inside Health and transit inside Transportation**. Era A is a *function* taxonomy spanning all funds — proprietary activity smeared across governmental-looking roots, with no subset of roots equalling the enterprise funds.

⚠ A regex over root names would have subtracted `Public Utilities` in era A and produced figures too high in a way **no arithmetic gate could see**, sitting between two correct years on a chart. This is why the probe was pulled forward into the milestone instead of deferred.

### 2. "The seam is a fund-scope change." It is two changes stacked.

SCO publishes **actuals**; the city rows that follow are **adopted budgets**, and several cities carry FY2026 rows for a year that has not closed. `treasury.budgets` had no column for that axis. **`basis` was `fund_scope` before SCOPE-01** — a dimension the data varies on that the schema cannot express, so the app silently draws across it.

### 3. "The recent years need new documents." Some were already published.

SCO published through FY2024, but **Fresno FY2020–2024, Riverside and Santa Ana FY2023–2024, and Oakland FY2024 were absent from Treasury Tracker** — a budget-document row held the key `(municipality_id, fiscal_year, dataset_type, period_label)` and `bulkLoadStateController.js`'s never-overwrite policy skipped the SCO data every time. **Part of the seam was data the index kept out.**

---

## What shipped

| | |
|---|---|
| `basis` | `actual` · `adopted` · `unknown`, CHECK-constrained, stamped per source from evidence |
| `reporting_entity` | `primary_government` · `incl_component_units` · `unknown` |
| Unique index | widened to include `fund_scope` and `basis` — **a one-way door** |
| `treasury_sync_city_budget` | lookup made key-complete; **refuses** on an ambiguous target rather than guessing |
| Series model | a series is `(entity, dataset_type, fund_scope, basis)`; one series never continues another |
| Backfill | **12 rows, 0 measured gaps** |
| Rows | 79,927 → **79,939** |
| Pre-existing figures changed | **ZERO** |

### Coverage, reported rather than ground down

```
basis              actual 53,404 · unknown 26,358 · adopted 165
reporting_entity   unknown 56,399 · incl_component_units 21,794 · primary_government 1,734
```

Ohio AOS gets **no** `reporting_entity` entry despite being *expected* `primary_government` — columbus.gov returned 403, so there is no document, so there is no entry. **Expected is not evidenced.**

---

## The figure invariant, and how it was re-based

`sha256(id | total_budget)` over every row except the twelve the backfill created is
**`3bc12db8bb7dd04c1602befd68d78020e39d333df75705f6f94d3c1a939d82a2`** — byte-identical to v2.24, and identical to the value SCOPE-01 recorded independently in project memory. Verified after every database step.

The invariant is an **exclusion**, not an inclusion list. `scripts/data/scope02CreatedIds.json` records the ids created; the harness computes over current rows minus those. Chosen after measuring that **`created_at` is NULL on 79,899 of 79,927 rows**, so the plan's timestamp fallback would have silently excluded 99.96% of rows and left the invariant nearly vacuous — and committing 79,927 UUIDs would be a ~3MB permanent artifact. **An unrecorded id makes the harness fail loudly**, which is the safe direction.

⚠ **A real precision bug surfaced here.** `fetchScopeRows` read `total_budget` as a bare numeric, and PostgREST's JSON round-trip loses digits past ~15–17 significant figures (`43283121.249999955`). The digest could not reproduce until the select became `total_budget::text`. Cross-checked against raw SQL.

---

## Three of the seven seams are not closed, and that is correct

`verify-scope-seams.mjs` still reports **Long Beach, Anaheim and Bakersfield**.

**There is nothing to backfill for them.** SCO's data ends at FY2024; their adopted rows begin at FY2025. All three carry 22 evidenced all-funds actual years, so the display rule draws FY2003–2024 continuously and renders FY2025 as a **gap** — which is exactly what the spec asks for: *a gap is honest where a cliff is a lie.*

The detector still flags them because `detectSeams` groups by `(municipality_id, dataset_type, period_label)` — **scope-blind**. Post-SCOPE-02 it compares rows belonging to two different series and calls the difference a seam. **The criterion predates the series model, not the code.** The Definition of Done's phrasing was defective; the real criterion is that the *displayed* series is continuous, which holds for all seven. An independent final review verified this reasoning rather than accepting it.

⇒ **Redefining what a seam means once series exist belongs to SCOPE-03.**

---

## What the review loop caught

Every task was implemented by one agent and reviewed by another. Three findings that would otherwise have shipped:

1. **A literal NUL byte** in `budgetSeries.ts` made git classify the file as **binary**, destroying its diff and blame — and the implementer's report described a space delimiter that was never there. Caught only by a reviewer hex-dumping the committed blob. **A recurrence of a trap SCOPE-01 documented** at `scopeVerify.mjs:62`.
2. **Two `unknown` guard clauses in `areComparable` that no test pinned.** Both could be deleted with the suite green, because every existing case had the unknown side differing textually so the equality check alone caught it. Now pinned per-axis and mutation-verified.
3. **The old 9-argument `treasury_sync_city_budget` overload survived `CREATE OR REPLACE`**, leaving two callable versions and reintroducing the ambiguity by another route. Dropped explicitly.

⚠ **The raw-NUL trap fired three separate times in this milestone** — twice caught by review, once self-caught. Three occurrences is a pattern, not bad luck. **It wants a lint.**

Every constraint added was mutation-tested: both CHECK constraints in the rejecting direction, the widened index in both directions, and the new summation lint proven able to fail before being trusted.

---

## Known follow-ups, recorded not fixed

| Item | Why it matters |
|---|---|
| **`verify-fund-scope.mjs` now cries wolf on every run** | It compares against SCOPE-01's whole-table digest, which the twelve legitimate rows move, and never got the exclusion mechanism. Deliberately not edited. **A harness nobody believes is worse than no harness** — retire or update it |
| **`detectSeams` is scope-blind** | Can register a spurious zero-gap "seam" for a dual-row city-year, polluting the ~37-seam backlog that future triage must sift. Fix the instrument before triaging with it |
| **`bulkLoadStateController.js` swallows `result.error`** | Checks `rows_inserted` but never `error`; the RPC's ambiguity guard returns `{error}` as a *successful* call, so a future hit undercounts silently. Did not fire here |
| RPC key omits `period_label` | Fails closed only on ≥2-way collisions. If exactly one row matches but differs in `period_label`, it would overwrite silently. No current loader can reach this — CA SCO has no TQ rows |
| `ScopeLabel.tsx:84` | Keys the basis chip off `TONE['general_fund']` rather than the in-scope `VERIFIED_TONE`; safe only while a test asserts the three fund-scope tones are identical |
| "seven taxonomies" in `fundScopeRegistry.mjs` | SCOPE-01's own shipped evidence string says seven where RECON §4.3 says five-up-plus-three-down, i.e. **eight**. Corrected in the new registry; the shipped one still carries it |

---

## Verification

| Gate | Result |
|---|---|
| `npm run build` | ✅ clean |
| `npm test` | ✅ **370 passed, 23 files** |
| Frozen figure invariant | ✅ `3bc12db8…82a2`, unchanged from v2.24 |
| Adopted rows after backfill | ✅ 249 pre-existing rows unchanged on all four axes |
| Backfill coverage | ✅ 12 rows, **0 measured gaps** |
| Final whole-branch review | ✅ **no blocking findings** |
| API | ✅ live; `basis` distribution matches the database exactly |

---

## What SCOPE-03 inherits

1. **The toggle** — GF ⇄ Total Governmental ⇄ All Funds, and making the enterprise slice visible. The foundation is now in place.
2. **Derived Total Governmental for era B** (FY2017+, ~8,500 rows) — useful as a *level in the toggle* rather than as a default series. Era A is structurally underivable; do not retry it.
3. **A seam definition that survives the series model**, plus the ~19 remaining seams. Split the queue first: large negative steps are real breaks; small or positive ones are sources awaiting an entry.
4. **The instrument fixes above**, before the backlog is triaged with them.

**Still the highest-value single task anywhere in this project, and in none of these milestones: one MA ACFR from a town that runs its own schools** unblocks 16,816 rows — 21% of the database — moving `general_fund` from 2.2% to ~23% and `unknown` from 33% to ~12%.

---

## Open items

- [ ] **Chris's UAT sign-off.** Not tagged until then.
- [ ] `v2.25` tag, **in the same step as this file and `.planning/`** — v2.21 never reached `.planning/`, v2.22 was never tagged, v2.23 read "awaiting UAT" for a day after its tag existed. Four milestones, four misses.
