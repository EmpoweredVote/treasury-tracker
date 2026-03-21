# Coding Conventions

**Analysis Date:** 2026-03-21

## Naming Patterns

**Files:**
- React components: PascalCase matching the export name (e.g., `BudgetVisualization.tsx`, `LinkedTransactionsPanel.tsx`)
- CSS modules: Same base name as component with `.css` extension (e.g., `BudgetIcicle.css`, `LinkedTransactionsPanel.css`)
- Type definitions: Grouped by domain in `src/types/` (e.g., `budget.ts`)
- Data utilities: camelCase in `src/data/` (e.g., `dataLoader.ts`, `budgetData.ts`)
- Scripts: camelCase describing operation (e.g., `processBudget.js`, `linkBudgetTransactions.js`)

**Functions:**
- Event handlers: `handle` prefix (e.g., `handleCategoryClick`, `handleBack`, `handleBreadcrumbClick`, `handleToggleExpand`)
- Data loaders: `load` prefix (e.g., `loadDataset`, `loadBudgetData`, `loadAllTransactions`)
- Getters/derivers: `get` prefix (e.g., `getDatasetDisplayText`, `getDatasetLabel`, `getNextColor`)
- Formatters: `format` prefix (e.g., `formatCurrency`, `formatDate`, `formatPercentage`, `formatPerResident`)
- Predicates: descriptive boolean names (e.g., `canFitText`, `hasSubcategories`, `isClickable`)

**Variables:**
- camelCase throughout (e.g., `activeDataset`, `navigationPath`, `selectedYear`, `budgetData`)
- Boolean flags: `is`/`has`/`can` prefix (e.g., `isExpanded`, `isLoading`, `hasMore`, `hasLoadedAll`, `canExpand`)
- Constants (module-level): UPPER_SNAKE_CASE (e.g., `TRANSACTIONS_PER_PAGE`, `DATASETS`, `API_BASE`)

**Types:**
- Interfaces: PascalCase prefixed descriptively (e.g., `BudgetCategory`, `LineItem`, `LinkedTransaction`, `BreadcrumbItem`)
- Type unions: PascalCase (e.g., `DatasetType`, `ViewMode`)
- Props interfaces: ComponentName + `Props` suffix (e.g., `BudgetVisualizationProps`, `LinkedTransactionsPanelProps`, `SearchBarProps`)
- Internal component interfaces: Descriptive PascalCase (e.g., `BarSegment`, `BarLevel`, `HierarchyNode`)

## Code Style

**Formatting:**
- No Prettier config detected — formatting is not enforced by tooling
- Semicolons used consistently throughout
- Single quotes for string literals
- 2-space indentation (consistent across all source files)
- Trailing commas used in multi-line arrays and objects

**Linting:**
- ESLint 9.x flat config at `eslint.config.js`
- Rules applied: `eslint:recommended`, `typescript-eslint:recommended`, `react-hooks:recommended`, `react-refresh:vite`
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.app.json`
- Additional TS checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports`

## Import Organization

**Order (observed pattern):**
1. React and React hooks (`import React`, `import { useState, useMemo, ... } from 'react'`)
2. External library imports (`lucide-react`, `d3`, `@chrisandrewsedu/ev-ui`)
3. Internal component imports (relative paths, `./ComponentName`)
4. Type imports (using `import type`, always last among imports)
5. CSS imports (always last: `import './Component.css'`)

**Example from `src/components/LinkedTransactionsPanel.tsx`:**
```typescript
import { useState, useCallback } from 'react';
import { Receipt, Building2, Calendar, CreditCard, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { LinkedTransactionSummary, LinkedTransaction } from '../types/budget';
import './LinkedTransactionsPanel.css';
```

**Type imports:**
- Always use `import type` for type-only imports (enforced by `verbatimModuleSyntax: true` in tsconfig)

**Path Aliases:**
- None configured — all internal imports use relative paths (e.g., `../types/budget`, `./BudgetIcicle`)

## Error Handling

**Async data loading pattern:**
- `try/catch` wrapping `fetch` calls with `console.error` or `console.warn` in the catch block
- Graceful degradation: API failure falls back to static JSON; static JSON failure falls back to mock data (`src/data/dataLoader.ts`)
- In-component loading state with `setLoading(true/false)` before/after async operations
- User-facing error states rendered as JSX blocks (e.g., `"Unable to load data"` div in `src/App.tsx`)
- Error state stored in component state (e.g., `loadError` string in `LinkedTransactionsPanel.tsx`)

