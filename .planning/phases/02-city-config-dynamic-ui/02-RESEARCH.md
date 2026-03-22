# Phase 2: City Config + Dynamic UI — Research

**Researched:** 2026-03-21
**Domain:** TypeScript config schema design, React prop-driven UI, city registry pattern
**Confidence:** HIGH — all findings are from direct codebase audit; no speculation

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CITY-01 | Each city has a config file defining name, slug, hero image URL, available datasets, and metadata (population, fiscal year) | Config schema designed; placement strategy identified; `treasuryConfig.json` provides precedent |
| CITY-02 | Dataset tabs render only the datasets configured as available for that city | `DatasetTabs.tsx` DATASETS constant is the control point; needs a prop filter added |
| CITY-03 | Context cards (population, per-resident cost, fiscal year) are driven by city config/metadata — not hardcoded | Currently pulled from `operatingBudgetData.metadata.*` which is correct — but hero title and image still need config; year list hardcoded |
</phase_requirements>

---

## Summary

Phase 1 extracted `CityPage.tsx` from `App.tsx` and wired routing, but left all city-specific strings hardcoded inside that component. The hero section (`backgroundImage` URL and `<h1>` text) are literal Bloomington strings at lines 337 and 346. The available years list is a hardcoded array at line 149. `CityPickerPage.tsx` hardcodes both the Bloomington card and the LA "Coming Soon" card as static JSX. `AppRouter.tsx` hardcodes `/bloomington` as the only real city route.

The fix is a two-part design: (1) a **city config type + per-city config file** (`src/config/cities/bloomington.ts`) that defines all the city-specific values, and (2) a **city registry** (`src/config/cityRegistry.ts`) that exports an array of all configs for iteration. `CityPage` reads config by slug and uses config values instead of literals. `CityPickerPage` maps the registry array to cards. `AppRouter` generates routes from the registry. `DatasetTabs` receives a filtered `availableDatasets` prop instead of always rendering all three tabs.

**Primary recommendation:** TypeScript config objects in `src/config/cities/` (not JSON in `public/`) because they are build-time constants used by React components, not runtime-fetched data. Colocating them in `src/` enables import, type-checking, and tree-shaking.

The context card values (population, fiscal year, per-resident cost) already flow from `operatingBudgetData.metadata` which is loaded from the JSON data files — these are already data-driven. The work here is (a) moving hero title and hero image URL to config, and (b) moving the year list to config.

---

## Codebase Audit — Hardcoded Bloomington Strings

Direct findings from `grep -rn "Bloomington|bloomington|Indiana" src/`:

| File | Line | Hardcoded Value | Fix Strategy |
|------|------|-----------------|-------------|
| `src/pages/CityPage.tsx` | 337 | `url('https://upload.wikimedia.org/...Monroe_County_Courthouse...')` | Replace with `cityConfig.heroImageUrl` |
| `src/pages/CityPage.tsx` | 346 | `<h1>Bloomington, Indiana Finances</h1>` | Replace with `<h1>{cityConfig.heroTitle}</h1>` |
| `src/pages/CityPage.tsx` | 149 | `const years = ['2025', '2024', '2023', '2022', '2021']` | Replace with `cityConfig.availableYears` |
| `src/pages/CityPickerPage.tsx` | 10–12 | `<Link to="/bloomington">` + `Bloomington, IN` | Replace with `.map()` over city registry |
| `src/pages/CityPickerPage.tsx` | 14–17 | LA "Coming Soon" `<div>` hardcoded | Replace with `.map()` over city registry |
| `src/AppRouter.tsx` | 9 | `<Route path="/bloomington" element={<CityPage slug="bloomington" />} />` | Replace with `.map()` over city registry |
| `src/components/datasets/DatasetTabs.tsx` | 20–46 | `DATASETS` constant always includes all three tabs | Add `availableDatasets` prop filter |

