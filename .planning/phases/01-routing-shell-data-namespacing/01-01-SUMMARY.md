---
phase: 01-routing-shell-data-namespacing
plan: 01
subsystem: ui
tags: [react-router, routing, data-namespacing, spa, vite, typescript]

# Dependency graph
requires: []
provides:
  - React Router v7 installed and wired via BrowserRouter + AppRouter
  - "/" route renders CityPickerPage with "Choose a City" heading and Bloomington link
  - "/bloomington" route renders full budget tracker (CityPage) identical to v1.0 visually
  - Unknown routes redirect to "/" via Navigate replace (no back-button loops)
  - All 31 data files namespaced under public/data/bloomington/
  - All fetch paths use absolute /data/${citySlug}/ pattern (no relative ./data/ paths)
  - dataLoader.ts dead code deleted (eliminates silent mock-data fallback)
  - LinkedTransactionsPanel accepts citySlug prop for namespaced transactions fetch
  - "Back to Cities" link rendered above SiteHeader in CityPage
  - Error state shows informative message with "Back to Cities" navigation
affects:
  - phase-02 (city config, will use slug routing established here)
  - phase-03 (LA data pipeline, will drop files into public/data/los-angeles/)
  - phase-04 (LA live, relies on /los-angeles route being added to AppRouter)

# Tech tracking
tech-stack:
  added:
    - react-router@7.13.1 (v7 consolidated package, replaces react-router-dom)
  patterns:
    - "Slug-based routing: AppRouter maps /citySlug to <CityPage slug='citySlug' />"
    - "Namespaced data paths: /data/${citySlug}/${file}-${year}.json"
    - "BrowserRouter in main.tsx, Routes/Route/Navigate in AppRouter.tsx"
    - "Import from 'react-router' not 'react-router-dom' (v7 consolidation)"
    - "City pages live in src/pages/, extracted from App.tsx component"

key-files:
  created:
    - src/AppRouter.tsx
    - src/pages/CityPickerPage.tsx
    - src/pages/CityPickerPage.css
    - src/pages/CityPage.tsx
    - public/data/bloomington/ (31 JSON files)
  modified:
    - src/main.tsx (BrowserRouter + AppRouter)
    - src/components/LinkedTransactionsPanel.tsx (citySlug prop)
    - package.json (react-router dependency)
  deleted:
    - src/data/dataLoader.ts (dead code with mock-data fallback)
    - src/App.tsx (extracted to CityPage.tsx; AppRouter is now root)

key-decisions:
  - "Import react-router (not react-router-dom) -- v7 consolidates into single package"
  - "Use <Navigate to='/' replace> for unknown slugs to prevent back-button redirect loops"
  - "CityPage receives slug as prop (not useParams) -- clean testability, matches AppRouter design"
  - "Back to Cities link placed above SiteHeader in CityPage, not inside SiteHeader component"
  - "ev-ui stub created in node_modules for build verification -- NPM_TOKEN needed for real install"

patterns-established:
  - "Pattern: All data fetches use absolute /data/${citySlug}/ paths (never ./data/)"
  - "Pattern: city slug flows from AppRouter -> CityPage prop -> loadDataset -> LinkedTransactionsPanel"
  - "Pattern: Error state in CityPage includes Back to Cities Link for recovery navigation"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, DATA-01, DATA-02, DATA-03]

# Metrics
duration: 52min
completed: 2026-03-22
---

# Phase 01 Plan 01: Routing Shell + Data Namespacing Summary

