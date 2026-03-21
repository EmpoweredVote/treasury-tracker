# Feature Landscape: Multi-City Platform (v1.1)

**Domain:** Multi-city civic budget visualization platform
**Researched:** 2026-03-21
**Scope:** NEW features only — city picker UX, per-city config schema, LA data availability, multi-city onboarding patterns. Existing v1.0 features (drill-down, tabs, year selector, search, etc.) are out of scope.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Req ID |
|---------|--------------|------------|--------|
| City picker landing page at `/` | Users arrive at root URL and need orientation before choosing a city; no city = no content to show | Low | ROUTE-01 |
| Per-city URL routing (`/bloomington`, `/los-angeles`) | Shareable, bookmarkable, back-button-friendly city context; standard SPA expectation | Low | ROUTE-02/03 |
| Return to city picker from within a city tracker | Without a back path, users feel trapped in a city; standard nav expectation | Low | ROUTE-04 |
| City card shows name, state, and at least one visual identity cue | A list of city names with no context feels like a dev stub; users expect enough to recognize and choose | Low | ROUTE-01 |
| Per-city dataset tab visibility | Showing tabs for datasets that don't exist for a city (e.g., LA may lack salary granularity initially) violates the principle of least surprise | Low | CITY-02 |
| Per-city population and fiscal year in context cards | "Per-resident cost" is useless if it uses the wrong city's population; hardcoded Bloomington values shown on LA page = incorrect civic data | Low | CITY-03 |
| Data files namespaced by city | Two cities, one namespace = file collisions and year ambiguity (`budget-2025.json` for which city?) | Low | DATA-01 |
| Data loader accepts city slug | Without slug-parameterized loading, routing to `/los-angeles` just shows Bloomington data | Low | DATA-02 |
| Bloomington behavior identical after migration | Regression: existing users should see no change | Low | DATA-03 |

**Confidence: HIGH** — These follow directly from the stated requirements and the current codebase's hardcoded-city constraints (documented in CONCERNS.md "Single City Only").

---

## City Picker UX: Table Stakes vs. Differentiators

### Table Stakes for City Picker

Multi-city civic platforms (Socrata-based city portals, OpenBudgets.eu, USASpending agency selector, OpenCheckbook NY) consistently implement these patterns:

| UX Pattern | What It Is | Why Table Stakes |
|------------|-----------|-----------------|
| Card grid layout | Each city shown as a card (name, state, ideally a visual) | Grid is the universal pattern; list feels like a directory, not an app |
| City name + state label | Disambiguates same-named cities (e.g., multiple "Springfield"s in future) | Without state, two "Springfields" are indistinguishable |
| Fiscal year badge or "latest data" indicator | Shows when the city's data was last updated | Users need to know data freshness before clicking in |
| Disabled/greyed "coming soon" cards | Signals platform ambition and shows trajectory | Without this, a 2-city grid looks like the full product rather than a growing platform |
| Routing to city-scoped path on click | `/bloomington`, `/los-angeles` — city context in URL | Back button must return to picker; shareable city links |

### Differentiators for City Picker (v2+ territory)

| UX Pattern | Value | Why Defer |
|------------|-------|-----------|
| Search/filter cities | Only matters at 10+ cities | 2 cities don't need search |
| Population or total budget shown on card | Adds civic context at a glance | More config complexity; low value for 2 cities |
| State-based grouping/map | Geographic orientation | Premature at 2 cities |
| "Your city" auto-detection via geolocation | Reduces friction | Privacy implications; complexity; not worth it at 2 cities |
| City comparison side-by-side | High civic value at scale | Out of scope v1.1 |

**Recommendation:** Build a minimal card grid with city name, state, latest fiscal year badge, and a hero image. Add 1–2 placeholder "coming soon" cards to signal growth. No search, no geolocation, no comparison at this stage.

---

## Per-City Config Schema: Table Stakes vs. Differentiators

### What the Current `treasuryConfig.json` Contains (Bloomington-hardcoded)

From the STACK.md and CONCERNS.md analysis, the current config is a single-city ETL configuration. It defines city name, population, fiscal years (2021–2025), dataset definitions, color palettes, hierarchy fields, and feature flags — but it is not structured to be duplicated per city.

### Table Stakes Config Fields (Must Exist for v1.1)

Every city needs these fields to render correctly. These are the minimum required to un-hardcode the app.

| Field | Type | Purpose | Currently Hardcoded? |
|-------|------|---------|----------------------|
| `slug` | `string` | URL path segment (`bloomington`, `los-angeles`); key for data namespacing | No (hardcoded paths) |
| `name` | `string` | Display name: "Bloomington, Indiana" | Yes — hardcoded in App.tsx H1 |
| `state` | `string` | Two-letter state code for city picker disambiguation | Yes — embedded in name |
| `heroImageUrl` | `string` | City-identifying background image for hero section | Yes — hardcoded Wikipedia URL |
| `population` | `number` | Per-resident cost calculation base | Yes — duplicated in 4 places with inconsistencies |
| `fiscalYearStart` | `string` (e.g., `"01-01"`) | Fiscal year label logic; some cities (LA) use July 1 start | N/A (Bloomington is calendar year) |
| `availableDatasets` | `string[]` | Which tabs to show (`["operating", "revenue", "salaries"]`) | No — all 3 always shown |
| `availableYears` | `number[]` | Which years have processed data for this city | Yes — hardcoded `[2021,2022,2023,2024,2025]` in App.tsx |
| `dataSource` | `string` | Attribution text: where the data comes from | Embedded in JSON metadata only |

