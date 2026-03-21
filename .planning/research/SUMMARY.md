# Project Research Summary

**Project:** Treasury Tracker v1.1 — Multi-City Platform
**Domain:** Multi-city civic budget visualization SPA with static ETL pipeline
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

Treasury Tracker v1.1 transforms a working single-city civic budget tool into a multi-city platform. The existing foundation — React 19, TypeScript, Vite, Netlify static hosting — requires only one new runtime dependency (`react-router` v7) and a set of surgical refactors: introducing URL-based routing, per-city config files, and namespaced data file paths. The core architecture decision is to keep the SPA fully static with city context derived from the URL slug rather than introducing any backend, server-side rendering, or global state management. This is the correct approach for this use case and scales cleanly to 10+ cities without additional infrastructure.

The recommended implementation order is strictly dependency-driven: define the city config schema first (everything else reads from it), migrate Bloomington data to namespaced paths atomically with the data loader update, then introduce React Router to wire the two city routes and the landing page, and finally generalize the ETL scripts to accept a `--city` flag before sourcing and processing LA data. Each phase leaves Bloomington working identically to v1.0, which is the primary regression risk. Los Angeles support for v1.1 should be scoped to the operating budget only — revenue, salaries, and linked transactions are deferred until LA data column mapping and file-size constraints are understood.

The most dangerous risk in this milestone is the silent fallback chain in the existing data loader: when a `fetch()` 404s, the app falls back to mock data without surforing an error, meaning a broken data path looks like a working app with wrong numbers. This must be resolved (mock fallback removed, visible error state added) before file migration begins. A secondary risk is LA-specific: the budget hierarchy columns, fiscal year convention (July–June), transaction link-key format, and potential data file sizes all require LA-specific config rather than reuse of Bloomington processing logic.

---

## Key Findings

### Recommended Stack

The only new dependency required is `react-router` v7 (`npm install react-router`). All imports are from the `"react-router"` package (not `react-router-dom`). BrowserRouter in declarative mode is appropriate for a 3-route app; the existing `netlify.toml` catch-all redirect already handles SPA routing without any config changes. `vite.config.ts` with `base: '/'` is already correct.

No state management library, data fetching library (SWR/React Query), or SSG tooling is needed. City context is fully derivable from `useParams()`. Config files should be bundled at build time via static imports in `cityRegistry.ts`, not fetched at runtime, to avoid loading states on the city picker page.

**Core technologies:**
- `react-router` v7.13.1: Client-side routing — only new dependency; React 19 supported; zero build config changes
- `BrowserRouter` / `useParams`: City slug from URL — eliminates need for any global state
- `cities/{slug}/config.json`: Per-city runtime config — bundled via Vite static imports; allows incremental city onboarding without rebuilds
- `public/data/{slug}/`: Namespaced data files — city-scoped paths resolve file collisions and year ambiguity
- Existing Netlify catch-all: SPA routing — already present in `netlify.toml`, no changes required

See `.planning/research/STACK.md` for full rationale and what NOT to add.

### Expected Features

**Must have (table stakes) — v1.1:**
- City picker landing page at `/` with card grid (name, state, hero image, fiscal year badge)
- Per-city URL routing (`/bloomington`, `/los-angeles`) — shareable, bookmarkable, back-button-correct
- Return navigation from city tracker back to city picker
- Per-city config driving: available dataset tabs, hero image, city name in H1, population for per-resident cost
- Data files namespaced by city slug — no file collisions across cities
- Data loader accepts city slug — prevents wrong-city data rendering
- Bloomington behavior unchanged after migration — zero regression for existing users
- 1–2 "coming soon" placeholder city cards — signals platform growth trajectory

**Should have (competitive) — v1.1:**
- LA operating budget functional at `/los-angeles` (at minimum one dataset, per requirements LA-03)
- `availableDatasets` config field controlling which tabs appear — prevents broken tab states for cities without salary data
- `availableYears` config field driving year selector — prevents 404s when LA only has 2025 data

**Defer (v2+):**
- Per-city color palettes (explicitly out of scope per REQUIREMENTS.md)
- Search/filter cities (only meaningful at 10+ cities)
- City comparison view, geolocation auto-detection
- Self-service city onboarding UI (v2 admin feature — provide NEW-CITY.md docs instead)
- LA revenue and salary datasets (operating budget first for v1.1)

