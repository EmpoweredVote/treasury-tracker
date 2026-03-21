# Domain Pitfalls

**Domain:** Adding multi-city support to an existing single-city civic budget SPA
**Researched:** 2026-03-21
**Confidence:** HIGH (codebase directly audited; routing/data pitfalls from verified patterns)

---

## Critical Pitfalls

Mistakes that cause data corruption, broken deploys, or silent regressions in Bloomington behavior.

---

### Pitfall 1: Netlify Catch-All Redirect Breaks City Routes Before React Router Loads

**What goes wrong:** The current `netlify.toml` has a catch-all redirect `/* → /index.html` (status 200). This was written for a root-mounted SPA with no meaningful client-side paths. When city routes (`/bloomington`, `/los-angeles`) are added, Netlify correctly serves `index.html` — but only if the React app picks up the URL from `window.location`. If `react-router` (or any routing library) is not installed and configured before the routes exist in production, Netlify's redirect makes every city URL appear to "work" (200 OK, page loads) while the app renders nothing route-aware. The failure is silent: the page loads, but no city is selected.

**Why it happens:** The app currently has no client-side router at all. `App.tsx` is a single-view component; there are no `<Route>` elements. Adding URL paths without first installing and wiring a router means the new paths parse as `window.location.pathname` but nothing in the app reads them.

**Consequences:** `/bloomington` loads the app but renders as if no city was chosen (blank or default city). `/los-angeles` silently falls through to the same behavior. The Netlify redirect obscures the bug — the page does not 404, making it harder to notice during manual testing.

**Prevention:** Install `react-router-dom` and define routes (`/`, `/:citySlug`) before deploying city URLs to production. Test direct URL navigation (not just clicking links) before marking routing complete. Verify the catch-all redirect is still the last rule in `netlify.toml` after any new redirects are added.

**Detection:** Load `https://[site].netlify.app/bloomington` directly in a fresh browser tab (no prior navigation). If the page renders without showing Bloomington data, routing is broken. Also run `netlify dev` locally and test direct deep-link navigation.

**Phase:** Routing phase (ROUTE-01 through ROUTE-04).

---

### Pitfall 2: Breaking the Existing Bloomington Data Load Path During File Namespacing

**What goes wrong:** Requirement DATA-01/DATA-03 moves Bloomington data from `public/data/budget-2025.json` to `public/data/bloomington/budget-2025.json`. The inline `loadDataset` function in `App.tsx` (lines 24–52) uses the hardcoded relative path `./data/${fileName}-${year}.json`. If the file move happens before the data loader is updated to use namespaced paths, every Bloomington data fetch returns 404. The app falls through to the dead `dataLoader.ts` which falls through to the mock data in `budgetData.ts` — and silently serves fabricated budget numbers to users.

**Why it happens:** There are two separate `loadDataset` implementations: the live one in `App.tsx` and the dead one in `dataLoader.ts`. The silent fallback chain (`API → static → mock`) means the 404 is never surfaced as an error; it looks like the app is working. This is documented in CONCERNS.md as a known risk ("Silent data corruption").

**Consequences:** Bloomington tracker appears functional but shows mock data (Police Department at $120M instead of actual ~$26M). Per-resident cost calculations are wrong. Citizens receive fabricated civic information.

**Prevention:** The file migration and the data-loader path update must happen in the same commit — or the data-loader must be updated first. Never move data files before updating all load paths. Remove the mock data fallback before shipping namespaced paths (replace with a visible error state per CONCERNS.md recommendation).

**Detection:** After file migration, open browser DevTools Network tab on `/bloomington`. Look for any 404s on `.json` requests. Check the browser console for "Falling back to mock data..." log lines (which would confirm silent fallback).

**Phase:** Data namespacing phase (DATA-01, DATA-02, DATA-03). High risk window.

---

### Pitfall 3: LA Budget Hierarchy Does Not Map to Bloomington's Five-Level `hierarchy` Config

