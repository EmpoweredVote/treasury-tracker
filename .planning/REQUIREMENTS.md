# Requirements — v2.5 Utah Municipal Expansion

*Defined 2026-06-17. Milestone goal: bring 10 Utah cities + their 5 county governments onto Treasury Tracker at full California parity — operating + revenue budgets, employee compensation, category enrichment, and county linking — every figure durably sourced, verified with Chris's UAT sign-off, at ~$0 spend.*

**Data source (locked via recon, see `.planning/research/UTAH-RECON.md`):** Utah State Auditor's **Transparent Utah** public BigQuery dataset `ut-sao-transparency-prod.transaction.transaction` — `EX`/`RV`/`PY` transaction types give operating, revenue, and payroll for all 15 entities, FY2009→present, in one uniform table. Free (BQ sandbox free tier, no credit card). Actuals / all-governmental-funds basis, consistent with our existing CA county loads. opendata.utah.gov Socrata (FY≤2019) is a zero-auth cross-check only; per-entity ACFRs are the reconciliation/fallback source.

**Target entities:**
- **Cities (10):** Layton, Lehi, Ogden, Orem, Provo, Salt Lake City, Sandy, St. George, West Jordan, West Valley City
- **Counties (5):** Salt Lake (SLC, West Valley, West Jordan, Sandy), Utah (Provo, Orem, Lehi), Davis (Layton), Weber (Ogden), Washington (St. George)

---

## v2.5 Requirements

### Source & Loader Tooling

- [ ] **UTSRC-01**: BigQuery access is established for the project (BQ sandbox via Google auth, $0) and each of the 15 target entities' exact `entity_name` string is confirmed against the live transaction table (e.g. "Salt Lake City" vs a corporation suffix), with a recorded entity-name → Treasury-Tracker-municipality mapping.
- [ ] **UTSRC-02**: A reusable BigQuery loader queries the transaction table per entity / fiscal year / type, builds clean fund→category budget trees (avoiding reflexive deep icicles — ground rule 3), and writes operating + revenue rows with durable source attribution (Transparent Utah / CC BY 4.0) and a never-overwrite guard for any entity already loaded from another source.

### City Budgets

- [ ] **UCITY-01**: Operating (expense, `EX`) budgets loaded for all 10 cities for every available fiscal year, all-funds basis, with per-year or Census-vintage population for per-capita display, every row durably sourced.
- [ ] **UCITY-02**: Revenue (`RV`) budgets loaded for all 10 cities for every available fiscal year, every row durably sourced; Money In tab renders.

### County Budgets & Linking

- [ ] **UCO-01**: Operating + revenue budgets loaded for the 5 county governments (Salt Lake, Utah, Davis, Weber, Washington) onto their own county entities — county pages render icicle/summary + per-capita (not directory-only).
- [ ] **UCO-02**: County entities seeded and all 10 cities linked via `county_id` — US→Utah→county→city breadcrumb chip on city pages + Cities-in-County panel on county pages; the Utah state node exists/created as the parent.

### Salaries / Compensation

- [ ] **USAL-01**: Employee compensation (payroll, `PY`) loaded for all 10 cities for available fiscal years as names-free Department/category total-compensation trees (honoring the public-record-only safety line), with at least one city reconciled to the Transparent Utah Compensation Downloader / published figure at ~$0 delta.

### Enrichment

- [ ] **UENR-01**: Standardized, bleed-safe category enrichment authored inline at $0 for all newly-loaded Utah categories (operating + revenue 100%; salary departments shared by ≥2 cities), municipality-scoped so text cannot bleed across entities.

### Verification

- [ ] **UVER-01**: Basis-matched ACFR reconciliation for at least one sample entity (e.g. Salt Lake City or Provo) with documented variance, plus a full-cohort source-chain audit (0 NULL/fragile/residue `source_url` across all newly-loaded Utah rows).
- [ ] **UVER-02**: Live-app UAT across multiple Utah entities (city + county, Money In/Out, salaries, breadcrumb, per-capita, source chips), Chris sign-off.

---

## Future Requirements (deferred)

- [ ] Remaining Utah cities beyond the initial 10 (the BQ loader generalizes to any Utah entity).
- [ ] Single-city salary department-name canonicalization long tail (carried pattern from CA, ENR follow-up).
- [ ] Utah school districts / special districts (also in the same BQ table) — separate milestone.
- [ ] Adopted-budget (vs actuals) overlay if Utah publishes structured budget transactions distinct from `EX`/`RV` actuals.

## Out of Scope

- **Paid APIs / data sources** — BQ sandbox + public CC BY 4.0 data only; $0 (ground rule 1; API cost gate $5).
- **Individual-level compensation / personal data** — names-free totals only (safety line, ground rule 5).
- **Unsourced text** — enrichment authored inline from category context, every figure source-attributed (ground rule 2).
- **Reflexive deep icicles** — category-tree depth chosen to fit Utah's fund/cat/function shape (ground rule 3).
- **Reloading custom-source entities' budgets** — never-overwrite guard preserves any entity already loaded from a richer source (salaries + enrichment may still be added).

## Traceability

*Filled by the roadmap (Phases 68–73). Every REQ-ID maps to exactly one phase.*

| REQ-ID | Phase |
|--------|-------|
| UTSRC-01, UTSRC-02 | 68 — Utah BigQuery Source Setup + Loader |
| UCITY-01, UCITY-02 | 69 — Utah City Budgets Load |
| UCO-01, UCO-02 | 70 — Utah County Budgets + Linking |
| USAL-01 | 71 — Utah City Salaries / Compensation |
| UENR-01 | 72 — Utah Enrichment Parity |
| UVER-01, UVER-02 | 73 — Utah Verification + Source-Chain Audit + UAT |
