---
phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
plan: "117-02"
subsystem: data-recon
tags: [acfr, pdftotext, state-gf, nasbo, iowa, kansas, maine, mississippi, montana, d-03-triage]

# Dependency graph
requires:
  - phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
    provides: the Batch-1 SOURCES.md shape this plan mirrors (per-state source table, bookend
      tie-confirms, four risk facts, scope-vs-NASBO, recency floor, gap log, loader-template mapping)
provides:
  - "117-BATCH2-SOURCES.md: per-state D-03 triage + ACFR source location + bookend ties + four
    risk facts + recency-floor verdict + scope-vs-NASBO + loader mapping + gap log for
    IA, KS, ME, MS, MT"
affects: [118-acfr-upgrade-batch-1, 119-acfr-upgrade-batch-2, 123-nasbo-retirement, 124-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-03 triage-first gate (new this phase): confirm a state publishes a GAAP Governmental
      Funds ACFR with a splittable General Fund column BEFORE deep URL-spelunking"
    - "Bookend tie-confirm (oldest+latest FY) via pdftotext -table, deferring in-between-year
      extraction to the load phase (Phase 98/103/107/112 mold)"

key-files:
  created:
    - .planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH2-SOURCES.md
  modified: []

key-decisions:
  - "All 5 Batch-2 states (IA/KS/ME/MS/MT) PASS the D-03 triage -- zero STAY-NASBO-exception
    candidates in this batch, nothing fed to the Phase-123 NASBO-served list from Batch 2"
  - "MS FY2024 requires a P2 clamp (Investment income -$434,060K, Rentals -$338K, both negative
    in the General Fund column) -- flagged for the Phase-119 loader, same lever as MD FY2022"
  - "MT confirmed to file an ANNUAL GAAP ACFR despite its biennial budget cycle -- every FY2015
    through FY2025 has its own individually-signed Statement of Rev/Exp/Changes in Fund Balances;
    no D-01/D-09 accept-relabel triggered by this risk"
  - "ME's plan-flagged non-June FY-end risk is empirically disproven -- both bookend PDFs confirm
    June 30 FY-end, same as the other four Batch-2 states"
  - "All 5 states recommended for accept-and-relabel at load time (D-09) -- scope-vs-NASBO ratios
    range from KS's modest ~1.11x to MS's TX-style ~3.42x (near-single-fund federal consolidation)"

requirements-completed: [RECON-11]

# Metrics
duration: 90min
completed: 2026-07-03
---

# Phase 117 Plan 02: Recon Batch-2 States (IA/KS/ME/MS/MT) Summary

**Located, bookend-tied ($0 diff), and risk-fact-pinned GAAP ACFR General Fund sources for all 5 Batch-2 states via `pdftotext -table`; discovered a fully derivable Maine URL pattern (deepest window in the batch, 26yr), a material P2-clamp case in Mississippi FY2024, and confirmed Montana's annual (not biennial) GAAP reporting cadence — zero STAY-NASBO exceptions.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 3 completed
- **Files modified:** 1 (`117-BATCH2-SOURCES.md`, created)

## Accomplishments

- Ran the D-03 triage-first gate for all 5 Batch-2 states before any deep URL-spelunking — all 5
  pass (GAAP ACFR with a distinct General Fund column confirmed for each).
- Located each state's ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in
  Fund Balances* → General Fund column, with durable per-year URLs and bookend (oldest + latest FY)
  ties confirmed at exact $0 diff for all 10 sampled fiscal years (5 states × 2 bookends).
