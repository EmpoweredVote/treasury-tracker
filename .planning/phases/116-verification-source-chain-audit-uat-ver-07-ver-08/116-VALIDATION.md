---
phase: 116
slug: verification-source-chain-audit-uat-ver-07-ver-08
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
---

# Phase 116 — Validation Strategy

> Per-phase validation contract. This phase's deliverable IS validation — two hard-gated harnesses + human UAT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — purpose-built verification harnesses (node .mjs) with exit-0/2 gates + human UAT checklist |
| **Config file** | none |
| **Quick run command** | `node scripts/verify-phase116-rederive.mjs` / `node scripts/verify-phase116-cohort-audit.mjs` |
| **Full suite command** | both harnesses exit 0 + UAT anchors recorded PASS |
| **Estimated runtime** | re-derivation ~5–15 min (PDF fetches); cohort audit ~1–2 min (DB reads + idempotency re-runs) |

---

## Sampling Rate

- **After every task commit:** run the harness under construction; confirm the intended gate (exact-0 delta / invariant PASS).
- **After every plan:** re-derivation harness exits 0 (all sampled FYs tie or are documented); cohort audit exits 0 (all invariants pass, 0 residue with no manual re-clean).
- **Before phase complete:** both harnesses exit 0 AND Chris UAT sign-off recorded.
- **Max feedback latency:** ~15 min (dominated by state PDF fetches in re-derivation).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 116-01/T1 | 01 | 1 | VER-07 | T-116-01 | soft-404 guard; no loader/parser import | CLI exit gate | `node scripts/verify-phase116-rederive.mjs` | new | planned |
| 116-01/T2 | 01 | 1 | VER-07 | — | exact-0 or documented delta | doc + rerun | rederivation log complete | new | planned |
| 116-02/T1 | 02 | 1 | VER-07, VER-08 | T-116-02 | read-only invariants | CLI exit gate | `node scripts/verify-phase116-cohort-audit.mjs` | new | planned |
| 116-02/T2 | 02 | 1 | VER-08 | — | LOAD-01: 0 residue no manual re-clean | rerun + requery | idempotency + residue check | new | planned |
| 116-03/T1 | 03 | 2 | VER-08 | — | app renders match DB | manual UAT | production deep-links | new | planned |
| 116-03/T2 | 03 | 2 | VER-08 | — | Chris sign-off | human gate | checklist status: passed | new | planned |

---
*Phase: 116-verification-source-chain-audit-uat-ver-07-ver-08*
