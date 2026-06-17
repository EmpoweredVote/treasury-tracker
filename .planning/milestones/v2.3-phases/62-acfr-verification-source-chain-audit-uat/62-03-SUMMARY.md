---
phase: 62-acfr-verification-source-chain-audit-uat
plan: "62-03"
subsystem: verification
tags: [uat, live-app, checklist, e2e, ver-04, salaries, breadcrumb, cities-in-county, enrichment]

# Dependency graph
requires:
  - phase: 62-01
    provides: ACFR reconciliation evidence (VER-03 part A)
  - phase: 62-02
    provides: Source-chain audit evidence (VER-03 part B)
  - phase: 60-statewide-ca-salaries-sweep
    provides: Salaries data for Irvine + all non-OC CA cities
  - phase: 61-enrichment-parity
    provides: 528 universal enrichment rows — plain-language category names in live app
provides:
  - "VER-04 evidence: completed 24-item guided UAT checklist with per-item pass/fail"
  - "Chris's dated UAT sign-off (signoff-all-pass, 2026-06-17)"
  - "Salaries tab root-cause narrative (year-gating + Employees card label)"
  - "Documented UX follow-up flag (D-08): Employees card year-hiding candidate for v2.4"
  - "Closing evidence record for the v2.3 California Coverage Parity milestone"
