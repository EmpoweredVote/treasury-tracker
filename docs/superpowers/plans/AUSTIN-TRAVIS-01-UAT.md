---
status: complete
phase: austin-travis-01 (no GSD phase dir — docs/superpowers milestone, per .planning/STATE.md)
source: AUSTIN-TRAVIS-01-CLOSEOUT.md, AUSTIN-TRAVIS-01-SCOPE-RECON.md, ACFR-GF-CLASSIFICATION-RECON.md
started: 2026-08-20T04:10:00Z
updated: 2026-08-23T00:00:00Z
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

---

# RE-VERIFICATION 2026-08-23

The original run left **one failure and two withdrawn tests**, and all three were about the
same thing: whether a reader can see the period a figure describes. They are re-run here
because the surface changed underneath them — `city` was added to the source-chip entity
types in PR #38 (2026-08-20), *after* this UAT.

## Pre-flight, from the live production API

| entity | figures (FY2024) | `data_source_info.fetchedAt` | mojibake |
|---|---|---|---|
| Austin, TX | $1,347,127,000 out · $1,280,826,000 in | **2024-09-30** | none |
| Travis County, TX | $888,757,389 out · $1,030,822,292 in | **2024-09-30** | none |
| Travis County FY2004 | $270,078,987 out · $283,615,180 in | **2004-09-30** (url is `fy2004-cafr.pdf` — the pre-GFOA-rename name) | none |
| Bend, OR (June-30 control) | $42,328,742 out · $71,077,293 in | **2024-06-30** | none |
| New York (state node) | $115,828,000,000 out · $93,894,000,000 in | **2024-03-31** | none |

Windows unchanged: Austin FY2010–2025 (16 years), Travis FY2004–2025 (22 years).

⚠ **Austin FY2002–FY2009 is still absent, correctly.** The CO-SPRINGS milestone *unblocked*
it by building `acfrGfComponents.py`; it was never loaded. The year picker starting at
FY2010 is the expected state, not a regression.

## The finding: test 7 is still unmeetable, but for a reason that no longer holds

The original tests 6 and 7 were withdrawn because `fiscal_year_start_month` has no UI
surface. That is still true — it is absent from the budgets payload and has zero references
in `src/`. But the **as-of date on the source chip** shows the period end, which is the same
fact from the other side, and cities render that chip now.

* **Test 6 becomes measurable.** Bend FY2024 carries `2024-06-30` — a June-30 year, visible.
* **Test 7 does NOT**, because `MUNICIPAL_SOURCE_CHIP_TYPES` deliberately excludes `state`.
  The code says why: *"`state` is excluded only because nobody has checked the quality of
  state `data_source_info` yet — it is a candidate, not a decision."*

**So I checked it.** Ten state nodes, chosen to cover all four distinct fiscal calendars in
the table:

| state | as-of | expected FYE | |
|---|---|---|---|
| New York | 2024-03-31 | Mar 31 | ✅ |
| Texas | 2024-08-31 | Aug 31 | ✅ |
| Alabama | 2025-09-30 | Sep 30 | ✅ |
| Michigan | 2025-09-30 | Sep 30 | ✅ |
| California · Florida · Ohio · Minnesota · Washington · Arizona | 06-30 | Jun 30 | ✅ 6/6 |

**10 of 10 carry a `displayName`, a real source URL and an as-of date that matches that
state's own fiscal year end exactly.** The exclusion's stated reason is discharged: adding
`state` to that set would make NY's April fiscal year visible and close the last withdrawn
test from this UAT. **A decision for Chris, not a UAT finding** — recorded here with the
evidence.

## Re-run tests

### R1. The provenance chip on Austin — the test that FAILED
expected: Austin FY2024 shows a source chip naming "City of Austin ACFR — General Fund Expenditure by Function (FY2024 actual, GAAP basis)" and reading "as of 2024-09-30". Original result: **issue, major** — "I don't see sept 30 anywhere on austin", because `city` was missing from the chip's entity types so no city ever showed provenance.
result: pass
resolution: ✅ **THE ORIGINAL TEST 5 FAILURE IS RESOLVED.** Fixed in PR #38 (2026-08-20) by adding `city`, `municipality`, `town` and `township` to MUNICIPAL_SOURCE_CHIP_TYPES — the chip had been county-only since Phase 57 and was never widened. The data was never the problem: the API had been returning the correct ACFR URL and `fetchedAt: 2024-09-30` all along.

