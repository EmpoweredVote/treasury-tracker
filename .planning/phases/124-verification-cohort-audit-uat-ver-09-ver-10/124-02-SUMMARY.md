---
phase: 124-verification-cohort-audit-uat-ver-09-ver-10
plan: "02"
subsystem: verification
tags: [acfr, nasbo, supabase, treasury.budgets, cohort-audit, postgrest-pagination]

# Dependency graph
requires:
  - phase: 118-121 (ACFR Upgrade Batches 1-4)
    provides: all 21 remaining NASBO states upgraded to State-ACFR GAAP GF revenue/spending
  - phase: 122 (Deepening — Existing ACFR Node Pre-window Holes)
    provides: CA FY2002-2025 and FL FY2003-2024 deepened GF history
  - phase: 123 (NASBO Retirement, NASBORT-01)
    provides: isAcfrOccupied guard + loadStateGF.mjs demoted to fallback-only
  - phase: 124-01 (VER-09a blind re-derivation)
    provides: 124-REDERIVATION.md, the loader-independent tie evidence this audit complements
provides:
  - 50-node cohort source-chain audit harness (scripts/verify-phase124-cohort-audit.mjs)
  - 124-COHORT-AUDIT.md — the VER-09(b+c) evidence record (14/14 invariants, 50/50-ACFR, NASBORT-01, idempotency, window reconciliation)
