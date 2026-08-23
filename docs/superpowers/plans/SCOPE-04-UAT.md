---
status: complete
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

[testing complete]

## Tests

### 1. The headline toggle — Modesto FY2024
expected: Two series pills; selecting "Total Governmental · actuals" moves Money Out $588,042,068 → $291,641,122 and Money In $643,894,826 → $322,089,879
result: pass
source: automated — driven in Chromium against production 2026-08-22. Money Out $588.0M → $291.6M, Money In $643.9M → $322.1M, aria-checked moved to the TG pill. Chris, separately: "I love clicking Total and All Funds."

### 2. The wording on screen
expected: The heading above the pills reads "Which set of figures" (NOT "Which published figures"); the Total Governmental pill carries the italic words "computed by Treasury Tracker"; the All Funds pill does not
result: pass

### 3. The disclosure renders, and only beside a derived figure
expected: With Total Governmental selected, two sentences sit below the pills — "Treasury Tracker computed this figure by adding up published components. The government published the parts, not this total." and the successor-agency sentence naming redevelopment successor agency funds. Switching back to All Funds removes both.
result: pass
reported: "Below total Government acutals: [intro] Treasury Tracker computed this figure by adding up published components. The government published the parts, not this total. This covers the governmental funds the city reports to the State Controller. Redevelopment successor agency funds are not included, so it can differ from the \"total governmental funds\" figure printed in the city's own audited report. // Below All funds actuals: [intro only]"
note: Exactly the intended split — SERIES_TOGGLE_COPY.introAnyDerived renders for both series (it describes the LIST), while DERIVED_COPY.explainer + scopeNote render only while the derived series is the one on screen.

### 4. The enterprise slice is visible in the chart
expected: Under All Funds the Modesto FY2024 icicle shows 11 top-level categories including Internal Service Fund $122.1M, Water Enterprise Fund $89.0M, Sewer $53.6M, Other Enterprise $15.5M, Solid Waste $14.5M and Airport $1.7M. Under Total Governmental only 5 remain and all six of those are gone, while "General Government and Public Safety" stays $164,848,113 in both.
result: pass
source: automated — read the icicle segments' aria-labels in both states. All Funds: General Government and Public Safety $164.8M (28%), Internal Service $122.1M, Water $89.0M, Transportation $84.2M… Total Governmental: 5 segments, same $164.8M now 57%, no enterprise or internal-service segment present.

### 5. The choice survives a deep link
expected: After selecting Total Governmental the address bar gains &scope=total_governmental&basis=actual. Opening that URL fresh (new tab) lands already on Total Governmental with $291,641,122, not on All Funds.
result: pass

### 6. Napa FY2017 — the one city-year reconciled to a printed ACFR
expected: ?entity=napa-ca&year=2017&dataset=operating — All Funds $170,963,742, Total Governmental $97,734,023. That derived figure is the one proven to the dollar against Napa's own audited statement (printed 97,734,046 − $23 successor agency).
result: pass
note: The only derived figure in the milestone with an independent printed-ACFR oracle behind it. Reader-visible confirmation that the derivation is right, not merely self-consistent.

### 7. A county, not just a city
expected: ?entity=napa-county-ca&year=2024&dataset=operating — the same two pills; Total Governmental moves Money Out $616,676,926 → $545,783,155
result: pass
note: ~11% enterprise slice against Modesto's 50%, which is the right shape — counties do not run city-style utilities. A county showing a Modesto-sized gap would have been the suspicious result.

### 8. A quarantined year, and what selecting the derived series does there
expected: ?entity=brisbane-ca&year=2017&dataset=operating — BOTH pills show (the list is entity-level), and the Total Governmental pill's span reads FY2018–24, correctly excluding the quarantined FY2017. All Funds shows $35.0M Money Out / $28.6M Money In for FY2017. Selecting Total Governmental moves the year control to FY 2018 and the figures to $23.2M / $21.6M — and it should TELL the reader it moved them.
result: issue
reported: "No, 2017 is available to choose in Total.  And it looks broke."
severity: major
correction: My first draft of this test expected no toggle at all on FY2017. That was wrong — `availableSeries` is entity-level, not year-level, so both pills always show. Corrected before putting it to Chris, and the corrected version is the stronger test: it exercises the year clamp, which is where the defect turned out to be (G5).

### 9. No regression outside California
expected: Seattle, WA looks exactly as it did before — same figures, same chart, and the words "computed by Treasury Tracker" appear nowhere on the page
result: pass
note: The regression control for the whole milestone. 7,650 rows were written and 488 entities gained a second series; nothing outside California moved.