**What goes wrong:** Bloomington's `operating` dataset uses a five-level hierarchy: `primary_function → priority → service → fund → item_category`. This exact column structure is hardcoded into `processBudget.js`'s `generateLinkKey` function (lines 101–116), the transaction-linking logic, and implicitly into `BudgetVisualization` which renders up to five drill-down levels. Los Angeles city budget data from data.lacity.org uses different column names and a different organizational structure — commonly `Program → Appropriation Unit → Account` or `Department → Program → Object`, depending on the dataset and year. If the processing script receives LA data and tries to extract `primary_function`, `priority`, `service`, `fund`, `item_category` columns, every row maps to "Uncategorized" at every level.

**Why it happens:** `processBudget.js` reads `this.config.hierarchy` from `treasuryConfig.json` and extracts matching column names from CSV rows (line 133: `const key = row[level] || 'Uncategorized'`). If the LA CSV does not have columns named `primary_function` or `priority`, the fallback is always "Uncategorized" — producing a flat single-node tree.

**Consequences:** LA tracker renders a single "Uncategorized" bar covering 100% of the budget. No drill-down is possible. The error is silent — no exception is thrown, the JSON is written, the app loads.

**Prevention:** Before writing any processing script, manually download the LA budget CSV and map its actual column names. Create a separate LA-specific config (e.g., `la-config.json`) with the correct `hierarchy` array for LA's columns. Parameterize `processBudget.js` to accept a city-specific config rather than reading the single global `treasuryConfig.json`.

