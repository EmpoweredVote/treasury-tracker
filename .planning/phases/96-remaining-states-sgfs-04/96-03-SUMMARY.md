---
phase: 96-remaining-states-sgfs-04
plan: "03"
subsystem: data-loader
tags: [nasbo, state-gf, batch-a, dry-run-only]
dependency_graph:
  requires: ["96-01"]
  provides: ["STATES Batch-A 12 states × 2 FYs in loadStateGF.mjs"]
  affects: ["scripts/loadStateGF.mjs"]
tech_stack:
  added: []
  patterns: ["NASBO 2025 SER 6-function taxonomy", "pdftotext -table extraction", "validateAgainstControl dual checksum"]
key_files:
  modified:
    - path: "scripts/loadStateGF.mjs"
      role: "Added 12 Batch-A state STATES entries (24 state-years, 6-function, dual-checksum verified)"
decisions:
  - "CO Transportation=$1M (not $0) — NASBO Table 21 explicitly shows $1M GF for both FY2023 and FY2024"
  - "CA FY2024 sum=$205,670M vs control $205,671M — $1M rounding diff (0.000%), within 0.5% tolerance, PASS"
metrics:
  duration: "~45 min"
  completed: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 96 Plan 03: Batch-A State Data Entry (AK AL AR AZ CA CO CT DE FL HI IA ID) Summary

NASBO 2025 SER General Fund spending-by-function actuals (FY2023 + FY2024) transcribed for 12 Batch-A states into STATES object with 6-function taxonomy; all 24 state-years pass dual checksum (0.000% diff or $1M rounding).

## What Was Built

Populated `scripts/loadStateGF.mjs` STATES object with 12 Batch-A states × 2 fiscal years = 24 state-year data entries. Each entry follows the 2025 SER 6-function taxonomy (Elementary & Secondary Education, Higher Education, Medicaid, Corrections, Transportation, All Other) with no Public Assistance line. All figures extracted from NASBO 2025 SER via `pdftotext -table` and dual-checksummed against Table 1 GF control totals.

## Per-State Checksum Results

| State | FY2023 Control ($M) | FY2023 Diff | FY2024 Control ($M) | FY2024 Diff | Result |
|-------|-------------------|-------------|-------------------|-------------|--------|
| AK | 7,450 | $0 (0.000%) | 6,339 | $0 (0.000%) | PASS |
| AL | 13,764 | $0 (0.000%) | 13,511 | $0 (0.000%) | PASS |
| AR | 5,924 | $0 (0.000%) | 6,075 | $0 (0.000%) | PASS |
| AZ | 16,001 | $0 (0.000%) | 17,903 | $0 (0.000%) | PASS |
| CA | 195,189 | $0 (0.000%) | 205,671 | $1M (0.000%) | PASS |
| CO | 13,647 | $0 (0.000%) | 14,513 | $0 (0.000%) | PASS |
| CT | 22,199 | $0 (0.000%) | 22,779 | $0 (0.000%) | PASS |
| DE | 5,861 | $0 (0.000%) | 6,232 | $0 (0.000%) | PASS |
| FL | 44,219 | $0 (0.000%) | 51,649 | $0 (0.000%) | PASS |
| HI | 10,757 | $0 (0.000%) | 11,222 | $0 (0.000%) | PASS |
| IA | 8,216 | $0 (0.000%) | 8,560 | $0 (0.000%) | PASS |
| ID | 4,548 | $0 (0.000%) | 5,020 | $0 (0.000%) | PASS |

**Total: 24/24 state-years tie:PASS**

## Taxonomy Verification

- No "Public Assistance" category in any Batch-A entry (2025 SER PA merged into All Other per NASBO 2025 SER p.490)
- No FY2025 key in any state's `operating` object
- 6 named functions for all entries: Elementary & Secondary Education, Higher Education, Medicaid, Corrections, Transportation, All Other
- States with $0 Transportation (zero dropped from display by buildOperatingTree): AL, AR, CT, HI, IA, ID (4 others have non-zero)

## Test Results

`node --test scripts/loadStateGF.test.mjs` → 14/14 PASS (no regressions)

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | 7cf3367 | feat(96-03): add Batch-A states AK AL AR AZ CA CO to STATES (2025 SER, 6-function) |
| Task 2 | 2731724 | feat(96-03): add Batch-A states CT DE FL HI IA ID + full sweep 24/24 PASS |

## Deviations from Plan

None — plan executed exactly as written. Alabama's pre-verified figures matched the RESEARCH exactly (used directly). All 12 states extracted cleanly from pdftotext -table; no re-reads required.

**Noted: CO Transportation = $1,000,000 (not zero).** NASBO Table 21 explicitly shows $1M GF for both FY2023 and FY2024 for Colorado. This is a legitimate figure (not a read error); the checksum closes at exactly $0 diff with this value.

**CA FY2024 rounding:** Function sum = $205,670M vs Table 1 control $205,671M — $1M diff (0.000%), within 0.5% tolerance. PASS. Source of rounding is the per-function table values being rounded to the nearest million.

## Known Stubs

None. This plan is data-only (STATES object population). No UI wiring, no DB writes.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. All data sourced from pre-downloaded NASBO 2025 SER PDF (verified provenance).

## Self-Check: PASSED

- scripts/loadStateGF.mjs: FOUND
- 96-03-SUMMARY.md: FOUND
- Commit 7cf3367: FOUND
- Commit 2731724: FOUND
- 24/24 dry-run PASS: VERIFIED (all tie lines in output above)
- 14/14 tests green: VERIFIED