### 10. Off-script: the salaries icicle under a derived-scope link
expected: (not a scripted test — Chris tested `?entity=modesto-ca&year=2024&dataset=salaries&scope=total_governmental&basis=actual` and reported)
result: issue
reported: "the icicle doesn't work.  C:\\tmp\\modesto.jpg none of the tabs do anything and the green looks odd in that setup.  I love clicking Total and All Funds."
severity: major
note: Three distinct defects, split into gaps G1–G4 below. Reproduced in Chromium against production, WITH and WITHOUT the `scope=`/`basis=` params, so each one is attributed.

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0
blocked: 0

## Verdict

**v2.30 SCOPE-04 is verified from a reader's seat.** Every claim the milestone makes on
screen holds: the toggle moves the figures to the dollar, the derived series names itself,
the successor-agency disclosure renders beside the derived figure and only there, the
enterprise slice is visible as categories appearing and disappearing, a county behaves
differently from a city in the right direction, the one ACFR-reconciled city-year reads
$97,734,023, and nothing outside California moved.

**8 of 10 passed. The two issues were both found off-script, and NEITHER was SCOPE-04's
own work** — they were pre-existing paths that SCOPE-04 made reachable by giving 488 CA
entities a second series.  five fixed
test-first (G1, G2, G3, G5, G6 — PR #54); one left open (G4, the tab strip hidden while
drilled, deliberate today). Every one of them predates this milestone.

