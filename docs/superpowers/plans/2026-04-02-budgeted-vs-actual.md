# Budgeted vs Actual — Year-Aware Display

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "actual spent" for past fiscal years and "budgeted" for the current year across category cards and the plain language summary — making the distinction clear through language framing, not UI chrome.

**Architecture:** Add `actual_amount` column to `treasury.budget_categories` so it flows through the API alongside `amount` (approved). Frontend uses `selectedYear` vs current calendar year to decide which number to show and which verb ("budgeted" vs "spent") to use in the narrative. Category cards show the appropriate amount; `PlainLanguageSummary` adapts its language.

**Tech Stack:** PostgreSQL migration, TypeScript (ev-accounts backend), React/TypeScript (treasury-tracker frontend)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `ev-accounts/backend/migrations/047_category_actual_amount.sql` | Add `actual_amount` column to `budget_categories` |
| Modify | `ev-accounts/backend/scripts/importBudgetHierarchy.ts:438-453` | Include `actualAmount` in category INSERT |
| Modify | `ev-accounts/backend/src/lib/treasuryService.ts:56-71` | Add `actual_amount` to `TreasuryBudgetCategory` and `CategoryRow` |
| Modify | `ev-accounts/backend/src/lib/treasuryService.ts:365-393` | Add `actualAmount` to `NestedCategory` interface |
| Modify | `ev-accounts/backend/src/lib/treasuryService.ts:415-416` | Add `bc.actual_amount` to SELECT query |
| Modify | `ev-accounts/backend/src/lib/treasuryService.ts:474-544` | Include `actualAmount` in node building and `buildTree` |
| Modify | `treasury-tracker/src/types/budget.ts:74-103` | Add `actualAmount?` to `BudgetCategory` |
| Modify | `treasury-tracker/src/App.tsx:369` | Pass `isPastYear` flag down |
| Modify | `treasury-tracker/src/components/CategoryList.tsx` | Show actual or budgeted amount based on year context |
| Modify | `treasury-tracker/src/components/dashboard/PlainLanguageSummary.tsx` | Adapt "budgeted" vs "spent" language |

---

### Task 1: Database Migration — Add `actual_amount` to `budget_categories`

**Files:**
- Create: `ev-accounts/backend/migrations/047_category_actual_amount.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 047: Add actual_amount to budget_categories for budgeted-vs-actual display
ALTER TABLE treasury.budget_categories
  ADD COLUMN actual_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN treasury.budget_categories.actual_amount
  IS 'Sum of actual_amount from line items — used for past-year "spent" display';
```

- [ ] **Step 2: Apply migration**

Run:
```bash
cd ev-accounts/backend && npx tsx scripts/applyMigrations.ts
```

Expected: Migration 047 applies successfully. Verify with:
```bash
# Check the column exists (via psql or Supabase SQL editor):
# SELECT column_name, data_type FROM information_schema.columns
#   WHERE table_schema = 'treasury' AND table_name = 'budget_categories' AND column_name = 'actual_amount';
```

- [ ] **Step 3: Commit**

```bash
git add ev-accounts/backend/migrations/047_category_actual_amount.sql
git commit -m "feat(treasury): add actual_amount column to budget_categories"
```

---

### Task 2: Import Script — Persist `actualAmount` During Hierarchy Import

**Files:**
- Modify: `ev-accounts/backend/scripts/importBudgetHierarchy.ts:438-453` (category row array)
- Modify: `ev-accounts/backend/scripts/importBudgetHierarchy.ts:472-477` (INSERT statement)

The import script already computes `fc.node.actualAmount` for each category node (lines 180-205). It just doesn't persist it. We need to add it to the INSERT.

- [ ] **Step 1: Add `actualAmount` to the category row array**

In `importBudgetHierarchy.ts`, find the `catRows.push([...])` block around line 438. Add `fc.node.actualAmount` after `fc.linkKey`:

```typescript
        catRows.push([
          catId,
          budgetId,
          parentDbId,
          fc.node.name,
          fc.node.amount,
          fc.percentage,
          fc.color,
          null, // description (filled by enrichment)
          null, // why_matters (filled by enrichment)
          null, // historical_change
          fc.node.lineItems.length, // item_count — line items at THIS level
          fc.sortOrder,
          fc.node.depth,
          fc.linkKey,
          fc.node.actualAmount,
        ]);
```

- [ ] **Step 2: Update the INSERT SQL to include `actual_amount`**