See `.planning/research/FEATURES.md` for LA data availability details and full dependency graph.

### Architecture Approach

The existing `App.tsx` monolith becomes `CityTrackerPage.tsx`, with its state and handlers preserved unchanged. A new `main.tsx` router shell wraps the two routes (`/` and `/:citySlug`). A new `CityPickerPage.tsx` handles the landing page. A `cityRegistry.ts` file holds a typed array of all city configs, imported statically by both pages. The `dataLoader` path template gains a `/{citySlug}/` segment. `DatasetTabs` gains an `availableDatasets` prop to filter tabs by city config. No other component changes are required.

**Major components:**
1. `RouterShell` (main.tsx) — wraps `BrowserRouter`; defines the two routes; no state
2. `CityPickerPage` (src/pages/) — reads from `cityRegistry`; pure render; links to `/:slug`
3. `CityTrackerPage` (src/pages/) — reads `citySlug` from `useParams`; looks up registry; passes config and slug into existing tracker logic; redirects to `/` on unknown slug
4. `cityRegistry.ts` (src/config/) — single source of truth for all city configs; statically imported
5. `cityConfig.ts` (src/types/) — `CityConfig` TypeScript interface consumed by all of the above
6. Modified `dataLoader` / inline `loadDataset` — slug-parameterized path template
7. Modified `DatasetTabs` — `availableDatasets` prop filters tab render

See `.planning/research/ARCHITECTURE.md` for full component detail, code sketches, and 4-phase build order.

### Critical Pitfalls

1. **Silent routing failure behind Netlify's catch-all** — Netlify serves `index.html` for every path, making `/bloomington` appear to "work" even without a React Router installed. Prevention: install and wire `react-router` before deploying city URLs; test direct URL navigation in a fresh tab, not just clicking links.

2. **Silent mock-data fallback when data files 404** — Moving `public/data/*.json` to namespaced paths before updating `loadDataset()` causes 404s that silently resolve to fabricated budget numbers (the existing mock fallback chain). Prevention: update the data loader path first, or do both atomically in one commit; remove the mock fallback entirely before migration.

3. **LA budget hierarchy columns don't match Bloomington's** — `processBudget.js` extracts `primary_function`, `priority`, `service`, `fund`, `item_category` by name. LA CSVs use different column names. Silent result: every LA category maps to "Uncategorized". Prevention: audit LA CSV columns before writing any processing config; create LA-specific hierarchy config.

4. **LA transaction linking is Bloomington-specific** — The `linkKey` format (`priority|service|fund|item_category`) will not match any LA transaction fields. For v1.1, explicitly set `hasTransactions: false` in LA config rather than silently shipping an empty transactions panel.

5. **LA data file sizes may exceed practical limits** — Bloomington transaction files are already 38–47MB. LA checkbook data could be 500MB+, exceeding Netlify's 100MB deploy limit. Prevention: download and check LA raw CSV size before any pipeline work; omit transactions for LA v1.1 if large.

See `.planning/research/PITFALLS.md` for 13 documented pitfalls with detection and mitigation steps.

---

## Implications for Roadmap

Research strongly supports a 4-phase structure, ordered by dependency chain. Each phase ends with Bloomington verified working. LA-specific work is isolated to phases 3 and 4.

### Phase 1: Routing Shell + Data Namespacing

**Rationale:** These two concerns share an atomic dependency — the data loader path must be updated in the same commit as the file migration to avoid the silent mock-data fallback (Pitfall 2). React Router must be wired before any city URLs go live (Pitfall 1). Both changes are pure infrastructure with no UI impact.

**Delivers:** App routes correctly via `BrowserRouter`; `/bloomington` works identically to v1.0; `/` shows a placeholder city picker; data files are in namespaced paths.

**Addresses:** ROUTE-01 through ROUTE-04, DATA-01 through DATA-03

**Avoids:** Pitfall 1 (routing-before-router), Pitfall 2 (file move before loader update), Pitfall 13 (cache key inconsistency)

