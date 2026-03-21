# Roadmap: Treasury Tracker v1.1 — Multi-City Platform

**Milestone:** v1.1 Multi-City Platform
**Goal:** Transform Treasury Tracker from a Bloomington-only app into a reusable multi-city platform, with Los Angeles as the first second city.
**Granularity:** Standard
**Requirements:** 15 v1.1 requirements across 4 phases
**Created:** 2026-03-21

---

## Phases

- [ ] **Phase 1: Routing Shell + Data Namespacing** — Wire React Router, migrate Bloomington data to namespaced paths, and eliminate the silent mock-data fallback — all atomically to prevent broken data states
- [ ] **Phase 2: City Config + Dynamic UI** — Replace every hardcoded Bloomington string with config-driven values; city picker renders a real card grid; tabs, year selector, and context cards all read from city config
- [ ] **Phase 3: ETL Script Parameterization** — Generalize all processing scripts to accept `--city` flag; create LA city config with correct column mapping; document new-city onboarding
- [ ] **Phase 4: Los Angeles Data + Live** — Source LA budget data, run it through parameterized scripts, wire up `/los-angeles`, and verify Bloomington unaffected

---

## Phase Details

### Phase 1: Routing Shell + Data Namespacing

**Goal:** The app routes correctly via React Router; `/bloomington` works identically to v1.0; data files live in namespaced city paths with no silent fallback on 404.

**Depends on:** Nothing (first phase)

**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, DATA-01, DATA-02, DATA-03

**Success Criteria** (what must be TRUE when this phase completes):
1. Navigating to `/` shows a city picker page (even if minimal/placeholder)
2. Navigating to `/bloomington` displays the full budget tracker with all existing v1.0 behavior intact — same charts, drill-down, tabs, transactions
3. Navigating to `/los-angeles` (or any unknown city slug) redirects to `/` rather than rendering a broken or wrong-city state
4. Clicking the browser back button or a "back to cities" link from `/bloomington` returns the user to `/`
5. When a data file is missing or the path is wrong, the app shows a visible error message — not silent mock data

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Install react-router, migrate data files, extract CityPage, wire router shell
- [ ] 01-02-PLAN.md — Automated smoke checks + human verification of all 5 success criteria

---

### Phase 2: City Config + Dynamic UI

**Goal:** Every city-specific string, image, dataset tab, year selector, and context card value is driven entirely by city config — no hardcoded Bloomington references remain in the UI layer.

**Depends on:** Phase 1

**Requirements:** CITY-01, CITY-02, CITY-03

**Success Criteria** (what must be TRUE when this phase completes):
1. A city config file exists with a defined schema (name, slug, hero image URL, available datasets, population, fiscal year) and Bloomington has one
2. The hero section title and image on `/bloomington` come from the Bloomington config — not hardcoded strings — confirmed by changing the config and seeing the UI update
3. The dataset tabs shown for a city are only the tabs configured as available for that city; a city with only "operating" in its config shows one tab, not three
4. The per-resident cost and fiscal year badge on context cards display the values from city config, not hardcoded constants
5. The city picker at `/` renders a card for each entry in the city registry, including placeholder "coming soon" cards

**Plans:** TBD

---

### Phase 3: ETL Script Parameterization

**Goal:** All processing scripts are city-agnostic and accept a `--city` flag; Bloomington re-runs cleanly and produces identical output; LA has a correct config ready for data processing; new-city onboarding is documented.

**Depends on:** Phase 1

**Requirements:** PIPE-01, PIPE-02

**Success Criteria** (what must be TRUE when this phase completes):
1. Running `node scripts/processBudget.js --city bloomington` produces output identical to the previous Bloomington-only run — no regression
2. A `cities/los-angeles/config.json` exists with LA-specific hierarchy column names, population (~3.9M), fiscal year convention, `hasTransactions: false`, and `availableDatasets: ["operating"]`
3. A `NEW-CITY.md` (or equivalent) document exists that describes end-to-end steps to add a new city: where to get data, how to create a city config, how to run the scripts, and how to deploy

**Plans:** TBD

---

### Phase 4: Los Angeles Data + Live

**Goal:** `/los-angeles` is live with real LA operating budget data; Bloomington is confirmed unaffected.

**Depends on:** Phase 2, Phase 3

**Requirements:** LA-01, LA-02, LA-03

**Success Criteria** (what must be TRUE when this phase completes):
1. LA budget source data has been downloaded from data.lacity.org, with file size and row count verified before processing begins
2. LA data has been processed into app JSON format using the parameterized scripts, with output verified to have more than one top-level budget category and a non-zero total (~$12–14B range)
3. Navigating to `/los-angeles` shows a functional operating budget tracker with real LA data — correct city name, correct total, drillable hierarchy
4. Navigating to `/bloomington` after visiting `/los-angeles` shows Bloomington data unchanged — no cross-city data bleed

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Routing Shell + Data Namespacing | 0/2 | Planned | — |
| 2. City Config + Dynamic UI | 0/? | Not started | — |
| 3. ETL Script Parameterization | 0/? | Not started | — |
| 4. Los Angeles Data + Live | 0/? | Not started | — |

---

## Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| ROUTE-01 | 1 | City picker at `/` |
| ROUTE-02 | 1 | `/bloomington` works identically to v1.0 |
| ROUTE-03 | 1 | `/los-angeles` route exists (functional after Phase 4) |
| ROUTE-04 | 1 | Return to city picker from any city route |
| DATA-01 | 1 | Data files namespaced by city slug |
| DATA-02 | 1 | Data loader accepts city slug |
| DATA-03 | 1 | Bloomington data migrated to namespaced path |
| CITY-01 | 2 | Per-city config schema |
| CITY-02 | 2 | Dataset tabs driven by config |
| CITY-03 | 2 | Context cards driven by config |
| PIPE-01 | 3 | Scripts parameterized by `--city` flag |
| PIPE-02 | 3 | New-city onboarding documentation |
| LA-01 | 4 | LA data sourced from public portal |
| LA-02 | 4 | LA data processed into app JSON format |
| LA-03 | 4 | LA tracker live with operating budget |

**Coverage: 15/15 requirements mapped. No orphans.**

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Phase 1 bundles routing + data migration atomically | The silent mock-data fallback makes split commits dangerous — a 404 after file move looks like a working app with wrong numbers |
| Phase 3 is independent of Phase 2 | ETL parameterization shares only Phase 1 as a prerequisite; can begin in parallel with Phase 2 once Phase 1 merges |
| ROUTE-03 assigned to Phase 1, not Phase 4 | The route itself must exist from Phase 1; the LA data behind it is Phase 4. An unknown-slug redirect satisfies the routing requirement without requiring LA data |
| PIPE-02 (docs) assigned to Phase 3 | Onboarding docs are most accurate when written immediately after generalizing the scripts — while the decisions are fresh |

---
*Roadmap created: 2026-03-21*
