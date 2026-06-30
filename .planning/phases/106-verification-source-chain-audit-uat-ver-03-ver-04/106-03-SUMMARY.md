---
phase: 106
plan: 106-03
title: Live-app UAT + Chris sign-off (VER-04)
status: complete
requirements: [VER-04]
completed: 2026-06-30
key-files:
  created:
    - .planning/phases/106-verification-source-chain-audit-uat-ver-03-ver-04/106-UAT-CHECKLIST.md
---

# 106-03 Summary — Live-App UAT + Chris Sign-Off (VER-04)

## What was done

Built the 8-anchor live-app UAT checklist (`106-UAT-CHECKLIST.md`) with per-anchor expected
values sourced from `106-REDERIVATION.md` (24/24 exact ties) and `106-COHORT-AUDIT.md` (7/7
invariants), then ran it as a human checkpoint with Chris on the live production app
(treasurytracker.empowered.vote).

## Result

**VER-04 SATISFIED — Chris signed off 2026-06-30, all 8 anchors PASS.**

Anchors exercised (each: revenue-by-source + spending-by-function + basis label + source chip + Money In):
- PA FY2025 + FY2016 (new ACFR node, recent + deep floor)
- IL FY2025 + FY2022 (new ACFR node; FY2022 negative-clamp "net loss — shown at 0")
- NY FY2003 (deep floor, ×millions scaling correct — billions range)
- CA FY2008 (Phase 104 deepening floor)
- FL FY2021 (Phase 104 deepening, negative-clamp)
- GA FY2024 (un-upgraded NASBO control — operating-only, Money In disabled, graceful `dataset=revenue` fallback)

## Deviations / in-phase fixes (D-05)

1. **Checklist deep-links were malformed** (`?state=XX&fy=YYYY`), which App.tsx does not parse —
   unrecognized links fell through to auth routing and redirected authenticated users to their home
   jurisdiction ("teleported to Los Angeles"). Corrected all 8 to the canonical
   `?entity=<slug>&year=<fy>&dataset=<type>` format (verified slugs in DB). Commit `e6e2a2c`.

2. **Two pre-existing data-viz UX issues** surfaced during anchor 3 (IL): adjacent top categories
   rendered near-identical colors (family-grouped palette), and a redundant single synthetic-root
   "…General Fund Budget · 100%" layer that also collapsed children to one color. Fixed in commit
   `deefa15` (reordered `DATA_VIZ_HUES` + added `hoistSingleRoot`). These are presentation, not
   v2.12 data defects — every displayed value verified correct. Ships on next frontend deploy.

The deeper "authenticated users redirected on any unrecognized link" behavior was logged as a
follow-up todo (frontend-routing), not fixed in this data-verification phase.

## Self-Check: PASSED

VER-04 met. Data correctness independently confirmed by 106-01 + 106-02; live human sign-off obtained.
