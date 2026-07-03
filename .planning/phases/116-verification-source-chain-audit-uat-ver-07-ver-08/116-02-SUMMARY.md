---
phase: 116-verification-source-chain-audit-uat-ver-07-ver-08
plan: 02
subsystem: testing
tags: [supabase, verification, source-chain-audit, acfr, nasbo, gasb-34, idempotency]

# Dependency graph
requires:
  - phase: 113-acfr-upgrade-batch-1
    provides: 5 new ACFR states (IN/AZ/OR/MO/CO), FY2002-2025 windows
  - phase: 114-acfr-upgrade-batch-2
    provides: 5 new ACFR states (SC/KY/UT/AL/LA), AL Sep-30 semantics, KY FY2023 honest hole
  - phase: 115-deepening-recoverable-holes
    provides: pre-GASB-34 extractor, widened NJ/CT/WI/MA windows, distinct pre-34 basis label
  - phase: 111-loader-debt-atomic-data-sources-upsert
    provides: atomic/ephemeral data_sources lifecycle (LOAD-01 fix)
provides:
  - scripts/verify-phase116-cohort-audit.mjs — 12-invariant read-only cohort audit, reusable template for future tranches
  - 116-COHORT-AUDIT.md — per-invariant results, row-count table, hole reconciliation, LOAD-01 evidence
  - LOAD-01 end-to-end proof (first tranche to need 0 manual re-clean)