⚠ Worth naming plainly: **no arithmetic gate could have found any of the six.** Every
figure involved was correct. What was wrong was which figure was on screen, whether the
reader was told, and whether the thing they clicked did anything.

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
  outcome: fixed
  fix: |
    The level builder moved out of the component into a pure `data/icicleLevels.ts`
    — it decides which row a reader can interact with, it was wrong for every leaf
    click in the product, and a component cannot be tested in this repo at all. The
    rule is now derived from what was actually pushed ("the deepest level RENDERED is
    the current one") instead of from the path ("is this the last path item"), which
    is only the same thing while the last item has children.

    Proven, not assumed: the module was first written with the ORIGINAL rule, and
    exactly one of the 6 new tests failed — the leaf case. Restoring the fix greens
    it. 568/568 tests pass, tsc clean.

    Verified in the browser against a local build wired to production, clicking
    "Maintenance Worker II (26)" on the Modesto salaries chart:

    | | before | after |
    |---|---|---|
    | levels | ancestor + ancestor | ancestor + **current** |
    | segments at full opacity on the deepest row | 0 of 36 | **36 of 36** |
    | clickable current segments | 0 | **36** |
    | "No further breakdown available" panel | shown | shown (unchanged) |

    A normal 3-level budget tree is untouched: Modesto operating still renders
    current-11 at the top, and ancestor-11 + current-2 once drilled.

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
  outcome: fixed
  fix: |
    Chris's call 2026-08-23: **keep the branch colour, vary the lightness.**
    `shadeWithinBranch` in `utils/chartColors.ts` mixes the base token toward white
    or black in a 5-step cycle — never toward another hue, so a segment still says
    which branch it belongs to. 7 tests, written first, pinning both sides of the
    requirement: adjacent children must differ, AND every step must keep the base as
    at least 80% of the mix.

    ⚠ NOT one step per child. A 36-child level would run the far end out of contrast
    entirely; the cycle repeats instead. Step 0 is the base itself, so the first
    child of every level — and every single-child level — renders exactly as before.

    ⚠ Contrast is still computed from the BASE, not the shaded fill. `getContrastText`
    returns white for any non-hex input, which is what every `var(--color-data-*)`
    fill already got and what a `color-mix()` gets too, so the text colour on screen
    is unchanged by construction rather than by luck.

    Verified in the browser in BOTH themes on the 36-child Parks level: 5 distinct
    fills where there was 1, root level still 10 distinct hues, and the oklab a/b
    components hold steady while L moves 0.54–0.69 (light) and 0.62–0.76 (dark) —
    lightness varying, hue not.

    The other half of G3 is NOT fixed: only 2 of 36 segments are wide enough to carry
    a label, which is the `canFitText` width heuristic and a separate question.

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

- truth: "Selecting a series that does not cover the year on screen tells the reader they were moved"
  status: failed
  reason: "Reproduced in Chromium against production. Brisbane FY2017 → click Total Governmental: the year control moves FY 2017 → FY 2018, the URL moves to year=2018, and Money Out moves $35.0M → $23.2M. The sentence 'Total Governmental · actuals does not cover FY2017, so we have moved you to FY2018, the closest year it does cover.' NEVER RENDERS — searched the rendered body for both 'have moved you to' and 'does not cover FY': absent."
  severity: minor
  test: 8
  gap_id: G5
  attribution: "PRE-EXISTING (SCOPE-03). SCOPE-04 widens the exposure to every CA entity, because every derived series spans FY2017–24 against an all_funds series spanning FY2003–24 — so any reader on a pre-2017 year who picks Total Governmental gets silently relocated."
  root_cause: "The clamp effect in src/App.tsx sets the note and then calls setSelectedYear(token) in the same pass. `selectedYear` is in the effect's own dependency list, so the effect immediately re-runs against the NEW year, `resolveSeriesYear` now reports moved: false, and the first branch runs setYearClampNote(null) — wiping the note the previous pass had just set. The note can never survive the move that produces it."
  artifacts:
    - path: "src/App.tsx"
      issue: "clamp effect clears yearClampNote on the re-run its own setSelectedYear triggers"
  missing:
    - "Only clear the note when the year changed for a reason other than the clamp — e.g. remember the token the clamp moved to and keep the note while selectedYear still equals it"
  note: "Not a wrong figure: the year control and the URL both update, so what is on screen is labelled correctly. What is missing is the explanation, which the code comment above the effect says is the point of the note ('so the reader is told rather than silently relocated')."
  outcome: fixed
  fix: |
    The note and the year it moved the reader to are now ONE piece of state,
    decided by a pure `resolveClampNote` in `seriesSelection.ts`: the note survives
    exactly the re-render its own move caused (identified by `selectedYear` having
    become the token we moved to) and nothing else. 4 tests, written first — the
    "KEEPS the note on the re-run its own move triggers" case is the defect.

    Verified in the browser against a local build wired to production: picking
    FY2017 on Brisbane under Total Governmental now renders "Total Governmental ·
    actuals does not cover FY2017, so we have moved you to FY2018, the closest year
    it does cover." Then choosing FY2021 by hand clears it.

- truth: "Choosing a year the selected series does not cover leaves the page in a coherent state"
  status: failed
  reason: "User reported: 'No, 2017 is available to choose in Total. And it looks broke.' Reproduced exactly. With Total Governmental selected on Brisbane, the year picker OFFERS FY2017 (and 2016, 2014...2009 — years the derived series does not cover). Choosing FY2017 lands on a self-contradictory screen: the year control and the URL both read FY 2018, a year the derived series DOES cover ($23.2M), while BOTH tiles read 'Money In is not published in Total Governmental · actuals...' and the chart renders 0 segments. The only figure left on the page is $11.7M, the salaries total."
  severity: major
  test: 8
  gap_id: G6
  attribution: "PRE-EXISTING code paths (SCOPE-03), but v2.30 is what makes them REACHABLE. Before SCOPE-04 all but a handful of CA entities carried exactly ONE series, so no series had missing years and the clamp never fired. Every one of the 488 CA entities now carries a second series starting at FY2017 against an all_funds series reaching back to FY2003, so any reader who picks a pre-2017 year while Total Governmental is selected reproduces this."
  root_cause: "TWO defects compounding, in the loader effect at src/App.tsx:520-583. (1) The effect has NO stale-response guard — no cancellation flag, no cleanup. (2) Picking FY2017 starts load A for 2017, which correctly resolves to SeriesAbsentError -> null and stamps absentDatasets {operating:true, revenue:true}; the clamp effect then moves selectedYear to 2018, starting load B, which resolves from the module cache almost immediately (FY2018 was already loaded on arrival). A, on the network, lands AFTER B and overwrites B's good state with its own absent flags. Deterministic in this direction, because the cached response always wins the race. Nothing re-runs afterwards to correct it."
  artifacts:
    - path: "src/App.tsx"
      issue: "the dual-dataset load effect (520-583) applies its result unconditionally — a superseded request can overwrite a newer one"
    - path: "src/App.tsx"
      issue: "the year picker offers years the selected series does not cover (seriesPeriodTokens keeps them so the Employees tab stays reachable)"
  missing:
    - "A cancellation guard in the loader effect: `let cancelled = false; ... if (cancelled) return; return () => { cancelled = true; }` so a superseded year's response can never stamp state"
    - "Decide whether uncovered years should be visibly marked in the picker rather than silently clamped (design call — they must stay reachable for the Employees tab)"
  note: "G5 and G6 are the same user action seen twice: G5 is the missing explanation, G6 is the wrong state. Fixing G6 without G5 leaves a reader silently relocated; fixing G5 without G6 explains a screen that is still broken."
  outcome: fixed
  fix: |
    New pure module `src/data/latestRequest.ts` — `createRequestSequence()` hands
    out a claim whose predicate is true only while it is the most recent one. One
    sequence per loader effect (tiles, chart); every `.then` and `.catch` drops
    itself when superseded. 4 tests, written first, one of which reproduces the
    Brisbane ordering exactly: FY2017 claimed first, resolving last, must not be
    applied.

    Verified in the browser against a local build wired to production. Picking
    FY2017 on Brisbane under Total Governmental now lands on FY 2018 with real
    figures — $23.2M Money Out / $21.6M Money In, chart drawing 4 segments led by
    "General Government and Public Safety $12.6M (54%)" — and NO blank tile.
    Regression sweep unchanged: Modesto 11 segments $588.0M, Napa County 11
    segments $616.7M, Seattle 2 segments $2.4B.

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
