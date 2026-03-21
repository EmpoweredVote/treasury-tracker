# Requirements: Treasury Tracker

**Defined:** 2026-03-21
**Core Value:** A citizen can load the app and within seconds understand the top-level budget breakdown, then drill down to any department or line item — making public finance genuinely accessible.

## v1.1 Requirements — Multi-City Platform

Requirements for making Treasury Tracker a reusable multi-city platform.

### Routing

- [ ] **ROUTE-01**: User sees a city picker at `/` showing all available cities
- [ ] **ROUTE-02**: User navigates to `/bloomington` and gets the full existing tracker (behavior identical to v1.0)
- [ ] **ROUTE-03**: User navigates to `/los-angeles` and gets a functional Los Angeles tracker
- [ ] **ROUTE-04**: User on any city route can return to the city picker

### City Config

- [ ] **CITY-01**: Each city has a config file defining name, slug, hero image URL, available datasets, and metadata (population, fiscal year)
- [ ] **CITY-02**: Dataset tabs render only the datasets configured as available for that city
- [ ] **CITY-03**: Context cards (population, per-resident cost, fiscal year) are driven by city config/metadata — not hardcoded

### Data

- [ ] **DATA-01**: Data files are namespaced by city slug (`public/data/{slug}/budget-2025.json`, etc.)
- [ ] **DATA-02**: App data loader accepts city slug and loads from the correct namespaced path
- [ ] **DATA-03**: Bloomington data migrated to new namespacing with behavior identical to v1.0

### Pipeline

- [ ] **PIPE-01**: Processing scripts (`processBudget.js`, `processRevenue.js`, etc.) are parameterized by city — not hardcoded to Bloomington
- [ ] **PIPE-02**: A `NEW-CITY.md` or equivalent README documents the end-to-end steps to add a new city (data format, config, scripts, deployment)

### Los Angeles

- [ ] **LA-01**: LA budget/financial data sourced from public city portal (data.lacity.org or similar)
- [ ] **LA-02**: LA data processed into app JSON format using the generalized pipeline scripts
- [ ] **LA-03**: LA tracker is live with at least one dataset functional (operating budget preferred)

## v2 Requirements

Deferred to future release.

### Admin / Onboarding

- **ADMIN-01**: Non-developer can add a new city through a guided UI without touching code
- **ADMIN-02**: City data can be refreshed via an automated pipeline (no manual script execution)

### Branding

- **BRAND-01**: Each city can override the color scheme / palette

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication / user accounts | Inform Pillar is intentionally public |
| Real-time data feeds | Data is processed offline, deployed statically |
| Color scheme per city | Not selected for v1.1 — keep visual consistency |
| State/Federal data | City-level only for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | — | Pending |
| ROUTE-02 | — | Pending |
| ROUTE-03 | — | Pending |
| ROUTE-04 | — | Pending |
| CITY-01 | — | Pending |
| CITY-02 | — | Pending |
| CITY-03 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| PIPE-01 | — | Pending |
| PIPE-02 | — | Pending |
| LA-01 | — | Pending |
| LA-02 | — | Pending |
| LA-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
