---
phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47
plan: "05"
subsystem: database
tags: [acfr, state-general-fund, supabase, treasury_sync_budget_tree, pdftotext, north-dakota]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: ND bookend ties, derivable URL pattern (FY2021 -nd exception), NASBO baseline, units=dollars flag
provides:
  - North Dakota state node upgraded NASBO-only → full State-ACFR GAAP (GF revenue-by-source + spending-by-function), FY2021-FY2025
  - scripts/processNDAcfr.js + scripts/processNDRevenueAcfr.js (gen_state.py-generated)
  - CONFIGS['ND'] entry in _acfr-work/gen_state.py (reusable template artifact, gitignored)
affects: [123-nasbo-retirement, 124-verification-cohort-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns: [gen_state.py CONFIGS-driven loader generation, ephemeral data_sources lifecycle (LOAD-01), P2 negative-category clamp, NASBO-replace-in-place via keyed treasury_sync_budget_tree RPC]

key-files:
  created:
    - scripts/processNDAcfr.js
    - scripts/processNDRevenueAcfr.js
    - .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-05-ND-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (CONFIGS['ND'] added — gitignored, not tracked)

key-decisions:
  - "ND ACFR GF ~1.57x NASBO (mildest divergence in Batch 3) accepted and relabelled honestly — own-source Sales/Use + Oil/Gas/Coal taxes dominate GF, federal revenue booked to separate Federal column"
  - "UNITS=1 (dollars) hard-set for ND — the ND units trap avoided, both bookends dollar-exact"
  - "FY2021 -nd filename suffix exception special-cased in SOURCES map rather than assumed derivable"

requirements-completed: [ACFR-47]

# Metrics
duration: 15min
completed: 2026-07-04
---

# Phase 120 Plan 05: North Dakota ACFR Upgrade Summary

**North Dakota state node upgraded from NASBO operating-only to full State-ACFR GAAP (GF revenue-by-source + spending-by-function) across FY2021-FY2025, zero honest holes, UNITS=1 dollars, NASBO replaced in place.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-04T22:55:00Z (approx)
- **Completed:** 2026-07-04T23:03:00Z
- **Tasks:** 3 completed
- **Files modified:** 3 tracked (2 loaders + 1 loadlog); 1 gitignored config file (`_acfr-work/gen_state.py`)

## Accomplishments

- Generated `scripts/processNDAcfr.js` + `scripts/processNDRevenueAcfr.js` via `_acfr-work/gen_state.py` `CONFIGS['ND']`, downloading and tie-verifying all 5 target FYs (2021-2025) with zero honest holes — both bookends exact $0 diff (FY2025 $4,510,201,793 / FY2021 $3,955,670,947).
- Live-loaded ND operating + revenue for all 5 FYs (10 rows total). FY2023/FY2024 NASBO operating rows replaced in place at the same row IDs (no duplicates, no residual NASBO labels).
- Verified idempotency (re-run of FY2025 produced 0 net change, identical row IDs/totals), 0 `data_sources` residue (LOAD-01 holds), Money In auto-enabled (5 revenue rows), and cohort untouched (CA/AK ACFR nodes and un-upgraded WY spot-checked unaffected).
- Documented the ~1.57x accept-and-relabel scope divergence and the FY2022 interior-year P2 clamp exercise ("Interest and Investment Income (Loss)" -$897,827,062) in `120-05-ND-LOADLOG.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate both ND loaders + download/extract/dry-run tie** - `2a884ea` (feat)
2. **Task 2: Live-load ND (operating + revenue)** - no file changes (DB-only write task; verified in Task 3)
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification + LOADLOG** - `b58212b` (docs)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `scripts/processNDAcfr.js` - ND GF spending-by-function loader (dataset_type='operating'), UNITS=1, tie-verified FY2021-2025
- `scripts/processNDRevenueAcfr.js` - ND GF revenue-by-source loader (dataset_type='revenue'), UNITS=1, tie-verified FY2021-2025
- `.planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-05-ND-LOADLOG.md` - Per-FY load disposition, FY2021 `-nd`-suffix note, NASBO-replacement confirmation, accept-relabel record, idempotency result
- `_acfr-work/gen_state.py` - `CONFIGS['ND']` entry added (gitignored scratch tooling, not tracked in git)

## Decisions Made

- ND ACFR GF ~1.57x NASBO GF (the mildest divergence in Batch 3) accepted and relabelled honestly rather than treated as a scope error — own-source Sales and Use Taxes ($1,346,955,054 FY2025) + Oil, Gas, and Coal Taxes ($750,043,102 FY2025) dominate the GAAP General column, while most federal intergovernmental revenue routes to a separate "Federal" special-revenue fund column.
- UNITS=1 (dollars) hard-set per the recon's pre-flagged "ND units trap" — confirmed correct via exact bookend dollar-value ties on both revenue and expenditure sides, all 5 loaded years.
- FY2021's `-nd` filename suffix exception (`2021-acfr-nd.pdf`) special-cased explicitly in the generated loader's SOURCES map rather than assumed to follow the FY2022-2025 derivable pattern.

## Deviations from Plan

None - plan executed exactly as written. All 5 target years (FY2021-2025) tied on the first extraction pass with zero honest holes; no interior-year non-ties, no soft-404s, no architectural changes needed.

## Issues Encountered

None. The one pre-flagged risk (FY2022's "Interest and Investment Income (Loss)" going negative, an interior-year discovery not visible at either bookend) was handled cleanly by the existing P2 `clampForRender` mechanism with signed magnitude preserved in the category label — no code changes required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- North Dakota (ACFR-47) is the final state in Batch 3 (NE/NV/NH/NM/ND) — all 5 Batch-3 states now live on full State-ACFR GAAP.
- Hands ND to Phase 124 for independent re-derivation + cohort audit + Chris UAT, per the milestone's standard closeout sequence.
- No blockers or concerns carried forward.

---
*Phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47*
*Completed: 2026-07-04*
