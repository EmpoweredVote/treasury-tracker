# Codebase Concerns

**Analysis Date:** 2026-03-21

---

## Tech Debt

**Dead Code: `dataLoader.ts` is unused in the running application**
- Issue: `src/data/dataLoader.ts` exports `loadBudgetData`, `clearCache`, and `listCities` — none of which are imported anywhere in the React app. `App.tsx` defines its own `loadDataset` function inline and calls `fetch()` directly. The API-first loading logic in `dataLoader.ts` (with the `https://api.empowered.vote` backend) is completely dormant.
- Files: `src/data/dataLoader.ts`, `src/App.tsx` (lines 24–53)
- Impact: Developers reading `dataLoader.ts` may believe it drives data loading, leading to confusion. The API integration path is not exercised and will drift from the actual data shape.
- Fix approach: Either wire `dataLoader.ts` into `App.tsx` (replacing the inline `loadDataset`) or delete it. Decision depends on whether the API backend is a real future path.

**Dead Code: Multiple components exist but are not rendered anywhere**
- Issue: The following components are defined but not imported by `App.tsx` or any other rendered component: `BudgetTree` (`src/components/BudgetTree.tsx`), `CategoryDetail` (`src/components/CategoryDetail.tsx`), `PerDollarBreakdown` (`src/components/PerDollarBreakdown.tsx`), `TransactionLineItemsTable` (`src/components/TransactionLineItemsTable.tsx`), and `BudgetBar` (only referenced from `CategoryDetail`, which is itself dead).
- Files: `src/components/BudgetTree.tsx`, `src/components/CategoryDetail.tsx`, `src/components/PerDollarBreakdown.tsx`, `src/components/TransactionLineItemsTable.tsx`, `src/components/BudgetBar.tsx`
- Impact: Bundle size includes dead code; future developers may waste time reading or modifying these components thinking they affect the UI. `PerDollarBreakdown` and `CategoryDetail` represent partially-implemented features from the design doc (tax calculator, educational panels) that are not yet surfaced.
- Fix approach: Remove dead components or explicitly mark them as "in-progress" with a comment. Wire them in once the features are intentionally built.

**Mock Budget Data Still In Fallback Path**
- Issue: `src/data/budgetData.ts` contains a hardcoded `bloomingtonBudget2025` mock dataset with fictional amounts (e.g., Police Department at $120M vs actual ~$26M). This mock is the final fallback in `dataLoader.ts` if both API and static JSON fail. The mock data does not match Bloomington's real budget and will silently serve wrong numbers if static files are ever unavailable.
- Files: `src/data/budgetData.ts`, `src/data/dataLoader.ts` (lines 75–92)
- Impact: Silent data corruption — the UI will appear to work but show fabricated numbers to citizens.
- Fix approach: Remove the mock fallback from `dataLoader.ts`. Fail loudly (show an error state) rather than serving fabricated data. Consider keeping `budgetData.ts` as a clearly-named fixture only for tests.

**Duplicate Config Files with Inconsistencies**
- Issue: Two config files both describe the same project: `budgetConfig.json` (root) and `treasuryConfig.json` (root). They have conflicting population values: `budgetConfig.json` says 79,168; `dataLoader.ts` hardcodes 85,000; `src/data/processedBudget.json` says 79,168; and `public/data/budget-2025.json` says 79,168. The scripts read from `treasuryConfig.json` only.
- Files: `budgetConfig.json`, `treasuryConfig.json`, `src/data/dataLoader.ts` (line 82), `src/data/processedBudget.json`
- Impact: The hero section in `App.tsx` displays population from the JSON metadata (correct: 79,168) but `dataLoader.ts` fallback would show 85,000 if activated. Citizens would see different population figures depending on code path.
- Fix approach: Delete `budgetConfig.json` (it appears to be a legacy artifact); remove the hardcoded population in `dataLoader.ts`; source population from config only.

**Config Naming Mislabels Data Files**
- Issue: In `treasuryConfig.json`, the `"salaries"` dataset points to `data/checkbook-all.csv` (which contains payroll/employee records), while the `"transactions"` dataset points to `data/payroll-all.csv` (which contains individual payment transactions). The filenames are swapped relative to their semantic meaning.
- Files: `treasuryConfig.json` (lines 72–93), `data/checkbook-all.csv`, `data/payroll-all.csv`
- Impact: Any developer adding a new year's data will likely put the wrong file in the wrong slot. The CSV headers confirm the mislabeling: `payroll-all.csv` contains `Priority, Service, Department, Vendor, Amount` (transaction checkbook data) while `checkbook-all.csv` contains `employee_id, name_last, department, pay_total_actual` (actual payroll).
- Fix approach: Rename source data files to match their contents (`payroll-all.csv` → `transactions-all.csv`, `checkbook-all.csv` → `salaries-all.csv`) and update config accordingly.