**Key actions:**
- Install `react-router`; create `CityConfig` type; create `cityRegistry.ts` with Bloomington entry
- Rename `App.tsx` → `CityTrackerPage.tsx`; add `useParams`; pass slug to `loadDataset`
- Move `public/data/*.json` → `public/data/bloomington/` in the same commit as loader update
- Create `CityPickerPage.tsx` (minimal placeholder); update `main.tsx` with `RouterProvider`
- Remove mock data fallback; add visible error state for 404 fetches

### Phase 2: City Config + Dynamic UI

**Rationale:** Once routing is working, the hardcoded Bloomington strings in `CityTrackerPage` are a regression risk for LA — they will survive unless explicitly replaced. This phase eliminates all hardcoded city values and makes the UI fully config-driven.

**Delivers:** Hero title, hero image, dataset tabs, year selector, and per-resident cost all read from city config; city picker renders a real card grid; breadcrumb links back to `/`.

**Addresses:** CITY-01 through CITY-03

**Avoids:** Pitfall 5 (hardcoded Bloomington strings on LA page), Pitfall 8 (missing LA population), Pitfall 10 (year selector showing Bloomington years for LA), Pitfall 12 (DatasetTabs shows non-existent LA tabs)

**Key actions:**
- Replace hardcoded hero URL and city name string in `CityTrackerPage` with `cityConfig.*`
- Add `availableDatasets` prop to `DatasetTabs`; drive from city config
- Add `availableYears` to city config; derive year selector from config
- Build real `CityPickerPage` card grid from `cityRegistry`; add "coming soon" placeholder cards
- Grep for all remaining `"Bloomington"` / `"bloomington"` strings before closing phase

### Phase 3: ETL Script Parameterization

**Rationale:** LA data cannot be processed until the scripts accept a `--city` flag and resolve city-specific configs. This phase also creates the LA city config with correct hierarchy, population, and fiscal year fields — which must be done before any data is processed to avoid silent hierarchy mismatches.

**Delivers:** All processing scripts are city-agnostic; Bloomington re-runs cleanly with `--city bloomington`; LA config exists with correct column mapping ready for data.

**Addresses:** PIPE-01

**Avoids:** Pitfall 3 (LA hierarchy columns), Pitfall 4 (transaction link-key), Pitfall 6 (fiscal year mismatch), Pitfall 9 (Socrata CSV parser issues), Pitfall 11 (budgetConfig.json confusion)

**Key actions:**
- Delete `budgetConfig.json` (dead file, confusion risk)
- Add `--city` flag to all `scripts/process*.js`; resolve `cities/{slug}/config.json`
- Replace hand-rolled CSV parser with `csv-parse` or `papaparse` before processing LA data
- Create `cities/los-angeles/config.json` with correct hierarchy columns, population (~3.9M), fiscal year convention (July–June), `hasTransactions: false`, `availableDatasets: ["operating"]`
- Add `process-*:la` npm scripts; verify Bloomington re-run matches existing output

### Phase 4: Los Angeles Data + Live

**Rationale:** With parameterized scripts and a correct LA config in place, this phase is data acquisition and verification. It is isolated to LA and cannot break Bloomington.

**Delivers:** `/los-angeles` live with real operating budget data; Bloomington confirmed unaffected.

**Addresses:** LA-01 through LA-03

**Avoids:** Pitfall 7 (LA file size), Pitfall 9 (Socrata dataset ID instability)

**Key actions:**
- Download LA budget CSV from data.lacity.org; verify file size and row count before processing
- If transactions data exceeds ~20MB, skip transaction linking for LA v1.1 (already in config)
- Run LA processing scripts; verify output JSON has >1 top-level category, non-zero total (~$12–14B)
- Add LA to `cityRegistry.ts`; smoke test `/los-angeles` end-to-end
- Verify Bloomington unchanged at `/bloomington`

### Phase Ordering Rationale

