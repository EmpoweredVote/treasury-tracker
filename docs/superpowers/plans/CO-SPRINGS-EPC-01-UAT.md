---
status: complete
phase: co-springs-epc-01 (v2.29 — no GSD phase dir; docs/superpowers milestone, per .planning/STATE.md)
source: CO-SPRINGS-EPC-01-CLOSEOUT.md
started: 2026-08-23T00:00:00Z
updated: 2026-08-23T00:00:00Z
---

## Pre-flight — read from the live production API before writing any expectation

| check | result |
|---|---|
| Colorado Springs, CO | ✅ `city`, 28 rows, FY2012–2025 (14 years), all `general_fund/actual/published`, pop 493,554 (2024) |
| El Paso County, CO | ✅ `county`, 36 rows, FY2005 + FY2009–2025 (18 years), all `general_fund/actual/published`, pop 752,772 (2024) |
| the county link | ✅ Springs' `county_id` **is** El Paso County's id — an identity, not a predominance claim (both SUMLEV figures are 493,554) |
| CO entities in total | Colorado (state) · Colorado Springs (city) · El Paso County (county) — the state node plus this milestone's two locals |
| provenance payload | ✅ `data_source_info` carries `displayName`, `url`, `datasetUrl` and `fetchedAt: 2024-12-31T00:00:00.000Z` |
| the em-dash | ✅ `data_source` returns a clean **U+2014**, no `â€"`. The double-encoding the closeout recorded as global has since been fixed upstream — confirm on screen. |

⚠ **The `as of` date does NOT shift by timezone.** `SourceChip` renders
`fetchDate.slice(0, 10)` — a string slice on the ISO, never a `Date`, so `2024-12-31`
cannot display as Dec 30 in a west-of-UTC browser. The test below can therefore demand
the exact string.

⚠ **`fiscal_year_start_month` is NOT tested.** The budgets payload does not carry it and
`src/` has no reference to it — this is the unmeetable expectation that had to be withdrawn
twice in AUSTIN-TRAVIS-01 UAT (tests 6 and 7). The calendar fiscal year IS observable, but
only through the chip's `as of 2024-12-31`, which is what test 5 checks.

Every figure below was read from the live API first, so a mismatch on screen is a UI
defect, not a stale expectation.

## Current Test

[testing complete]

## Tests

### 1. Colorado Springs is reachable and its chart draws the full window
expected: Colorado Springs, CO, population 493,554; FY2024 Money Out $422,363,896 and Money In $371,035,085; year picker offers FY2012–FY2025 with no gaps
result: pass

### 2. El Paso County, and the years that are deliberately absent
expected: ?entity=el-paso-county-co&year=2024 — a county page, FY2024 Money Out $289,511,043 and Money In $308,220,434. The year picker offers FY2005 and FY2009–FY2025, and **FY2006, FY2007 and FY2008 are absent**, as are FY2000–FY2004. Those are the diagnosed exclusions — FY2000–04 are image-only scans, FY2006–08 print a different statement ("Statement of Revenues and Changes in Fund Balances", split across two pages) — not silent gaps.
result: pass
reported: "yes- it is the most accurate we have right now. It may pass as a bug, but I think that's ok compared to the alternatives."
ruling: ACCEPTED as-is. A missing year may read to a visitor as a defect, and Chris judged that preferable to the alternatives — inventing a figure, or carrying a year read from a statement we cannot parse. Recorded as follow-up 1 below rather than as a gap, because it is a product decision that was made, not a defect that was found.

### 3. The oldest and newest years both render
expected: Colorado Springs FY2025 reads $447,332,926 out / $378,728,392 in; FY2012 reads $215,637,285 out / $194,346,591 in. El Paso County FY2005 — its single pre-2009 year — reads $103,007,914 out / $115,403,360 in.
result: pass
note: FY2005 is the load-bearing one — El Paso County's only pre-2009 year, isolated in front of the FY2006–08 gap and fetched under a different filename convention from every year after it.

### 4. No 1000× scale error anywhere in either entity
expected: Colorado Springs' General Fund stays between ~$216M and ~$447M across FY2012–2025, and El Paso County's between ~$96M and ~$333M. Nothing reads in the billions or in the hundreds of thousands. Both entities are stored in whole dollars.
result: pass
note: Per-capita anchors hold too — Springs FY2025 ~$906/resident, El Paso County ~$442, both plausible for General Fund only. Neither entity has an "in thousands" statement, unlike Austin, so a unit error here would have shown as a 1000x cliff rather than a subtle one.

### 5. Provenance, including the one visible sign of a calendar fiscal year
expected: A source chip on Colorado Springs FY2024 naming the city's own ACFR and reading **"as of 2024-12-31"** — December 31, because Colorado runs the calendar year, where a Texas entity would read 09-30. Clicking it opens the real ACFR PDF, not a pdf.js viewer shell.
result: pass
note: The most load-bearing test in this set, for two reasons. (1) `2024-12-31` is the ONLY reader-facing evidence that Colorado's year-end is right — `fiscal_year_start_month` has no UI surface, and the shared loader's Texas hardcode (one of the six defects) would have stamped 09-30 while moving no dollar figure. (2) The link proves the viewer-shell resolution held: all 27 of the city's published ACFR "links" return HTTP 200 `text/html` from a `.pdf` URL, so the real asset had to be resolved out of the shell at fetch time.

