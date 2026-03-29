# Dashboard Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the treasury dashboard with clickable category links in the summary, compact dataset selector cards, subcategory enrichment, cleaner source attribution, and color corrections.

**Architecture:** Six independent improvements to the dashboard: (1) make category names in PlainLanguageSummary clickable to drill into the chart, (2) make the fiscal year bold+clickable to open the YearSelector, (3) replace DatasetTabs+QuickFactsRow with compact side-by-side dataset selector cards, (4) show category descriptions when drilled in + add short descriptions to the context card, (5) move OFFICIAL attribution from cards to a section-level sentence, (6) fix selection indicator bar color from coral to yellow. Plus a backend task to extend the enrichment pipeline to subcategories.

**Tech Stack:** React, TypeScript, Tailwind CSS, D3, Claude API (for enrichment), Supabase PostgreSQL

---

## File Structure

### New files
- None (all modifications to existing files)

### Modified files
- `src/components/dashboard/PlainLanguageSummary.tsx` — Add clickable category names, bold+clickable year, short enrichment descriptions in context
- `src/App.tsx` — Wire up category click from summary to chart navigation + auto-scroll, remove QuickFactsRow, replace DatasetTabs with DatasetCards, pass enrichment descriptions, show category description when drilled in
- `src/components/datasets/DatasetTabs.tsx` — Rename/refactor to `DatasetCards.tsx` with compact side-by-side layout
- `src/components/CategoryList.tsx` — Remove OFFICIAL badge, add attribution sentence above cards
- `src/components/BudgetIcicle.css` — Change selection indicator from coral to yellow
- `src/components/BudgetSunburst.tsx` — Change selection stroke from coral to yellow
- `scripts/enrichCategories.js` — Extend to support subcategory enrichment (depth > 0)
- `ev-accounts/backend/src/lib/treasuryService.ts` — Remove `AND bc.depth = 0` constraint on enrichment joins

---

### Task 1: Fix selection indicator color (coral → yellow)

**Files:**
- Modify: `src/components/BudgetIcicle.css:73-80`
- Modify: `src/components/BudgetSunburst.tsx` (stroke color on selected path)

- [ ] **Step 1: Update icicle selection indicator color**

In `src/components/BudgetIcicle.css`, change the `.selection-indicator` background from coral to ev-yellow:

```css
.selection-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background-color: var(--color-ev-yellow-500);
}
```

- [ ] **Step 2: Update sunburst selection stroke color**

In `src/components/BudgetSunburst.tsx`, find the stroke color `#FF5740` (coral) used on selected/active arcs and replace with `var(--color-ev-yellow-500)` (`#FED12E`). The stroke is applied via D3's `.attr('stroke', ...)` — change all instances of `#FF5740` to `#FED12E`.

- [ ] **Step 3: Visually verify both chart types**

Run: `npm run dev`
Switch between Icicle and Sunburst views, click on a category. The selection bar/stroke should now be yellow (`#FED12E`), not coral.

- [ ] **Step 4: Commit**

```bash
git add src/components/BudgetIcicle.css src/components/BudgetSunburst.tsx
git commit -m "fix(ui): change selection indicator from coral to ev-yellow"
```

---

### Task 2: Make category names clickable in PlainLanguageSummary

**Files:**
- Modify: `src/components/dashboard/PlainLanguageSummary.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add onCategoryClick prop to PlainLanguageSummary**

In `src/components/dashboard/PlainLanguageSummary.tsx`, add a new prop to the interface:

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
  onCategoryClick?: (categoryName: string, dataset: 'operating' | 'revenue') => void;
}
```

Destructure it in the component: `onCategoryClick` from props.

- [ ] **Step 2: Wrap category names in clickable spans**

Replace the `<strong>` elements wrapping category names (lines 98-110) with clickable buttons styled as inline text. For example, for the first top category (operating):

```tsx
<button
  type="button"
  className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
  onClick={() => onCategoryClick?.(topCategories[0]?.name, 'operating')}
>
  {toDisplayName(topCategories[0]?.name)}
</button>
```

Do the same for `topCategories[1]` and `topCategories[2]`.

For the revenue category mention (line 122-124), use `'revenue'` as the dataset parameter:

