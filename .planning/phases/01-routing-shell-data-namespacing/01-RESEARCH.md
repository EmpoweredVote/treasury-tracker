# Phase 1: Routing Shell + Data Namespacing - Research

**Researched:** 2026-03-21
**Domain:** React Router v7 (declarative mode), Vite static deploy, client-side routing, public asset path management
**Confidence:** HIGH

---

## Summary

Phase 1 wires React Router into a currently router-less React 19 / Vite 7 SPA so that `/bloomington` renders the existing budget tracker, `/` renders a placeholder city picker, and unknown slugs redirect to `/`. Simultaneously it migrates all data files from `public/data/` to namespaced paths (`public/data/bloomington/`) and replaces the silent mock-data fallback in `dataLoader.ts` with a hard error — all in one atomic commit.

The existing codebase has no router at all. `main.tsx` renders `<App />` directly; `App.tsx` contains the entire budget tracker with hardcoded Bloomington strings and a `loadDataset()` function using relative `./data/` paths. A separate `dataLoader.ts` (dead code — never imported by `App.tsx`) has a three-tier fallback that ends in mock data. There are **three distinct fetch locations** that all need path updates: `App.tsx` (primary data loader), `LinkedTransactionsPanel.tsx` line 67 (transaction index loader, confirmed), and potentially `processedBudget.json` in `public/data/` (see Open Questions).

The core technical challenge is not the router itself (straightforward `BrowserRouter` + `Routes` + `Route`) but the atomic coupling: moving data files changes fetch paths, which would silently break the app under the current fallback — so mock-data removal is a Phase 1 blocker, not optional cleanup.

**Primary recommendation:** Install `react-router` 7.13.1 in declarative mode (BrowserRouter). Wrap `main.tsx` in `<BrowserRouter>`. Create a `CityPage` component that wraps the existing App logic for `/bloomington`. Migrate all files in `public/data/` to `public/data/bloomington/`. Update ALL three fetch locations to use absolute paths with city slug: `loadDataset()` in App.tsx, and the transaction index fetch in `LinkedTransactionsPanel.tsx`. Remove or stub out `dataLoader.ts` mock-data fallback so a 404 throws visibly.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | User sees a city picker at `/` showing all available cities | React Router `<Route path="/" element={<CityPicker />}>` with placeholder component; no config system needed in Phase 1 |
| ROUTE-02 | User navigates to `/bloomington` and gets the full existing tracker | `<Route path="/bloomington" element={<CityPage slug="bloomington" />}>` wrapping existing App logic |
| ROUTE-03 | User navigates to `/los-angeles` and an unknown slug redirects to `/` | Catch-all `<Route path="*" element={<Navigate to="/" replace />}>` handles all unknown slugs including `/los-angeles` |
| ROUTE-04 | User on any city route can return to the city picker | `<Link to="/">` or `<button onClick={() => navigate('/')}>` in city page header; browser back works automatically |
| DATA-01 | Data files namespaced by city slug | Move `public/data/*.json` to `public/data/bloomington/*.json`; 22 files total (5 years x 4 types + linked + index variants) |
| DATA-02 | App data loader accepts city slug and loads from correct namespaced path | Update `loadDataset()` in App.tsx AND transaction index fetch in `LinkedTransactionsPanel.tsx` — both need city slug and absolute paths |
| DATA-03 | Bloomington data migrated to namespaced path with identical behavior | File move + both path updates; verify all 5 years load correctly for all 3 dataset types, including transaction drill-down |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | 7.13.1 | Client-side routing (BrowserRouter + Routes + Route) | v7 is current; declarative mode is identical API to v6 with no breaking changes for this use case |

**No other new dependencies are required for this phase.**

**Installation:**
```bash
npm install react-router@7.13.1
```

**Version verification:** Confirmed 7.13.1 via `npm view react-router-dom version` on 2026-03-21. React Router v7 supports `react >= 18`; this project uses React 19.2.0, which satisfies the peer dependency.

### Package name note

React Router v7 consolidates `react-router` and `react-router-dom` into a single package: `react-router`. Import from `react-router`, not `react-router-dom`. The `react-router-dom` package still exists on npm as an alias but the canonical package is `react-router`.

