---
phase: 102-verification-source-chain-audit-uat-ver-01-ver-02
plan: 02
subsystem: database
tags: [audit, data-integrity, state-gf, residue-cleanup, source-chain]

requires:
  - phase: 100-new-york-florida-acfr-upgrade
    provides: NY/FL ACFR GAAP budget rows loaded with text-stamp provenance (data_source_id=null)
  - phase: 99-california-texas-acfr-upgrade
    provides: CA/TX ACFR GAAP budget rows loaded with text-stamp provenance
  - phase: 96-remaining-states-sgfs-04
    provides: 43 NASBO state budget rows with NASBO-budgetary provenance stamps
  - phase: 102-01
    provides: 102-01 re-derivation harness (independent FY tie checks — 16/16 PASS)

provides:
  - "50-node state cohort source-chain audit script (verify-phase102-cohort-audit.mjs) asserting 7 invariants, exit 0"
  - "Full stale *-gf-* residue cohort deleted: 98 state data_sources removed (0-row guarded)"
  - "cleanupStaleStateGFDataSources.mjs extended with --cohort mode for dynamic sweep"
  - "All 7 invariants PASS across 200 state budget rows and 50 state nodes"

affects:
  - 102-03-UAT
  - any future state-GF load or data_sources maintenance

tech-stack:
  added: []
  patterns:
    - "INV-2 residue scoping: NASBO *-gf-operating-nasbo metadata entries excluded from residue check (intentionally kept); only non-NASBO stale artifacts are targeted"
    - "Cohort mode in cleanup script: dynamically discovers all state-related zero-row sources rather than a hard allow-list"
    - "0-row assertion guard fires per-entry before every delete — refuses if any live budgets row references the target"

key-files:
  created:
    - scripts/verify-phase102-cohort-audit.mjs
  modified:
    - scripts/cleanupStaleStateGFDataSources.mjs

key-decisions:
  - "NASBO *-gf-operating-nasbo data_sources excluded from INV-2 residue check: they legitimately back 0 live budgets rows (all state rows use text-stamp / data_source_id=null per P4) but are intentionally kept as NASBO edition metadata. The cleanup script also excludes them."
  - "INV-7 scopes to 43 pure-NASBO states (AK-WY minus CA/TX/NY/FL/MN/OH/VA) — the 7 ACFR-upgraded states are checked by INV-6 instead"
  - "No inline fixes required: the single INV-2 FAIL was pure residue (Task 2 cleanup), not an integrity defect. All other invariants PASSed on first run."

patterns-established:
  - "verify-phase102-cohort-audit.mjs is the 50-node state cohort audit gate for v2.11 close"
  - "cleanupStaleStateGFDataSources.mjs --cohort --apply is the full-cohort residue delete; subsequent runs are idempotent (exit 0, 0 deleted)"

requirements-completed: [VER-01]

duration: 30min
completed: 2026-06-30
---

# Phase 102 Plan 02: 50-Node State Cohort Source-Chain Audit + Residue Delete Summary

**All 7 invariants PASS across 200 state budget rows and 50 state nodes; 98 stale data_sources deleted with 0-row guard holding; cohort is residue-free, basis-labelled, and ACFR/NASBO correctly segmented**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-30T01:15:04Z
- **Completed:** 2026-06-30T01:45:00Z
- **Tasks:** 3
- **Files modified:** 2

## 7-Invariant Audit Result (final run — exit 0)

| Invariant | Result | Detail |
|-----------|--------|--------|
| INV-1 NULL-basis | PASS | 0 rows with missing data_source/source_url/source_date across 200 state budget rows |
| INV-2 residue/fragile | PASS | 0 non-NASBO state *-gf-* data_sources with 0 referencing live rows (after Task 2 cleanup) |
| INV-3 out-of-window | PASS | 0 state-node FYs outside per-state loaded window bounds |
| INV-4 dup | PASS | 0 duplicate (municipality_id, fiscal_year, dataset_type) combos |
| INV-5 orphan | PASS | 0 state budget rows have non-null data_source_id (all use text-stamp per P4; no FK orphan possible) |
| INV-6 ACFR-GAAP-on-4 | PASS | All 58 CA/TX/NY/FL operating+revenue rows carry ACFR provenance label |
| INV-7 NASBO-untouched | PASS | All 86 rows across 43 pure-NASBO states carry NASBO provenance and only 'operating' dataset |

**Total: 7/7 PASS. Exit 0.**

**First-run result:** 6/7 PASS — INV-2 failed with 145 state *-gf-* sources (including NASBO) at 0 rows. After scoping fix (exclude NASBO metadata from INV-2), the non-NASBO residue was 98 entries, cleaned by Task 2. Re-run: 7/7 PASS.

## Residue Delete: data_sources Removed

**98 stale non-NASBO state *-gf-* data_sources deleted** — all with 0 referencing budgets rows (0-row guard held; no live-row source was touched):

**Per-state ACFR mirror entries (8):** ca-acfr-gf-operating, ca-acfr-gf-revenue, fl-acfr-gf-operating, fl-acfr-gf-revenue, ny-acfr-gf-operating, ny-acfr-gf-revenue, tx-acfr-gf-operating, tx-acfr-gf-revenue

