# Requirements: v2.8 Ohio Local Government Expansion

**Defined:** 2026-06-24
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

**Source of record:** Ohio Auditor of State "Summarized Annual Financial Reports" (Hinkle System output) — free, no-auth XLSX, one all-cities (and one all-counties) workbook per year × basis, FY2016–2025. Direct file pattern: `https://ohioauditor.gov/references/SummarizedAnnualFinancialReports/SummarizedReports/City_<YEAR>_<BASIS>_Summarized.XLSX` (BASIS ∈ {GAAP, MOD, CASH}). See auto-memory `reference_ohio_aos_financial_data`.

**Scope decisions (locked at milestone start):** cities + county governments (Virginia model); general-government only (`SOREACIFB_TotalGov`, governmental funds — enterprise funds deferred); GAAP primary + CASH/MOD fallback to maximize coverage (mixed basis recorded per-city); no salaries (not in this source); every figure durably sourced; $0 spend.

## v1 Requirements

Requirements for the v2.8 milestone. Each maps to exactly one roadmap phase.

### Source + Loader (OHSRC)

- [x] **OHSRC-01**: Ohio AOS Summarized Annual Financial Reports XLSX loader built — column→tree mapping of the `SOREACIFB_TotalGov` tab (12 revenue sources → a revenue tree; ~18 expenditure functions → an expenditure tree), every figure attributed to ohioauditor.gov; proven on a known city (Columbus FY2024: Total Revenues ≈ $2.166B, Income Taxes ≈ $1.145B, Police ≈ $810M)
- [x] **OHSRC-02**: Loader resolves the all-cities **GAAP** workbook as primary and the **CASH/MOD**-basis workbooks as fallback for non-GAAP filers; idempotent with the never-overwrite guard (reuses the `treasury_sync_city_budget` RPC); available FY range (2016–2025) determined and recorded; offline unit tests pass

### City Loads (OHCITY)

- [x] **OHCITY-01**: All GAAP-filing Ohio cities (~235) loaded operating + revenue across the available FY range, every row sourced, per-capita computed from the `OI_Demographics` tab population
- [x] **OHCITY-02**: Non-GAAP cities backfilled from the CASH/MOD workbooks where GAAP is absent (basis recorded per-city); any cities absent from all workbooks documented as a source-gap residual (no phantom municipalities)

### County Loads + Data Model & Linking (OHCO / OHLINK)

- [ ] **OHCO-01**: Ohio county governments loaded operating + revenue from the all-counties workbook, per-capita, every figure sourced
- [ ] **OHLINK-01**: New Ohio state navigation node + Ohio cities and counties selectable; city→county linking via the source `County` column (`county_id`), rendering the US → Ohio → county → city breadcrumb + Cities-in-County panel

### Enrichment (OHENR)

- [ ] **OHENR-01**: Standardized, bleed-safe, state-neutral universal enrichment authored inline at $0 for the full Ohio vocabulary (~30 keys: 12 revenue sources + ~18 expenditure functions), via an explicit map + 100% coverage gate (delete-then-insert, NULLS-DISTINCT-safe); loader aborts on any unmapped live key (no silent fallback)

### Verification (OHVER)

- [ ] **OHVER-01**: Sample cities + a county government reconciled to published ACFRs — using the workbook's `SOA_Gov` full-accrual Statement of Activities as a built-in cross-check plus per-entity ACFR — within an explained basis tolerance; full-cohort source-chain audit clean (0 NULL/fragile/residue across all loaded rows)
- [ ] **OHVER-02**: Live-app UAT across an Ohio city + an Ohio county government with Chris sign-off

## v2 Requirements

Deferred to a future release. Tracked but not in this roadmap.

### Broader Entity Coverage (OHTWN)

- **OHTWN-01**: Ohio townships, villages, libraries, and school districts (Hinkle covers all; townships/villages number in the thousands) — a future broadening pass
- **OHENT-01**: Enterprise funds (Water/Sewer/Electric/Landfill) from the `SONP_*`/`SOREACINP_*` tabs — a separate display + reconciliation concern

## Out of Scope

Explicitly excluded for v2.8. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Salaries / employee compensation | Not present in the AOS Summarized Financial Reports source |
| Enterprise funds (Water/Sewer/Electric/Landfill) | General-government scope chosen for the cleanest ACFR-reconciliation basis; deferred to v2 (OHENT-01) |
| Townships, villages, libraries, schools | Thousands of entities; cities + counties are the spine (deferred to v2, OHTWN-01) |
| OhioCheckbook transaction-level spending | Voluntary participation (~45 counties, partial cities), spending-only — too incomplete for the backbone; possible later enrichment layer |
| Paid APIs / data sources | Free-source ground rule (unfunded nonprofit) |
| Unsourced text | Every displayed figure + explainer carries a source |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OHSRC-01 | Phase 84 | Complete |
| OHSRC-02 | Phase 84 | Complete |
| OHCITY-01 | Phase 85 | Complete |
| OHCITY-02 | Phase 85 | Complete |
| OHCO-01 | Phase 86 | Pending |
| OHLINK-01 | Phase 86 | Pending |
| OHENR-01 | Phase 87 | Pending |
| OHVER-01 | Phase 88 | Pending |
| OHVER-02 | Phase 88 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-24*
*Last updated: 2026-06-24 after initial definition*
