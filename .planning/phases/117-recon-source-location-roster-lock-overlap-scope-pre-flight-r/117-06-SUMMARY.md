---
phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
plan: "117-06"
subsystem: database
tags: [supabase, read-only-probe, acfr, recon, nasbo, state-acfr]

requires:
  - phase: 117-01
    provides: 117-BATCH1-SOURCES.md (AK/AR/DE/HI/ID recon)
  - phase: 117-02
    provides: 117-BATCH2-SOURCES.md (IA/KS/ME/MS/MT recon)
  - phase: 117-03
    provides: 117-BATCH3-SOURCES.md (NE/NV/NH/NM/ND recon)
  - phase: 117-04
    provides: 117-BATCH4-SOURCES.md (OK/RI/SD/VT/WV/WY recon)
  - phase: 117-05
    provides: 117-DEEPEN-SOURCES.md (CA/NY/FL/TX deepening recon)
provides:
  - Locked 21-state roster (all RECON, zero STAY-NASBO-exception)
  - Confirmed 118-121 batch split (unchanged, no rebalancing needed)
  - Read-only DB probe results (D-10 overlap resolution + untouched-nodes contract)
  - Empty NASBO-served list (Phase 123 input contract -- all 50 states land on ACFR)
  - Consolidated per-state summary + loader-template mapping for Phases 118-121
  - DEEP-05 deepening summary for Phase 122
  - Open Risks rollup (scope-relabel, P2 clamps, units traps, access cautions, AK cleanup)
affects: [118-acfr-upgrade-batch-1, 119-acfr-upgrade-batch-2, 120-acfr-upgrade-batch-3, 121-acfr-upgrade-batch-4, 122-deepening, 123-nasbo-retirement, 124-verification]

tech-stack:
  added: []
  patterns:
    - "Read-only Supabase-JS probe (schema:'treasury', service-role key) as the project-documented
       fallback when mcp__supabase-local__execute_sql is unavailable in the execution environment"

key-files:
  created:
    - .planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-RECON.md
  modified: []

key-decisions:
  - "All 21 roster states triage to RECON verdict -- zero STAY-NASBO-exception, D-11 no-backfill honored with a perfect 21/21 count"
  - "AK carries 2 orphaned data_sources rows (ak-ugf-revenue/operating) with no matching budgets data -- flagged as a WR-05/LOAD-01-class cleanup for Phase 118, not an in-place-upgrade overlap"
  - "NASBO-served list for Phase 123 is empty -- all 50 states land on ACFR once Phases 118-121 complete"
  - "Batch split (118-121) confirmed unchanged from the roadmap since zero exceptions triggered rebalancing"

patterns-established:
  - "D-10 overlap probe distinguishes 'in-place-upgrade overlap' (live custom-sourced budget data
     requiring preservation) from 'orphaned data_sources residue' (stale metadata with zero matching
     budgets rows) -- the AK case established this as a distinct, cleanup-only disposition"

requirements-completed: [RECON-11]

duration: 35min
completed: 2026-07-04
---

# Phase 117 Plan 06: Overlap Resolution + Roster Lock + Consolidated Handoff Summary

**Locked all 21 remaining NASBO states to RECON (zero exceptions), confirmed the 118-121 batch split unchanged, and produced an empty Phase-123 NASBO-served list via a read-only Supabase probe that also surfaced one genuine finding: 2 orphaned `data_sources` rows on Alaska's node with no matching budget data.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-04T02:21:00Z
- **Completed:** 2026-07-04T02:56:31Z
- **Tasks:** 2 completed
- **Files modified:** 1 (117-RECON.md, created + extended across 2 commits)

## Accomplishments

- Ran a read-only `SELECT`-only DB probe (Supabase-JS, `schema: 'treasury'`) against all 21 roster
  state nodes' `budgets` and `data_sources` rows, and enumerated all 29 existing ACFR nodes to confirm
  the 50-state population splits cleanly into 29 ACFR + 21 NASBO with no gaps or overlaps.
- Found the phase's one genuine overlap-adjacent issue: Alaska carries 2 orphaned `data_sources`
  rows (`ak-ugf-revenue`, `ak-ugf-operating`, `api_type=html`, `rows_synced` 30/60) with **zero**
  corresponding `budgets` rows — a WR-05/LOAD-01-class stale-metadata residue, not a live
  custom-sourced node. Flagged for Phase 118 pre-load cleanup (delete before writing new ACFR
  `data_sources` rows).
- Locked the roster: all 21 named states verdict **RECON**, zero **STAY-NASBO-exception** — D-11's
  "ship what survives, no backfill" produced a perfect 21/21 count.
- Confirmed the 118–121 batch split unchanged (no exceptions means no rebalancing needed).
- Consolidated the four batch SOURCES docs into one per-state summary + loader-mapping table (21
  rows: statement/column, units, FY-end, window, bookend ties, scope-vs-NASBO ratio, loader template).