- Phase 1 before Phase 2: Routing must exist before config-driven UI can be validated across cities
- File move and loader update must be in the same PR/commit: the mock fallback makes split commits dangerous
- Phase 3 before Phase 4: Scripts must be parameterized before LA data can be processed
- ETL parameterization (Phase 3) is independent of Phase 2 and can begin in parallel once Phase 1 is merged
- LA data acquisition has an external dependency (data.lacity.org download); start Phase 3 early to avoid blocking Phase 4

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (ETL Parameterization):** LA budget CSV column names are not confirmed — manual download and inspection required before writing LA hierarchy config (LA-01 is an external dependency)
- **Phase 4 (LA Data):** Socrata dataset IDs for the current LA fiscal year must be verified before download; dataset names and URLs can change annually

Phases with well-established patterns (skip research-phase):
- **Phase 1 (Routing Shell):** React Router v7 `BrowserRouter` + `useParams` is a stable, documented pattern; Netlify catch-all is already confirmed in repo
- **Phase 2 (City Config):** Prop-threading and TypeScript interface patterns are standard React; no novel patterns involved

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `react-router` v7 verified against official docs; `netlify.toml` and `vite.config.ts` directly inspected; no inference |
| Features | HIGH | Must-have features derived from direct CONCERNS.md and REQUIREMENTS.md analysis of the existing codebase; LA data availability is MEDIUM (portal is well-known, column names need field verification) |
| Architecture | HIGH | Based on full codebase audit of `App.tsx`, `dataLoader.ts`, `DatasetTabs.tsx`, `main.tsx`; all component boundaries are verified against existing code structure |
| Pitfalls | HIGH | 13 pitfalls all grounded in direct codebase observations (the mock fallback chain, hardcoded strings, CSV parser limitations are all documented in CONCERNS.md and code) |

**Overall confidence:** HIGH

### Gaps to Address

- **LA CSV column names:** Must be confirmed by downloading the actual dataset from data.lacity.org before writing `cities/los-angeles/config.json` hierarchy fields. Do not assume column names match Bloomington.
- **LA fiscal year file naming convention:** The decision to represent FY 2024-25 as `2025` (or another scheme) must be made explicit in the LA config and enforced in both ETL scripts and UI before processing begins.
- **LA transaction data volume:** File size must be audited before any pipeline work. If the LA checkbook exceeds ~20MB, the entire transaction-linking architecture is unsuitable and `hasTransactions: false` is the correct v1.1 posture.
- **`dataLoader.ts` consolidation:** Two `loadDataset` implementations exist (one live in `App.tsx`, one dead in `dataLoader.ts`). The milestone must decide whether to consolidate them or update both — leaving them diverged adds long-term maintenance risk.
- **Mock fallback removal:** Replacing the silent mock-data fallback with a visible error state is identified as a prerequisite for safe data migration. This should be treated as a Phase 1 blocker, not an optional cleanup.

---

## Sources

### Primary (HIGH confidence)
- `/mnt/c/Treasury Tracker/src/App.tsx` — direct codebase audit; inline `loadDataset`, hardcoded strings, year array
- `/mnt/c/Treasury Tracker/src/data/dataLoader.ts` — dead loader, mock fallback chain, cache key logic
- `/mnt/c/Treasury Tracker/netlify.toml` — SPA catch-all redirect confirmed present
- `/mnt/c/Treasury Tracker/vite.config.ts` — `base: '/'` confirmed correct
- `/mnt/c/Treasury Tracker/package.json` — no routing library confirmed absent
- `/mnt/c/Treasury Tracker/.planning/codebase/CONCERNS.md` — silent fallback risk, hardcoded city values, config duplication
- `/mnt/c/Treasury Tracker/.planning/codebase/ARCHITECTURE.md` — component boundaries, data flow
- React Router v7 official docs: https://reactrouter.com/start/library/installation
- React Router v7 changelog: https://reactrouter.com/changelog — v7.13.1, React 19 support confirmed
- Netlify redirects docs: https://docs.netlify.com/routing/redirects/

### Secondary (MEDIUM confidence)
- LA open data portal (data.lacity.org / Socrata) — fiscal year structure (July–June) is a well-established public fact; specific dataset IDs and current column names require field verification
- LA city budget scale (~$12–14B total, ~3.9M population) — derived from publicly available budget summaries; verify current-year figures when sourcing data

### Tertiary (LOW confidence)
- LA Socrata CSV export format quirks (multi-line quoted fields, metadata header rows) — based on general Socrata platform behavior; must be confirmed on the specific LA dataset export

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