**Detection:** After running the processing script on LA data, open the output JSON and verify the top-level categories contain more than one entry and none is named "Uncategorized". Also verify `metadata.totalBudget` is non-zero and reasonable (LA's total budget is $12–14 billion, not millions).

**Phase:** Pipeline parameterization (PIPE-01) and LA data sourcing (LA-01, LA-02).

---

### Pitfall 4: Transaction `linkKey` System is Bloomington-Specific and Will Not Work for LA

**What goes wrong:** The `linkedTransactions` feature — which links budget categories to individual vendor transactions — works by generating a `linkKey` string in the format `priority|service|fund|item_category` (lowercase, pipe-separated). This is Bloomington's specific field set. LA's checkbook/vendor data uses entirely different field names. If the transaction linking step runs on LA data with the same key-generation logic, every budget category will have `linkedTransactions: null` (no matches found). The `LinkedTransactionsPanel` component will simply not appear, silently omitting a major feature from LA.

**Why it happens:** `generateLinkKey` in `processBudget.js` (lines 101–116) hardcodes the mapping from hierarchy levels to link fields. It references `priority`, `service`, `fund`, `item_category` by name. LA data won't have these fields.

**Consequences:** LA tracker has no linked transactions panel. This is acceptable for v1.1 if documented — but only if it's a deliberate decision, not an accidental omission.

**Prevention:** For v1.1 LA support, explicitly disable transactions linking for LA in the city config (e.g., `"hasTransactions": false`). Document this as a known LA gap. Do not attempt to force the Bloomington link-key format onto LA data without first verifying LA has equivalent granularity.

**Detection:** Check whether the LA operating budget dataset includes per-transaction detail with fields that could map to Bloomington's `Priority|Service|Fund|ExpenseCategory`. If not, transactions are unavailable for LA and the config should reflect that.

**Phase:** Pipeline parameterization (PIPE-01), and to a lesser degree LA data sourcing (LA-01).

---

## Moderate Pitfalls

---

### Pitfall 5: Hardcoded City Strings in App.tsx Surface on Bloomington After Routing Is Added

**What goes wrong:** `App.tsx` contains at least three Bloomington-specific hardcoded strings that will not update when a city routing layer is added unless they are explicitly replaced:
- Line 305: `<h1>Bloomington, Indiana Finances</h1>`
- Line 296–299: Wikipedia hero image URL for Monroe County Courthouse
- Line 184: Breadcrumb first item hardcoded as `'City'` (should be city name)
- The `years` array (line 141) hardcoded as `['2025', '2024', '2023', '2022', '2021']`

If the city config system is built (CITY-01 to CITY-03) but these hardcoded values are not replaced, Bloomington renders correctly but LA shows "Bloomington, Indiana Finances" as its H1 heading and the Bloomington courthouse as its hero image.

**Prevention:** During the city config phase, do a grep for the string `"Bloomington"` and `"bloomington"` across all `.tsx` and `.ts` files before marking the phase complete. Replace every instance with a config lookup. The `budgetData.metadata.cityName` is already rendered in the section heading (line 392) — use that pattern throughout.

**Detection:** Navigate to `/los-angeles` and verify the H1 text is "Los Angeles, California Finances" (or equivalent). Verify the hero image is not the Monroe County Courthouse.

**Phase:** City config phase (CITY-01 to CITY-03).

---

### Pitfall 6: LA Open Data Fiscal Year Mismatch — LA Uses July–June, Not Calendar Year

**What goes wrong:** Los Angeles uses a fiscal year that runs July 1 through June 30 (e.g., FY 2024-25). Bloomington uses a calendar year (FY 2025 = January–December 2025). The `BudgetData.metadata.fiscalYear` field is typed as `number` and currently stores a single integer (e.g., `2025`). LA's two-year fiscal year notation (`"2024-25"` or `2025`) creates an ambiguity: does `2025` mean Bloomington FY 2025 (Jan–Dec 2025) or LA FY 2024-25 (Jul 2024–Jun 2025)?

**Why it happens:** The `fiscalYear` field was designed for a calendar-year city. The year selector in `App.tsx` is a string array (`['2025', '2024', ...]`) and the file naming is `budget-2025.json`. LA data requires either a two-part year label or a convention decision.

**Consequences:** Year selector shows "2025" for both Bloomington (full year) and LA (half of the calendar year). Citizens comparing the two cities assume equivalent time windows but are seeing mismatched periods. LA totals appear lower than expected because only part of a calendar year is included.

**Prevention:** Define a convention in the LA city config: either store fiscal year as the ending calendar year (LA FY 2024-25 → `2025`) with a metadata note explaining the July–June period, or add a `fiscalYearLabel` string field to `BudgetData.metadata` separate from the integer `fiscalYear`. Render the label in the UI rather than the raw integer.

**Detection:** Confirm with the LA budget documentation what "FY 2025" maps to in calendar dates. Verify the processed LA JSON shows a reasonable total (~$12–14B) and not a partial-year amount that looks wrong.

**Phase:** LA data sourcing (LA-01) and city config (CITY-01, CITY-03).

---

### Pitfall 7: LA Data File Sizes May Be an Order of Magnitude Larger Than Bloomington

**What goes wrong:** Bloomington transaction data runs 38–47MB per year (already flagged as a performance problem in CONCERNS.md). Los Angeles is the second-largest city in the US; its checkbook data covers thousands of vendors and tens of thousands of line items. An LA transactions index file at the same structure could be 500MB–1GB, which is completely unusable via client-side fetch.

**Why it happens:** The current processing pipeline embeds transaction previews into every budget category node (the `-linked.json` approach) and builds a full in-memory transaction index. This works at Bloomington scale but fails at LA scale.

**Consequences:** The LA operating budget file is unusable in the browser. The build step may run out of memory or take hours. Netlify's 100MB deploy artifact limit would be exceeded.

**Prevention:** When sourcing LA data (LA-01), audit the raw file size before deciding the processing strategy. If LA transaction data exceeds ~20MB, do not use the linked-JSON approach for LA — omit the transactions panel for v1.1 (acceptable per scope: "at least one dataset functional") and document it. The city config `hasTransactions: false` flag handles this cleanly.

**Detection:** Download the LA checkbook CSV from data.lacity.org before writing any processing code. Check the file size and row count. If row count exceeds ~500,000, the current pipeline architecture is unsuitable for full transaction linking.

**Phase:** LA data sourcing (LA-01, LA-02). Must be assessed before any LA pipeline work begins.

---

### Pitfall 8: Population Figure for LA Cannot Be Sourced From the Budget CSV Itself

**What goes wrong:** Bloomington's population (79,168) is hardcoded in `treasuryConfig.json` and embedded into the processed JSON at `metadata.population`. The per-resident cost calculation (`$X per resident annually`) depends on this figure. LA's population (~3.9 million) must be added to the LA city config manually — it will not appear in the LA budget CSV. If the LA config is scaffolded but `population` is left at 0 or omitted, the per-resident cost displays "$0" or `Infinity` and the info card is broken.

**Prevention:** The LA city config must explicitly include `"population": 3900000` (or the current Census figure). Make the population field required in the city config schema. Add a validation check in the processing script that errors if `population` is 0 or missing.

**Detection:** Load the LA tracker and verify the info card shows a plausible per-resident annual cost (LA's total budget is ~$12B / ~3.9M residents = ~$3,100 per resident per year). A value of $0, NaN, or >$100,000 indicates a missing or wrong population figure.

**Phase:** City config (CITY-01, CITY-03).

---

### Pitfall 9: `data.lacity.org` Socrata API Rate Limits and Dataset ID Instability

**What goes wrong:** Los Angeles publishes budget data through the Socrata platform at `data.lacity.org`. Socrata dataset IDs (the alphanumeric code in the URL, e.g., `ijzp-q8t2`) can change when datasets are republished, replaced by a new edition, or reorganized. If a processing script hardcodes a Socrata dataset ID or API endpoint, it silently breaks when the dataset is refreshed for a new fiscal year. Additionally, bulk CSV exports from Socrata include metadata header rows and can use non-standard quoting that breaks the existing hand-rolled CSV parser in `processBudget.js`.

**Why it happens:** The custom CSV parser in `processBudget.js` (`parseCSVLine`, lines 47–66) does not handle multi-line quoted fields (a field value that contains a newline inside quotes). Socrata exports often include description fields with embedded newlines and commas.

**Consequences:** Processing script silently drops rows where the CSV parser fails on multi-line fields. Budget totals are understated. The parser does not throw; it just produces a row with fewer values than headers and skips it (line 32: `if (values.length === headers.length)`).

**Prevention:** Do not hardcode Socrata dataset IDs — store them in the LA city config. Verify the dataset ID is still current each fiscal year. Replace the hand-rolled CSV parser with a robust library (`csv-parse` or `papaparse`) before processing LA data, given that LA's CSV exports are likely more complex than Bloomington's.

**Detection:** After parsing the LA CSV, log the row count and compare it to the number of rows reported in the Socrata dataset metadata. A significant discrepancy (>5%) means rows are being silently dropped.

**Phase:** Pipeline parameterization and LA data sourcing (PIPE-01, LA-01, LA-02).

---

## Minor Pitfalls

---

### Pitfall 10: Year Selector Hardcoded Array Will Show Bloomington Years for LA

**What goes wrong:** The `years` array in `App.tsx` (line 141: `['2025', '2024', '2023', '2022', '2021']`) is a hardcoded constant. If LA data only exists for 2025, the year selector on the LA tracker will show five year options (2021–2025) but only 2025 has real data. Selecting 2021–2024 for LA will 404 or fall back to mock data.

**Prevention:** Move the available-years list into the city config (`availableYears: [2025]` for LA v1.1 launch). Derive the year selector options from the city config rather than a global constant. This also fixes the existing "Hardcoded Year Range" scaling limit documented in CONCERNS.md.

**Phase:** City config (CITY-01) and routing (ROUTE-02, ROUTE-03).

---

### Pitfall 11: Two Separate `budgetConfig.json` and `treasuryConfig.json` Files Will Both Need City-Scoping

**What goes wrong:** The codebase has two config files: `budgetConfig.json` (appears unused — scripts read only `treasuryConfig.json`) and `treasuryConfig.json` (the active config). CONCERNS.md flags this as a known inconsistency. If a developer scaffolds LA config by copying `budgetConfig.json` (believing it to be the active one), the processing scripts will ignore it and continue using `treasuryConfig.json`. No error is thrown.

**Prevention:** Delete `budgetConfig.json` (the CONCERNS.md recommendation) before beginning the multi-city work, to eliminate the confusion vector. Then the config structure is clear: one file per city.

**Phase:** Preliminary cleanup before pipeline parameterization (PIPE-01 prerequisite).

---

### Pitfall 12: `DatasetTabs` Shows All Three Tabs for Every City Even If LA Lacks Salaries Data

**What goes wrong:** The `DatasetTabs` component renders operating, revenue, and salaries tabs. Requirement CITY-02 specifies "Dataset tabs render only the datasets configured as available for that city." If this is not implemented before LA is launched, the LA tracker shows a "People" (salaries) tab. Clicking it triggers a fetch for `public/data/la/salaries-2025.json` (or the equivalent) which does not exist, causing a 404. The app then attempts its fallback chain and may surface Bloomington salaries data labeled as LA.

**Prevention:** Implement CITY-02 (config-driven tab visibility) before making the LA tracker publicly accessible. LA v1.1 should be configured with `availableDatasets: ["operating"]` until salary data is sourced and processed.

**Detection:** On the LA tracker, verify the "People" tab is either absent or shows a "coming soon" state rather than silently loading wrong data.

**Phase:** City config (CITY-02) must complete before LA-03 (LA tracker live).

---

### Pitfall 13: Cache Key in `dataLoader.ts` Uses City Name String, Not City Slug

**What goes wrong:** `dataLoader.ts` (line 22) constructs its cache key as `${cityName}-${year}-${dataset}` using the display name (`"Bloomington"`, `"Los Angeles"`). The data file paths will use slugs (`bloomington`, `los-angeles`). If the city name passed to the loader differs from what was used to build the file path (e.g., `"Los Angeles"` vs. `"los-angeles"` vs. `"LA"`), the cache lookup misses and the fetch uses the wrong path. Note: `dataLoader.ts` is currently dead code (`App.tsx` uses its own `loadDataset`), but if the loader is unified during this milestone, inconsistent naming will cause double-fetches or wrong-path fetches.

**Prevention:** Standardize on city slug throughout (never city name) as the data-loading key and file-path component. If `dataLoader.ts` is unified with the `App.tsx` inline loader during this milestone, use slug as the canonical identifier.

**Phase:** Data namespacing (DATA-01, DATA-02) and pipeline parameterization (PIPE-01).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Routing (ROUTE-01 to ROUTE-04) | Routes appear to work (Netlify serves index.html for any path) but no React router is wired — silent non-routing | Test direct URL navigation in a fresh tab; install router before routes go live |
| File Namespacing (DATA-01 to DATA-03) | Moving Bloomington files before updating load path triggers silent mock-data fallback | Update loader path first; remove mock fallback before migration |
| Pipeline Parameterization (PIPE-01) | Processing LA data with Bloomington hierarchy columns silently produces all-"Uncategorized" output | Audit LA CSV columns before writing any processing config; create LA-specific hierarchy config |
| LA Data Sourcing (LA-01) | Socrata CSV has multi-line quoted fields that break the existing hand-rolled parser | Switch to `csv-parse` or `papaparse` for LA data; verify row counts match source |
| LA Data Sourcing (LA-01) | LA transaction data may be 500MB+, breaking client-side loading and Netlify artifact limits | Check LA checkbook file size before any pipeline work; omit transactions for LA v1.1 if large |
| City Config (CITY-01 to CITY-03) | Hardcoded Bloomington strings in `App.tsx` survive after config system is built | Grep for `"Bloomington"` and `"bloomington"` in all source files before closing the phase |
| City Config (CITY-03) | LA population not in budget CSV; missing population breaks per-resident cost display | Require population in city config schema; validate non-zero before processing |
| LA Tracker Live (LA-03) | DatasetTabs shows salaries tab for LA, silently loads Bloomington salary data | Implement config-driven tab visibility (CITY-02) before going live |

---

## Sources

- Codebase direct audit: `/mnt/c/Treasury Tracker/src/App.tsx`, `src/data/dataLoader.ts`, `src/types/budget.ts`, `scripts/processBudget.js`, `budgetConfig.json`, `treasuryConfig.json`, `netlify.toml` (2026-03-21)
- Codebase concerns analysis: `.planning/codebase/CONCERNS.md` (2026-03-21)
- Codebase architecture analysis: `.planning/codebase/ARCHITECTURE.md` (2026-03-21)
- LA open data platform: data.lacity.org (Socrata); fiscal year structure based on LA City Charter FY convention (HIGH confidence — well-established public record)
- Netlify SPA redirect behavior: Netlify redirect docs pattern `/* → /index.html` is the established SPA deploy pattern (HIGH confidence from training data + netlify.toml in-repo)
- LA budget scale: ~$12–14B total budget, ~3.9M population — derived from publicly available LA city budget summaries (MEDIUM confidence — verify current year figure when sourcing data)
