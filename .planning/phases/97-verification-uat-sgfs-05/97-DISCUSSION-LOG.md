# Phase 97: Verification + UAT (SGFS-05) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 97-verification-uat-sgfs-05
**Areas discussed:** Spot-reconciliation sample, Live-app UAT walkthrough, Operating-only revenue presentation, In-phase fix policy

---

## Spot-reconciliation sample

| Option | Description | Selected |
|--------|-------------|----------|
| Representative 7 | 3 ACFR (MN, OH, VA) + GA pilot + 1 multi-FY NASBO + 1 negative-category (CO Transportation) + 1 large random NASBO (CA/TX). Hits every source path + edge case once. | ✓ |
| Lean 4 | MN + OH + one NASBO + CO (negative-category). Faster; lighter coverage. | |
| Heavy ~10 | Representative 7 plus 3 more random NASBO states for broader confidence. | |

**User's choice:** Representative 7
**Notes:** Covers every source path (ACFR + NASBO) and both NASBO edge cases (multi-FY window, negative-category clamp). Captured as D-97-01.

---

## Live-app UAT walkthrough

| Option | Description | Selected |
|--------|-------------|----------|
| MN + 1 NASBO + GA | MN (icicle + real revenue), one operating-only NASBO state, GA. Verify source chip, basis label, per-capita, clean operating-only view. | ✓ |
| MN + OH + VA + 1 NASBO | Emphasize the 3 ACFR states + one NASBO. | |
| I'll pick live | Agent presents full checklist; Chris navigates freely. | |

**User's choice:** MN + 1 NASBO + GA
**Notes:** Captured as D-97-02. Per-node checks: source chip resolves, basis label honest, per-capita renders, no empty/broken view.

---

## Operating-only revenue presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Verify clean, fix if broken | Audit confirms operating-only nodes render with no empty/broken revenue view; suppress in-phase if broken. MN/OH/VA keep revenue. | ✓ |
| Audit-only, defer any fix | Flag if broken; fix becomes follow-up phase. | |
| Add 'revenue pending ACFR' note | Show explicit sourced placeholder on operating-only nodes. | |

**User's choice:** Verify clean, fix if broken
**Notes:** Captured as D-97-03 — applies the "never display unsourced/empty data" ground rule to the post-Phase-96-deletion state.

---

## In-phase fix policy

| Option | Description | Selected |
|--------|-------------|----------|
| Small approved fixes allowed | Read-only audit, but small reproducible + idempotent fixes allowed for what the audit surfaces, each Chris-approved at a checkpoint. Mirrors Phase 93. | ✓ |
| Pure read-only | Audit only; any fix becomes a separate follow-up phase. | |

**User's choice:** Small approved fixes allowed
**Notes:** Captured as D-97-04. Each fix presented + approved at a checkpoint, then re-verified.

---

## Claude's Discretion

- Plan structure / how the audit, recon, and UAT split across plans (Phase 93 used 3).
- The exact negative-category and large-random NASBO states in the sample (confirm from `96-07-LOAD-LOG.md`).
- Exact basis-label strings and probe SQL.

## Deferred Ideas

- Cohort revenue-by-source (future per-state ACFR upgrades).
- Per-state ACFR operating upgrades for high-traffic states.
- MN FY1997–2007 (Phase 95 deferral).
- Milestone retrospective + archive (`/gsd-complete-milestone` after Phase 97 closes).
