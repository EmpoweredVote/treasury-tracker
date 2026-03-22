---
phase: 01-routing-shell-data-namespacing
verified: 2026-03-22T02:30:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "A missing data file shows an error with the file path, not silent mock data"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /bloomington with dev tools Network tab open. Rename public/data/bloomington/budget-2025-linked.json and public/data/bloomington/budget-2025.json to .bak extensions. Reload /bloomington."
    expected: "'Unable to load budget data' heading with 'The data file could not be loaded...' body text and a 'Back to Cities' link visible within a few seconds of the fetch failing — no infinite spinner."
    why_human: "The error state is now statically reachable (loadError guard at line 220 precedes loading guard at line 235), but confirming the browser render transitions correctly from loading to error requires a live fetch failure, not static analysis."
---

# Phase 01: Routing Shell + Data Namespacing — Verification Report

**Phase Goal:** Wire React Router into the app, migrate all data files to namespaced paths, extract CityPage from App.tsx, and eliminate the silent mock-data fallback.
**Verified:** 2026-03-22
**Status:** human_needed — 7/7 must-haves verified; one human smoke test needed to confirm error UI renders correctly on live fetch failure
**Re-verification:** Yes — after gap closure (Plan 01-03)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to `/` shows a city picker page with 'Choose a City' heading and a Bloomington link | VERIFIED | `src/pages/CityPickerPage.tsx` line 8: `<h1 className="city-picker-heading">Choose a City</h1>`; line 10: `<Link to="/bloomington"`. AppRouter.tsx line 8 routes `/` to CityPickerPage. |
| 2 | Navigating to `/bloomington` shows the full budget tracker identical to v1.0 | VERIFIED | `src/AppRouter.tsx` line 9: `<Route path="/bloomington" element={<CityPage slug="bloomington" />} />`. CityPage.tsx is 534 lines, contains all state hooks, handlers, BudgetVisualization, CategoryList, LinkedTransactionsPanel, DatasetTabs. Human smoke test confirmed in 01-02-SUMMARY. |
| 3 | Navigating to `/los-angeles` or any unknown slug redirects to `/` | VERIFIED | `src/AppRouter.tsx` line 10: `<Route path="*" element={<Navigate to="/" replace />} />`. `replace` prevents back-button loops. Human smoke test confirmed in 01-02-SUMMARY. |
| 4 | A 'Back to Cities' link is visible above SiteHeader on `/bloomington` | VERIFIED | `src/pages/CityPage.tsx` lines 287-301: `<Link to="/">` with ArrowLeft icon and "Back to Cities" text appears in the return block before `<SiteHeader`. Human smoke test confirmed in 01-02-SUMMARY. |
| 5 | Data files exist at `public/data/bloomington/*.json`, not `public/data/*.json` | VERIFIED | 31 JSON files confirmed in `public/data/bloomington/`. Zero `.json` files at `public/data/` root. |
| 6 | All fetch paths use `/data/bloomington/...` (absolute, with city slug) | VERIFIED | `src/pages/CityPage.tsx` lines 37, 47: `/data/${citySlug}/...`. `src/components/LinkedTransactionsPanel.tsx`: `/data/${citySlug}/transactions-${fiscalYear}-index.json`. No `./data/` relative paths remain in `src/`. |
| 7 | A missing data file shows an error with the file path, not silent mock data | VERIFIED (pending human smoke test) | `src/pages/CityPage.tsx` line 103: `const [loadError, setLoadError] = useState(false)`. Line 118: `setLoadError(true)` in first useEffect catch. Line 125: `setLoadError(false)` reset. Line 137: `setLoadError(true)` in second useEffect catch. `if (loadError)` guard at line 220 precedes `if (loading \|\| !operatingBudgetData)` at line 235 — error path is now structurally reachable. Error UI at lines 221-232 contains "Unable to load budget data" heading, message body, and "Back to Cities" Link. TypeScript build passes (tsc --noEmit exits 0). |

