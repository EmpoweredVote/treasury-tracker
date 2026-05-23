---
phase: 16-california-cities-budget-load
verified: 2026-05-22T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 16: California Cities Budget Load Verification Report

**Phase Goal:** Citizens can view budget data for San Francisco CA (operating + revenue), San Diego CA (operating + revenue), and Los Angeles CA (revenue added to existing operating data) -- all loaded via Socrata or CSV pipelines, with per-capita display and plain-language enrichment.

**Verified:** 2026-05-22
**Status:** passed
**Re-verification:** No

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SF depth=0 categories all have enrichment descriptions scoped to SF municipality_id | VERIFIED | 53 enrichment rows, 53 unique name_keys, 0 null/blank, 100% depth=0 link_key coverage FY2025+FY2026 |
| 2 | SD depth=0 categories all have enrichment descriptions scoped to SD municipality_id | VERIFIED | 61 enrichment rows, 61 unique name_keys, 0 null/blank, 100% depth=0 coverage FY2025 (FY2026 absent from source) |
| 3 | LA Revenue depth=0 categories have enrichment descriptions scoped to LA municipality_id | VERIFIED | LA Revenue FY2025: 57/57 covered; FY2026: 58/58 covered; LA Operating FY2025/FY2026 also 100% |
| 4 | Re-running enrichment produces no duplicates | VERIFIED | SF: 0 dup name_keys; SD: 0; LA: 0 |
| 5 | municipalities has SF (pop=827526 yr=2024) and SD (pop=1404452 yr=2024) | VERIFIED | SF pop=827526 yr=2024; SD pop=1404452 yr=2024; LA pop=3878704 yr=2024 |
| 6 | data_sources has SF Operating, SF Revenue, SD Operating, SD Revenue, LA Revenue rows | VERIFIED | 86ba2211 SF-op/xdgd-c79v, 663ca6af SF-rev/xdgd-c79v, 5548ecff SD-op, fa69d8ed SD-rev, 993fdef9 LA-rev/vvm4-a2zu |
| 7 | budgets has all required rows with total_budget > 0 | VERIFIED | 8 rows; SF ~$15.9B op+rev x2 FY, SD ~$4.9B op + $5.5B rev FY2025, LA rev ~$10.2B x2 FY |
| 8 | Phase 15 LA Operating FY2025=$19,855,424,569 and FY2026=$21,431,295,120 unchanged | VERIFIED | FY2025 EXACT; FY2026 EXACT; no regression |

**Score: 8/8 truths verified**

---

### Required Artifacts: treasury.budgets

| City | Type | FY | Total Budget | Budget ID | Pass |
|------|------|----|-------------|-----------|------|
| San Francisco | operating | 2025 | $15,917,870,152 | 58049b08 | PASS |
| San Francisco | operating | 2026 | $15,990,860,523 | d308f4e1 | PASS |
| San Francisco | revenue | 2025 | $15,917,870,147 | 55ef294b | PASS |
| San Francisco | revenue | 2026 | $15,990,860,523 | efa6c216 | PASS |
| San Diego | operating | 2025 | $4,865,783,435 | fbe493a3 | PASS |
| San Diego | revenue | 2025 | $5,456,393,286 | 9a2389a8 | PASS |
| Los Angeles | revenue | 2025 | $10,223,013,860.70 | 89bf4c59 | PASS |
| Los Angeles | revenue | 2026 | $10,112,263,131.69 | 0424364d | PASS |
| San Diego | op+rev | 2026 | absent | -- | EXPECTED ABSENT (empty budget_cycle in source CSV) |

### Required Artifacts: treasury.category_enrichment

| City | Rows | Null/Blank Desc | Depth=0 Coverage | Duplicates |
|------|------|-----------------|-----------------|------------|
| San Francisco (a98fa397) | 53 | 0 | 53/53 (100%) | 0 |
| San Diego (1ee32637) | 61 | 0 | 61/61 (100%) | 0 |
| Los Angeles (391bf791) | 70 (Phase 15-03 baseline) | 0 | FY2025+FY2026 op+rev 100% | 0 |

Note: LA has 86 unique depth=0 link_keys across all budgets but only 70 enrichment rows. The 21 uncovered keys belong to historical LA budgets (FY2017-FY2024) never in scope. All Phase 16 target budgets have 100% depth=0 coverage.

