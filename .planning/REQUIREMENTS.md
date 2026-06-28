# Requirements: v2.10 State General Fund Sourcing

**Defined:** 2026-06-28
**Core Value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.

**Why this milestone:** Discovery at v2.9 close (Phase 93) found that the all-50-states seed loaded **unsourced round-number ESTIMATE** state-node General Fund data. Of 50 state GF nodes (FY2022–2026, ~10 budget rows each): **47 are unsourced estimates** (NULL `source_url`, round-$100M totals), **OH + VA are estimates falsely stamped with a `source_url`** (round-$100M totals — they look legitimate in the live app), and **only MN is real** (replaced with State-of-MN ACFR GAAP actuals FY2023–2025, the proven template). This violates the ground rule "NEVER create or display unsourced data or text."

**Source of record:** Each state's published **Annual Comprehensive Financial Report (ACFR)** — the Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances, **GENERAL FUND column, GAAP basis** (in thousands). Free, public, no auth. NOT budgetary-basis or forecast figures (they differ by billions and mix bases). MN template: `scripts/processMN.js` / `processMNRevenue.js` (per-FY `SOURCES` map + post-RPC source stamp).

## v1 Requirements

### Extractor + Policy (SGFS)

- [ ] **SGFS-01**: A reusable State-ACFR extractor (generalize the MN loader; pdfplumber coordinate-based so it survives PDF text-jumble + custom font encoding) turns a State ACFR's Governmental Funds GENERAL FUND column into sourced 1-level revenue-by-source + spending-by-function trees (sums verified to published Net Revenues / Total Expenditures), each figure stamped to that year's ACFR URL + source_date. **Locked cross-cutting policy** documented: FY depth per state, negative-revenue-year representation in an icicle (e.g. MN FY2022 investment losses), older-ACFR format-drift handling, always-GAAP (never budgetary/forecast). Proven on ≥1 state end-to-end.

### Minnesota History (SGFS)

- [ ] **SGFS-02**: Minnesota state node extended back from FY2023–2025 to FY2021/2022 (+ deeper as cleanly feasible), real GAAP actuals from the State ACFRs on hand (`C:\tmp\Minn`, 1997–2025), each year sourced; negative-revenue-year policy applied to FY2022.

### Re-do Falsely-Sourced States (SGFS)

- [x] **SGFS-03**: Ohio + Virginia state nodes — the *falsely-sourced* estimate General Fund rows replaced with real State-ACFR GAAP actuals (highest priority: they currently look legitimate). The prior estimate-stamping (OH D-88-04, VA equivalent) corrected.

### Remaining States (SGFS)

- [ ] **SGFS-04**: The remaining ~46 state nodes remediated — each state's ACFR sourced + real actuals loaded (revenue-by-source + spending-by-function, stamped), or the node removed if no clean free source exists (documented). No unsourced estimate state rows remain.

### Verification (SGFS)

- [ ] **SGFS-05**: Cohort-wide source-chain audit confirms 0 unsourced / round-number-estimate state General Fund rows (every state node either real+sourced or absent); spot-reconciliation of a sample of states; live-app UAT with Chris sign-off.

## Out of Scope (v2.10)

| Feature | Reason |
|---------|--------|
| State data beyond the General Fund (all-funds, enterprise, component units) | General Fund is the comparable, ACFR-clean scope; broader funds deferred |
| Forecast / enacted / budgetary-basis figures | Actuals only, single GAAP basis for comparability + honesty |
| Per-state local government expansion | This milestone is state-NODE sourcing only; local-gov expansions are their own milestones |
| Paid APIs / unsourced LLM text | Free-source ground rule; the whole point is real sourced data |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SGFS-01 | Phase 94 | Pending |
| SGFS-02 | Phase 95 | Pending |
| SGFS-03 | Phase 95 | Complete |
| SGFS-04 | Phase 96 | Pending |
| SGFS-05 | Phase 97 | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
