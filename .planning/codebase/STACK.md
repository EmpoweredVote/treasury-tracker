# Technology Stack

**Analysis Date:** 2026-03-21

## Languages

**Primary:**
- TypeScript ~5.9.3 - All source code in `src/` (strict mode enabled)
- TSX - React component files throughout `src/components/` and `src/App.tsx`

**Secondary:**
- JavaScript (ES Modules) - Build-time data processing scripts in `scripts/`
- CSS - Component-level stylesheets co-located with components in `src/components/`
- JSON - Configuration files (`treasuryConfig.json`, `budgetConfig.json`) and all public data files in `public/data/`

## Runtime

**Environment:**
- Browser (client-side SPA, no server runtime)
- Node.js - Used only for build-time data processing scripts in `scripts/`; no server component

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- GitHub Package Registry for the `@chrisandrewsedu` scoped packages (configured via `.npmrc`)
- Auth token required: `NPM_TOKEN` environment variable (referenced in `.npmrc`)

## Frameworks

**Core:**
- React ^19.2.0 - UI framework; SPA with no router, single-page navigation handled via component state
- React DOM ^19.2.0 - DOM rendering, entry point at `src/main.tsx`

**Build/Dev:**
- Vite ^7.2.4 - Build tool and dev server; configured in `vite.config.ts`; base path set to `/` for root-level deploy
- `@vitejs/plugin-react` ^5.1.1 - React Fast Refresh and JSX transform

**TypeScript Compilation:**
- Two tsconfig targets: `tsconfig.app.json` (browser, ES2022, `src/`) and `tsconfig.node.json` (Node ES2023, `vite.config.ts`)
- Both configs: strict mode, `noUnusedLocals`, `noUnusedParameters`, `noEmit` (Vite handles bundling)
- `erasableSyntaxOnly` enabled (no enums or namespaces)

## Key Dependencies

**Visualization:**
- d3 ^7.9.0 + @types/d3 ^7.4.3 - Powers the sunburst chart (`src/components/BudgetSunburst.tsx`) with direct SVG manipulation; used for hierarchy layout, arc generation, and animated transitions
- recharts ^3.5.1 - React-native chart library; available but usage concentrated in bar chart components

**UI Components:**
- `@chrisandrewsedu/ev-ui` ^0.1.6 - Proprietary shared component library from the Empowered Vote project; provides `SiteHeader`, `RadarChartCore`, and design tokens (colors, fonts, spacing); installed from GitHub Package Registry
- lucide-react ^0.562.0 - Icon library; used throughout for `ArrowLeft`, `Receipt`, `Building2`, `ChevronDown`, `Loader2`, etc.

**Infrastructure:**
- None - no state management library (React built-ins only: `useState`, `useEffect`, `useMemo`, `useCallback`)
- No routing library - navigation is purely component state (`navigationPath` array in `src/App.tsx`)
- No HTTP client library - native `fetch()` used throughout

## Configuration

**Environment:**
- `VITE_API_URL` - Optional env var; overrides default API base URL of `https://api.empowered.vote` (used in `src/data/dataLoader.ts`)
- `NPM_TOKEN` - Required for installing `@chrisandrewsedu/ev-ui` from GitHub Package Registry (referenced in `.npmrc`)
- No `.env` file committed; `.env*` patterns are gitignored via `*.local`

**Application Config:**
- `treasuryConfig.json` - Primary runtime config: city name, population, fiscal years (2021-2025), dataset definitions, color palettes, hierarchy fields, feature flags
- `budgetConfig.json` - Legacy config for operating budget only; superseded by `treasuryConfig.json`
- `vite.config.ts` - Vite build config; `base: '/'` for standalone root deployment

**Build:**
- `npm run build` → `tsc -b && vite build` → output to `dist/`
- `npm run process-*` → Node.js scripts that transform raw CSV data in `data/` into JSON files in `public/data/`
- `npm run process-all` → runs all four processors sequentially (budget, revenue, salaries, transactions)

## Platform Requirements

**Development:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version` file)
- npm with access to GitHub Package Registry (requires `NPM_TOKEN`)
- Raw CSV source data in `data/` directory for running data processing scripts

**Production:**
- Static site hosting (output is `dist/` with `index.html` + assets)
- Deployed on Netlify (configured via `netlify.toml`)
- Public data files served from `public/data/` (pre-built JSON, committed to repo)
- No server, no database, no backend runtime required for the frontend

---

*Stack analysis: 2026-03-21*