affects: [116-03-uat, future-acfr-tranches, milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cohort audit invariant harness: read-only Supabase queries, exit 0/2 contract, PASS/FAIL result accumulator"
    - "Window-integrity check (INV-11): exact expected-FY-set comparison per state, op/rev tracked separately when they diverge (KY)"
    - "ACFR/CAFR acronym-tolerant label regex to accommodate era-correct pre-GASB-34 terminology"

key-files:
  created:
    - scripts/verify-phase116-cohort-audit.mjs
    - .planning/phases/116-verification-source-chain-audit-uat-ver-07-ver-08/116-COHORT-AUDIT.md
  modified: []

key-decisions:
  - "INV-6 label regex accepts both ACFR and CAFR (case-insensitive) — pre-GASB-34 rows honestly carry the era-correct 'State CAFR' term, not 'ACFR' (which post-dates GASB 34); a strict ACFR-only check would have false-failed all 17 pre-34 rows"
  - "KY FY2023 operating is a documented, allowed exception in INV-6 (retains NASBO label) and in INV-11's expected-FY-set (operating includes FY2023, revenue excludes it) — the only state where op/rev FY-sets diverge"
  - "Chose SC + CT FY2025 as the LOAD-01 representative re-run (one tranche-3 state, one deepened state) per the plan's own suggested pair"
  - "Generalized Phase 110's window-integrity invariant (formerly its own INV-8, tranche-2-only) into this phase's INV-11, now tracking operating and revenue FY-sets independently to handle KY's divergence"

requirements-completed: [VER-07, VER-08]

# Metrics
duration: 25min
completed: 2026-07-03
---

# Phase 116 Plan 02: 50-Node Cohort Source-Chain Audit + LOAD-01 Proof Summary

**New 12-invariant read-only audit harness confirms the 29-ACFR/21-NASBO cohort (901 rows) is fully sourced, windowed, deduplicated, and basis-labelled — including a new pre-GASB-34 label distinctness check — and proves LOAD-01's atomic data_sources lifecycle needs 0 manual re-clean for the first time in the series.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-03T18:07:00Z (approx, following 116-01 close)
- **Completed:** 2026-07-03T18:32:00Z
- **Tasks:** 3
- **Files modified:** 2 created

## Accomplishments

- Built `scripts/verify-phase116-cohort-audit.mjs` from the Phase 110 template, extending it with 10 tranche-3 window bounds, 4 widened deepening bounds, a 29-state ACFR-GAAP set, a new pre-GASB-34 label-distinctness invariant, a new AL Sep-30 check, a dynamically-picked NASBO control, and a generalized window-integrity check spanning all 14 touched states — 12/12 invariants PASS, exit 0, over 901 live state budget rows.
- Proved LOAD-01 end-to-end: re-ran SC (tranche-3) and CT (deepened) FY2025 operating+revenue via the guarded `treasury_sync_budget_tree` path — 0 net change on all 4 rows, and 0 `data_sources` residue confirmed immediately with **no manual re-clean step** (the first cohort audit in the 102/106/110/116 series where this held without intervention, confirming the Phase 111 atomic-lifecycle fix).
- Wrote `116-COHORT-AUDIT.md` documenting all 12 invariant results, the full 29-ACFR/21-NASBO row-count table, an 11-row hole-reconciliation table (every absent FY traced to a recorded disposition, none re-litigated), and the LOAD-01 before/after evidence.

## Task Commits

1. **Task 1: Adapt the cohort audit for the tranche-3 + deepening cohort and run the full invariant set** - `9ba3760` (feat)
2. **Task 2: LOAD-01 idempotency + 0-residue-no-manual-reclean proof, hole reconciliation, write 116-COHORT-AUDIT.md** - `15f7efa` (docs)
3. **Task 3: Commit audit harness + report, SUMMARY** - this summary commit

## Files Created/Modified

- `scripts/verify-phase116-cohort-audit.mjs` - 12-invariant read-only cohort source-chain audit (INV-1..12) over the 50-node state cohort
- `.planning/phases/116-verification-source-chain-audit-uat-ver-07-ver-08/116-COHORT-AUDIT.md` - audit report: per-invariant results, row-count table, hole reconciliation, LOAD-01 evidence, headline verdict

## Decisions Made

- INV-6's ACFR-provenance check accepts either "ACFR" or "CAFR" (case-insensitive) because pre-GASB-34 rows (CT 1988-2001, WI 2000-2001, MA 2001) honestly carry the era-correct "State CAFR" term — ACFR terminology post-dates GASB 34. A strict "ACFR"-only substring match initially false-failed on first run (34 rows); fixed and re-verified before proceeding.
- KY FY2023 is modeled as a single documented exception threaded through two invariants: INV-6 (allows exactly 1 NASBO-labelled row on an otherwise-ACFR node) and INV-11 (operating FY-set includes 2023, revenue FY-set excludes it) — reflecting the real, audited state of the data (NASBO operating retained, no revenue row fabricated).
- LOAD-01 representative pair: SC (tranche-3) + CT (deepened), FY2025 op+rev — matches the plan's own suggested example exactly.
- Phase 110's tranche-2-specific "INV-8 window-integrity" concept was generalized (renumbered INV-11 in this phase, since INV-8 was reassigned to the new pre-GASB-34 label check) to cover all 14 touched states in one invariant, with operating and revenue FY-sets checked independently to handle KY's divergence — a cleaner, more scalable pattern for future tranches.

## Deviations from Plan

None - plan executed exactly as written. One in-flight self-correction during Task 1 (the INV-6 regex fix, described above) was caught and fixed before the first commit — not a deviation from the plan's scope, just normal script-development iteration during "run read-only against the live treasury schema... any FAIL is a source-chain defect → fix in-phase."

## Issues Encountered

- First run of the new script produced 1 FAIL (INV-6: 34 rows on CT/WI pre-34 years flagged as "non-ACFR-labelled"). Root cause: the regex required the literal substring "ACFR", but pre-GASB-34 rows correctly carry "CAFR" (the era-correct pre-GASB-34 term) per the 115-02-CT-WI-LOADLOG.md basis-label design. Fixed by widening the regex to accept either acronym; re-ran and got 12/12 PASS. This was a test/audit-script bug, not a data defect — the underlying `treasury.budgets` rows were correct all along.

## User Setup Required

None - no external service configuration required. All work was read-only DB queries plus 4 idempotent loader re-runs (0 net change) against the existing live Supabase instance using the repo's `.env` service key.

## Next Phase Readiness

- VER-07 (parts b, c) and VER-08 requirements are satisfied by this audit — ready for Phase 116 Plan 03 (live-app UAT, Chris sign-off).
- `scripts/verify-phase116-cohort-audit.mjs` is a reusable template for any future ACFR tranche's cohort audit (mirrors the 110→116 pattern).
- No blockers. The cohort is confirmed clean (0 residue, 0 out-of-window, 0 dup, 0 orphan, 0 unexplained NASBO leaks) and LOAD-01 is proven end-to-end with no outstanding WR-05-class debt.

## Self-Check: PASSED

- FOUND: scripts/verify-phase116-cohort-audit.mjs
- FOUND: .planning/phases/116-verification-source-chain-audit-uat-ver-07-ver-08/116-COHORT-AUDIT.md
- FOUND: commit 9ba3760 (feat, Task 1 — script)
- FOUND: commit 15f7efa (docs, Task 2 — report)

---
*Phase: 116-verification-source-chain-audit-uat-ver-07-ver-08*
*Completed: 2026-07-03*
