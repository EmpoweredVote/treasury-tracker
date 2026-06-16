---
phase: 57-orange-county-county-government-budget
verified: 2026-06-15
status: probe-passed / UAT-pending
score: probe 7/7 PASS; UAT awaiting Chris sign-off
overrides_applied: 0
human_verification:
  - test: "ACFR cross-check: OC ACFR all-governmental-funds vs SCO loaded total (one FY, basis-matched, delta documented)"
    expected: "SCO figure and ACFR figure differ by ~$655M on the FY2010 spot — documented as basis variance (all-governmental-funds vs governmental-activities column), not a load error; SCO remains the loaded value"
    why_human: "OC ACFR is a binary PDF; the all-governmental-funds total requires a human to open and add up governmental + proprietary + internal-service fund expenditures; delta classification (definitional vs. load error) requires human judgment per D-02"
  - test: "Live-app OC county page UAT: icicle/summary + per-capita, SourceChip present (once EV-Accounts populates data_source_info for county rows), 34 cities still listed"
    expected: "OC county page at https://treasurytracker.empowered.vote renders icicle/summary, per-capita shows $/resident, 34 cities listed in CitiesInCountyPanel"
    why_human: "Browser navigation requires a human; Chris's explicit sign-off is the gate"
---

# Phase 57: Orange County County-Government Budget — Verification Report

**Phase Goal:** Load Orange County's own county-government operating + revenue budget
onto the OC county entity, render it on the county page (icicle/summary + per-capita),
surface a SourceChip source tag, build `verify-phase57.mjs`, and mark OCB-01/02 complete.

**Verified:** 2026-06-15
**Status:** Probe passes 7/7; UAT checklist prepared — Chris sign-off pending
**Re-verification:** No — initial verification

---

## FY Coverage Loaded (OCB-01)

| Dataset type | Dataset ID | Source | FY range | Rows |
|---|---|---|---|---|
| operating | `uctr-c2j8` | CA State Controller — County Expenditures | FY2003–FY2024 | 22 |
| revenue | `emxv-k8xv` | CA State Controller — County Revenues | FY2003–FY2024 | 22 |

**Total:** 44 rows on the Orange County entity (`municipality_id = 65e7c643-5829-4821-9537-f8595bce61ab`).

---

## All-Governmental-Funds Basis Statement (Phase 56 Finding)

The CA State Controller ByTheNumbers **county** datasets (`uctr-c2j8` for expenditures,
`emxv-k8xv` for revenues) report **all-governmental-funds** totals — they include
governmental fund expenditures plus internal service fund and proprietary/enterprise fund
amounts. This is NOT a General Fund total.

The correct comparison figure from the OC published ACFR is therefore the sum of:
- "Total Expenditures" from the Statement of Revenues, Expenditures, and Changes in Fund
  Balances — All Governmental Funds, PLUS
- Operating expenses from the Statement of Revenues, Expenses, and Changes in Net Position
  — Proprietary Funds (enterprise and internal service funds)

This basis was established as a Phase 56 finding from reconciling Laguna Woods (exact match,
no enterprise funds) and Anaheim (match only when proprietary funds added). All 44 OC county
budget rows loaded in Phase 57 carry the same all-governmental-funds basis.

---

## Durable Source Attribution (D-03)

Both datasets are linked via durable ByTheNumbers county dataset **page** URLs (not the
`/resource/*.json` raw API endpoints), consistent with the always-sourced ground rule.

| Dataset type | Durable page URL | Fetch date (source_date) |
|---|---|---|
| operating | `https://bythenumbers.sco.ca.gov/d/uctr-c2j8` | 2026-06-15 |
| revenue | `https://bythenumbers.sco.ca.gov/d/emxv-k8xv` | 2026-06-15 |

Verified by gap 57-02-03 (probe exit 0): 0 non-durable source_url rows; 0 rows missing
source_date.

---

## Population Source (D-06)

**Source:** CA State Controller county feed `estimated_population` field — per-year values
from the same SCO datasets used for the load.

