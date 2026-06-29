---
status: passed
phase: 96-remaining-states-sgfs-04
requirements: [SGFS-04]
verified: 2026-06-28
method: inline (no subagents, per feedback_no_research_subagents) — goal-backward via live Supabase DB probes + source cross-check against the NASBO 2025 SER PDF
---

# Phase 96 Verification — Remaining States (SGFS-04)

**Goal:** Remediate the remaining ~46 state-node General Fund OPERATING rows with real NASBO actuals (sourced, basis-labelled, 0-NULL); no unsourced estimate row remains displayed. **Verdict: PASS (operating side; revenue deferral documented).**

Verified goal-backward by probing the live `treasury.budgets` table directly and cross-checking loaded totals against the NASBO 2025 SER PDF — not by trusting executor self-reports. Six batch subagents did the labor under the loader's dual-checksum gate; the orchestrator independently cross-checked each batch against the source PDF (CA, IL, MI, NY, NJ, TX, GA) and re-ran every probe.

## Success Criteria (ROADMAP)

### 1. Each remaining state sourced from real actuals (revenue + spending), or removed if no clean source — PASS (operating; revenue deferred)
- **46 cohort states + Georgia** carry real NASBO operating (spending-by-function) actuals for **FY2023 + FY2024** — 94 operating state-years, all 0-NULL source-stamped to the 2025 SER PDF, GAAP-budgetary-basis labelled.
- Every state-year passed the dual checksum (6-function sum = NASBO Table 1 GF) before load; orchestrator cross-checked sampled GENERAL FUND totals against the raw PDF (e.g. CA 195.189/205.671B, TX 45.367/50.512B, GA 29.266/34.594B) — confirming the GF column (not Total/Federal/FY2025-estimate) was read.
- No state was unsourceable (D-96-04 removal path unused).
- **Revenue-by-source:** deferred per D-96-01 (NASBO has none per-state). The cohort's unsourced revenue rows were **deleted, not replaced** — so the requirement's revenue clause is satisfied as a documented deferral (future ACFR upgrade), not delivered. Recorded in 96-07-LOAD-LOG.md.

### 2. No unsourced estimate state GF rows remain — PASS (cohort, all dataset types displayed)
- Live probe: **0 cohort revenue rows, 0 out-of-window operating rows (FY2022/2025/2026), 0 NULL-provenance operating rows.** Nothing unsourced is displayed for any of the 47 states.
- Georgia included in the cleanup (Chris-approved deviation) so it isn't the lone state still showing unsourced data.
- MN/OH/VA untouched — their real ACFR operating + revenue rows intact (cohort cleanup correctly spared real revenue).

## Requirements Traceability
- **SGFS-04** → Plans 96-01 (loader infra), 96-02 (cleanup script), 96-03/04/05/06 (Batches A–D + GA FY2024), 96-07 (live cleanup + load + verify) → VERIFIED.

## Policy Conformance (P1–P6)
- P1 actuals-only: only NASBO Actual FY2023/FY2024 loaded; estimated FY2025 column never used.
- P2 negative-category: no negative NASBO GF function arose in the cohort (rule present in buildOperatingTree if needed).
- P3 basis label: every row carries "NASBO State Expenditure Report — General Fund (FY<y> actual, budgetary basis)".
- P4 0-NULL + targeted write: post-RPC UPDATE stamps source_url/date/data_source; 0 NULL; never treasury_sync_city_budget; never budgets.data_source_id.
- P5 no fabrication: dual-checksum gate on every state-year; FY2022 left absent rather than estimated.
- P6 idempotency: re-run cleanup = 0 deletes; loader upserts by (muni,fy,dataset) key.

## Deviations (documented, non-blocking)
- **Georgia folded into the cleanup cohort** (cohort 46→47, deletions 367→375) — pre-write probe caught GA's orphaned unsourced revenue + out-of-window operating estimates; Chris approved including it. The FY-IN-(2022,2025,2026) operating predicate preserved GA's real FY2023/FY2024.
- **`pdftotext -table`** read the SER cleanly for all 94 state-years — render-to-image not needed.

## Deferred (out of scope, as planned)
Cohort revenue-by-source (future per-state ACFR upgrades); FY2022 backfill; cohort-wide source-chain audit + UAT (Phase 97 / SGFS-05).
