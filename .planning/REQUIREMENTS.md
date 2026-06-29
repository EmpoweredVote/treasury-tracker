# Requirements: v2.11 State ACFR Revenue-by-Source Upgrades (Pilot)

**Defined:** 2026-06-29
**Core Value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.

**Milestone scope:** Upgrade the four highest-traffic NASBO state General Fund nodes — **CA, TX, NY, FL** — from operating-only to full **State-ACFR GAAP** nodes (revenue-by-source + finer spending-by-function), as deep as each ACFR cleanly extracts. The "ACFR-later" half of the v2.10 hybrid. A follow-up milestone scales the upgrade to the rest of the NASBO long tail.

## v1 Requirements

### Recon & Data Integrity

- [ ] **RECON-01**: Recon documents California's GF-node situation vs the pre-existing v1.7 CA-state-budget entity (and notes MA's v1.8 state budget), so the upgrade targets the right node with no duplicate or conflicting California state node.
- [ ] **RECON-02**: For each of CA/TX/NY/FL, the published ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GENERAL FUND column, GAAP basis) is located, the cleanly `pdftotext -table`-extractable FY depth is determined, and a durable source URL is recorded (TLS quirks noted where applicable).
- [ ] **RECON-03**: Each upgraded state's ACFR rows **replace** its NASBO operating rows (one basis per state-FY), idempotently and never-overwriting; un-upgraded NASBO states remain unchanged on `scripts/loadStateGF.mjs`.

### State ACFR Upgrades

- [ ] **ACFR-01**: User can see **California's** GF revenue-by-source and GAAP spending-by-function on the CA state node (ACFR-sourced, GAAP basis-labelled), as deep as the ACFR cleanly extracts.
- [ ] **ACFR-02**: User can see **Texas's** GF revenue-by-source and GAAP spending-by-function on the TX state node (ACFR-sourced, GAAP basis-labelled), as deep as the ACFR cleanly extracts.
- [ ] **ACFR-03**: User can see **New York's** GF revenue-by-source and GAAP spending-by-function on the NY state node (ACFR-sourced, GAAP basis-labelled), as deep as the ACFR cleanly extracts.
- [ ] **ACFR-04**: User can see **Florida's** GF revenue-by-source and GAAP spending-by-function on the FL state node (ACFR-sourced, GAAP basis-labelled), as deep as the ACFR cleanly extracts.
- [ ] **ACFR-05**: Negative GF investment-income (or any negative category) years on the upgraded states render honestly via the P2 clamp (clamped to 0 with the signed magnitude in the label, parent total preserved).

### Revenue View / UX

- [ ] **REVUX-01**: The "Money In" card on each upgraded node renders the real revenue-by-source view (no longer the disabled operating-only placeholder).
- [ ] **REVUX-02**: `?dataset=revenue` deep-links resolve correctly on upgraded (and remaining operating-only) state nodes — normal navigation unaffected.

### Verification

- [ ] **VER-01**: Each upgraded state is reconciled **independently from its own ACFR** (not loader self-report); the full 50-node cohort source-chain audit is clean (0 NULL/fragile/residue/out-of-window/dup/orphan), every displayed row basis-labelled.
- [ ] **VER-02**: Live-app UAT across the 4 upgraded nodes (revenue-by-source + spending-by-function + basis label + source chip) with Chris sign-off.

## Future Requirements

Deferred to a follow-up milestone. Tracked but not in this roadmap.

### State ACFR Long Tail

- **ACFRX-01**: Upgrade the remaining high-traffic NASBO states (PA, IL, GA, NC, MI, NJ, WA, AZ, …) to State-ACFR GAAP nodes using the path proven in this pilot.
- **ACFRX-02**: Upgrade the full NASBO long tail (all 50 states on ACFR), retiring NASBO to a fallback-only role.

### MN history follow-ups (carried from v2.9/v2.10)

- **MNHIST-02**: MN state history FY1997–FY2007 (ACFRs available in `C:\tmp\Minn`).
- **MNGAP-01**: Close the MN FY2008 operating $8.79M categorization gap (0.055%) via FY2008 ACFR re-extraction.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Upgrading more than CA/TX/NY/FL this milestone | Pilot-first: prove the per-state ACFR path on 4, then scale in a follow-up. Each ACFR is independent PDF work. |
| Budgetary / forecast figures | ACFR GAAP (audited actuals) only — budgetary basis is what NASBO already provides; mixing would muddy the basis label. |
| Paid APIs / data sources | Free only (ground rule 1); ACFRs are free public PDFs. |
| Unsourced or model-memory text | Hard ban (ground rule 2); every figure traces to the ACFR. |
| New visualization infrastructure | Reuse the existing icicle/summary/Money-In components; this is a data + minor URL-robustness milestone. |
| County/local detail within states | State-node General Fund only; local government is the separate per-state expansion track. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RECON-01 | TBD | Pending |
| RECON-02 | TBD | Pending |
| RECON-03 | TBD | Pending |
| ACFR-01 | TBD | Pending |
| ACFR-02 | TBD | Pending |
| ACFR-03 | TBD | Pending |
| ACFR-04 | TBD | Pending |
| ACFR-05 | TBD | Pending |
| REVUX-01 | TBD | Pending |
| REVUX-02 | TBD | Pending |
| VER-01 | TBD | Pending |
| VER-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-29 after initial definition*
