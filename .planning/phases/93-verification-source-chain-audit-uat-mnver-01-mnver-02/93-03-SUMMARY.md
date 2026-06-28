---
phase: 93-verification-source-chain-audit-uat-mnver-01-mnver-02
plan: 03
status: complete
completed: 2026-06-27
requirements: [MNVER-02]
---

# 93-03 Summary — Live-App UAT (MNVER-02)

## Result — PASS (Chris signed off all-pass, 2026-06-27)
17/17 UAT items passed on the live app (treasurytracker.empowered.vote). Record in `93-UAT-CHECKLIST.md`.

- **Minneapolis (city, FY2023):** breadcrumb US→Minnesota→Hennepin County→Minneapolis; Money Out/In icicles (~$1.19B) with working 2-level drill-down (the MN differentiator); Phase-92 enrichment; per-capita; osa.state.mn.us source chip.
- **Hennepin County (county, FY2021):** county node + Cities-in-County panel (lists Minneapolis); Money Out **$1.8B** / Money In **$1.9B** (stored $1,834,835,822 / $1,851,255,583 — confirmed correct vs FY2021 ACFR); drill-down; per-capita.
- **Minnesota state node (FY2023–2025):** General Fund revenue (FY2025 ≈ $35.5B, Individual Income Taxes largest) + spending (≈ $35.1B, HHS + General Education largest); year switch; **State of Minnesota ACFR source chip** (confirms the placeholder→real-data fix).

## Pre-flight
Confirmed render-ready: Minneapolis (pop 433,633, linked to Hennepin), Hennepin County (pop 1,289,645, includes Minneapolis), MN state node (FY2023–2025, sourced).

## Self-Check: PASSED
- Chris drove the live app; all 17 items pass; explicit all-pass sign-off recorded (blocking gate satisfied).
- Item 11 figures confirmed correct against the ACFR.
- MNVER-02 satisfied. Phase 93 complete → v2.9 Minnesota milestone ready to close.
