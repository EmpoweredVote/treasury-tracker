# Requirements — v2.4 Southern California Expansion

**Milestone:** v2.4 Southern California Expansion
**Defined:** 2026-06-17
**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.

**Milestone goal:** Extend Treasury Tracker to all 6 remaining Southern California counties' cities + their county-government budgets, via the hardened v2.2/v2.3 pipeline (no new tooling) — every figure durably sourced, salaries + enrichment to parity, independently verified with Chris UAT sign-off.

**Pipeline reuse (zero new tooling):** `bulkLoadStateController.js --county` (city history, never-overwrite guard, feed population), `seedCountyLinks.js` (county seed + city linking), `loadCountyBudget.js` (county-government budget), `loadCASalaries.js` (statewide GCC salaries), enrichment authored inline at $0, runbook `docs/socal-county-onboarding.md` (load → seed → link → enrich → verify).

---

## v2.4 Requirements

### Southern California City Expansion

Each county: operating + revenue FY2003–2024 from SCO ByTheNumbers (all-governmental-funds basis), per-year SCO population, durable `/d/<id>` source attribution, never overwriting any city already loaded from a richer custom source; then the county node is seeded and its cities linked via `county_id` (US → California → County → city breadcrumb + Cities-in-County panel). City counts are estimates confirmed against the DB at plan time.

- [ ] **SOCAL-01**: Riverside County cities loaded + linked (~28 cities)
- [ ] **SOCAL-02**: San Bernardino County cities loaded + linked (~24 cities)
- [ ] **SOCAL-03**: San Diego County cities loaded + linked (~18 cities)
- [ ] **SOCAL-04**: Ventura County cities loaded + linked (~10 cities)
- [ ] **SOCAL-05**: Santa Barbara County cities loaded + linked (~8 cities)
- [ ] **SOCAL-06**: Imperial County cities loaded + linked (~7 cities)

### County-Government Budgets

- [ ] **CGB-01**: County-government operating + revenue budgets (FY2003–2024, all-governmental-funds basis, durable source rows, per-year population) loaded via `loadCountyBudget.js` for the 6 SoCal counties (Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial) + the 2 directory-only counties already in the DB (Alameda, Sacramento) — each county page renders icicle/summary + per-capita (no longer directory-only)

### Salaries

- [ ] **SAL-07**: CA Government Compensation salaries FY2009–2024 loaded for all newly-loaded SoCal cities (names-free Department→Position total-compensation tree, never-overwrite guard); a sample city's latest-year total compensation reconciles to the published GCC figure at ~$0 delta; coverage + any gaps documented

### Enrichment

- [ ] **ENR-03**: Standardized, plain-language, bleed-safe enrichment for all newly parity-loaded SoCal categories — operating, revenue, and salaries — authored hybrid (universal `municipality_id IS NULL` for generic SCO/department taxonomy names matching the OC/LA County baseline; city-scoped for anything city-specific; no city-specific text in a universal record), authored inline at ~$0; no city's text appears on another city's categories (spot-checked across ≥3 cities)

### Verification

- [ ] **VER-05**: ACFR reconciliation — a representative sample of SoCal county governments + cities reconcile against published ACFRs / adopted budgets on a basis-matched comparison (documented, explainable tolerance, not penny-exact) — AND a full-cohort source-chain durability audit passes: every backfilled SoCal budget/salary row carries durable human-page source attribution (no fragile/version-specific links), zero residue
- [ ] **VER-06**: Live app verified end-to-end for the SoCal expansion (FY2003 history depth, salaries dataset, per-capita across backfilled years, enrichment rendering, breadcrumb chain, Cities-in-County panel) on a representative entity spread; Chris UAT sign-off recorded at a blocking checkpoint

---

## Future Requirements

Deferred to a later milestone. Tracked, not in this roadmap.

### v2.3 follow-ups (documented during Phase 62, D-08)

- **FUP-01**: Glendale + Burbank ACFR reconciliation via manual browser download (CDN/Akamai/Cloudflare blocked CLI fetch in Phase 62 — both have indirect corroboration but lack a directly-fetched ACFR figure)
- **FUP-02**: "Employees" (salaries) dataset-card year-gating UX — the card is hidden when the selected year is outside the salaries range (e.g. FY2003); candidate fix is to show it whenever salaries exist for any year and prompt a year switch
- **FUP-03**: 5,226 single-city salary department-name canonicalization long tail (messy publicpay source naming; low value, deferred from Phase 61)

### Later milestone candidates

- **Votes/amendments exploration hub** — the eventual mission destination
- **Backfill the always-sourced standard to remaining city/state data** — now proven federally + across CA

## Out of Scope

Explicitly excluded for v2.4. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| SCO FY2003 backfill clobbering any custom-source city | Never-overwrite guard preserves richer custom budgets; new cities get SCO data, existing custom cities are untouched (link/salaries/enrichment only) |
| Transaction / line-item drill for SoCal cities | SCO ByTheNumbers is category-level only — same accepted depth as the OC/LA County baseline |
| The v2.3 follow-ups (FUP-01..03) | Tracked as Future; v2.4 is SoCal expansion, not v2.3 cleanup |
| Northern / Central CA counties beyond these 6 SoCal counties | Out of the defined SoCal scope; candidates for a later milestone |
| Paid data sources / paid APIs | Free-source ground rule carries forward |
| Unsourced figures or text | Always-sourced standard — every figure carries its source row |

## Traceability

Which phase covers each requirement. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SOCAL-01 | Phase 63 | Pending |
| SOCAL-02 | Phase 63 | Pending |
| SOCAL-03 | Phase 63 | Pending |
| SOCAL-04 | Phase 63 | Pending |
| SOCAL-05 | Phase 63 | Pending |
| SOCAL-06 | Phase 63 | Pending |
| CGB-01 | Phase 64 | Pending |
| SAL-07 | Phase 65 | Pending |
| ENR-03 | Phase 66 | Pending |
| VER-05 | Phase 67 | Pending |
| VER-06 | Phase 67 | Pending |

**Coverage:**
- v2.4 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓
