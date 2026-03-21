# External Integrations

**Analysis Date:** 2026-03-21

## APIs & External Services

**Empowered Vote Backend API:**
- Purpose: Primary data source for budget/categories when available; app works fully without it via static JSON fallback
- Base URL: `https://api.empowered.vote` (default) or `VITE_API_URL` env override
- Endpoints consumed (in `src/data/dataLoader.ts`):
  - `GET /treasury/budgets?city=...&year=...&dataset=...` - Fetch budget list
  - `GET /treasury/budgets/{id}/categories` - Fetch categories for a budget
  - `GET /treasury/cities` - List available cities
- Auth: None observed in frontend calls; unauthenticated GET requests
- Error handling: Full try/catch with silent fallback to static JSON if API unavailable
- SDK/Client: Native `fetch()`

**Netlify API Proxy:**
- Configured in `netlify.toml`: all `/api/*` requests are proxied to `https://ev-backend-h3n8.onrender.com/:splat`
- Status 200 forced (transparent proxy)
- Backend appears to be a separate service hosted on Render.com
- This proxy endpoint is distinct from the `api.empowered.vote` domain used in `dataLoader.ts`

## Data Storage

**Databases:**
- None - no client-side database
- All data is served as static pre-built JSON files from `public/data/`

**File Storage:**
- Local filesystem (build-time only): Raw source CSV files in `data/` directory
  - `data/operating_budget-all.csv` - Operating budget source
  - `data/revenue_budget-all.csv` - Revenue budget source
  - `data/checkbook-all.csv` - Salaries/payroll source
  - `data/payroll-all.csv` - Transactions source
  - `data/2024/annualFinancialReports/*.txt` - Annual financial report raw files
  - `data/2024/budgetData/*.txt` - Budget detail raw files
- Static JSON output served at runtime from `public/data/`:
  - `budget-{year}.json`, `budget-{year}-linked.json` (2021-2025)
  - `revenue-{year}.json` (2021-2025)
  - `salaries-{year}.json` (2021-2025)
  - `transactions-{year}.json` and `transactions-{year}-index.json` (2021-2025)
  - `processedBudget.json` (legacy)

**Caching:**
- In-memory JavaScript `Map` in `src/data/dataLoader.ts` (`cache` variable) - keyed by `{cityName}-{year}-{dataset}`; lives for the browser session only

## Authentication & Identity

**Auth Provider:**
- None - the application is intentionally anonymous/public-access
- No authentication, no user accounts, no sessions
- Described in design doc as: "accessible to anonymous users" (Inform Pillar)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, LogRocket, or similar)

**Logs:**
- `console.log` for successful data loads (e.g., `"Loaded budget from API: Bloomington 2025 (operating)"`)
- `console.warn` for API unavailability and fallback events
- `console.error` for fatal data load failures
- No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**
- Netlify (configured via `netlify.toml`)
  - Build command: `npm run build`
  - Publish directory: `dist`
  - SPA redirect: all `/*` routes → `/index.html` (status 200)
  - API proxy: `/api/*` → `https://ev-backend-h3n8.onrender.com/:splat`

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or similar config files present)
- Netlify likely handles build on push via Git integration (standard Netlify behavior)

**Backend Service:**
- Render.com hosts the `ev-backend` service (`ev-backend-h3n8.onrender.com`)
- Frontend proxies to it via Netlify's `/api/*` redirect
- This is a shared backend across the Empowered Vote platform

## Environment Configuration

**Required env vars:**
- `NPM_TOKEN` - GitHub Package Registry token; required at install time to pull `@chrisandrewsedu/ev-ui`; must be set in CI/CD and local dev

**Optional env vars:**
- `VITE_API_URL` - Override API base URL; defaults to `https://api.empowered.vote`; prefix `VITE_` means it is inlined at build time by Vite

**Secrets location:**
- No `.env` file committed to repo
- `NPM_TOKEN` referenced in `.npmrc` as `${NPM_TOKEN}` (shell variable interpolation)

## Webhooks & Callbacks

**Incoming:**
- None - purely a read-only data visualization tool; no form submissions, no payment callbacks, no webhook endpoints

**Outgoing:**
- None

## External Media

**Wikimedia Commons:**
- Hero image loaded at runtime directly from Wikimedia URL in `src/App.tsx`:
  `https://upload.wikimedia.org/wikipedia/commons/8/85/Monroe_County_Courthouse_in_Bloomington_from_west-southwest.jpg`
- No CDN or local copy; depends on external availability

## Package Registry

**GitHub Package Registry:**
- Scoped to `@chrisandrewsedu` namespace
- Registry URL: `https://npm.pkg.github.com`
- Configured in `.npmrc`; requires `NPM_TOKEN` for authentication
- Only `@chrisandrewsedu/ev-ui` is installed from this registry; all other packages use the standard npm registry

---

*Integration audit: 2026-03-21*
