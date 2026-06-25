---
status: pending-human-verification
phase: 86-county-loads-data-model-linking
requirement: OHLINK-01
completed-by-wave: 3 (86-03)
created: 2026-06-25
---

## Ohio Navigation Human UAT — OHLINK-01

**What this verifies:** Ohio is navigable end-to-end in the live app — state hub selectable, county pages with data + per-capita, city US→Ohio→County→City breadcrumb, Cities-in-County panel populated.

**Reference cohort:** Virginia (Phase 81) — Ohio navigation is structurally identical. If VA works, Ohio works on the same code paths.

**App URL:** https://treasurytracker.empowered.vote

---

## Tests

### 1. Ohio hub selectable from top-level picker

**Steps:**
1. Open the app. Click the jurisdiction picker (top of page).
2. Scroll to (or type "Ohio" in) the "State Governments" section.

**Expected:** "Ohio" appears as a button in the "State Governments" section. Clicking it navigates to the Ohio hub page. The breadcrumb shows: **United States / Ohio / Operating Expenditures**.

**Spot-check:** The Ohio hub shows a Counties panel listing Ohio counties (e.g. Franklin County, Cuyahoga County, Hamilton County). The hub also shows cities for Ohio.

---

### 2. Ohio county page — data, per-capita, and Cities-in-County panel

**Steps:**
1. From the Ohio hub (or via the picker), navigate to **Franklin County**.

**Expected:**
- Page title: "Franklin County"
- Breadcrumb: **United States / Ohio / Franklin County / Operating Expenditures** (or Revenue, whichever is active)
- Financial data is present. FY2024 spot-check values:
  - Revenue total: **$1,811,422,000** (~$1.81B)
  - Revenue per capita: **~$1,445/resident** (Franklin County population 1,253,522)
  - Operating total: **$10,174,000** (~$10.2M)
- Source label: "Ohio Auditor of State Summarized Annual Financial Reports"
- **Cities in Franklin County** panel appears at the bottom of the page, listing at minimum: Bexley, Canal Winchester, Columbus, Dublin, Gahanna, Grandview Heights, Grove City, Groveport, Hilliard, New Albany, Obetz, Reynoldsburg, Upper Arlington, Westerville, Whitehall, Worthington (16 cities total).

---

### 3. Ohio city breadcrumb — US → Ohio → County → City

**Steps:**
1. From the Franklin County page, click **Columbus** in the Cities-in-County panel. Or navigate directly to Columbus via the picker (search "Columbus" under Ohio).

**Expected:**
- Breadcrumb: **United States / Ohio / Franklin County / Columbus / Operating Expenditures**
- All four breadcrumb links are clickable (clicking "Franklin County" navigates back to that county page; clicking "Ohio" navigates to the Ohio hub; clicking "United States" navigates to the US federal page).
- Columbus FY2024 spot-check:
  - Operating total: **$2,477,440,000** (~$2.48B)
  - Operating per capita: **~$2,711/resident** (Columbus population 913,985)
  - Revenue total: **$2,166,549,000** (~$2.17B)

---

### 4. A second county + city path — Cuyahoga County / Cleveland

**Steps:**
1. Navigate to **Cuyahoga County** (Ohio's most-populous county).

**Expected:**
- Breadcrumb: **United States / Ohio / Cuyahoga County / ...**
- FY2024 revenue spot-check: **~$1,684,463,166** (~$1.68B), per capita **~$1,366/resident** (pop 1,233,088)
- Cities-in-County panel lists Cleveland and surrounding cities.

2. Click **Cleveland** from the Cities-in-County panel.

**Expected:**
- Breadcrumb: **United States / Ohio / Cuyahoga County / Cleveland / ...**

---

## Known Gaps / Caveats

### 4 cities with no county link

The following 4 Ohio cities have `county_id = NULL` and will NOT show a county in their breadcrumb:

| City | Reason |
|------|--------|
| Delphos | In Allen County — Allen County has no AOS financial data in any workbook FY2016-2025 (not loaded as a municipality) |
| Lima | Same — Allen County not loaded |
| Germantown | Linked to Montgomery County via authored sourced override (Census Bureau + OH SOS) — RESOLVED |
| Ironton | Linked to Lawrence County via authored sourced override (Census Bureau + OH SOS) — RESOLVED |

Delphos and Lima show breadcrumb: **United States / Ohio / Delphos** (no county segment). This is correct behavior — the breadcrumb omits the county tier when `county_id` is NULL.

**Resolution path:** Allen County will appear if/when Ohio AOS publishes an Allen County workbook with a SOREACIFB_TotalGov financial tab. No blocker for the current milestone.

### Ohio state node pre-existing data

The Ohio state node has 10 pre-existing budget rows from "Ohio General Fund Operating Budget" (a prior load, different source, source_url=null). This means the Ohio hub page renders the budget dashboard rather than a directory-only view. This is analogous to Virginia's Phase 81 WR-05 situation and is tracked for Phase 88's source-chain audit. Not a blocker for OHLINK-01.

---

## Summary

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | Ohio picker + hub | Ohio in "State Governments"; hub navigable | pending |
| 2 | Franklin County — data + per-capita + Cities panel | $1.81B revenue, ~$1,445/cap, 16 cities listed | pending |
| 3 | Columbus breadcrumb US→OH→Franklin→Columbus | Full 4-level breadcrumb, $2.48B operating | pending |
| 4 | Cuyahoga County + Cleveland chain | $1.68B revenue, Cleveland in Cities panel | pending |

total: 4
passed: 0
pending: 4
