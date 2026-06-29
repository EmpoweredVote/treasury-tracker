---
phase: 97-verification-uat-sgfs-05
plan: "01"
subsystem: state-gf-verification
tags: [reconciliation, nasbo, acfr, source-chain, read-only]
dependency_graph:
  requires: []
  provides: [recon-7-states, finding-F-97-01-ga-medicaid]
  affects: []
tech_stack:
  added: []
  patterns: [independent-source-rederivation, pdftotext-table, general-fund-column]
key_files:
  created:
    - .planning/phases/97-verification-uat-sgfs-05/97-01-RECON.md
decisions:
  - "MN FY2023 reconciled from local state-2023-acfr.pdf; OH/VA FY2024 fetched at runtime (Chris decision); OH archives host needs curl --insecure --tlsv1.2"
  - "GA negative-category slot resolved as CO proxy + cohort probe (Chris 2026-06-29); CO Transportation $1M edge confirmed exact"
  - "Finding F-97-01: GA FY2023 Medicaid stored 3,398 vs SER 3,390 (+$8M) → depth-1 children exceed depth-0 parent by $8M; routed to Plan 97-02 D-97-04 fix checkpoint"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 97 Plan 01: Spot-Reconciliation (SGFS-05) Summary

Independently re-derived the "Representative 7" sample (MN/OH/VA from ACFR; GA/TX/CO/CA from the 2025 NASBO SER) straight from the source documents — not loader self-report — and reconciled against the stored production DB. Read-only.

## Tasks Completed

| Task | Name | Result |
|------|------|--------|
| 1 | MN/OH/VA ACFR reconciliation (op+rev) | All 6 totals tie $0 (exact); sampled categories exact |
| 2 | GA/TX/CO/CA NASBO reconciliation vs SER | CA/CO/TX exact; GA 6/7 — Medicaid finding F-97-01 |

## What Was Built

`97-01-RECON.md` — full reconciliation record with per-state comparison tables, source citations, and the SGFS-05 spot-reconciliation verdict.

## Verdict: PASS (1 documented finding routed to 97-02)

- **7/7 sample states: dataset totals reconcile to source** (6 ACFR totals tie $0; 4 NASBO depth-0 totals tie SER Table 1 GF control exactly).
- **6/7 states: function-level exact tie.** MN FY2023 op $26,646,765K / rev $33,466,152K; OH FY2024 op $45,119,494K / rev $45,752,716K; VA FY2024 op $31,022,979K / rev $32,875,046K — all exact against ACFR GF columns (GAAP). CA/CO/TX FY2023 all 6 functions + total exact against the SER (budgetary). CO Transportation $1M edge + TX 08-31 FYE confirmed.
- **Finding F-97-01:** Georgia FY2023 Medicaid GF stored **$3,398M** vs SER **$3,390M** (+$8M); the depth-1 children sum to $29,274M, $8M over the depth-0 parent total $29,266M (0.027%). Parent total is correct; the Medicaid child is overstated. Routed to Plan 97-02 D-97-04 fix checkpoint (verify GA FY2024 too — SER FY2024 GA Medicaid GF = 5,318).

## Notes / Deviations

- OH archives host (`archives.obm.ohio.gov`) returns HTTP 000 to default curl; succeeds with `--insecure --tlsv1.2`. Recorded for future runs.
- Re-derivation method confirmed: `pdftotext -table` reads both the NASBO SER multi-column tables and the ACFR governmental-funds statements cleanly; General Fund is the 1st numeric column in the SER (Total is the 5th — trap avoided).

## Self-Check: PASSED