Find the INSERT statement around line 473:

```typescript
        await client.query(
          `INSERT INTO treasury.budget_categories
           (id, budget_id, parent_id, name, amount, percentage, color, description, why_matters, historical_change, item_count, sort_order, depth, link_key, actual_amount)
           VALUES ${values.join(', ')}`,
          params,
        );
```

- [ ] **Step 3: Re-run the import to backfill existing data**

```bash
cd ev-accounts/backend
npx tsx scripts/importBudgetHierarchy.ts --municipality "Los Angeles" --state "CA"
npx tsx scripts/importBudgetHierarchy.ts --municipality "Bloomington" --state "IN"
```

Expected: Successful import with `Total actual:` line in output showing non-zero values (for datasets that have actual data).

- [ ] **Step 4: Commit**

```bash
git add ev-accounts/backend/scripts/importBudgetHierarchy.ts
git commit -m "feat(treasury): persist actual_amount in budget_categories during import"
```

---

### Task 3: Backend API — Return `actualAmount` in Category Tree

**Files:**
- Modify: `ev-accounts/backend/src/lib/treasuryService.ts`

Three changes in this file:

- [ ] **Step 1: Add `actual_amount` to `CategoryRow` interface**

Find `CategoryRow` around line 140. Add after the `amount` field:

```typescript
interface CategoryRow {
  id: string;
  budget_id: string;
  parent_id: string | null;
  name: string;
  amount: string; // numeric
  actual_amount: string | null; // numeric
  percentage: string | null; // numeric
  // ... rest unchanged
```

- [ ] **Step 2: Add `actualAmount` to `NestedCategory` interface**

Find `NestedCategory` around line 365. Add after `amount`:

```typescript
export interface NestedCategory {
  name: string;
  amount: number;
  actualAmount?: number;
  percentage: number;
  // ... rest unchanged
```

- [ ] **Step 3: Add `bc.actual_amount` to the SELECT query in `getBudgetById`**

Find the category SELECT around line 416. Add `bc.actual_amount` to the column list:

```sql
SELECT bc.id, bc.budget_id, bc.parent_id, bc.name, bc.amount, bc.actual_amount, bc.percentage, bc.color,
```

- [ ] **Step 4: Include `actualAmount` in node building**

Find the node construction around line 474-478. Add after `amount: Number(row.amount),`:

```typescript
      amount: Number(row.amount),
      actualAmount: row.actual_amount !== null ? Number(row.actual_amount) : 0,
```

- [ ] **Step 5: Include `actualAmount` in `buildTree` result**

Find the `buildTree` function around line 526-544. Add `actualAmount` to the result object after `amount`:

```typescript
    const result: NestedCategory = {
      name: node.name,
      amount: node.amount,
      actualAmount: node.actualAmount,
      percentage: node.percentage,
      color: node.color,
      items: node.items,
    };
```

- [ ] **Step 6: Verify the API returns `actualAmount`**

Start the dev server and hit the categories endpoint:
```bash
cd ev-accounts/backend && npm run dev
# In another terminal:
# curl http://localhost:3000/api/treasury/budgets/<budget-uuid>/categories | jq '.[0] | {name, amount, actualAmount}'
```

Expected: Each category now includes `actualAmount` alongside `amount`.

- [ ] **Step 7: Commit**

```bash
git add ev-accounts/backend/src/lib/treasuryService.ts
git commit -m "feat(treasury): return actualAmount in category API response"
```

---

### Task 4: Frontend Types — Add `actualAmount` to `BudgetCategory`

**Files:**
- Modify: `treasury-tracker/src/types/budget.ts:74-103`

- [ ] **Step 1: Add `actualAmount` field**

In `budget.ts`, find the `BudgetCategory` interface. Add after `amount`:

```typescript
export interface BudgetCategory {
  name: string;
  amount: number;
  actualAmount?: number;
  percentage: number;
  // ... rest unchanged
```

- [ ] **Step 2: Commit**

```bash
git add treasury-tracker/src/types/budget.ts
git commit -m "feat(treasury): add actualAmount to BudgetCategory type"
```

---

### Task 5: CategoryList — Show Actual or Budgeted Based on Year

**Files:**
- Modify: `treasury-tracker/src/components/CategoryList.tsx`
- Modify: `treasury-tracker/src/App.tsx`

- [ ] **Step 1: Add `isPastYear` prop to CategoryList**

