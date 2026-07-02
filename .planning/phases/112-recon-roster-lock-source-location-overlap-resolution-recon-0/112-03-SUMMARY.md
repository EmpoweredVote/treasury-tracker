---
phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
plan: "03"
subsystem: database
tags: [acfr, nasbo, state-budgets, supabase, recon, read-only-probe, pdftotext]

# Dependency graph
requires:
  - phase: 112-01
    provides: NASBO 2025 SER 31-state ranking table + Batch-1 ACFR source location (AZ/IN/CO/MO/KY)
  - phase: 112-02
    provides: Batch-2 ACFR source location (OR/SC/LA/OK/UT) + UT overlap-risk flag
  - phase: 111-loader-debt-atomic-data-sources-upsert-load-01
    provides: ephemeral data_sources lifecycle (LOAD-01) every Phase 113/114 loader inherits
provides:
  - Locked ~10-state ACFR roster (IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA) with OK deferred to ACFRX-03
  - One-round substitution (OK -> AL) fully reconned (bookend-tied, risk facts, recency floor, scope-vs-NASBO, loader mapping, gap log)
  - Locked Phase 113/Phase 114 batch split with ACFR-21..30 <-> state traceability mapping
  - Read-only overlap resolution: UT state-node provenance confirmed clean NASBO-only; all 10 roster states + AL probed clean; 19 existing ACFR nodes confirmed untouched
  - Consolidated 112-RECON.md decision-ready handoff (risk-fact table, gap-log rollup, open risks, D-13 caveat)
