---
phase: 59-remaining-ca-cities-history-linking
plan: "59-01"
subsystem: database
tags: [sco, bythenumbers, ca-state-controller, budget-history, never-overwrite, city-targeted]

requires:
  - phase: 58-la-county-parity-backfill
    provides: layer-beneath SCO pattern (D-04), never-overwrite collision policy, durable /d/ source attribution
provides:
  - SCO all-governmental-funds FY2003 operating + revenue history layered beneath 7 thin custom-source CA cities
  - Revenue history (FY2003-2024) for the 4 previously op-only cities (Berkeley, Fresno, Oakland, Riverside)
  - Authoritative mixed-basis city list for Plan 59-03 (all 7 layered cities)
affects: [59-03, 59-04, salaries-sweep, enrichment]

tech-stack:
  added: []
  patterns:
    - "City-targeted SCO load via bulkLoadStateController.js --city (no county expansion)"

key-files:
  created:
    - .planning/phases/59-remaining-ca-cities-history-linking/59-01-SUMMARY.md
  modified: []

key-decisions:
  - "All 7 thin layered cities ended up mixed-basis (custom rows survive above SCO all-funds floor) → all 7 feed 59-03 basis notes"
  - "Riverside revenue FY2009-2024 re-run after a transient SCO API 500; loader idempotency made the retry safe"

patterns-established:
  - "Per-city dry-run gate (city-scale vs county-scale total + custom-year SKIP) before any real SCO load"

requirements-completed: [HIST-02]

duration: ~35min
completed: 2026-06-16
---

# Phase 59 / Plan 59-01: SCO history layering beneath the thin CA cities

**Layered CA State Controller all-governmental-funds FY2003 operating + revenue history beneath 7 thin custom-source CA cities, preserving every custom row and leaving the 3 rich cities entirely untouched.**

## Performance

- **Duration:** ~35 min (incl. one transient-API retry)
- **Completed:** 2026-06-16
- **Tasks:** 4/4
- **Files modified:** 0 source files (DB-only plan; production Supabase writes)

## Accomplishments
- **All 7 thin cities reach FY2003** for operating AND revenue: San Francisco, Oakland, Fresno, Riverside, Bakersfield, San Diego, Berkeley.
- **Revenue history gained by the 4 op-only cities** (Berkeley, Fresno, Oakland, Riverside) entirely from the SCO layer (D-03) — FY2003-2024, no separate revenue effort.
- **Never-overwrite held perfectly:** every pre-existing custom row count matched the task-01 baseline byte-for-byte post-load (SF 2op+2rev, Oakland 2op, Fresno 7op, Riverside 4op, Bakersfield 2op+2rev, San Diego 1op+1rev, Berkeley 4op).
- **3 rich cities untouched (D-01):** San Jose, Fremont, Sacramento each have 0 SCO rows and unchanged custom counts.
- Sampled FY2003 rows carry durable `/d/ju3w-4gxp` (exp) / `/d/rrtv-rsj9` (rev) page URLs + `source_date 2026-06-16`; all 7 cities have non-zero population.

## Task Commits

DB-only plan — no per-task source commits. The single git artifact is this SUMMARY.

1. **Task 59-01-01: per-city baseline** — captured data_source/fy-set/totals/floor for 10 cohort cities (read-only).
2. **Task 59-01-02: dry-run gate** — all 7 cities returned city-scale (not county-scale) data, FY2003 non-empty, custom-year SKIP; D-04 collision cleared for SF/Riverside/San Diego.
3. **Task 59-01-03: real load** — FY2003-2024 op+rev per city, `--source-date 2026-06-16`; Riverside revenue FY2009-24 re-run after a transient SCO API 500.
4. **Task 59-01-04: post-load verification** — FY2003 reach + source presence + custom-untouched + rich-untouched + population confirmed.

## Files Created/Modified
- `.planning/phases/.../59-01-SUMMARY.md` — this summary. No source files changed.

## Decisions Made
- The mixed-basis set = all 7 layered cities (each keeps custom GF/transaction recent years above the SCO all-funds floor). This is the authoritative list for Plan 59-03.

## Deviations from Plan
None in scope. One operational retry: Riverside's load hit a transient SCO API 500 at Revenues FY2009; re-ran Riverside revenues FY2009-2024 (idempotent) to completion. No data integrity impact.

## Issues Encountered
- Transient `API 500` from bythenumbers.sco.ca.gov mid-run on Riverside revenues. Resolved by re-running the affected range; loader never-overwrite + same-source upsert made the retry safe and gap-free.

## Mixed-basis list for Plan 59-03
All 7 layered cities are mixed-basis and need a basis note:
San Francisco, Oakland, Fresno, Riverside, Bakersfield, San Diego, Berkeley.

## Next Phase Readiness
- **59-03** can author basis notes for all 7 (final set = candidate set).
- **59-02** (linking) is independent and can proceed; **59-04** verifies live render.

---
*Phase: 59-remaining-ca-cities-history-linking*
*Completed: 2026-06-16*
