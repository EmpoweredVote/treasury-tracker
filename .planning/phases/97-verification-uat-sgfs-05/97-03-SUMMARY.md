---
phase: 97-verification-uat-sgfs-05
plan: "03"
subsystem: state-gf-verification
tags: [uat, live-app, sign-off, blocking-checkpoint]
dependency_graph:
  requires: [cohort-audit-pass, F-97-01-fixed]
  provides: [chris-uat-signoff, sgfs-05-uat-pass]
  affects: []
tech_stack:
  added: []
  patterns: [blocking-human-uat-checkpoint]
key_files:
  created:
    - .planning/phases/97-verification-uat-sgfs-05/97-UAT-CHECKLIST.md
decisions:
  - "UAT operating-only NASBO slot = California (the recon 'large random' node); MN + GA per D-97-02"
  - "State nodes are 2-level (root→functions); the state-level differentiator is MN op+rev vs NASBO operating-only (Money In disabled) — framed accurately in the checklist"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 97 Plan 03: Live-App UAT (SGFS-05) Summary

Guided live-app UAT across Minnesota (ACFR op+rev), California (operating-only NASBO), and Georgia (NASBO pilot, F-97-01-fixed year), with Chris driving at a blocking checkpoint.

## Tasks Completed

| Task | Name | Result |
|------|------|--------|
| 1 | Pre-flight probe + write 97-UAT-CHECKLIST.md | All 3 nodes confirmed render-ready (data + population + source + basis) |
| 2 | Blocking live-app UAT with Chris sign-off | **21/21 pass; Chris APPROVED 2026-06-29** |

## What Was Verified Live

- **Minnesota:** both Money Out (~$35.1B, 11 functions) and Money In (~$35.5B, 12 sources) enabled and render; GAAP basis label; MN ACFR source chip resolves; per-capita renders. The op+rev differentiator confirmed.
- **California (operating-only):** Money Out (~$205.7B, 6 functions) renders; **"Money In" card greyed/disabled — no empty/broken revenue view** (D-97-03 live confirmation); budgetary basis; 2025 NASBO SER source chip; per-capita renders.
- **Georgia:** Money Out FY2024 ~$34.594B; switched to FY2023 → ~$29.266B with **Medicaid $3.39B** and slices filling the parent cleanly (the F-97-01 fix, live); budgetary basis; NASBO SER source; per-capita renders.

## Verdict: SGFS-05 UAT PASS

Chris drove the live app and signed off (21/21, including the two ⭐ critical rows). The blocking gate is satisfied. This closes Phase 97 and the v2.10 State General Fund Sourcing milestone.

## Self-Check: PASSED
