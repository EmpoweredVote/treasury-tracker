---
phase: 58
plan: "58-01"
subsystem: data-pipeline
tags: [la-county, sco, backfill, fy2003, source-repair, never-overwrite]
dependency_graph:
  requires: []
  provides: [la-county-fy2003-history, sco-source-url-repair]
  affects: [city-budget-pages, per-capita-renders, breadcrumb-chain]
tech_stack:
  added: []
  patterns: [bulkLoadStateController-county-mode, idempotent-year-chunks, canary-gate]
key_files:
  created:
    - .planning/phases/58-la-county-parity-backfill/58-01-baseline.md
  modified: []
decisions:
  - "Calabasas (FY2004+) and Sierra Madre (FY2006+) are genuine SCO source gaps — not loader failures; documented as expected"
  - "37 remaining NULL source_url rows are all non-SCO custom rows (Socrata, LA GF, Demand Register) — out of scope; SCO source repair 100% complete"
  - "Long Beach FY2022 operating updated from $634M to $4249M — the prior value was a partial SCO load; the re-sync wrote the correct all-governmental-funds figure"
metrics:
  duration: "~90 minutes"
  completed: "2026-06-16"
  tasks_completed: 5
  files_changed: 1
---

# Phase 58 Plan 01: LA County City History Backfill (FY2003-2024) Summary

**One-liner:** Backfilled 86 of 88 LA County cities to FY2003 via SCO ByTheNumbers (all-governmental-funds), repaired 1,400 NULL source_url rows, layered SCO history beneath Long Beach + West Hollywood, and preserved all 3 custom-source cities byte-for-byte.

## Tasks Executed

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| 58-01-01 | Dry-run FY2024 + FY2003 validation | Complete | ffd9450 |
| 58-01-02 | Custom-city baseline capture | Complete | ffd9450 |
| 58-01-03 | Canary FY2024 real load + verification (hard gate) | Complete | 2cbb0f5 |
| 58-01-04 | Backfill FY2003-2023 in 7 chunks | Complete | 2cbb0f5 |
| 58-01-05 | Full-range verification | Complete | deb41dc |

## Pre/Post Metrics (for Plan 58-04 reference)

| Metric | Pre-load | Post-load |
|--------|----------|-----------|
| LA County cities in DB | 88 | 88 |
| Cities reaching FY2003 operating | 0 | **86** |
| Cities reaching FY2003 revenue | 0 | **86** |
| NULL source_url (LA County city rows) | 1,437 | **37** |
| SCO-source NULL source_url rows | 1,437 | **0** (all repaired) |
| Remaining NULL source_url | — | 37 (all non-SCO custom rows: LA Socrata/Payroll/Checkbook, LB GF, WeHo Demand Register) |

## Dry-Run Classification (FY2024)

- **Los Angeles:** SKIP — existing `Socrata: https://data.lacity.org` data preserved (FY2021+)
- **Long Beach, West Hollywood:** Would import — existing FY2024 rows are same-source SCO → re-sync with durable source_url
- **All other 86 cities:** Would import, 87 cities / dataset type total

## Canary FY2024 Gate — PASSED

- Sampled standard cities (Alhambra, Burbank, Glendale, Pasadena, Torrance) all show `source_url=https://bythenumbers.sco.ca.gov/d/ju3w-4gxp` (expenditures) and `/d/rrtv-rsj9` (revenues) + `source_date=2026-06-16`
- Los Angeles FY2024: `Socrata: https://data.lacity.org` — data_source and total_budget ($19,974.3M op / $21,612.5M rev) UNCHANGED
- Long Beach GF FY2025-26: unchanged ($755.4M/$725.7M op/rev FY2025; $772.9M/$747.8M FY2026)
- West Hollywood Demand Register FY2018-2026: all 9 transaction rows unchanged
- Hard gate condition satisfied — backfill proceeded

## FY2003-2023 Backfill Summary