**Non-UI Bloomington strings (out of Phase 2 scope):**
- `src/data/budgetData.ts` — mock data file, not used by production UI (`src/pages/CityPage.tsx` does not import it)
- `src/data/processedBudget.json` — legacy file, not imported by any active component
- `budgetConfig.json` / `treasuryConfig.json` — ETL script configs, Phase 3 scope

**Confirmed: `src/data/budgetData.ts` is dead code.** The production `CityPage.tsx` loads data via `loadDataset()` from `public/data/{slug}/`, never importing from `src/data/`. This file can be noted as cleanup but is not blocking Phase 2.

---

## What Phase 1 Built (Foundation for Phase 2)

From `01-VERIFICATION.md`:

| Artifact | Relevance to Phase 2 |
|----------|----------------------|
| `src/pages/CityPage.tsx` (534 lines) | Already accepts `{ slug: string }` prop; all data fetches already use slug; this is the primary edit surface for config-driven UI |
| `src/AppRouter.tsx` | Currently has one hardcoded `/bloomington` route; Phase 2 must generate routes from registry |
| `src/pages/CityPickerPage.tsx` | Currently has two hardcoded cards; Phase 2 must render from registry |
| `public/data/bloomington/` | 31 JSON files, all namespaced; data files already include `cityName`, `population`, `fiscalYear` in `metadata` |
| `loadDataset()` in CityPage | Already parameterized by `citySlug` — no changes needed for Phase 2 |

**Key insight from Phase 1 decision log:** `CityPage` receives `slug` as a prop (not via `useParams`). This means the config lookup is `getCityConfig(slug)` at the top of `CityPage` — clean and explicit.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|-------------|
| TypeScript | ~5.9.3 (already in project) | Config type definitions | Already the project language; interfaces give compile-time safety |
| React | ^19.2.0 (already in project) | Config-driven component rendering | Already the UI framework |

No new libraries needed for Phase 2. This is a pure TypeScript/React refactor with config objects.

### Supporting
No additional packages required. The config pattern uses native TypeScript `interface` + `const` + module exports.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── config/
│   ├── cityRegistry.ts          # Array of all CityConfig objects; single source of truth
│   ├── cities/
│   │   └── bloomington.ts       # Bloomington CityConfig
│   └── types.ts                 # CityConfig interface + DatasetId type
```

This places config in `src/config/` because:
- It is build-time TypeScript, not runtime JSON fetch
- TypeScript compiler validates it; JSON in `public/` would not be type-checked at build time
- Import from components is a simple `import { getCityConfig } from '../config/cityRegistry'`
- No fetch latency — config is bundled into the app

### Pattern 1: CityConfig Interface

**What:** A TypeScript interface capturing all city-specific values the UI layer needs.

**What goes in config vs what stays in data files:**
- Config = values needed to RENDER the page shell (hero image, title, available tabs, year list)
- Data files = values computed from raw budget data (total budget, population used for per-resident math)
- Note: `population` is currently in BOTH the data JSON metadata AND must be in config for LA (which may not have all dataset years). For consistency, source population from config, not from `operatingBudgetData.metadata`.

```typescript
// src/config/types.ts

export type DatasetId = 'revenue' | 'operating' | 'salaries';

export interface CityConfig {
  /** URL slug, matches route path and data directory name */
  slug: string;
  /** Display name, e.g. "Bloomington" */
  name: string;
  /** Full display name with state, e.g. "Bloomington, IN" */
  displayName: string;
  /** Hero section title, e.g. "Bloomington, Indiana Finances" */
  heroTitle: string;
  /** Hero background image URL (absolute URL or public asset path) */
  heroImageUrl: string;
  /** Which datasets are available for this city */
  availableDatasets: DatasetId[];
  /** Available fiscal years, descending order (most recent first) */
  availableYears: string[];
  /** Default year to show on load */
  defaultYear: string;
  /** City population for per-resident cost calculation */
  population: number;
  /** Whether transactions drill-down is available */
  hasTransactions: boolean;
  /** Whether this city is live or a "coming soon" placeholder */
  isComingSoon?: boolean;
}
```

### Pattern 2: Per-City Config File

```typescript
// src/config/cities/bloomington.ts
import type { CityConfig } from '../types';

