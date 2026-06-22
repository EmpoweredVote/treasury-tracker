# Requirements: Treasury Tracker / Empowered Vote Financials — v2.7 Virginia Local Government Expansion

**Defined:** 2026-06-22
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## v1 Requirements

Requirements for milestone v2.7. Each maps to exactly one roadmap phase. Source is recon'd + verified icicle-grade — see auto-memory `reference_virginia_apa_comparative_report` (Virginia APA Comparative Report of Local Government Revenues and Expenditures; free CKAN XLSX on data.virginia.gov, no auth).

### Source & Loader (VASRC)

- [ ] **VASRC-01**: A reusable loader parses the VA APA Comparative Report XLSX into the tracker's budget tree for any locality — revenue by source (Exhibits B / B-1 / B-2) and expenditure as a function→activity 2-level tree (Exhibit C + C-1…C-8) — with durable source attribution to `data.virginia.gov` / `apa.virginia.gov`.
- [ ] **VASRC-02**: The loader determines the available fiscal-year XLSX range and loads each available year (target FY2015+), documenting the earliest available year as the history floor when older years are PDF-only.

### Locality Data Loads (VALOAD)

- [ ] **VALOAD-01**: All 38 Virginia independent cities are loaded with general-government revenue (by source) + expenditure (function→activity) and per-capita from the report's population data — every figure sourced. (Includes Alexandria and Falls Church.)
- [ ] **VALOAD-02**: All 95 Virginia counties are loaded with the same datasets and granularity.
- [ ] **VALOAD-03**: All reporting Virginia towns (~41) are loaded with the same datasets and granularity.
- [ ] **VALOAD-04**: Re-running any VA loader is idempotent — a never-overwrite guard prevents duplicate rows and never clobbers a locality already loaded from a richer source.

### Data Model & Linking (VALINK)

- [ ] **VALINK-01**: A Virginia state node exists; independent cities render as standalone entities (no parent county), counties render as their own entities, and towns link to their parent county (county breadcrumb + a localities-in-county panel) — the navigation reads US → Virginia → locality.

### Category Enrichment (VAENR)

- [ ] **VAENR-01**: Standardized, bleed-safe category enrichment is authored for the VA function/activity vocabulary (universal rows, no locality-name leaks), inline at $0.

### Verification (VAVER)

- [ ] **VAVER-01**: A sample city (Alexandria) and a sample county reconcile to their published ACFRs within a documented, explained tolerance, and a full-cohort source-chain audit shows every row durably sourced (0 NULL / fragile / residue).
- [ ] **VAVER-02**: A live-app UAT across a sample of VA localities (a city, a county, a town) passes with Chris's sign-off.

## Future Requirements

Deferred to a later milestone. Tracked but not in the v2.7 roadmap.

- **VAENT-01**: Enterprise activities (Exhibit F — water/sewer/utilities) loaded as a separate dataset so totals stay honest alongside general-government.
- **VADEBT-01**: Outstanding debt + debt-service views (Exhibits E/G).
- **VACAP-01**: Capital projects view (Exhibit D).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Employee salaries / compensation | Not present in the APA Comparative Report (revenue/expenditure only); no free statewide names-free source identified this milestone |
| Enterprise activities (water/sewer) | Deferred (VAENT-01) — v2.7 is general-government scope to keep the first VA load clean |
| Paid data services / paid APIs | Unfunded nonprofit — free / low-cost sources only ($5 AI-spend gate) |
| Transaction / line-item detail below activity | APA report is function→activity granularity; deeper detail would require per-locality ACFR/budget extraction (the slow path) |
| PDF-only fiscal years older than the XLSX floor | Source-driven gap; loader targets available XLSX years and documents the floor |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VASRC-01 | Phase 79 | Pending |
| VASRC-02 | Phase 79 | Pending |
| VALOAD-01 | Phase 80 | Pending |
| VALOAD-02 | Phase 80 | Pending |
| VALOAD-03 | Phase 81 | Pending |
| VALOAD-04 | Phase 80 | Pending |
| VALINK-01 | Phase 81 | Pending |
| VAENR-01 | Phase 82 | Pending |
| VAVER-01 | Phase 83 | Pending |
| VAVER-02 | Phase 83 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓
