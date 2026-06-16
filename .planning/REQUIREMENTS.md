# Requirements: Treasury Tracker — v2.3 California Coverage Parity

**Defined:** 2026-06-16
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

**Milestone intent:** Bring every already-loaded CA city and county up to the Orange County standard — FY2003 budget-history depth, statewide salaries (2009–2024), and standardized enrichment — by re-running the hardened v2.2 SoCal pipeline (`bulkLoadStateController.js`, `loadCASalaries.js`, `loadCountyBudget.js`, `seedCountyLinks.js`, runbook `docs/socal-county-onboarding.md`). No new tooling. SoCal expansion to 6 new counties is deferred to v2.4.

**Data-driven gap baseline (DB query, 2026-06-16):**

| Group | Cities | Budget depth now | Reaches FY2003? | Salaries? |
|-------|--------|------------------|-----------------|-----------|
| Orange County (the standard) | 34 | FY2003–2024 ✓ | all 34 | ✓ (production) |
| LA County | 88 | FY2017+ (shallow) | 0 | none |
| Unlinked CA cities | 7 | FY2020+ (1 has no budget) | 0 | none |
| Other-county CA cities (Alameda/Sac/SD) | 4 | FY2012+ | 0 | none |
| LA County (county-government budget) | — | FY2021–2025 (vs OC FY2003–2024) | — | n/a |

> **Verify-at-plan-time:** the local Supabase shows salaries for only 1 municipality (Bloomington IN); the OC salary sweep from v2.2 Phase 55 lives in production. Salary phases must confirm coverage against the **production / ev-accounts** DB, not the local instance.

## v2.3 Requirements

Each maps to exactly one roadmap phase (58–62).

### History Backfill

- [x] **HIST-01**: A citizen can view operating + revenue budget history back to FY2003 for the 88 LA County cities, every figure sourced (CA State Controller ByTheNumbers — source_name/url/date) with per-year SCO population so per-capita renders across all backfilled years — and the never-overwrite guard leaves the 12 named custom-source cities (LA, Long Beach, etc.) untouched.
- [x] **HIST-02**: A citizen can view FY2003+ operating + revenue history for the remaining CA cities SCO covers (the 7 unlinked + 4 other-county cities), every figure sourced + per-year population; the 1 currently budget-less city is loaded or its absence documented with a reason.

### LA County Government Budget

- [x] **LAC-01**: LA County's own county-government operating + revenue budget is backfilled to FY2003 on the LA County entity (SCO ByTheNumbers county datasets, all-governmental-funds basis documented), matching Orange County's depth, with durable source attribution — never fabricated; FY2021–2025 already present, this extends FY2003–2020.

### Statewide Salaries

- [x] **SAL-04**: A statewide salary sweep loads CA Government Compensation employee compensation (2009–2024) for all non-OC CA cities via the reusable `loadCASalaries.js`, with source coverage confirmed first (spike gates the sweep).
- [x] **SAL-05**: A citizen can view employee compensation (salaries dataset) for the 88 LA County cities + the 12 named CA cities wherever the GCC source provides it.
- [x] **SAL-06**: A sample city's latest-year total compensation reconciles to a published figure at ~$0 delta (the v2.2 Irvine-style check), with coverage and any per-city gaps documented.

### Enrichment + Linking Parity

- [ ] **ENR-01**: Every parity-loaded budget category (LA County cities backfill + other-county/unlinked cities) carries standardized, bleed-safe plain-language enrichment (municipality-scoped, never universal) consistent with the OC/LA County baseline, authored inline at ~$0.
- [x] **ENR-02**: The 7 unlinked CA cities are linked to their counties via `county_id`, completing the breadcrumb chain (US → California → County → city) and the Cities-in-County panel for those cities.

### Verification

- [ ] **VER-03**: Parity totals are spot-checked against published ACFRs / adopted budgets (LA County government + a representative sample of LA County cities) and pass on a basis-matched comparison, and the source-chain audit passes (durable human-page URLs, every backfilled row sourced) — all documented.
- [ ] **VER-04**: The live app is verified end-to-end (FY2003 history depth, salaries dataset, per-capita across backfilled years, enrichment, breadcrumbs + Cities-in-County panels) with Chris UAT sign-off.

## Future Requirements

Deferred to v2.4 (the next milestone). Tracked, not in this roadmap.

### Southern California Expansion (v2.4)

- **SOCAL-01**: Riverside County cities loaded via the hardened pipeline (~28 cities)
- **SOCAL-02**: San Bernardino County cities loaded (~24 cities)
- **SOCAL-03**: San Diego County cities loaded (~18 cities)
- **SOCAL-04**: Ventura County cities loaded (~10 cities)
- **SOCAL-05**: Santa Barbara County cities loaded (~8 cities)
- **SOCAL-06**: Imperial County cities loaded (~7 cities)

> All 6 staged; phase order decided at v2.4 kickoff. The 3 directory-only CA counties already in the DB (Alameda, Sacramento, San Diego) get their county-government budgets as part of this expansion, not v2.3 parity.

## Out of Scope

Explicitly excluded for v2.3. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| SCO FY2003 backfill for the 12 named custom-source cities (LA, SF, SD, San Jose, etc.) | Their custom-source budgets are richer; never-overwrite guard preserves them. They get salaries + enrichment parity only (per Chris decision 2026-06-16) |
| County-government budgets for Alameda / Sacramento / San Diego counties | Directory-only entities; loading their budgets is expansion, folded into v2.4 SoCal (San Diego is a SOCAL county) |
| Loading the 6 new SoCal counties' cities | v2.4 scope — v2.3 is parity for already-covered CA only |
| Transaction / line-item drill for backfilled cities | SCO ByTheNumbers is category-level only — same accepted depth as the OC baseline |
| Paid data sources / paid APIs | Free-source ground rule carries forward |
| Unsourced figures | Always-sourced standard — every backfilled figure carries its source row |

## Traceability

Which phase covers each requirement. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIST-01 | Phase 58 | Complete |
| LAC-01 | Phase 58 | Complete |
| HIST-02 | Phase 59 | Complete |
| ENR-02 | Phase 59 | Complete |
| SAL-04 | Phase 60 | Complete |
| SAL-05 | Phase 60 | Complete |
| SAL-06 | Phase 60 | Complete |
| ENR-01 | Phase 61 | Pending |
| VER-03 | Phase 62 | Pending |
| VER-04 | Phase 62 | Pending |
| SOCAL-01..06 | v2.4 milestone | Deferred |

**Coverage:**
- v2.3 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓
- SOCAL-01..06 are Future Requirements (deferred to v2.4) — listed for sync, not counted in v2.3 coverage.

---
*Requirements defined: 2026-06-16*