### 6. The em-dash in the source label renders as a dash
expected: The chip reads "City of Colorado Springs ACFR — General Fund…" with a proper em-dash, NOT "ACFR â€" General Fund". The closeout recorded this double-encoding as pre-existing and global; the API now returns clean U+2014, so the screen should be clean too.
result: pass
resolution: ✅ **A defect the v2.29 closeout recorded as OPEN is now CLOSED.** It was logged as pre-existing and global — every em-dash label, including the 1,448 state-ACFR rows — with the fix belonging in `C:\EV-Accounts`. The live API now returns a clean U+2014 and the screen agrees. Verified on screen rather than inferred from the byte check, because reader-visibility was the whole point of the finding.

### 7. Colorado Springs nests under El Paso County
expected: The breadcrumb on Colorado Springs reads United States / Colorado / El Paso County / Colorado Springs, and El Paso County's own page lists Colorado Springs among its cities
result: pass
note: Cleaner than Austin's equivalent link — the city's whole-place (SUMLEV 162) and county-part (SUMLEV 157) populations are BOTH 493,554, so `county_id` is an identity here, not a predominance judgment about a city spanning several counties.

### 8. Colorado's state node still works beside its new locals
expected: The Colorado state entity still renders its own figures and is not disturbed by the two new local entities — before this milestone it was the only CO entity in the app
result: pass
note: Colorado was a SINGLE-ENTITY state until this milestone (just the state node from the ACFR arc), so adding a city and a county changed what the state page enumerates beneath it. That is the Gresham/CA-bug class in this project — a new local entity quietly changing what its parent renders.

### 9. No regression on an entity untouched by this milestone
expected: An entity from another state — Seattle, Bend, or Modesto — shows the same figures and the same chart as before
result: pass
note: Carries more weight than a same-day regression check would: `main` has moved a long way since v2.29 shipped, so this covers v2.29 PLUS everything after it, including the five UAT fixes merged today.

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Verdict

✅ **v2.29 CO-SPRINGS-EPC-01 passes UAT — 9 of 9, no defects found.**

Colorado's first local entities read correctly from a reader's seat: both windows draw
complete, the figures match the printed ACFRs to the dollar, no unit error anywhere, the
provenance chip names each entity's own audited report and links to the real PDF, the
city nests under its county, and neither the Colorado state node nor any out-of-state
entity was disturbed.

Two things this UAT settled that the closeout could not:

1. ✅ **The double-encoded em-dash is FIXED.** The closeout recorded it as pre-existing and
   global — every em-dash label including the 1,448 state-ACFR rows — with the fix owed by
   `C:\EV-Accounts`. Clean U+2014 on the wire and on screen. **A defect this milestone
   reported as open is now closed.**
2. ✅ **The calendar fiscal year is READER-VISIBLE after all**, through the source chip's
   `as of 2024-12-31`. That matters because the Texas-hardcoded fiscal calendar was one of
   the six defects v2.29 fixed, and it moves no dollar figure — AUSTIN-TRAVIS-01 UAT had to
   withdraw its fiscal-calendar tests as unmeetable, so this is the first time that class of
   defect has been checkable by a human at all. It is checkable only because the city chip
   started rendering in PR #38, after that UAT.

⚠ **Unlike v2.30, nothing broke here.** The distinction is instructive rather than
flattering: v2.29 added rows to entities that had none, while v2.30 added a second SERIES
to 488 entities that already had one — and every v2.30 UAT failure was a pre-existing path
that a second series made reachable. New data is safer than new structure.

## Gaps

[none — 9 of 9 passed]

## Follow-ups raised during UAT

1. **A missing year is silent about WHY it is missing** (test 2, accepted by Chris). El Paso
   County offers FY2005 then jumps to FY2009; a visitor cannot tell that FY2006–08 exist as
   documents we decline to parse rather than years the county never published. Every
   exclusion in this milestone is diagnosed in the closeout, so the *reason* exists in
   writing — it just has no surface. A per-year note ("published, but not machine-readable"
   vs "not published") would turn an apparent bug into a disclosure. **Not scoped, not a
   defect** — Chris's call was that the gap is acceptable next to the alternatives, which
   are inventing a figure or trusting a statement we cannot parse.

## Deliberately NOT tested — no user-facing surface

* **`fiscal_year_start_month = 1`** — not in the payload, no reference anywhere in `src/`.
  Observable only indirectly, via the chip's as-of date (test 5).
* **The six rows neither `-table` strategy can read** — a verification-side fact about
  cross-checking, invisible to a reader; the figures themselves come from the coordinate
  extractor and are covered by tests 1–4.
* **`reporting_entity = primary_government`** — no surface.
