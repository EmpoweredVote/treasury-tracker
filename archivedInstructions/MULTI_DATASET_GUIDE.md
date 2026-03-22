# Treasury Tracker - Multi-Dataset Integration Guide

## Overview

Treasury Tracker now supports **four integrated datasets** to provide comprehensive municipal budget transparency:

1. **💰 Money In (Revenue)** - Where city funds come from
2. **💸 Money Out (Operating Budget)** - How city funds are spent
3. **👥 People (Salaries)** - City workforce & compensation
4. **📋 Transactions** - Individual purchases & payments

## Quick Start

### 1. Process All Datasets

```bash
# Process operating budget (Money Out)
npm run process-budget

# Process revenue data (Money In)
npm run process-revenue

# Process salaries (People) - Coming soon
npm run process-salaries

# Process transactions - Coming soon
npm run process-transactions
```

### 2. Run the App

```bash
npm run dev
```

The app will now have tabs at the top to switch between datasets!

## Configuration

All datasets are configured in `treasuryConfig.json`:

```json
{
  "cityName": "Bloomington",
  "population": 79168,
  "fiscalYears": [2021, 2022, 2023, 2024, 2025],
  "datasets": {
    "revenue": { ... },
    "operating": { ... },
    "salaries": { ... },
    "transactions": { ... }
  }
}
```

Each dataset has:
- **inputFile**: Source CSV path
- **outputFile**: Processed JSON output path  
- **amountColumn**: Which column contains dollar amounts
- **hierarchy**: Drill-down structure (e.g., department → service → fund)
- **colorPalette**: Visual theme colors
- **colorTheme**: Name of color scheme (olive, navy, purple, chestnut)

## New Components

### DatasetTabs
Mobile-first tab navigation for switching between datasets:

```tsx
import DatasetTabs from './components/datasets/DatasetTabs';

<DatasetTabs 
  activeDataset={activeDataset}
  onDatasetChange={setActiveDataset}
/>
```

**Features:**
- 📱 Dropdown on mobile (< 768px)
- 💻 Horizontal tabs on desktop
- 🎨 Color-coded by dataset type
- ♿ Fully accessible (keyboard nav, ARIA labels)

### PerDollarBreakdown
Shows how tax dollars are allocated (like the "dollar bill" visualization):

```tsx
import PerDollarBreakdown from './components/PerDollarBreakdown';

<PerDollarBreakdown 
  categories={categories}
  totalBudget={totalBudget}
  denominationOptions={[1, 10, 100]}
/>
```

**Features:**
- Select $1, $10, or $100 view
- Visual dollar bill representation
- Color-coded segments
- Detailed breakdown list
- Educational context

## Dataset Details

### Revenue (Money In)
**Source:** `data/revenue_budget-all.csv`  
**Hierarchy:** primary_function → item_category → fund  
**Color Theme:** Olive green

Shows where city money comes from:
- Property taxes
- Sales taxes
- State/federal grants
- Service fees
- Utility revenues

**Educational content included:**
- What each revenue type means
- How taxes work
- Grant funding explained

### Operating Budget (Money Out)
**Source:** `data/operating_budget-all.csv`  
**Hierarchy:** primary_function → priority → service → fund → item_category  
**Color Theme:** Navy blue

Shows how city spends money (existing implementation).

### Salaries (People) - Coming Soon
**Source:** `data/checkbook-all.csv`  
**Hierarchy:** department → position_type  
**Color Theme:** Purple

Shows workforce composition and compensation:
- Aggregated by department and position
- Base pay, benefits, overtime breakdown
- Optional: Individual employee view (privacy toggle)

### Transactions - Coming Soon
**Source:** `data/payroll-all.csv`  
**Hierarchy:** Priority → Service → Department  
**Color Theme:** Chestnut brown

Shows individual purchases and payments:
- Searchable and filterable
- Vendor information
- Date, amount, description
- Monthly spending trends

## Mobile Optimization

### Design Principles
1. **Tabs → Dropdown** on mobile
2. **Bar charts** stack vertically with reduced height
3. **Tables → Cards** for better mobile UX
4. **Touch targets** minimum 44x44px
5. **Responsive text** scales appropriately

### Testing Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px  
- Desktop: > 1024px

## Color System

Each dataset has a semantic color theme from your existing palette:

| Dataset | Theme | Primary Color | Usage |
|---------|-------|---------------|-------|
| Revenue | Olive | `#585937` | Money coming in |
| Operating | Navy | `#00657c` | Money going out |
| Salaries | Purple | `#9d3c89` | People-focused |
| Transactions | Chestnut | `#914926` | Granular details |

