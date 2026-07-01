# Requirements: v2.13 State ACFR Long Tail — Tranche 2

**Defined:** 2026-07-01
**Core Value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.

**Milestone scope:** Continue the proven State-ACFR GAAP upgrade (v2.11 CA/TX/NY/FL → v2.12 PA/IL) by bringing the **next ~8–10 largest-General-Fund NASBO states** onto full ACFR GF revenue-by-source + finer spending-by-function, each as deep as durable ACFR URLs allow. Candidate roster (largest GF first): **NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI** — recon locks the exact list and may substitute ≤2 states whose ACFR won't cleanly `pdftotext -table`-extract, deferring them to the next tranche. NASBO operating replaced in place idempotently; un-upgraded states stay on NASBO. Same loader pattern, basis-labelled, $0. No frontend work — the data-driven "Money In" view + `?dataset=revenue` deep-link (shipped v2.11) auto-enable revenue once each state's data lands. Cohort goes from 9 ACFR nodes → ~19.

## v1 Requirements

### Recon & Data Integrity

- [x] **RECON-06**: Recon locates, for each candidate state, the ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GENERAL FUND column, units, durable per-year URLs, cleanly `pdftotext -table`-extractable FY depth), tie-confirms each window's bookend totals, **locks the final ~8–10-state roster** (substituting ≤2 that won't extract), and writes a per-state gap log for years that don't cleanly extract.
- [x] **RECON-07**: Recon resolves prior-load overlaps before any write — in particular **Massachusetts**, which already has a v1.8 DLS state budget node: the ACFR upgrade replaces it **in place** (no duplicate/conflicting MA node), following the Phase 98 CA-v1.7 precedent. Any other state with a pre-existing custom-source node is identified and upgraded in place.
- [ ] **RECON-08**: Each upgraded state's ACFR rows **replace** its NASBO operating rows (one basis per state-FY) idempotently and never-overwriting; un-upgraded NASBO states remain unchanged on `scripts/loadStateGF.mjs`; the existing 9 ACFR nodes (MN/OH/VA/CA/TX/NY/FL/PA/IL) are not disturbed.

### State ACFR Upgrades (the tranche)

*One requirement per candidate state — recon (RECON-06) may substitute ≤2. Each: "User can see {STATE}'s GF revenue-by-source and GAAP spending-by-function on the {STATE} state node, ACFR-sourced, GAAP basis-labelled, NASBO operating replaced idempotently, as deep as the ACFR cleanly extracts."*

- [ ] **ACFR-09**: New Jersey
- [ ] **ACFR-10**: Massachusetts *(in-place upgrade of the v1.8 DLS node — RECON-07)*
- [ ] **ACFR-11**: North Carolina
- [ ] **ACFR-12**: Georgia *(currently the one non-cohort NASBO state; already carries a v2.10 F-97-01 Medicaid fix — verify the ACFR replace supersedes cleanly)*
- [ ] **ACFR-13**: Maryland
- [ ] **ACFR-14**: Tennessee
- [ ] **ACFR-15**: Connecticut
- [ ] **ACFR-16**: Wisconsin
- [ ] **ACFR-17**: Washington
- [ ] **ACFR-18**: Michigan
- [ ] **ACFR-19**: Where a state's ACFR GF is a broader consolidated fund than the NASBO GF (the TX GR-Fund / PA / IL precedent), the scope divergence is **relabelled honestly** rather than carved down — the node total may jump but stays correct + sourced + basis-labelled.
- [ ] **ACFR-20**: Negative GF investment-income (or any negative category) years on any upgraded state render honestly via the **P2 clamp** (clamped to 0 with the signed magnitude in the label, parent total preserved).

### Verification

- [ ] **VER-05**: Each upgraded state is reconciled **independently from its own ACFR** (loader-independent blind re-derivation of the printed GF totals, $0 delta — not loader self-report); the full 50-node cohort source-chain audit stays clean (0 NULL/fragile/residue/out-of-window/dup/orphan), every displayed row basis-labelled, un-upgraded NASBO states still pass.
- [ ] **VER-06**: Live-app UAT across a representative sample of the upgraded states (revenue-by-source + spending-by-function + basis label + source chip + Money In auto-enabled) with Chris sign-off.

## Future Requirements

Deferred to a follow-up milestone. Tracked but not in this roadmap.

### State ACFR Long Tail (continued)

- **ACFRX-02**: Upgrade the *rest* of the NASBO long tail (all 50 states on ACFR), retiring NASBO to a fallback-only role. After this tranche, ~19 states are on ACFR; ~31 remain.

### Other

- **VOTES-01**: Votes/amendments exploration hub (the eventual mission destination).
- **SRCSTD-01**: Backfill the always-sourced federal standard (source chips, official-record links) to city/state data.

## Out of Scope (this milestone)

- **Frontend / UI work** — the v2.11 "Money In" view + `?dataset=revenue` deep-link are data-driven; each upgraded state auto-enables revenue once loaded. No component changes.
- **States beyond the recon-locked tranche** — the rest of the NASBO long tail is ACFRX-02 (future). All 41 at once was declined (scope-size decision, 2026-07-01) in favor of a shippable ~8–10-state tranche.
- **Deeper history on the existing 9 ACFR nodes** — v2.13 is breadth (new states), not depth on already-upgraded ones.
- **Paid sources / non-public-record data** — free ACFR PDFs only (standing ground rule).
- **Budgetary/forecast figures** — ACFR GAAP audited actuals only.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| RECON-06 | Phase 107 | Complete |
| RECON-07 | Phase 107 | Complete |
| RECON-08 | Phase 108, 109 | Pending |
| ACFR-09..13 | Phase 108 | Pending |
| ACFR-14..18 | Phase 109 | Pending |
| ACFR-19 | Phase 108, 109 | Pending |
| ACFR-20 | Phase 108, 109 | Pending |
| VER-05 | Phase 110 | Pending |
| VER-06 | Phase 110 | Pending |

**Coverage:**
- v1 requirements: 18 total (RECON-06/07/08, ACFR-09..20, VER-05/06)
- Mapped to phases: 18
- Unmapped: 0 ✓

*Note: the ACFR-09..18 state→REQ-ID assignments track the candidate roster; RECON-06 may swap ≤2 states, in which case the substituted state inherits the freed REQ-ID and the deferred one moves to ACFRX-02.*
