# Architecture

**Analysis Date:** 2026-03-21

## Pattern Overview

**Overall:** Single-Page Application (SPA) with client-side state management and a three-tier data loading strategy.

**Key Characteristics:**
- All application state (navigation path, active dataset, selected year) lives in `src/App.tsx` as React `useState` hooks — no external state library
- Data is fetched at runtime using a waterfall fallback: remote API → static JSON in `public/data/` → in-memory mock data in `src/data/budgetData.ts`
- Visualization components receive data via props and call back to App via handler functions; they own no data state of their own
- A separate offline ETL pipeline (`scripts/`) transforms raw CSV files into the hierarchical `BudgetData` JSON format that the app consumes

## Layers

**Entry / Shell Layer:**
- Purpose: Bootstrap React into the DOM; apply global CSS resets
- Location: `src/main.tsx`, `src/index.css`, `index.html`
- Contains: `createRoot` call, StrictMode wrapper
- Depends on: Nothing except React and App component
- Used by: Browser

**App Orchestration Layer:**
- Purpose: Owns all UI state; coordinates data loading; routes between dataset and drill-down views; computes breadcrumb and filtered categories
- Location: `src/App.tsx`
- Contains: Dataset selection state, navigation path array, year selector, search query, `loadDataset()` async helper, all event handlers (`handleCategoryClick`, `handleBack`, `handleBreadcrumbClick`, `handlePathClick`)
- Depends on: Data layer (`src/data/dataLoader.ts`, `src/data/budgetData.ts`), all UI components, types
- Used by: Nothing (top of the tree)

**UI Component Layer:**
- Purpose: Render individual pieces of the interface; accept data via props; emit events upward
- Location: `src/components/`
- Contains: Visualization components, navigation chrome, layout helpers, detail panels
- Depends on: `src/types/budget.ts`, sibling CSS files, `lucide-react`, `d3`, `@chrisandrewsedu/ev-ui`
- Used by: `src/App.tsx`

**Data / Type Layer:**
- Purpose: Define shared TypeScript interfaces; provide data loading with caching and fallback; hold mock budget data
- Location: `src/data/`, `src/types/`
- Contains: `dataLoader.ts` (fetch + cache + transform), `budgetData.ts` (mock fallback), `budget.ts` (all interfaces), `ev-ui.d.ts` (third-party type declarations)
- Depends on: Browser `fetch` API, `import.meta.env.VITE_API_URL`
- Used by: `src/App.tsx`

**ETL / Build-time Data Layer:**
- Purpose: Transform raw government CSV files into the hierarchical JSON format that the app expects; run offline before deploy
- Location: `scripts/`, `data/` (raw input), `public/data/` (processed output)
- Contains: `processBudget.js`, `processRevenue.js`, `processSalaries.js`, `processTransactions.js`, `linkBudgetTransactions.js`, `colorUtils.js`
- Depends on: Node.js `fs`, `budgetConfig.json` / `treasuryConfig.json`, raw CSV files in `data/`
- Used by: Nothing at runtime; outputs consumed via `fetch` in `src/data/dataLoader.ts`

## Data Flow

**Initial Page Load:**

1. `src/main.tsx` mounts `<App />`
2. `App` fires two parallel `loadDataset()` calls for `operating` and `revenue` datasets of the current year
3. `loadDataset` checks an in-memory `Map` cache; on miss it tries `fetch(VITE_API_URL/treasury/budgets)`, falls back to `fetch('./data/budget-{year}.json')` (static file in `public/data/`), then falls back to importing `src/data/budgetData.ts` mock data
4. On success, `App` sets `budgetData` + `operatingBudgetData` + `revenueData` in state
5. React renders the full page: `SiteHeader`, hero section, info cards, `DatasetTabs`, `BudgetVisualization`

**Drill-Down Navigation:**

1. User clicks a segment in `BudgetIcicle` or `BudgetSunburst`
2. Component calls `onPathClick(path: BudgetCategory[])` prop
3. `App.handlePathClick` sets `navigationPath` to the new path array
4. `App` re-derives `currentCategories` from the last item in `navigationPath.subcategories`
5. If the leaf category has `lineItems` but no `subcategories`, `showLineItems` flag is set
6. For the `operating` dataset at leaf level, `LinkedTransactionsPanel` renders; for `revenue`/`salaries`, `LineItemsTable` renders
7. `Breadcrumb` derives clickable trail from `navigationPath`

