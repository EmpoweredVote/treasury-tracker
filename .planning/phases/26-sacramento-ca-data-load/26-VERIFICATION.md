---
phase: 26-sacramento-ca-data-load
verified: 2026-06-04T00:00:00Z
status: human_needed
score: 4/5 success criteria data-verified; visual app confirmation deferred
overrides_applied: 0
human_verification:
  - test: "Open https://treasurytracker.empowered.vote, open city picker, confirm 'Sacramento' appears under 'California' group"
    expected: "Sacramento is visible in the California section of the city list. Selecting it loads the budget view."
    why_human: "App rendering and city-list grouping cannot be verified programmatically — requires browser/visual confirmation."
  - test: "Select Sacramento → Operating tab → confirm latest-FY total is ~$1.54B (FY2026: $1,537,138,014)"
    expected: "Operating budget tab shows total in ~$1.6B range for FY2026."
    why_human: "App rendering of budget totals requires a running frontend — data is verified in DB but visual display is human-only."
  - test: "Select Sacramento → Revenue/Money In tab → confirm at least one FY shows populated revenue categories"
    expected: "Revenue tab is visible and shows categories for at least one FY (14 FYs loaded: FY2013–FY2026)."
    why_human: "Revenue tab visibility and data rendering require a running app."
  - test: "Confirm per-capita ($/resident) figure is consistent with 536,000 population (e.g. ~$1,537,138,014 / 536,000 ≈ ~$2,868/resident)"
    expected: "Per-capita figure displays, approximately $2,868/resident for FY2026 operating."
    why_human: "Per-capita UI component rendering requires a running app."
  - test: "Confirm top operating categories show plain-language enrichment descriptions (not empty)"
    expected: "Category descriptions like 'Police Department Operations', 'Fire Department Operations', 'City Infrastructure & Maintenance' are visible."
    why_human: "Enrichment description rendering in the app UI requires visual confirmation."
---

# Phase 26: Sacramento CA Data Load — Verification Report

**Phase Goal:** Sacramento is visible in the app with correct operating and revenue budget data, enrichment, and per-capita display.
**Verified:** 2026-06-04
**Status:** human_needed
**Re-verification:** No — initial verification

---

## ROADMAP §Phase 26 Success Criteria

| # | Criterion | Disposition | Observed Value | Source |
|---|-----------|-------------|----------------|--------|
| 1 | "Sacramento" appears in the city picker at treasurytracker.empowered.vote under "California" | DEFERRED | Not yet visually confirmed — municipality row exists in DB with state='CA' and entity_type='city' | Human visual confirmation required |
| 2 | Operating budget tab shows a total in the ~$1.6B range for the latest available FY | PASS (data) | **$1,537,138,014** for FY2026 (~$1.54B) — within the accepted $1.0B–$2.2B range per 26-01-SUMMARY.md | DB-verified via 26-01 live run; visual rendering deferred to human |
| 3 | Revenue / Money In tab shows data with at least one fiscal year populated | PASS (data) | **14 revenue FYs loaded** (FY2013–FY2026); FY2026 revenue total = $1,566,967,530 | DB-verified: 14 distinct revenue fiscal_year rows in treasury.budgets for municipality_id 9722596e |
| 4 | Per-capita ($/resident) displays correctly using ~536K population | PASS (data) | **population = 536,000**, population_year = 2024 set in DB; implied per-capita: ~$2,868/resident (FY2026 operating / 536,000) | DB-verified via 26-01-SUMMARY.md population confirmation |
| 5 | Category enrichment descriptions are visible (not empty) for top operating categories | PASS (data) | **20 Sacramento-specific enrichment rows** + 22 universal rows; all 20 have non-empty plain_name and description | DB-verified: SELECT COUNT(*) from treasury.category_enrichment WHERE municipality_id='9722596e-...' = 20 |

**Automated Criteria Score: 4/5** — Criteria 2, 3, 4, 5 are data-verified. Criterion 1 requires human visual confirmation.

---

## Enrichment Details

### Run Summary

- **Dry-run (FY2026, no --force):** Exit 0; Municipality ID: 9722596e-1102-4aca-8758-c32fc0c1731d; "Nothing new to enrich" — all categories already covered
- **Live run (FY2026):** Exit 0; "Nothing new to enrich" — idempotent, 0 new API calls, $0.00 cost
- **Live run (FY2025):** Exit 0; "Nothing new to enrich" — idempotent
- **Failed categories:** 0
- **Enrichment rows (Sacramento-specific):** 20
- **Universal enrichment rows:** 22
- **Total enrichment coverage:** 42 name_keys covering all 37 top-level FY2026 operating categories