**Search is Shallow-Only and Does Not Persist Across Navigation**
- Issue: `App.tsx` `filterCategories` only searches the current navigation level's category names and descriptions. It does not search across years, across datasets, or recursively into subcategories. Additionally, `searchQuery` is reset on every dataset/year change (lines 121–122), meaning users lose their search when switching views.
- Files: `src/App.tsx` (lines 248–259)
- Impact: Searching "Fire" at top level works, but searching from within a subcategory only finds siblings. Users cannot discover line items or transactions via search.
- Fix approach: Implement recursive search across the full hierarchy, returning matching nodes with their ancestor paths. Debounce the input; do not reset on year change (reset only on dataset change).

---

## Known Bugs

**Year Selector Rendered Twice at Deeper Navigation Levels**
- Symptoms: When `navigationPath.length > 1`, a second `YearSelector` is rendered inside the `section-header` div (App.tsx line 399). The header-area `YearSelector` from the main header is also still present. Two year selectors appear simultaneously for the user.
- Files: `src/App.tsx` (lines 268–285 header selector, lines 396–401 section selector)
- Trigger: Navigate into any category that is not the top level (e.g., Budget → Public Safety → Fire).
- Workaround: None; both selectors work independently but the duplicate is confusing.

**`CategoryDetail` Has Hardcoded Police Department Logic and 2024 Label**
- Symptoms: `CategoryDetail.tsx` line 44 checks `category.name === "Police Department"` to inject a hardcoded description. Line 93 renders "for 2024" as a static string regardless of the selected fiscal year.
- Files: `src/components/CategoryDetail.tsx` (lines 44–47, 93, 87, 98–99)
- Trigger: These bugs are latent — `CategoryDetail` is not currently rendered. They will surface if the component is reactivated.
- Workaround: Not reachable in current UI.

**`NavigationTabs` State/Federal Tabs Visible but Non-Functional**
- Symptoms: "State" and "Federal" tabs are rendered but disabled via `disabled={tab.id !== 'city'}`. The tabs appear in the UI with no "coming soon" label visible to users (only a browser tooltip on hover).
- Files: `src/components/NavigationTabs.tsx` (line 26)
- Trigger: Always visible.
- Workaround: Only the City tab works; other tabs silently do nothing on click.

**`CategoryDetail` "View department website" Link is a Dead `href="#"`**
- Symptoms: The "View department website →" link in `CategoryDetail.tsx` points to `href="#"`, which scrolls the page to the top rather than navigating anywhere.
- Files: `src/components/CategoryDetail.tsx` (line 69)
- Trigger: Latent — `CategoryDetail` is not currently rendered in the app.

---

## Security Considerations

**External Image from Wikipedia Loaded Without Integrity Check**
- Risk: Hero section background image is fetched from `https://upload.wikimedia.org/wikipedia/commons/...` with no Subresource Integrity (SRI) hash. If the URL is reused for a different image by Wikipedia (unlikely but possible), or if a man-in-the-middle intercepts, the background could change.
- Files: `src/App.tsx` (line 296)
- Current mitigation: None. Wikimedia Commons images at fixed URLs are generally stable.
- Recommendations: Download and serve the image from `public/` (already the pattern for `EVLogo.svg`). This also eliminates the external network dependency.

**API Proxy Route in Netlify Exposes Backend URL**
- Risk: `netlify.toml` (line 8) proxies `/api/*` to `https://ev-backend-h3n8.onrender.com/:splat`. The backend hostname is committed in plaintext. If this ever changes to a private endpoint, the URL will need to be moved to a Netlify environment variable.
- Files: `netlify.toml`
- Current mitigation: Acceptable for a public civic app; the backend is not secret.
- Recommendations: Move backend URL to `NETLIFY_BACKEND_URL` environment variable when/if backend becomes sensitive.

**PII in Source Data Files (Salaries CSV Contains Employee Names)**
- Risk: `data/checkbook-all.csv` (50MB) contains real employee names (`name_last`, `name_first`), employee IDs, and compensation data. This file is in the project root. The `treasuryConfig.json` has `"privacyMode": true` and `"aggregateByDefault": true` for salaries, and `processSalaries.js` aggregates by department/position — but the raw CSV with names remains in the repository.
- Files: `data/checkbook-all.csv`
- Current mitigation: `.gitignore` likely covers `data/` — verify before committing. The processed output `public/data/salaries-*.json` appears to be aggregated (no names).
- Recommendations: Confirm `data/*.csv` is in `.gitignore`. Do not commit raw payroll data with employee names to version control.

