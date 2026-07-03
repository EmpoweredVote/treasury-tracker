# Requirements: v2.14 State ACFR Long Tail — Tranche 3 + Deepening

**Defined:** 2026-07-02
**Core Value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.

**Milestone scope:** Continue the proven State-ACFR GAAP upgrade (v2.11 CA/TX/NY/FL → v2.12 PA/IL → v2.13 NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI) in three moves. **First**, retire the WR-05 loader debt — the `process*Acfr.js` data_sources upsert becomes atomic (or the vestigial write is removed) so every load this milestone runs residue-free. **Then** bring the **next ~10 largest-General-Fund NASBO states** onto full ACFR GF revenue-by-source + finer spending-by-function, each as deep as durable ACFR URLs allow. Candidate roster (rank re-checked at recon against NASBO 2025 SER): **AZ, IN, CO, MO, KY, OR, SC, LA, OK, UT** — recon locks the exact list and may substitute states whose rank differs or whose ACFR won't cleanly `pdftotext -table`-extract. **Plus** the full v2.13 recoverable-holes deepening pass: MA FY2001/02/04/05/14/21, CT FY2006 (OCR), NJ pre-FY2020, and CT/WI pre-GASB-34 years via a new pre-GASB-34 extractor with honest basis labelling. NASBO operating replaced in place idempotently; un-upgraded states stay on NASBO. Same loader pattern, basis-labelled, $0. No frontend work — the data-driven "Money In" view + `?dataset=revenue` deep-link auto-enable revenue once each state's data lands. Cohort goes from 19 ACFR nodes → ~29.

## v1 Requirements

### Loader Debt (first, before any loads)

- [x] **LOAD-01**: The `process*Acfr.js` loader template's `data_sources` write is atomic (or the vestigial write is removed), so a full loader run — including an idempotent re-run — leaves 0 residue rows; proven by a live re-run + audit probe **before** any tranche-3 load happens, and the fix is applied to (or inherited by) every loader used this milestone.

### Recon & Data Integrity

- [x] **RECON-09**: Recon ranks the remaining 31 NASBO states by GF size (NASBO 2025 SER), **locks the ~10-state tranche-3 roster** (candidates: AZ, IN, CO, MO, KY, OR, SC, LA, OK, UT — substitutions allowed for rank corrections or ACFRs that won't cleanly `pdftotext -table`-extract, deferring those to the final tranche), locates each locked state's ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GENERAL FUND column, units, FY-end, durable per-year URLs, cleanly extractable FY depth), tie-confirms each window's bookend totals, and writes a per-state gap log for years that don't cleanly extract.
- [x] **RECON-10**: Recon resolves prior-load overlaps before any write — any locked state with a pre-existing custom-source node gets an **in-place upgrade** plan (the MA v1.8-DLS / CA v1.7 precedent; Utah's existing city/county data is municipal-level and unaffected, but the UT *state node's* provenance is checked) — and confirms each upgraded state's ACFR rows **replace** its NASBO operating rows (one basis per state-FY) idempotently and never-overwriting; un-upgraded NASBO states remain unchanged on `scripts/loadStateGF.mjs`; the existing 19 ACFR nodes are not disturbed.

### State ACFR Upgrades (the tranche)

*One requirement per candidate state — recon (RECON-09) may substitute. Each: "User can see {STATE}'s GF revenue-by-source and GAAP spending-by-function on the {STATE} state node, ACFR-sourced, GAAP basis-labelled, NASBO operating replaced idempotently, as deep as the ACFR cleanly extracts."*

*State labels synced 2026-07-02 to the Phase 112 locked roster + corrected size ranking (112-RECON.md Section 4 traceability mapping — authoritative). OK exits to ACFRX-03; AL substituted in.*

- [x] **ACFR-21**: Indiana *(Phase 113 — FY2002–FY2025, 24 years, all tie $0)*
- [x] **ACFR-22**: Arizona *(Phase 113 — FY2002–FY2024, 23 years; FY2024 Drive-link caveat)*
- [x] **ACFR-23**: Oregon *(Phase 113 — FY2022–FY2025, honest D-06 window)*
- [x] **ACFR-24**: Missouri *(Phase 113 — FY2012–FY2025, 14 years, all tie $0)*
- [x] **ACFR-25**: Colorado *(Phase 113 — FY2023–FY2025; TABOR clamped FY2024+FY2025)*
- [x] **ACFR-26**: South Carolina
- [x] **ACFR-27**: Kentucky
- [x] **ACFR-28**: Utah
- [x] **ACFR-29**: Alabama (substituted for Oklahoma per 112-RECON rank correction; OK deferred to ACFRX-03)
- [x] **ACFR-30**: Louisiana
- [x] **ACFR-31**: Where a state's ACFR GF is a broader consolidated fund than the NASBO GF (the TX GR-Fund / PA / IL / MI precedent), the scope divergence is **relabelled honestly** rather than carved down — the node total may jump but stays correct + sourced + basis-labelled.
- [x] **ACFR-32**: Negative GF investment-income (or any negative category) years on any upgraded state render honestly via the **P2 clamp** (clamped to 0 with the signed magnitude in the label, parent total preserved).

### Deepening (v2.13 recoverable holes)

- [x] **DEEP-02**: A **pre-GASB-34 extractor** handles pre-FY2002 statement formats (pre-GASB-34 fund statements differ structurally from the modern Governmental Funds statement) with an honest per-row **basis label** distinguishing those years from GASB-34 GAAP years.
- [x] **DEEP-03**: Modern-era holes recovered — **MA FY2001/02/04/05/14/21, CT FY2006 (OCR path), NJ pre-FY2020** — each recovered year tying exactly to its printed GF total, or documented unrecoverable with the reason in the gap log.
- [x] **DEEP-04**: **CT/WI pre-GASB-34 years** loaded via the DEEP-02 extractor, as deep as durable URLs allow, each year tying to its printed totals and carrying the pre-GASB-34 basis label.

### Verification

- [x] **VER-07**: Every newly loaded state-FY (tranche 3 + deepening) is reconciled **independently from its own ACFR** (loader-independent blind re-derivation of the printed GF totals, exact $0 delta — not loader self-report); the full 50-state cohort source-chain audit stays clean (0 NULL/fragile/residue/out-of-window/dup/orphan), every displayed row basis-labelled, un-upgraded NASBO states still pass — including **0 `data_sources` residue with no manual re-clean**, proving LOAD-01 end-to-end.
- [x] **VER-08**: Live-app UAT across a representative sample of the upgraded states + deepened history years (revenue-by-source, spending-by-function, basis labels incl. pre-GASB-34, source chips, Money In auto-enabled, year selector reaching the deepened years) with Chris sign-off.

## Future Requirements

Deferred to a follow-up milestone. Tracked but not in this roadmap.

### State ACFR Long Tail (continued)

- **ACFRX-03**: Upgrade the *final* ~21 NASBO states to ACFR GAAP, retiring NASBO to a fallback-only role. After this tranche, ~29 states are on ACFR; ~21 remain.

### Other

- **VOTES-01**: Votes/amendments exploration hub (the eventual mission destination).
- **SRCSTD-01**: Backfill the always-sourced federal standard (source chips, official-record links) to city/state data.

## Out of Scope (this milestone)

- **Frontend / UI work** — the "Money In" view + `?dataset=revenue` deep-link are data-driven; each upgraded state auto-enables revenue once loaded. No component changes. (The cosmetic state-flag hero-banner fix stays deferred.)
- **States beyond the recon-locked tranche** — the rest of the NASBO long tail is ACFRX-03 (future).
- **Deeper history on the other 15 ACFR nodes** — deepening is scoped to the v2.13 recoverable holes only (MA/CT/NJ/WI); CA/NY/FL/TX etc. holes stay recorded absences.
- **Paid sources / non-public-record data** — free ACFR PDFs only (standing ground rule); OCR must be free tooling.
- **Budgetary/forecast figures** — ACFR GAAP audited actuals only (pre-GASB-34 years labelled for their own basis).

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| LOAD-01 | Phase 111 | Complete |
| RECON-09 | Phase 112 | Complete |
| RECON-10 | Phase 112 | Complete |
| ACFR-21..25 | Phase 113 | Complete (2026-07-02) |
| ACFR-26..30 | Phase 114 | Pending |
| ACFR-31 | Phase 113, 114 | Phase 113 done; 114 pending |
| ACFR-32 | Phase 113, 114 | Phase 113 done; 114 pending |
| DEEP-02 | Phase 115 | Complete |
| DEEP-03 | Phase 115 | Complete |
| DEEP-04 | Phase 115 | Complete |
| VER-07 | Phase 116 | Complete |
| VER-08 | Phase 116 | Complete |

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-02*
