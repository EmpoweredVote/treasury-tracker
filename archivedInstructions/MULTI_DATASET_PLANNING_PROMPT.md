# Treasury Tracker - Multi-Dataset Integration Planning

## Context

I'm building a citizen-facing budget transparency tool called **Treasury Tracker** for Bloomington, Indiana. The goal is to help average citizens understand where their tax dollars come from and how they're spent.

### Current Implementation

**What's working now:**
- Interactive horizontal bar chart showing budget categories
- Drill-down navigation through budget hierarchy
- Currently displays **operating budget data only** (expenses/spending)
- Clean, user-friendly interface with breadcrumb navigation
- Categories show name, amount, and percentage on bar chart
- Professional data visualization color scheme

**Tech Stack:**
- React + TypeScript
- Vite for build
- Custom CSV processing scripts
- No external charting dependencies (custom SVG/CSS)

### Available Data Sources

I have four CSV files with municipal financial data:

#### 1. **Operating Budget** (✅ Currently Integrated)
- Budgeted vs actual spending by department/category
- Hierarchy: primary_function → priority → service → fund → item_category
- Shows: approved_amount, actual_amount, recommended_amount
- Example categories: Public Safety, Utilities, Culture & Recreation

#### 2. **Revenue Budget** (📋 Ready to Integrate)
- Where money comes from (taxes, fees, grants, etc.)
- Hierarchy: primary_function → priority → service → fund → item_category  
- Shows: approved_amount, actual_amount, recommended_amount
- Example sources: Property Tax, Sales Tax, Utility Fees, Grants

#### 3. **Salaries** (📋 Ready to Integrate)
- Employee compensation by department
- Shows: employee names, positions, departments, pay breakdown
- Fields: total_pay, base_pay, benefits, overtime, other
- Contains service start dates

#### 4. **Checkbook/Transactions** (📋 Ready to Integrate)
- Individual line-item transactions
- Shows: vendor, amount, date, invoice#, description
- Most granular level of spending detail

### Project Structure

```
treasury-tracker/
├── data/
│   ├── operating_budget-all.csv ✅
│   ├── revenue_budget-all.csv
│   ├── payroll-all.csv
│   └── checkbook-all.csv
├── src/
│   ├── components/
│   │   ├── BudgetBar.tsx
│   │   ├── CategoryList.tsx
│   │   ├── LineItemsTable.tsx
│   │   └── ... other components
│   ├── types/budget.ts
│   └── App.tsx
├── scripts/
│   └── processBudget.js (currently processes operating budget only)
└── budgetConfig.json
```

### Current User Journey

1. **Overview**: See total budget with bar chart of major categories
2. **Drill Down**: Click category → see subcategories
3. **Lowest Level**: Eventually see line items table with individual expenditures
4. **Navigation**: Breadcrumbs + back button to move around

### Design Philosophy

- **Education over raw data**: Help citizens understand, not just see numbers
- **No financial jargon**: Plain language explanations
- **Visual first**: Charts before tables
- **Progressive disclosure**: Start simple, allow drilling deeper
- **Mobile-friendly**: Works on phones
- **Nonpartisan**: Neutral, factual tone

## The Challenge

**How do I integrate all four datasets into a cohesive, user-friendly experience?**

### Key Questions to Explore

1. **Information Architecture**
   - Should revenue and expenses be separate tabs/views?
   - Or combined into one "money in vs money out" view?
   - Where do salaries fit? Separate section or embedded in Personnel costs?
   - When should checkbook transactions appear?

2. **User Flow**
   - What's the most intuitive way for citizens to explore?
   - "Where does money come from?" → "Where does it go?" flow?
   - Or start with expenses (current) with optional revenue view?

3. **Data Integration Points**
   - When drilling into "Personnel Services" → show salaries data
   - When drilling into other categories → show checkbook transactions
   - How to handle that transition smoothly?

4. **Visual Design**
   - Should revenue use different visual treatment than expenses?
   - How to show both without overwhelming users?
   - Comparison views? Side-by-side? Toggle?

5. **Context & Education**
   - How to explain what revenue sources mean?
   - How to help citizens understand salary ranges?
   - What educational content would help?

### Example User Stories to Consider

**Story 1: "Where do my taxes go?"**
- User wants to see: Property taxes → how they fund police, fire, etc.
- Needs: Revenue source → expense categories mapping

**Story 2: "How much do city employees make?"**
- User wants to see: Department salaries, understand compensation
- Needs: Department → salary breakdown → individual positions (anonymized or named?)

**Story 3: "What did the city buy last month?"**
- User wants to see: Recent spending, vendors, specific purchases
- Needs: Time-filtered view of checkbook transactions

**Story 4: "Compare budget to reality"**
- User wants to see: What was budgeted vs actually spent/received
- Needs: Budget vs actual comparison, variance explanation

### Design Constraints

**Must maintain:**
- Current simplicity and user-friendliness
- Clean visual design
- Mobile responsiveness
- Fast load times

**Can't add:**
- Complex filtering/querying (keep it simple)
- Financial analysis tools (not the goal)
- Overly technical features

## What I Need Help With

Please help me think through:

1. **Information architecture** - How to organize all four datasets
2. **User flow design** - Optimal journey for citizens
3. **Visual design approach** - How to display revenue + expenses + details
4. **Integration strategy** - Technical approach to combining data
5. **Educational content** - What explanations to include

**Ideal outcome:** A clear plan for how to integrate all datasets while maintaining (or improving) the current user-friendly experience.

## Current Files to Reference

Key files in my project:
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/App.tsx` - Main app
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/src/components/BudgetBar.tsx` - Bar chart
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/scripts/processBudget.js` - Data processor
- `/Users/chrisandrews/Documents/GitHub/EV-prototypes/treasury-tracker/archivedInstructions/Treasury Tracker - Design Doc.md` - Original design doc

Data samples are in the CSVs in `/data` folder.

---

**Let's design a comprehensive, citizen-friendly financial transparency experience that makes municipal budgets actually understandable!**