### Enriched Categories (Sacramento-specific, 20 rows)

| name_key | plain_name |
|----------|------------|
| city attorney | City Attorney's Office |
| city clerk | City Clerk Operations |
| city manager | City Manager's Office |
| city treasurer | City Treasurer Operations |
| citywide and community support | Community Services and Support |
| community development | Community Development Fund |
| community response | Community Emergency Response |
| convention and cultural services | Cultural Events and Conventions |
| debt service | Loan & Bond Payments |
| finance | Finance Department Operations |
| fire | Fire Department Operations |
| human resources | City Staff & HR Operations |
| information technology | City IT Operations |
| mayor/council | Mayor and City Council Operations |
| non-appropriated | Non-Appropriated Funds |
| office of the city auditor | City Auditor's Office |
| police | Police Department Operations |
| public works | City Infrastructure & Maintenance |
| utilities | City Utilities Operations |
| youth, parks, and community enrichment | Youth, Parks & Community Programs |

### Loaded FYs

**Operating budget FYs loaded:** 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 (14 FYs)

**Revenue budget FYs loaded:** 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 (14 FYs)

---

## Data Verification

### Operating Budget Totals (from 26-01-SUMMARY.md)

| FY | Total Budget |
|----|-------------|
| 2013 | $1,342,149,366 |
| 2014 | $851,109,452 |
| 2015 | $828,593,876 |
| 2016 | $858,718,871 |
| 2017 | $906,979,132 |
| 2018 | $953,973,022 |
| 2019 | $1,002,190,752 |
| 2020 | $1,087,942,740 |
| 2021 | $1,162,061,128 |
| 2022 | $1,196,607,155 |
| 2023 | $1,317,432,474 |
| 2024 | $1,361,914,429 |
| 2025 | $1,463,120,733 |
| **2026** | **$1,537,138,014** ← latest FY |

**Latest operating FY (2026): $1,537,138,014 — criterion 2 PASS**

### Population

- **population:** 536,000
- **population_year:** 2024
- **Per-capita basis (FY2026 operating):** $1,537,138,014 / 536,000 ≈ **$2,868/resident**

---

## Human Verification Required

**Human checkpoint (Plan 26-02, Task 2):** Visual app confirmation at treasurytracker.empowered.vote.

The following items require human eyes-on confirmation:

### 1. Sacramento in city picker (Criterion 1)
**Test:** Open https://treasurytracker.empowered.vote → city picker → confirm "Sacramento" appears under "California"
**Why human:** App rendering and city-list grouping cannot be verified programmatically.
**Data basis:** Sacramento municipality row exists in DB with state='CA', entity_type='city', and 28 budget rows loaded.

### 2. Visual rendering of criteria 2–5
While criteria 2–5 are data-verified (correct values confirmed in DB), the actual app UI rendering of budget totals, revenue tab, per-capita figures, and enrichment descriptions requires human eyes-on confirmation in a running browser session.

**Expected observations:**
- Operating tab FY2026 total: ~$1,537,138,014 (~$1.54B)
- Revenue tab: visible with FY data
- Per-capita: ~$2,868/resident
- Enrichment descriptions: visible for top categories (Police, Fire, Public Works, etc.)

---

## Summary

**Phase 26 goal status: DATA COMPLETE — visual confirmation deferred**

Sacramento CA is fully loaded:
- 14 operating FYs (FY2013–FY2026), latest FY2026 total $1,537,138,014 (~$1.54B)
- 14 revenue FYs (FY2013–FY2026), latest FY2026 total $1,566,967,530
- Population: 536,000 (Census 2024 vintage, sub-est2024_06.csv SUMLEV=162)
- 20 Sacramento-specific + 22 universal enrichment rows covering all top-level categories
- Implied per-capita: ~$2,868/resident for FY2026 operating

All data-verifiable success criteria (2, 3, 4, 5) are satisfied. Success criterion 1 (city picker visibility) and visual rendering of 2–5 are deferred to human app spot-check per the established Phase 22/25 deferral pattern.

---

_Verified: 2026-06-04_
_Verifier: Claude (gsd-executor, plan 26-02)_