```tsx
<button
  type="button"
  className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
  onClick={() => onCategoryClick?.(revenueData!.categories[0].name, 'revenue')}
>
  {toDisplayName(revenueData!.categories[0].name)}
</button>
```

- [ ] **Step 3: Wire up the callback in App.tsx**

In `src/App.tsx`, add a `ref` on the chart section for auto-scrolling:

```typescript
const chartSectionRef = useRef<HTMLDivElement>(null);
```

Add the handler function (near the existing `handleCategoryClick`):

```typescript
const handleSummaryCategoryClick = (categoryName: string, dataset: 'operating' | 'revenue') => {
  // Switch dataset if needed
  if (dataset !== activeDataset) {
    setActiveDataset(dataset);
  }

  // Find the category in the appropriate data
  const data = dataset === 'operating' ? operatingBudgetData : revenueData;
  if (!data) return;

  // Handle single-fund drill: if only 1 top-level category, look in its subcategories
  const topLevel = data.categories || [];
  const isGeneralFundOnly = topLevel.length === 1;
  const searchLevel = isGeneralFundOnly ? (topLevel[0]?.subcategories || []) : topLevel;

  const category = searchLevel.find(c => c.name === categoryName);
  if (!category) return;

  // Build navigation path (same as clicking the chart)
  if (isGeneralFundOnly) {
    setNavigationPath([topLevel[0], category]);
  } else {
    setNavigationPath([category]);
  }

  // Auto-scroll chart into view
  setTimeout(() => {
    chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};
```

Pass the handler to PlainLanguageSummary:

```tsx
<PlainLanguageSummary
  entity={selectedEntity}
  operatingData={operatingBudgetData}
  revenueData={revenueData}
  fiscalYear={selectedYear}
  onCategoryClick={handleSummaryCategoryClick}
/>
```

Add `ref={chartSectionRef}` to the Budget Visualization section `<div>`.

- [ ] **Step 4: Verify clicking a category in the summary drills into the chart**

Run: `npm run dev`
Click on a category name in the summary text. Verify:
1. The chart updates to show that category's subcategories
2. The page auto-scrolls to the chart section
3. If you click a revenue category, the dataset switches to revenue first

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/PlainLanguageSummary.tsx src/App.tsx
git commit -m "feat(summary): clickable category names drill into chart with auto-scroll"
```

---

### Task 3: Bold + clickable fiscal year in summary

**Files:**
- Modify: `src/components/dashboard/PlainLanguageSummary.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/YearSelector.tsx`

- [ ] **Step 1: Add onYearClick prop to PlainLanguageSummary**

Add to the props interface:

```typescript
onYearClick?: () => void;
```

- [ ] **Step 2: Make the year text bold and clickable**

In PlainLanguageSummary, replace the inline `{fiscalYear}` text (line 76) with a clickable element:

```tsx
<button
  type="button"
  className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
  onClick={() => onYearClick?.()}
>
  {fiscalYear}
</button>
```

- [ ] **Step 3: Add imperative open method to YearSelector**

In `src/components/YearSelector.tsx`, use `forwardRef` and `useImperativeHandle` to expose an `open()` method:

```typescript
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface YearSelectorHandle {
  open: () => void;
}

const YearSelector = forwardRef<YearSelectorHandle, YearSelectorProps>(
  ({ selectedYear, years, onYearChange }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsOpen(true);
        buttonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    }));

    // ... rest of component, attach buttonRef to the trigger button
  }
);
```

- [ ] **Step 4: Wire up in App.tsx**

Create a ref for the YearSelector and pass it to both the YearSelector and PlainLanguageSummary:

```typescript
const yearSelectorRef = useRef<YearSelectorHandle>(null);
```

```tsx
<YearSelector ref={yearSelectorRef} ... />
```

```tsx
<PlainLanguageSummary
  ...
  onYearClick={() => yearSelectorRef.current?.open()}
/>
```

- [ ] **Step 5: Verify clicking the year opens the selector**

Run: `npm run dev`
Click on the year in the summary text. The YearSelector dropdown should open and scroll into view.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/PlainLanguageSummary.tsx src/components/YearSelector.tsx src/App.tsx
git commit -m "feat(summary): clickable year opens fiscal year selector"
```

---

### Task 4: Replace DatasetTabs + QuickFactsRow with compact dataset selector cards

