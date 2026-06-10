# Requirements — v1.8 Massachusetts All-Cities Financial Transparency

**Milestone:** v1.8
**Status:** Active
**Created:** 2026-06-09
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

---

## Active Requirements

### LOAD — Loader Infrastructure

- [x] **LOAD-01**: `scrapeMaDLS.js --explore` confirms General Fund Expenditures rdreport/tableID before any operating data is loaded (required pre-load checkpoint) — *resolved by exclusion: gf-expenditures removed from REPORTS[] after exhaustive automated search confirmed rdreport is undiscoverable without browser network inspection; no GF Expenditure data will load until rdreport is confirmed manually (see 37-01-SUMMARY.md)*
- [x] **LOAD-02**: `scrapeMaDLS.js` has a progress checkpoint file keyed by DOR code so bulk load can resume from last successful city without restarting from city 1
- [x] **LOAD-03**: `scrapeMaDLS.js` appends to `fiscal_years` array on `data_source` when loading a second FY onto an existing record (array_append, not overwrite)

### MA — MA City Budget Data

- [ ] **MA-01**: General Fund Expenditures (operating) loaded for all 351 MA cities, FY2021–FY2025
- [ ] **MA-02**: Revenue by Source loaded for all 351 MA cities, FY2021–FY2025
- [ ] **MA-03**: All 351 MA cities visible in city picker under "Massachusetts"
- [ ] **MA-04**: Population data loaded for all 351 MA cities (2024 Census vintage); per-capita ($/resident) visible in app

### STATE — MA State Budget

- [ ] **STATE-01**: MA state government budget upgraded from hardcoded estimates to real General Fund Expenditures data from MA DLS

### ENRICH — Category Enrichment

- [ ] **ENRICH-01**: All 14 universal MA DLS category names (5 revenue + 9 operating) enriched in a single shared pass; enrichment records reused across all 351 cities without per-city re-enrichment

---

## Future Requirements

- Multi-year revenue by source (FY2003–FY2020 historical depth — MA DLS goes back to 2003)
- Schedule A other 4 tabs (State Grants, Receipts Reserved, Revolving Funds, Other Special Revenue) — tableIDs unknown
- County-level grouping for MA (14 counties — similar to LA County linking in v1.5)
- MA entity_type distinction: 351 towns vs 26 official cities — currently all labeled `entity_type: 'city'`

---

## Out of Scope

- Per-city enrichment for MA — MA DLS uses universal column names; per-city enrichment would be redundant and costly
- FY2026 Revenue by Source (available on portal) — deferred until GF Expenditures also has FY2026 for display consistency
- Real-time MA DLS data sync — annual manual scrape is sufficient
- MA county budget data — counties in MA have very limited fiscal authority (most services are at the town level)

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| LOAD-01     | Phase 37 |
| LOAD-02     | Phase 37 |
| LOAD-03     | Phase 37 |
| MA-01       | Phase 38 |
| MA-02       | Phase 38 |
| MA-03       | Phase 38 |
| MA-04       | Phase 39 |
| STATE-01    | Phase 39 |
| ENRICH-01   | Phase 39 |
