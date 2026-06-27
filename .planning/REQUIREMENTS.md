# Requirements: v2.9 Minnesota Local Government Expansion

**Defined:** 2026-06-27
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

**Source of record:** Minnesota Office of the State Auditor (OSA) "City Finances Report" / "County Finances Report" raw data — free, no-auth XLSX, one all-cities + one all-counties workbook per year. City file pattern confirmed: `https://www.osa.state.mn.us/media/<slug>/cired_<YY>_data.xlsx` (e.g. 2023 = `cired_23_data.xlsx`). The `Governmental Funds` sheet is one row per entity with 148 itemized columns: identity (`GovEntityID`, `Entity Name`, `ParentEntityName` = county, `Entity Type`, `GAAPInd`, `Population`, `FinancialYear`), a 2-level **revenue-by-source** tree (property/sales/franchise taxes, special assessments, licenses & permits, federal grants by type → `Total Federal Grants`, state aids by type → `Total State Grants`, intergovernmental, charges for services by type → `Total Charges for Services`, fines, interest → `Total Revenues`), and a 2-level **expenditure-by-function** tree (general government, public safety [police/fire/corrections/ambulance], streets & highways, sanitation, human services, health, library, parks & rec, housing/economic dev, conservation, airport, transit, cemetery, education — each split current-expend vs capital-outlay → `Total Expenditures`). Bonus sheets `Enterprise Funds`, `Debt`, `Fund Balance`, `Employee Data` (deferred). XLSX era ~2015–latest; CSV/ZIP back to 2002 (deferred). Mission anchor: the 5 ranked-choice-voting cities — Minneapolis, St. Paul, St. Louis Park, Bloomington, Minnetonka (Hennepin + Ramsey counties).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Source + Loader (MNSRC)

- [ ] **MNSRC-01**: A reusable loader turns the MN OSA `Governmental Funds` sheet into sourced operating (expenditure-by-function) + revenue (revenue-by-source) **two-level trees** — column→tree map with subtotal nodes (`Total Federal Grants`, `Total State Grants`, `Total Charges for Services`, function→current/capital), proven on a sample RCV city for FY2023. Every figure carries `source_name`/`source_url`/`source_date` (osa.state.mn.us).
- [ ] **MNSRC-02**: County file URL pinned and a county-layout-aware parse confirmed (verify county header row/columns/vocabulary independently — don't trust city layout, per the Ohio county-layout lesson); GAAP/Cash basis derived per-entity from `GAAPInd`; XLSX-era per-FY manifests (~2015–latest available); idempotent never-overwrite guard; offline unit tests pass.

### City Loads (MNCITY)

- [ ] **MNCITY-01**: All ~853 Minnesota cities loaded operating + revenue across the XLSX-era FY range, every figure sourced, per-capita from the built-in `Population` column.
- [ ] **MNCITY-02**: GAAP/Cash basis recorded per-entity; cross-FY source-gap residual documented (no phantom municipalities created); idempotent re-run = 0 writes.

### County Loads + Data Model & Linking (MNCO / MNLINK)

- [ ] **MNCO-01**: All 87 Minnesota county governments loaded operating + revenue, per-capita, every figure sourced.
- [ ] **MNLINK-01**: A new Minnesota state navigation node + city→county linking via the source `ParentEntityName` column (no authored map needed); US→Minnesota→county→city breadcrumb + Cities-in-County panel render (existing frontend, no rebuild).

### Enrichment Parity (MNENR)

- [x] **MNENR-01**: State-neutral, bleed-safe universal `category_enrichment` for the full Minnesota city+county vocabulary, authored inline at $0 via an explicit map + 100% coverage gate (delete-then-insert, NULLS-DISTINCT-safe; aborts on any unmapped live key — no silent fallback); `$`-leak + locality-name bleed guards.

### Verification (MNVER)

- [ ] **MNVER-01**: ACFR reconciliation of a ranked-choice anchor city + its parent county (e.g. Minneapolis + Hennepin, or St. Paul + Ramsey) on a basis-matched comparator; full-cohort source-chain audit clean (0 NULL/fragile/residue across all loaded rows); independent workbook re-derivation of ≥5 entities (0 mismatches). Confirm the **two-level icicle drill-down renders** (the flat-source limitation that capped Ohio is resolved by this source).
- [ ] **MNVER-02**: Live-app UAT across ≥1 RCV anchor city + a county + the Minnesota state node — Chris sign-off.

## v2 Requirements (deferred to a future release)

- **MNSAL-01**: Employee / compensation data from the `Employee Data` sheet (names-free, Utah-style salaries tree).
- **MNENT-01**: Enterprise funds (Water/Sewer/Electric/etc.) from the `Enterprise Funds` sheet.
- **MNHIST-01**: Pre-2015 deep history (legacy CSV/ZIP formats, back to ~FY2002 — matches CA's FY2003 depth).
- **MNTWN-01**: Minnesota townships + special districts (OSA publishes both).

## Out of Scope (v2.9)

| Feature | Reason |
|---------|--------|
| Townships / special districts | Thousands of tiny entities; cities + counties are the spine (deferred MNTWN-01) |
| Enterprise funds | General-government scope chosen for a clean ACFR basis; deferred (MNENT-01) |
| Employee / compensation data | Available in the source's `Employee Data` sheet; deferred as a Utah-style follow-on (MNSAL-01) |
| Pre-2015 CSV/ZIP history | XLSX-era depth chosen for a single clean parser; legacy-format parsing deferred (MNHIST-01) |
| User-facing ranked-choice indicator/badge | RCV kept as selection rationale + verification anchor this milestone; real votes work belongs to the future votes/amendments hub |
| Paid APIs / unsourced LLM text | Free-source ground rule; every figure durably sourced |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MNSRC-01 | Phase 89 | Pending |
| MNSRC-02 | Phase 89 | Pending |
| MNCITY-01 | Phase 90 | Pending |
| MNCITY-02 | Phase 90 | Pending |
| MNCO-01 | Phase 91 | Pending |
| MNLINK-01 | Phase 91 | Pending |
| MNENR-01 | Phase 92 | Complete |
| MNVER-01 | Phase 93 | Pending |
| MNVER-02 | Phase 93 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after initial definition*
