# Requirements: Treasury Tracker v1.3

**Defined:** 2026-05-21
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## v1 Requirements

### Revenue Completion

- [x] **REV-01**: Prosper TX revenue data loaded via pdftotext targeting "STATEMENT OF REVENUES" section — FY2023, FY2024, FY2025 (data_source rows already seeded, last_synced_at=null)
- [x] **REV-02**: Prosper revenue totals validated against ACFR published totals before enabling display
- [x] **REV-03**: Celina TX revenue data loaded via same pdftotext approach — FY2025 (data_source row id=0e2e54c5 already seeded)
- [x] **REV-04**: Celina revenue totals validated against ACFR published totals

### Collin County Expansion

- [ ] **COL-01**: Richardson TX operating budget loaded — manual URL sourcing from cor.net/departments/budget + processRichardsonBudget.js following processGarlandBudget.js pattern (placeholder data_source rows for FY2025/FY2026 already seeded)

### Enrichment

- [ ] **ENR-01**: Category enrichment run for Garland TX (Collin County cities added in v1.2 — enrichment deferred)
- [ ] **ENR-02**: Category enrichment run for Wylie TX
- [ ] **ENR-03**: Category enrichment run for Sachse TX
- [ ] **ENR-04**: Category enrichment run for Murphy TX
- [ ] **ENR-05**: Category enrichment run for Princeton TX

### Population & Per-Capita

- [ ] **POP-01**: `population_year` column added to `treasury.municipalities` table via schema migration
- [ ] **POP-02**: Population data loaded for all 12 TX cities using 2024 Census vintage estimates (Census Bureau `sub-est2024_48.csv`, `POPESTIMATE2024` column, `SUMLEV=162` filter)
- [ ] **POP-03**: Per-capita spending ($/resident) visible in app for all TX cities with population loaded, labeled with population year source

## v2 Requirements

### Population (Future)

- **POP-F1**: Separate `municipality_populations` table with multi-year history (Path B schema)
- **POP-F2**: Per-capita display for sub-categories (not just top-level budget)
- **POP-F3**: Cross-city per-capita comparison view

### Enrichment (Future)

- **ENR-F1**: Category enrichment for Richardson TX (depends on COL-01 completing first)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Statewide expansion beyond current cities | Deferred to v1.4+ — complete Collin County first |
| Enterprise fund audit across cities | Complex scope analysis; deferred until cross-city comparison is in scope |
| Multi-year per-capita trends | Single 2024 population vintage applied across FY2018–FY2026 creates false trends for fast-growing cities |
| GiveButter donation flow improvements | Not in this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POP-01 | Phase 11 | Complete |
| POP-02 | Phase 11 | Complete |
| POP-03 | Phase 11 | Complete |
| REV-01 | Phase 12 | Pending |
| REV-02 | Phase 12 | Pending |
| REV-03 | Phase 12 | Pending |
| REV-04 | Phase 12 | Pending |
| COL-01 | Phase 13 | Pending |
| ENR-01 | Phase 14 | Pending |
| ENR-02 | Phase 14 | Pending |
| ENR-03 | Phase 14 | Pending |
| ENR-04 | Phase 14 | Pending |
| ENR-05 | Phase 14 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 — traceability filled in after roadmap creation*
