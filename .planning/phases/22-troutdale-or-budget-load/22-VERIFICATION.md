---
phase: 22-troutdale-or-budget-load
plan: 03
verified_by: human (app)
verified_date: 2026-06-01
status: passed
---

# Phase 22: Troutdale OR Budget Load — Verification

## Summary

Troutdale, OR is fully loaded and verified in the app across operating budget, revenue (Money In), per-capita display, and AI-enriched category descriptions.

---

## Data Loaded

### Operating Budget (dataset_type='operating')

| FY | Departments | Total |
|----|-------------|-------|
| FY2019 | 16 | ~$12M (16 dept — COMMUNITY SERVICES absent in FY2019) |
| FY2020 | 16 | ~$13M (16 dept — COMMUNITY SERVICES absent in FY2020) |
| FY2021 | 17 | ~$14M |
| FY2022 | 17 | ~$16M |
| FY2023 | 17 | ~$17M |
| FY2024 | 17 | ~$18M |
| FY2025 | 17 | ~$20M |
| FY2026 | 17 | $21,128,982 |

**FYs loaded:** 8 (FY2019–FY2026)
**FY2026 total:** $21,128,982 (~$21.1M)
**Departments (FY2026):** 17 (including POLICE OPERATIONS ~$6.7M, FIRE PROTECTION SERVICES ~$3.2M, EXECUTIVE ~$2.6M)

Note: FY2019 and FY2020 show 16 departments (COMMUNITY SERVICES absent from General Fund in those years). This is a structural difference, not a parse error — both FYs included in live load per D-02 decision.

### Revenue Budget (dataset_type='revenue')

| FY | Categories | Total |
|----|-----------|-------|
| FY2019 | 10 | ~$20M |
| FY2020 | 10 | ~$21M |
| FY2021 | 10 | ~$23M |
| FY2022 | 10 | ~$25M |
| FY2023 | 10 | ~$26M |
| FY2024 | 10 | ~$29M |
| FY2025 | 10 | ~$31M |
| FY2026 | 10 | $33,684,123 |

**FYs loaded:** 8 (FY2019–FY2026)
**FY2026 total:** $33,684,123 (~$33.7M)
**Categories (FY2026):** 10 (PROPERTY TAXES, CHARGES FOR CURRENT SERVICES, etc.; no Beginning Fund Balance row)

### DB Verification

- 8 operating data_source rows + 8 revenue data_source rows (one of each per FY)
- Each FY has distinct operating + revenue data_sources sharing dataset_id `fyYYYY` — no dataset_id collision confirmed
- dataset_type collision guard (4-column upsert via treasury_sync_budget_tree) verified in Plan 02 dry-runs

---

## Population

| Field | Value |
|-------|-------|
| population | 15,749 |
| population_year | 2024 |
| source | Census sub-est2024_41.csv, SUMLEV=162, "Troutdale city" |
| per-capita FY2026 operating | ~$1,342/person |

---

## Enrichment

| Decision | Scope | Categories | Cost |
|----------|-------|-----------|------|
| RUN | --city Troutdale --state OR | 26 (operating + revenue) | ~$0.026 |

Enrichment scoped with `--city Troutdale --state OR` to prevent NULL municipality_id bleed (per project memory on prior Phase 21 bug). All 26 categories received descriptions.

---

## Human Verification Result

**Status: PASSED — approved by user 2026-06-01**

Verified in production app (treasurytracker.empowered.vote):

| Check | Expected | Result |
|-------|----------|--------|
| Budget tab — FY2026 total | ~$21M | Confirmed ~$21.1M |
| Budget tab — department rows | ~17 | Confirmed ~17 rows |
| No subtotal rows | None (PUBLIC SAFETY, PARKS & FACILITIES, etc. absent) | Confirmed |
| Per-capita figure | ~$1,342/person | Displayed and plausible |
| Money In tab visible | Yes (auto-discovery from dataset_type='revenue') | Confirmed |
| Money In — FY2026 total | ~$33.7M | Confirmed ~$33.7M |
| Money In — categories | 10, no Beginning Fund Balance | Confirmed |
| Enrichment descriptions visible | Yes on opaque departments | Confirmed |

---

## UI Observation

User initially noted Troutdale appeared mixed with California cities on the main city-selection page. Investigation confirmed:
- DB state='OR' for Troutdale municipality (correct)
- AlphaLanding.tsx groups cities by `m.state` field (correct)
- Observation was a display-ordering concern, not a data integrity issue

No code fix required. User approved overall — data and logic confirmed correct.

---

## Threats Mitigated

| Threat ID | Mitigation | Outcome |
|-----------|-----------|---------|
| T-22-02 | DB-verify operating/revenue data_source separation | Verified: 8+8 rows, no collision |
| T-22-04 | SANITY_MAX $30M in loader + human-verify no subtotals | Verified: subtotal rows absent |
| T-22-05 | Enrichment scoped `--city Troutdale --state OR` | Confirmed: 26 rows, all scoped |
| T-22-06 | Dry-run + cost estimate before live enrichment | Cost $0.026, well under $5 |

---

## Deferred

- D-03: All Funds Requirements (dataset_type='all_funds_requirements') deferred to Phase 23 per researcher judgment — Troutdale All Funds Requirements lists expenditure categories, not departments, adding non-trivial complexity out of scope for this phase.
