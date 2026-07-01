---
phase: 105-pa-il-acfr-upgrade
plan: "03"
subsystem: state-acfr-loaders
tags: [pa, il, acfr, live-load, operating, revenue, gaap, nasbo-replacement, idempotency, recon-05, acfr-06, acfr-07, acfr-08]
dependency_graph:
  requires:
    - 105-01 (processPAAcfr.js + processPARevenueAcfr.js)
    - 105-02 (processILAcfr.js + processILRevenueAcfr.js)
  provides:
    - treasury.budgets PA: 10 FY operating + 10 FY revenue (FY2016-2025, GAAP-basis, ACFR-sourced)
    - treasury.budgets IL: 5 FY operating + 5 FY revenue (FY2021-2025, GAAP-basis, ACFR-sourced)
    - 105-PA-IL-LOADLOG.md (load disposition, NASBO-replacement, accept-relabel, idempotency, cohort-untouched)
  affects:
    - PA + IL state nodes (treasury.budgets) — NASBO operating replaced in place, revenue net-new
tech_stack:
  added: []
  patterns:
    - treasury_sync_budget_tree RPC live-write (RECON-05 idempotent key)
    - post-RPC source_url/source_date/data_source stamp UPDATE
    - P2 clamp (ACFR-08) confirmed in live budget_categories rows
key_files:
  created:
    - .planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-PA-IL-LOADLOG.md
  modified: []
decisions:
  - "PA operating rows were already present from Wave 1 accidental load (105-01 deviation); Wave 2 re-run confirmed idempotency (Loaded 0 rows for all 10 FY operating)"
  - "IL FY2023/FY2024 NASBO operating rows replaced in place via RPC keyed (muni, fy, 'operating') — confirmed 0 NASBO labels remaining"
  - "P2 clamp for IL FY2022 revenue confirmed in live treasury.budget_categories: amount=0, label includes 'net loss — shown at 0', root total 73,204,339,000 carries signed net"
  - "Accept-and-relabel divergence (PA ~2.0×, IL ~1.5× NASBO) recorded against pre-load NASBO totals in LOADLOG — D-04 confirmed"
metrics:
  duration: "~13 minutes"
  completed: "2026-06-30T19:32:00Z"
  tasks: 3
  files: 1
---

# Phase 105 Plan 03: PA + IL ACFR Live-Load (Wave 2) Summary

One-liner: PA + IL ACFR data live-loaded into treasury.budgets — 30 rows total (PA 10 op + 10 rev FY2016-25; IL 5 op + 5 rev FY2021-25) — NASBO replaced in place, P2 clamp confirmed live, idempotency proven, cohort untouched.

## What Was Built

### PA Live Load (Task 1)

**PA operating (processPAAcfr.js):** Wave 1 accidental early load already wrote all 10 FY. Wave 2 re-ran the full script and confirmed "Loaded 0 rows" for every FY (idempotent update-in-place). NASBO FY2023/FY2024 rows were replaced in Wave 1. DB verification: 10 operating rows, all GAAP-basis-labelled, all source_url SET.

**PA revenue (processPARevenueAcfr.js):** Net-new in Wave 2. All 10 FY (2016-2025) loaded successfully. All validations PASS. FY2023 = 95,231,042,000 / FY2024 = 91,293,027,000 (bookend confirmed).

### IL Live Load (Task 2)

**IL operating (processILAcfr.js):** All 5 FY (2021-2025) loaded live. FY2021/2022 net-new; FY2023/FY2024 replaced NASBO rows in place; FY2025 net-new. All validations PASS, source stamped. Zero NASBO labels remain on IL node.

**IL revenue (processILRevenueAcfr.js):** All 5 FY (2021-2025) loaded live. FY2022 P2 clamp fired — "Interest and other investment income" = -197,857K stored as 0 in `budget_categories` with label "Interest and other investment income (net loss — shown at 0)"; root total 73,204,339,000 carries the signed net.

### DB Verification + Idempotency (Task 3)

**Idempotency:** Second live run of PA FY2024 (operating + revenue) and IL FY2025 (operating + revenue) each returned "Loaded 0 rows" — confirmed 0 net change.

**DB verification:** All acceptance criteria passed (see Load Disposition table below).

**LOADLOG created:** `105-PA-IL-LOADLOG.md` with per-state load disposition, NASBO-replacement confirmation, accept-relabel divergence record, P2 clamp confirmation, idempotency result, and cohort-untouched verification.

## Loaded FY Summary

### Pennsylvania

| FY | Operating ($) | Revenue ($) | Status |
|----|--------------|-------------|--------|
| 2016 | 56,135,869,000 | 56,741,506,000 | PASS |
| 2017 | 61,606,897,000 | 60,738,926,000 | PASS |
| 2018 | 61,607,586,000 | 61,695,790,000 | PASS |
| 2019 | 65,677,284,000 | 65,803,730,000 | PASS |
| 2020 | 71,839,247,000 | 70,717,513,000 | PASS |
| 2021 | 76,524,883,000 | 81,825,525,000 | PASS |
| 2022 | 87,003,182,000 | 98,210,961,000 | PASS |
| 2023 | 89,473,087,000 | 95,231,042,000 | PASS |
| 2024 | 89,446,895,000 | 91,293,027,000 | PASS |
| 2025 | 94,758,255,000 | 92,414,817,000 | PASS |

### Illinois