affects: [113-acfr-upgrade-batch-1, 114-acfr-upgrade-batch-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ephemeral Node probe script (not committed) for read-only Supabase SELECT-only overlap checks, run from repo root for node_modules resolution"
    - "Rank-correction substitution: a non-candidate NASBO state outranking the weakest named candidate triggers a bounded, one-round substitution (D-01) distinct from an extraction/recency-floor failure"

key-files:
  created: []
  modified:
    - .planning/phases/112-recon-roster-lock-source-location-overlap-resolution-recon-0/112-RECON.md

key-decisions:
  - "Oklahoma (rank 14 of 31, weakest named candidate) substituted out per the D-01 rank-correction clause; Alabama (rank 9, next-largest un-upgraded NASBO state) substituted in — one round only, no second reach-down despite HI/NM/KS also outranking OK"
  - "All 10 locked-roster states (+ AL substitute + deferred OK) are clean NASBO-only nodes with zero data_sources residue — no MA/CA-style in-place-upgrade plan needed anywhere in this tranche, simpler than Phase 107"
  - "Utah state node holds only Phase-96 NASBO rows; the 15 v2.5 Transparent-Utah municipal (city/county) rows are confirmed distinct and untouched by construction"
  - "Alabama's ACFR General Fund (~0.24x NASBO GF) is the narrowest scope divergence found across the whole v2.14 tranche, driven by AL's constitutional GF/Education-Trust-Fund dual-budget split (combined ~1.04x NASBO) — flagged as a Phase-114 load-time decision, not resolved in recon"
  - "Batch split re-locked by corrected GF size (not the original REQUIREMENTS.md proposed order): Batch 1/Phase 113 = IN,AZ,OR,MO,CO; Batch 2/Phase 114 = SC,KY,UT,AL,LA; ACFR-21..30 <-> state mapping reassigned accordingly, with a REQUIREMENTS.md text-sync noted for Phase 113 kickoff (not edited in this plan's declared file scope)"

requirements-completed: [RECON-09, RECON-10]

# Metrics
duration: 95min
completed: 2026-07-02
---

# Phase 112 Plan 3: Recon Roster Lock + Overlap Resolution Summary

**Locked the final 10-state ACFR tranche-3 roster (IN/AZ/OR/MO/CO/SC/KY/UT/AL/LA) and the Phase 113/114 batch split via a read-only DB overlap probe plus one bounded rank-correction substitution (Oklahoma out, Alabama in, fully reconned and bookend-tied).**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-07-02T20:35:00Z (approx, per STATE.md session start)
- **Completed:** 2026-07-02T22:14:00Z
- **Tasks:** 3
- **Files modified:** 1 (`112-RECON.md`)

## Accomplishments

- Ran a read-only SELECT-only probe against production Supabase (`treasury.municipalities`, `treasury.budgets`, `treasury.data_sources`) confirming the Utah state node's provenance is clean NASBO-only (no v2.5-era residue) and that its 15 municipal (city/county) rows are structurally distinct and untouched.
- Probed all 10 named roster candidates plus the eventual Alabama substitute — every one is a clean NASBO-only node (2 rows, `data_sources` residue = 0), meaning no MA/CA-style in-place-upgrade plan was needed anywhere in this tranche (simpler than the Phase 107 precedent, which needed one for MA/GA).
- Confirmed the 19 existing ACFR state nodes (MN/OH/VA/CA/TX/NY/FL/PA/IL/NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI) by UUID, distinct from every roster/candidate node — the untouched-nodes contract Phase 113/114 inherit.
- Ran the one permitted substitution round (D-01): Oklahoma (actual NASBO rank 14, four non-candidate states outranking it) substituted out to ACFRX-03; Alabama (rank 9, the single next-largest un-upgraded NASBO state) substituted in with a full recon block — ACFR located, GF column identified, FY2002+FY2024 bookend-tied to $0 diff, September-30 FY-end confirmed, four risk facts pinned, recency floor GREENLIGHT, and a unique ~0.24× NASBO scope-divergence finding (Alabama's constitutional General-Fund/Education-Trust-Fund dual-budget split) flagged as a load-phase decision.
- Locked the final roster (IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA) and the Phase 113/Phase 114 batch split by corrected GF size, with the full ACFR-21..30 ↔ state traceability mapping recorded (differs from the original REQUIREMENTS.md proposed order on 8 of 10 slots due to the NASBO re-ranking + the OK→AL substitution).
- Consolidated `112-RECON.md` into the decision-ready Phase 113/114 handoff: risk-fact table, gap-log rollup, NASBO-replace rule, open-risks section (scope-relabel ratios, P2 clamp anticipations, units/naming/access risks), and the D-13 re-verify-at-load caveat.

## Task Commits

Each task was committed atomically:

1. **Task 1: Read-only overlap probe — UT state-node provenance + roster custom-source inventory + 19-nodes-untouched contract** - `5b59bae` (docs)
2. **Task 2: Substitution round (one round only) — replace failed/rank-corrected candidates from the ranking ladder** - `657eee3` (docs)
3. **Task 3: Lock the roster + 113/114 batch split and consolidate the decision-ready handoff** - `3faa509` (docs)

_All three commits modify the same single deliverable (`112-RECON.md`) — this is a documentation-only recon plan with no code changes, so each commit represents a faithfully reconstructed incremental state of the document matching that task's scope._

## Files Created/Modified

- `.planning/phases/112-recon-roster-lock-source-location-overlap-resolution-recon-0/112-RECON.md` - Consolidated Phase 112 recon handoff: NASBO ranking, substitution round (OK→AL), roster lock, batch split with ACFR-2x traceability, overlap resolution (UT + all roster states + AL), consolidated risk-fact table, gap-log rollup, untouched-nodes contract, open risks for Phase 113/114.

## Decisions Made

- **OK → AL substitution (rank correction, not extraction failure):** Oklahoma's own 112-02 recon was clean (bookend-tied $0 diff, GREENLIGHT recency floor) but it ranks 14th of 31 remaining NASBO states — four non-candidate states (AL, HI, NM, KS) all outrank it. Per D-01's rank-correction clause, Oklahoma was substituted out and Alabama (rank 9, the single next-largest un-upgraded state) substituted in. Hawaii/New Mexico/Kansas were reviewed but not needed — D-01 permits exactly one substitution round and Alabama alone fills the vacancy.
- **No in-place-upgrade plans needed:** Unlike Phase 107 (which needed a confirmed-but-simple in-place-upgrade check for Massachusetts and a supersede-plan confirmation for Georgia), every one of the 11 states probed in this tranche (10 roster + Alabama) is a uniformly clean NASBO-only node. The standard ACFR-replaces-NASBO supersede rule applies across the board.
- **Alabama's dual-budget scope divergence flagged, not resolved:** Alabama's ACFR General Fund (~$3.26B FY2024) is dramatically narrower than its NASBO GF ($13,511M) — the narrowest ratio (~0.24×) found in the entire v2.14 tranche, even narrower than Utah's 0.83×. The driver is Alabama's constitutionally separate Education Trust Fund; combined GF+ETF (~$14.04B) is very close to NASBO's figure (~1.04×). Per D-03/D-09 guidance, this is flagged as a Phase-114 load-time decision (load GF alone vs. GF+ETF combined) rather than resolved here — the same treatment given to Utah's Income Tax Fund finding in 112-02.
- **Batch split re-locked by corrected size, not the original proposed order:** REQUIREMENTS.md's pre-recon ACFR-21..30 labels assumed the proposed candidate order (AZ/IN/CO/MO/KY/OR/SC/LA/OK/UT); the actual NASBO 2025 SER ranking plus the OK→AL substitution changes 8 of the 10 state↔label associations. The corrected mapping is locked in `112-RECON.md` Section 4 as the authoritative input contract; a REQUIREMENTS.md text sync is recommended at Phase 113 kickoff but was not made here (out of this plan's declared file scope of `112-RECON.md` only).

## Deviations from Plan

None — plan executed exactly as written. The rank-correction substitution round was itself a planned decision point (D-01), not a deviation; it was resolved per the plan's own explicit instructions and the setup already flagged in 112-01's recon (AL/HI/NM/KS rank-correction marks, OK identified as "the most likely substitution-round casualty").

## Issues Encountered

- The initial ephemeral probe script failed with `ERR_MODULE_NOT_FOUND` for `@supabase/supabase-js` when run directly from the scratchpad directory (no local `node_modules`). Resolved by copying the script to the repo root temporarily (so Node's module resolution found the project's `node_modules`), running it, and deleting it immediately after — never committed, consistent with the plan's declared file scope of `112-RECON.md` only.
- Alabama's FY2024 ACFR `pdftotext -table` output showed an apparent row-label/value off-by-one shift (the first revenue line's label appeared merged into the "REVENUES" section header) — this is a known `-table` mode quirk on complex multi-column statements (same class as the CO TABOR-presentation and MO/CO Statement-of-Activities-schedule cautions documented in 112-BATCH1-SOURCES.md). Resolved by verifying the GF column's line-item sum still tied exactly to the printed Total Revenues/Expenditures figures in both bookend years — the numeric tie is what recon requires (D-05), not perfect per-line label alignment (a Phase-114 loader concern).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 112 is COMPLETE. `112-RECON.md` is the decision-ready input contract for Phase 113 (Batch 1: Indiana, Arizona, Oregon, Missouri, Colorado — ACFR-21..25) and Phase 114 (Batch 2: South Carolina, Kentucky, Utah, Alabama, Louisiana — ACFR-26..30).
- Phase 113/114 kickoff should note the REQUIREMENTS.md ACFR-21..30 state-label text sync flagged in `112-RECON.md` Section 4 (the literal text there still reflects the pre-recon proposed mapping; the locked traceability table in the recon doc is authoritative).
- Three load-phase decisions are carried forward, not resolved: (1) Arizona's FY2024 ACFR non-durable Google Drive URL (D-06 concern), (2) Utah's GF-alone-vs-GF+Income-Tax-Fund scope question, (3) Alabama's GF-alone-vs-GF+Education-Trust-Fund scope question. All three are documented in `112-RECON.md`'s Open Risks section.
- No blockers for Phase 113/114 kickoff.

---
*Phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0*
*Completed: 2026-07-02*
