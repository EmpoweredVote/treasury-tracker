# Requirements: Collin County Completion & Data Quality

**Defined:** 2026-05-03
**Core Value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes — with accurate department attribution and complete revenue data.

---

## v1.2 Requirements

### Data Quality

- [ ] **DQ-01**: PDF pipeline tracks ACFR section headings across pages so budget rows are attributed to the correct department instead of "Unknown"
- [ ] **DQ-02**: Allen, Prosper, and Celina operating budgets re-extracted and reloaded with improved department attribution
- [ ] **DQ-03**: Frisco and Plano operating budgets re-extracted and reloaded with improved department attribution
- [ ] **DQ-04**: Dense statistical ACFR pages no longer cause exit code 2 JSON truncation — chunked extraction or increased max_tokens resolves the issue

### Revenue

- [ ] **REV-01**: Plano revenue data (FY2018–2024, loaded post-v1.1) is visible and correct in the app
- [ ] **REV-02**: McKinney revenue data (FY2021–2025, loaded post-v1.1) is visible and correct in the app
- [ ] **REV-03**: Frisco revenue data (FY2026, loaded post-v1.1) is visible and correct in the app
- [ ] **REV-04**: Allen revenue data (FY2026, loaded post-v1.1) is visible and correct in the app
- [ ] **REV-05**: Prosper revenue data loaded and visible in the app
- [ ] **REV-06**: Celina revenue data loaded and visible in the app

### Collin County Expansion

- [ ] **COL-01**: Garland operating budget loaded and visible in the app
- [ ] **COL-02**: Richardson operating budget loaded and visible in the app
- [ ] **COL-03**: Wylie operating budget loaded and visible in the app
- [ ] **COL-04**: Sachse operating budget loaded and visible in the app
- [ ] **COL-05**: Murphy operating budget loaded and visible in the app
- [ ] **COL-06**: Princeton operating budget loaded and visible in the app

---

## Future Requirements (v1.3+)

### Remaining Small Collin County Towns
- Blue Ridge, Josephine, Lavon, Lowry Crossing, Lucas, Nevada, New Hope, Parker, St. Paul, Weston — very small populations, limited/no structured budget data published

### Enrichment
- Category enrichment for all newly loaded TX cities (v1.2 loads data; enrichment follows)
- Population data for TX municipalities

### Statewide Expansion
- Generalize pipeline for other Texas cities beyond Collin County
- Texas Comptroller debt data integration
- Census Bureau annual survey data as fallback

---

## Out of Scope (v1.2)

| Feature | Reason |
|---------|--------|
| Small Collin County towns (Josephine, Lavon, etc.) | Very small population; unlikely to have structured public budget data |
| Category enrichment for new cities | Load data first; enrichment is a separate pass |
| Multi-year ACFR loads for new cities | Most recent year is sufficient for initial coverage |
| Real-time sync / scheduler | Manual scripted loads remain sufficient |
| Dallas vendor payments (transactions) | Operating/revenue budget is higher priority |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DQ-01 | Phase 8 | Pending |
| DQ-02 | Phase 8 | Pending |
| DQ-03 | Phase 8 | Pending |
| DQ-04 | Phase 8 | Pending |
| REV-01 | Phase 9 | Pending |
| REV-02 | Phase 9 | Pending |
| REV-03 | Phase 9 | Pending |
| REV-04 | Phase 9 | Pending |
| REV-05 | Phase 9 | Pending |
| REV-06 | Phase 9 | Pending |
| COL-01 | Phase 10 | Pending |
| COL-02 | Phase 10 | Pending |
| COL-03 | Phase 10 | Pending |
| COL-04 | Phase 10 | Pending |
| COL-05 | Phase 10 | Pending |
| COL-06 | Phase 10 | Pending |

**Coverage:**
- v1.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-03 — phase assignments confirmed in ROADMAP.md*