```tsx
// Correct for v7
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router';
```

---

## Architecture Patterns

### Recommended Route Structure

```
src/
├── main.tsx              # Add BrowserRouter wrapper here
├── App.tsx               # Rename concern: becomes CityPage.tsx (or keep App.tsx as router shell)
├── pages/
│   ├── CityPickerPage.tsx    # New: placeholder city picker at /
│   └── CityPage.tsx          # Extracted from App.tsx: the budget tracker
└── components/
    └── LinkedTransactionsPanel.tsx   # Needs citySlug prop added
```

### Pattern 1: BrowserRouter in main.tsx

**What:** Wrap the root render in `<BrowserRouter>` so all descendants can use router hooks.
**When to use:** Always in a Vite SPA with no SSR.

```tsx
// src/main.tsx
// Source: https://reactrouter.com/start/declarative/installation
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import AppRouter from './AppRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
```

### Pattern 2: Route shell with catch-all redirect

**What:** `Routes` with explicit city routes and a wildcard `Navigate` redirect for unknown slugs.
**When to use:** Exactly this scenario — known slugs render content, all others redirect to root.

```tsx
// src/AppRouter.tsx
import { Routes, Route, Navigate } from 'react-router'
import CityPickerPage from './pages/CityPickerPage'
import CityPage from './pages/CityPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<CityPickerPage />} />
      <Route path="/bloomington" element={<CityPage slug="bloomington" />} />
      {/* Phase 1: unknown slugs redirect to picker */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

**Note on `replace` vs `push`:** Use `replace` on the catch-all so hitting back after being redirected from `/los-angeles` takes the user back to where they came from, not into a redirect loop.

### Pattern 3: CityPage as a thin wrapper around existing App logic

**What:** Extract the existing `App.tsx` content into a `CityPage` component that accepts `slug` as a prop. This is the minimal-risk approach — no logic changes, just extraction.
**When to use:** Phase 1 only. Phase 2 will replace hardcoded strings with config anyway.

```tsx
// src/pages/CityPage.tsx
interface CityPageProps {
  slug: string;
}

export default function CityPage({ slug }: CityPageProps) {
  // Existing App.tsx logic moved here verbatim,
  // except loadDataset calls now pass slug
  // Pass slug down to LinkedTransactionsPanel as well
  // ...
}
```

### Pattern 4: Placeholder city picker

**What:** A minimal component at `/` that satisfies ROUTE-01 without requiring the full Phase 2 config system.

```tsx
// src/pages/CityPickerPage.tsx
import { Link } from 'react-router'

export default function CityPickerPage() {
  return (
    <div className="city-picker">
      <h1>Choose a City</h1>
      <Link to="/bloomington">Bloomington, IN</Link>
    </div>
  )
}
```

Phase 2 will replace this with a real config-driven card grid.

### Pattern 5: Namespaced data loader

**What:** Update `loadDataset()` to accept `citySlug` and construct the correct absolute path.

```tsx
// Before (in App.tsx)
async function loadDataset(type: DatasetType, year: number): Promise<BudgetData>
const linkedResponse = await fetch(`./data/${fileName}-${year}-linked.json`);
const response = await fetch(`./data/${fileName}-${year}.json`);

// After
async function loadDataset(type: DatasetType, year: number, citySlug: string): Promise<BudgetData>
const linkedResponse = await fetch(`/data/${citySlug}/${fileName}-${year}-linked.json`);
const response = await fetch(`/data/${citySlug}/${fileName}-${year}.json`);
```

### Pattern 6: LinkedTransactionsPanel citySlug prop

**What:** `LinkedTransactionsPanel.tsx` line 67 fetches `./data/transactions-${fiscalYear}-index.json` directly — a relative path that breaks under routing AND uses the wrong (un-namespaced) path. Pass `citySlug` as a prop.

```tsx
// Before (LinkedTransactionsPanel.tsx line 67)
const response = await fetch(`./data/transactions-${fiscalYear}-index.json`);

