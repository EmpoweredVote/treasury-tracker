# Treasury Tracker — Handoff Context

## Architecture Overview

**Frontend:** React 19 + Vite + Tailwind CSS 4 + D3, repo at `/Users/chrisandrews/Documents/GitHub/treasury-tracker/`
**Backend:** Express API at `/Users/chrisandrews/Documents/GitHub/ev-accounts/backend/`, deployed at `https://ev-accounts-api.onrender.com`
**Database:** Supabase project `kxsdzaojfaibhuzmclfq`, treasury schema with direct `pool.query()` (NOT PostgREST)
**Design System:** `@chrisandrewsedu/ev-ui` — Manrope font, teal/coral/yellow/gray scales. This is the "Inform" pillar → yellow accent (very subtle — thin borders, tiny badges, NOT big yellow backgrounds)

## Data Sources

**Indiana (36 cities, 35 townships, 9 counties):** Indiana Gateway CSV format. Fund names are ALL_CAPS statutory names (GENERAL, MOTOR VEHICLE HIGHWAY, BOND #5). Data loaded via `scripts/bulkLoadGateway.js`. Transaction data loaded via `scripts/bulkLoadTransactions.js` (637K+ rows for Bloomington alone).

**California (728 cities, 9 counties):** State Controller CAFR format. Standardized GASB reporting categories. Data loaded via `scripts/bulkLoadStateController.js`.

**Total:** ~112 municipalities with budget data, 1.8M+ rows across all tables.

## Key Files

### Frontend
- `src/App.tsx` — main app with entity switcher, year selector, dataset tabs, navigation state, drill-down logic
- `src/data/dataLoader.ts` — API client. Uses `/api` proxy in dev, full `VITE_API_URL/api` in prod. Functions: `loadBudgetData()`, `loadLinkedTransactions()`, `searchBudget()`, `listMunicipalities()`
- `src/types/budget.ts` — TypeScript types including `BudgetCategory` (has `enrichment?: CategoryEnrichment`), `SearchResult`, `Municipality`, `BudgetData`, `LinkedTransactionSummary`
- `src/components/CategoryList.tsx` — category card grid showing enriched plain names, official badges, short descriptions
- `src/components/dashboard/BudgetSearch.tsx` — global search hitting `/api/treasury/search`
- `src/components/dashboard/PlainLanguageSummary.tsx` — narrative summary ("How Bloomington spends your money")
- `src/components/dashboard/SpendingBreakdownBar.tsx` — horizontal stacked bar
- `src/components/dashboard/QuickFactsRow.tsx` — key stats cards
- `src/components/EntitySwitcher.tsx` — municipality dropdown (currently a flat list with scrolling)
- `src/components/YearSelector.tsx` — year buttons (currently a long horizontal row)
- `src/components/BudgetVisualization.tsx` — wraps BudgetIcicle and BudgetSunburst
- `src/components/LinkedTransactionsPanel.tsx` — shows individual transactions when drilling into operating categories
- `src/components/LineItemsTable.tsx` — shows line items (salaries, revenue details)

### Backend
- `backend/src/routes/treasury.ts` — all treasury API routes. Key endpoints:
  - `GET /api/treasury/cities` — list municipalities with available_datasets
  - `GET /api/treasury/cities/:id/budgets?fiscal_year=2025` — budgets for a city/year
  - `GET /api/treasury/budgets/:id/categories` — nested category tree with enrichment
  - `GET /api/treasury/budgets/:id/line-items` — flat line items for a budget
  - `GET /api/treasury/budgets/:id/transactions?link_key=fire&limit=20` — linked transactions
  - `GET /api/treasury/search?q=roads&city_id=uuid&year=2025` — keyword search
- `backend/src/lib/treasuryService.ts` — all DB queries. Key functions:
  - `getBudgetById()` — returns budget with nested category tree, LEFT JOINs enrichment table
  - `getLineItemsByBudgetId()` — flat line items
  - `getLinkedTransactions()` — transactions matching a link_key prefix
  - `searchCategories()` — keyword search across enriched data
  - The `buildTree()` function in `getBudgetById` constructs the nested category hierarchy from flat rows

### Database Schema (treasury.)
- `municipalities` — id, name, state, entity_type, population
- `budgets` — id, municipality_id, fiscal_year, dataset_type, total_budget, hierarchy
- `budget_categories` — id, budget_id, parent_id, name, amount, percentage, depth, sort_order, link_key, color, description
- `budget_line_items` — id, category_id, description, approved_amount, actual_amount, base_pay, benefits, overtime, vendor, date, etc.
- `transactions` — id, budget_id, description, amount, vendor, date, fund, expense_category, payment_method, link_key
- `category_enrichment` — name_key (lowercase), municipality_id (NULL=universal), plain_name, short_description, description, tags[], source, source_url, confidence
- `enrichment_queue` — auto-populated by DB trigger on budget_categories INSERT

### Enrichment System
- 83+ universal enrichments (26 CA CAFR + 30 IN statutory + existing)
- 12 Bloomington-specific official enrichments (bonds with ordinance citations, transit, housing trust)
- 133 AI-enriched entity-specific categories across all IN municipalities
- `scripts/enrichCategories.js` — bulk enrichment with `--all`, format detection, `--skip-universal`, uses claude-haiku-4-5-20251001
- `scripts/processEnrichmentQueue.js` — cron queue processor
- DB trigger `queue_enrichment_trigger` auto-queues new unenriched categories on INSERT

## How Drill-Down Works

The drill-down navigation is managed by `navigationPath` state in `App.tsx` — an array of `BudgetCategory` objects. Each level deeper pushes onto the array. The `buildTree()` function in `treasuryService.ts` constructs the tree from flat `budget_categories` rows using `parent_id` relationships. Categories can have `subcategories` (children) and/or `lineItems` (leaf data). The `link_key` field enables transaction linking — prefix matching so "fire" matches "fire|main|general|supplies".

## How Indiana Gateway Data Is Structured

Indiana Gateway data has a `hierarchy` field on each budget that defines the column names used for categorization. For Bloomington 2025 operating, the hierarchy is typically: `["Fund", "Department", "Account"]` or similar. The CSV loader (`bulkLoadGateway.js`) creates nested categories based on these hierarchy levels. The `depth` column on `budget_categories` indicates which hierarchy level (0 = top/fund, 1 = department, 2 = account, etc.).

## Important: How the Vite Proxy Works

`vite.config.ts` reads `VITE_API_URL` from `.env.local` and proxies `/api` to that target. In production (static site on Render), there's no proxy — `dataLoader.ts` uses the full URL via `import.meta.env.PROD && import.meta.env.VITE_API_URL`. The `VITE_API_URL` env var is set on the Render static site service.

---

## Issues to Fix

### 1. Remove "Where the money goes — at a glance" section
The `SpendingBreakdownBar` component in the dashboard is redundant with the BudgetVisualization (icicle/sunburst) shown below the dataset tabs. Remove the section wrapped in `{budgetData && budgetData.categories.length > 0 && (...)}` around lines 412-422 in `App.tsx`.

### 2. Municipality selector needs filtering/grouping
`EntitySwitcher.tsx` currently renders a flat dropdown of all municipalities. With 112+ entities across 2 states and multiple entity types (city, township, county, special_district, school_district, library, conservancy), scrolling is painful.

Design a better UX:
- Group by state first (Indiana / California)
- Within state, group by entity type (Cities, Townships, Counties, etc.)
- Add a search/filter input at the top of the dropdown
- Show entity count per group
- The `Municipality` type has `entity_type` and `state` fields to support this

### 3. Transaction drill-down broken for operating/revenue
When drilling into operating budget categories (e.g., clicking General → Police → a subcategory), individual transactions should appear via `LinkedTransactionsPanel`. This worked before but appears broken now. Investigate:
- The `link_key` field on categories enables transaction matching
- `loadLinkedTransactions()` in `dataLoader.ts` calls `GET /api/treasury/budgets/:id/transactions?link_key=...`
- The lazy-load effect in `App.tsx` (around line 207) triggers when `navigationPath` changes
- Check if `link_key` is being properly propagated through the category tree
- Salaries work because they use `lineItems` (embedded in the category), not linked transactions

### 4. Only 3 levels of drill-down instead of more
The Indiana Gateway data should support deeper hierarchies (Fund → Department → Account → line items). The `buildTree()` function in `treasuryService.ts` builds the tree from `parent_id` relationships. If only 3 levels are showing, the issue is likely in:
- `bulkLoadGateway.js` — check if it's creating all hierarchy levels or stopping early
- The `hierarchy` field on the budget tells you what columns are available
- Query the DB to check: `SELECT depth, COUNT(*) FROM treasury.budget_categories WHERE budget_id = '...' GROUP BY depth ORDER BY depth`

### 5. Enrichment descriptions bleeding into wrong context
When a subcategory shares a name with a top-level category (e.g., "General" under Bloomington Transit vs "General" as the top-level General Fund), the enrichment JOIN matches on `name_key = LOWER(TRIM(bc.name))` which is just the raw name. The "General" subcategory inside Bloomington Transit gets the General Fund's enrichment.

Fix options:
- Only apply enrichments to top-level categories (depth = 0) in the `getBudgetById` SQL
- Or scope enrichment matching to include budget_id or parent context
- The simplest fix: add `AND bc.depth = 0` to the enrichment JOIN conditions in `treasuryService.ts`

### 6. Enriched names should carry through drill-down navigation
When a user clicks "Bloomington Transit Operating Fund" (the enriched name), the next screen's header shows "SPECIAL TRANSPORTATION GEN" (the raw name). The `navigationPath` stores `BudgetCategory` objects which have `enrichment.plainName` — use that in breadcrumbs and headers when available.

In `App.tsx`, the drill-down header around line 468 uses `navigationPath[navigationPath.length - 1].name` — change to prefer `enrichment?.plainName || name`.

### 7. Year selector takes too much space
The `YearSelector.tsx` component renders all years (2015-2026) as horizontal buttons, taking a full row. Redesign:
- Default to most recent completed year (not current year)
- Show as a compact dropdown or segmented control
- Maybe show only last 3-4 years with a "More" option
- Place it next to the entity switcher, not spanning full width

### 8. Data quality issue: 2024 vs 2025 budget numbers don't make sense
Bloomington 2025: $194M in, $152M out. Bloomington 2024: $409M in, $58M out — these jumps are suspicious.

Investigate:
```sql
SELECT fiscal_year, dataset_type, total_budget, data_source
FROM treasury.budgets
WHERE municipality_id = '592cc4ec-23ad-4f5f-be93-8be4dd9bc557'
ORDER BY fiscal_year DESC, dataset_type;
```
Check if the CSV loader imported different data formats across years, or if some years include capital/enterprise funds that others don't. The Indiana Gateway changes its reporting format periodically.

### Priority Order
1. **#8 Data quality** — investigate first, don't ship wrong numbers
2. **#5 Enrichment bleeding** — quick fix, prevents misleading descriptions
3. **#6 Enriched names in drill-down** — quick fix, improves UX
4. **#3 + #4 Transaction drill-down + depth** — related, investigate together
5. **#1 Remove redundant bar** — trivial
6. **#7 Year selector** — UI improvement
7. **#2 Entity switcher** — UI improvement, more complex
