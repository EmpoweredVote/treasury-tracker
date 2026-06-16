# Requirements: Treasury Tracker — v2.2 Orange County + Reusable SoCal Pipeline

**Defined:** 2026-06-14
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## v2.2 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (52–56).

### SoCal Bulk Pipeline

- [x] **PIPE-01**: The team can load any California county's operating + revenue data for all of its cities with a single documented command (generalized `bulkLoadStateController.js`, county-parameterized against CA State Controller ByTheNumbers).
- [x] **PIPE-02**: Every figure loaded by the pipeline carries a source-attribution row (CA State Controller ByTheNumbers — source_name / source_url / source_date), satisfying the always-sourced standard.
- [x] **PIPE-03**: Cities auto-created by the pipeline receive population data so per-capita ($/resident) works on first load.
- [x] **PIPE-04**: A runbook documents the end-to-end county-onboarding process (load → seed county + link → enrich → verify) so remaining SoCal counties are repeatable.

### Orange County Data

- [x] **OC-01**: A citizen can view operating spending for any of Orange County's 34 cities, FY2003–2024.
- [x] **OC-02**: A citizen can view revenue for any of Orange County's 34 cities, FY2003–2024.
- [x] **OC-03**: A citizen can browse Orange County and its cities via the county page — Orange County entity seeded, all 34 cities linked, breadcrumb chain (US → California → Orange County → city) and Cities-in-County panel populated.
- [x] **OC-04**: Each Orange County city's budget categories carry plain-language enrichment (plain names + descriptions), consistent with the LA County baseline.
- [x] **OC-05**: Anaheim and Santa Ana are linked to Orange County without altering their existing custom-sourced data.

### City Salaries (net-new)

- [x] **SAL-01**: The statewide CA Government Compensation source (publicpay.ca.gov) is confirmed to cover Orange County cities, with coverage and depth documented (spike — gates the rest of the phase).
- [x] **SAL-02**: A reusable statewide city-salaries loader can import employee compensation for any California city from the confirmed source.
- [x] **SAL-03**: A citizen can view employee compensation (salaries dataset) for Orange County cities wherever the source provides it.

### Verification

- [x] **VER-01**: Orange County city budget totals are spot-checked against published ACFRs / adopted budgets and pass, with the checks documented.
- [x] **VER-02**: The breadcrumb chain and Cities-in-Orange-County panel are verified end-to-end in the live app, with Chris UAT sign-off.

### County Budget (Phase 57)

- [x] **OCB-01**: Orange County's county-government operating + revenue budget is loaded onto the OC county entity from a sourced published document (ACFR all-governmental-funds basis and/or adopted budget), with the basis documented and source attribution durable — never fabricated.
- [x] **OCB-02**: The OC county page renders the loaded county budget (icicle/summary) with working per-capita and still lists the 34 cities; a `verify-phase57.mjs` probe confirms coverage + source attribution (exit 0).

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Southern California Expansion

- **SOCAL-01**: Riverside County cities loaded via the hardened pipeline (~28 cities)
- **SOCAL-02**: San Bernardino County cities loaded (~24 cities)
- **SOCAL-03**: San Diego County cities loaded (~18 cities)
- **SOCAL-04**: Ventura County cities loaded (~10 cities)
- **SOCAL-05**: Santa Barbara County cities loaded (~8 cities)
- **SOCAL-06**: Imperial County cities loaded (~7 cities)

## Out of Scope

Explicitly excluded for v2.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Transaction / line-item drill for OC cities | SCO ByTheNumbers is category-level only; same accepted depth as the LA County 88 |
| Reloading Anaheim & Santa Ana from SCO | Keep their richer custom-sourced data; link only (per decision) |
| Paid data sources / paid APIs | Free-source ground rule carries forward from federal milestones |
| Unsourced figures | Always-sourced standard — every figure carries its source row |
| Non-SoCal counties this milestone | Pipeline generalizes, but v2.2 scope is Orange County + the reusable machine |

## Traceability

Which phase covers each requirement. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 52 | Complete |
| PIPE-02 | Phase 52 | Complete |
| PIPE-03 | Phase 52 | Complete |
| PIPE-04 | Phase 52 | Complete |
| OC-01 | Phase 53 | Complete |
| OC-02 | Phase 53 | Complete |
| OC-03 | Phase 54 | Complete |
| OC-04 | Phase 54 | Complete |
| OC-05 | Phase 54 | Complete |
| SAL-01 | Phase 55 | Complete |
| SAL-02 | Phase 55 | Complete |
| SAL-03 | Phase 55 | Complete |
| VER-01 | Phase 56 | Complete |
| VER-02 | Phase 56 | Complete |
| OCB-01 | Phase 57 | Complete |
| OCB-02 | Phase 57 | Complete |
| SOCAL-01 | Future milestone | Deferred |
| SOCAL-02 | Future milestone | Deferred |
| SOCAL-03 | Future milestone | Deferred |
| SOCAL-04 | Future milestone | Deferred |
| SOCAL-05 | Future milestone | Deferred |
| SOCAL-06 | Future milestone | Deferred |

**Coverage:**
- v2.2 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓
- SOCAL-01–06 are Future Requirements (deferred to a later milestone) — listed in traceability for sync, not counted in v2.2 coverage.

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-16 — v2.2 milestone audit: PIPE-01..04 marked [x] Complete (retroactive 52-VERIFICATION.md authored; corroborated by Phase 53/56 usage). All 16 v2.2 requirements now Complete.*
