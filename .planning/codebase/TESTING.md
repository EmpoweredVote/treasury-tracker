# Testing Patterns

**Analysis Date:** 2026-03-21

## Test Framework

**Runner:**
- None installed — no test framework is present in `package.json` dependencies or devDependencies
- No `jest.config.*`, `vitest.config.*`, or equivalent config file exists in the project

**Assertion Library:**
- None

**Run Commands:**
```bash
# No test commands exist in package.json scripts
# Current scripts are: dev, build, lint, preview, process-budget,
# process-revenue, process-salaries, process-transactions, process-all
```

## Test File Organization

**Location:**
- No test files exist in the project (search for `*.test.*` and `*.spec.*` returns zero results)

**Naming:**
- No convention established

**Structure:**
- Not applicable

## Test Structure

**Suite Organization:**
- Not applicable — no tests exist

**Patterns:**
- Not applicable

## Mocking

**Framework:** Not applicable

**Patterns:**
- Not applicable

**What to Mock (recommended when tests are added):**
- `fetch` calls to `./data/*.json` static files
- `fetch` calls to the external API (`VITE_API_URL`)
- `import.meta.env.BASE_URL` and `import.meta.env.VITE_API_URL`
- D3 layout calculations in `BudgetSunburst.tsx` (uses `useRef` and `useEffect` for DOM manipulation)

**What NOT to Mock (recommended):**
- Pure formatter functions (`formatCurrency`, `formatDate`, `formatPercentage`) — test these directly
- Pure data transformation logic in `scripts/processBudget.js`, `scripts/processRevenue.js`, etc.
- Type guard logic and data shape derivation

## Fixtures and Factories

**Test Data:**
- Mock budget data exists at `src/data/budgetData.ts` — this is the app's own fallback data, not test fixtures, but it can serve as ready-made fixture data for unit tests
- Static JSON files in `public/data/` (e.g., `budget-2025.json`, `revenue-2025.json`, `salaries-2025.json`) serve as realistic data samples

**Location:**
- No dedicated fixtures directory exists — would need to be created (e.g., `src/__tests__/fixtures/`)

## Coverage

**Requirements:** None enforced — no coverage tooling configured

**View Coverage:**
```bash
# Not configured — would require adding vitest or jest with coverage reporter
```

## Test Types

**Unit Tests:**
- Not present. High-value targets for future unit tests:
  - `src/data/dataLoader.ts` — `loadBudgetData`, `transformAPIResponse`, `clearCache`, `listCities`
  - `scripts/processBudget.js` — `parseCSV`, `parseCSVLine`, `filterByYear` (pure functions, no DOM)
  - Formatter functions duplicated across components (`formatCurrency` appears independently in `BudgetIcicle.tsx`, `LinkedTransactionsPanel.tsx`, `CategoryList.tsx`, `DatasetTabs.tsx`, `LineItemsTable.tsx`)
  - `calculateVariance` in `src/components/LineItemsTable.tsx`
  - `getCategoryIcon` partial-match logic in `src/components/CategoryList.tsx`

**Integration Tests:**
- Not present. High-value targets:
  - Dataset loading flow: year/dataset change → fetch → state update → render
  - Navigation path flow: category click → drill-down → back button → breadcrumb
  - Transaction lazy load: expand panel → fetch index file → display full list

**E2E Tests:**
- Not present. No Playwright, Cypress, or equivalent installed

## Recommended Setup (when tests are added)

**Suggested stack:**
- **Vitest** — aligns with Vite build tooling already in use; zero extra config for module resolution
- **@testing-library/react** — for component rendering and user interaction
- **@testing-library/user-event** — for realistic event simulation
- **jsdom** — Vitest environment for DOM APIs

**Suggested `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
```

**Suggested directory layout:**
```
src/
  __tests__/
    setup.ts                   # global test setup (e.g., fetch mock)
    fixtures/
      budget.ts                # reusable BudgetData shapes
    unit/
      formatters.test.ts       # pure formatting functions
      dataLoader.test.ts       # loadBudgetData with fetch mock
      calculateVariance.test.ts
    components/
      CategoryList.test.tsx
      LinkedTransactionsPanel.test.tsx
      BudgetIcicle.test.tsx
```

## Common Patterns (recommended)

**Async fetch testing:**
```typescript
// Mock fetch before tests
global.fetch = vi.fn();

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => mockBudgetData,
  } as Response);
});
```

**Error state testing:**
```typescript
vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
// assert that error UI renders
```

**Navigation path testing:**
```typescript
// Click a category, assert navigationPath updated, assert breadcrumb renders
const user = userEvent.setup();
await user.click(screen.getByText('Public Safety'));
expect(screen.getByText('City › Budget › Public Safety')).toBeInTheDocument();
```

---

*Testing analysis: 2026-03-21*