**Files:**
- Modify: `src/components/datasets/DatasetTabs.tsx` (refactor into compact cards)
- Modify: `src/App.tsx` (remove QuickFactsRow import/usage, wire new layout)

- [ ] **Step 1: Redesign DatasetTabs as compact side-by-side cards**

Rewrite `src/components/datasets/DatasetTabs.tsx` to render two side-by-side cards (drop salaries). The active card gets a highlighted border and background. Each card shows:
- Icon (DollarSign for revenue, TrendingDown for operating)
- Label ("Money In" / "Money Out")
- Total amount (large, bold)
- Brief description ("Where funds come from" / "How funds are spent")

Layout: `flex gap-4` with each card being `flex-1`. Active card: `border-2 border-ev-muted-blue bg-white shadow-sm`. Inactive: `border border-ev-gray-200 bg-ev-gray-50 opacity-80 hover:opacity-100`.

```tsx
export default function DatasetCards({ activeDataset, onDatasetChange, revenueTotal, operatingTotal, availableDatasets }: DatasetTabsProps) {
  const available = availableDatasets ?? ['operating', 'revenue'];

  const cards = [
    {
      id: 'operating' as const,
      label: 'Money Out',
      icon: TrendingDown,
      description: 'How funds are spent',
      total: operatingTotal,
    },
    {
      id: 'revenue' as const,
      label: 'Money In',
      icon: DollarSign,
      description: 'Where funds come from',
      total: revenueTotal,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(({ id, label, icon: Icon, description, total }) => {
        const isActive = id === activeDataset;
        const isDisabled = !available.includes(id);

        return (
          <button
            key={id}
            onClick={() => !isDisabled && onDatasetChange(id)}
            disabled={isDisabled}
            className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer font-manrope
              ${isActive
                ? 'border-ev-muted-blue bg-white shadow-sm'
                : 'border-ev-gray-200 bg-ev-gray-50 hover:bg-white hover:border-ev-gray-300'
              }
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className={isActive ? 'text-ev-muted-blue' : 'text-ev-gray-400'} />
              <span className={`text-sm font-semibold ${isActive ? 'text-ev-muted-blue' : 'text-ev-gray-500'}`}>
                {label}
              </span>
            </div>
            {total != null && (
              <div className={`text-2xl font-bold ${isActive ? 'text-ev-gray-900' : 'text-ev-gray-600'}`}>
                {formatCurrency(total)}
              </div>
            )}
            <div className="text-xs text-ev-gray-400 mt-1">{description}</div>
          </button>
        );
      })}
    </div>
  );
}
```

Keep the mobile responsive design — on mobile, stack vertically with `grid-cols-1 sm:grid-cols-2`.

- [ ] **Step 2: Remove QuickFactsRow from App.tsx**

In `src/App.tsx`:
- Remove the `QuickFactsRow` import
- Remove the `<QuickFactsRow>` JSX usage (the "Spending Areas" and "Cost per Resident" cards)
- This drops the spending areas count and per-resident cost (already in the summary text)

- [ ] **Step 3: Replace DatasetTabs usage with new DatasetCards**

Update the import in App.tsx from `DatasetTabs` to the refactored component (same file, new design). Place it between the PlainLanguageSummary and the chart section. The layout should be:

```
PlainLanguageSummary
DatasetCards (side by side: Money Out | Money In)
Chart Section
```

- [ ] **Step 4: Verify the new layout**

Run: `npm run dev`
Verify:
1. No more QuickFactsRow (spending areas, cost per resident gone)
2. Two compact cards side by side below the summary
3. Clicking a card switches the dataset and the chart updates
4. Active card is highlighted, inactive is muted
5. On mobile, cards stack vertically

- [ ] **Step 5: Commit**

```bash
git add src/components/datasets/DatasetTabs.tsx src/App.tsx
git commit -m "feat(dashboard): replace DatasetTabs+QuickFactsRow with compact dataset selector cards"
```

---

### Task 5: Show category descriptions when drilled in + short descriptions in context card

**Files:**
- Modify: `src/App.tsx` (show description paragraph when viewing a drilled-in category)
- Modify: `src/components/dashboard/PlainLanguageSummary.tsx` (include short descriptions for mentioned categories)

- [ ] **Step 1: Show description when drilled into a category**

