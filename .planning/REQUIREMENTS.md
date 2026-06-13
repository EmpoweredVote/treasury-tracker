# Requirements: Treasury Tracker — v2.1 Federal History

**Defined:** 2026-06-12
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

**Hard constraint (Chris, 2026-06-12):** **$0 API spend this milestone.** No paid APIs and no AI/LLM enrichment calls — Claude loads the free OMB historical tables directly. v2.1 has no enrichment work (explainers and program origins are year-independent carryover), so $0 is fully achievable.

## v1 Requirements

Requirements for milestone v2.1. Each maps to a roadmap phase. All v2.0 ground rules carry forward: free sources only, every figure and text claim sourced to an official record, no unsourced model-memory text.

### Historical Federal Data (HIST)

- [ ] **HIST-01**: A citizen can view federal spending by budget function (OMB Hist 3.2) for every fiscal year FY1976–FY2024, with each figure carrying its official source
- [ ] **HIST-02**: A citizen can view federal spending by agency/department (OMB Hist 4.1 / 5.1) for every fiscal year FY1976–FY2024, with each figure carrying its official source
- [ ] **HIST-03**: A citizen can view federal receipts by source (OMB Hist 2.x) for every fiscal year FY1976–FY2024, with each figure carrying its official source
- [ ] **HIST-04**: All fiscal years FY1976 through FY2024 load with no gaps, every line-item row populating source_name / source_url / source_date metadata

### Year Navigation (NAV)

- [ ] **NAV-01**: A citizen can select any backfilled fiscal year from the federal YearSelector, and the function, agency, and revenue views update to that year
- [ ] **NAV-02**: The federal landing bands (Mandatory / Discretionary / Net Interest) and the receipts-vs-outlays deficit strip reflect the fiscal year selected in the YearSelector

### Data Integrity & Context (CTX)

- [ ] **CTX-01**: Each loaded historical year displays its own visual-vs-official reconciliation disclosure (per-year excluded-negatives, recomputed like the Phase 44 FY2025 disclosure)
- [ ] **CTX-02**: A citizen sees comparability notes explaining function/agency definition drift across decades and the FY1976 Transition Quarter (TQ)

## v2 Requirements

Deferred to future milestones. Tracked but not in this roadmap.

### Future (FUT)

- **FUT-01**: Votes/amendments exploration hub (the eventual mission destination)
- **FUT-02**: Backfill the always-sourced standard to city/state data (now proven federally)

## Out of Scope

Explicitly excluded for v2.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Pre-FY1976 detailed function/agency trees | OMB by-function detail begins ~FY1976; only superfunction-level exists earlier. The 64-yr headline history (FY1962+) already covers earlier years at summary level. |
| Re-authoring explainers per year | Explainers are name/category-keyed and year-independent — they carry over for free; no per-year rework. |
| Re-authoring program origins per year | Origins are law-keyed (enabling bill / public law), not year-keyed — year-independent, zero rework. |
| FY2025 / FY2026 changes | FY2025 actuals already the headline (v2.0); FY2026 stays the FYTD strip only. v2.1 backfills FY2024 and earlier. |
| Paid APIs / paid data sources | Ground rule 1 — everything free (OMB historical tables). |
| Any AI/LLM enrichment calls ($ spend) | Hard constraint — $0 API spend. Claude loads OMB tables directly; no enrichment needed (carryover). |
| Unsourced LLM text from model memory | Ground rule — hard ban; every row sourced. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIST-01 | TBD | Pending |
| HIST-02 | TBD | Pending |
| HIST-03 | TBD | Pending |
| HIST-04 | TBD | Pending |
| NAV-01 | TBD | Pending |
| NAV-02 | TBD | Pending |
| CTX-01 | TBD | Pending |
| CTX-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 8 ⚠️

---
*Requirements defined: 2026-06-12*
*Last updated: 2026-06-12 after initial definition*
