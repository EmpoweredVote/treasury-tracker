---
status: complete
phase: austin-travis-01 (no GSD phase dir — docs/superpowers milestone, per .planning/STATE.md)
source: AUSTIN-TRAVIS-01-CLOSEOUT.md, AUSTIN-TRAVIS-01-SCOPE-RECON.md, ACFR-GF-CLASSIFICATION-RECON.md
started: 2026-08-20T04:10:00Z
updated: 2026-08-20T04:55:00Z
---

## Current Test

[testing complete]

<!-- superseded -->
number: 5
name: Provenance is visible and correct
expected: |
  A source chip / attribution on an Austin or Travis year names that entity own
  ACFR and shows an "as of" date of September 30 of that fiscal year.
awaiting: user response

## Tests

### 1. Austin, TX appears and its chart renders
expected: Austin, TX is findable and distinct from Austin, MN; General Fund chart draws FY2010–FY2025 (16 years), no gaps or blank years
result: pass

### 2. Travis County, TX appears with its full window
expected: Travis County, TX is findable as a county; chart draws FY2004–FY2025 (22 years), no gaps
result: pass

### 3. Austin FY2024 figures match the printed ACFR
expected: Austin FY2024 reads $1,280,826,000 Money In and $1,347,127,000 Money Out — the exact printed General Fund column of its FY2024 ACFR (statement p50, "In thousands")
result: pass

### 4. No 1000x scale error anywhere in the two new entities
expected: Austin's GF sits in the $0.5–1.5 BILLION range across the window and Travis's in the $0.27–1.06 billion range; nothing reads in the trillions or the hundreds
result: pass

### 5. Provenance is visible and correct
expected: The source chip / attribution for an Austin or Travis year names the entity's own ACFR and an "as of" date of September 30 of that fiscal year
result: issue
reported: "I don't see sept 30 anywhere on austin"
severity: major

### 6. Fiscal-year labelling for a June-30 entity
expected: A June-30 entity (e.g. Bend, Tucson, or a state node) labels its periods as a fiscal year starting July — not as a Jan–Dec calendar year
result: skipped
reported: "I don't see anything saying starting in July on live."
reason: "UNMEETABLE TEST — my framing error, not a product defect. fiscal_year_start_month has ZERO references in src/ and the API does not return it in the budgets payload (row keys verified live). There is no user-facing surface for it, so the expectation could never have been satisfied."

### 7. New York's period labelling
expected: The New York state node labels its periods as an April-start fiscal year (its FY ends March 31), not July and not January
result: skipped
reason: "Same unmeetable expectation as test 6 — no UI surface for fiscal_year_start_month. Not put to the user, to avoid sending them after something that cannot render."

### 8. No regression on an entity that already worked
expected: An entity untouched by this work (Seattle, Bend, or any state) shows the same figures and the same chart it did before
result: pass
reported: "looks the same as always"

## Summary

total: 8
passed: 5
issues: 2
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "A single-series entity shows a label, not a control — 'nothing invites a click'"
  status: failed
  reason: "User asked: 'What does the actuals button do? Should it be there if we don't have actuals?' — read the single-series pill as an interactive button."
  severity: minor
  test: 4 (raised during, not a failure of, test 4)
  raised_twice: true
  reported_verbatim: "Why are we showing the actuals as a button when you get nothing for clicking on it? Why does actuals even need to be there in a pill if I can not click on it?"
  root_cause: "FundSeriesToggle renders the single-series case as a non-interactive <span> but styles it 'rounded-full border px-3 py-1' — visually near-identical to the real radio buttons in the multi-series branch, so it reads as clickable and does nothing. Pre-existing SCOPE-03 UI; this milestone only changed the pill's TEXT (unknown/unknown -> 'General Fund · actuals') by classifying the rows."
  artifacts:
    - path: "src/components/FundSeriesToggle.tsx"
      issue: "single-series branch shares button-like styling; stated intent 'nothing invites a click' not carried by the visual"
  missing:
    - "Render the single-series case as PLAIN TEXT, not a pill: keep the words (they state what the figures cover) and drop the button costume"
    - "Suppress the question-style heading Which published figures when there is nothing to choose — the body copy already says One published set of figures, so heading and body contradict each other"
  debug_session: ""
  note: "NOT a data defect. All 76 Austin/Travis rows are genuinely basis=actual, evidenced in ACFR-GF-CLASSIFICATION-RECON.md §2 and confirmed to the dollar by test 3."

- truth: "Provenance for an Austin year shows the source ACFR and an 'as of' date of Sept 30"
  status: failed
  reason: "User reported: 'I don't see sept 30 anywhere on austin'"
  severity: major
  test: 5
  root_cause: "App.tsx renders SourceChip for entity_type 'federal' and 'county' ONLY. Austin is entity_type 'city', so no chip renders and the as-of date has nowhere to appear. NOT a data defect: the API returns data_source_info.fetchedAt = '2024-09-30T00:00:00.000Z' plus the correct austin.widen.net URL for both Austin FY2024 rows. SourceChip's own docstring concedes the gap — 'municipal data adopts it in the sourcing-backfill milestone' — which has not run. Pre-existing; this milestone is simply the first CITY load where every row carries a verified per-row source_url and period-end source_date."
  artifacts:
    - path: "src/App.tsx"
      issue: "SourceChip render is gated on entity_type federal|county; no branch for 'city'"
    - path: "src/components/federal/SourceChip.tsx"
      issue: "lives under components/federal/ and is documented as not yet adopted for municipal data"
  missing:
    - "Render SourceChip for city entities (the county branch is a working template and the API already populates data_source_info for municipal budgets)"
  narrowed_by: "Test 5b — the SAME chip renders correctly on Travis County (entity_type county), showing an as-of date of 2024-09-30. Confirmed by user. Data, API and component are all sound; the defect is EXACTLY the missing city branch."
  debug_session: ""

- truth: "The fiscal_year_start_month correction (1,719 rows) has an observable effect"
  status: not_verifiable
  reason: "No consumer exists. Zero references in src/; absent from the API budgets payload. The correction is real — the column previously asserted Jan-Dec for June-30 entities — but it is currently LATENT and cannot be validated through the app."
  severity: minor
  test: 6, 7
  root_cause: "fiscal_year_start_month is internal-only metadata today. It was corrected on the merits (a wrong value is worse than an unused one) but nothing reads it, so no UAT can confirm it and no app-level test guards it against regression."
  artifacts:
    - path: "src/"
      issue: "no consumer of fiscal_year_start_month"
  missing:
    - "Either surface the fiscal period in the UI (period labels / axis / source line) so the column earns its keep, or record it as deliberately internal so a future reader does not assume it is displayed"
  debug_session: ""
  note: "The DATA is verified by scripts/fixAcfrFiscalYearStartMonth.mjs --verify (1,891 checked / 0 wrong) — verification exists, just not through the product."

- truth: "Los Angeles presents a working experience"
  status: failed
  reason: "User reported, unprompted, during test 8: 'I want to highly prioritize the Los Angeles experience, which still feels broken.'"
  severity: major
  test: 8 (raised alongside, not a failure of, test 8)
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
  note: "OUT OF SCOPE for AUSTIN-TRAVIS-01 — nothing in this milestone touched Los Angeles. Carried here because the user asked for it to be prioritised. Investigation started immediately after UAT close."
