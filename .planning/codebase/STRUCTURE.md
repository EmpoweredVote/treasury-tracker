# Codebase Structure

**Analysis Date:** 2026-03-21

## Directory Layout

```
treasury-tracker/                  # Project root
├── src/                           # React application source
│   ├── main.tsx                   # DOM entry point (createRoot)
│   ├── App.tsx                    # Root component — all state + layout
│   ├── App.css                    # App-wide component styles
│   ├── index.css                  # Global CSS resets and variables
│   ├── assets/                    # Static assets bundled by Vite
│   ├── components/                # All React UI components
│   │   ├── datasets/              # Dataset-selection UI
│   │   │   └── DatasetTabs.tsx    # Money In / Money Out / People tab switcher
│   │   ├── BudgetVisualization.tsx # View-mode switcher (Bars vs Sunburst)
│   │   ├── BudgetIcicle.tsx       # Stacked horizontal bars visualization
│   │   ├── BudgetIcicle.css
│   │   ├── BudgetSunburst.tsx     # Radial sunburst visualization (D3)
│   │   ├── BudgetSunburst.css
│   │   ├── BudgetBar.tsx          # Single proportional bar (used in CategoryDetail)
│   │   ├── BudgetTree.tsx         # Tree layout visualization variant
│   │   ├── BudgetTree.css
│   │   ├── CategoryList.tsx       # Drill-down list of subcategories with icons
│   │   ├── CategoryDetail.tsx     # Expanded detail panel for a selected category
│   │   ├── LineItemsTable.tsx     # Tabular line items (revenue / salaries datasets)
│   │   ├── LineItemsTable.css
│   │   ├── LinkedTransactionsPanel.tsx  # Transaction detail for operating dataset
│   │   ├── LinkedTransactionsPanel.css
│   │   ├── TransactionLineItemsTable.tsx
│   │   ├── TransactionLineItemsTable.css
│   │   ├── PerDollarBreakdown.tsx # "Per $10 of taxes" civic calculator
│   │   ├── Breadcrumb.tsx         # Navigation breadcrumb trail
│   │   ├── NavigationTabs.tsx     # City / State / Federal scope tabs
│   │   ├── SearchBar.tsx          # Inline category search input
│   │   └── YearSelector.tsx       # Fiscal year dropdown
│   ├── data/                      # Data loading and mock fallback
│   │   ├── dataLoader.ts          # fetch + cache + three-tier fallback logic
│   │   ├── budgetData.ts          # Hardcoded mock BudgetData (last-resort fallback)
│   │   └── processedBudget.json   # Legacy processed JSON (unused at runtime)
│   └── types/                     # Shared TypeScript interfaces
│       ├── budget.ts              # BudgetData, BudgetCategory, LineItem, LinkedTransaction, etc.
│       └── ev-ui.d.ts             # Type declarations for @chrisandrewsedu/ev-ui package
├── public/                        # Vite public directory — served as-is
│   └── data/                      # Pre-processed JSON datasets (runtime data)
│       ├── budget-{year}.json          # Operating budget by year (2021–2025)
│       ├── budget-{year}-linked.json   # Operating budget + embedded transaction summaries
│       ├── revenue-{year}.json         # Revenue data by year
│       ├── salaries-{year}.json        # Salary/compensation data by year
│       ├── transactions-{year}.json    # Transaction summaries by year
│       └── transactions-{year}-index.json  # Full transaction index (lazy-loaded, ~40–50 MB)
├── scripts/                       # Offline ETL — run before deploy, not at runtime
│   ├── processBudget.js           # CSV → budget-{year}.json
│   ├── processRevenue.js          # CSV → revenue-{year}.json
│   ├── processSalaries.js         # CSV → salaries-{year}.json
│   ├── processTransactions.js     # CSV → transactions-{year}.json
│   ├── linkBudgetTransactions.js  # Joins budget + transactions → budget-{year}-linked.json
│   └── colorUtils.js              # Color assignment helpers for ETL scripts
├── data/                          # Raw source data (not served; ETL input only)
│   └── 2024/
│       ├── annualFinancialReports/
│       ├── budgetData/
│       ├── entityAnnualReport/
│       ├── schoolExtraCurricularAccounts/
│       ├── FileLayoutDocumentation_AFR.xls
│       └── FileLayoutDocumentation_budgets.xls
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Auto-generated codebase analysis docs
├── archivedInstructions/          # Historical prompt/instruction files
├── screenshots/                   # UI screenshots (documentation / reference)
├── index.html                     # Vite HTML template
├── vite.config.ts                 # Vite config (base: '/', React plugin)
├── tsconfig.json                  # TypeScript project references root
├── tsconfig.app.json              # App source TypeScript config
├── tsconfig.node.json             # Node/scripts TypeScript config
├── eslint.config.js               # ESLint flat config
├── package.json                   # Dependencies and npm scripts
├── netlify.toml                   # Netlify build + SPA redirect + API proxy rules
├── budgetConfig.json              # Operating-budget ETL configuration
└── treasuryConfig.json            # Multi-dataset ETL configuration (canonical)
```

## Directory Purposes

**`src/components/`:**
- Purpose: All React UI components; each component is self-contained with an optional co-located CSS file
- Contains: Visualization components, navigation chrome, detail panels, utility widgets
- Key files: `BudgetVisualization.tsx` (view-mode switcher), `BudgetIcicle.tsx` (primary bars visualization), `BudgetSunburst.tsx` (D3 radial view), `CategoryList.tsx` (drill-down list), `LinkedTransactionsPanel.tsx` (transaction detail)

