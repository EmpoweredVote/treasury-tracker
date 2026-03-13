# Treasury Tracker - Build Instructions

## Overview

The Treasury Tracker is an interactive data visualization tool designed to help citizens understand and explore how public funds are allocated and spent. This prototype focuses on the municipal budget of Bloomington, Indiana.

## Technology Stack

- **Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.2.4
- **Styling**: CSS with CSS Variables (EV Brand Colors)
- **Font**: Manrope (Google Fonts)
- **Charting**: Recharts 3.5.1 (for potential future visualizations)

## Project Structure

```
treasury-tracker/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable React components
│   │   ├── Breadcrumb.tsx
│   │   ├── BudgetBar.tsx
│   │   ├── CategoryDetail.tsx
│   │   ├── NavigationTabs.tsx
│   │   ├── SearchBar.tsx
│   │   └── YearSelector.tsx
│   ├── data/           # Budget data and types
│   │   └── budgetData.ts
│   ├── App.tsx         # Main application component
│   ├── App.css         # Application styles
│   ├── index.css       # Global styles and CSS variables
│   └── main.tsx        # Application entry point
├── index.html
├── package.json
└── vite.config.ts
```

## Setup Instructions

### Prerequisites

- Node.js >= 20.19.0 or >= 22.12.0
- npm >= 8.0.0

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd treasury-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to the URL shown in the terminal (typically http://localhost:5173)

### Build for Production

```bash
npm run build
```

The production-ready files will be generated in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Key Features

### 1. Interactive Budget Visualization

- **Horizontal Bar Chart**: Visual representation of budget allocation across departments
- **Click to Drill Down**: Click any segment to explore departmental breakdowns
- **Multiple Levels**: Navigate through 3-4 levels of budget hierarchy
- **Color-Coded**: Each department and category has distinct colors for easy identification

### 2. Navigation System

- **Tab Navigation**: Switch between City, State, and Federal budgets (City implemented)
- **Breadcrumb Trail**: Track your navigation path through budget levels
- **Collapsible Sections**: Expand and collapse budget breakdowns

### 3. Search Functionality

- **Real-time Search**: Filter departments and categories as you type
- **Smart Matching**: Searches across names and descriptions

### 4. Year Selection

- **Multi-year Support**: View budgets from different fiscal years
- **Dropdown Selector**: Easy year switching with dropdown menu
- **Data Comparison**: Compare spending across years

### 5. Educational Context

- **Department Summaries**: Learn what each department does
- **Why It Matters**: Understand the importance of budget allocations
- **Detailed Descriptions**: Drill down for comprehensive budget information

## Design System

### Color Palette (EV Brand)

```css
--black: #1c1c1c
--white: #ffffff
--coral: #ff5740
--muted-blue: #00657c
--light-blue: #59b0c4
--accent-yellow: #fed12e
--light-gray: #f5f5f5
--medium-gray: #e0e0e0
--text-gray: #6b7280
```

### Typography

- **Font Family**: Manrope (Variable: 300-800 weights)
- **Heading Sizes**: 2rem (hero), 1.375rem (sections), 1.25rem (subsections)
- **Body Size**: 0.9rem - 1rem
- **Line Height**: 1.5-1.6 for readability

### Component Design Patterns

#### Budget Bar
- Height: 100px on desktop, 80px on mobile
- Rounded corners: 0.625rem
- Hover effect: brightness(1.08) and translateY(-2px)
- Labels shown only for segments >= 8%

#### Category Detail
- Progressive disclosure: Show summary first, then breakdown
- Smooth animations: 0.3s ease transitions
- Consistent spacing: 1.5rem-2rem padding
- Cards with subtle shadows: 0 1px 3px rgba(0, 0, 0, 0.08)

#### Interactive Elements
- Button hover states with color transitions
- Cursor pointer on clickable elements
- Focus states for keyboard navigation
- Disabled state styling for inactive features

## Data Structure

### BudgetCategory Interface

```typescript
interface BudgetCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: BudgetCategory[];
  description?: string;
  whyMatters?: string;
  historicalChange?: number;
}
```

### Budget Data Organization

- **Level 1**: Top-level departments (Police, Fire, Parks, etc.)
- **Level 2**: Major categories within departments (Salaries, Equipment, etc.)
- **Level 3**: Detailed breakdowns (Patrol Officers, Detectives, etc.)
- **Level 4**: Specific allocations (individual line items)

## Responsive Design

### Breakpoints

- **Mobile**: < 768px
  - Single column layouts
  - Stacked navigation
  - Reduced font sizes
  - Full-width components

- **Tablet**: 768px - 1024px
  - Two-column grids where appropriate
  - Adjusted spacing

- **Desktop**: > 1024px
  - Full layout with max-width: 1400px
  - Optimal reading width
  - Multi-column grids

### Mobile Optimizations

- Touch-friendly targets (minimum 44x44px)
- Simplified navigation
- Stacked info cards
- Reduced budget bar height
- Optimized font sizes

## Accessibility Features

### WCAG 2.1 AA Compliance

- **Color Contrast**: 4.5:1 ratio for normal text, 3:1 for large text
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Focus Indicators**: Visible focus states on all interactive elements
- **Alt Text**: Descriptive text for visual elements

### Keyboard Shortcuts

- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close dropdowns and modals
- **Arrow Keys**: Navigate within component groups

## Performance Optimizations

### Code Splitting

- React.lazy() for route-based code splitting
- Dynamic imports for heavy components

### Memoization

- React.memo() for expensive component renders
- useMemo() for computed values
- useCallback() for event handlers

### Data Management

- Efficient state updates
- Minimal re-renders
- Optimized budget calculations

## Testing Recommendations

### Manual Testing Checklist

- [ ] All navigation tabs function correctly
- [ ] Search filters departments properly
- [ ] Year selector changes data
- [ ] Budget bars are clickable at all levels
- [ ] Breadcrumb navigation works
- [ ] Mobile responsive design
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

### User Scenarios

1. **First-time Visitor**: Can they understand the interface quickly?
2. **Budget Explorer**: Can they drill down to find specific information?
3. **Comparison User**: Can they compare different years easily?
4. **Mobile User**: Is the experience smooth on mobile devices?

## Future Enhancements

### Planned Features

1. **State and Federal Budgets**: Extend beyond city level
2. **Historical Trends**: Multi-year comparison visualizations
3. **Tax Calculator**: "Follow My Tax Dollars" feature
4. **Data Export**: Download budget data as CSV/PDF
5. **Sharing**: Social media sharing of visualizations
6. **Annotations**: Community notes and context
7. **Live Data Integration**: Connect to municipal data APIs
8. **Multi-language Support**: Internationalization

### Scalability Considerations

- **Database Integration**: Move from static data to database
- **API Layer**: RESTful API for data access
- **Authentication**: User accounts for advanced features
- **Caching**: Redis or similar for performance
- **CDN**: Static asset delivery optimization

## Troubleshooting

### Common Issues

**Issue**: Vite dev server won't start
**Solution**: Check Node.js version (requires 20.19.0+ or 22.12.0+)

**Issue**: Fonts not loading
**Solution**: Check internet connection for Google Fonts CDN

**Issue**: Budget bar segments not responding to clicks
**Solution**: Check z-index and pointer-events in CSS

**Issue**: Year dropdown stays open
**Solution**: Verify click outside handler implementation

## Contributing Guidelines

### Code Style

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Keep components under 200 lines
- Extract reusable logic into hooks
- Comment complex logic

### CSS Guidelines

- Use CSS variables for colors
- Follow BEM-like naming conventions
- Mobile-first responsive design
- Minimize use of !important
- Use flexbox and grid for layouts

### Git Workflow

- Feature branches from main
- Descriptive commit messages
- Pull request reviews required
- Squash commits on merge

## Documentation

### Component Documentation

Each component should include:
- Purpose and usage
- Props interface with descriptions
- Example usage
- Accessibility considerations

### Code Comments

- Explain "why" not "what"
- Document complex algorithms
- Note browser-specific workarounds
- Reference design decisions

## License and Attribution

This project is part of the Empowered.Vote civic engagement platform.

**Data Source**: City of Bloomington, Indiana public budget documents
**Design**: Empowered.Vote brand guidelines
**Development**: Treasury Tracker team

## Contact and Support

For questions, issues, or contributions to the Treasury Tracker:
- Visit the Empowered.Vote website
- Submit issues through the project repository
- Contact the development team

## Release Notes

### Version 1.0.0 (Current)

- Initial release
- City of Bloomington budget data (2025)
- Interactive budget visualization
- Multi-level drill-down
- Search functionality
- Year selection
- Responsive design
- Accessibility features

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: Production Ready