const bloomingtonConfig: CityConfig = {
  slug: 'bloomington',
  name: 'Bloomington',
  displayName: 'Bloomington, IN',
  heroTitle: 'Bloomington, Indiana Finances',
  heroImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Monroe_County_Courthouse_in_Bloomington_from_west-southwest.jpg',
  availableDatasets: ['revenue', 'operating', 'salaries'],
  availableYears: ['2025', '2024', '2023', '2022', '2021'],
  defaultYear: '2025',
  population: 79168,
  hasTransactions: true,
};

export default bloomingtonConfig;
```

### Pattern 3: City Registry

```typescript
// src/config/cityRegistry.ts
import type { CityConfig } from './types';
import bloomingtonConfig from './cities/bloomington';

// LA placeholder — isComingSoon: true means CityPickerPage renders
// a disabled card; AppRouter does NOT generate a route for it
const losAngelesPlaceholder: CityConfig = {
  slug: 'los-angeles',
  name: 'Los Angeles',
  displayName: 'Los Angeles, CA',
  heroTitle: 'Los Angeles Finances',
  heroImageUrl: '',
  availableDatasets: ['operating'],
  availableYears: [],
  defaultYear: '',
  population: 3900000,
  hasTransactions: false,
  isComingSoon: true,
};

export const CITY_REGISTRY: CityConfig[] = [
  bloomingtonConfig,
  losAngelesPlaceholder,
];