| FY | Operating ($) | Revenue ($) | Notes |
|----|--------------|-------------|-------|
| 2021 | 59,523,406,000 | 63,136,008,000 | PASS |
| 2022 | 62,089,769,000 | 73,204,339,000 | PASS — P2 clamp fired (interest -197,857K → 0) |
| 2023 | 68,661,594,000 | 73,827,795,000 | PASS — NASBO op replaced |
| 2024 | 71,610,582,000 | 74,749,262,000 | PASS — NASBO op replaced |
| 2025 | 75,456,922,000 | 78,342,927,000 | PASS |

## Key Verification Results

### RECON-05: NASBO Replaced In Place

- PA: 0 NASBO labels remain (FY2023 + FY2024 replaced in Wave 1). Exactly 1 operating row per (PA, FY).
- IL: 0 NASBO labels remain (FY2023 was $43.693B / FY2024 was $48.563B, both replaced by ACFR GAAP rows). Exactly 1 operating row per (IL, FY).

### D-04: Accept-and-Relabel Divergence

| State | NASBO GF FY2023 | ACFR GF FY2023 | Ratio | Mechanism |
|-------|----------------|----------------|-------|-----------|
| PA | ~$40.8B | $89.5B | ~2.19× | Federal/intergovernmental ~$46.2B inside GAAP GF |
| IL | $43.7B | $68.7B | ~1.57× | Federal revenue ~$22.1B inside GAAP GF |

Both nodes labelled with GAAP basis: `"…General Fund (FY{fy} actual, GAAP basis)"` / `"…General Fund Revenue (FY{fy} actual, GAAP basis)"`.

### ACFR-08: P2 Clamp

IL FY2022 revenue "Interest and other investment income" = -197,857K → stored as 0 in `budget_categories` with label "(net loss — shown at 0)". Root total 73,204,339,000 carries the signed net. Confirmed live in DB.

PA: No negative revenue categories across FY2016-2025 (all investment income positive). Clamp path wired but not triggered.

### Idempotency (Never-Overwrite)

All four representative re-runs returned "Loaded 0 rows":
- PA FY2024 operating + revenue: "Loaded 0 rows"
- IL FY2025 operating + revenue: "Loaded 0 rows"

### Money In Auto-Enable

- PA: 10 revenue rows in treasury.budgets — Money In auto-enabled data-drivenly
- IL: 5 revenue rows in treasury.budgets — Money In auto-enabled data-drivenly

### Cohort Untouched

| State | Rows | Sample Label | Status |
|-------|------|-------------|--------|
| CA (ACFR) | 36 (18 op + 18 rev) | "California State ACFR…" | UNCHANGED |
| TX (ACFR) | 20 (10 op + 10 rev) | "Texas State ACFR…" | UNCHANGED |
| NY (ACFR) | 44 total | "New York State ACFR…" | UNCHANGED |
| FL (ACFR) | 8 total | "Florida State ACFR…" | UNCHANGED |
| GA (NASBO) | 2 | "NASBO State Expenditure Report…" | UNCHANGED |
| OH (prior ACFR) | 12 state rows | "State of Ohio ACFR…" | UNCHANGED |

## Deviations from Plan

### Pre-existing: PA Operating Already Loaded (Wave 1 Accidental Early Load)

**Context from 105-01-SUMMARY:** The PA operating loader (processPAAcfr.js) accidentally ran live in Wave 1 during acceptance-criteria checking. All 10 FY were written to the DB with GAAP labels + source stamps.

**Impact on Wave 2:** Task 1 ran processPAAcfr.js again (full idempotent re-run), confirmed "Loaded 0 rows" for all 10 FY, source stamps re-applied with identical values. No data corruption; no citizen-facing error. PA revenue (processPARevenueAcfr.js) ran for the first time in Wave 2 as planned.

**This is a pre-existing deviation documented in 105-01-SUMMARY.md.** No new deviations in this plan.

## Known Stubs

None. All rows are wired to real ACFR data, GAAP-basis-labelled, and per-year-sourced.

## Threat Flags

None. PA and IL writes are scoped to their respective state nodes only. The STRIDE register mitigations are all confirmed:
- T-105-03-A: No duplicate operating rows — exactly 1 per (state, FY); 0 NASBO labels remaining
- T-105-03-B: Cohort spot-check confirms CA/TX/NY/FL/GA/OH unchanged
- T-105-03-C: All loaded rows have non-null source_url + source_date + GAAP-basis data_source
- T-105-03-D: IL FY2022 P2 clamp confirmed live (amount=0 in budget_categories, root total carries net)
- T-105-03-E: Accept-relabel divergence recorded in LOADLOG with pre-load NASBO totals vs loaded ACFR totals
- T-105-03-F: Only FYs in the tied windows loaded; honest-hole check: 0 IL rows outside 2021-2025

## Self-Check

### Created Files
- .planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-PA-IL-LOADLOG.md: FOUND
- .planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-03-SUMMARY.md: this file

### Commits
- 943777e: chore(105-03): live-load PA + IL ACFR data + load disposition log

### DB Verification
- PA: 10 operating + 10 revenue rows — CONFIRMED
- IL: 5 operating + 5 revenue rows — CONFIRMED
- PA FY2024 revenue: 91,293,027,000 — CONFIRMED
- PA FY2023 revenue: 95,231,042,000 — CONFIRMED
- IL FY2025 revenue: 78,342,927,000 — CONFIRMED
- IL FY2023 revenue: 73,827,795,000 — CONFIRMED
- IL FY2022 P2 clamp in budget_categories: CONFIRMED
- 0 NASBO labels on PA + IL: CONFIRMED
- Cohort untouched (CA/TX/NY/FL/GA/OH): CONFIRMED

## Self-Check: PASSED
