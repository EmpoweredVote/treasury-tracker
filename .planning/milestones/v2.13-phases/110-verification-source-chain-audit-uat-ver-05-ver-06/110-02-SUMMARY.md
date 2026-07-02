---
phase: 110-verification-source-chain-audit-uat-ver-05-ver-06
plan: 02
status: complete
completed: 2026-07-01
requirements: [VER-05]
key-files:
  created:
    - scripts/verify-phase110-cohort-audit.mjs
    - .planning/phases/110-verification-source-chain-audit-uat-ver-05-ver-06/110-COHORT-AUDIT.md
---

# 110-02 SUMMARY — 50-Node Cohort Source-Chain Audit (VER-05 b+c)

**Verdict: 10/10 invariants PASS, exit 0.** Cohort clean: 19 ACFR states (444 rows) + 31 NASBO
states (62 rows), 0 anomalies. Idempotency 0-change (NJ + MI FY2025 re-runs). 0 unrecorded holes.

## What was built
- `scripts/verify-phase110-cohort-audit.mjs` — the 106 audit extended to the v2.13 cohort:
  10 new WINDOW_BOUNDS, INV-6 ACFR set → 19 states, INV-7 NASBO set → 31 (CO control, GA
  graduated), plus 3 NEW invariants: INV-8 exact per-FY window-integrity (holes encoded from the
  loadlogs; op/rev sets must match exactly), INV-9 MI Sep-30 semantics, INV-10 GA F-97-01
  supersede ($59,893,783,000 at the original key).
- `110-COHORT-AUDIT.md` — per-invariant table, 250-row tranche-2 count confirmation, idempotency
  + WR-05 disposition, hole-verdict reconciliation.

## In-phase fix (anticipated by plan)
First run failed INV-2 with exactly 20 WR-05 residue `data_sources` rows
(`{10 states}-acfr-gf-{op,rev}`, all backing 0 budgets rows — text-stamp provenance makes them
permanently unreferenced). Deleted in one guarded `NOT EXISTS(referencing row)` pass AFTER the
idempotency re-runs (re-runs updated the same rows in place, so one round sufficed — an
improvement over 106's two rounds). Re-run: 10/10 PASS. Display unaffected (INV-1 506/506).

## Deviations from plan
1. Row-count expectations corrected per the post-plan loadlog UPDATEs: MA 19+19 (not 17+17),
   NC 14+14 (not 12+12) — tranche total 250 rows, windows MA FY2003-2025 / NC FY2012-2025.
2. Idempotency reporting difference documented: NJ prints "Loaded 0 rows"; MI's RPC
   update-in-place path prints "Loaded 1" — DB-verified 0 net change (14 rows, 0 dups, totals
   unchanged), matching the 109-05 loadlog's own idempotency record.

## Verification
- `node scripts/verify-phase110-cohort-audit.mjs` → 10/10 PASS, exit 0 (read-only).
- NJ FY2025 re-run "Loaded 0 rows" ×2; MI FY2025 re-run 0 net change (DB-asserted).
- WR-05 residue: 0 remaining; standing code-review debt note recorded (cosmetic, not gating).