### Required Artifacts: treasury.data_sources

| City | Type | Data Source ID | Dataset ID | Source Host |
|------|------|---------------|-----------|------------|
| SF | operating | 86ba2211 | xdgd-c79v | data.sfgov.org |
| SF | revenue | 663ca6af | xdgd-c79v | data.sfgov.org |
| SD | operating | 5548ecff | budget_operating_datasd | seshat.datasd.org |
| SD | revenue | fa69d8ed | budget_operating_datasd | seshat.datasd.org |
| LA | revenue | 993fdef9 | vvm4-a2zu | controllerdata.lacity.org |

### Required Artifacts: treasury.municipalities

| City | Population | Population Year |
|------|-----------|----------------|
| San Francisco | 827,526 | 2024 |
| San Diego | 1,404,452 | 2024 |
| Los Angeles | 3,878,704 | 2024 |

---

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| budget_categories.link_key | category_enrichment.name_key per municipality_id | WIRED | SF 53/53, SD 61/61, LA FY2025/26 op+rev 100% |
| budgets.municipality_id | municipalities.id | WIRED | All 8 Phase 16 budgets reference correct municipality UUIDs |
| data_sources.dataset_id | requirement dataset IDs (xdgd-c79v, seshat, vvm4-a2zu) | WIRED | All three confirmed present in DB |
| LA Revenue (dataset_type=revenue) | LA Operating (dataset_type=operating) | ISOLATED | No cross-contamination; LA Operating totals exact match Phase 15 baseline |

Note: data_source_id FK is null on SF/SD budgets and LA Revenue FY2026 -- pre-existing loader pattern. The data_source text column is populated. Does not affect UI, enrichment, or per-capita.

---

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SF-01: SF op+rev from data.sfgov.org dataset xdgd-c79v | SATISFIED | ds 86ba2211+663ca6af, dataset_id=xdgd-c79v; 4 budget rows FY2025+FY2026 |
| SD-01: SD op+rev from seshat.datasd.org | SATISFIED | ds 5548ecff+fa69d8ed, seshat.datasd.org; 2 budget rows FY2025; FY2026 absent confirmed |
| LA-REV-01: LA rev from controllerdata.lacity.org dataset vvm4-a2zu | SATISFIED | ds 993fdef9, dataset_id=vvm4-a2zu; 2 budget rows FY2025/FY2026 non-zero |
| CA-01: All 3 cities plain-language enrichment on top-level categories | SATISFIED | SF 53 rows, SD 61 rows, LA 70 rows; 0 null/blank; 100% depth=0 coverage; descriptions 400-500 chars |
| CA-02: All 3 cities per-capita with correct Census population year | SATISFIED | SF: 827526/2024; SD: 1404452/2024; LA: 3878704/2024 |

---

### Anti-Patterns Found

None. Plans 04-05 are pure DB write operations. No source files were modified in Phase 16.

---

### Notes

**LA Enrichment no-op:** enrichCategories.js name_key deduplication correctly matched all LA Revenue department names to existing Phase 15-03 enrichment rows. 0 new API calls, 0 new rows. The 70 existing rows cover all depth=0 categories for all Phase 16 target fiscal years.

**SD FY2026 absence:** Confirmed expected. Source CSV has empty budget_cycle field for FY2026 rows; loader filters on budget_cycle=adopted, yielding 0 rows.

**LA total_budget fractional cents:** LA Revenue FY2025/FY2026 totals contain fractional cents from float accumulation in the loader. Cosmetic artifact in total_budget only; category amounts unaffected. Pre-existing pattern across other LA budgets.

---

## Human Verification

Completed and approved by user on 2026-05-22 at treasurytracker.empowered.vote (documented in 16-05-SUMMARY.md Task 3).

Items verified by human:
- SF and SD appear in city picker alongside LA and TX cities
- SF FY2025 operating total ~$15.9B with descriptions on top-level departments
- SF FY2026 spot-check passed
- SD FY2025 operating and revenue render with descriptions on top-level categories
- LA FY2025 revenue ~$10.2B renders alongside operating
- Per-capita for all three cities labeled Based on 2024 Census estimate
- TX city regression (Plano, McKinney) unaffected
- LA Operating FY2025 $19.8B baseline confirmed in UI

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