**Lazy Transaction Loading:**

1. `LinkedTransactionsPanel` receives a pre-embedded `LinkedTransactionSummary` (top vendors + first N transactions baked into the linked JSON)
2. If `hasMore === true`, user can click "Load all" which triggers `fetch('./data/transactions-{year}-index.json')` to retrieve the full transaction index
3. Loaded data is kept in local component state (`allTransactions`)

**Dataset Switch:**

1. User clicks a tab in `DatasetTabs`
2. `App.setActiveDataset` is called; `navigationPath` and `searchQuery` are reset to empty
3. A new `loadDataset(type, year)` is triggered; results replace `budgetData`

**State Management:**
- All state is React `useState` in `src/App.tsx`; no Redux, Zustand, or Context is used
- The data cache lives in a module-level `Map` inside `src/data/dataLoader.ts`, persisting across re-renders for the same year/dataset combination

## Key Abstractions

**BudgetCategory (recursive tree node):**
- Purpose: Represents any node in the budget hierarchy from top-level department down to a leaf fund
- Examples: `src/types/budget.ts` lines 46–74
- Pattern: Self-referential — `subcategories?: BudgetCategory[]`; leaf nodes carry `lineItems?: LineItem[]` and optionally `linkedTransactions?: LinkedTransactionSummary`

**BudgetData (dataset envelope):**
- Purpose: Top-level response shape wrapping metadata and the root categories array
- Examples: `src/types/budget.ts` lines 76–112
- Pattern: Single shape covers all three dataset types (revenue, operating, salaries); optional fields in `metadata` are used conditionally per type

**navigationPath (drill-down cursor):**
- Purpose: An ordered array of `BudgetCategory` objects representing the user's current position in the hierarchy
- Examples: `src/App.tsx` lines 101, 144–160
- Pattern: Immutable push/slice — navigating in appends to the array; back/breadcrumb slices from the end

**DatasetType union:**
- Purpose: Constrains dataset selection to the three supported views
- Examples: `src/App.tsx` line 21: `type DatasetType = 'revenue' | 'operating' | 'salaries'`

**loadDataset / three-tier fallback:**
- Purpose: Decouple the app from any single data source; enables offline/demo use
- Examples: `src/data/dataLoader.ts` lines 18–92; `src/App.tsx` lines 24–52

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Page load
- Responsibilities: Mount React tree, apply StrictMode

**App Component:**
- Location: `src/App.tsx`
- Triggers: React mount; `activeDataset` or `selectedYear` state changes
- Responsibilities: Load data, manage all UI state, render full page layout

**ETL Scripts:**
- Location: `scripts/processBudget.js`, `scripts/processRevenue.js`, `scripts/processSalaries.js`, `scripts/processTransactions.js`, `scripts/linkBudgetTransactions.js`
- Triggers: `npm run process-budget|process-revenue|process-salaries|process-transactions|process-all` (run offline before deploy)
- Responsibilities: Read raw CSV from `data/`, apply `budgetConfig.json` / `treasuryConfig.json` hierarchy config, assign colors via `colorUtils.js`, write processed JSON to `public/data/`

## Error Handling

**Strategy:** Silent degradation — each data-loading tier catches its own error and falls through to the next tier; the UI shows "Loading data..." or "Unable to load data" only as a last resort.

**Patterns:**
- `dataLoader.ts` wraps API and static-file fetches in `try/catch` with `console.warn` before falling back
- `App.tsx` `loadDataset` helper propagates `throw` only if all tiers fail; caught in `.catch()` with `console.error`
- `LinkedTransactionsPanel` maintains its own `loadError` state for on-demand transaction loading failures
- No global error boundary is present in the codebase

## Cross-Cutting Concerns

**Logging:** `console.log` for successful data loads; `console.warn` for fallback triggers; `console.error` for terminal failures. No structured logging library.

**Validation:** None at runtime. Data shape is trusted from the JSON files; TypeScript types are enforced only at compile time.

**Authentication:** None. The app is entirely public (read-only, no login).

**Currency Formatting:** `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` duplicated across multiple components; abbreviated M/K formatting also duplicated.

---

*Architecture analysis: 2026-03-21*
