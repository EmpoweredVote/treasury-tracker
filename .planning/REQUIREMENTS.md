# Requirements: Texas Municipal Financial Transparency

**Defined:** 2026-05-01
**Core Value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes — for Texas cities, not just Indiana and California.

---

## v1.1 Requirements

### Tier 1 — Dallas Socrata Integration

- [x] **DAL-01**: `data_sources` rows exist for Dallas operating budget (dataset `e2fs-y4nb`) and revenue budget (dataset `rtn4-pmj9`) linked to the Dallas municipality record
- [x] **DAL-02**: `bulkLoadBudget.js` script fetches paginated Socrata operating budget data and inserts into `treasury.budgets` + `treasury.budget_categories` tree via existing RPC pattern
- [x] **DAL-03**: `bulkLoadBudget.js` handles revenue budget dataset with appropriate column mapping (`budcurr` → approved, `revbfy` → actual, `department`/`revsource` as hierarchy)
- [x] **DAL-04**: Dallas operating budget FY2025 and FY2026 successfully loaded and visible in the app
- [x] **DAL-05**: Dallas revenue budget FY2025 and FY2026 successfully loaded and visible in the app
- [x] **DAL-06**: `bulkLoadBudget.js` is generic — `column_mapping` in `data_sources` drives field names, not hardcoded Dallas logic

### Tier 2 — XLSX Pipeline

- [ ] **XLSX-01**: `bulkLoadXLSX.js` (or equivalent) can download an XLSX file from a city URL, parse it, and load operating/revenue budget data into the treasury schema
- [ ] **XLSX-02**: Plano check register (from `checkregister.plano.gov` Excel export) loaded as `transactions` dataset type
- [ ] **XLSX-03**: McKinney check register XLSX (direct download from `mckinneytexas.org` Traditional Finances page) loaded as `transactions`
- [ ] **XLSX-04**: McKinney payroll register XLSX loaded as `salaries` dataset type
- [ ] **XLSX-05**: Frisco check register XLSX (from `friscotexas.gov/1276/Check-Register`) loaded as `transactions`
- [ ] **XLSX-06**: `data_sources` rows created for each XLSX source with `api_type = 'xlsx_download'`, storing download URL and column mapping
- [ ] **XLSX-07**: XLSX loader is idempotent — re-running does not duplicate rows (dedup by `source_row_id` derived from row hash or position+date)

### Tier 3 — PDF/Haiku Vision Pipeline

- [ ] **PDF-01**: Script renders each page of a PDF as a PNG image (using an available Node/system library)
- [ ] **PDF-02**: Each page image is sent to Claude Haiku with a structured extraction prompt targeting GFOA ACFR budget tables
- [ ] **PDF-03**: Haiku returns structured JSON (department, category, approved_amount, actual_amount, fiscal_year) which is validated and loaded
- [ ] **PDF-04**: Pipeline is parameterized — accepts city name, PDF path or URL, fiscal year
- [ ] **PDF-05**: Allen ACFR (most recent available year) budget data loaded via PDF pipeline
- [ ] **PDF-06**: Prosper ACFR budget data loaded via PDF pipeline
- [ ] **PDF-07**: Celina ACFR budget data loaded via PDF pipeline
- [ ] **PDF-08**: Extraction confidence is logged per page — low-confidence pages flagged for human review rather than silently skipped

---

## Future Requirements (v1.2+)

### Remaining Collin County Cities
- Richardson custom check register DB scraper
- Sachse OpenGov manual CSV loader
- Garland investigation (may have machine-readable data not yet surfaced)
- Wylie check register format confirmation and loader
- Murphy ClearGov export

### Enrichment
- Category enrichment (plain-language descriptions) for all newly loaded TX cities
- Population data for TX municipalities

### Statewide Expansion
- Generalize XLSX pipeline for other Texas cities beyond Collin County
- Texas Comptroller debt data integration
- Census Bureau annual survey data as fallback for cities with no other source

---

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| Richardson custom DB scraper | Requires form interaction / scraping — higher complexity, defer to v1.2 |
| Sachse OpenGov CSV | Manual export only, no programmatic API — defer to v1.2 |
| Real-time sync / scheduler for TX cities | Manual/scripted loads sufficient for initial coverage |
| Category enrichment for TX cities | Separate milestone concern — load data first |
| Garland deep investigation | Unconfirmed data existence — needs separate research spike |
| Wylie check register | Format unconfirmed — needs manual verification first |
| Dallas vendor payments (spending.dallasopendata.com) | Transactions dataset; operating/revenue budget is higher priority for v1.1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DAL-01 | Phase 5 | Pending |
| DAL-02 | Phase 5 | Pending |
| DAL-03 | Phase 5 | Pending |
| DAL-04 | Phase 5 | Pending |
| DAL-05 | Phase 5 | Pending |
| DAL-06 | Phase 5 | Pending |
| XLSX-01 | Phase 6 | Pending |
| XLSX-02 | Phase 6 | Pending |
| XLSX-03 | Phase 6 | Pending |
| XLSX-04 | Phase 6 | Pending |
| XLSX-05 | Phase 6 | Pending |
| XLSX-06 | Phase 6 | Pending |
| XLSX-07 | Phase 6 | Pending |
| PDF-01 | Phase 7 | Pending |
| PDF-02 | Phase 7 | Pending |
| PDF-03 | Phase 7 | Pending |
| PDF-04 | Phase 7 | Pending |
| PDF-05 | Phase 7 | Pending |
| PDF-06 | Phase 7 | Pending |
| PDF-07 | Phase 7 | Pending |
| PDF-08 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-01*
*Last updated: 2026-05-01 — initial definition for milestone v1.1*
