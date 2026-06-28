---
phase: 96
slug: remaining-states-sgfs-04
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during a 46-state NASBO bulk load.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | NASBO dual-checksum (in `loadStateGF.mjs`) + DB probes (supabase-local execute_sql) |
| **Config file** | none — checksum embedded in loader |
| **Quick run command** | `node scripts/loadStateGF.mjs --state <ST> --fy <FY> --dry-run` (dual-checksum, no write) |
| **Full suite command** | per-batch dry-run sweep, then DB probe of `treasury.budgets` for the cohort |
| **Estimated runtime** | ~5–15s per state-year dry-run |

---

## Sampling Rate

- **After every state-year added to STATES:** dry-run that state-year (dual checksum must pass)
- **After every batch (~10–15 states):** full dry-run sweep of the batch + DB probe (0-NULL, no estimate rows)
- **Before `/gsd:verify-work`:** every cohort state-year validates; cohort DB probe clean
- **Max feedback latency:** ~15s per state-year

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 96-01-T1/T2 | 01 | 0 | SGFS-04 | 2025-SER provenance, FY-ends, 6-function taxonomy | unit | `node --test scripts/loadStateGF.test.mjs` | ⬜ pending |
| 96-02-T1 | 02 | 0 | SGFS-04 | targeted DELETE of unsourced revenue + out-of-window operating; never sync_city_budget | smoke (dry-run) | `node scripts/cleanupStateEstimates.mjs --dry-run` | ⬜ pending |
| 96-03-T1/T2 | 03 | 1 | SGFS-04 | Batch A (12 states) actuals-only, dual-checksum PASS | checksum | `node scripts/loadStateGF.mjs --state <ST> --dry-run` | ⬜ pending |
| 96-04-T1/T2 | 04 | 2 | SGFS-04 | Batch B (12 states) + MI Sep-30 | checksum | `node scripts/loadStateGF.mjs --state <ST> --dry-run` | ⬜ pending |
| 96-05-T1/T2 | 05 | 3 | SGFS-04 | Batch C (12 states) + NY Mar-31 | checksum | `node scripts/loadStateGF.mjs --state <ST> --dry-run` | ⬜ pending |
| 96-06-T1/T2 | 06 | 4 | SGFS-04 | Batch D (10 states) + GA FY2024 + TX Aug-31; full 94-yr dry-run | checksum | `node scripts/loadStateGF.mjs --dry-run` | ⬜ pending |
| 96-07-T1/T2 | 07 | 5 | SGFS-04 | live cleanup + load; 0-NULL, 0 revenue rows, FY-ends correct | DB probe | execute_sql probes on treasury.budgets | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Validation Architecture (dual-checksum per state-year — the core gate)

From 96-RESEARCH.md. EVERY cohort state-year MUST pass BOTH before live load:
1. **Row checksum:** General Fund + Federal + Other State Funds + Bonds = the NASBO Total row for that state-year (proves the GF column was read correctly, not a neighbor column).
2. **Function-sum checksum:** the 6-function sum (2025 SER: Elementary & Secondary Education, Higher Education, Medicaid, Corrections, Transportation, All Other — Public Assistance folded into All Other) = NASBO Table 1 General Fund total for that state-year, within the Phase-94 tolerance.

A state-year that fails either checksum is NOT loaded — re-read the NASBO table (try `pdftotext -table`; image fallback only if needed) or document the state as unsourceable (D-96-04), never load an unvalidated figure (P5).

---

## Wave 0 Requirements

- [ ] `scripts/cleanupStateEstimates.mjs` (NEW) — deletes the cohort's displayed unsourced revenue estimate rows (D-96-03 / ground rule) AND the FY2025/FY2026 operating estimate rows that the NASBO actual-year load will not overwrite. Dry-run first; per-state keep-window = the NASBO actual years loaded (FY2023–FY2024).
- [ ] Confirm `loadStateGF.mjs` dual-checksum helpers handle the 6-function (PA-merged) 2025 SER taxonomy.

*Wave 0 must complete before/with the load so no unsourced row is ever displayed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Non-June-30 FY-end states | SGFS-04 | AL/MI=Sep-30, TX=Aug-31, NY=Mar-31 — source_date must match the state's actual fiscal-year-end, not a blanket 06-30 | Verify source_date per these 4 states after load |
| "Money In" tab shows nothing unsourced | SGFS-04 / ground rule | Visual app check | Open a cohort state node post-cleanup; confirm no unsourced revenue icicle/summary renders |

---

## Validation Sign-Off

- [ ] Every cohort state-year passes the dual checksum before load
- [ ] No 3 consecutive state-years loaded without a dry-run checkpoint
- [ ] Wave 0 cleanup removes all displayed unsourced cohort rows
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