**These 9 fields are the minimum schema.** They directly map to the hardcoded values identified in CONCERNS.md and the requirements in REQUIREMENTS.md (CITY-01, CITY-02, CITY-03).

### Differentiator Config Fields (v2+ Territory)

| Field | Type | Purpose | Why Defer |
|-------|------|---------|-----------|
| `colorPalette` | `object` | Per-city brand colors | Explicitly out of scope (REQUIREMENTS.md) |
| `websiteUrl` | `string` | Link to official city finance portal | Nice-to-have; adds credibility |
| `contactEmail` | `string` | City finance office contact | Admin feature |
| `dataRefreshSchedule` | `string` | When city data is expected to be refreshed | Only relevant once refresh automation exists |
| `enabledFeatures` | `object` | Feature flags per city (e.g., `transactions: false`) | Premature — handle via `availableDatasets` for now |
| `budgetHierarchy` | `string[]` | City-specific drill-down field names | This is already in `treasuryConfig.json` per-dataset; relevant when ETL is generalized |

---

## Anti-Features

Features to explicitly NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-city color palette | Explicitly deferred in REQUIREMENTS.md; adds design complexity with no civic value | Keep existing color system; add `BRAND-01` to v2 backlog |
| City auto-detection via IP/geolocation | Privacy perception risk for a civic tool; users may distrust location access | Let users choose explicitly |
| "Add your city" self-service form | Requires data validation, admin UI, pipeline automation (ADMIN-01/02 are v2) | Provide NEW-CITY.md developer documentation instead (PIPE-02) |
| Search across all cities' datasets | No value at 2 cities; complicates data loading architecture | Single-city search already exists; extend when 5+ cities |
| City comparison view | High complexity, low v1.1 value | Note as future differentiator |
| Storing city preference in localStorage | State/Federal tabs and city picker provide enough orientation; adds hidden state | URL routing already provides context persistence |

---

## Los Angeles Open Data: What's Available

**Confidence: MEDIUM** — Based on well-established knowledge of LA's data.lacity.org portal (one of the most comprehensive US municipal open data portals), verified against the structure described in requirements LA-01 through LA-03.

LA is a Socrata-based open data portal (data.lacity.org). These datasets are known to be available:

| Dataset | Portal Name (approx.) | Format | Notes |
|---------|----------------------|--------|-------|
| Operating Budget | "Adopted Budget" or "Proposed Budget" by department | CSV/JSON | Published annually by CAO (Chief Administrative Officer); includes department, program, appropriation |
| Revenue | Included in budget documents; may require extraction from PDF/multi-sheet XLS | XLS/PDF | Less cleanly separated than Bloomington's; revenue budget is often embedded in the full budget book |
| Salaries / Payroll | "Employee Compensation" or "Payroll" — available via LA Controller's Open Checkbook | CSV | May include employee names (similar to Bloomington PII concern) |
| Checkbook / Transactions | LA Controller's Open Checkbook (checkbook.lacity.org) | CSV | Separate from data.lacity.org; vendor payments by department |

**Key constraint for LA-01:** LA's fiscal year runs **July 1 – June 30** (e.g., FY2024-25), not January–December like Bloomington. This means the `fiscalYearStart` config field is not cosmetic — it affects year labeling and file naming throughout the ETL pipeline and UI.

