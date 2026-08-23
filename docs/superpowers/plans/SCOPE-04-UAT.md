---
status: testing
phase: scope-04 (v2.30 — no GSD phase dir; docs/superpowers milestone, per .planning/STATE.md)
source: SCOPE-04-CLOSEOUT.md, SCOPE-04-RECON.md
started: 2026-08-22T00:00:00Z
updated: 2026-08-22T00:00:00Z
---

## Pre-flight — deployment confirmed live before testing began

Both halves of v2.30 are actually on production. Checked, not assumed:

| surface | check | result |
|---|---|---|
| API (`C:\EV-Accounts`, Task 4) | `GET /api/treasury/cities` → Modesto `available_datasets` | ✅ carries `derivation: "derived"` on the two `total_governmental` entries |
| API figures | `GET /api/treasury/cities/{modesto}/budgets?fiscal_year=2024` | ✅ `all_funds` 588,042,068 · `total_governmental` 291,641,122 (`derivation: derived`) |
| Frontend | `assets/index-Ban80fHA.js` on treasurytracker.empowered.vote | ✅ contains `computed by Treasury Tracker`, `Which set of figures`, the explainer, and the successor-agency sentence |

⚠ Local note only: commit `e99ec732` in `C:\EV-Accounts` sits on **no local branch**
(`git branch --contains` returns nothing) — but the deployed API answers with `derivation`,
so the change did land upstream. The local clone is on `feat/nc-wave2-durham`.

Every expected figure below was read from the **live production API** before being written
here, so a mismatch on screen is a UI defect, not a stale expectation.

## Current Test

number: 2
name: The wording on screen
expected: |
  On the Modesto FY2024 Money Out page, the heading above the pills reads
  "Which set of figures" — NOT "Which published figures" — and the italic words
  "computed by Treasury Tracker" sit inside the Total Governmental pill only.
awaiting: user response

## Tests

### 1. The headline toggle — Modesto FY2024
expected: Two series pills; selecting "Total Governmental · actuals" moves Money Out $588,042,068 → $291,641,122 and Money In $643,894,826 → $322,089,879
result: pass
source: automated — driven in Chromium against production 2026-08-22. Money Out $588.0M → $291.6M, Money In $643.9M → $322.1M, aria-checked moved to the TG pill. Chris, separately: "I love clicking Total and All Funds."

### 2. The wording on screen
expected: The heading above the pills reads "Which set of figures" (NOT "Which published figures"); the Total Governmental pill carries the italic words "computed by Treasury Tracker"; the All Funds pill does not
result: [pending]

### 3. The disclosure renders, and only beside a derived figure
expected: With Total Governmental selected, two sentences sit below the pills — "Treasury Tracker computed this figure by adding up published components. The government published the parts, not this total." and the successor-agency sentence naming redevelopment successor agency funds. Switching back to All Funds removes both.
result: [pending]

### 4. The enterprise slice is visible in the chart
expected: Under All Funds the Modesto FY2024 icicle shows 11 top-level categories including Internal Service Fund $122.1M, Water Enterprise Fund $89.0M, Sewer $53.6M, Other Enterprise $15.5M, Solid Waste $14.5M and Airport $1.7M. Under Total Governmental only 5 remain and all six of those are gone, while "General Government and Public Safety" stays $164,848,113 in both.
result: pass
source: automated — read the icicle segments' aria-labels in both states. All Funds: General Government and Public Safety $164.8M (28%), Internal Service $122.1M, Water $89.0M, Transportation $84.2M… Total Governmental: 5 segments, same $164.8M now 57%, no enterprise or internal-service segment present.

### 5. The choice survives a deep link
expected: After selecting Total Governmental the address bar gains &scope=total_governmental&basis=actual. Opening that URL fresh (new tab) lands already on Total Governmental with $291,641,122, not on All Funds.
result: [pending]

### 6. Napa FY2017 — the one city-year reconciled to a printed ACFR
expected: ?entity=napa-ca&year=2017&dataset=operating — All Funds $170,963,742, Total Governmental $97,734,023. That derived figure is the one proven to the dollar against Napa's own audited statement (printed 97,734,046 − $23 successor agency).
result: [pending]

### 7. A county, not just a city
expected: ?entity=napa-county-ca&year=2024&dataset=operating — the same two pills; Total Governmental moves Money Out $616,676,926 → $545,783,155
result: [pending]