- Pinned all four D-08 risk facts per state (units, negative-category years, exact GF column +
  statement, FY-end month) — found and flagged one material P2-clamp case (MS FY2024) and
  empirically disproved a plan-flagged risk (ME's non-June FY-end speculation).
- Confirmed the D-07 recency floor (FY2023 + FY2024) GREENLIGHT for all 5 states.
- Computed scope-vs-NASBO (D-09) magnitude for all 5 states and recommended accept-and-relabel for
  each, ranging from KS's modest ~1.11× to MS's TX-style ~3.42×.
- Mapped each state to the `extract_gf.py` + `gen_state.py` loader template and logged every gap
  (naming exceptions, unverified pre-window years) with a reason.

## Task Commits

Each task was committed atomically:

1. **Task 0: Workspace + doc skeleton + D-03 triage for all five Batch-2 states** - `af12f74` (docs)
2. **Task 1: Recon IA + KS + ME — locate, bookend-tie, pin risk facts** - `79ea894` (docs)
3. **Task 2: Recon MS + MT — locate, bookend-tie, pin risk facts** - `988c01a` (docs)

_Note: documentation-only recon plan — no test/feat/refactor commits, all `docs()`._

## Files Created/Modified

- `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH2-SOURCES.md` - the complete per-state source doc: D-03 triage, per-state source table, bookend tie-confirmations, four risk facts, scope-vs-NASBO, recency-floor verdicts, consolidated gap log, loader-template mapping, per-state detail blocks (IA/KS/ME/MS/MT), and a Phase-119 pre-load checklist.
- `_acfr-work/{ia,ks,me,ms,mt}/*.pdf` (gitignored, not committed) - downloaded bookend ACFR PDFs used for `pdftotext -table` extraction and tie verification (10 PDFs total: 2 per state).

## Decisions Made

- **D-03 triage verdict: all 5 RECON, zero STAY-NASBO** — each state publishes a GAAP ACFR with a
  clean GF-splittable Governmental Funds statement; none needed the D-01 fill-policy fallback.
- **MS P2 clamp flagged, not applied** — recon documents the FY2024 negative lines (-$434,060K
  Investment income, -$338K Rentals); the actual clamp implementation is a Phase-119 load-time
  action per this plan's documentation-only scope.
- **MT annual-cadence confirmed** — resolved the plan's pre-flagged biennial-budget risk by
  directly inspecting the FY2016 and FY2025 bookend statements; both are unambiguously annual GAAP
  reports, no accept-relabel needed for this reason.
- **ME non-June-FY-end risk resolved as a non-issue** — direct inspection of both bookends shows
  June 30 FY-end; documented honestly rather than silently dropping the pre-flagged concern.
- **All 5 states accept-and-relabel recommended (D-09)** — consistent with the TX/NJ/NC precedent
  established in Phase 98/107; the actual accept/relabel call is confirmed at Phase-119 load time
  per D-10 (recon documents + recommends, load phase executes).

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were met without
requiring Rule 1-4 auto-fixes: no bugs found, no missing critical functionality beyond what the
plan already specified (P2 clamp identification is explicitly called out in the plan's must_haves),
no blocking issues (network access, `pdftotext`, and all 5 states' official government sites were
all reachable), and no architectural changes were needed.

## Issues Encountered

- Kansas's and Mississippi's and Montana's official ACFR pages did not expose per-year PDF links
  directly in their top-level navigation (KS required following an "ACFR Reports" category page;
  MS required the `/publications` accordion page; MT required a search-engine-assisted discovery
  of the `doa.mt.gov/SFSD/ACFR-PAFR` archive page). Resolved by iterative page-following and one
  search-engine query per state (all $0, no paid tools) — consistent with the D-04 effort budget.
- Iowa's FY2025 PDF is owner-password-encrypted (`/Encrypt` present in the PDF header, matching its
  "Protected" filename) — verified `pdftotext -table` still extracts cleanly despite the encryption
  (no workaround needed, documented in the gap log as informational).

## User Setup Required

None - no external service configuration required. Documentation-only recon, $0 spend, no DB writes.

## Next Phase Readiness

- `117-BATCH2-SOURCES.md` is a complete input contract for Phase 119 (ACFR Upgrade — Batch 2:
  IA/KS/ME/MS/MT, requirements ACFR-38..42): every state has a located GF statement, durable URL
  pattern (or enumeration requirement), bookend-tied dollar figures, all four risk facts pinned,
  a recency-floor GREENLIGHT, a scope-vs-NASBO recommendation, and a loader-template mapping.
- The MS P2 clamp and the naming-exception gap-log items (IA opaque IDs, KS opaque hashes, ME
  FY2020 exception, MS/MT varying filenames) are ready for the Phase-119 loader author to action
  directly from the Pre-Load Checklist in the SOURCES doc.
- No blockers. This plan does not feed the Phase-123 NASBO-served list (zero exceptions in this
  batch) — Phase 117's other plans (Batch 1/3/4 + DEEP-05) proceed independently in the same wave.

---
*Phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH2-SOURCES.md`
- FOUND commit: `af12f74` (Task 0)
- FOUND commit: `79ea894` (Task 1)
- FOUND commit: `988c01a` (Task 2)