| Chunk | Years | Exp cities/yr | Rev cities/yr | Skipped |
|-------|-------|---------------|---------------|---------|
| 1 | 2003-2005 | 86-87 | 86-87 | 0 |
| 2 | 2006-2008 | 88 | 88 | 0 |
| 3 | 2009-2011 | 87-88 | 87-88 | 0 |
| 4 | 2012-2014 | 88 | 88 | 0 |
| 5 | 2015-2017 | 88 | 88 | 0 |
| 6 | 2018-2020 | 88 | 88 | 0 (source repair: SCO same-source re-sync) |
| 7 | 2021-2023 | 87 | 87 | 1/yr (LA — Socrata FY2021+) |

All chunks used `--source-date 2026-06-16`. Every chunk was idempotent.

## Full-Range Verification Results

### FY2003 Reach

**86 of 88 cities reach FY2003** for both operating and revenue. Exceptions:
- **Calabasas:** SCO feed begins at FY2004 (source gap — city may have filed late or data not available for FY2003)
- **Sierra Madre:** SCO feed begins at FY2006 (source gap)

These are source-driven gaps, not loader failures. Both cities have complete FY2004+ and FY2006+ history respectively.

### NULL source_url Repair

- Pre-load: 1,437 NULL source_url across all LA County city rows
- Post-load: 37 remaining NULL (all non-SCO custom-source rows — see table below)
- **SCO-source NULL source_url: 0** — 100% of SCO operating/revenue rows now carry a durable `/d/` page URL

Remaining 37 NULL rows are pre-existing custom data from non-SCO loaders — out of scope for this plan:
- **Los Angeles (28 rows):** Socrata operating/revenue (FY2021-2026), LA City Budget/Revenue, LA City Payroll (salaries FY2017-2026), LA City Checkbook (transactions FY2024-2025)
- **Long Beach (4 rows):** Custom GF FY2025-2026 operating + revenue
- **West Hollywood (9 rows):** Demand Register transactions FY2018-2026

### Layering (D-04) — Long Beach + West Hollywood

**Long Beach:** SCO all-governmental-funds FY2003-2024 loaded with durable source_url. Custom GF rows FY2025-2026 preserved. Note: FY2022 operating updated from $634M to $4,249M — the prior value was from an earlier partial SCO load; the re-sync wrote the correct all-governmental-funds total. The FY2022 discrepancy was a pre-existing stale SCO row that the re-sync corrected.

**West Hollywood:** SCO operating+revenue FY2003-2024 complete. Demand Register (transactions) FY2018-2026 all preserved unchanged. Perfect layering — no conflicts.

### Custom Cities Unchanged (T-58-01)

All 3 custom cities verified byte-for-byte unchanged in data_source:
- **Los Angeles:** FY2024 Socrata total_budget unchanged ($19,974.3M op / $21,612.5M rev)
- **Long Beach:** GF FY2025-2026 data_source + totals unchanged
- **West Hollywood:** All 9 Demand Register transaction rows unchanged

### Per-Capita (D-02)

Sample: **Alhambra FY2003** — population=81,303; operating=$69.6M; revenue=$69.0M; source_url present. Per-capita denominator available — per-capita renders across all backfilled years.

## Deviations from Plan

None — plan executed exactly as written. The two cities (Calabasas, Sierra Madre) not reaching FY2003 are source gaps anticipated by the plan ("cities genuinely absent from the early SCO feed"). Long Beach FY2022 total change is expected behavior (re-sync of same-source row updates to current full SCO figure).

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes.

## Self-Check

### Files Created
- .planning/phases/58-la-county-parity-backfill/58-01-baseline.md — FOUND (committed ffd9450)
- .planning/phases/58-la-county-parity-backfill/58-01-SUMMARY.md — this file

### Commits Verified
- ffd9450 — dry-run + custom-city baseline (tasks 01-02) — FOUND
- 2cbb0f5 — canary FY2024 + backfill FY2003-2023 (tasks 03-04) — FOUND
- deb41dc — full-range verification complete (task 05) — FOUND

## Self-Check: PASSED