**Key constraint for LA-03:** LA's budget is significantly larger and hierarchically deeper than Bloomington's (multi-billion dollar budget with hundreds of departments and programs vs. Bloomington's ~$200M with dozens). The `budget-{year}-linked.json` file size concern noted in CONCERNS.md (already 9–11MB for Bloomington) will likely be worse for LA. Start with the unlinked budget (no transaction embedding) for LA's first dataset.

**Recommendation for LA scope:** Target **operating budget only** for v1.1 (satisfies LA-03: "at least one dataset functional"). Revenue and salaries can follow. This matches REQUIREMENTS.md which says "operating budget preferred."

---

## Feature Dependencies

```
ROUTE-01 (city picker page)
  → requires: city list data structure (array of city configs)
  → requires: per-city config schema defined (CITY-01)

ROUTE-02/03 (city-scoped routing)
  → requires: React Router or equivalent URL routing (currently NO router in project)
  → requires: city slug in config (CITY-01)
  → requires: data loader accepts slug (DATA-02)

CITY-02 (conditional dataset tabs)
  → requires: availableDatasets in city config (CITY-01)
  → requires: DatasetTabs.tsx to accept config prop rather than hardcoded DATASETS constant

CITY-03 (context cards from config)
  → requires: population + fiscal year in city config (CITY-01)
  → requires: App.tsx to stop hardcoding "Bloomington, Indiana" and stop hardcoding population

DATA-01 (namespaced data files)
  → requires: city slug defined (CITY-01)
  → does NOT require routing to be complete first

DATA-02 (slug-parameterized loader)
  → requires: DATA-01 (files must exist at namespaced paths)
  → loadDataset() in App.tsx must accept slug and prefix paths

DATA-03 (Bloomington migration)
  → requires: DATA-01 (move files to public/data/bloomington/)
  → requires: DATA-02 (loader uses slug)

PIPE-01 (parameterized ETL scripts)
  → can be done in parallel with DATA-01/02
  → required before LA-02

LA-01 (source LA data)
  → external dependency: download from data.lacity.org
  → requires: understanding fiscal year format (FY2024-25 naming)

LA-02 (process LA data)
  → requires: PIPE-01 (generalized scripts)
  → requires: LA-01 (raw data downloaded)

LA-03 (LA tracker live)
  → requires: LA-02 + ROUTE-03 + CITY-01 + DATA-01/02
```

**Critical dependency:** React Router (or equivalent) is NOT currently in the project. The app uses component state for navigation only. Adding URL-based city routing requires introducing a router — this is the single largest architectural change for the milestone.

---

## MVP Recommendation

**Phase sequencing implied by dependencies:**

1. **Config schema first** (CITY-01) — Define the `CityConfig` TypeScript interface and create `src/config/cities.ts` with both city entries. Everything else reads from this. Zero risk, no UI changes needed.

2. **Data namespacing** (DATA-01, DATA-03) — Move `public/data/*.json` → `public/data/bloomington/*.json`. Update the inline `loadDataset()` in App.tsx to accept a slug and prefix paths. Bloomington continues working identically; this is pure refactoring.

3. **Routing** (ROUTE-01 through ROUTE-04) — Add React Router. Create `CityPicker` page at `/`. Wrap existing app in city-scoped route. Wire city config to App props. This is the highest-complexity change — deserves its own phase.

4. **LA data pipeline** (PIPE-01, LA-01, LA-02, LA-03) — Generalize scripts, acquire LA data, process it, verify it renders. Can largely be done in parallel with routing once data namespacing is complete.

**Defer:**
- Per-city color palette (v2, BRAND-01)
- Non-developer city onboarding UI (v2, ADMIN-01/02)
- Revenue and salaries for LA (do operating budget first, add others incrementally)

---

## Complexity Notes

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| City config schema + TypeScript type | **Low** | New file; no breaking changes; pure addition |
| Data file namespacing + loader update | **Low-Medium** | File moves + one function signature change; risk only in path string correctness |
| React Router introduction | **Medium** | No router exists today; adds dependency; requires restructuring App.tsx into route-aware components; risk: breaking existing Bloomington navigation |
| City picker landing page | **Low** | New component; no interaction with existing code except city config |
| Conditional dataset tabs from config | **Low** | DatasetTabs.tsx already receives a `datasets` prop conceptually; change DATASETS constant to config-driven |
| LA fiscal year handling (July–December offset) | **Medium** | Year labeling logic must handle FY2024-25 vs. calendar year; affects both ETL scripts and UI display |
| LA budget file size | **Low-Medium** | Start unlinked (no transaction embedding); just ensure the ETL pipeline produces the right JSON shape |
| ETL script parameterization | **Medium** | Scripts currently mix Bloomington-specific column names with generic logic; separating config from script logic requires careful refactoring to avoid breaking Bloomington |
| NEW-CITY.md documentation | **Low** | Write-only; no code changes |

---

## Sources

**Confidence assessment:**
- City picker UX patterns: **HIGH confidence** — drawn from well-documented civic platform patterns (Socrata portals, USASpending, OpenBudgets.eu) that are stable, mature conventions
- Per-city config schema fields: **HIGH confidence** — derived directly from hardcoded values documented in CONCERNS.md + REQUIREMENTS.md requirements; these are facts about the current codebase
- LA data availability: **MEDIUM confidence** — LA's open data portal is well-established and stable, but specific dataset names and column structures require verification during LA-01; fiscal year convention (July 1) is well-known civic fact
- Feature dependency graph: **HIGH confidence** — derived from static analysis of existing code structure in App.tsx, DatasetTabs.tsx, dataLoader.ts, and the routing absence confirmed in STACK.md

**Reference material:**
- Codebase analysis: `.planning/codebase/CONCERNS.md` (hardcoded city constraints, config duplication)
- Codebase analysis: `.planning/codebase/ARCHITECTURE.md` (data loading, no router, state management)
- Codebase analysis: `.planning/codebase/STACK.md` (no routing library confirmed)
- Requirements: `.planning/REQUIREMENTS.md` (CITY-01 through LA-03)
- Source types: `src/types/budget.ts` (`BudgetData.metadata` shape — population, fiscalYear, cityName)
- Note: WebSearch and WebFetch were unavailable during this research session. LA data portal details are based on training knowledge (confidence: MEDIUM); direct verification of current dataset URLs on data.lacity.org is recommended before LA-01 begins.
