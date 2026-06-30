---
phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
plan: "103-03"
subsystem: data
tags: [acfr, recon, loader-plan, nasbo-replace, state-gf]
requires:
  - phase: 103-01
    provides: "pilot deepening sources + gap log"
  - phase: 103-02
    provides: "PA + IL source location + four facts + scope + recent-window"
provides:
  - "103-RECON.md — single decision-ready handoff for Phases 104-105 (SOURCES-map extension plan + PA/IL loader mapping + NASBO-replace rule + greenlights/gates + open risks)"
affects: [104-deepen-pilots, 105-pa-il-upgrade, 106-verification]
tech-stack:
  added: []
  patterns: ["reconcile recon targets against the live v2.11 loaders before declaring work — TX FY2016 was already loaded"]
key-files:
  created:
    - .planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-RECON.md
  modified:
    - .planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-DEEPEN-SOURCES.md
key-decisions:
  - "Phase 104 pilot work: NY +12 FYs (FY2003-14), CA +12 FYs (FY2008-19), FL +1 FY (FY2021); TX = 0 (already loaded in v2.11)"
  - "Phase 105: new processPA/processIL loaders on the processTX.js pattern; per-year SOURCES maps; NASBO-replace idempotent never-overwrite; PA+IL recent-window GREENLIT"
  - "PA + IL both carry the accept-relabel gate (scope ~2x / ~1.5x NASBO) for Chris confirmation at load/UAT"
patterns-established:
  - "Master RECON.md consolidates both halves + maps to the 3 phase success criteria + lists open risks as explicit Phase-104/105 gates"
requirements-completed: [RECON-05]
duration: 20min
completed: 2026-06-30
---

# Plan 103-03 Summary — Loader-reuse + NASBO-replace plan + RECON.md assembly

## What was done

Synthesized the two Wave-1 recon halves into `103-RECON.md` — the single decision-ready handoff for Phases 104–105 — and reconciled the recon targets against the live v2.11 loaders.

## Key outputs

- **Pilot SOURCES-map extension plan** (Phase 104): NY add FY2003–2014 (`nyUrl` already emits the right naming; ×1,000,000 units); CA add FY2008–2019 via the new `/Files-ARD/CAFR/cafr{NN}web.pdf` dir; FL add FY2021 (P2 clamp for its negative investment-income line); **TX no change**. Idempotent never-overwrite — existing pilot rows untouched.
- **PA/IL loader mapping** (Phase 105): new `processPA`/`processIL` loaders on the `processTX.js` pattern; explicit per-year SOURCES maps (PA hyphen→space at FY2024; IL final-audited-only variant naming); NASBO-replace rule (delete NASBO state-FY → insert ACFR, one basis, idempotent, other states untouched).
- **Greenlights/gates:** PA + IL recent-window GREENLIT (D-06, no strand); PA + IL accept-relabel scope gate (D-04) for Chris confirmation.

## Reconciliation catch

The RECON-04 "TX FY2016" deepening target was **already resolved + loaded during v2.11** — `processTX.js` already special-cases `…/2016/docs/96-471.pdf` with a transcribed block (FY2015–FY2024 contiguous). Recon's independent re-confirmation corroborated the existing loader; Phase 104 has no TX work. Corrected `103-DEEPEN-SOURCES.md` to reflect this.

## Self-Check: PASSED
- `103-RECON.md` contains all four sections (pilot deepening + SOURCES plan, PA/IL location, loader-reuse + replace plan with greenlights/gates, open risks) ✓
- Maps cleanly to Phase 103's 3 success criteria ✓
- Every Phase-105 decision (scope relabel, recent-window, final-vs-interim) flagged as a confirmation gate, not pre-decided ✓
- No DB writes; no loader edits; $0 spend ✓
