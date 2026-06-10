---
phase: 39-ma-population-state-budget-and-enrichment
plan: "02"
subsystem: data-load
tags: [ma-state-budget, processMA, state-entity, enacted-figures, loadMaGFExcel]
dependency_graph:
  requires: [38-02]
  provides: [STATE-01]
  affects: [treasury.budgets, treasury.data_sources]
tech_stack:
  added: []
  patterns: [hardcoded-but-real state budget loader, RPC upsert via treasury_sync_budget_tree]
key_files:
  modified:
    - scripts/processMA.js
  created:
    - scripts/loadMaGFExcel.js (committed from untracked to tracked)
decisions:
  - "Used Interpretation A for STATE-01: update processMA.js constants with real GAA enacted totals from mass.gov/lists/budget-archives rather than aggregating city-level DLS data"
  - "FY2026 kept as estimated (Governor recommendation only; no signed GAA as of June 2026)"
  - "loadMaGFExcel.js committed unchanged — no code modifications needed, just git tracking"
metrics:
  duration_minutes: 18
  completed: "2026-06-10T22:10:47Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 1
---

# Phase 39 Plan 02: MA State Budget Real Figures (STATE-01) Summary

Upgraded the Massachusetts state government budget entity from hardcoded round-number estimates to real enacted General Appropriations Act (GAA) figures sourced from mass.gov/lists/budget-archives (FY2022-FY2025), and committed the untracked `loadMaGFExcel.js` helper to git.

## What Was Built

**Task 1 — Updated processMA.js with real enacted figures:**

The prior `EXPENDITURES` constants used round-number estimates (e.g., FY2025 = $36B). Updated all four upgradeable years with real GAA enacted totals from the MA budget archives:

| FY | Prior (Estimated) | Real (Enacted) | Per-Capita | Change |
|----|------------------|----------------|------------|--------|
| 2022 | $33.0B | $47.6B | $6,771/person | +$14.6B |
| 2023 | $36.0B | $49.7B | $7,070/person | +$13.7B |
| 2024 | $34.5B | $56.2B | $7,994/person | +$21.7B |
| 2025 | $36.0B | $57.8B | $8,222/person | +$21.8B |
| 2026 | $37.5B | (kept as estimated) | $5,334/person | unchanged |

All per-capita figures fall within the validation range of $5,000-$8,500/person. FY2026 is kept as estimated because the signed GAA was not yet available as of June 2026.

Category proportions derived from MA EAOF historical spending breakdowns (HHS ~47%, Education ~22%, Local Aid ~11%, Debt ~5%, General Government ~4%, Corrections ~3%, Other ~8%). All category sums validate within tolerances (line items within $1M, category sum within $10M of total).

**Task 2 — Live reload and git tracking:**

- Ran `node scripts/processMA.js` (no --dry-run): all 5 FY loads completed with no RPC errors
- DB verified: MA state entity FY2025 `total_budget = 57,800,000,000` (confirmed via supabase-js query)
- CA state entity untouched (regression confirmed: CA FY2026 = $228.4B)
- `scripts/loadMaGFExcel.js` copied from main repo and committed as a tracked file (no code changes)

## Verification

- `node scripts/processMA.js --dry-run` printed "FY{year} validation: PASS" for all 5 years
- Live run loaded 16 rows per fiscal year (7 categories × 2-3 line items each + root) without error
- DB query: `treasury.budgets WHERE municipality_id='fd6b008f...' AND fiscal_year=2025 AND dataset_type='operating'` returns `total_budget=57800000000`
- No occurrence of `confidence: 'estimated'` for FY2022-2025 in processMA.js
- `scripts/loadMaGFExcel.js` shows as tracked in git (commit `60c0b79`)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `4bb541a` | feat(39-02): update processMA.js with real MA GAA enacted figures FY2022-2025 |
| Task 2 | `60c0b79` | chore(39-02): commit loadMaGFExcel.js to git as tracked file |

## Deviations from Plan

None — plan executed exactly as written.

The plan mentioned "FY2021" in the action text but the script only covered FY2022-2026. No FY2021 data existed in processMA.js so no FY2021 update was needed. This was not a deviation since the must-haves specified "each FY carries a confidence value" for the years being upgraded.

## Known Stubs

None — no stubs or placeholders introduced. FY2026 remains `confidence: 'estimated'` intentionally per the plan instruction ("keep FY2026 as-is").

## Threat Flags

None — no new API endpoints, auth paths, or attack surface introduced. Script is a CLI data loader using existing service-role key patterns.

## Self-Check: PASSED

- FOUND: scripts/processMA.js
- FOUND: scripts/loadMaGFExcel.js
- FOUND: 39-02-SUMMARY.md
- FOUND commit 4bb541a (processMA.js real figures)
- FOUND commit 60c0b79 (loadMaGFExcel.js tracked)
- FY2022-2025 confidence = 'enacted'; FY2026 confidence = 'estimated'
- DB FY2025 total_budget = 57,800,000,000 (verified via supabase-js)