// After
// Add citySlug to component interface:
interface LinkedTransactionsPanelProps {
  linkedTransactions: LinkedTransactionSummary;
  categoryName: string;
  linkKey?: string;
  fiscalYear?: number;
  citySlug: string;   // NEW
}

// Updated fetch:
const response = await fetch(`/data/${citySlug}/transactions-${fiscalYear}-index.json`);
```

All call sites of `LinkedTransactionsPanel` in `App.tsx` (lines 427 and 462) must also pass `citySlug={slug}`.

### Pattern 7: Hard error on 404 (mock-data fallback removal)

**What:** Replace silent fallback with thrown error so missing files produce a visible error state rather than wrong-data silence.

```tsx
// Remove this catch block pattern:
} catch {
  // Fall back to regular budget file   <-- This silences 404 errors
}

// Instead: let the error propagate, or explicitly throw:
if (!response.ok) {
  throw new Error(`Data file not found: ${path} (HTTP ${response.status})`);
}
```

The existing `App.tsx` error handling at line 225 already shows "Unable to load data" when `budgetData` is null — it just never triggers because the fallback prevents null. Removing the fallback activates the existing error UI.

### Anti-Patterns to Avoid

- **Don't use `HashRouter`:** The Netlify `netlify.toml` already has a `/* → /index.html` redirect rule for SPA support, so `BrowserRouter` works correctly. `HashRouter` would create `/#/bloomington` URLs that look unprofessional.
- **Don't import from `react-router-dom`:** In v7, `react-router-dom` is an alias. Import from `react-router` directly.
- **Don't split routing from data migration:** Per project decision, these must ship atomically. A PR that moves files but keeps old paths, or adds routes before removing the fallback, creates a dangerous intermediate state.
- **Don't update `dataLoader.ts`:** `dataLoader.ts` is dead code (never imported by `App.tsx`). The live implementations are `loadDataset()` in `App.tsx` and the inline fetch in `LinkedTransactionsPanel.tsx`. Updating the dead file instead of the live ones is a high-risk mistake.
- **Don't forget `LinkedTransactionsPanel`:** Three fetch locations exist, not one. Updating only `App.tsx` leaves the transaction index fetch broken.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side routing | Custom history/pushState management | `react-router` BrowserRouter | History API has 12+ edge cases (base path, state restoration, hash collisions) |
| Unknown-route redirect | Custom 404 component with `useEffect` + `window.location` | `<Navigate to="/" replace />` | `Navigate` is synchronous, avoids flash of wrong content, integrates with router history |
| "Back to cities" link | `window.history.back()` | `<Link to="/">` or `useNavigate()` | Link integrates with router, supports keyboard navigation, preserves SPA navigation |

---

## Runtime State Inventory

> This is a file rename/migration phase (data files moving to namespaced paths). Answering all five categories explicitly.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — app is stateless; no database, no Mem0, no Redis | None |
| Live service config | `public/_redirects` has `/api/*` proxy rule; `netlify.toml` has SPA catch-all `/*` redirect — neither references data file paths directly | None — netlify rules serve `index.html` for all routes, which is correct for a SPA |
| OS-registered state | None — no Task Scheduler, pm2, or systemd registrations | None |
| Secrets/env vars | `VITE_API_URL` in `.env` (if set) references API host, not data paths — unaffected by file move | None |
| Build artifacts | `public/data/*.json` files are runtime assets, not build artifacts — Vite copies `public/` verbatim into `dist/` at build time; after moving files to `public/data/bloomington/`, a fresh `npm run build` includes the new paths automatically | Run `npm run build` after file move to verify `dist/data/bloomington/` exists |

**Nothing found that requires data migration (updating stored records).** The only action is moving files on disk and updating path strings in source code.

---

## Common Pitfalls

### Pitfall 1: Updating the dead `dataLoader.ts` instead of the live fetch locations

**What goes wrong:** `dataLoader.ts` has `loadBudgetData()` which does path construction — but `App.tsx` never imports it. If a developer updates `dataLoader.ts` and ignores `App.tsx`, all fetches still use the old un-namespaced paths and either 404 (if files were moved) or return wrong data.

**Why it happens:** The dead file is in a dedicated module that looks "official"; the live implementations are inline code in `App.tsx` and `LinkedTransactionsPanel.tsx`.

**How to avoid:** Confirm `dataLoader.ts` is imported nowhere before writing tasks. The three live fetch locations are: `App.tsx` lines 36–52 (primary data loader) and `LinkedTransactionsPanel.tsx` line 67 (transaction index loader).

**Warning signs:** `dataLoader.ts` has `import.meta.env.VITE_API_URL` at the top — a sign it was built for a different architecture that never shipped.

### Pitfall 2: Missing the third fetch location in LinkedTransactionsPanel

**What goes wrong:** Developer updates `loadDataset()` in `App.tsx` and moves files to `public/data/bloomington/`, but leaves `LinkedTransactionsPanel.tsx` line 67 with the old path. The operating budget drill-down appears to work (budget data loads) but clicking "Load more transactions" fails silently — the transaction index 404s, `setLoadError` is set, and the user sees "Failed to load additional transactions" only after expanding and waiting.

**Why it happens:** `LinkedTransactionsPanel` does its own fetch internally, not via the parent component's loader. This is easy to miss when scanning `App.tsx` only.

**How to avoid:** The fix requires (1) adding `citySlug: string` to `LinkedTransactionsPanelProps`, (2) updating the fetch to `/data/${citySlug}/transactions-${fiscalYear}-index.json`, and (3) passing `citySlug={slug}` at both call sites in App.tsx (lines ~427 and ~462).

**Warning signs:** Budget data loads but "Load more transactions" shows an error, or network tab shows a request to `/bloomington/data/transactions-2025-index.json` (relative path resolved under the city route).

### Pitfall 3: Vite `./data/` relative path resolution breaks under routing

**What goes wrong:** All existing fetch paths use `./data/` (relative). In a SPA, `fetch('./data/...')` resolves relative to the **current page URL**, not the app root. When the user navigates to `/bloomington`, the page URL is `/bloomington`, so `./data/` resolves to `/bloomington/data/` — a 404.

**Why it happens:** This is a classic SPA asset path pitfall. In v1.0 the app only ever ran at `/` so `./data/` worked. Adding routes at `/bloomington` breaks all relative paths.

**How to avoid:** Change ALL data fetch paths from `./data/` to `/data/` (absolute, relative to domain root). In Vite, files in `public/` are served from the root of the deployed site, so `/data/bloomington/budget-2025.json` is the correct URL regardless of which route the user is on.

**Verification:** After routing is wired, navigate directly to `/bloomington` and confirm the network tab shows requests to `/data/bloomington/...`, not `/bloomington/data/bloomington/...`.

### Pitfall 4: The linked-budget try/catch silences 404s in the operating dataset

**What goes wrong:** `loadDataset()` in `App.tsx` has a try/catch for the `-linked.json` variant that swallows fetch errors. After file migration, if the path is wrong, the linked variant returns 404 and the catch block silently falls through to the regular file — which may also 404. The outer catch-all sets `loading: false` and `budgetData: null`, triggering "Unable to load data". This is correct behavior but gives no diagnostic path.

**Why it happens:** The linked-file try/catch was designed to gracefully handle missing linked files. It works for that purpose but obscures path errors during migration.

**How to avoid:** After moving files, test all five years of all three dataset types. Include the failed URL in the error message for faster debugging.

### Pitfall 5: `_redirects` vs `netlify.toml` conflict

**What goes wrong:** Both `public/_redirects` and `netlify.toml` define redirect rules. If someone adds a SPA catch-all to `_redirects` as well as `netlify.toml`, rules may conflict.

**Why it happens:** Developers see `_redirects` in `public/` and add rules there without checking `netlify.toml`.

**How to avoid:** The SPA catch-all `/* /index.html 200` already exists in `netlify.toml`. Do not add it to `_redirects`. Keep API proxy in `_redirects` only if needed for local Vite dev server.

### Pitfall 6: `replace` vs `push` on the catch-all redirect

**What goes wrong:** Using `<Navigate to="/" />` without `replace` pushes a new history entry. A user visiting `/los-angeles` (from an external link), then hitting back, returns to `/los-angeles` (another redirect), creating an infinite loop in browser history.

**Why it happens:** Default router behavior is `push`.

**How to avoid:** Always use `<Navigate to="/" replace />` on catch-all routes.

---

## Code Examples

### Full route shell

```tsx
// src/AppRouter.tsx
// Source: reactrouter.com/start/declarative/installation (verified 2026-03-21)
import { Routes, Route, Navigate } from 'react-router'
import CityPickerPage from './pages/CityPickerPage'
import CityPage from './pages/CityPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<CityPickerPage />} />
      <Route path="/bloomington" element={<CityPage slug="bloomington" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

### BrowserRouter in main.tsx

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import AppRouter from './AppRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
```

### Updated loadDataset with city slug and absolute paths

```tsx
// Path construction in CityPage.tsx (extracted from App.tsx)
async function loadDataset(type: DatasetType, year: number, citySlug: string): Promise<BudgetData> {
  const fileMap: Record<DatasetType, string> = {
    revenue: 'revenue',
    operating: 'budget',
    salaries: 'salaries'
  };
  const fileName = fileMap[type];

  if (type === 'operating') {
    try {
      const linkedPath = `/data/${citySlug}/${fileName}-${year}-linked.json`;
      const linkedResponse = await fetch(linkedPath);
      if (linkedResponse.ok) {
        return linkedResponse.json();
      }
    } catch {
      // linked variant not available, fall through to regular file
    }
  }

  const path = `/data/${citySlug}/${fileName}-${year}.json`;
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${type} data for ${year} (city: ${citySlug}) — HTTP ${response.status}`);
  }

  return response.json();
}
```

### Updated LinkedTransactionsPanel transaction index fetch

```tsx
// LinkedTransactionsPanel.tsx — add citySlug prop and fix path
interface LinkedTransactionsPanelProps {
  linkedTransactions: LinkedTransactionSummary;
  categoryName: string;
  linkKey?: string;
  fiscalYear?: number;
  citySlug: string;  // NEW — required for namespaced path
}

// Inside loadAllTransactions callback (line ~67):
const response = await fetch(`/data/${citySlug}/transactions-${fiscalYear}-index.json`);
```

### Back to cities navigation (ROUTE-04)

```tsx
// Inside CityPage.tsx header area
import { Link } from 'react-router'

// Option A: Link (preferred for accessibility)
<Link to="/">Back to Cities</Link>

// Option B: programmatic (e.g., inside a button handler)
import { useNavigate } from 'react-router'
const navigate = useNavigate()
<button onClick={() => navigate('/')}>Back to Cities</button>
```

### File migration shell command

```bash
# Move all existing public/data files to namespaced bloomington path
mkdir -p public/data/bloomington
mv public/data/*.json public/data/bloomington/
# processedBudget.json: move it too — grep confirms public/data/ copy is only
# needed if fetched at runtime (verify before deciding)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-router-dom` package | `react-router` package (v7 consolidation) | React Router v7.0 (Nov 2024) | Update imports from `react-router-dom` to `react-router` |
| `BrowserRouter` + separate `react-router-dom` install | `BrowserRouter` from `react-router` | v7.0 | Same API, one fewer package |
| `json()` helper in loaders | Return plain objects | v7.0 | Not relevant for this phase (no loaders used) |

**Deprecated/outdated:**
- `react-router-dom`: Still works as alias in v7, but canonical import is `react-router`. Use `react-router` to be forward-compatible.

---

## Open Questions

1. **Where is `processedBudget.json` in `public/data/` used?**
   - What we know: It exists at `public/data/processedBudget.json`. Also a copy at `src/data/processedBudget.json`. A grep for `processedBudget` in `src/` returned only a comment reference in `CategoryList.tsx` (not a fetch call).
   - What's unclear: Whether the `public/data/processedBudget.json` copy is fetched at runtime or is a stale artifact. If it is never fetched, it can stay in place or be moved safely.
   - Recommendation: Move it to `public/data/bloomington/` along with all other `public/data/*.json` files (safe), then verify the app works. If something breaks, it was being fetched and the path needs updating.

2. **Are `budgetConfig.json` and `treasuryConfig.json` at the project root fetched by the app?**
   - What we know: Both files exist at project root. The grep for these names in `src/` found no fetch calls — only a comment.
   - Assessment: Almost certainly used only by the processing scripts (`scripts/processBudget.js` etc.), not the running app.
   - Recommendation: Do not move these files. Confirm by grepping for `budgetConfig` and `treasuryConfig` in `src/` before the data migration task.

---

## Validation Architecture

> No `workflow.nyquist_validation` key found in `.planning/config.json` (file does not exist). Treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no `pytest.ini`, `jest.config.*`, `vitest.config.*`, or `__tests__/` directory found |
| Config file | None — Wave 0 must create |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 install) |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | `/` renders city picker (not tracker) | smoke/manual | Manual browser navigation | Wave 0 |
| ROUTE-02 | `/bloomington` renders full budget tracker | smoke/manual | Manual browser navigation | Wave 0 |
| ROUTE-03 | `/los-angeles` redirects to `/` | unit | `npx vitest run src/__tests__/routing.test.tsx` | Wave 0 |
| ROUTE-04 | Back to cities link/button present and functional | smoke/manual | Manual browser check | Wave 0 |
| DATA-01 | Files exist at `public/data/bloomington/*.json` | smoke | `ls public/data/bloomington/ \| wc -l` (expect >= 22) | Wave 0 |
| DATA-02 | `loadDataset()` constructs namespaced path with citySlug | unit | `npx vitest run src/__tests__/dataLoader.test.ts` | Wave 0 |
| DATA-03 | `/bloomington` loads real data and transaction drill-down works | smoke/manual | Check Network tab — paths are `/data/bloomington/...` | Wave 0 |

**Note:** Given this project has no test framework, the most valuable Wave 0 investment is Vitest setup + one routing test (ROUTE-03, the redirect) + one path-construction test (DATA-02). ROUTE-01, ROUTE-02, ROUTE-04, and DATA-03 are verifiable in under 2 minutes via manual browser check and are low risk to leave as smoke tests.

### Sampling Rate

- **Per task commit:** `ls public/data/bloomington/ 2>/dev/null | wc -l` (file migration tasks) or `npx vitest run` (code tasks)
- **Per wave merge:** `npx vitest run && npm run build`
- **Phase gate:** `npm run build` succeeds, manual smoke of all 5 success criteria before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest` install: `npm install -D vitest @testing-library/react @testing-library/user-event jsdom`
- [ ] `vite.config.ts` — add `test: { environment: 'jsdom' }` block
- [ ] `src/__tests__/routing.test.tsx` — covers ROUTE-03 (unknown slug redirect)
- [ ] `src/__tests__/dataLoader.test.ts` — covers DATA-02 (path construction with slug)

---

## Sources

### Primary (HIGH confidence)

- npm registry — `react-router-dom` version 7.13.1, peer dep `react >= 18` verified 2026-03-21 via `npm view`
- `reactrouter.com/start/declarative/installation` — BrowserRouter setup for Vite SPA (fetched 2026-03-21)
- `reactrouter.com/upgrading/v6` — v6 to v7 migration guide confirming BrowserRouter API unchanged (fetched 2026-03-21)
- Project source files read directly 2026-03-21: `src/App.tsx`, `src/data/dataLoader.ts`, `src/main.tsx`, `src/components/LinkedTransactionsPanel.tsx`, `package.json`, `vite.config.ts`, `netlify.toml`, `public/_redirects`

### Secondary (MEDIUM confidence)

- Project `public/data/` directory listing — confirms 22 data files at un-namespaced paths needing migration

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified react-router 7.13.1 from npm registry; BrowserRouter API confirmed from official docs
- Architecture: HIGH — based on direct code reading of all relevant source files; three fetch locations confirmed
- Pitfalls: HIGH for pitfalls 1/2/3/6 (verified from direct code reading); MEDIUM for pitfall 5 (inferred from dual redirect config)

**Research date:** 2026-03-21
**Valid until:** 2026-09-21 (react-router stable; Vite/React 19 ecosystem settled)
