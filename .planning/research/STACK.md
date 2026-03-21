# Technology Stack: Multi-City Routing

**Project:** Treasury Tracker v1.1 — Multi-City Platform
**Milestone:** Add client-side routing, per-city config, data namespacing
**Researched:** 2026-03-21
**Overall confidence:** HIGH

---

## What This Document Covers

The existing codebase is React 19 + TypeScript + Vite, deployed to Netlify as a static SPA. This document covers only the stack additions and changes required to support:

1. A city picker landing page at `/`
2. Per-city routes at `/bloomington` and `/los-angeles`
3. Per-city config files loaded at runtime
4. Data file namespacing by city slug

It does not re-research the existing validated stack (React, D3, Recharts, Vite, Netlify, etc.).

---

## Recommended Stack Additions

### Routing Library

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-router` | ^7.13.1 | Client-side routing | Industry standard, React 19 supported, declarative mode fits the existing SPA pattern, no framework lock-in |

**Install:**
```bash
npm install react-router
```

**Import path:** `import { BrowserRouter, Routes, Route, useParams } from "react-router"`

Note: In React Router v7 the package name is `react-router`, not `react-router-dom`. All imports are from `"react-router"`. The `react-router-dom` package still exists as a thin re-export wrapper but the canonical package is `react-router` for v7.

**Why not TanStack Router:** TanStack Router offers stronger TypeScript inference and file-based routing, but its benefits are primarily felt in large apps with many routes. This milestone adds exactly two city routes plus an index. The added complexity (code generation, Vite plugin, file-based conventions) is not justified for a 3-route app. React Router v7 in declarative mode requires zero build tooling changes and is a zero-config addition.

**Why not hash-based routing or manual URL API:** Netlify already has the SPA catch-all redirect in place (`netlify.toml` line 12–14: `/* → /index.html 200`). History API (`BrowserRouter`) works without any Netlify changes. Hash routing (`HashRouter`) would produce ugly URLs like `/#/bloomington` and is the fallback for environments without server control — not needed here.

---

### No State Management Addition Needed

The city context (which city is active) can be derived from the URL via `useParams`. No Zustand, Redux, or React Context addition is required. The existing pattern of passing data down via props and reading route params in the city page component is sufficient.

---

## Netlify SPA Routing: No Changes Required

**HIGH confidence** — verified from `netlify.toml` directly.

The `netlify.toml` already contains:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This catch-all rewrite (status 200, not a redirect) means the server serves `index.html` for `/bloomington`, `/los-angeles`, and any other path. React Router's `BrowserRouter` then handles the path on the client side. No file changes are needed to Netlify config.

The `public/_redirects` file currently only has the API proxy rule and is missing the SPA catch-all. The `netlify.toml` rule takes precedence and is sufficient. The `_redirects` file does not need to be changed, but it is not redundant — `netlify.toml` rules process in order, so the existing API proxy rule (line 6–9) correctly precedes the catch-all.

---

## Per-City Config Pattern

### Config File Location

Per-city config files belong in `public/data/` as JSON, loaded at runtime via `fetch`. This follows the existing pattern (all JSON data already lives there and is fetched with `./data/{name}.json`).

Recommended path: `public/data/cities/{slug}/config.json`

Example: `public/data/cities/bloomington/config.json`

This is preferred over:
- Importing configs as ES modules (would require Vite rebuilds to add cities)
- A single combined `cities.json` (coarser granularity; harder to add cities incrementally)
- Top-level `public/data/bloomington-config.json` (pollutes the flat data directory)

### Config Schema

The existing `treasuryConfig.json` at the project root is a processing-time config (used by the `scripts/` ETL pipeline). The new per-city runtime config is a different concern. It should include only what the app needs at render time:

```typescript
interface CityConfig {
  slug: string;                    // "bloomington" | "los-angeles"
  name: string;                    // "Bloomington, Indiana"
  state: string;                   // "IN"
  population: number;              // For per-resident calculations
  fiscalYears: number[];           // Available years
  heroImage: string;               // URL or path to hero image
  datasets: {
    operating?: DatasetConfig;
    revenue?: DatasetConfig;
    salaries?: DatasetConfig;
    transactions?: DatasetConfig;
  };
}

interface DatasetConfig {
  label: string;
  description: string;
  colorPalette: string[];
}
```

Not every city will have every dataset. The `datasets` object uses optional keys so the UI can gracefully hide unavailable tabs.

### Config Loading

Use a simple `fetch` in a `useEffect` (or a custom `useCityConfig(slug)` hook) inside the city page component. This is consistent with how `loadDataset` works in the existing `dataLoader.ts`. The existing module-level `Map` cache in `dataLoader.ts` can be extended to cache config objects by slug as well.

No new library (SWR, React Query) is needed for this. The app has zero data-fetching libraries and none are warranted for loading a handful of small JSON files.

---

## Data File Namespacing

### Recommended Structure

Current (flat, Bloomington-only):
```
public/data/budget-2025.json
public/data/revenue-2025.json
```

Recommended (namespaced by city slug):
```
public/data/cities/bloomington/budget-2025.json
public/data/cities/bloomington/revenue-2025.json
public/data/cities/los-angeles/budget-2025.json
```

The fetch path in `App.tsx`'s `loadDataset` helper becomes:
```typescript
const response = await fetch(`./data/cities/${citySlug}/${fileName}-${year}.json`);
```

### Migration Approach

The existing Bloomington flat files (`public/data/budget-*.json`, etc.) can remain in place while migration is in progress. The `loadDataset` function can try the namespaced path first and fall back to the flat path for backwards compatibility during the transition. Once migration is complete, the flat files can be removed.

This avoids a hard cutover that breaks the existing app before the new routing is wired up.

---

## Vite Configuration: No Changes Required

**HIGH confidence** — verified from `vite.config.ts`.

The current config is:
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/',
})
```

`base: '/'` is already correct for root-level Netlify deployment with multi-city routes. No changes to `vite.config.ts` are needed to support `BrowserRouter` or the new routes.

---

## Routing Architecture

### Route Structure

Three routes in declarative mode:

```tsx
// src/main.tsx
import { BrowserRouter, Routes, Route } from "react-router";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<CityPicker />} />
        <Route path=":citySlug" element={<CityApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
```

Use a dynamic `:citySlug` segment rather than hardcoding `/bloomington` and `/los-angeles` as separate routes. This means adding a third city later requires only a new config file and data — no route code change.

The city picker (`/`) and city app (`/:citySlug`) are the only two routes. The existing drill-down navigation within a city (departments, categories) stays as component state (`navigationPath` array) — no nested routes are needed for that because the hierarchy is data-driven and arbitrarily deep.

### CityApp Component

`CityApp` is essentially the existing `App` component refactored to:
1. Read `citySlug` from `useParams()`
2. Load `public/data/cities/{citySlug}/config.json` to get city metadata
3. Pass `citySlug` into `loadDataset` for namespaced data file paths
4. Render a 404 state if `citySlug` does not match a known city

The existing `App.tsx` can be renamed/refactored into `CityApp.tsx`. The new `App.tsx` (or `main.tsx`) holds only the router shell.

---

## What NOT to Add

| Category | What to Avoid | Why |
|----------|--------------|-----|
| Routing | TanStack Router | Overkill for 3 routes; adds Vite plugin + code generation |
| Routing | `react-router-dom` (separate package) | Same as `react-router` in v7; just install `react-router` |
| Data fetching | SWR / React Query / TanStack Query | No benefit for static JSON files fetched once per session |
| State | Zustand / Redux | City slug is already in the URL; no global state needed |
| Config | Vite `import.meta.glob` for configs | Bakes all city configs into the bundle; prevents adding cities without a rebuild |
| Config | Single `cities-registry.json` with all city data embedded | Defeats incremental city onboarding; creates merge conflicts when multiple cities are in progress |
| Netlify | `_redirects` SPA catch-all | Already handled in `netlify.toml`; adding it to `_redirects` too creates rule duplication |
| Build | SSG / prerendering | No SEO requirement justifies the complexity; SPA is correct for this app |

---

## Installation

```bash
# Single new dependency
npm install react-router
```

That is the only `npm install` required for this milestone. All other changes are file creation and refactoring within the existing codebase.

---

## Summary of Changes

| File | Change Type | What Changes |
|------|-------------|-------------|
| `package.json` | Add dependency | `react-router` ^7.x |
| `src/main.tsx` | Refactor | Wrap with `BrowserRouter`, define `Routes` |
| `src/App.tsx` | Refactor → rename | Becomes `CityApp.tsx`; reads `citySlug` from `useParams()` |
| `src/App.tsx` (new) | Create | City picker landing page (`/`) |
| `src/data/dataLoader.ts` | Modify | Accept `citySlug` param; use namespaced paths |
| `public/data/cities/bloomington/config.json` | Create | Bloomington city config |
| `public/data/cities/bloomington/*.json` | Move/create | Namespaced data files |
| `netlify.toml` | No change | SPA catch-all already present |
| `vite.config.ts` | No change | `base: '/'` already correct |

---

## Sources

- React Router v7 docs (verified): https://reactrouter.com/start/library/installation — HIGH confidence
- React Router v7 changelog (verified): https://reactrouter.com/changelog — confirms v7.13.1, React 19 support — HIGH confidence
- React Router routing docs (verified): https://reactrouter.com/start/library/routing — HIGH confidence
- Netlify redirects docs (verified): https://docs.netlify.com/routing/redirects/ — HIGH confidence
- `netlify.toml` in project root — directly observed, no inference — HIGH confidence
- `vite.config.ts` in project root — directly observed — HIGH confidence
- `package.json` in project root — directly observed — HIGH confidence
