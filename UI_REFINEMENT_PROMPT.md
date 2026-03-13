# Treasury Tracker - UI/UX Refinement Prompt

## Context

I'm working on Treasury Tracker, a citizen-facing budget transparency tool for Bloomington, Indiana. The app currently displays four datasets (Revenue, Operating Budget, Salaries, and Transactions) with a drill-down navigation pattern.

**Current Status:** All four datasets are integrated and working technically, but the UI needs refinement to match the existing design system and improve user experience.

## Current Implementation

### Tech Stack
- React + TypeScript + Vite
- Custom CSS (no Tailwind in main app, only in some components)
- Lucide React for icons
- No external charting libraries (custom SVG/CSS)

### Key Files
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/App.tsx` - Main app component
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/App.css` - Main styles
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/components/datasets/DatasetTabs.tsx` - Dataset navigation tabs
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/components/PerDollarBreakdown.tsx` - Tax breakdown viz (to be removed)

### Current UI Structure in App.tsx

```tsx
<div className="app">
  <div className="header">
    <div className="header-content">
      {/* Dataset tabs - Currently here */}
      <DatasetTabs />
      
      {/* City/State/Federal tabs */}
      <NavigationTabs />
      
      {/* Search and Year selector */}
      <SearchBar />
      <YearSelector />
    </div>
  </div>
  
  <div className="main-content">
    {/* Hero and info cards */}
    <div className="hero-and-cards-row">
      <div className="hero-section">
        {/* Background image + title */}
      </div>
      <div className="info-cards">
        {/* Budget total + context */}
      </div>
    </div>
    
    {/* Per dollar breakdown - To be removed */}
    <PerDollarBreakdown />
    
    {/* Main budget visualization */}
    <div className="budget-section">
      <BudgetBar />
      <CategoryList />
    </div>
  </div>
</div>
```

### Current Design System