export function getCityConfig(slug: string): CityConfig | undefined {
  return CITY_REGISTRY.find(c => c.slug === slug);
}
```

**CRITICAL NOTE on `isComingSoon` and routing:** Cities with `isComingSoon: true` must NOT get a `<Route>` generated for them. The catch-all `<Route path="*" element={<Navigate to="/" replace />} />` in `AppRouter.tsx` already handles unknown slugs (redirects to `/`). Adding a real route for LA before Phase 4 would break the Phase 1 verified behavior (Truth 3: unknown slug redirects to `/`). The registry is used to render picker cards for all cities; `AppRouter` only generates routes for `isComingSoon !== true`.

### Pattern 4: Config-Driven CityPage

```typescript
// src/pages/CityPage.tsx — top of component body
export default function CityPage({ slug }: { slug: string }) {
  const cityConfig = getCityConfig(slug);

  // Guard: if config not found, redirect to home
  if (!cityConfig) {
    return <Navigate to="/" replace />;
  }

  // Replace hardcoded values:
  const [selectedYear, setSelectedYear] = useState(cityConfig.defaultYear);
  const years = cityConfig.availableYears;
  // hero image: cityConfig.heroImageUrl
  // hero title: cityConfig.heroTitle
  // population: cityConfig.population (use for formatPerResident)
```

### Pattern 5: Config-Driven AppRouter

```typescript
// src/AppRouter.tsx
import { CITY_REGISTRY } from './config/cityRegistry';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<CityPickerPage />} />
      {CITY_REGISTRY
        .filter(city => !city.isComingSoon)
        .map(city => (
          <Route
            key={city.slug}
            path={`/${city.slug}`}
            element={<CityPage slug={city.slug} />}
          />
        ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

### Pattern 6: Config-Driven CityPickerPage

```typescript
// src/pages/CityPickerPage.tsx
import { CITY_REGISTRY } from '../config/cityRegistry';

export default function CityPickerPage() {
  return (
    <div className="city-picker-page">
      <div className="city-picker-container">
        <h1 className="city-picker-heading">Choose a City</h1>
        <div className="city-picker-grid">
          {CITY_REGISTRY.map(city =>
            city.isComingSoon ? (
              <div key={city.slug} className="city-card city-card--disabled" aria-disabled="true">
                <span className="city-card-name">{city.displayName}</span>
                <span className="city-card-badge">Coming Soon</span>
              </div>
            ) : (
              <Link key={city.slug} to={`/${city.slug}`} className="city-card city-card--active">
                <span className="city-card-name">{city.displayName}</span>
                <span className="city-card-action">View budget -&gt;</span>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
```

### Pattern 7: Config-Driven DatasetTabs

`DatasetTabs` currently renders all three tabs from its internal `DATASETS` constant with no external control. The fix adds an `availableDatasets` prop and filters `DATASETS` before rendering.

```typescript
// Existing interface in DatasetTabs.tsx
interface DatasetTabsProps {
  activeDataset: string;
  onDatasetChange: (datasetId: string) => void;
  revenueTotal?: number;
  operatingTotal?: number;
  // ADD:
  availableDatasets: DatasetId[];
}

// Inside the component, replace DATASETS references with:
const visibleDatasets = DATASETS.filter(d => availableDatasets.includes(d.id));
// Then render visibleDatasets instead of DATASETS
```

`CityPage` passes `availableDatasets={cityConfig.availableDatasets}` to `DatasetTabs`.

**Active dataset guard:** If `cityConfig.availableDatasets` does not include the current `activeDataset` state, the component must reset to the first available dataset. This prevents a city with only `['operating']` from loading with a stale `'salaries'` active dataset.

```typescript
// In CityPage, reset activeDataset when city changes or if current is unavailable
useEffect(() => {
  if (!cityConfig.availableDatasets.includes(activeDataset)) {
    setActiveDataset(cityConfig.availableDatasets[0]);
  }
}, [slug, cityConfig.availableDatasets, activeDataset]);
```

### Anti-Patterns to Avoid

- **JSON in `public/` for city config:** Config would not be type-checked at build time and would require an async fetch before the page can render. Use TypeScript modules in `src/config/`.
- **Single monolithic `cities.ts` file:** Putting all city configs in one file creates merge conflicts when adding new cities. One file per city in `src/config/cities/` is the correct pattern.
- **Generating routes for `isComingSoon` cities:** Would break the Phase 1 redirect behavior (Truth 3). Only generate routes for live cities.
- **Reading population from `operatingBudgetData.metadata.population` for per-resident calculation:** This creates a dependency on the data file loading before the context card can render. Better to use `cityConfig.population` as the source of truth. The data file metadata `population` is an artifact of how the ETL script was written; config is the authoritative source.
- **Inline default for missing config:** Do not silently fall through to a hardcoded Bloomington default if `getCityConfig(slug)` returns `undefined`. Either redirect to `/` or throw — silent fallback is the bug Phase 1 was explicitly designed to eliminate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe config validation | Custom schema validator | TypeScript `interface` + compiler | TypeScript checks at build time; runtime validation unnecessary for build-time constants |
| Dynamic route generation | Custom route matching logic | React Router `<Routes>` with `.map()` | React Router already handles this cleanly |
| Config store / context | React Context for city config | Direct import `getCityConfig(slug)` in CityPage | Config is static, not reactive; no need for Context overhead |

---

## Common Pitfalls

### Pitfall 1: Active Dataset Out of Sync After Navigation
**What goes wrong:** User is on `/bloomington` viewing "Salaries" tab, navigates to `/` and then to a city with only `['operating']`. The `activeDataset` state in `CityPage` defaults to `'operating'` on mount (from `useState<DatasetType>('operating')`), so this is already safe on initial render — but if CityPage is ever reused across slugs without unmounting, stale state could persist.
**Why it happens:** React Router creates a new `CityPage` instance for each route because the route elements are different (`<CityPage slug="bloomington" />` vs `<CityPage slug="los-angeles" />`), so each city gets a fresh mount. This pitfall is therefore not currently a risk with the registry-driven route approach.
**How to avoid:** Keep the per-city routes as separate `<Route>` elements (the registry `.map()` approach does this). Do NOT use a single `<Route path="/:slug">` with a `useParams` hook — that would reuse the same component instance across cities and require manual state reset.
**Warning signs:** If you see stale data from a previous city after navigation.

### Pitfall 2: Hero Image URL Hardcoded in Config Gets Cached
**What goes wrong:** Dev changes `heroImageUrl` in config, reloads browser — still sees old image. This is a Vite HMR behavior; static string values in `.ts` files do hot-reload. Not a real problem, but worth knowing.
**How to avoid:** Not a blocker; just restart dev server if hot-reload seems stale.

### Pitfall 3: DatasetTabs `activeDataset` Prop Out of Sync with Visible Tabs
**What goes wrong:** `CityPage` passes `activeDataset="salaries"` to `DatasetTabs` but also passes `availableDatasets=["operating"]`. The tab renders without a salaries tab but `activeDataset` still says `"salaries"`.
**Why it happens:** If the guard `useEffect` that resets `activeDataset` hasn't run yet (first render before effects fire), there's a one-frame mismatch.
**How to avoid:** Also derive the default safely: `useState<DatasetType>(cityConfig.availableDatasets[0] as DatasetType)` so the initial state is always valid for the city.

### Pitfall 4: The Known Risk — 6 Hardcoded Bloomington Strings
The STATE.md risk note says "6 hardcoded Bloomington strings in App.tsx must be explicitly hunted." Phase 1 extracted App.tsx into CityPage.tsx. The audit above found exactly the strings — they are now in `CityPage.tsx` and `CityPickerPage.tsx`. The planner must create explicit tasks to replace each one. A config system alone will not eliminate them; each must be manually replaced.

**Full inventory (confirmed by codebase audit 2026-03-21):**
1. `CityPage.tsx:337` — hero `backgroundImage` URL
2. `CityPage.tsx:346` — `<h1>Bloomington, Indiana Finances</h1>`
3. `CityPage.tsx:149` — `years = ['2025', '2024', '2023', '2022', '2021']`
4. `CityPickerPage.tsx:10–12` — hardcoded Bloomington card
5. `CityPickerPage.tsx:14–17` — hardcoded LA Coming Soon card
6. `AppRouter.tsx:9` — hardcoded `/bloomington` route
7. `DatasetTabs.tsx:20–46` — all-three-tabs constant with no filter

The count is 7 locations (not 6 — the STATE.md count predates Phase 1 which moved things around). All are in the UI layer as expected.

---

## Context Card Values — Current State

The context cards in CityPage render:
```jsx
<h3>Total {operatingBudgetData.metadata.fiscalYear} Budget</h3>
<div>{formatCurrency(operatingBudgetData.metadata.totalBudget)}</div>
<div>Population ~{operatingBudgetData.metadata.population.toLocaleString()} residents</div>
<div>${formatPerResident(operatingBudgetData.metadata.totalBudget, operatingBudgetData.metadata.population)} per resident annually</div>
```

These values (`fiscalYear`, `totalBudget`, `population`) come from `operatingBudgetData.metadata` which is loaded from `public/data/bloomington/budget-{year}.json`. The `budget-2025.json` metadata contains:
```json
{
  "cityName": "Bloomington",
  "fiscalYear": 2025,
  "population": 79168,
  "totalBudget": 205848964.9
}
```

**Assessment:** `totalBudget` and `fiscalYear` SHOULD come from the data file (they are computed values). `population` could come from either — but for CITY-03 compliance, the `formatPerResident` call should use `cityConfig.population` so it works for cities where population may not be in every data file year. The `fiscalYear` displayed in the card title already comes from data, which is correct behavior.

**No hardcoded population constant exists in the UI code.** The "per-resident" calculation at `CityPage.tsx:213–216` uses `operatingBudgetData.metadata.population` as the denominator. This will work for Bloomington (population is in the data file) but for LA's `hasTransactions: false` config, the operating budget file may have different population values. Sourcing from `cityConfig.population` is more robust.

---

## Dataset Tab Configuration — What Drives Which Tabs Show

**Current state:** `DatasetTabs.tsx` hardcodes `DATASETS` array with `revenue`, `operating`, `salaries`. No external control; all three always render regardless of city.

**Required change:** Add `availableDatasets: DatasetId[]` prop to `DatasetTabsProps`. Filter `DATASETS` to `DATASETS.filter(d => availableDatasets.includes(d.id))` before rendering both the mobile dropdown and desktop tabs.

**Salaries totals:** The `DatasetTabs` component currently receives `revenueTotal` and `operatingTotal` as props but not `salariesTotal`. This is intentional (salaries total is shown separately). No change needed here.

**Active dataset state initialization:** `CityPage` currently initializes `activeDataset` to `'operating'` which is valid for Bloomington. For a city with only `['operating']` this is fine. This should be changed to `cityConfig.availableDatasets[0]` to be safe.

---

## City Picker — What Phase 1 Built vs What Phase 2 Needs

**Phase 1 built (from VERIFICATION.md Truth 1):**
```tsx
// CityPickerPage.tsx — current state
<h1 className="city-picker-heading">Choose a City</h1>
<Link to="/bloomington" className="city-card city-card--active">
  <span className="city-card-name">Bloomington, IN</span>
  <span className="city-card-action">View budget -></span>
</Link>
<div className="city-card city-card--disabled" aria-disabled="true">
  <span className="city-card-name">Los Angeles, CA</span>
  <span className="city-card-badge">Coming Soon</span>
</div>
```

Phase 1 verified the structure but explicitly left it as hardcoded placeholder (Phase 2 scope). The CSS classes (`city-card`, `city-card--active`, `city-card--disabled`, `city-card-name`, `city-card-action`, `city-card-badge`, `city-picker-grid`) already exist and are styled — Phase 2 only needs to replace the hardcoded JSX with a `.map()` over the registry, keeping the same CSS classes.

**`CityPickerPage.css`** exists at `src/pages/CityPickerPage.css` — the visual design is done.

---

## Validation Architecture

No test framework is currently configured for this project (no `vitest.config.*`, `jest.config.*`, `pytest.ini`, or `tests/` directory found; only `node_modules` test files). No `workflow.nyquist_validation` key exists in `.planning/config.json` (file does not exist).

**Since no test infrastructure exists and none is configured, the validation strategy for Phase 2 is TypeScript compilation + manual smoke tests, not automated unit tests.**

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured — TypeScript compiler only |
| Config file | none |
| Quick run command | `npx tsc --noEmit` (exits 0 = no type errors) |
| Full suite command | `npm run build` (tsc + vite build) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| CITY-01 | Config file exists with correct shape | TypeScript compile | `npx tsc --noEmit` | Interface mismatch = compile error |
| CITY-01 | Bloomington config has all required fields | TypeScript compile | `npx tsc --noEmit` | Missing field = compile error |
| CITY-02 | Tabs shown = tabs in config | Manual smoke | Start dev server, change `availableDatasets` in bloomington config to `['operating']`, verify only one tab renders | Cannot automate without test framework |
| CITY-03 | Context card values match config | Manual smoke | Start dev server, change `population` in config, verify per-resident number updates | Cannot automate without test framework |
| CITY-01 | City picker renders card per registry entry | Manual smoke | Start dev server, verify `/` shows Bloomington card and LA Coming Soon | Cannot automate without test framework |

### Wave 0 Gaps
- No test framework installed. For Phase 2, `npx tsc --noEmit` is the primary automated gate.
- If future phases add a test framework, recommend `vitest` (compatible with Vite project — same config system).

### Recommended Manual Verification Checklist for Phase 2
1. `npx tsc --noEmit` exits 0 (no TypeScript errors)
2. `npm run build` succeeds (bundler validates imports resolve)
3. Dev server: change `bloomingtonConfig.heroTitle` to `"Test Title"` → `/bloomington` hero shows "Test Title" (CITY-01 live test)
4. Dev server: change `bloomingtonConfig.availableDatasets` to `['operating']` → only "Money Out" tab visible (CITY-02)
5. Dev server: add a dummy city to CITY_REGISTRY with `isComingSoon: true` → city picker shows third "Coming Soon" card; `/dummy-slug` still redirects to `/`
6. Revert all test changes; confirm Bloomington behavior identical to post-Phase-1 state

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single-city hardcoded app (pre-v1.1) | Slug-parameterized CityPage (Phase 1) | Phase 2 can now bolt city config onto an already-parameterized shell |
| Config in `public/` JSON (fetched at runtime) | Config as TypeScript modules in `src/config/` | Build-time type safety; no fetch latency; tree-shakeable |

---

## Open Questions

1. **Should `population` come from config or from `operatingBudgetData.metadata`?**
   - What we know: Currently sourced from `operatingBudgetData.metadata.population` (line 363 in CityPage.tsx). The data file has this value for Bloomington.
   - What's unclear: For LA in Phase 4, the ETL pipeline may or may not embed population in every year's data file.
   - Recommendation: Source `population` from `cityConfig.population` in Phase 2. The ETL scripts (Phase 3) can still embed it in data files as a convenience, but `cityConfig` is the authoritative source for the UI.

2. **Should `hasTransactions` from city config gate the LinkedTransactionsPanel?**
   - What we know: `LinkedTransactionsPanel` is rendered inside CityPage when `currentCategory?.linkedTransactions` is truthy. For LA with `hasTransactions: false` in config, the linked budget JSON files won't have `linkedTransactions` data, so the panel won't render anyway.
   - What's unclear: Whether explicit gating in CityPage is needed or whether absence of data is sufficient.
   - Recommendation: Add `cityConfig.hasTransactions` guard in CityPage for clarity (`activeDataset === 'operating' && cityConfig.hasTransactions && currentCategory?.linkedTransactions`). Explicit is better than relying on data absence.

3. **What is the correct default year initialization for CityPage?**
   - Currently hardcoded: `useState('2025')`
   - Recommendation: `useState(cityConfig.defaultYear)` — simple change, no ambiguity.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit of `src/pages/CityPage.tsx` (534 lines, read in full)
- Direct codebase audit of `src/pages/CityPickerPage.tsx` (22 lines, read in full)
- Direct codebase audit of `src/AppRouter.tsx` (13 lines, read in full)
- Direct codebase audit of `src/components/datasets/DatasetTabs.tsx` (202 lines, read in full)
- Direct codebase audit of `src/types/budget.ts` (112 lines, read in full)
- `.planning/phases/01-routing-shell-data-namespacing/01-VERIFICATION.md` — confirmed what Phase 1 built
- `treasuryConfig.json` — existing per-city config structure (ETL scope)
- `public/data/bloomington/budget-2025.json` — confirmed metadata shape

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md` — project constraints and decisions

### Tertiary (LOW confidence)
- None — all findings from direct code inspection, no external sources required.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; pure TypeScript/React
- Architecture: HIGH — config-in-src pattern is idiomatic for build-time constants; all decisions grounded in actual codebase structure
- Pitfalls: HIGH — all pitfalls identified from direct code reading, not speculation
- Hardcoded string inventory: HIGH — confirmed by grep audit of entire `src/` directory

**Research date:** 2026-03-21
**Valid until:** Stable — no external dependencies; valid until codebase changes