affects: [124-03-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "50-state cohort invariant audit (Phase 102/106/110/116/124 lineage): read-only, exit 0/2, per-state window bounds + exact-FY-set window-integrity"
    - "NASBO-retirement invariant pattern: instead of a 'N NASBO states' set, assert an exact global count of NASBO-labelled rows plus 0 overlap with ACFR-occupied (state,fy) keys"
    - "Guard-logic verification via direct pure-function application against live data, when a loader's --dry-run flag structurally cannot exercise a DB-dependent branch"
    - "Explicit .range() pagination for any Supabase read expected to exceed PostgREST's 1,000-row default response cap"

key-files:
  created:
    - scripts/verify-phase124-cohort-audit.mjs
    - .planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-COHORT-AUDIT.md
  modified: []

key-decisions:
  - "Fixed a pagination bug the Phase 116 template didn't need to handle: the 50-state cohort now totals 1,560 budget rows, exceeding PostgREST's 1,000-row default cap. A plain `.select()` (as used in the 116 template) would silently truncate results and corrupt every invariant for states sorted after the cutoff. Added explicit `.range()` pagination before writing any invariant logic."
  - "INV-2 allowlists the single documented persistent data_sources registry row (`ca-acfr-gf-operating`) rather than flagging it as WR-05-class residue — 122-03-DEEP05-CLOSEOUT.md and 122-03-SUMMARY.md explicitly confirm this is an intentional, verified exception (CA's operating loader is not ephemeral for this one dataset), not a defect."
  - "The literal plan instruction to run `node scripts/loadStateGF.mjs --dry-run` to prove the isAcfrOccupied guard skips ACFR-occupied nodes does not work as written: the CLI's dry-run path returns at the control-tie check, BEFORE municipality resolution and the guard's DB read — so dry-run never touches the guard at all. Adapted by directly applying the exported `isAcfrOccupied` pure function against live current data_source values for all 94 state-FY combinations in the loader's NASBO fallback map — a more rigorous read-only proof than the literal CLI invocation would have been even if it worked."

requirements-completed: [VER-09]

# Metrics
duration: 65min
completed: 2026-07-05
---

# Phase 124 Plan 02: VER-09b+c Cohort Source-Chain Audit Summary

**50-node state cohort audit (14 invariants incl. new NASBORT-01 and 50/50-ACFR checks) passes clean over all 1,560 budget rows; idempotency re-runs of a dollar-unit (ND) and a hand-transcribed (OK) loader both report 0 net change with 0 residue, and the NASBO-retirement guard is proven a no-op on all 50 ACFR-occupied nodes.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-07-05T21:55:00Z (approx.)
- **Completed:** 2026-07-05T23:00:00Z (approx.)
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- Built `scripts/verify-phase124-cohort-audit.mjs` by adapting `verify-phase116-cohort-audit.mjs` to the v2.15 final-tail + NASBO-retirement end state: `WINDOW_BOUNDS` gained all 21 tail states plus widened CA (2002–2025) and FL (2003–2024) bounds with the `_NASBO` default fallback removed entirely (every state now has an explicit window); INV-6 now checks ACFR/CAFR provenance across all 50 states; the old "N NASBO states × 2 rows" INV-7 was replaced with a new **NASBORT-01** invariant (exactly 2 NASBO-labelled rows cohort-wide, 0 overlap with any ACFR-occupied (state,fy) key); a new **50/50-ACFR** invariant confirms every one of the 50 states carries an ACFR-labelled operating row; a new **ME non-June resolution** check confirms the pre-recon "watch for non-June FY-end" flag on Maine resolved to standard June-30 (matching 119-03-ME-LOADLOG); INV-11 window-integrity was generalized to the 23 states touched this phase (21 tail + CA + FL).
- Discovered and fixed a pagination defect before it could corrupt the audit: the 50-state cohort now totals 1,560 budget rows, which exceeds PostgREST's default 1,000-row response cap. The Phase 116 template's plain `.select()` would have silently truncated results (confirmed via a live probe showing most tail states reporting only 2 rows instead of their true 5–24-row windows). Added explicit `.range()`-based pagination to guarantee the complete 1,560-row cohort loads before any invariant runs.
- Ran the audit against the live production Supabase schema; discovered one genuine INV-2 flag (`ca-acfr-gf-operating`, a data_sources row with 0 referencing budget rows) — investigated and confirmed via `122-03-DEEP05-CLOSEOUT.md` that this is a documented, intentional exception (CA's operating loader keeps exactly 1 persistent registry row, verified by Phase 122), not WR-05-class residue. Added an explicit allowlist for this one dataset_id (still flags any OTHER undocumented residue) and re-ran to a clean 14/14 PASS, exit 0.
- Re-ran two representative ACFR loaders live against already-loaded FYs to prove idempotency: `processNDAcfr.js`/`processNDRevenueAcfr.js` (dollar-unit, FY2025) and `processOKAcfr.js`/`processOKRevenueAcfr.js` (hand-transcribed cohort member, FY2024) — all four reported `Loaded 0 rows`. Re-ran the full cohort audit afterward: still 14/14 PASS, ND still exactly 10 rows, OK still exactly 46 rows (0 net change). Direct WR-05 residue queries (`dataset_id ILIKE 'nd-%'` / `'ok-%'`) both returned 0 rows.
- Verified the Phase 123 `isAcfrOccupied` guard is a no-op on the ACFR-occupied surface: applied the guard's exported pure function directly against the live current `data_source` of all 94 state-FY combinations in `loadStateGF.mjs`'s hardcoded NASBO fallback map (`__STATES`, 47 states × 2 FYs) — 92 would SKIP (ACFR-occupied), and the only 2 that would write are the loader's own NV FY2024 / KY FY2023 fallback rows (idempotent self-refresh, not a foreign overwrite).
- Wrote `124-COHORT-AUDIT.md`: the headline verdict, a full per-invariant PASS table, the 21-new-state + CA/FL row-count confirmation table, the window-verdict reconciliation (every absent FY mapped to a recorded, non-relitigated disposition), the documented persistent-registry exception writeup, and the full idempotency/guard-verification result.

## Task Commits

Each task was committed atomically:

1. **Task 1: Adapt the cohort audit for the 50-ACFR final-tail cohort and run the full invariant set incl. NASBORT-01 + 50/50-ACFR** - `4d7fc11` (feat)
2. **Task 2: Confirm idempotency / never-overwrite (with WR-05 residue re-check), reconcile the window verdict, and write 124-COHORT-AUDIT.md** - `150be7c` (docs)

## Files Created/Modified

- `scripts/verify-phase124-cohort-audit.mjs` - 50-node state cohort source-chain audit for the v2.15 final-tail cohort (14 invariants, read-only, exit 0/2, explicit `.range()` pagination)
- `.planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-COHORT-AUDIT.md` - The VER-09(b+c) cohort audit report (per-invariant table, row counts, window reconciliation, idempotency + guard verification)

## Decisions Made

- Fixed the PostgREST 1,000-row pagination gap proactively (before it could produce a false-clean audit) rather than copying the 116 template's plain `.select()` verbatim — see key-decisions above.
- Allowlisted the one documented CA persistent-registry data_sources row in INV-2 rather than treating it as residue, backed by the explicit Phase 122 closeout documentation.
- Adapted the guard-verification method from a literal `--dry-run` CLI invocation (which cannot exercise the DB-dependent guard branch, as discovered by code inspection) to a direct read-only application of the exported `isAcfrOccupied` pure function against live data — see key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a PostgREST 1,000-row pagination gap before it could corrupt the audit**
- **Found during:** Task 1, initial live-DB probing (before writing invariant logic)
- **Issue:** The cohort now has 1,560 budget rows (up from Phase 116's 901), exceeding PostgREST's default 1,000-row response cap. A plain `.select()` without `.range()` — as used verbatim in the Phase 116 template — silently truncates the result set. A probe run confirmed this: several tail states reported only 2 rows (FY2023/2024) instead of their true 5-24-row windows, an apparent "all tail states are still NASBO-only" false signal that would have failed nearly every invariant incorrectly had it gone undetected.
- **Fix:** Implemented explicit `.range()`-based pagination (1,000-row pages, loop until a partial page is returned) in the budgets fetch, confirmed all 1,560 rows load correctly via an exact `count: 'exact', head: true` cross-check.
- **Files modified:** `scripts/verify-phase124-cohort-audit.mjs`
- **Verification:** Re-ran the audit; row counts for every state now match the plan's interfaces-block expectations exactly (spot-checked KS 7+7, ND 5+5, CA 24+24, FL 22+22, etc.).
- **Committed in:** `4d7fc11` (Task 1 commit — fix applied before the script was committed)

**2. [Rule 1 - Bug] INV-2 initially false-flagged a documented, intentional persistent-registry row as residue**
- **Found during:** Task 1, first full audit run
- **Issue:** `ca-acfr-gf-operating` backs 0 live budgets rows (CA rows use text-stamp provenance) and was initially flagged as WR-05-class residue. Cross-referencing `122-03-DEEP05-CLOSEOUT.md` (line 29) and `122-03-SUMMARY.md` confirmed this is a documented, verified exception: CA's operating loader intentionally keeps exactly 1 persistent registry row (not ephemeral, unlike every other tail loader), and Phase 122 already confirmed 0 orphan/duplicate on this row.
- **Fix:** Added an explicit `DOCUMENTED_PERSISTENT_REGISTRY` allowlist containing only this one dataset_id, with a code comment citing the Phase 122 source documents; the check still fails on any OTHER undocumented `*-gf-*` residue (verified 0 such rows exist).
- **Files modified:** `scripts/verify-phase124-cohort-audit.mjs`
- **Verification:** Re-ran the audit; INV-2 now passes with the exception explicitly logged; confirmed no other residue rows exist cohort-wide.
- **Committed in:** `4d7fc11` (Task 1 commit)

**3. [Rule 1 - Bug] The plan's literal `--dry-run` guard-verification instruction does not exercise the guard**
- **Found during:** Task 2, before running the idempotency step
- **Issue:** Code inspection of `loadStateFY()` in `scripts/loadStateGF.mjs` showed the `dryRun` early-return (`if (dryRun) { ...; return true; }`) fires at the control-tie check, which runs BEFORE municipality resolution and the `isAcfrOccupied` guard's DB read. Running `node scripts/loadStateGF.mjs --dry-run` therefore validates only the hardcoded control-tie math for every state in the NASBO map and never reaches the guard branch at all — it cannot demonstrate "the guard would SKIP every ACFR-occupied node" as the plan's acceptance criteria requires, because the guard code path is structurally unreachable in dry-run mode.
- **Fix:** Adapted the verification to directly import and apply the guard's exported pure function (`isAcfrOccupied`) against the LIVE current `data_source` of every (state, fy) combination in the loader's hardcoded fallback map (`__STATES`, read-only, no writes) — this exercises the identical decision logic the live loader would run, against real current data, and is a more rigorous proof than the (non-functional) literal CLI invocation would have been.
- **Files modified:** None (ad hoc read-only verification script, not committed — result captured in `124-COHORT-AUDIT.md` §5)
- **Verification:** 94 state-FY combinations checked; 92 would SKIP (ACFR-occupied); the only 2 that would write are the loader's own NV FY2024 / KY FY2023 fallback rows (self-refresh, not overwrite) — matching the 123-01-SUMMARY.md's independently-verified DB finding exactly.
- **Committed in:** N/A (verification-only; result recorded in the Task 2 docs commit `150be7c`)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs/gaps discovered while building and running the audit, before either script/report was committed). None affected the plan's scope or objective; all three made the audit MORE rigorous than a verbatim copy of the Phase 116 template or a literal reading of the plan's guard-verification instruction would have produced.

**Impact on plan:** All three fixes were necessary for audit correctness (the pagination bug would have produced false invariant failures across most of the cohort; the INV-2 false-positive would have blocked sign-off on a row Phase 122 already verified intentional; the dry-run substitution was required because the literal instruction was structurally impossible to satisfy as written). No scope creep — all three stayed within Task 1/Task 2's stated deliverables.

## Issues Encountered

None beyond the three auto-fixed items documented above. The live production Supabase schema was reachable throughout via the gitignored `.env`; all reads were read-only except the two loader re-runs (ND FY2025, OK FY2024), which are themselves idempotent no-ops by design and were the intended verification action.

## Next Phase Readiness

- `124-COHORT-AUDIT.md` (this plan) + `124-REDERIVATION.md` (plan 124-01) are ready to be consumed by Plan 124-03 (UAT prep) and the gsd-verifier as the VER-09 evidence record.
- VER-10 (Chris live-app UAT) is scoped to plan 124-03, not this plan. The hand-off notes in `124-COHORT-AUDIT.md` §6 point 124-03 toward sampling a deepened node (CA FY2002–2007 or FL FY2003–2020) and confirming NV FY2024 / KY FY2023 render as honest, disclosed NASBO fallbacks rather than looking like data defects.
- No blockers. The audit script and its report are self-contained and require no further action before Plan 124-03 begins.

---
*Phase: 124-verification-cohort-audit-uat-ver-09-ver-10*
*Plan: 02*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: scripts/verify-phase124-cohort-audit.mjs
- FOUND: .planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-COHORT-AUDIT.md
- FOUND: .planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-02-SUMMARY.md
- FOUND commit: 4d7fc11 (Task 1 — cohort audit script)
- FOUND commit: 150be7c (Task 2 — cohort audit report)