**Colors:**
- Navy blue (#00657c): Primary color, currently used for operating budget
- Olive green (#585937): Revenue dataset
- Purple (#9d3c89): Salaries dataset  
- Chestnut brown (#914926): Transactions dataset

**Existing UI Patterns:**
- Rounded corners on cards and buttons
- Clean, minimal design
- Manrope font family
- Subtle shadows and borders
- Responsive mobile-first approach

**City/State/Federal Tabs Style:**
Located in header, they have:
- Minimal styling
- Simple text labels
- Clean appearance
- Click interaction

## Issues to Address

### 1. Dataset Tabs Placement
**Current:** Dataset tabs (Money In, Money Out, People, Transactions) are in the header-content section alongside City/State/Federal tabs.

**Desired:** Move dataset tabs to main-content section, either:
- Option A: As a second row within `hero-and-cards-row`
- Option B: Just below `hero-and-cards-row` as its own section

**Why:** The dataset tabs are primary navigation for the content below, not header navigation. They should be visually separated from City/State/Federal tabs.

### 2. Hero Section Adaptability
**Current:** The `hero-section` and `info-cards` both change based on active dataset:
- Hero title: "Bloomington City Budget/Revenue/Payroll/Spending"
- Info card: Shows total for active dataset

**Desired:** 
- **Hero section:** Always show just "Bloomington, Indiana Finances" (static, doesn't change)
- **Info cards:** Show Operating Budget total only (static, doesn't change with tabs)
- **Budget section:** This is where dataset-specific content should display after tab selection

**Why:** The hero should be a consistent anchor. Dataset tabs become the primary way to switch views, and the budget-section below adapts to show the selected data.

### 3. Dataset Tab Visual Design
**Current:** Dataset tabs use Tailwind classes and look distinct from the rest of the app (which uses custom CSS).

**Desired:**
- Visual style similar to City/State/Federal tabs but distinguishable
- Should use the same rounded corner, card-based aesthetic as hero-and-cards-row
- Maintain color coding (green, blue, purple, brown) for each dataset
- Should feel cohesive with existing design system
- Mobile: Can remain as dropdown, but styled consistently

**Reference:** City/State/Federal tabs in NavigationTabs component show the design language to match.

### 4. Breadcrumb Context Awareness
**Current:** Breadcrumb shows: `City → Fire` when drilling into Fire department

**Desired:** Breadcrumb should show: `City → Salaries → Fire` (or whichever dataset is active)

**Why:** Users should always know which dataset context they're in. The breadcrumb should include the dataset name as the second level.

**Pattern:**
- Revenue: `City → Revenue → [category] → [subcategory]`
- Operating: `City → Budget → [category] → [subcategory]`
- Salaries: `City → Salaries → [department] → [position]`
- Transactions: `City → Transactions → [department] → [service]`

### 5. Remove Tax Dollar Breakdown
**Current:** PerDollarBreakdown component is displayed below hero section on Operating Budget view.

**Desired:** Remove this component entirely for now.

**Why:** 
- Not using accurate data yet
- Doesn't look good currently
- Can be added back later when refined

## Design Goals

1. **Visual Coherence:** Dataset tabs should look like they belong with the existing design
2. **Clear Hierarchy:** Header → Hero → Dataset Selection → Content
3. **Contextual Breadcrumbs:** Always show which dataset user is exploring
4. **Consistent Aesthetics:** Rounded corners, card-based layout, subtle shadows
5. **Mobile-First:** All changes should work beautifully on mobile

## Current Dataset Tab Component

The DatasetTabs component (in `/src/components/datasets/DatasetTabs.tsx`) currently:
- Uses Tailwind CSS classes
- Has mobile dropdown and desktop horizontal tabs
- Uses Lucide icons (DollarSign, TrendingDown, Users, Receipt)
- Color-codes each dataset
- Fully functional, just needs visual refinement

## Expected Behavior After Changes

1. User lands on page → sees hero with "Bloomington City Budget"
2. Below hero → sees four dataset tabs (similar style to City/State/Federal)
3. Clicks "People" tab → budget-section updates to show salary data
4. Breadcrumb shows: `City → Salaries`
5. Clicks a department → breadcrumb shows: `City → Salaries → Fire Department`
6. Clicks back → returns to salary overview with breadcrumb: `City → Salaries`

## Files You'll Need to Modify

1. **App.tsx** - Move DatasetTabs placement, update hero logic, remove PerDollarBreakdown, update breadcrumb logic
2. **App.css** - May need new styles for dataset tabs placement
3. **DatasetTabs.tsx** - Restyle to match existing design language
4. **Breadcrumb.tsx** (likely in `/src/components/`) - Add dataset context to breadcrumb items

## Helpful Code References

### Current NavigationTabs Component
Located at: `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/components/NavigationTabs.tsx`

This shows the style we want to match (with distinctions).

### Current CSS Variables (from index.css)
```css
--coral: #ff5740;
--muted-blue: #00657c;
--light-blue: #59b0c4;
--accent-yellow: #fed12e;
--light-gray: #f5f5f5;
--medium-gray: #e0e0e0;
--text-gray: #6b7280;
```

### Hero and Cards Row Structure
Currently uses flexbox layout with rounded corners and shadows. Should inspire dataset tabs design.

## Questions to Consider

1. Should dataset tabs be within hero-and-cards-row or separate?
2. Should we add a subtle visual indicator (like an underline) for active dataset tab?
3. Should dataset icons remain, or switch to text-only like City/State/Federal?
4. Should the info-cards adapt at all, or remain completely static?

## Success Criteria

✅ Dataset tabs visually integrated with existing design
✅ Hero section is static (doesn't change with dataset)
✅ Info cards show operating budget only (static)
✅ Breadcrumbs include dataset context
✅ PerDollarBreakdown component removed
✅ Mobile experience maintains quality
✅ All functionality still works (switching datasets, drill-down, etc.)
✅ Design feels cohesive and intentional

---

**Goal:** Refine the UI/UX to make Treasury Tracker feel like a polished, professional civic tool with consistent design language throughout.