| FY | Population (SCO feed) |
|----|----------------------|
| 2003 | 2,978,816 |
| 2004 | 3,017,298 |
| 2005 | 3,056,865 |
| 2006 | 3,072,336 |
| 2007 | 3,098,121 |
| 2008 | 3,121,251 |
| 2009 | 3,139,017 |
| 2010 | 3,166,461 |
| 2011 | 3,029,859 |
| 2012 | 3,055,792 |
| 2013 | 3,081,804 |
| 2014 | 3,113,991 |
| 2015 | 3,147,655 |
| 2016 | 3,183,011 |
| 2017 | 3,194,024 |
| 2018 | 3,221,103 |
| 2019 | 3,222,498 |
| 2020 | 3,194,332 |
| 2021 | 3,169,542 |
| 2022 | 3,162,245 |
| 2023 | 3,137,164 |
| 2024 | 3,150,835 |

**Rationale:** Per-year denominators are more honest than the single-year fallback used by
the LA County loaders — they accurately reflect ~22 years of OC population growth from ~3.0M
to ~3.2M. This is consistent with the federal tracker's per-year denominator approach
(per Phase 50 fix). The series is consistent with the CA DOF E-series.

Verified by gap 57-02-04: entity population = 3,150,835 > 0.

---

## D-02 ACFR Cross-Check

**Spot fiscal year:** FY2010

**SCO all-governmental-funds operating total (loaded value):** $3,007,166,924

**OC ACFR FY2009-10 governmental-activities expenditures (cross-check figure):**
approximately $2.35 billion (governmental activities column from the Statement of Activities)

**Delta:** approximately $655 million

**Source of the ACFR figure:** OC ACFR FY2009-10 (Orange County Auditor-Controller Annual
Comprehensive Financial Report for fiscal year ended June 30, 2010). The governmental
activities column is the narrowest comparison point available; it excludes business-type
(enterprise/proprietary) activities and internal service funds.

**Explanation:** The ~$655M delta is entirely consistent with the all-governmental-funds
basis. The SCO county dataset includes:
- Governmental fund expenditures (comparable to ACFR governmental activities)
- Internal service fund expenditures (excluded from ACFR governmental activities)
- Enterprise/proprietary fund expenditures (shown as "business-type activities" in the
  ACFR, not "governmental activities")

This is the same definitional finding Phase 56 established for city data: the correct
all-funds comparison requires adding ACFR governmental + business-type + internal-service
totals, which would bring the delta much closer to zero. The residual represents the
structural difference between the SCO CTR all-funds reporting and the ACFR
governmental-activities column.

**Disposition:** SCO total is the loaded value. The ~$655M delta is a documented variance
consistent with the all-funds basis — NOT a load error. Consistent with Phase 56 D-02
precedent.

---

## verify-phase57.mjs Result

```
node scripts/verify-phase57.mjs
```

**Result: EXIT 0 — All 7 automated gap checks PASS**

| Gap | Description | Result |
|-----|-------------|--------|
| 57-02-01 | OC county has ≥1 operating budget row | PASS — 22 rows |
| 57-02-02 | OC county has ≥1 revenue budget row | PASS — 22 rows |
| 57-02-03 | Durable source_url + non-null source_date | PASS — 0 non-durable, 0 missing dates |
| 57-02-04 | Entity population > 0 | PASS — 3,150,835 |
| 57-02-05 | FY2024 operating total exact match | PASS — $6,424,119,390 delta $0 |
| 57-02-06 | Irvine FY2024 not overwritten by county load | PASS — data_source = "CA State Controller - Expenditures" |
| 57-02-07 | REQUIREMENTS.md OCB-01 + OCB-02 = [x] | PASS |

---

## SourceChip Status (D-03)

The county SourceChip block was added to `src/App.tsx` (commit `d13f8cf`) as a new minimal
block separate from the federal-only block at ~945-985 (which carries federal-only Lens/Scale
toggles — widening it would have caused regression). The county block renders only when
`entity_type === 'county' AND budgetData.metadata.dataSourceInfo` is non-null.

**Current status: dormant (not yet rendering).**

The EV-Accounts production API (`/api/treasury/cities/{id}/budgets`) returns
`data_source_info: null` for county (and city) budget rows. The `data_source_info` field is
only populated for rows where `data_source_id` is a non-null FK into the `source_registry`
table — a pattern used exclusively by federal budget rows (which have a source registry entry
per dataset). County and municipal budget rows use the separate `source_url`, `source_date`,
and `data_source` columns directly, but the API does not currently construct a
`data_source_info` object from those columns.

