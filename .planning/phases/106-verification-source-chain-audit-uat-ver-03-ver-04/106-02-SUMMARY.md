---
phase: 106-verification-source-chain-audit-uat-ver-03-ver-04
plan: 02
subsystem: testing
tags: [source-chain-audit, cohort-audit, invariants, supabase, state-acfr, nasbo, idempotency]

requires:
  - phase: 105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05
    provides: PA + IL ACFR GAAP nodes live in DB (20 rows PA, 10 rows IL), idempotency re-run precedent
  - phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08
    provides: Deepened CA FY2008-2025, NY FY2003-2024, FL FY2021-2024 windows + 104-DEEPEN-GAPLOG.md
  - phase: 106-01
    provides: 106-REDERIVATION.md (independent re-derivation, companion to this cohort audit)

provides:
  - scripts/verify-phase106-cohort-audit.mjs — 7-invariant 50-node cohort audit for v2.12 windows
  - 106-COHORT-AUDIT.md — full audit report with row counts, idempotency result, D-06 hole verdict

affects: [106-03-uatprep, milestone-v2.12-closeout, gsd-verifier-ver-03]

tech-stack:
  added: []
  patterns:
    - "50-node state cohort audit adapted for v2.12 ACFR set (9 ACFR states, 41 NASBO states)"
    - "D-05 in-phase fix: delete orphaned data_sources residue after each loader run (WR-05 workaround)"
    - "ACFR loader WR-05 pattern: loaders re-create data_sources residue on each run; audit must clean up post-idempotency"

key-files:
  created:
    - scripts/verify-phase106-cohort-audit.mjs
    - .planning/phases/106-verification-source-chain-audit-uat-ver-03-ver-04/106-COHORT-AUDIT.md
  modified: []

key-decisions:
  - "INV-6 ACFR-GAAP set expanded from 7 (Phase 102) to 9 states — PA + IL now included alongside CA/TX/NY/FL/MN/OH/VA"
  - "INV-7 NASBO-untouched count reduced from 46 to 41 — PA + IL promoted to ACFR set in v2.12 (Phase 105)"
  - "D-05 residue deletion: 12 total stale *-gf-* data_sources rows deleted in two rounds (10 pre-existing + 2 re-created by WR-05 during idempotency re-runs)"
  - "WR-05 loader pattern: each live run re-creates data_sources metadata entry; post-run cleanup is the current workaround until upsert(onConflict) fix"
  - "D-06 hole verdict: all 3 deferred FY ranges (NY <=2002, CA 2002-2007, FL <=2020) confirmed absent BY DESIGN with recorded dispositions — PASS-HONEST"

patterns-established:
  - "Cohort audit structural template: adapt from prior-phase script by updating WINDOW_BOUNDS + ACFR_STATES sets; reuse INV-1..INV-7 logic verbatim"

requirements-completed: [VER-03]

duration: 35min
completed: 2026-06-30
---

# Phase 106 Plan 02: 50-Node Cohort Source-Chain Audit Summary

**7/7 state-cohort invariants PASS over the v2.12-augmented windows (CA 2008-2025, NY 2003-2024, FL 2021-2024, PA 2016-2025 [NEW], IL 2021-2025 [NEW]); 276 budget rows all basis-labelled; 41 NASBO states untouched; idempotency and D-06 hole verdict confirmed.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-30T21:00:00Z
- **Completed:** 2026-06-30T21:39:42Z
- **Tasks:** 2
- **Files created:** 2 (verify-phase106-cohort-audit.mjs, 106-COHORT-AUDIT.md)

## Accomplishments

- Created `scripts/verify-phase106-cohort-audit.mjs` adapted from the Phase 102 template with updated WINDOW_BOUNDS (CA/NY/FL deepened, PA/IL new) and expanded ACFR-GAAP set (7 → 9 states)
- Ran all 7 invariants against the live DB: 7/7 PASS (exit 0) after D-05 in-phase residue fix
- Confirmed idempotency: PA FY2024 and IL FY2023 both "Loaded 0 rows" on live re-run
- Reconciled D-06 hole verdict: 0 unrecorded gaps; NY ≤FY2002 / CA FY2002-2007 / FL ≤FY2020 all absent by design with recorded dispositions (PASS-HONEST)
- Wrote comprehensive `106-COHORT-AUDIT.md` with per-invariant table, row-count confirmations, idempotency result, and D-06 reconciliation section

## Task Commits

1. **Task 1: Adapt cohort audit for v2.12 windows and run 7-invariant set** - `ff60c70` (feat)
2. **Task 2: Confirm idempotency, reconcile D-06 hole verdict, write 106-COHORT-AUDIT.md** - `fec18ec` (docs)

## Files Created/Modified

- `scripts/verify-phase106-cohort-audit.mjs` - 50-node cohort audit adapted for v2.12 (9 ACFR states, updated window bounds, exits 0/2)
- `.planning/phases/106-verification-source-chain-audit-uat-ver-03-ver-04/106-COHORT-AUDIT.md` - Full audit report: 7/7 PASS table, row counts, idempotency, D-06 hole verdict

