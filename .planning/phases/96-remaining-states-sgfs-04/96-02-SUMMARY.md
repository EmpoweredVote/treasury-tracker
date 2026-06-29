---
phase: 96-remaining-states-sgfs-04
plan: "02"
subsystem: scripts
tags: [cleanup, delete, state-nodes, unsourced, dry-run, idempotent]
dependency_graph:
  requires: []
  provides: [scripts/cleanupStateEstimates.mjs]
  affects: [treasury.budgets (DELETE — Plan 07 runs it live)]
tech_stack:
  added: []
  patterns: [targeted-DELETE, dry-run-first, --confirm gate, idempotent]
key_files:
  created:
    - scripts/cleanupStateEstimates.mjs
  modified: []
decisions:
  - "COHORT = exactly 46 UUIDs, hardcoded with abbr+name comments; MN/OH/VA/GA excluded by construction"
  - "Bare run (no --confirm) prints the same audit summary then REFUSES to delete — same UX as --dry-run minus the exit code"
  - "OOW_OPERATING_FYS = [2022, 2025, 2026]: FY2022 excluded (not in 2025 SER scope per D-96-02), FY2025/FY2026 excluded (estimated years, Pitfall 5)"
  - "229 revenue rows + 138 out-of-window operating rows confirmed in DB (all source_url=NULL)"
metrics:
  duration: "15 minutes"
  completed: "2026-06-28"
  tasks_completed: 1
  files_created: 1
---

# Phase 96 Plan 02: cleanupStateEstimates.mjs Summary

**One-liner:** Dry-run-first, idempotent targeted-DELETE script for 46-state cohort unsourced revenue rows and out-of-window (FY2022/2025/2026) operating estimate rows, with --confirm gate; verified against live DB (229 revenue + 138 operating = 367 rows to delete).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build cleanupStateEstimates.mjs (dry-run default, targeted DELETE) | e6bbaa2 | scripts/cleanupStateEstimates.mjs |

## Dry-Run Results (verified 2026-06-28)

```
SUMMARY:
  Revenue rows to delete:            229  (across 46 states)
  Out-of-window operating rows:      138  (FY2022/2025/2026 across 46 states)
  Total rows that would be deleted:  367
```

All 229 revenue rows have source_url=NULL (confirmed unsourced estimates).
All 138 out-of-window operating rows have source_url=NULL (confirmed unsourced estimates).

PA has 4 revenue rows (FY2022-2025, no FY2026) — consistent with its seed data; handled correctly.
All other 45 states have 5 revenue rows each (FY2022-2026).
All 46 states have 3 out-of-window operating rows each (FY2022/2025/2026).

## Script Behavior Verified

- `--dry-run`: prints per-state summary, exits 0, zero writes — CONFIRMED
- Bare run (no --confirm): prints summary, then prints REFUSED message, exits 1 — CONFIRMED
- `--confirm`: live delete path (gated behind confirmation; NOT run in this plan — Plan 07 runs it)

## Security / Policy Checks

- `grep treasury_sync_city_budget scripts/cleanupStateEstimates.mjs` → 1 match (policy comment line only, "NEVER treasury_sync_city_budget")
- `grep data_source_id scripts/cleanupStateEstimates.mjs` → 1 match (policy comment line only, "NEVER write budgets.data_source_id")
- No calls to either forbidden path in executable code.

## COHORT Integrity

- COHORT array: exactly 46 UUIDs (verified by node extraction)
- COHORT_ABBR map: exactly 46 UUIDs (verified by node extraction)
- MN/OH/VA/GA: NOT present (excluded by construction — those states hold real sourced actuals)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The script is not run live in this plan; live execution is Plan 07. The dry-run summary is the deliverable.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The script performs targeted DELETEs only against treasury.budgets, scoped to the hardcoded COHORT list. T-96-04 (data loss from wrong municipality_id list) mitigated: COHORT is the exact 46-ID list from RESEARCH; dry-run + --confirm gate; per-state audit before any write.

## Self-Check: PASSED

- [x] scripts/cleanupStateEstimates.mjs exists (385 lines)
- [x] Commit e6bbaa2 verified in git log
- [x] COHORT = 46 UUIDs, MN/OH/VA/GA absent
- [x] Dry-run exits 0, prints 367-row summary, no writes
- [x] Bare run refuses to delete (exits 1)
- [x] No treasury_sync_city_budget or data_source_id in executable code
