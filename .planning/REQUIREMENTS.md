# Requirements: v2.12 State ACFR Long Tail

**Defined:** 2026-06-30
**Core Value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.

**Milestone scope:** Extend the proven State-ACFR GAAP upgrade in two directions — (1) **deepen** the four v2.11 pilot states' history (CA/TX/NY/FL) as far back as durable ACFR URLs allow, and (2) bring **Pennsylvania + Illinois** (the two largest remaining NASBO states) onto full ACFR revenue-by-source + finer spending-by-function. Same loader pattern, idempotent NASBO-replace, basis-labelled, $0. No frontend work — the data-driven "Money In" view + `?dataset=revenue` deep-link (shipped v2.11) auto-enable revenue once PA/IL data lands.

## v1 Requirements

### Recon & Data Integrity

- [x] **RECON-04**: Recon locates (a) the deeper-history ACFR URLs for each pilot below its current window — FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016 — and (b) the **PA** + **IL** ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GENERAL FUND column, units, durable per-year URLs, cleanly `pdftotext -table`-extractable FY depth), each bookend tie-confirmed, with a per-state gap log for years that don't cleanly extract.
- [x] **RECON-05**: Each deepened/new state's ACFR rows **replace** its NASBO operating rows (one basis per state-FY) idempotently and never-overwriting; un-upgraded NASBO states remain unchanged on `scripts/loadStateGF.mjs`; the existing CA/TX/NY/FL ACFR rows are not disturbed by the deepening.

### State ACFR Deepening (the 4 pilots)

- [x] **DEEP-01**: User can see deeper FY history on the four pilot nodes — CA/TX/NY/FL ACFR windows extended backward as deep as durable URLs allow (FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016), each added FY tying to its ACFR GF column total, GAAP basis-labelled, idempotent never-overwrite.

### State ACFR Upgrades (PA + IL)

- [ ] **ACFR-06**: User can see **Pennsylvania's** GF revenue-by-source and GAAP spending-by-function on the PA state node (ACFR-sourced, GAAP basis-labelled, NASBO operating replaced idempotently), as deep as the ACFR cleanly extracts.
- [ ] **ACFR-07**: User can see **Illinois's** GF revenue-by-source and GAAP spending-by-function on the IL state node (ACFR-sourced, GAAP basis-labelled, NASBO operating replaced idempotently), as deep as the ACFR cleanly extracts.
- [x] **ACFR-08**: Negative GF investment-income (or any negative category) years on the deepened pilots and on PA/IL render honestly via the P2 clamp (clamped to 0 with the signed magnitude in the label, parent total preserved).

### Verification

- [ ] **VER-03**: Each deepened pilot and each new state (PA, IL) is reconciled **independently from its own ACFR** (not loader self-report); the full 50-node cohort source-chain audit stays clean (0 NULL/fragile/residue/out-of-window/dup/orphan), every displayed row basis-labelled, un-upgraded NASBO states still pass.
- [ ] **VER-04**: Live-app UAT across PA + IL + the deepened pilot windows (revenue-by-source + spending-by-function + basis label + source chip + Money In) with Chris sign-off.

## Future Requirements

Deferred to a follow-up milestone. Tracked but not in this roadmap.

### State ACFR Long Tail (continued)

- **ACFRX-01**: Upgrade the next tranche of high-traffic NASBO states (GA, NC, MI, NJ, WA, AZ, MA, TN, …) to State-ACFR GAAP nodes using this proven path.
- **ACFRX-02**: Upgrade the full NASBO long tail (all 50 states on ACFR), retiring NASBO to a fallback-only role.

### Other

- **VOTES-01**: Votes/amendments exploration hub (the eventual mission destination).
- **SRCSTD-01**: Backfill the always-sourced federal standard (source chips, official-record links) to city/state data.

## Out of Scope (this milestone)

- **Frontend / UI work** — the v2.11 "Money In" view + `?dataset=revenue` deep-link are data-driven; PA/IL auto-enable revenue once loaded. No component changes.
- **States beyond PA/IL** — the rest of the NASBO long tail is ACFRX-01 (future). All 46 at once remains infeasible per the v2.10 bespoke-extractor finding.
- **Paid sources / non-public-record data** — free ACFR PDFs only (standing ground rule).
- **Budgetary/forecast figures** — ACFR GAAP audited actuals only.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| RECON-04 | Phase 103 | Complete |
| RECON-05 | Phase 104, 105 | Complete |
| DEEP-01 | Phase 104 | Complete |
| ACFR-06 | Phase 105 | Pending |
| ACFR-07 | Phase 105 | Pending |
| ACFR-08 | Phase 104, 105 | Complete |
| VER-03 | Phase 106 | Pending |
| VER-04 | Phase 106 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓
