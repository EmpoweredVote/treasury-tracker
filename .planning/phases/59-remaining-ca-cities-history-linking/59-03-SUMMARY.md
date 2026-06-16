---
phase: 59-remaining-ca-cities-history-linking
plan: "59-03"
subsystem: ui
tags: [basis-note, comparability, cityBasisNotes, source-chip, always-sourced]

requires:
  - phase: 59-remaining-ca-cities-history-linking
    provides: mixed-basis city list from Plan 59-01 (all 7 layered cities)
  - phase: 58-la-county-parity-backfill
    provides: cityBasisNotes.ts + ComparabilityNote mechanism
provides:
  - Sourced basis-change notes for all 7 mixed-basis CA cities
affects: [59-04]

tech-stack:
  added: []
  patterns:
    - "Additive cityBasisNotes map entry per mixed-basis city — no render-site change"

key-files:
  created:
    - .planning/phases/59-remaining-ca-cities-history-linking/59-03-SUMMARY.md
  modified:
    - src/data/cityBasisNotes.ts

key-decisions:
  - "All 7 layered cities are mixed-basis → 7 entries (candidate set = final set)"
  - "SF entry keyed 'San Francisco|CA' (59-02 kept the muni name unchanged)"
  - "Berkeley note describes an interior seam (custom FY2012-2015 between SCO FY2003-2011 and FY2016-2024), not a recent-years seam"

patterns-established:
  - "Per-city accurate FY-boundary wording derived from the 59-01 baseline custom ranges"

requirements-completed: [HIST-02]

duration: ~8min
completed: 2026-06-16
---

# Phase 59 / Plan 59-03: basis-change notes for the newly mixed-basis cities

**Added sourced basis-change notes for all 7 mixed-basis CA cities, each disclosing the SCO all-governmental-funds floor beneath the city's custom years, with a durable SourceChip and zero render-site changes.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-06-16
- **Tasks:** 2/2
- **Files modified:** 1 (`src/data/cityBasisNotes.ts`)

## Accomplishments
- **7 new `cityBasisNotes` entries** — San Francisco, Oakland, Fresno, Riverside, Bakersfield, San Diego, Berkeley — each with the exact SCO-vs-custom FY boundary from the 59-01 baseline:
  - SF / Bakersfield: SCO FY2003–2024 · custom published budget FY2025–2026
  - San Diego: SCO FY2003–2024 · custom published budget FY2025
  - Oakland: SCO FY2003–2023 · custom General Purpose Fund FY2024–2025
  - Fresno: SCO FY2003–2019 · custom published General Fund FY2020–2026
  - Riverside: SCO FY2003–2022 · custom published General Fund FY2023–2026
  - Berkeley: custom published budget FY2012–2015 between SCO FY2003–2011 and FY2016–2024 (interior seam)
- Every entry carries `source_name`, durable `/d/ju3w-4gxp` `source_url`, and `source_date 2026-06-16` (always-sourced, T-59-03).
- **Typecheck passes** (`tsc -b`, exit 0). **No render-site change** — `src/App.tsx:932-945` lookup is generic.
- Existing `Long Beach|CA` / `West Hollywood|CA` entries untouched; no entry for the rich custom-only cities (San Jose, Fremont, Sacramento) or any pure-SCO city.

## Task Commits

1. **Task 59-03-01: add entries** — `6c74d90` (feat) — 7 sourced cityBasisNotes entries.
2. **Task 59-03-02: typecheck** — no file change; `tsc -b` clean, render site confirmed generic.

**Plan metadata:** this SUMMARY (docs).

## Files Created/Modified
- `src/data/cityBasisNotes.ts` — +7 mixed-basis city entries; header doc comment updated.

## Decisions Made
- The mixed-basis final set = all 7 layered cities (each retains custom rows above the SCO floor).
- SF key = `San Francisco|CA` (matches the muni name 59-02 kept).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- **59-04** can spot-check a sampled basis note rendering live (e.g. Fresno) with a SourceChip.

---
*Phase: 59-remaining-ca-cities-history-linking*
*Completed: 2026-06-16*