### 8. A quarantined year offers no derived figure
expected: ?entity=brisbane-ca&year=2017&dataset=operating — no toggle to choose from: a single plain-text caption "All Funds · actuals · FY2003–24" with NO "computed by Treasury Tracker" marker, figures render normally ($35,043,823 Money Out), nothing blank or $0. Brisbane FY2018 does offer the Total Governmental pill.
result: [pending]

### 9. No regression outside California
expected: Seattle, WA looks exactly as it did before — same figures, same chart, and the words "computed by Treasury Tracker" appear nowhere on the page
result: [pending]

### 10. Off-script: the salaries icicle under a derived-scope link
expected: (not a scripted test — Chris tested `?entity=modesto-ca&year=2024&dataset=salaries&scope=total_governmental&basis=actual` and reported)
result: issue
reported: "the icicle doesn't work.  C:\\tmp\\modesto.jpg none of the tabs do anything and the green looks odd in that setup.  I love clicking Total and All Funds."
severity: major
note: Three distinct defects, split into gaps G1–G4 below. Reproduced in Chromium against production, WITH and WITHOUT the `scope=`/`basis=` params, so each one is attributed.

## Summary

total: 10
passed: 2
issues: 1
pending: 7
skipped: 0
blocked: 0

## Gaps

- truth: "Arriving on the Employees tab and then clicking Money Out shows the Money Out figure"
  status: failed
  reason: "User reported: none of the tabs do anything. Reproduced: land on ?entity=modesto-ca&year=2024&dataset=salaries (no scope params), click Money Out — BOTH tiles read 'Money In is not published in .' / 'Money Out is not published in .', no chart renders at all, and neither series pill is selected. Recoverable only by clicking a pill."
  severity: major
  test: 10
  gap_id: G1
  attribution: "PRE-EXISTING (SCOPE-03), not v2.30. Requires only that the entity has a salaries row for the year and a budget series that is not unknown/unknown."
  root_cause: "src/App.tsx seeds defaultSeriesSeed with defaultSeries(available_datasets, activeDatasetRef.current). When the arriving dataset is `salaries`, defaultSeries → chooseDisplaySeries(datasets,'salaries') groups the SALARIES rows and returns their own key {fundScope:'unknown', basis:'unknown'} — non-null, so the listSeries fallback on seriesSelection.ts:145 is never reached. listSeries deliberately excludes salaries (SERIES_DATASETS = operating, revenue), so that seed matches NO listed series: selectedId matches no pill (nothing checked, effectiveSeriesLabel = ''), and loadBudgetData throws SeriesAbsentError for both budget datasets, which renders the absent tile. The seed is held per-entity and never recomputed on tab change (the Plano fix, App.tsx:278-294), so it poisons the whole visit."
  artifacts:
    - path: "src/App.tsx"
      issue: "defaultSeriesSeed seeded from a non-series dataset (`salaries`)"
    - path: "src/data/seriesSelection.ts"
      issue: "defaultSeries() treats any non-null chooseDisplaySeries result as usable, including a series listSeries will never list"
  missing:
    - "defaultSeries must only return a series that listSeries(datasets) actually lists — e.g. resolve through listSeries and fall back to its first entry when the active dataset is not a SERIES_DATASET"
  outcome: fixed
  fix: |
    `defaultSeries` now accepts `chooseDisplaySeries`' answer only when it is one of
    the LISTED series, and otherwise falls through to the widest listed one.
    Test-first: `seriesSelection.test.ts` gained a Modesto-shaped case that failed
    with `{unknown, unknown}` before the change and expects `{all_funds, actual}`.
    554/554 tests pass, `tsc --noEmit` clean.

    Verified in Chromium against a local build wired to the production API — arrive
    on `?dataset=salaries`, then click Money Out:

    | entity | pill on arrival | Money Out after the click |
    |---|---|---|
    | Modesto, CA | All Funds · actuals ✅ checked | $588.0M, 11 segments, top "General Government and Public Safety $164.8M" |
    | Napa County, CA | All Funds · actuals ✅ checked | $616.7M, 11 segments, top "Public Protection $188.7M" |
    | Seattle, WA (control) | no pills — single series, unchanged | $2.4B, unchanged |

    No dangling "published in ." copy and no blank tile in any of the three.
  tell: "The absent-tile copy renders as 'Money Out is not published in .' — a dangling 'in .' where the series label should be. That empty label is the visible signature of a seed that is not in the list."
  blast_radius: "480 California entities at FY2024 alone (measured over the live /treasury/cities payload: entities with a FY2024 salaries row AND an operating series that is not unknown/unknown). Zero outside CA — CA is the only state carrying salaries beside scoped budget rows. Seattle, Bend and Austin were checked as controls and behave correctly, because they have no FY2024 salaries row at all, so chooseDisplaySeries returns null and the fallback fires."