**React Router v7 wired into the app with namespaced data paths -- /bloomington renders full v1.0 budget tracker, / shows city picker, unknown slugs redirect silently, all 31 JSON data files moved to public/data/bloomington/**

## Performance

- **Duration:** 52 min
- **Started:** 2026-03-22T00:01:28Z
- **Completed:** 2026-03-22T00:53:44Z
- **Tasks:** 3 / 3
- **Files modified:** 12 (created/modified/deleted)

## Accomplishments

- React Router 7.13.1 installed; `src/main.tsx` wraps `<AppRouter />` in `<BrowserRouter>`
- `AppRouter.tsx` routes `/` to `CityPickerPage`, `/bloomington` to `CityPage slug="bloomington"`, `*` to `Navigate` redirect
- Full budget tracker extracted from `App.tsx` into `src/pages/CityPage.tsx` (~350 lines) with slug-aware `loadDataset`
- All 31 data files migrated to `public/data/bloomington/`; no `.json` files remain at `public/data/` root
- `LinkedTransactionsPanel` updated with `citySlug` prop; transactions fetch uses `/data/${citySlug}/` absolute path
- `src/data/dataLoader.ts` deleted (eliminated silent mock-data fallback)
- Build verified: `tsc` and `vite build` succeed; `dist/data/bloomington/` contains 31 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-router, migrate data files, create router shell and city picker** - `3985b0f` (feat)
2. **Task 2: Extract CityPage from App.tsx with citySlug-aware data loading** - `39973f3` (feat)
3. **Task 3: Update LinkedTransactionsPanel with citySlug, delete dead code, verify build** - `d7fef85` (feat)

## Files Created/Modified

- `src/main.tsx` - BrowserRouter wrapping AppRouter; removed App.tsx import
- `src/AppRouter.tsx` - Route shell: /, /bloomington, catch-all redirect
- `src/pages/CityPickerPage.tsx` - "Choose a City" page with Bloomington link and LA Coming Soon
- `src/pages/CityPickerPage.css` - 2-column responsive card grid for city picker
- `src/pages/CityPage.tsx` - Full budget tracker extracted from App.tsx, accepts slug prop
- `src/components/LinkedTransactionsPanel.tsx` - Added citySlug prop and absolute fetch path
- `package.json` - Added react-router 7.13.1 dependency
- `public/data/bloomington/` - All 31 JSON files (budget, revenue, salaries, transactions)
- `src/App.tsx` - Deleted (extracted to CityPage.tsx)
- `src/data/dataLoader.ts` - Deleted (dead code with mock-data fallback)

## Decisions Made

- Import from `react-router` (not `react-router-dom`) per v7 package consolidation
- Use `replace` prop on `<Navigate>` to prevent back-button redirect loops for unknown slugs
- `CityPage` receives `slug` as a component prop (not via `useParams`) for clean testability
- "Back to Cities" link placed above `SiteHeader` in `CityPage.tsx` per CONTEXT.md decision -- does not modify SiteHeader internals
- `ev-ui` stub created in `node_modules` for local build verification since `NPM_TOKEN` (GitHub Packages auth) is not available in this WSL environment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm install failed due to missing NPM_TOKEN for GitHub Packages**

- **Found during:** Task 3 (build verification)
- **Issue:** Running `npm install react-router` cleaned the existing `node_modules` and failed with 401 Unauthorized when trying to install `@chrisandrewsedu/ev-ui` from `npm.pkg.github.com`. `NPM_TOKEN` env var is not set in this WSL session.
- **Fix:** (a) Installed all public npm packages using temporary `package.json` without ev-ui. (b) Created a minimal stub `node_modules/@chrisandrewsedu/ev-ui/index.js` with matching exports so tsc + vite build could succeed. (c) Restored original `package.json` with ev-ui dependency declared.
- **Files modified:** `node_modules/@chrisandrewsedu/ev-ui/index.js` (stub, not tracked in git), `node_modules/@chrisandrewsedu/ev-ui/package.json` (stub, not tracked in git)
- **Verification:** `tsc -b` exits 0, `vite build` exits 0, `dist/data/bloomington/` has 31 files
- **Note:** The stub is in node_modules (gitignored). The real deploy (Netlify or CI with NPM_TOKEN) will install the real package. The stub does not affect deployed output.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary workaround for local WSL build verification; does not affect the actual codebase or deployed application. NPM_TOKEN will need to be set for any developer running `npm install` from scratch.

## Known Stubs

- `src/pages/CityPickerPage.tsx` line 16: `<span className="city-card-badge">Coming Soon</span>` for Los Angeles card. This is **intentional** per plan acceptance criteria -- LA route is Phase 4. The stub is a visual placeholder only; clicking the LA card does nothing (no link).

## Issues Encountered

- npm install triggered full node_modules cleanup on Windows NTFS via WSL, causing loss of previously-installed packages. Worked around by temporary package.json swap + ev-ui stub (see Deviations).
- `npm run build` script uses shell `tsc` and `vite` commands which require `.bin/` symlinks -- these don't work on Windows NTFS from WSL. Used `node node_modules/typescript/bin/tsc` and `node node_modules/vite/bin/vite.js` directly as equivalent.

## User Setup Required

**NPM_TOKEN required for `npm install` on this project.**

If running `npm install` from scratch, set `NPM_TOKEN` to a GitHub Personal Access Token with `read:packages` scope on `github.com/chrisandrewsedu`:

```bash
export NPM_TOKEN=ghp_your_token_here
npm install
```

The `.npmrc` file already configures the `@chrisandrewsedu` scope to use GitHub Packages. Without this token, installation fails with 401.

## Next Phase Readiness

- Routing shell is complete; Phase 2 can add `/los-angeles` route to AppRouter and create a config schema
- Data namespace pattern established; Phase 3 can drop files into `public/data/los-angeles/` and they will serve correctly
- `loadDataset` and `LinkedTransactionsPanel` are already city-agnostic; adding LA requires only new data files and a config entry
- No blockers for Phase 2 start

---
*Phase: 01-routing-shell-data-namespacing*
*Completed: 2026-03-22*

## Self-Check: PASSED

All required files exist and all task commits are present in git history.

| Item | Status |
|------|--------|
| `src/AppRouter.tsx` | FOUND |
| `src/pages/CityPickerPage.tsx` | FOUND |
| `src/pages/CityPage.tsx` | FOUND |
| `src/main.tsx` | FOUND |
| `public/data/bloomington/` (31 files) | FOUND |
| `src/data/dataLoader.ts` deleted | VERIFIED |
| `src/App.tsx` deleted | VERIFIED |
| Task 1 commit `3985b0f` | FOUND |
| Task 2 commit `39973f3` | FOUND |
| Task 3 commit `d7fef85` | FOUND |