---

## Performance Bottlenecks

**Transaction Index Files Are 38–47MB Each, Loaded On-Demand**
- Problem: Each year's `transactions-{year}-index.json` is 38MB to 47MB. When a user expands a transaction panel and clicks "View all transactions," `LinkedTransactionsPanel` fetches the full index file for that year (`src/components/LinkedTransactionsPanel.tsx` line 67).
- Files: `src/components/LinkedTransactionsPanel.tsx` (lines 60–83), `public/data/transactions-2025-index.json` (47MB)
- Cause: The index embeds ALL transactions for ALL linkKeys to support client-side filtering. On a slow connection, downloading 47MB to show 200 extra transactions is severe overkill.
- Improvement path: Implement server-side or build-time per-key index files (e.g., `transactions-2025-{linkKey}.json`), so only the relevant slice is fetched. Alternatively, paginate via a proper API endpoint.

**Budget Linked JSON Files Are 9–11MB per Year**
- Problem: Each `budget-{year}-linked.json` is 9–11MB. These are fetched on every page load when the operating dataset is active (the first `loadDataset` call in `App.tsx` tries the linked version first).
- Files: `src/App.tsx` (lines 33–43), `public/data/budget-2025-linked.json` (11MB)
- Cause: Linking embeds a 20-transaction preview plus top vendors into every category node. Deep hierarchies with many categories compound the size.
- Improvement path: Consider lazy-loading transaction data separately from the budget hierarchy. The unlinked `budget-2025.json` is only 1.4MB — 8x smaller.

**CSV Processors Load Full Multi-Year File Into Memory**
- Problem: `processTransactions.js`, `processBudget.js`, `processSalaries.js` all read the entire multi-year CSV (payroll-all.csv is 66MB, checkbook-all.csv is 48MB) into memory as a string, then parse it, then filter by year. This is fine for a build script but will fail or be very slow if data grows significantly.
- Files: `scripts/processTransactions.js` (lines 445–447), `scripts/processBudget.js`
- Cause: No streaming parser; full file loaded before any filtering.
- Improvement path: Use Node.js `readline` streaming with early exit when a year's data is complete, or split source files by year.

**`BudgetSunburst.tsx` Runs Full D3 Re-render on Every Navigation Change**
- Problem: `BudgetSunburst.tsx` uses `useEffect` with `hierarchyData` and `currentPathNames` as dependencies (implied by the full D3 rebuild logic). Every navigation change triggers a complete SVG teardown (`d3.select(svgRef.current).selectAll('*').remove()`) and rebuild of the entire partition layout.
- Files: `src/components/BudgetSunburst.tsx` (lines 88–92)
- Cause: D3 imperative rendering pattern mixed with React state; no incremental update.
- Improvement path: Transition arc positions using D3 transitions rather than full redraws, or switch to a declarative React-based sunburst.

---

## Fragile Areas

**Transaction-to-Budget Linking Relies on String Key Matching**
- Files: `scripts/processTransactions.js` (lines 95–123), `scripts/linkBudgetTransactions.js` (lines 30–54)
- Why fragile: The `linkKey` format (`priority|service|fund|expenseCategory`, all lowercase) is constructed separately in two places — once in `processTransactions.js` during index building, and once in `processBudget.js` during category creation. If the CSV column naming, casing, or hierarchy changes in a new data year, links silently break (categories show no transactions) with no validation error.
- Safe modification: Any change to the hierarchy columns in `treasuryConfig.json` must be mirrored in the `generateLinkKeys` function in `processTransactions.js`. Add a post-process validation step that logs unlinked budget categories.
- Test coverage: None.

**Inline `loadDataset` in `App.tsx` Bypasses the Shared Cache**
- Files: `src/App.tsx` (lines 24–53), `src/data/dataLoader.ts`
- Why fragile: `App.tsx` has its own `loadDataset` function with no caching. The two separate `useEffect` hooks in `App.tsx` (lines 104–116 and 119–133) both call `loadDataset` independently, meaning the operating dataset is fetched twice on initial load (once for the info card totals, once for the main visualization).
- Safe modification: Deduplicate by memoizing the fetch promise or by unifying both effects into a single call.
- Test coverage: None.

**`BudgetIcicle` Uses Category Name as React Key**
- Files: `src/components/BudgetIcicle.tsx` (line 143)
- Why fragile: `key={segment.category.name}` relies on category names being unique within a level. If two subcategories have the same name (possible in real budget data — e.g., two funds named "General"), React will produce key collisions causing silent rendering bugs and missed re-renders.
- Safe modification: Use a composite key like `${segment.category.name}-${segment.path.join('/')}` or a stable ID from the data.
- Test coverage: None.

