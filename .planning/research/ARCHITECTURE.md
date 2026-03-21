# Architecture Patterns: Multi-City Treasury Tracker

**Domain:** Multi-city civic finance SPA with static data pipeline
**Researched:** 2026-03-21
**Overall confidence:** HIGH — based on full codebase audit + stable framework patterns

---

## Recommended Architecture

The existing architecture is a one-component monolith: `App.tsx` owns everything. Adding multi-city support requires splitting App.tsx into a router shell plus a city-scoped tracker page, introducing a city config registry, and namespacing the data files and scripts. No backend or build-time changes are required; the SPA remains fully static.

### Target Architecture (post-v1.1)

```
Browser
  └── RouterShell (main.tsx + createBrowserRouter)
        ├── /                   → CityPickerPage   (NEW)
        └── /:citySlug          → CityTrackerPage  (App.tsx refactored + NEW)
              └── data loaded from public/data/{citySlug}/{dataset}-{year}.json
```

### Component Boundaries

| Component | Status | Responsibility | Communicates With |
|-----------|--------|---------------|-------------------|
| `RouterShell` | NEW — in `main.tsx` | Wraps `createBrowserRouter`; provides router context | React DOM |
| `CityPickerPage` | NEW — `src/pages/CityPickerPage.tsx` | Landing page: renders city grid from registry; links to `/:citySlug` | `cityRegistry.ts`, `react-router-dom` `Link` |
| `CityTrackerPage` | NEW — `src/pages/CityTrackerPage.tsx` | Reads `citySlug` from URL params; loads city config; orchestrates existing tracker UI | `App.tsx` logic (extracted), `cityConfig.ts`, `dataLoader.ts` |
| `App.tsx` (existing) | MODIFIED — becomes `CityTrackerPage.tsx` | All existing state/handlers preserved; city slug + config passed in rather than hardcoded | Unchanged children |
| `DatasetTabs` | MODIFIED | Receives `availableDatasets` from city config; renders only enabled datasets | `CityTrackerPage` |
| `cityRegistry.ts` | NEW — `src/config/cityRegistry.ts` | Exports typed array of all known `CityConfig` objects; single source of truth | `CityPickerPage`, `CityTrackerPage` |
| `cityConfig.ts` (type) | NEW — `src/types/cityConfig.ts` | `CityConfig` TypeScript interface | All above |
| `dataLoader.ts` | MODIFIED | `loadDataset(type, year, citySlug)` — resolves path to `./data/{citySlug}/{dataset}-{year}.json` | `CityTrackerPage` |

---

## Data Flow Changes

### Current (v1.0)

```
App.tsx
  → fetch('./data/budget-{year}.json')
  → fetch('./data/revenue-{year}.json')
  → fetch('./data/salaries-{year}.json')
  → fetch('./data/transactions-{year}-index.json')  (lazy)
```

### Target (v1.1)

```
CityTrackerPage (reads :citySlug from useParams)
  → cityConfig = cityRegistry.find(c => c.slug === citySlug)
  → fetch(`./data/{citySlug}/budget-{year}.json`)
  → fetch(`./data/{citySlug}/revenue-{year}.json`)
  → fetch(`./data/{citySlug}/salaries-{year}.json`)
  → fetch(`./data/{citySlug}/transactions-{year}-index.json`)  (lazy)
```

The `./data/` prefix is relative; in production Netlify serves it from `/data/{citySlug}/...` because `public/` maps to the site root. The change is purely a path prefix insertion.

---

## Config Structure Changes

### Current (single-city, build-time only)

```
treasuryConfig.json          ← root; used by scripts/ only
budgetConfig.json            ← legacy; used by scripts/ only
```

Neither file is loaded by the React app at runtime. All city-specific values (name, population) are baked into the processed JSON `metadata` fields.

### Target (v1.1)

**Option A — Per-city config files (recommended)**

```
cities/
  bloomington/
    config.json              ← city metadata + available datasets
  los-angeles/
    config.json              ← city metadata + available datasets

src/config/
  cityRegistry.ts            ← imports all city configs; exports typed array
  bloomington.ts             ← re-exports bloomington/config.json with TS type
  los-angeles.ts             ← re-exports los-angeles/config.json with TS type
```