- Pulled the DEEP-05 deepening summary from 117-DEEPEN-SOURCES.md for Phase 122 (CA +6 FY to
  FY2002, FL +18 FY to FY2003, NY/TX floors reconfirmed with 0 extension).
- Produced the empty "nodes remaining NASBO-served" list — the Phase 123 (NASBORT-01) input contract:
  all 50 states will be on ACFR once Phases 118–121 land.
- Rolled up cross-batch Open Risks (scope-relabel confirmations for all 21 states, P2-clamp
  anticipations, units traps including ID's unresolved mixed-units transition year, soft-404/
  Akamai/browser-UA access cautions, recency-floor gaps for NV/NM, and the AK cleanup item).
- Mapped all findings back to Phase 117's 5 ROADMAP success criteria + RECON-11.

## Task Commits

Each task was committed atomically:

1. **Task 1: Read-only overlap probe (D-10) + untouched-nodes contract** - `49e1bee` (docs)
2. **Task 2: Lock roster + confirm batch split + NASBO-served list + consolidated handoff** - `c060be1` (docs)

_Both tasks produced documentation-only writes to the same file (117-RECON.md), consistent with the
plan's single-artifact output spec. No test/feat/refactor commits — this is a documentation + read-only
DB probe plan._

## Files Created/Modified

- `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-RECON.md` -
  The consolidated Phase 118–123 handoff: overlap resolution (D-10), untouched-nodes contract, roster
  lock (D-11), batch split confirmation (D-12), per-state summary + loader mapping, DEEP-05 deepening
  summary, NASBO-served list (D-01 → Phase 123), NASBO-replace rule, Open Risks, success-criteria
  coverage.

## Decisions Made

- **`mcp__supabase-local__execute_sql` was unavailable in this execution environment** — fell back to
  the project-documented read pattern (`@supabase/supabase-js`, service-role key, `schema: 'treasury'`),
  matching the existing `scripts/audit_task1.mjs` precedent. All queries were `.select(...)` reads;
  zero writes were issued at any point.
- **AK's finding is classified as cleanup, not in-place-upgrade** — because zero `budgets` rows
  reference the orphaned `data_sources` entries, there is no live custom-sourced budget data to
  preserve via an upgrade; the correct disposition is a pre-load delete, which is a narrower and safer
  action than an in-place-upgrade migration.
- **NV (FY2024/25 gap) and NM (FY2023 gap, FY2022 image-only) stay RECON, not STAY-NASBO-exception**
  — their gaps are within-window load-time decisions (partial-window accept, live-site re-discovery,
  or embedded transcription), not disqualifying triage failures. This preserves the honest "ship what
  survives" count without inflating the exception list with recoverable gaps.

## Deviations from Plan

None - plan executed exactly as written. The `mcp__supabase-local__execute_sql` unavailability was
explicitly anticipated by the plan's `<mcp_tools>` guidance ("Check tool availability first; fall back
to any project-documented DB read method if unavailable") and is not a deviation from plan intent —
the fallback path was used exactly as instructed, and all queries remained read-only `SELECT`s per the
threat model's T-117-08 mitigation.

## Issues Encountered

None. The probe ran cleanly on the first attempt (after correcting a `node` working-directory issue —
running the script from the project root so `node_modules` resolved `@supabase/supabase-js`, rather
than from the OS scratchpad directory). No retries needed; all 21 roster states + 29 ACFR nodes were
enumerated in a single pass. Temporary probe scripts (`_probe117_tmp.mjs`, `_probe117_ak.mjs`) were
created in the main repo checkout (not the worktree) to access `node_modules`, and were deleted
immediately after use — confirmed via `git status --short` that no stray files were left in either
the main checkout or this worktree.

## User Setup Required

None - no external service configuration required. This plan used existing project credentials
(`.env` `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) already present in the repository, read-only.

## Next Phase Readiness

Phase 117 is fully closed. `117-RECON.md` is the decision-ready input contract for:

- **Phase 118** (AK/AR/DE/HI/ID) — including the AK `data_sources` cleanup step.
- **Phase 119** (IA/KS/ME/MS/MT) — including the MS P2 clamp requirement.
- **Phase 120** (NE/NV/NH/NM/ND) — including NV's recency-floor re-check, NH's Wayback/browser-fetch
  requirement, and NM's FY2022 embed + FY2023 discovery tasks.
- **Phase 121** (OK/RI/SD/VT/WV/WY) — including WY's per-year P2-clamp monitoring recommendation.
- **Phase 122** (DEEP-05 deepening) — CA/FL extension windows and filename maps ready; NY/TX floors
  reconfirmed with no further work needed.
- **Phase 123** (NASBORT-01) — the NASBO-served list is empty; no exception nodes to preserve when
  retiring `loadStateGF.mjs` to guarded fallback-only.

No blockers. No STAY-NASBO-exception states to special-case. The one operational flag (AK's orphaned
`data_sources` residue) is a small, well-scoped pre-load cleanup step, not a schedule risk.

---
*Phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-RECON.md`
- FOUND: commit `49e1bee` (Task 1)
- FOUND: commit `c060be1` (Task 2)