In `src/App.tsx`, in the Budget Visualization section, when `navigationPath.length > 0`, show the currently selected category's `enrichment?.description` (long form) as a paragraph below the category heading:

```tsx
{navigationPath.length > 0 && (() => {
  const currentCategory = navigationPath[navigationPath.length - 1];
  const description = currentCategory.enrichment?.description;
  return description ? (
    <p className="text-sm text-ev-gray-500 mt-2 max-w-2xl leading-relaxed">
      {description}
    </p>
  ) : null;
})()}
```

Place this right after the existing category title/heading in the visualization section.

- [ ] **Step 2: Add short enrichment descriptions to context card**

In `PlainLanguageSummary.tsx`, after each category name mention, optionally append the `shortDescription` from enrichment. The categories already have enrichment data attached. Pass the full `BudgetCategory` objects instead of just names:

Update the top categories selection to preserve enrichment:

```tsx
// Already have topCategories as BudgetCategory[]
// After each category button, add a brief description if available:
<button ...>{toDisplayName(topCategories[0]?.name)}</button>
{topCategories[0]?.enrichment?.shortDescription && (
  <span className="text-ev-gray-400"> — {topCategories[0].enrichment.shortDescription.toLowerCase()}</span>
)}
```

This gives context like: "**Electric Enterprise Fund** — a city-owned electric utility that generates or distributes electricity (34.3%)"

- [ ] **Step 3: Verify descriptions appear**

Run: `npm run dev`
1. At the top level, the summary should show brief descriptions after category names
2. Click into a category — the long description should appear below the title
3. Categories without enrichment should display gracefully (no description, no errors)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/dashboard/PlainLanguageSummary.tsx
git commit -m "feat(descriptions): show category descriptions in summary and drill-in view"
```

---

### Task 6: Move source attribution from card badges to section-level sentence

**Files:**
- Modify: `src/components/CategoryList.tsx` (remove OFFICIAL badge, add attribution sentence)
- Modify: `src/App.tsx` (pass source info to chart section for attribution)

- [ ] **Step 1: Remove the OFFICIAL badge from CategoryList cards**

In `src/components/CategoryList.tsx`, remove the `<span>` that renders the OFFICIAL badge (lines ~139-144). This is the element with `bg-ev-yellow-100 text-ev-yellow-700` and the link icon.

- [ ] **Step 2: Add attribution sentence above the category cards**

In the visualization section of `src/App.tsx` (or at the top of the CategoryList area), add a small attribution note. Derive the source info from the categories' enrichment data:

```tsx
{/* Attribution for descriptions */}
{(() => {
  const cats = displayCategories || [];
  const officialCats = cats.filter(c => c.enrichment?.source === 'official');
  const aiCats = cats.filter(c => c.enrichment?.source === 'ai' || c.enrichment?.source === 'hybrid');
  const sourceUrl = officialCats[0]?.enrichment?.sourceUrl;
  const sourceLabel = officialCats[0]?.enrichment?.sourceLabel || 'official budget documents';

  if (officialCats.length === 0 && aiCats.length === 0) return null;

  return (
    <p className="text-xs text-ev-gray-400 mb-3">
      {officialCats.length > 0 && (
        <>
          Top-level descriptions from{' '}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ev-muted-blue">
              {sourceLabel}
            </a>
          ) : (
            sourceLabel
          )}
          .{' '}
        </>
      )}
      {aiCats.length > 0 && (
        <>Subcategory descriptions are summarized from budget line items.</>
      )}
    </p>
  );
})()}
```

- [ ] **Step 3: Verify attribution displays correctly**

Run: `npm run dev`
1. OFFICIAL badges should be gone from category cards
2. A small attribution sentence should appear above the category list
3. If source URL exists, it should be a clickable link

- [ ] **Step 4: Commit**

```bash
git add src/components/CategoryList.tsx src/App.tsx
git commit -m "feat(attribution): replace OFFICIAL badges with section-level source attribution"
```

---

### Task 7: Extend enrichment pipeline to subcategories

**Files:**
- Modify: `scripts/enrichCategories.js` (add subcategory enrichment mode)
- Modify: `ev-accounts/backend/src/lib/treasuryService.ts` (remove depth=0 constraint)

- [ ] **Step 1: Update the backend query to include subcategory enrichments**

In `ev-accounts/backend/src/lib/treasuryService.ts`, find the two LEFT JOIN clauses for `category_enrichment` that have `AND bc.depth = 0`. Remove the `AND bc.depth = 0` constraint from both joins so enrichments at any depth are returned:

```sql
-- Before:
LEFT JOIN treasury.category_enrichment e_city
  ON e_city.name_key = LOWER(TRIM(bc.name))
 AND e_city.municipality_id = b.municipality_id
 AND bc.depth = 0

