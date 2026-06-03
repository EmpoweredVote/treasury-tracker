---
phase: 25-la-county-data-completion-county-city-linking
reviewed: 2026-06-02T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - scripts/cleanLACountyBudget.js
  - scripts/seedLACountyLinks.js
  - supabase/migrations/20260602235505_add_county_id_to_municipalities.sql
  - src/types/budget.ts
  - src/components/CitiesInCountyPanel.tsx
  - src/App.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-06-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase adds a county-city relational model (self-referential `county_id` on municipalities), seeds the links for LA County's 88 cities and three other counties, cleans stale budget rows, and surfaces a `CitiesInCountyPanel` component on county entity pages. The migration and the React component are generally sound. The two scripts and `App.tsx` carry defects ranging from a hardcoded production URL to broken breadcrumb navigation and an unhandled promise rejection.

---

## Critical Issues

### CR-01: Hardcoded production Supabase URL defaults — any developer running scripts without env vars silently hits production

**File:** `scripts/cleanLACountyBudget.js:27`, `scripts/seedLACountyLinks.js:23`

**Issue:** Both scripts fall back to `'https://kxsdzaojfaibhuzmclfq.supabase.co'` when `SUPABASE_URL` is not set. Any developer who forgets to export the env var — or runs the script from a terminal that does not inherit it — will execute destructive deletes and updates against the live production database with no warning. Because `process.exit(1)` guards are only present for the _key_, not the _URL_, the URL fallback is completely silent.

**Fix:** Remove the production URL fallback. Fail explicitly if the URL is absent, the same way the key does:
```js
// cleanLACountyBudget.js and seedLACountyLinks.js — replace both lines
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(1); }
```

---

### CR-02: Broken breadcrumb navigation — dataset-label and category-level clicks navigate to wrong depth

**File:** `src/App.tsx:484`, `src/App.tsx:491`

**Issue:** The closures passed to `handleBreadcrumbClick` compute their index argument using `items.length` at _closure creation time_ (i.e., mid-`useMemo` build), but JavaScript arrays are mutable — `items` continues to grow as more breadcrumbs are pushed in the same `useMemo`. By the time the user clicks and the closure fires, `items` is the fully-built array from that render, so `items.length - 1` and the category formula both resolve to stale-large values instead of the intended indices.

**Dataset label click (line 484):** When `items` has `[county, city]` during push, `items.length` = 2. At click time, `items` has `[county, city, dataset, ...navPath]`, so `items.length - 1` = `2 + navPath.length`. `handleBreadcrumbClick` receives that large index, causing `navigationPath.slice(0, large - 1)` instead of `setNavigationPath([])`.

**Category click (line 491):** Formula `index + items.length - navigationPath.length + index` doubles `index` and uses the stale `items.length`. For a 2-deep path with no county: `0 + 2 - 2 + 0 = 0` → `handleBreadcrumbClick(0)` does nothing (neither branch in the callback fires); clicking the intermediate breadcrumb has no effect.

**Fix:** Capture a snapshot of the count at push time, or — better — rewrite the onClick closures to not reference `items` at all, using the semantic position directly:

```tsx
// Dataset label breadcrumb — should always clear navigation to top level
items.push({
  label: getDatasetLabel(activeDataset),
  onClick: navigationPath.length > 0 ? () => setNavigationPath([]) : undefined
});

// Category breadcrumbs — slice to depth (index + 1) in navigation path
navigationPath.forEach((category, index) => {
  items.push({
    label: category.enrichment?.plainName || category.name,
    onClick: index < navigationPath.length - 1
      ? () => setNavigationPath(navigationPath.slice(0, index + 1))
      : undefined
  });
});
```

This makes the handlers independent of `items` state and removes the dependency on `handleBreadcrumbClick` entirely for these cases.

---

### CR-03: Unhandled promise rejection in linked-transactions loader

**File:** `src/App.tsx:404-405`

**Issue:** The `loadLinkedTransactions` call has no `.catch()`. If the network request fails or the function throws, the rejection is silently swallowed by the browser as an unhandled promise rejection — the UI stays in the "Loading transactions…" spinner state indefinitely with no way out.

```ts
// current — no error handling
loadLinkedTransactions(budgetId, currentCat.linkKey)
  .then(summary => setLinkedTransactions(summary));
```

**Fix:** Add a catch that clears the loading state (setting `null` is enough to dismiss the spinner and fall through to "No further breakdown available"):
```ts
loadLinkedTransactions(budgetId, currentCat.linkKey)
  .then(summary => setLinkedTransactions(summary))
  .catch(err => {
    console.error('Failed to load linked transactions:', err);
    setLinkedTransactions(null);
  });
```

---

## Warnings

### WR-01: Supabase `.delete()` never returns `count` without `.select()` — logs always print "unknown"

**File:** `scripts/cleanLACountyBudget.js:69`, `scripts/cleanLACountyBudget.js:102`, `scripts/cleanLACountyBudget.js:125`

