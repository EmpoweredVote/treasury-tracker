# Milestones

## v1.0 — Initial Release (bootstrapped)

**Status:** Shipped (pre-GSD)
**Completed:** Prior to 2026-03-21

### What shipped

- Interactive budget visualization for Bloomington, Indiana
- Horizontal bar chart with proportional segments and drill-down navigation (up to 5 levels)
- Three dataset tabs: Operating Budget, Revenue, Salaries
- Multi-year data support (2021–2025)
- Linked transactions panel (top vendors, recent transactions for operating budget)
- Search/filter within current level
- Per-resident cost display
- Multiple visualization modes: bar, icicle, sunburst, tree
- Hero section with city image and budget summary cards
- Breadcrumb navigation

### Key decisions made

- Static JSON data files (no backend)
- React 19 + TypeScript + Vite + D3 + Recharts
- Public access, no authentication
- Deploys to Netlify

---
*Milestone log created: 2026-03-21 (GSD initialization)*