affects: [v2.3-closeout, v2.4-planning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-06: human-driven UAT — agent authors checklist and records results; Chris drives the browser"
    - "D-08: defects discovered during verification are documented as follow-up flags, not fixed in-phase"

key-files:
  created:
    - .planning/phases/62-acfr-verification-source-chain-audit-uat/62-03-UAT-CHECKLIST.md
    - .planning/phases/62-acfr-verification-source-chain-audit-uat/62-03-SUMMARY.md
  modified: []

key-decisions:
  - "signoff-all-pass: all 24 checklist items PASS (Chris, 2026-06-17)"
  - "Checklist city corrected Inglewood → Irvine after round-1 (Inglewood has zero budget rows; Irvine is Phase-60 salaries city, Orange County, FY2009–2024)"
  - "Employees card is year-gated (App.tsx availableDatasetTypes filters by selected year); year=2003 hides it for FY2009-2024 salaries — correct behavior, not a defect"
  - "D-08 follow-up flagged: show Employees card whenever salaries exist for any year + prompt year switch (v2.4 UX candidate)"
  - "VER-04 PASS: SC#3 live-app E2E + SC#4 Chris sign-off both satisfied"
  - "Milestone verified: VER-03 (62-01 ACFR + 62-02 source-chain) + VER-04 (62-03 UAT) — v2.3 CA parity closed"

patterns-established:
  - "Checklist-plus-root-cause pattern: when UAT items initially appear to fail, investigate and document root cause before declaring defect; both round-2/3 Irvine issues were instrument defects, not product defects"

requirements-completed: [VER-04]

# Metrics
duration: 45min
completed: 2026-06-17
---

# Phase 62 Plan 03: UAT Checklist + Sign-off Summary

**24-item guided live-app UAT across 4 CA entities (Glendale / LA County / Oakland+SF / Irvine) — all items PASS; Chris signed off on VER-04 (signoff-all-pass, 2026-06-17), closing the v2.3 California Coverage Parity milestone**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-17T00:00:00Z
- **Completed:** 2026-06-17
- **Tasks:** 3 (Task 1 prior commit 174c4db; Task 2 human checkpoint resolved; Task 3 this SUMMARY)
- **Files modified:** 1 created (62-03-SUMMARY.md); checklist authored + corrected across prior commits

## Accomplishments

- Authored and corrected a 24-item guided UAT checklist covering all 6 VER-04 items (FY2003 depth, salaries dataset/tab, per-capita, enrichment, breadcrumbs, Cities-in-County) across the required 4-entity spread (D-07)
- Chris drove https://treasurytracker.empowered.vote live; all 24 checklist items confirmed PASS after three UAT rounds; round-2/3 apparent failures traced to instrument issues, not product defects
- VER-04 satisfied: SC#3 (live-app E2E) + SC#4 (Chris UAT sign-off) both PASS — the v2.3 CA parity milestone is verified end-to-end

## UAT Results: Completed 24-Item Checklist

Chris drove the live app at https://treasurytracker.empowered.vote on 2026-06-17 (D-06 — no browser automation).

### Section A — Glendale (LA County city, FY2003 depth + per-capita + enrichment)

| # | Entity | Expected | Result |
|---|--------|----------|--------|
| 1 | Glendale | Budget page loads with op/rev data visible for at least one year | PASS |
| 2 | Glendale | FY2003 appears as the oldest available year in the year selector / history chart | PASS |
| 3 | Glendale | FY2003 renders operating total (~$451.9M) without errors | PASS |
| 4 | Glendale | Per-capita shown for FY2003 (~$2,363/person); not blank or zero | PASS |
| 5 | Glendale | Per-capita renders for a recent year (e.g. FY2024); value increased vs FY2003 | PASS |
| 6 | Glendale | Op/rev category names show plain-language labels (e.g. "General Government", "Public Safety") — enrichment rendering, not raw SCO code strings | PASS |

### Section B — Los Angeles County government (FY2003–2024 + per-capita + breadcrumb + Cities-in-County)

| # | Entity | Expected | Result |
|---|--------|----------|--------|
| 7 | LA County | County government budget page loads with op/rev data visible | PASS |
| 8 | LA County | FY2003 available as earliest year; range spans FY2003–FY2024 | PASS |
| 9 | LA County | FY2003 renders operating total (~$13.7B) without errors | PASS |
| 10 | LA County | Per-capita shown for FY2003 (~$1,365/person); not blank or zero | PASS |
| 11 | LA County | Per-capita shown for FY2024 (~$3,752/person); substantially higher than FY2003 | PASS |
| 12 | LA County | Breadcrumb reads: **US → California → Los Angeles County** (three levels, no city hop) | PASS |
| 13 | LA County | Cities-in-County panel lists LA County cities (e.g. Burbank, Glendale, Pasadena, Santa Monica); panel not empty | PASS |

### Section C — Oakland + San Francisco (Phase-59 linked cities, breadcrumb + Cities-in-County)

| # | Entity | Expected | Result |
|---|--------|----------|--------|
| 14 | Oakland | Budget page loads | PASS |
| 15 | Oakland | Breadcrumb reads: **US → California → Alameda County → Oakland** (four levels, county hop present) | PASS |
| 16 | Oakland | Clicking Alameda County in the breadcrumb loads the Alameda County page | PASS |
| 17 | Alameda County | Cities-in-County panel lists Oakland, Berkeley, Fremont and other Alameda cities; panel not empty | PASS |
| 18 | San Francisco | Budget page loads | PASS |
| 19 | San Francisco | Breadcrumb reads: **US → California → San Francisco** (three levels, NO separate county hop — SF is a combined city-county node) | PASS |

### Section D — Irvine (Phase-60 salaries city: Employees tab + Department→Position tree + enrichment)

| # | Entity | Expected | Result |
|---|--------|----------|--------|
| 20 | Irvine | Budget page loads | PASS |
| 20a | Irvine | Year selector set to a year in FY2009–2024 range (e.g. FY2024); Employees card only present for years in the salaries range | PASS |
| 21 | Irvine | Dataset cards row shows three cards: **Money Out**, **Money In**, and **Employees** (salaries card label is "Employees" with Users icon + "Employee compensation" subtitle) | PASS |
| 22 | Irvine | Clicking Employees card loads the salary/employee compensation view with a Department list or tree | PASS |
| 23 | Irvine | Expanding a department shows a list of positions (job titles) and associated compensation figures | PASS |
| 24 | Irvine | Department names show plain-language labels (e.g. "Police Department", "Fire Department", "Public Works"); enrichment rendering for salary departments | PASS |

**Total: 24 of 24 items PASS**

## UAT Sign-off

**Decision:** `signoff-all-pass`
**Signed off by:** Chris Cantrell
**Date:** 2026-06-17
**App verified:** https://treasurytracker.empowered.vote

All 24 checklist items pass. VER-04 satisfied (SC#3 live-app E2E + SC#4 Chris UAT sign-off).

## UAT Round History and Root Causes

Three UAT rounds were required. Items 1–19 passed on the first walkthrough. Items 20–24 (Employees/salaries) initially appeared to fail across two additional rounds. Both causes were **verification-instrument issues, not product defects**.

### Round 1 — Checklist city pick defect (Inglewood → Irvine)

The original Section D city was **Inglewood**. Chris reported no Salaries (Employees) tab appeared. A read-only DB probe confirmed Inglewood has zero budget rows of any dataset — it is not in the Phase-60 salaries cohort. The `availableDatasets.includes('salaries')` gate was working correctly by not showing the Employees card for a city with no salaries. The checklist city pick was corrected to **Irvine** (Phase-60 GCC salaries city, Orange County, salaries FY2009–2024, confirmed via production API `ev-accounts-api.onrender.com/api/treasury/cities`).

### Round 2 — Two instrument issues (both confirmed non-defects)

With the city corrected to Irvine, the Employees card still did not appear on the initial screenshot. Investigation confirmed two instrument issues:

1. **Card label mismatch:** The salaries dataset card is labeled **"Employees"** (not "Salaries") in `src/components/datasets/DatasetTabs.tsx` (`SALARIES_CARD` constant, Users icon, subtitle "Employee compensation"). The checklist round-1 wording said "Salaries tab" — the correct label is "Employees".

2. **Year-gating:** `availableDatasetTypes` in `App.tsx` (~L172) filters `available_datasets` to the **selected year**. The round-2 screenshot showed `year=2003` (carried over from the Glendale FY2003 test in Section A). Irvine's salaries only exist FY2009–2024, so at `year=2003` only Money Out / Money In dataset cards render — this is correct behavior, not a defect. Selecting FY2024 caused the Employees card to appear.

After Chris set Irvine to FY2024 and identified the Employees card by its correct label, items 20–24 all passed.

## VER-04 Verdict

**SC#3 (live-app E2E verification):** PASS — all 6 VER-04 items exercised across the required 4-entity spread (D-07):
- FY2003 history depth (items 2–3, 8–9)
- Per-capita across backfilled years (items 4–5, 10–11)
- Enrichment plain-language rendering (items 6, 24)
- Breadcrumb chain US → California → County → city (items 12, 15, 19; SF no-county-hop case item 19)
- Cities-in-County panel (items 13, 17)
- Salaries dataset/tab (items 21–23)

**SC#4 (Chris UAT sign-off):** PASS — `signoff-all-pass` recorded 2026-06-17.

**VER-04 overall: PASS**

## Milestone Verification Summary

This is the third and final verification evidence record for the v2.3 California Coverage Parity milestone:

| Plan | Verification | Verdict |
|------|-------------|---------|
| 62-01 | VER-03 part A — ACFR reconciliation (LA County gov + 4 sample cities; FY2023 basis-matched) | 3/5 entities PASS; 2 FOLLOW-UP (Glendale + Burbank ACFR CDN-blocked; corroborated via Phase-60 $0-delta + SCO source loops) |
| 62-02 | VER-03 part B — Source-chain audit (full cohort: Phase 58/59/60/61 backfill rows) | PASS — zero fragile URLs, zero residue, 37 expected custom NULLs confirmed |
| 62-03 | VER-04 — Live-app E2E + Chris UAT sign-off | PASS — all 24 items pass; signoff-all-pass 2026-06-17 |

**The v2.3 California Coverage Parity milestone is verified end-to-end (VER-03 + VER-04).**

## Documented UX Follow-up Flag (D-08, v2.4 candidate)

**Flag:** Dataset cards (specifically the Employees/salaries card) appear and disappear as the user changes the year selector. This surprised two UAT walkthroughs — when a user navigates from a FY2003 test for another city to a salaries-only year range (FY2009–2024), the card is hidden until the year is manually changed.

**Candidate fix (not implemented here — read-only phase per D-08):** Show the Employees card whenever salaries data exists for *any* year for the current city, and prompt the user to switch to a year within the salaries range, rather than silently hiding the card for out-of-range years.

**Disposition:** Tracked as a v2.4 UX improvement candidate. Not a failing UAT item. Not fixed in this phase.

## Task Commits

1. **Task 1: Build guided UAT checklist** - `174c4db` (docs)
2. **Task 1 correction: Inglewood → Irvine** - `0c3f390` (docs)
3. **Task 1 correction: Employees card label** - `7f6578e` (docs)
4. **Task 1 correction: year-gating root cause** - `e9ec6da` (docs)
5. **Task 3: SUMMARY (VER-04 evidence record)** - *(this commit)*

## Files Created/Modified

- `.planning/phases/62-acfr-verification-source-chain-audit-uat/62-03-UAT-CHECKLIST.md` — 24-item guided checklist authored + corrected across 3 rounds; final version includes round-2/3 root-cause notes inline
- `.planning/phases/62-acfr-verification-source-chain-audit-uat/62-03-SUMMARY.md` — VER-04 evidence record (this file)

## Decisions Made

- `signoff-all-pass` — Chris recorded UAT sign-off on 2026-06-17; all 24 items PASS
- Checklist instrument corrected Inglewood → Irvine (Inglewood has no budget rows; not a product defect)
- Year-gating of Employees card confirmed as correct behavior, not a defect (App.tsx availableDatasetTypes filters by selected year)
- D-08 follow-up flag recorded for Employees card year-hiding UX (v2.4 candidate; not fixed this phase)

## Deviations from Plan

None - plan executed exactly as written. No product source files were changed (read-only verification phase, D-08). The three UAT rounds were required because of checklist instrument issues, not product defects — each round produced a corrected checklist commit, which is normal for a human-in-the-loop guided UAT.

## Issues Encountered

- Round 1: Inglewood had zero budget rows — corrected city pick to Irvine (Irvine is the Phase-60 salaries cohort city for Orange County)
- Round 2: Two instrument issues (Employees card label + year selector carry-over from prior test) — both traced to root cause and documented; neither was a product defect

## Next Phase Readiness

- v2.3 California Coverage Parity milestone is fully verified and ready to close
- Three verification records complete: 62-01 (ACFR), 62-02 (source-chain), 62-03 (UAT + sign-off)
- Documented UX follow-up (Employees card year-hiding) is queued as a v2.4 candidate
- Deferred from Phase 61: 5,226 single-city salaries department long-tail name_keys — v2.4 source-naming canonicalization
- Ready to begin next milestone planning with `/gsd-new-milestone`

---
*Phase: 62-acfr-verification-source-chain-audit-uat*
*Completed: 2026-06-17*
