# 121-02 SUMMARY — Rhode Island ACFR Upgrade (ACFR-49)

**Plan:** 121-02 · **Phase:** 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53
**Completed:** 2026-07-04 (Task 1 by executor; Tasks 2–3 verified + closed out by orchestrator after an executor tool-error — see LOADLOG provenance note)

## What was built

Rhode Island state node (`483f02b4-2167-4e3d-9f5c-0f3ed83be2e6`) upgraded from NASBO operating-only to full State-ACFR GAAP:
- `scripts/processRIAcfr.js` (GF spending-by-function, `operating`, UNITS=1000)
- `scripts/processRIRevenueAcfr.js` (GF revenue-by-source, `revenue`, UNITS=1000)
- Generated via `_acfr-work/gen_state.py` `CONFIGS['RI']` (explicit opaque per-FY SOURCES map, NC/GA/WV precedent).

## Load results (DB-verified)

- **Window:** FY2006–FY2025 (20 years, zero honest holes), both operating + revenue.
- **Rows:** 20 operating + 20 revenue = 40 rows, all GAAP-basis-labelled + per-year sourced; 0 NASBO rows remaining.
- **Bookends (live):** FY2025 revenue $10,095,792,000 ✓ · FY2006 revenue $4,585,920,000 ✓ (exact recon match).
- **NASBO replaced in place:** FY2023 ($5,075,000K) + FY2024 ($5,236,000K) operating rows replaced at the same key — no duplicates, no stale NASBO label.
- **Scope divergence:** ~1.93× (federal grants ~45% of GF consolidated in — MD/GA mechanism); accept-and-relabelled honestly.
- **0 data_sources residue** (LOAD-01 holds); **Money In auto-enabled** (20 revenue rows).
- **Idempotent** never-overwrite by construction (RPC-keyed UPDATE-in-place + ephemeral lifecycle).

## Deviations

- Tasks 2–3 (live load + verify + docs) were completed but the executor's commit + SUMMARY/LOADLOG were lost to an internal tool error mid-run. The orchestrator confirmed the load is correct via direct DB verification (bookends, row counts, 0 NASBO, 0 residue) and reconstructed the LOADLOG + this SUMMARY. No re-load was needed — the DB state was already correct and idempotent.

## Self-Check: PASSED

## Next

RI complete. Hands to Phase 124 (independent re-derivation + cohort audit + Chris UAT). Batch 4 continues with SD/VT/WV/WY (121-03..06).
