---
phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42
plan: "02"
subsystem: database
tags: [acfr, pdftotext, supabase, treasury_sync_budget_tree, kansas, state-acfr]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: enumerated per-FY Kansas opaque-hash ACFR URLs, bookend ties, NASBO baseline
  - phase: 119-01
    provides: extract_gf.py position-anchor generalization (wide-layout precedent, CO/MO),
      gen_state.py CONFIGS pattern
provides:
  - Kansas state node (bb3dcf05-586c-4e68-85d3-26a6199cc4ab) fully upgraded from NASBO-only to
    State-ACFR GAAP GF revenue-by-source + GAAP spending-by-function, FY2019-2025 (full window,
    zero honest holes)
affects: [120-acfr-upgrade-batch-3, 121-acfr-upgrade-batch-4, 123-nasbo-retirement, 124-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Confirmed extract_gf.py's existing position-anchor (right-edge of the FIRST numeric
      token on the printed 'Total revenues' row) handles arbitrarily-wide multi-column GF
      statements (8 columns here) with zero code changes -- the CO/MO wide-layout mechanism
      generalizes cleanly to a third state"

key-files:
  created:
    - scripts/processKSAcfr.js
    - scripts/processKSRevenueAcfr.js
    - _acfr-work/ks/ks_all.json (gitignored)
    - .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-02-KS-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored -- CONFIGS['KS'] entry only, no new fixes needed)

key-decisions:
  - "Loaded the full FY2019-2025 window with zero honest holes -- all 7 years tied exactly on
    the first extraction pass (cleanest cohort member in this tranche to date)"
  - "No extract_gf.py/gen_state.py code generalizations were needed for KS -- the existing
    position-anchor (proven on CO/MO) and the shared loader template handled the 8-column wide
    layout and uniform category shape without any state-specific post-processor (unlike IA's
    ia_extract.py in the same phase)"

patterns-established: []

requirements-completed: [ACFR-39]

# Metrics
duration: 35min
completed: 2026-07-04
---

# Phase 119 Plan 02: Kansas ACFR Upgrade (ACFR-39) Summary

**Kansas state node upgraded from NASBO-only to full State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function) across the complete FY2019-2025 window, zero honest holes, NASBO FY2023/FY2024 replaced in place.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 2 committed (scripts/processKSAcfr.js, scripts/processKSRevenueAcfr.js) + 1 LOADLOG + gitignored _acfr-work tooling (gen_state.py CONFIGS['KS'] + ks/ks_all.json)

## Accomplishments
- Re-verified all 7 per-FY opaque `admin.ks.gov/browse/files/{hash}/download` URLs (already enumerated by Phase 117 recon) by downloading, checking `%PDF` magic + size, and `pdftotext -table`-extracting each
- Confirmed `extract_gf.py`'s existing position-anchor (no code changes) correctly isolates the General column (1st of 8: General | Social Services | Health and Environment | Transportation | Executive | Commerce | Non-major | Total) at both bookends and all 5 interior years — zero honest holes, the cleanest extraction in this tranche so far
- Generated `scripts/processKSAcfr.js` (operating) + `scripts/processKSRevenueAcfr.js` (revenue) via `gen_state.py CONFIGS['KS']`; both bookends dry-run-tied exactly (FY2025 $10,352,600,000 / FY2019 $7,539,362,000)
- Live-loaded all 7 fiscal years (14 rows total) — FY2023/FY2024 NASBO operating rows replaced in place; confirmed via idempotent re-run (`Loaded 0 rows`, 0 net change) and 0 `data_sources` residue

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate both KS loaders + download/extract/transcribe + dry-run tie** - `79a847e` (feat)
2. **Task 2: Live-load KS (operating + revenue), NASBO replaced in place** - DB-only, no repository file changes of its own; verified in Task 3's commit
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification + LOADLOG** - `1b9343c` (feat)

## Files Created/Modified
- `scripts/processKSAcfr.js` - Kansas GF operating (spending-by-function) loader, GAAP basis, UNITS=1000
- `scripts/processKSRevenueAcfr.js` - Kansas GF revenue (by-source) loader, GAAP basis, UNITS=1000
- `_acfr-work/gen_state.py` (gitignored) - added `CONFIGS['KS']`; no shared-code generalizations needed
- `_acfr-work/ks/ks_all.json` (gitignored) - assembled per-FY revenue+expenditure trees, FY2019-2025
- `.planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-02-KS-LOADLOG.md` - full per-FY load disposition

## Decisions Made
- Loaded the complete FY2019-2025 window (the full durable window per Phase 117 recon — the current `admin.ks.gov` archive does not list pre-FY2019) with zero honest holes; every year tied to $0 diff on the first extraction pass
- No new extract_gf.py or gen_state.py generalizations were required — the wide 8-column layout and uniform category shape (no name collisions, no rev_boundary sub-heading complications, sub=None throughout every revenue year) were fully handled by tooling already generalized for CO/MO (wide-layout position-anchor) and needed none of IA's state-specific fixes (no NET-REVENUES quirk, no Capital-Outlay dual-subsection collision)
- FY2021's negative "Investment earnings" (-$3,712K, a real GAAP fair-value loss) confirmed rendering correctly via the existing P2 clamp mechanism with no loader changes

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; KS's clean, uniform statement shape required zero extraction workarounds.

## Issues Encountered

None. This was the cleanest load in the tranche to date — all 7 years tied on the first pass, no wrapped labels, no OCR/encryption issues, no dual-subsection collisions.

## User Setup Required
None — no external service configuration required. Live writes used the existing gitignored `.env` service-role credentials already present in the main working tree.

## Next Phase Readiness
- Kansas (ACFR-39) is fully loaded and verified idempotent with 0 residue; ready for Phase 124's independent re-derivation + cohort audit + Chris UAT.
- No blockers for 119-03 (Maine) through 119-05 (Montana), which proceed independently in this phase's remaining plans.

---
*Phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: scripts/processKSAcfr.js
- FOUND: scripts/processKSRevenueAcfr.js
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-02-KS-LOADLOG.md
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-02-SUMMARY.md
- FOUND commit: 79a847e
- FOUND commit: 1b9343c