## Decisions Made

- WINDOW_BOUNDS updated to v2.12 loaded windows: CA 2008-2025, NY 2003-2024, FL 2021-2024 (deepened in Phase 104), plus PA 2016-2025 and IL 2021-2025 (new in Phase 105)
- ACFR-GAAP set (INV-6) expanded from 4 (Phase 102) to 9 states: all prior ACFR nodes plus PA + IL
- INV-7 NASBO-untouched count correctly changed from 46 to 41 (PA + IL promoted to ACFR)
- D-06 hole verdict: NY ≤FY2002 (no durable URL), CA FY2002-2007 (variant naming, deferred at Phase 104 D-01), FL ≤FY2020 (not durably sourceable) — all PASS-HONEST; not re-litigated per D-06 rule

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / D-05] INV-2 residue: 10 stale state *-gf-* data_sources rows**
- **Found during:** Task 1 (first audit run — INV-2 check)
- **Issue:** 10 `data_sources` rows matching `*-acfr-gf-*` existed with 0 referencing live budget rows: ca/fl/il/ny/pa × operating+revenue. Created by loader check-then-insert (WR-05) at Phase 105 load time; budget rows use text-stamp provenance (data_source_id=null) so these were never referenced.
- **Fix:** Safety-checked 0 live budget refs for all 10 IDs, then deleted via direct `delete()` from `treasury.data_sources` using service key. Re-run: INV-2 PASS.
- **Files modified:** treasury.data_sources (DB write, 10 rows deleted)
- **Committed in:** ff60c70 (Task 1 commit — same commit as audit script; deletion was the D-05 fix enabling exit 0)

**2. [Rule 1 - Bug / D-05 / WR-05] INV-2 re-residue: 2 more stale rows after idempotency re-runs**
- **Found during:** Task 2 verification (second audit run after idempotency re-runs)
- **Issue:** Running `processPAAcfr.js --fy 2024` and `processILAcfr.js --fy 2023` live (for idempotency confirmation) triggered the loaders' WR-05 check-then-insert, which re-created `pa-acfr-gf-operating` and `il-acfr-gf-operating` data_sources entries.
- **Fix:** Same safety-check-then-delete approach. All remaining state *-gf-* entries confirmed 0 refs before deletion.
- **Files modified:** treasury.data_sources (DB write, 2 rows deleted)
- **Committed in:** fec18ec (Task 2 commit — deletion confirmed before writing the report)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — source-chain defect per D-05)  
**Impact on plan:** Both fixes are the correct D-05 in-phase source-chain defect resolution. Root cause (WR-05 non-atomic check-then-insert in ACFR loaders) is a known deferred cosmetic issue; the permanent fix (.upsert(onConflict)) is logged for a future hardening pass. Data integrity of budget rows is unaffected throughout.

## Issues Encountered

- The WR-05 loader pattern creates residue not just at initial load time but on every subsequent run (including idempotency re-runs). This required two rounds of D-05 residue cleanup. The audit script itself correctly detects this as INV-2 FAIL and the fix is straightforward (delete the 0-ref entries). Documented in 106-COHORT-AUDIT.md.

## Known Stubs

None — all 276 budget rows carry real ACFR-sourced data with non-null basis labels, source URLs, and source dates. No placeholder or hardcoded empty values in the cohort.

## Threat Flags

None — this plan is read-only audit + in-phase D-05 fix (delete orphaned data_sources rows). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Next Phase Readiness

- `106-COHORT-AUDIT.md` is the required input for the UAT-prep plan (106-03) alongside `106-REDERIVATION.md`
- The gsd-verifier reads both documents for VER-03 sign-off
- All 7 cohort invariants are clean; the v2.12 cohort is source-chain-verified and ready for Chris UAT (VER-04)
- Remaining: UAT across the D-04 anchor set (PA/IL/NY/CA/FL/NASBO-control) with Chris sign-off

---

## Self-Check

**Files exist:**
- `scripts/verify-phase106-cohort-audit.mjs` — FOUND (committed ff60c70)
- `.planning/phases/106-verification-source-chain-audit-uat-ver-03-ver-04/106-COHORT-AUDIT.md` — FOUND (committed fec18ec)

**Commits exist:**
- ff60c70 — feat(106-02): add 50-node cohort audit for v2.12 windows; fix D-05 residue
- fec18ec — docs(106-02): write 106-COHORT-AUDIT.md — 7/7 invariants PASS, idempotency + D-06 hole verdict

**Audit result:** `node scripts/verify-phase106-cohort-audit.mjs` exits 0, 7/7 PASS

## Self-Check: PASSED

---
*Phase: 106-verification-source-chain-audit-uat-ver-03-ver-04*
*Completed: 2026-06-30*
