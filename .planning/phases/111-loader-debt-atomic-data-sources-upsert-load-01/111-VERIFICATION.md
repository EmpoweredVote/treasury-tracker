---
phase: 111-loader-debt-atomic-data-sources-upsert-load-01
verified: 2026-07-02
status: passed
score: 3/3 success criteria
re_verification: false
---

# Phase 111 Verification — Loader Debt: Atomic data_sources Upsert (LOAD-01)

**Verdict: PASSED** — goal-backward verification against the ROADMAP phase goal and all three success criteria, with fresh evidence gathered at verification time (not summary trust).

## Phase goal

> The `process*Acfr.js` loader template's `data_sources` write is atomic (or the vestigial write is removed) so a full loader run — including an idempotent re-run — leaves 0 residue rows, and every loader used this milestone inherits the fix.

Delivered as: the vestigial *persistence* was removed — the row still exists during a run (the RPC requires it as its parameter vehicle) but is created fresh and deleted at end of run, with a start-of-run delete self-healing any crashed-run leftovers. This is stronger than the literally-suggested `upsert(onConflict)`, which would have needed a schema migration and still left an unreferenceable row for INV-2 to flag (see 111-RESEARCH.md root cause: `budgets.data_source_id` FKs to `source_registry`, so no loader row can ever be referenced).

## Success criteria

| # | Criterion | Result | Evidence (fresh, this verification pass) |
|---|-----------|--------|------------------------------------------|
| 1 | Root cause fixed at template level; inherited by every loader used this milestone | **PASS** | 0 of 35 files retain a `data_sources` select/check-then-insert; 35/35 contain exactly one delete-by-dataset_id + one delete-by-id pair; 35/35 carry the WR-05/LOAD-01 contract comment future clones inherit. Covers the phase-113/114 clone template, the phase-115 MA/CT/NJ/WI loaders, and the NASBO fallback `loadStateGF.mjs`. Commit `f713d3d`. |
| 2 | Live idempotency re-run leaves 0 residue, no manual re-clean, proven by the residue probe before and after | **PASS** | `verify-phase110-cohort-audit.mjs` 10/10 exit 0 → `processNJAcfr.js --fy 2025` + `processNJRevenueAcfr.js --fy 2025` (both "Loaded 0 rows") → audit 10/10 exit 0 with **zero manual deletions**; post-run `%-gf-%` listing = 12 city rows, 0 state rows. Full record: 111-RESIDUE-PROOF.md (commit `9c1c145`). Contrast: 106 hand-deleted 10 rows, 110 hand-deleted 20. |
| 3 | Existing loaded data unchanged after the re-run | **PASS** | NJ 12 rows (6 op + 6 rev, FY2020–2025); FY2025 op $59,603,886,014 / rev $60,979,024,211 and tree checksums (12 cats / $119,207,772,028; 8 cats / $121,958,048,422) identical before/after; INV-1 all-506-rows basis-stamped; diff audit: 0 `.from('budgets')`/`.rpc(` code lines changed; audit oracle git-clean. |

## must_haves check (111-01-PLAN.md)

- Ephemeral lifecycle in all 35 loaders, no `.maybeSingle()` on data_sources → **verified** (greps above)
- 0 residue after a full run incl. re-run, no manual re-clean → **verified** (live proof)
- Existing data unchanged; city data_sources rows untouched → **verified** (12 city rows before and after)
- Audit oracle not modified → **verified** (`git status --porcelain` empty for the script)

## Known limitations (documented, in-contract)

- A loader that dies via `process.exit(2)` mid-run leaves its ephemeral row until any next run's start-delete self-heals it (a lingering row is a useful crashed-run signal). Accepted in plan + research.
- `sync_logs` rows cascade-delete with the ephemeral row — transient bookkeeping; durable provenance is the text-stamped budgets columns (INV-1).

## Requirement

LOAD-01: **Complete.**