Colors automatically applied to:
- Tab indicators
- Bar chart segments
- Category markers
- Educational panels

## Performance Considerations

### Lazy Loading
Datasets only load when their tab is selected:

```typescript
const loadDataset = async (type: string, year: number) => {
  const data = await import(`../public/data/${type}-${year}.json`);
  return data.default;
};
```

### File Sizes
- Revenue: ~4-6 KB per year ✅
- Operating: ~5-8 KB per year ✅
- Salaries: ~50 KB per year ⚠️ (optimized)
- Transactions: ~500 KB per year 🔴 (requires pagination)

### Optimization Strategies
- Lazy load transaction data
- Paginate large tables (50 rows/page)
- Virtual scrolling for 1000+ items
- Service worker caching (future)

## Educational Content

Each dataset includes contextual explanations:

### Revenue Example
```typescript
{
  name: "Property Tax",
  whyMatters: "Property taxes are based on the assessed value of 
               homes and businesses in Bloomington. It's the largest 
               revenue source for essential city services.",
  amount: 12500000,
  percentage: 35.2
}
```

### Writing Guidelines
- **Neutral tone** - No political commentary
- **Plain language** - Avoid jargon
- **Educational** - Explain the "why"
- **Conversational** - Like talking to a neighbor

## Cross-Dataset Navigation

Smart links between related datasets:

```tsx
// In Operating Budget at "Personnel Services"
<NavigationHint>
  👥 Want to see who works in this department? 
  <Link to="/salaries/police">View Police Department Staff</Link>
</NavigationHint>

// In Salaries view
<NavigationHint>
  💸 See the full department budget
  <Link to="/operating/police">View Police Budget</Link>
</NavigationHint>
```

## Future Enhancements

### Phase 2 (Post-Launch)
- [ ] Budget vs Actual comparison toggle
- [ ] Year-over-year trend charts
- [ ] Export data as CSV/PDF
- [ ] Share specific visualizations

### Phase 3 (Advanced)
- [ ] Personal tax contribution calculator
- [ ] Regional comparisons (vs similar cities)
- [ ] Forecasting & projections
- [ ] Comment/discussion system

### Phase 4 (Integration)
- [ ] Link with Empowered.Vote badges
- [ ] Connect to elected officials
- [ ] Integration with Empowered Filing

## Accessibility

All components meet **WCAG 2.1 AA** standards:

- ✅ Color contrast ratios ≥ 4.5:1
- ✅ Keyboard navigation
- ✅ ARIA labels and roles
- ✅ Screen reader support
- ✅ Focus indicators
- ✅ Semantic HTML

### Testing Checklist
- [ ] Navigate entire app with keyboard only
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Verify color contrast in DevTools
- [ ] Test on mobile screen reader

## Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Process data
npm run process-budget    # Operating budget
npm run process-revenue   # Revenue data

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

## Data Update Process

When new fiscal year data arrives:

1. **Add CSV files** to `data/` directory
2. **Update treasuryConfig.json** - Add year to `fiscalYears` array
3. **Run processors:**
   ```bash
   npm run process-budget
   npm run process-revenue
   ```
4. **Test** - Select new year in app, verify data displays
5. **Deploy** - Push to production

## Troubleshooting

### Dataset not loading
- Check file path in `treasuryConfig.json`
- Verify CSV file exists in `data/` directory
- Run processor script: `npm run process-[dataset]`
- Check browser console for errors

### Colors not matching
- Verify `colorPalette` in config matches your theme
- Check CSS custom properties in `App.css`
- Use browser DevTools to inspect applied colors

### Mobile layout issues
- Test in browser DevTools responsive mode
- Verify Tailwind breakpoint classes (md:, sm:)
- Check viewport meta tag in index.html

## Contributing

### Adding a New Dataset

1. **Create processor** - `scripts/process[DatasetName].js`
2. **Add config** - New entry in `treasuryConfig.json`
3. **Create view component** - `components/datasets/[DatasetName]View.tsx`
4. **Update types** - Add interfaces to `types/`
5. **Add to tabs** - Update `DatasetTabs.tsx`
6. **Test** - Verify loading, navigation, mobile view

### Code Style
- TypeScript for type safety
- Functional components with hooks
- Tailwind for styling
- ESLint + Prettier for formatting

## Support

Questions? Issues? Suggestions?

- 📧 Email: [your-email]
- 🐛 Issues: GitHub Issues
- 📖 Docs: `/docs` folder
- 💬 Discussions: GitHub Discussions

---

**Treasury Tracker** - Making municipal budgets accessible to everyone 🏛️💰