- truth: "Clicking a segment in the icicle either drills in or leaves the chart usable"
  status: failed
  reason: "User reported: the icicle doesn't work. Reproduced: on the salaries chart, clicking any job title (a leaf) turns EVERY level into an `ancestor` level — the whole chart dims to 40% opacity and there are zero segments at the current level, so nothing in the chart is clickable any more. The 'No further breakdown available' panel does render below it. Recovery requires the breadcrumb."
  severity: major
  test: 10
  gap_id: G2
  attribution: "PRE-EXISTING and identical with and without the scope params. Same defect class as the known flat-source limitation (Ohio AOS leaf click dims to empty); salaries is a 2-level tree, so its second level is all leaves."
  root_cause: "BudgetIcicle.tsx handleSegmentClick always calls onPathClick(segment.path), including for a segment with no children. The new path's last item contributes no level (`if (subcats.length === 0) return`), so `isCurrentLevel` is false for every rendered level and all of them get isAncestor + opacity 0.4."
  artifacts:
    - path: "src/components/BudgetIcicle.tsx"
      issue: "leaf click navigates into a path that produces no current level"
  missing:
    - "Either do not navigate on a childless segment (keep the level current and show the no-breakdown panel), or keep the deepest rendered level `current` when the selected node is a leaf"

- truth: "The colours in a drilled icicle level distinguish its segments"
  status: failed
  reason: "User reported: the green looks odd in that setup. Reproduced: the drilled level under Parks, Recreation & Neighborhoods renders 36 segments, and ALL 36 carry the single colour var(--color-data-sage-500) — the parent's colour. Only 2 of the 36 are wide enough to show a label, so the row reads as one undifferentiated green block."
  severity: cosmetic
  test: 10
  gap_id: G3
  attribution: "PRE-EXISTING, by design and identical without the scope params."
  root_cause: "BudgetIcicle.tsx builds child segments with `categoryIndex: rootCatIndex` — every descendant inherits the root's colour index deliberately, so a branch reads as one colour. On a 36-child level with 2 legible labels that intent stops working."
  artifacts:
    - path: "src/components/BudgetIcicle.tsx"
      issue: "categoryIndex: rootCatIndex gives every child of a drilled root one colour"
  missing:
    - "A design call from Chris: keep branch-colour identity but vary lightness per child, or colour children by their own index within the level"

- truth: "The dataset tabs and the series pills stay reachable while reading a category"
  status: failed
  reason: "Reproduced: one click into any category removes the series pills, the disclosure and the whole Money In / Money Out / Employees tab strip from the page. In the drilled state the only controls left are Bars / Sunburst. This is what 'none of the tabs do anything' looks like on the URL Chris actually opened, whose tabs ARE present on arrival."
  severity: minor
  test: 10
  gap_id: G4
  attribution: "PRE-EXISTING and by design — App.tsx:1262 gates the whole block on `navigationPath.length === 0`."
  root_cause: "The summary + series toggle + DatasetTabs block is rendered only at the top level of the drill-down."
  artifacts:
    - path: "src/App.tsx"
      issue: "navigationPath.length === 0 hides the tab strip and the series toggle once drilled in"
  missing:
    - "Decide whether the tab strip should persist while drilled (it is the only in-page way to switch dataset; today the breadcrumb is the only way back)"

### Checked and NOT a defect

With Total Governmental selected on the Employees tab, the derived explainer and the
successor-agency sentence do render — but the narrative directly above them reads
"In 2024, Modesto spent $292 million", which IS the derived figure. The disclosure has a
referent on screen, so it is not describing the wrong number.

## Deliberately NOT tested — no user-facing surface

* **`fiscal_year_start_month = 7` is wrong for Inglewood** (its ACFR year ends September 30).
  Real defect, recorded in SCOPE-04-RECON §3a — but `fiscal_year_start_month` has no UI
  surface at all, which is exactly why AUSTIN-TRAVIS-01 UAT tests 6 and 7 had to be
  withdrawn as unmeetable. Putting it to a user would send them after something that cannot
  render.
* **The 12 rootless `$0` rows** (Hollister FY2022, Humboldt County FY2020–21, Mendocino
  County FY2022, Novato FY2022, Woodland FY2023) — pre-existing, disclosed as follow-up 1
  in the closeout, not introduced by v2.30.
* **`reporting_entity` stays `unknown`** on derived rows — no surface.