**Score: 7/7 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/AppRouter.tsx` | Route shell with /, /bloomington, catch-all redirect | VERIFIED | 13 lines. Routes `/` → CityPickerPage, `/bloomington` → CityPage slug="bloomington", `*` → Navigate replace. Imports from `react-router`. |
| `src/pages/CityPickerPage.tsx` | Placeholder city picker at / | VERIFIED | 22 lines. "Choose a City" h1, Link to /bloomington, Coming Soon badge for LA. No SiteHeader import. |
| `src/pages/CityPage.tsx` | Budget tracker extracted from App.tsx, accepts slug prop | VERIFIED | 534 lines (min_lines: 350 — passes). Exports `CityPage`. Accepts `{ slug: string }` prop. `loadError` state at line 103. Error guard at line 220 before loading guard at line 235. All loadDataset call sites pass `slug`. |
| `src/main.tsx` | BrowserRouter wrapper around AppRouter | VERIFIED | Imports BrowserRouter from `react-router`. Wraps `<AppRouter />` in `<BrowserRouter>`. Does not import App. |
| `public/data/bloomington/` | All 31 data files namespaced under bloomington | VERIFIED | 31 JSON files confirmed. Zero JSON files at `public/data/` root. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.tsx` | `src/AppRouter.tsx` | import AppRouter, render inside BrowserRouter | WIRED | `import AppRouter from './AppRouter'` and `<BrowserRouter><AppRouter /></BrowserRouter>`. |
| `src/AppRouter.tsx` | `src/pages/CityPage.tsx` | Route element prop at path="/bloomington" | WIRED | Line 9: `<Route path="/bloomington" element={<CityPage slug="bloomington" />} />`. Import at line 3. |
| `src/pages/CityPage.tsx` | `/data/bloomington/` | loadDataset fetch with citySlug | WIRED | Lines 37 and 47: paths use `/data/${citySlug}/...`. All three `loadDataset` call sites pass `slug` (lines 109, 110, 129). |
| `src/components/LinkedTransactionsPanel.tsx` | `/data/bloomington/` | fetch with citySlug prop | WIRED | `/data/${citySlug}/transactions-${fiscalYear}-index.json`. `citySlug` prop required. Passed as `citySlug={slug}` at both call sites in CityPage.tsx (lines 472, 507). |
| First useEffect catch | `loadError` state | `setLoadError(true)` | WIRED | Line 118: `setLoadError(true)` in Promise.all catch block. |
| Second useEffect catch | `loadError` state | `setLoadError(true)` | WIRED | Line 137: `setLoadError(true)` in active dataset fetch catch block. |
| `loadError` state | Error UI (line 221) | `if (loadError)` guard before loading guard | WIRED | `if (loadError)` at line 220 precedes `if (loading \|\| !operatingBudgetData)` at line 235 — error path is reachable. |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ROUTE-01 | 01-01-PLAN, 01-02-PLAN | User sees a city picker at `/` showing all available cities | SATISFIED | CityPickerPage at `/` — "Choose a City" heading, Bloomington link, LA Coming Soon. AppRouter wired. |
| ROUTE-02 | 01-01-PLAN, 01-02-PLAN | User navigates to `/bloomington` and gets the full existing tracker (behavior identical to v1.0) | SATISFIED | CityPage at `/bloomington` with full tracker confirmed by human smoke test (01-02-SUMMARY). |
| ROUTE-03 | 01-01-PLAN, 01-02-PLAN | User navigates to `/los-angeles` and gets a functional Los Angeles tracker | SATISFIED (Phase 1 scope only) | Phase 1 delivers the redirect infrastructure and LA "Coming Soon" placeholder. `/los-angeles` redirects to `/` via Navigate replace. Full LA tracker is Phase 4. |
| ROUTE-04 | 01-01-PLAN, 01-02-PLAN | User on any city route can return to the city picker | SATISFIED | "Back to Cities" Link in CityPage.tsx lines 287-301 renders above SiteHeader. Human smoke test confirmed navigation and browser back button both return to `/`. |
| DATA-01 | 01-01-PLAN, 01-02-PLAN | Data files are namespaced by city slug (`public/data/{slug}/budget-2025.json`, etc.) | SATISFIED | 31 files in `public/data/bloomington/`. Zero at root. |
| DATA-02 | 01-01-PLAN, 01-02-PLAN | App data loader accepts city slug and loads from the correct namespaced path | SATISFIED | `loadDataset(type, year, citySlug)` in CityPage.tsx and `citySlug` prop in LinkedTransactionsPanel both use `/data/${citySlug}/` absolute paths. |
| DATA-03 | 01-01-PLAN, 01-02-PLAN, 01-03-PLAN | Bloomington data migrated to new namespacing with behavior identical to v1.0; error state reachable on fetch failure | SATISFIED | All 31 Bloomington files at `public/data/bloomington/`. Error state structurally reachable via `loadError` boolean. TypeScript build clean. Human smoke test required to confirm live browser behavior. |

No orphaned requirements found. All 7 IDs from Plans 01-01, 01-02, and 01-03 are accounted for in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/CityPickerPage.tsx` | 14-17 | LA card is a visual placeholder (`<div>` not `<Link>`) with Coming Soon badge | Info | Intentional per plan — LA is Phase 4. Not a blocking stub. |

No blocker anti-patterns. The previously flagged infinite-spinner bug (loading guard trapping error state) is resolved by the `loadError` state introduced in Plan 01-03.

---

## Human Verification Required

### 1. Error state renders on live fetch failure

**Test:** Start the dev server (`npm run dev`). Navigate to `http://localhost:5173/bloomington` and confirm it loads normally. Then rename both `public/data/bloomington/budget-2025-linked.json` and `public/data/bloomington/budget-2025.json` to `.bak` extensions. Reload `/bloomington`.

**Expected:** Within a few seconds, the page transitions to showing:
- Heading: "Unable to load budget data"
- Body: "The data file could not be loaded. Check the browser console for the specific file path and HTTP status."
- A "Back to Cities" link that returns to `/`

The page must NOT display an infinite "Loading data..." spinner. Restore both `.bak` files to `.json` and confirm `/bloomington` loads normally again.

**Why human:** The `loadError` guard is structurally correct and statically reachable (line 220 precedes line 235), but confirming the browser transitions from loading state to error state within seconds — rather than stalling — requires a live fetch failure with observable render output.

---

## Gaps Summary

No gaps remain. The single gap from the initial verification (Truth 7 — error state unreachable) was resolved by Plan 01-03, which added an explicit `loadError` boolean state to CityPage.tsx. The `if (loadError)` check at line 220 now precedes the loading guard at line 235, making the error UI structurally reachable on any fetch failure.

**All automated checks pass:**
- `loadError` state declared at line 103
- `setLoadError(true)` in both useEffect catch blocks (lines 118, 137)
- `setLoadError(false)` reset in second useEffect dependency flush (line 125)
- `if (loadError)` guard at line 220, before `if (loading || !operatingBudgetData)` at line 235
- Error UI at lines 221-232 contains "Unable to load budget data" heading, message text, and `<Link to="/">` Back to Cities
- TypeScript compilation passes (tsc --noEmit exits 0)
- All 7 regression checks pass (routes, data files, no relative paths, dead code deleted)

One human smoke test is required to confirm the live browser behavior before marking Phase 1 fully complete.

---

_Verified: 2026-03-22_
_Verifier: Claude (gsd-verifier)_