Update the interface and component to accept `isPastYear`:

```typescript
interface CategoryListProps {
  categories: BudgetCategory[];
  onCategoryClick: (category: BudgetCategory) => void;
  isPastYear?: boolean;
}

const CategoryList: React.FC<CategoryListProps> = ({ categories, onCategoryClick, isPastYear = false }) => {
```

- [ ] **Step 2: Use actual amount for past years in the card display**

Find the amount/percentage display around line 133-136. Replace with:

```typescript
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-medium tabular-nums text-[#1C1C1C]">
                    {formatCurrency(isPastYear && category.actualAmount != null ? category.actualAmount : category.amount)}
                  </span>
                  <span className="text-[#D3D7DE]">•</span>
                  <span className="text-xs text-[#6B7280] tabular-nums">{formatPercentage(category.percentage)}%</span>
                </div>
```

- [ ] **Step 3: Compute `isPastYear` in App.tsx and pass it down**

In `App.tsx`, add after the `displayCategories` line (around line 369):

```typescript
  const displayCategories = currentCategories.filter(c => c.amount !== 0);
  const isPastYear = parseInt(selectedYear) < new Date().getFullYear();
```

Then find the `<CategoryList>` usage (around line 573-576) and add the prop:

```tsx
                  <CategoryList
                    categories={displayCategories}
                    onCategoryClick={handleCategoryClick}
                    isPastYear={isPastYear}
                  />
```

- [ ] **Step 4: Also update the zero-filter to consider actualAmount for past years**

Update the filter to also keep categories that have non-zero actual amounts (relevant for past years where budgeted was 0 but actual was not):

```typescript
  const isPastYear = parseInt(selectedYear) < new Date().getFullYear();
  const displayCategories = currentCategories.filter(c =>
    isPastYear ? (c.actualAmount ?? c.amount) !== 0 : c.amount !== 0
  );
```

- [ ] **Step 5: Verify in browser**

Run `npm run dev` in the treasury-tracker. Switch between a past year and the current year. Confirm:
- Past year cards show actual amounts (should differ from budgeted for some categories)
- Current year cards show budgeted amounts
- $0 categories are still filtered out appropriately

- [ ] **Step 6: Commit**

```bash
git add treasury-tracker/src/App.tsx treasury-tracker/src/components/CategoryList.tsx
git commit -m "feat(treasury): show actual spent for past years on category cards"
```

---

### Task 6: PlainLanguageSummary — Adapt "Budgeted" vs "Spent" Language

**Files:**
- Modify: `treasury-tracker/src/components/dashboard/PlainLanguageSummary.tsx`
- Modify: `treasury-tracker/src/App.tsx` (pass `isPastYear` prop)

- [ ] **Step 1: Add `isPastYear` prop to PlainLanguageSummary**

Update the interface:

```typescript
interface PlainLanguageSummaryProps {
  entity: {
    name: string;
    state: string;
    population: number;
  };
  operatingData: BudgetData | null;
  revenueData: BudgetData | null;
  fiscalYear: string;
  isPastYear?: boolean;
  onCategoryClick?: (categoryName: string, dataset: 'operating' | 'revenue') => void;
  onYearClick?: () => void;
}
```

And destructure it in the component:

```typescript
const PlainLanguageSummary: React.FC<PlainLanguageSummaryProps> = ({
  entity,
  operatingData,
  revenueData,
  fiscalYear,
  isPastYear = false,
  onCategoryClick,
  onYearClick,
}) => {
```

- [ ] **Step 2: Change the heading**

Replace the heading text (line 74):

```tsx
            How {entity.name} {isPastYear ? 'spent' : 'plans to spend'} your money
```

- [ ] **Step 3: Change the main narrative paragraph**

The key language changes are in the first `<p>` block (lines 80-102). Replace the entire paragraph content with:

```tsx
          <p>
            In <button
              type="button"
              className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
              onClick={() => onYearClick?.()}
            >
              {fiscalYear}
            </button>, {entity.name}'s {isGeneralFundOnly ? 'General Fund ' : ''}
            {population > 0 ? (
              <>
                {isPastYear
                  ? <>spent <strong className="text-ev-gray-800">{formatAmount(total)}</strong> serving its {population.toLocaleString()} residents</>
                  : isGeneralFundOnly
                    ? <>totaled <strong className="text-ev-gray-800">{formatAmount(total)}</strong> for core city operations serving {population.toLocaleString()} residents.</>
                    : <>budgeted <strong className="text-ev-gray-800">{formatAmount(total)}</strong> to serve its {population.toLocaleString()} residents — that's roughly{' '}
                        <strong className="text-ev-gray-800">{formatPerResident(perResident)} per person</strong>.</>
                }
                {isPastYear && <> — roughly{' '}
                  <strong className="text-ev-gray-800">{formatPerResident(perResident)} per person</strong>.</>
                }
              </>
            ) : (
              <>
                {isPastYear ? 'spent' : 'budgeted'} <strong className="text-ev-gray-800">{formatAmount(total)}</strong> across
                all departments and services.
              </>
            )}
          </p>
```

- [ ] **Step 4: Change the top categories paragraph verb**

Find the top categories section (around line 107). Update the lead-in text:

```tsx
              The biggest {isGeneralFundOnly ? 'department' : 'share'} {isPastYear ? 'was' : 'is'}{' '}
```

- [ ] **Step 5: Change the revenue section verb**

Find the revenue paragraph (around line 143-161). Update:

```tsx
            <p>
              The city {isPastYear ? 'funded' : 'funds'} this through{' '}
              <strong className="text-ev-gray-800">{formatAmount(revenueData.metadata.totalBudget)}</strong>
              {' '}in {isPastYear ? '' : 'expected '}revenue
```

- [ ] **Step 6: Use `actualAmount` total for past years**

When `isPastYear` is true, we want the total to reflect actual spending. The total comes from `operatingData.metadata.totalBudget` which is always the approved total from the `budgets` table.

For past years, compute the actual total from categories instead. Near the top of the component, after `const total = operatingData.metadata.totalBudget;`, add:

```typescript
  const budgetedTotal = operatingData.metadata.totalBudget;
  const actualTotal = (operatingData.categories || []).reduce(
    (sum, c) => sum + (c.actualAmount ?? c.amount), 0
  );
  const total = isPastYear ? actualTotal : budgetedTotal;
```

And remove the original `const total = operatingData.metadata.totalBudget;` line.

- [ ] **Step 7: Pass `isPastYear` from App.tsx**

Find the `<PlainLanguageSummary>` usage in App.tsx (around line 451-458). Add the prop:

```tsx
                <PlainLanguageSummary
                  entity={selectedEntity}
                  operatingData={operatingBudgetData}
                  revenueData={revenueData}
                  fiscalYear={selectedYear}
                  isPastYear={isPastYear}
                  onCategoryClick={handleSummaryCategoryClick}
                  onYearClick={() => yearSelectorRef.current?.open()}
                />
```

Note: `isPastYear` is already computed in Task 5. Just make sure it's defined before the return statement (which it is — it's on the line after `displayCategories`).

- [ ] **Step 8: Verify in browser**

Switch between years and confirm:
- **Current year (2025+):** "How Los Angeles plans to spend your money" / "budgeted $X billion"
- **Past year (2024-):** "How Los Angeles spent your money" / "spent $X billion"
- Top categories: "is" vs "was"
- Revenue: "funds" vs "funded", "expected revenue" vs "revenue"

- [ ] **Step 9: Commit**

```bash
git add treasury-tracker/src/components/dashboard/PlainLanguageSummary.tsx treasury-tracker/src/App.tsx
git commit -m "feat(treasury): adapt summary language for budgeted vs actual by year"
```

---

### Task 7: Update EV-prototypes Version (Parity)

**Files:**
- Modify: `EV-prototypes/treasury-tracker/src/App.tsx`

The EV-prototypes version is simpler (no PlainLanguageSummary), so it only needs the category card changes.

- [ ] **Step 1: Check if EV-prototypes has CategoryList with the same structure**

Read `EV-prototypes/treasury-tracker/src/components/CategoryList.tsx` to confirm it has the same amount display pattern. If it does, apply the same `isPastYear` prop and amount logic from Task 5.

- [ ] **Step 2: Add `isPastYear` computation and prop passing in EV-prototypes App.tsx**

The `displayCategories` line was already updated in the earlier $0 filter fix. Add `isPastYear` and the filter adjustment, then pass it to `<CategoryList>`.

- [ ] **Step 3: Commit**

```bash
git add EV-prototypes/treasury-tracker/
git commit -m "feat(treasury): apply budgeted-vs-actual parity to EV-prototypes version"
```