**`src/components/datasets/`:**
- Purpose: Components specific to the dataset-tab UI (Money In / Money Out / People)
- Contains: `DatasetTabs.tsx` only
- Key files: `DatasetTabs.tsx` — defines the `Dataset` type and `DATASETS` constant

**`src/data/`:**
- Purpose: Runtime data access — fetching, caching, and fallback
- Contains: `dataLoader.ts` (primary), `budgetData.ts` (mock fallback), `processedBudget.json` (legacy, not actively used)
- Key files: `dataLoader.ts` — the single function `loadBudgetData()` and `loadDataset()` in App

**`src/types/`:**
- Purpose: Shared TypeScript type definitions consumed by all layers
- Contains: `budget.ts` (all domain types), `ev-ui.d.ts` (third-party declarations)

**`public/data/`:**
- Purpose: Pre-built JSON data files served as static assets; loaded at runtime by `fetch('./data/...')`
- Generated: Yes, by `scripts/` ETL pipeline
- Committed: Yes (large files — transaction index files are 40–50 MB each)

**`scripts/`:**
- Purpose: Offline data transformation; converts raw government CSV exports into the hierarchical `BudgetData` JSON format
- Generated: No (hand-authored scripts)
- Committed: Yes

**`data/`:**
- Purpose: Raw source CSV/XLS files from government open-data portals; input to ETL scripts
- Generated: No (downloaded manually)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM mount
- `src/App.tsx`: Root component; all state; dataset and navigation management

**Configuration:**
- `treasuryConfig.json`: Multi-dataset ETL config (hierarchy, colors, input/output file paths) — canonical config
- `budgetConfig.json`: Legacy operating-budget-only ETL config
- `vite.config.ts`: Build tool config (base path, React plugin)
- `netlify.toml`: Deployment config including API proxy to `https://ev-backend-h3n8.onrender.com`

**Core Logic:**
- `src/data/dataLoader.ts`: Data fetching, module-level cache, API-to-BudgetData transform
- `src/types/budget.ts`: All domain interfaces — start here when understanding data shape

**ETL:**
- `scripts/processBudget.js`: Primary operating-budget processor
- `scripts/linkBudgetTransactions.js`: Post-processing step that embeds transaction summaries into budget nodes

**Testing:**
- No test files present. No test runner configured.

## Naming Conventions

**Files:**
- React components: PascalCase matching the component name — `BudgetIcicle.tsx`, `CategoryList.tsx`
- CSS co-located with component: same base name — `BudgetIcicle.css`
- Data files: kebab-case with dataset type and year — `budget-2025-linked.json`, `revenue-2024.json`
- ETL scripts: camelCase — `processBudget.js`, `linkBudgetTransactions.js`
- Config files: camelCase JSON — `budgetConfig.json`, `treasuryConfig.json`

**Directories:**
- Source directories: lowercase singular (`components`, `data`, `types`, `assets`)
- Public data directory: lowercase (`public/data`)
- Sub-grouping within components: lowercase singular noun describing the group (`datasets/`)

**TypeScript:**
- Interfaces: PascalCase — `BudgetCategory`, `BudgetData`, `LinkedTransaction`
- Type aliases: PascalCase — `DatasetType`, `ViewMode`
- Functions: camelCase — `loadBudgetData`, `handleCategoryClick`, `formatCurrency`
- State variables: camelCase — `activeDataset`, `navigationPath`, `selectedYear`

## Where to Add New Code

**New visualization component:**
- Implementation: `src/components/{ComponentName}.tsx` + `src/components/{ComponentName}.css`
- Wire up: Add to `BudgetVisualization.tsx` as a new `viewMode` option, or directly in `App.tsx`

**New dataset type (e.g. capital projects):**
- Config: Add entry to `treasuryConfig.json`
- ETL: Add `scripts/process{DatasetName}.js`
- Types: Add to `DatasetType` union in `src/App.tsx` line 21
- UI: Add to `DATASETS` array in `src/components/datasets/DatasetTabs.tsx`
- Data loading: Add to `fileMap` in `loadDataset()` in `src/App.tsx` lines 25–31

**New feature component (e.g. year-over-year chart):**
- Implementation: `src/components/{FeatureName}.tsx`
- Integrate: Import and render in `src/App.tsx` at the appropriate layout position

**New shared type:**
- Location: `src/types/budget.ts`

**New utility / helper function:**
- If ETL-related: `scripts/` as a new `.js` module or addition to `colorUtils.js`
- If UI-related: Either co-locate in the component using it, or create `src/utils/{helperName}.ts` (no `utils/` directory exists yet — create it)

**Processed data for a new year:**
- Run `npm run process-all` after placing raw CSV in `data/`
- Outputs land in `public/data/` automatically per `outputFile` pattern in `treasuryConfig.json`

## Special Directories

**`public/data/`:**
- Purpose: Runtime-served JSON datasets
- Generated: Yes (by `npm run process-*` scripts)
- Committed: Yes — note that `transactions-{year}-index.json` files are very large (40–50 MB each); this may cause slow clone/push times

**`.planning/`:**
- Purpose: GSD planning documents (codebase analysis, phase plans)
- Generated: Yes (by GSD map-codebase and plan-phase commands)
- Committed: Intended to be committed alongside source code

**`archivedInstructions/`:**
- Purpose: Historical AI prompt and instruction documents from earlier development sessions
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-21*