The `cityRegistry.ts` is the runtime config — imported once at app startup, not fetched dynamically. This is correct for a Vite SPA: Vite will tree-shake and bundle only the configs actually imported. Adding a new city means adding a file + one import line in `cityRegistry.ts`.

The per-city `config.json` schema (interface `CityConfig`):

```typescript
interface CityConfig {
  slug: string;              // URL segment: "bloomington", "los-angeles"
  name: string;              // Display name: "Bloomington, Indiana"
  state: string;             // "IN", "CA"
  population: number;        // For per-resident cost calculation
  heroImageUrl: string;      // City landmark image
  fiscalYears: number[];     // Available years: [2021, 2022, 2023, 2024, 2025]
  availableDatasets: Array<'operating' | 'revenue' | 'salaries'>;
  // Optional per-dataset overrides (labels, etc.) — defer to v2
}
```

**Script-side config** stays in a parallel structure:

```
cities/
  bloomington/
    config.json              ← shared by app + scripts
    data/                    ← raw CSVs for Bloomington (replaces root data/)
  los-angeles/
    config.json
    data/                    ← raw CSVs for LA
```

Scripts discover city config via a `--city` CLI flag pointing at `cities/{slug}/config.json`.

---

## Routing Design

### Router Setup (`main.tsx`)

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  { path: '/', element: <CityPickerPage /> },
  { path: '/:citySlug', element: <CityTrackerPage /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
```

No nested routes are needed. The tracker's drill-down navigation is in-memory state (the existing `navigationPath` array), not URL-based navigation. This is the correct choice — it avoids URL complexity for a drill-down that resets on dataset switch anyway.

### `CityTrackerPage` reads the slug

```typescript
import { useParams, useNavigate } from 'react-router-dom';

function CityTrackerPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const navigate = useNavigate();
  const cityConfig = cityRegistry.find(c => c.slug === citySlug);

  if (!cityConfig) {
    // Unknown city slug — redirect to picker
    navigate('/');
    return null;
  }
  // ... pass cityConfig into the tracker state/loading logic
}
```

### Breadcrumb integration

The existing breadcrumb's first item currently reads "City". It should become a link back to `/`:

```typescript
{ label: cityConfig.name, onClick: () => navigate('/') }
```

---

## Netlify Redirect Requirements

The existing `netlify.toml` `/* → /index.html` catch-all already handles SPA routing correctly. No change is needed for routing to work.

However, the current redirect order matters. The rules are evaluated top-to-bottom; the API proxy rule (`/api/*`) must stay above the SPA catch-all. After adding city routes, the order remains:

```toml
# 1. API proxy (force = true, evaluated first)
[[redirects]]
  from = "/api/*"
  to   = "https://ev-backend-h3n8.onrender.com/:splat"
  status = 200
  force  = true

# 2. SPA catch-all (unchanged — handles / and /:citySlug)
[[redirects]]
  from = "/*"
  to   = "/index.html"
  status = 200
```

No additional rules are needed. The `public/data/{citySlug}/` files are served as static assets directly from Netlify's CDN, not through the SPA fallback — they will be accessible at `/data/bloomington/budget-2025.json` etc. without any redirect rule.

---

## Data File Namespacing

### Current layout

```
public/data/
  budget-2021.json
  budget-2021-linked.json
  ...
  revenue-2021.json
  ...
  salaries-2021.json
  ...
  transactions-2021.json
  transactions-2021-index.json
  ...
```

### Target layout

```
public/data/
  bloomington/
    budget-2021.json
    budget-2021-linked.json
    ...
    revenue-2021.json
    ...
    salaries-2021.json
    ...
    transactions-2021.json
    transactions-2021-index.json
    ...
  los-angeles/
    budget-2021.json
    ...
```

### Migration strategy for Bloomington (DATA-03)

Move files, update `dataLoader.ts` path template, keep the existing Netlify catch-all — no redirects needed from old paths because the old paths were never in the URL bar; they were `fetch()` calls from JS. Users have no bookmarked data-file URLs.

The rename is a one-time `mv public/data/*.json public/data/bloomington/` operation. It is safe.

---

## ETL Script Parameterization

### Current (hardcoded)

Each script reads `treasuryConfig.json` or `budgetConfig.json` from the project root. Config paths and output paths are relative to `__dirname`. City name, population, and fiscal years are all in those root config files.

### Target (PIPE-01)

Scripts accept a `--city` flag:

```bash
node scripts/processBudget.js --city bloomington
node scripts/processBudget.js --city los-angeles
```

The script resolves `cities/{slug}/config.json` for city-specific config, and writes output to `public/data/{slug}/{dataset}-{year}.json`.

`package.json` scripts become:

```json
"process-budget": "node scripts/processBudget.js --city bloomington",
"process-budget:la": "node scripts/processBudget.js --city los-angeles",
"process-all": "...",
"process-all:la": "..."
```

Or, more flexibly, a single `process-city.js` orchestrator that accepts `--city` and runs all four scripts for that city.

The config format already supports multi-dataset config via `datasets.*` keys in `treasuryConfig.json`. The only structural change is moving the config from the root into `cities/{slug}/config.json` and making the scripts accept a city argument to locate it.

**Backward compatibility:** During the transition, keep the root `treasuryConfig.json` as a symlink or keep it as Bloomington's config until the city directory structure is in place. Don't delete it until all scripts are updated and tested.

---

## New Components Detail

### `src/pages/CityPickerPage.tsx` (NEW)

Purpose: Landing page at `/`.

Renders a grid of city cards, one per entry in `cityRegistry`. Each card shows city name, state, hero image thumbnail, and links to `/{slug}`.

State: None (pure render from static config).

Dependencies: `cityRegistry.ts`, `react-router-dom Link`.

### `src/pages/CityTrackerPage.tsx` (NEW)

Purpose: The city-scoped tracker at `/:citySlug`. This is the refactored `App.tsx`.

Changes from `App.tsx`:
1. Reads `citySlug` from `useParams`
2. Looks up `CityConfig` from registry; redirects to `/` if not found
3. Passes `citySlug` to `loadDataset(type, year, citySlug)`
4. Passes `cityConfig.availableDatasets` to `DatasetTabs` (replaces hardcoded `DATASETS` constant)
5. Replaces hardcoded `"Bloomington, Indiana"` hero title and image URL with `cityConfig.name` and `cityConfig.heroImageUrl`
6. Replaces hardcoded population (from `operatingBudgetData.metadata.population`) — this already reads from the JSON metadata, so it will work automatically once data is correctly namespaced
7. Breadcrumb's first item links back to `/` using `useNavigate`

Everything else in `App.tsx` is unchanged: all state hooks, all handlers, all visualization rendering.

### `src/config/cityRegistry.ts` (NEW)

```typescript
import bloomington from '../../cities/bloomington/config.json';
import losAngeles from '../../cities/los-angeles/config.json';
import type { CityConfig } from '../types/cityConfig';

export const cityRegistry: CityConfig[] = [
  bloomington,
  losAngeles,
];
```

The registry drives both `CityPickerPage` (enumerate cities) and `CityTrackerPage` (look up by slug).

### `src/types/cityConfig.ts` (NEW)

Defines the `CityConfig` interface. Consumed by `cityRegistry.ts`, `CityPickerPage`, and `CityTrackerPage`.

---

## Modified Components Detail

### `src/data/dataLoader.ts` (MODIFIED)

The `loadDataset` function in `App.tsx` (not in `dataLoader.ts` — note: App.tsx has its own inline `loadDataset`, separate from the `loadBudgetData` in `dataLoader.ts`) must gain a `citySlug` parameter:

```typescript
async function loadDataset(type: DatasetType, year: number, citySlug: string): Promise<BudgetData>
```

Path template change:

```typescript
// Before
const response = await fetch(`./data/${fileName}-${year}.json`);

// After
const response = await fetch(`./data/${citySlug}/${fileName}-${year}.json`);
```

The module-level `dataLoader.ts` (`loadBudgetData`) should also be updated to accept `citySlug` and use the namespaced path, since it also contains a static fallback. However, at runtime `App.tsx` uses its own inline `loadDataset`, not `loadBudgetData`. This is a cleanup opportunity: either consolidate to one loader or update both to be consistent.

### `src/components/datasets/DatasetTabs.tsx` (MODIFIED)

Currently `DATASETS` is a module-level constant — hardcoded to the three dataset types with no regard for city availability.

For CITY-02 (datasets render only those configured for the city), `DatasetTabs` needs to accept an `availableDatasets` prop and filter:

```typescript
interface DatasetTabsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
  availableDatasets: Array<'operating' | 'revenue' | 'salaries'>;  // NEW
}
```

The `DATASETS` constant becomes a full registry; the component filters it by `availableDatasets` before rendering.

---

## Patterns to Follow

### Pattern: City context via props, not Context API

The city config should flow down as a prop from `CityTrackerPage` to children that need it (currently only `DatasetTabs` needs `availableDatasets`). Do not reach for React Context — the component tree is shallow enough that prop passing is cleaner and explicit. If more components need city config in the future, introduce a `CityContext` at that point.

### Pattern: Fail-fast on unknown city slug

When `CityTrackerPage` receives a slug not in the registry, redirect immediately to `/` rather than showing an error page. There is no meaningful content to show and users should not see a broken state.

### Pattern: Keep `navigationPath` as in-memory state, not URL

The existing drill-down uses an in-memory `navigationPath` array. Do not convert this to URL hash/query params as part of this milestone. It would be a significant scope expansion with no clear user value, and it complicates the back-button behavior.

### Pattern: Data files are the authority on metadata

`operatingBudgetData.metadata.cityName`, `.population`, `.fiscalYear` are already read from the JSON files in `App.tsx`, not from hardcoded values. The hero title and hero image URL are the only hardcoded values that need to be replaced with `cityConfig` fields.

---

## Anti-Patterns to Avoid

### Anti-Pattern: Dynamic registry fetch

Do not fetch a `cities.json` file at runtime to discover available cities. The registry is static — it changes only when a developer adds a city and deploys. Bake it into the bundle via `cityRegistry.ts` imports. Dynamic fetch adds latency, error handling complexity, and a loading state on the picker page for no benefit.

### Anti-Pattern: Rewriting App.tsx from scratch

`App.tsx` has a well-understood, working state machine for dataset loading and drill-down. The refactor to `CityTrackerPage` is additive: add `citySlug` as a parameter, thread it into `loadDataset`, replace hardcoded city string values. Do not reorganize state hooks or extract sub-hooks as part of this milestone — that is an unrelated concern.

### Anti-Pattern: Nested routes for drill-down

The drill-down navigation (`navigationPath`) must stay in-memory. Adding URL segments for each drill-down level would require `useParams` at every level, complicate the back button (browser back vs. our back button), and provide negligible shareability benefit at high implementation cost.

### Anti-Pattern: Migrating `dataLoader.ts` to the primary data path

`dataLoader.ts` is currently bypassed at runtime — `App.tsx` uses its own inline `loadDataset` helper. Do not consolidate these as part of this milestone; it is separate refactoring work and carries risk of introducing bugs in the data loading path.

---

## Suggested Phase Build Order

The order below preserves a working Bloomington experience at every step.

### Phase 1 — Routing Shell + City Picker (no data changes)

Outcome: App routes work; `/bloomington` shows the current tracker unchanged; `/` shows a placeholder city picker.

1. Install `react-router-dom` (v7)
2. Create `src/types/cityConfig.ts` interface
3. Create `cities/bloomington/config.json` with Bloomington's values
4. Create `src/config/cityRegistry.ts` importing Bloomington config
5. Rename `App.tsx` → `CityTrackerPage.tsx`; add `useParams` to read `citySlug`; pass `citySlug` to `loadDataset` (update path to `./data/${citySlug}/...`)
6. Create `src/pages/CityPickerPage.tsx` (minimal, just links for now)
7. Update `main.tsx` to use `RouterProvider` with the two routes
8. Move `public/data/*.json` to `public/data/bloomington/`
9. Smoke test: `/bloomington` works identically to v1.0

**Bloomington preservation check:** After step 8, `loadDataset` must use the namespaced path. If path and slug are updated in the same phase, Bloomington is never broken.

### Phase 2 — City Config + Dynamic Dataset Tabs

Outcome: City config drives hero, tabs, and metadata display.

1. Update `CityTrackerPage` to use `cityConfig.heroImageUrl` and `cityConfig.name` (replaces hardcoded Bloomington hero image URL and `<h1>` title)
2. Update `DatasetTabs` to accept `availableDatasets` prop
3. Pass `cityConfig.availableDatasets` from `CityTrackerPage` to `DatasetTabs`
4. Update `CityPickerPage` to render a real city grid from `cityRegistry`
5. Add "Back to Cities" navigation from `CityTrackerPage` breadcrumb first item

**Test:** Bloomington still works; changing `availableDatasets` in config correctly hides tabs.

### Phase 3 — ETL Script Parameterization

Outcome: Scripts accept `--city` flag; LA data can be processed.

1. Update `processBudget.js`, `processRevenue.js`, `processSalaries.js`, `processTransactions.js` to accept `--city` CLI flag
2. Script resolves `cities/{slug}/config.json`; writes to `public/data/{slug}/`
3. Add `cities/los-angeles/config.json`
4. Add `process-*:la` npm scripts
5. Update `package.json` to include per-city script variants
6. Test: Re-run Bloomington scripts with `--city bloomington`; output matches existing files

### Phase 4 — Los Angeles Data + Live

Outcome: `/los-angeles` works with real data.

1. Source LA data from data.lacity.org
2. Place raw CSV in `cities/los-angeles/data/`
3. Run LA processing scripts
4. Add `src/config/cityRegistry.ts` entry for LA
5. Test `/los-angeles` end-to-end
6. Verify Bloomington is unaffected

---

## Scalability Considerations

| Concern | At 2 cities | At 10 cities | At 50+ cities |
|---------|-------------|--------------|---------------|
| City config bundle size | Negligible | Negligible (JSON is tiny) | Still negligible — each config is ~500 bytes |
| Data file count in `public/data/` | ~30 files per city | ~300 files | Consider CDN-hosted data or a manifest; file count itself is not a Netlify concern |
| City picker UI | 2-card grid | 10-card grid | Needs search/filter — defer to v2 |
| Script maintenance | 1 `--city` flag per script | Same | Consider a unified `process-city.js` orchestrator |
| `cityRegistry.ts` | 2 imports | 10 imports | Still fine as static imports; dynamic `import()` not needed until 50+ |

---

## Integration Points Summary

| Integration Point | What Changes | Risk |
|------------------|-------------|------|
| `main.tsx` → `RouterProvider` | Wrap app in router; split into two routes | Low — additive |
| `App.tsx` → `CityTrackerPage.tsx` | Add `useParams`; pass `citySlug` to loader; replace hardcoded strings | Low — surgical changes |
| `loadDataset()` path template | Insert `/{citySlug}/` segment | Low — single string change |
| `public/data/` → `public/data/bloomington/` | Move files, update loader path | Medium — must be done atomically with loader change |
| `DatasetTabs` `DATASETS` | Add `availableDatasets` filter prop | Low — backward-compatible with default |
| `netlify.toml` | No change required | None |
| ETL scripts | Add `--city` flag + config path resolution | Medium — test with Bloomington re-run before LA |

---

## Sources

- Codebase audit: `/mnt/c/Treasury Tracker/src/App.tsx`, `src/data/dataLoader.ts`, `src/types/budget.ts`, `src/components/datasets/DatasetTabs.tsx` — HIGH confidence
- Existing config schema: `treasuryConfig.json`, `budgetConfig.json` — HIGH confidence
- Existing architecture docs: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` — HIGH confidence
- React Router v7 `createBrowserRouter` / `useParams` API — HIGH confidence (stable API, within training cutoff)
- Netlify SPA redirect pattern — HIGH confidence (stable pattern, confirmed in existing `netlify.toml`)
- Vite static asset serving from `public/` — HIGH confidence (Vite core behavior, unchanged across versions)

---

*Research date: 2026-03-21*