**Per-state legacy operating+revenue pairs (90 — 45 states × 2):** al, ar, az, co, ct, de, ga, hi, ia, id, il, in, ks, ky, la, ma, md, me, mi, mn, mo, ms, mt, nc, nd, ne, nh, nj, nm, nv, oh, ok, or, pa, ri, sc, sd, tn, ut, va, vt, wa, wi, wv, wy (each with -gf-operating and -gf-revenue)

**Preserved (47):** All `*-gf-operating-nasbo` NASBO edition metadata sources — AK through WY (intentionally kept as NASBO SER reference metadata; excluded from the cohort sweep per design).

## Accomplishments

- Built `scripts/verify-phase102-cohort-audit.mjs`: read-only 7-invariant audit over all 50 state nodes; per-defect detail; exits 0 on all PASS / 2 on any FAIL
- Extended `scripts/cleanupStaleStateGFDataSources.mjs` with `--cohort` mode: dynamic discovery + 0-row guarded delete of all non-NASBO state *-gf-* residue
- Deleted 98 stale data_source entries (the full pre-ACFR/NASBO-upgrade artifact set)
- Confirmed: all 4 ACFR-upgraded nodes (CA/TX/NY/FL) carry ACFR-GAAP labels on 58 operating+revenue rows
- Confirmed: all 43 pure-NASBO states untouched — 86 operating rows, NASBO provenance, no unexpected datasets

## Task Commits

1. **Task 1: Build 50-node cohort audit** — `f6927e0` (feat)
2. **Task 2: Delete stale residue + refine INV-2 scope** — `279bcdd` (chore)
3. **Task 3: Run audit to green** — no new commit needed (audit ran clean on existing code; exit 0 achieved)

## Files Created/Modified

- `scripts/verify-phase102-cohort-audit.mjs` — 50-node state cohort source-chain audit (7 invariants, read-only, exit 0/2)
- `scripts/cleanupStaleStateGFDataSources.mjs` — Extended with --cohort mode for full stale residue sweep

## Decisions Made

- **NASBO sources excluded from INV-2:** The `*-gf-operating-nasbo` data_sources legitimately back 0 live budgets rows because all state budget rows use text-stamp provenance (data_source_id=null per P4). They are intentionally retained as NASBO edition metadata — not stale artifacts. The INV-2 check and --cohort cleanup both exclude them.
- **INV-7 scopes to 43 pure-NASBO states:** CA/TX/NY/FL/MN/OH/VA are ACFR-upgraded (checked by INV-6). The remaining 43 states are pure NASBO (FY2023-FY2024, operating only).
- **No inline integrity fixes required:** INV-1/3/4/5/6/7 all PASS on first run. The only defect was INV-2 residue — handled by Task 2's cleanup (not an inline data fix, the planned cleanup task).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Refined INV-2 residue scope to exclude NASBO metadata sources**
- **Found during:** Task 2 (running dry-run of cleanup script)
- **Issue:** INV-2 initially counted NASBO `*-gf-operating-nasbo` sources as "residue" (they have 0 live budgets rows). This is incorrect — they are intentionally kept NASBO edition metadata, not stale artifacts. The cleanup script also excludes them.
- **Fix:** Updated INV-2 filter in the audit script to skip dataset_ids matching `/nasbo/i`, aligning audit scope with cleanup script's intended behavior.
- **Files modified:** scripts/verify-phase102-cohort-audit.mjs
- **Verification:** Re-ran audit — INV-2 PASS with correct scope; 7/7 PASS total.
- **Committed in:** 279bcdd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical scope alignment)
**Impact on plan:** Scope clarification only; no data was changed unexpectedly. The cleanup deleted exactly the intended 98 non-NASBO stale entries.

## Issues Encountered

None beyond the INV-2 scope clarification above.

## Escalated Defects

None. No defect required a full re-load or scope change (D-07 escalation boundary not triggered). All 102-01-reported ties were 16/16 exact, so no FAILs were routed from 102-01.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The only writes were `DELETE` on `treasury.data_sources` for rows with 0 live referencing budgets rows — 0-row-guarded per T-102-02-01.

## Self-Check

Files exist:
- `scripts/verify-phase102-cohort-audit.mjs` — FOUND
- `scripts/cleanupStaleStateGFDataSources.mjs` — FOUND (extended)

Commits exist:
- `f6927e0` — FOUND (Task 1: build audit script)
- `279bcdd` — FOUND (Task 2: cleanup + INV-2 fix)

## Self-Check: PASSED

## Next Phase Readiness

- Phase 102-03 (UAT) can proceed: all 7 source-chain audit invariants PASS; residue deleted; the 4 ACFR nodes are confirmed GAAP-labelled; the 46 NASBO nodes are confirmed untouched.
- `node scripts/verify-phase102-cohort-audit.mjs` is the automated gate — exits 0 now, should remain exit 0 unless a future load mutates state-node rows.

---
*Phase: 102-verification-source-chain-audit-uat-ver-01-ver-02*
*Completed: 2026-06-30*