**`App.tsx` Error State Does Not Show After Initial Load Failure**
- Files: `src/App.tsx` (lines 214–234)
- Why fragile: The loading gate `if (loading || !operatingBudgetData)` shows a loading spinner, and `if (!budgetData)` shows an error. But if the initial `operatingBudgetData` fetch succeeds and a subsequent year-change fetch fails, `loading` is set to `false` and `budgetData` is `null`, correctly showing the error screen. However, if `operatingBudgetData` is stale from a prior year and the active dataset fails, the info card will show the prior year's total while the main visualization shows an error — inconsistent UI state.
- Safe modification: Track `operatingBudgetData` load errors separately and reset it on `selectedYear` change.
- Test coverage: None.

---

## Scaling Limits

**Hardcoded Year Range**
- Current capacity: Years 2021–2025 are hardcoded as an array in `App.tsx` (line 141) and as iterations in `treasuryConfig.json` (line 4).
- Limit: Adding a new fiscal year (2026) requires manual edits to both `App.tsx` and `treasuryConfig.json`, then rerunning all processing scripts and redeploying.
- Scaling path: Derive available years by scanning `public/data/` for existing JSON files at build time, or expose the year list from a config endpoint.

**Single City Only**
- Current capacity: All data, labels, and imagery are hardcoded to Bloomington, Indiana. The design doc envisions a multi-city platform.
- Limit: `App.tsx` hardcodes `"Bloomington, Indiana Finances"` in the H1 (line 305), a Wikipedia image of the Monroe County Courthouse (line 296), and city-specific context strings.
- Scaling path: Move city metadata (name, image, population) into `treasuryConfig.json` and read it at runtime. The `dataLoader.ts` architecture already has a city parameter — it just isn't wired to the UI.

---

## Dependencies at Risk

**`@chrisandrewsedu/ev-ui` is a Private/Personal Package**
- Risk: This package (`^0.1.6`) is published under a personal npm scope. It provides `SiteHeader` and design tokens. If the author unpublishes it, changes the API, or the registry becomes unavailable, the app will fail to build.
- Impact: Build failure; `SiteHeader` used in `App.tsx` (line 263); `ev-ui.d.ts` type stubs suggest the full type surface is manually maintained.
- Migration plan: Fork the package into the repo or replace `SiteHeader` with a local component before scaling.

---

## Missing Critical Features

**No Educational Content Layer Implemented**
- Problem: The design doc (`3_Inform_Treasury-Tracker-detailed.md`) specifies three contextual panels per category ("What This Is", "Why It Matters", "Historical Context") and "Did You Know?" pop-ups as core to the civic education mission. The `BudgetCategory` type has `description` and `whyMatters` fields, and the processed JSON data does not populate them with educational content (they come from the raw CSV which has no such fields). `CategoryDetail.tsx` exists to render this content but is not wired into the current app.
- Blocks: The core "civic literacy" value proposition of the tool is not delivered in the current build.

**No Year-Over-Year Change Indicators**
- Problem: The design doc specifies change arrows (↑ +3.7%) on each budget segment. `BudgetCategory` has a `historicalChange` field but it is never populated by the processing scripts and never rendered. Users cannot see trends without manually switching the year selector.
- Blocks: Year-over-year comparison, a primary feature per the design doc.

**"Follow Your Tax Dollars" Calculator Not Implemented**
- Problem: The design doc describes a personal tax contribution calculator (Step 1: enter income; Step 2: see your share per category). `PerDollarBreakdown.tsx` exists and implements a simplified denomination-based breakdown, but it is not rendered in the app and does not match the income-based calculator design.
- Blocks: The personalization feature that makes the data feel relevant to individual citizens.

**State and Federal Budget Views Not Implemented**
- Problem: `NavigationTabs` renders City/State/Federal tabs. State and Federal are permanently disabled. No data sources or processing pipelines exist for these levels.
- Blocks: The broader civic literacy goal of comparing city vs. state vs. federal spending.

---

## Test Coverage Gaps

**No Tests Exist**
- What's not tested: 100% of the codebase. No test runner is configured. No `*.test.tsx`, `*.spec.ts`, or test utility files exist anywhere.
- Files: Entire `src/` directory; all `scripts/*.js` processing scripts
- Risk: Any change to data processing scripts can silently produce malformed JSON that breaks the UI. Navigation logic in `App.tsx` (breadcrumb indexing, back button path slicing) is complex and untested. The transaction-budget linkage key matching is the most fragile logic with zero coverage.
- Priority: High — especially for `scripts/processTransactions.js` `buildTransactionIndex` and `scripts/linkBudgetTransactions.js` where data integrity depends on exact string matching.

---

*Concerns audit: 2026-03-21*
