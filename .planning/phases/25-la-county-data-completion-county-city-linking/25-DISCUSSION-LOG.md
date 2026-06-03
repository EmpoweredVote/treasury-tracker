# Phase 25: LA County Data Completion + County-City Linking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 25-la-county-data-completion-county-city-linking
**Areas discussed:** Data reload scope, City roster breadth, County page UI

---

## Data reload scope

### Q1: Replace all LA County data with county-government source?

| Option | Description | Selected |
|--------|-------------|----------|
| Full clean reload | Clear all operating + revenue rows, reload FY2021-2025 from county datasets (uctr-c2j8 + emxv-k8xv). Salaries unchanged. | ✓ |
| Surgical: FY2025 only | Leave FY2021-2024 (wrong source), only fix FY2025 orphan + missing revenue. | |

**User's choice:** Full clean reload
**Notes:** Existing FY2021-2024 data came from city-aggregate datasets, not the county government's own budget — bad data that needs to be replaced, not preserved.

---

### Q2: FY2026 county data?

| Option | Description | Selected |
|--------|-------------|----------|
| Check and include if available | Researcher queries Socrata for FY2026; load if published, cap at FY2025 if not. | ✓ |
| Cap at FY2025 | Don't try FY2026. | |

**User's choice:** Check and include if available

---

### Q3: Population value?

| Option | Description | Selected |
|--------|-------------|----------|
| 2020 Census value (same pattern as all other cities) | population = 10,014,009, population_year = 2020 | ✓ |
| 2024 vintage if available | Check Census sub-est2024 file for LA County FIPS | |

**User's choice:** 2020 Census value, consistent with all TX and OR municipalities

---

## City roster breadth

### Q1: Which cities get county_id?

| Option | Description | Selected |
|--------|-------------|----------|
| All 80+ LA County cities | Set county_id for every LA County city in DB — even those without budget data yet | ✓ |
| Only cities with budget data | Only LA City right now | |

**User's choice:** All 80+ LA County cities
**Notes:** County page should show full roster of incorporated cities; "coming soon" for those without data.

---

### Q2: Extend county linking to other CA cities?

| Option | Description | Selected |
|--------|-------------|----------|
| LA County only for now | SF, SD, Sacramento, Berkeley, Fremont get county_id = null | |
| All CA cities we can match | Seed San Diego County, Sacramento County, Alameda County rows; link matching cities | ✓ |

**User's choice:** All CA cities we can match
**Notes:** No budget data for non-LA counties in this phase — schema and linking only.

---

### Q3: San Francisco consolidated city-county?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave SF county_id null | SF is its own city-county government; no separate SF County entity needed | ✓ |
| Create SF County row + link | Would duplicate the budget confusingly | |

**User's choice:** Leave SF county_id null

---

## County page UI

### Q1: What does the county page show first?

| Option | Description | Selected |
|--------|-------------|----------|
| County budget first, cities panel below | Standard budget view (icicle, tabs), then "Cities in [County]" panel | ✓ |
| Budget only, no city panel | County page same as any city | |
| City panel first, budget secondary | County as container, not government entity | |

**User's choice:** County budget first, cities panel below

---

### Q2: How do cities without data appear in the county roster?

| Option | Description | Selected |
|--------|-------------|----------|
| Grayed out with "data coming soon" | All 88 cities, muted style | |
| Cities with data only | Sparse panel | |
| Separate sections | "Available now" + "Coming soon" labeled sections | ✓ |

**User's choice:** Separate sections (Available now / Coming soon)

---

### Q3: How does city → county navigation work?

| Option | Description | Selected |
|--------|-------------|----------|
| Breadcrumb chip above the budget | "Los Angeles County →" using existing Breadcrumb component | ✓ |
| Context badge in entity header | More prominent badge next to city name | |
| You decide | Leave placement to implementer | |

**User's choice:** Breadcrumb chip, reusing existing Breadcrumb component

---

## Claude's Discretion

None — all areas had explicit user decisions.

## Deferred Ideas

- Non-LA county budget data (San Diego County, Sacramento County, Alameda County government budgets)
- Texas county linking (Collin County, Dallas County)
- Oregon county linking (Multnomah County)
- Multi-county city modeling (edge case, not relevant to current DB)