**Example pattern:**
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load transaction index');
  }
  // handle success
} catch (error) {
  console.error('Error loading transactions:', error);
  setLoadError('Failed to load additional transactions');
} finally {
  setIsLoading(false);
}
```

**Non-null assertion (`!`):**
- Used sparingly when TypeScript cannot infer non-null but developer is certain (e.g., `cache.get(cacheKey)!`, `currentCategory!.lineItems!`)
- Avoid in new code when a guard or optional chaining can be used instead

## Logging

**Framework:** Native `console` only — no logging library

**Patterns:**
- `console.log` — successful data load milestones in `src/data/dataLoader.ts`
- `console.warn` — non-fatal fallbacks (API unavailable, static JSON unavailable)
- `console.error` — failed operations that affect user experience (data load failures in `src/App.tsx`, transaction load failure in `LinkedTransactionsPanel.tsx`)
- No structured logging or log levels beyond native console methods

## Comments

**When to Comment:**
- JSDoc-style block comments on exported functions in utility/data files (`src/data/dataLoader.ts`)
- Inline comments for non-obvious logic or business rules (e.g., navigation index math in `src/App.tsx`)
- Section dividers using `//` with descriptive labels inside component render blocks (e.g., `// Hero Section`, `// Back button when navigated`)
- `// TODO`-style notes are not present in source — use comments for clarification, not deferred work

**JSDoc/TSDoc:**
- Used on exported async functions in `src/data/dataLoader.ts` (e.g., `loadBudgetData`, `transformAPIResponse`, `clearCache`, `listCities`)
- Not used on React components — props interfaces serve as the documentation contract

## Function Design

**Size:** Components are allowed to be long if they represent a single logical view (e.g., `src/App.tsx` is ~495 lines and manages all top-level state). Helper functions are kept short and single-purpose.

**Parameters:**
- React components always receive a single props object, destructured in the function signature
- Utility functions use positional parameters (e.g., `formatCurrency(amount: number)`)
- Default parameter values used for optional arguments (e.g., `fiscalYear = 2025` in `LinkedTransactionsPanel`)

**Return Values:**
- Formatters return `string`
- Data loaders return `Promise<T>`
- Event handlers return `void`
- Pure derivation functions return the computed value directly

## Module Design

**Exports:**
- Components use `export default` (both function expression and `const` style are used)
- Types use named exports (`export interface`, `export type`)
- Utility functions use named exports from `src/data/dataLoader.ts`
- Constants exported alongside components when useful to consumers (e.g., `export { DATASETS }` from `DatasetTabs.tsx`)

**Barrel Files:**
- Not used — each file is imported directly by path

## Component Patterns

**Component declaration style:**
- Both `React.FC<Props>` with `const` and plain `function` declarations are used
  - `React.FC<Props>`: `BudgetVisualization`, `BudgetIcicle`, `CategoryList`, `SearchBar`, `Breadcrumb`, `YearSelector`, `NavigationTabs`
  - Plain `export default function`: `LinkedTransactionsPanel`, `LineItemsTable`, `DatasetTabs`
- No class components

**State management:**
- All state via React hooks (`useState`, `useMemo`, `useCallback`, `useEffect`, `useRef`)
- State lifted to `App.tsx` for cross-component concerns (navigation path, active dataset, year, search query)
- Local state stays in the component that owns it (e.g., `isExpanded`, `viewMode`, `isOpen`)

**Memoization:**
- `useMemo` for expensive derived data (e.g., `levels` in `BudgetIcicle`, `breadcrumbItems` in `App`, `hierarchyData` in `BudgetSunburst`)
- `useCallback` for event handlers passed as props (e.g., `handleCategoryClick`, `handleBack`, `handleBreadcrumbClick` in `App`)

**Accessibility:**
- ARIA attributes applied consistently: `role`, `aria-label`, `aria-selected`, `aria-expanded`, `aria-current`, `aria-pressed`, `aria-hidden`
- Keyboard navigation handled manually with `onKeyDown` for interactive non-button elements
- Screen-reader-only labels use `className="sr-only"` pattern

**Inline styles vs CSS classes:**
- Dynamic/conditional styles (colors from data, show/hide, transitions) use inline `style` props
- Static layout and structural styles use CSS class names (imported `.css` files)
- CSS custom properties (`var(--white)`, `var(--muted-blue)`, etc.) used for design tokens within inline styles

---

*Convention analysis: 2026-03-21*
