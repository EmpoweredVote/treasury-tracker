---
phase: 123
status: verified
verified: 2026-07-05
verifier: inline (orchestrator, goal-backward)
requirements: [NASBORT-01]
result: PASS
---

# Phase 123 Verification — NASBO Retirement (NASBORT-01)

Goal-backward verification against the ROADMAP Phase 123 success criteria. Result: **PASS**.

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | `loadStateGF.mjs` NASBO path demoted to fallback-only (relabelled/guarded) so it no longer serves any live node | `isAcfrOccupied` guard wired into `loadStateFY` after muni resolution, before the `data_sources` insert; returns `false`→skip for every ACFR/other node. Header + `main()` banner relabelled `[FALLBACK-ONLY]`. `node --check` exits 0; guard unit-tested (3 branches). Every one of the 50 states' ACFR-occupied FY2023/FY2024 nodes is skipped. | ✅ |
| 2 | No live state node displays NASBO where ACFR now exists | Read-only DB: exactly 2 NASBO operating nodes (NV FY2024, KY FY2023); for each, the NASBO row is the ONLY operating row for that state-year — no same-year ACFR. | ✅ |
| 3 | 50/50-ACFR end state documented; NASBO path available but dormant | `docs/state-acfr-5050.md` records the 50/50 end state, the two accepted honest fallbacks (NV FY2024, KY FY2023) + reasons, and the retire-to-fallback-only decision (loader kept, not deleted). | ✅ |
| 4 | Idempotent; no data regression on any of the 50 ACFR nodes | Guard skips every ACFR-occupied node before any write → an unfiltered re-run overwrites 0 ACFR nodes; NASBO-self nodes refresh in place (RPC keys on muni+fy+dataset_type). No live load run this phase (verification is read-only) → no regression occurred. Mechanism unit-tested. | ✅ |

## Supporting checks
- `node --check scripts/loadStateGF.mjs` → exit 0.
- `node --test scripts/loadStateGF.test.mjs` → 15 tests, 15 pass, 0 fail.
- Read-only DB (2026-07-05): 50 distinct ACFR-operating states; 2 NASBO nodes (NV FY2024,
  KY FY2023); MS ACFR FY2003–2024; MT ACFR FY2015–2025.
- REQUIREMENTS.md: NASBORT-01 `[x]`; ACFR-41/ACFR-42 corrected to `[x]`; status rows Complete.

## Non-goals respected
- Loader NOT deleted (retired to fallback-only).
- No new ACFR data load (NV FY2024 / KY FY2023 kept as documented fallbacks).

## Hand-off to Phase 124
VER-10 (Chris live-app UAT) confirms in-app that no node shows NASBO where same-year ACFR
exists; the two fallbacks are the only NASBO nodes and are the accepted ACFR-gap years.