-- After:
LEFT JOIN treasury.category_enrichment e_city
  ON e_city.name_key = LOWER(TRIM(bc.name))
 AND e_city.municipality_id = b.municipality_id
```

Do the same for `e_univ` join.

- [ ] **Step 2: Add subcategory enrichment to enrichCategories.js**

In `scripts/enrichCategories.js`, add a `--depth` CLI flag (default `0` for backward compatibility). When `--depth all` or `--depth 1` is passed:

1. Query `budget_categories` at the specified depth(s)
2. For subcategories, include the parent category name in the Claude prompt context for better descriptions
3. Use the same enrichment logic but adjust the prompt to reflect that these are subcategories

Add to the category query:

```sql
SELECT DISTINCT bc.name, bc.depth, parent.name as parent_name,
       SUM(bc.approved_amount) as total_amount
FROM treasury.budget_categories bc
LEFT JOIN treasury.budget_categories parent
  ON parent.id = bc.parent_id
WHERE bc.budget_id = $1
  AND bc.depth = $2
GROUP BY bc.name, bc.depth, parent.name
```

Adjust the Claude prompt for subcategories to include parent context:

```
This is a subcategory under "${parentName}" in a ${entityType}'s budget.
Category name: "${categoryName}"
Top line items: ${lineItemContext}
```

- [ ] **Step 3: Add a name_key collision guard**

Subcategory names may collide across parents (e.g., "Administration" under both "Public Safety" and "Public Works"). Update the enrichment table's unique constraint to also include `parent_name` or use a composite key. Alternatively, prefix the `name_key` with parent context: `"public_safety|administration"`.

The simpler approach: add `parent_key` column to `category_enrichment` and update the unique constraint:

```sql
ALTER TABLE treasury.category_enrichment
  ADD COLUMN IF NOT EXISTS parent_key TEXT;

-- Update unique constraint
ALTER TABLE treasury.category_enrichment
  DROP CONSTRAINT IF EXISTS category_enrichment_name_key_municipality_id_key;

ALTER TABLE treasury.category_enrichment
  ADD CONSTRAINT category_enrichment_unique
  UNIQUE (name_key, parent_key, municipality_id);
```

Update the backend JOIN to match on parent_key as well.

- [ ] **Step 4: Run subcategory enrichment for test municipality**

```bash
node scripts/enrichCategories.js --municipality "Bloomington" --state "IN" --depth 1
```

Verify enrichment records are created for depth-1 subcategories.

- [ ] **Step 5: Verify subcategory descriptions appear in the UI**

Run the dev server, navigate to Bloomington, drill into a category. Subcategory cards should now show descriptions if enrichment was generated.

- [ ] **Step 6: Commit both repos**

```bash
# treasury-tracker
git add scripts/enrichCategories.js
git commit -m "feat(enrichment): extend enrichment pipeline to subcategories"

# ev-accounts
cd ../ev-accounts
git add backend/src/lib/treasuryService.ts
git commit -m "feat(treasury): serve enrichment data at all category depths"
```

---

### Task 8: Type-check and final verification

- [ ] **Step 1: Run type checker**

```bash
npx tsc -b
```

Fix any type errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Ensure production build succeeds with no errors.

- [ ] **Step 3: Visual smoke test**

Run `npm run dev` and verify all changes together:
1. Selection indicator is yellow (not coral) on both icicle and sunburst
2. Category names in summary are clickable and drill into chart with auto-scroll
3. Year is bold and clickable, opens the year selector
4. Two compact dataset cards (Money Out / Money In) replace the old tabs and QuickFacts
5. Category descriptions appear when drilled in
6. Short descriptions appear in the summary text
7. OFFICIAL badges are gone, replaced by attribution sentence
8. No regressions on mobile

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: type errors and polish from dashboard refinements"
```
