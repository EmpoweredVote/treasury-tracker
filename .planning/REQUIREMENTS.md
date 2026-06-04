# Requirements: v1.6 California City Expansion

**Milestone:** v1.6 — California City Expansion
**Status:** Defined
**Last updated:** 2026-06-04

---

## v1.6 Requirements

### Data Loads — New California Cities

- [x] **DATA-01**: Sacramento CA operating + revenue budget loaded and visible in app
  - FY2020–FY2026 target range
  - `loadSacramentoCSV.js` already written — seed + run
  - FY label normalization: "FY2024/25" → integer `2025` (ending year convention)

- [ ] **DATA-02**: Oakland CA operating + revenue budget loaded and visible in app
  - PDF extraction (pdfplumber) — download adopted budget PDFs from oaklandca.gov
  - No API calls; no Socrata SODA API
  - Biennial budget: one document covers 2 FYs — run two extraction passes per document
  - Fund name: "General Purpose Fund" (GPF), not "General Fund"
  - Target totals: ~$2.1B/year operating

- [ ] **DATA-03**: San Jose CA operating + revenue budget loaded and visible in app
  - PDF extraction (pdfplumber) — download adopted budget PDFs from sanjoseca.gov
  - No API calls; no Socrata SODA API
  - 100+ fund structure; enterprise funds (Airport, Wastewater, Water) to be filtered or documented
  - Large PDFs (400+ pages) — use targeted page-range extraction approach
  - Target totals: ~$5.3B all-funds; ~$1.7–1.9B General Fund

- [ ] **DATA-04**: Long Beach CA operating + revenue budget loaded and visible in app
  - PDF extractor required (OpenDataSoft portal, not Socrata)
  - Fiscal year: October 1 – September 30 (non-standard; documented in seeder)
  - Exclude Port of Long Beach (~$760M separate entity) entirely
  - Exclude enterprise funds (Gas, Refuse, Water, Airport, Harbor) unless displaying all-funds
  - Target totals: ~$3.6B all-funds; ~$1.5B General Fund

- [ ] **DATA-05**: Fresno CA operating + revenue budget loaded and visible in app
  - PDF extractor required (no open data portal)
  - Enterprise + internal service funds (~$899M) exceed General Fund (~$483M) — apply fund filter
  - Target totals: ~$2.0B all-funds; ~$483M General Fund (FY2025)

- [ ] **DATA-06**: Riverside CA operating + revenue budget loaded and visible in app
  - PDF extractor required (custom city transparency portal)
  - Biennial budget: one document covers 2 FYs — run two extraction passes per document
  - Riverside Public Utilities (RPU) is a full municipal electric utility — large enterprise fund
  - Target totals: ~$1.45B/year
  - Do NOT confuse with Riverside County budget (separate government)

- [ ] **DATA-07**: Bakersfield CA operating + revenue budget loaded and visible in app
  - PDF extraction (pdfplumber or pdftotext) — download adopted budget PDF from bakersfieldcity.us
  - No API calls; Open Budget portal used for reference/validation only, not as data source
  - Target totals: ~$853M total (operating ~$765M + capital ~$88M)
  - Smallest city in this set

### Enrichment

- [x] **ENRICH-01**: All 7 new CA cities have AI-generated category enrichment
  - Operating and revenue departments described in plain language
  - Run `enrichCategories.js --city [Name] --state CA --year [FY]` per city
  - Estimated cost: ~$0.06 total across all 7 cities (well under $5 threshold)
  - Idempotent via name_key upsert — safe to re-run

### Population / Per-Capita

- [x] **POPUL-01**: All 7 new CA cities seeded with 2024 population data
  - Source: Census `sub-est2024_06.csv` (SUMLEV=162, California sub-county estimates)
  - Per-capita ($/resident) displays correctly in app for each city
  - Population values (2024 estimates):
    - Sacramento: ~536K
    - Oakland: ~444K
    - San Jose: ~997K
    - Long Beach: ~451K
    - Fresno: ~550K
    - Riverside: ~324K
    - Bakersfield: ~417K

### Carry-forwards from v1.5

- [x] **CARRY-01**: Longview TX revenue budget loaded
  - Write `processLongviewRevenue.js` (pdftotext from cached PDF at `C:/tmp/longview_budget_fy2526.pdf`)
  - Seed `'Longview Revenue Budget FY2026'` data_source row (`dataset_type: 'revenue'`)
  - Run enrichment for Longview revenue categories

- [x] **CARRY-02**: STATE_LABELS verified live in app
  - `EntitySwitcher.tsx` lines 21–26 already contain full state names (CA, TX, OR)
  - Verify at treasurytracker.empowered.vote that state group headers show "California", "Texas", "Oregon"
  - If abbreviations still appear: investigate build/deploy state (no code change expected)

---

## Future Requirements (Deferred)

- Pre-FY2020 historical data for any new CA city
- CAFR/ACFR actuals (vs. adopted budget)
- Other CA cities (Anaheim, Santa Ana, Stockton, etc.)
- Riverside County, Sacramento County, Alameda County data
- Port of Long Beach (separate government entity)

---

## Out of Scope

- Real-time API integrations (GiveButter webhooks, Patreon, Benevity) — existing feature, not touched
- New frontend visualizations beyond what existing city pages show
- Multi-year per-capita trends — single 2024 population vintage across FYs creates false trends

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| DATA-01 (Sacramento) | Phase 26 | 26-01, 26-02 |
| ENRICH-01 (Sacramento) | Phase 26 | 26-02 |
| POPUL-01 (Sacramento) | Phase 26 | 26-01, 26-02 |
| CARRY-01 (Longview revenue) | Phase 27 | 27-01 |
| CARRY-02 (STATE_LABELS) | Phase 27 | 27-02 |
| DATA-02 (Oakland) | Phase 28 | TBD |
| DATA-03 (San Jose) | Phase 28 | TBD |
| ENRICH-01 (Oakland) | Phase 28 | TBD |
| ENRICH-01 (San Jose) | Phase 28 | TBD |
| POPUL-01 (Oakland) | Phase 28 | TBD |
| POPUL-01 (San Jose) | Phase 28 | TBD |
| DATA-04 (Long Beach) | Phase 29 | TBD |
| DATA-07 (Bakersfield) | Phase 29 | TBD |
| ENRICH-01 (Long Beach) | Phase 29 | TBD |
| ENRICH-01 (Bakersfield) | Phase 29 | TBD |
| POPUL-01 (Long Beach) | Phase 29 | TBD |
| POPUL-01 (Bakersfield) | Phase 29 | TBD |
| DATA-05 (Fresno) | Phase 30 | TBD |
| DATA-06 (Riverside) | Phase 30 | TBD |
| ENRICH-01 (Fresno) | Phase 30 | TBD |
| ENRICH-01 (Riverside) | Phase 30 | TBD |
| POPUL-01 (Fresno) | Phase 30 | TBD |
| POPUL-01 (Riverside) | Phase 30 | TBD |