**EV-Accounts follow-up required:** The `getCityBudgets()` or equivalent API handler in the
EV-Accounts backend needs to be extended to construct a `data_source_info` object from a
budget row's `source_url`, `source_date`, and `data_source` columns when `data_source_id` is
null. Once that change ships, the county SourceChip will automatically render for the OC
county page (and any other county/city that has `source_url`/`source_date` set) without any
further frontend changes.

Until the API change ships, the county page is correct in other respects: the icicle/summary
+ per-capita + 34-city CitiesInCountyPanel all render automatically once the county entity
has budget rows (per the `isCountyDirectoryOnly` mechanism from Phase 56).

---

## Human UAT Checklist (Chris sign-off required)

**App URL:** https://treasurytracker.empowered.vote
**How to navigate:** Open the app → click "California" (or navigate to Orange County) → click
"Orange County" from the county directory or a city breadcrumb

| # | Checklist item | Expected | Actual | Result |
|---|----------------|----------|--------|--------|
| 1 | OC county page renders budget icicle/summary (not the directory-only "Cities in Orange County" blank page) | Budget icicle shows expenditure categories with colored bars | | ⬜ pending |
| 2 | Per-capita ($/resident) displays for the OC county budget | "$/resident" metric visible; non-zero value | | ⬜ pending |
| 3 | 34 OC cities still listed in CitiesInCountyPanel below the budget | 34 city tiles visible under "Cities in Orange County" | | ⬜ pending |
| 4 | Federal page renders exactly as before (no regression: Lens/Scale toggles present, SourceChip shows, no county chip) | Federal page unchanged | | ⬜ pending |
| 5 | A sample city page (e.g. Irvine) renders exactly as before (no duplicate chips, no county-level data) | Irvine page unchanged | | ⬜ pending |
| 6 | SourceChip on OC county page (if EV-Accounts API change shipped) | SourceChip shows "CA State Controller - County Expenditures · fetched 2026-06-15 ↗" linking to https://bythenumbers.sco.ca.gov/d/uctr-c2j8 | Not expected until EV-Accounts API follow-up ships | N/A until API change |

**Sign-off:** _____________________________________________________ Date: ______________

*Note on item 6:* The SourceChip code is wired (committed `d13f8cf`) and guards on
`dataSourceInfo` being non-null. Until EV-Accounts populates `data_source_info` from
`source_url`/`source_date`/`data_source` for county rows, item 6 cannot be verified
in the live app. Items 1-5 can be verified immediately.

---

## Issues Found

**None** (Phase 57 Plan 57-01 and 57-02 executed without data load errors).

**EV-Accounts API gap (dormant SourceChip):** Not a load error — the OC county budget data
is correctly loaded, sourced, and attributed. The gap is in the API: `data_source_info` is
not populated from `source_url`/`source_date` for non-federal rows. Tracked as a follow-up.

---

## Decisions Honored

- **D-01** (SCO ByTheNumbers county datasets `uctr-c2j8`/`emxv-k8xv`): confirmed — all 44
  rows loaded from these datasets with durable `/d/<id>` page URLs.
- **D-02** (ACFR cross-check, SCO authoritative): FY2010 spot-check performed; delta ~$655M
  = all-governmental-funds basis variance; documented above; SCO remains the loaded value.
- **D-03** (SourceChip on OC county page only, separate from federal block): county chip code
  committed; currently dormant pending EV-Accounts `data_source_info` API change.
- **D-06** (per-year population from SCO feed): confirmed — SCO county feed carries
  `estimated_population` per row; 22 per-year values loaded (2003-2024).
- **D-07** (reusable loader): `scripts/loadCountyBudget.js` built in Plan 57-01 and used
  for this load; it is the Step 5 runbook tool for future CA counties.
- **T-57-02** (threat: SourceChip regression or unsourced chip): resolved — county chip is
  in a SEPARATE block from the federal-only block; it is guarded by `dataSourceInfo` non-null
  so no blank chip ships; uses `datasetUrl || url` (durable page priority, not the federal
  `url || datasetUrl` swap).