**Issue:** The Supabase JS client v2 does not populate `count` on `.delete()` responses unless the `Prefer: count=exact` header is sent (via `.delete({ count: 'exact' })`). Without it, `count` is always `undefined`, so `count ?? 'unknown'` always falls to the fallback. Every successful delete prints `Deleted unknown stale data_source row(s)` — which undermines the script's audit trail and could mask zero-row deletes that indicate a misconfiguration.

**Fix:**
```js
const { error, count } = await supabase
  .schema('treasury')
  .from('data_sources')
  .delete({ count: 'exact' })   // ← add this option
  .in('id', STALE_SOURCE_IDS);
```
Apply the same change to all three delete calls (lines 69, 102, 125).

---

### WR-02: `population: 0` inserted for new county rows is a live data hazard

**File:** `scripts/seedLACountyLinks.js:47-49`

**Issue:** The three county rows (San Diego, Sacramento, Alameda) are inserted with `population: 0`. If any code path divides by population to compute per-capita figures, it will produce `Infinity` or `NaN` for these counties. Even if those counties currently have no budget data, the column is not nullable in the expected schema (the `Municipality` type has `population: number`) and `0` is a valid value that may be read without a guard.

**Fix:** Use `null` for the population and population_year, or look up and supply the real census figures before insertion. If the column is `NOT NULL`, use a clearly sentinel value like `-1` and document it — but `null` is strongly preferable if the schema permits:
```js
const COUNTY_ROWS_TO_INSERT = [
  { name: 'San Diego County', state: 'CA', entity_type: 'county', population: null, population_year: null },
  { name: 'Sacramento County', state: 'CA', entity_type: 'county', population: null, population_year: null },
  { name: 'Alameda County', state: 'CA', entity_type: 'county', population: null, population_year: null },
];
```
(The `Municipality` TypeScript interface already types `population_year` as `number | null`, so `population` being nullable is consistent with that pattern.)

---

### WR-03: Flash of error state on entity load — `!loading && !budgetData` fires before the loading effect runs

**File:** `src/App.tsx:561`

**Issue:** After `setSelectedEntity(entity)` is called (e.g., from URL param routing on line 179 or after auth), the component enters a render cycle where `selectedEntity` is non-null but `loading` is still `false` and `budgetData` is still `null`. The guard at line 561 evaluates as `true` and renders the full "Unable to load budget data" error screen for one frame before the `useEffect` at line 316 sets `loading = true`. This creates a visible flash of the error state on every fresh entity navigation.

**Fix:** Add a `budgetLoadError` check to the condition — the error screen should only appear when a load was actually _attempted_ and failed:
```tsx
// line 561 — replace the condition
if (!loading && !budgetData && budgetLoadError) {
```
The `budgetLoadError` flag is set to `false` on every new load attempt (line 319) and to `true` only on catch (line 331), so this correctly suppresses the premature render.

---

### WR-04: `CitiesInCountyPanel` filters only `entity_type === 'city'` — townships linked to a county would silently disappear

**File:** `src/components/CitiesInCountyPanel.tsx:15-17`

**Issue:** The panel filters `m.entity_type === 'city'` only. The `Municipality` interface includes `'township'` as a valid entity type. If a township were linked to a county via `county_id`, it would be silently excluded from both the "Available now" and "Coming soon" lists — no indication to the user that the county has more jurisdictions. The current dataset is all cities, but the filter is a latent bug for future data additions.

**Fix:** Either broaden the filter to include townships, or add a comment explaining the intentional exclusion:
```tsx
// Option A — include townships
const cities = municipalities.filter(
  m => m.county_id === county.id && (m.entity_type === 'city' || m.entity_type === 'township')
);
```
```tsx
// Option B — document the intentional exclusion
// Intentionally excludes townships — add 'township' here if/when townships are linked to counties
const cities = municipalities.filter(
  m => m.county_id === county.id && m.entity_type === 'city'
);
```

---

## Info

### IN-01: `handleBreadcrumbClick` is dead code after CR-02 fix

**File:** `src/App.tsx:450-456`

**Issue:** `handleBreadcrumbClick` is called only from the breadcrumb `onClick` closures. Once the CR-02 fix is applied (replacing all call sites with direct `setNavigationPath` calls), this helper becomes unreachable and should be removed to reduce cognitive overhead.

**Fix:** Delete `handleBreadcrumbClick` and its `useCallback` wrapper (lines 450-456). Remove it from the `breadcrumbItems` `useMemo` dependency array (line 497).

---

### IN-02: Duplicate heading text in the error state at line 561-570

**File:** `src/App.tsx:567-571`

**Issue:** The error card has both an `<h2>` ("Unable to load budget data") and a `<p>` ("Unable to load budget data. Check your connection...") with identical opening text. This duplicates the message redundantly for screen reader users.

**Fix:** Differentiate the two strings:
```tsx
<h2 ...>Unable to load budget data</h2>
<p ...>Check your connection and try again.</p>
```

---

_Reviewed: 2026-06-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