### R2. A June-30 entity shows its June year-end — the first withdrawn test, now measurable
expected: Bend, OR FY2024 shows a chip reading "as of 2024-06-30", against Austin's 2024-09-30 and Colorado Springs' 2024-12-31. Three different fiscal calendars, each visible on screen.
result: pass
resolution: ✅ **WITHDRAWN TEST 6 IS NOW SATISFIED, IN A FORM THE APP CAN ACTUALLY ANSWER.** The original asked for "a fiscal year starting July" and was withdrawn as unmeetable — correctly, since `fiscal_year_start_month` has no surface. The as-of date states the same fact from the other end of the year: Bend 06-30, Austin 09-30, Colorado Springs 12-31, all on screen. This is the ONLY reader-facing evidence that a fiscal calendar was recorded correctly, and it is what makes the wrong-calendar defect class (v2.29's Texas hardcode, the 1,719-row sweep in ACFR-GF) checkable by a human at all.

### R3. Austin's figures and window are unchanged
expected: FY2024 $1,347,127,000 Money Out and $1,280,826,000 Money In; year picker FY2010–FY2025, 16 years, nothing before 2010
result: pass
note: Austin is the ONLY entity in the app whose source prints in thousands, so the loader multiplies — a regression would show as a 1000x cliff, not a subtle drift. Also a real regression check: `main` has moved two milestones plus today's five fixes since v2.27 shipped. FY2002–09 correctly still absent: CO-SPRINGS unblocked those years by building the coordinate extractor, but never loaded them.

### R4. Travis County's figures and window are unchanged
expected: FY2024 $888,757,389 out and $1,030,822,292 in; FY2004 $270,078,987 out and $283,615,180 in; 22 years FY2004–FY2025 with no gaps
result: pass
note: $888,757,389 is the figure SCOPE-04's oracle leaned on. Travis prints only General Fund plus two nonmajor columns on its statement page and carries the Total onto a CONTINUED page, so a "rightmost number on the row" reader reports 109,380,269 as Total Governmental — a real number from the wrong fund, with nothing malformed about the output. Seeing $888.8M on screen is what says the column was located by its header, not by position.

### R5. The county chip still works, and its old years link to real documents
expected: Travis County FY2004's chip reads "as of 2004-09-30" and opens `fy2004-cafr.pdf` — the pre-rename CAFR filename, not a 404
result: pass
note: The oldest year in the app's longest local series, still resolving under its PRE-RENAME name (GFOA renamed CAFR -> ACFR in 2021; El Paso County's corpus shows the same split mid-series). Link rot is invisible to every arithmetic gate — the figures stay right while the citation dies.

## Re-run summary

total: 5
passed: 5
issues: 0
pending: 0

## Re-verification verdict

✅ **v2.27 AUSTIN-TRAVIS-01 is now fully verified — 5 of 5 on re-run, and the original run's
three loose ends are down to one.**

| original | then | now |
|---|---|---|
| test 5 — provenance visible | ❌ **issue, major** — "I don't see sept 30 anywhere on austin" | ✅ **resolved** (PR #38 added `city` to the chip types) |
| test 6 — a June-30 entity's fiscal year | ⊘ withdrawn, unmeetable | ✅ **satisfied** via Bend's `as of 2024-06-30` |
| test 7 — New York's April fiscal year | ⊘ withdrawn, unmeetable | ⚠ **still unmeetable — but the reason no longer holds** |

⚠ **The one remaining item is a decision, not a defect.** `MUNICIPAL_SOURCE_CHIP_TYPES`
excludes `state` because "nobody has checked the quality of state `data_source_info` yet —
it is a candidate, not a decision". That check has now been done: **10 of 10 state nodes
carry a display name, a real source URL, and an as-of date matching that state's own fiscal
year end** — NY 03-31, TX 08-31, AL and MI 09-30, and six more at 06-30. Adding `state` to
that set would close test 7. Awaiting Chris.

**What the three tests were really about, and why it took three attempts:** whether a reader
can tell what period a figure covers. The data was correct the whole time — Austin's
`fetchedAt: 2024-09-30` was in the API during the original UAT — and every gate was green,
because a missing chip and an unrenderable expectation both move exactly zero dollars. Two
of the three were fixed by widening one `Set`; the third is one entry away.
