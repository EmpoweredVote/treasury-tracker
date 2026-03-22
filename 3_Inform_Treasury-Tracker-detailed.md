# Treasury Tracker - Detailed Feature Documentation

## Overview
**Pillar**: Inform Pillar (One-directional, educational, accessible to anonymous users)

**Purpose**: Interactive data visualization tool designed to help citizens understand and explore how public funds are allocated and spent. Makes financial data accessible, digestible, and engaging while empowering citizens to "follow their tax dollars."

**Core Values**:
- Transparency through visualization
- Civic education over raw data
- Accessibility to all (no authentication required)
- Non-partisan financial literacy
- Shared ownership of community resources

**Tagline**: "Follow your tax dollars - see where your money goes and what outcomes it supports"

## Why This Feature Exists

### The Problem: Budget Opacity

**Current State of Public Budgets**:
- Published as dense PDF documents (hundreds of pages)
- Spreadsheets with cryptic line items and codes
- Presented at public hearings few attend
- Discussions dominated by insiders who understand the jargon
- Average citizen has no idea where their tax dollars actually go

**Example**: Bloomington, Indiana 2025 Budget
- **Total**: $205.8 million
- **Per resident**: ~$2,600 annually
- **Published as**: 300-page PDF with line items like "Fund 101, Dept 08, Account 42010"
- **Result**: Citizen sees "Police: $26.3M" and has no context for whether that's reasonable, what it includes, or how it compares

**Consequences**:
- Low civic engagement in budget discussions
- Distrust of government spending
- Inability to advocate for priorities
- Vulnerability to misinformation ("They're wasting YOUR money on X!")
- Disconnect between taxes paid and services received

### The Solution: Interactive Budget Visualization

**What Treasury Tracker Does**:
1. **Visualizes the Whole**: Horizontal bar showing entire budget at a glance
2. **Enables Exploration**: Click any segment to drill down into details
3. **Provides Context**: Educational explanations for every category
4. **Compares Over Time**: Year-over-year changes visible
5. **Personalizes Impact**: "Your tax dollars" calculator shows your contribution
6. **Builds Understanding**: Transforms raw data into narrative

**Design Philosophy**:
"To make municipal budgeting transparent, understandable, and engaging - enabling every citizen to visualize how their community allocates funds and how those allocations impact their lives."

**Hypothesis**:
"If we make public budgets interactive, educational, and easy to explore, users will gain greater civic literacy, trust their institutions more, and feel more confident engaging in civic discussions or decisions about spending priorities."

## Visual Design: Two View Modes

### Mode 1: Horizontal Bars (Default)

**Structure**:
Stacked horizontal bar chart where:
- **Total width** = 100% of budget
- **Each segment** = One department/category
- **Segment width** = Proportional to budget allocation
- **Color-coded** for quick recognition

**Example (Top-Level View)**:
```
[Utilities: $56.2M] [Public Safety: $48.6M] [General Gov: $37.0M] [Sustain...: $18.8M] [Culture...: $15.2M] [...]
```

**Interaction**:
- **Hover**: Tooltip shows department name, dollar amount, percentage
- **Click**: Bar "zooms in" to show that department's internal breakdown
- **Visual cue**: Chevron (>) on right side of each segment indicates clickable

**Hierarchy Levels** (Breadcrumb trail shows depth):
```
Level 1: City > Budget
Level 2: City > Budget > Public Safety
Level 3: City > Budget > Public Safety > Fire
Level 4: City > Budget > Public Safety > Fire > Main (Station)
Level 5: City > Budget > Public Safety > Fire > Main > General
```

**Example Navigation Flow**:

**Level 1 - Top-Level Budget**:
```
Total Budget: $205.8M

[Utilities $56.2M | Public Safety $48.6M | General Gov $37.0M | Sustainable $18.8M | Culture $15.2M | Highway $12.4M | Sanitation $4.6M | ...]
```

**Click "Public Safety" →**

**Level 2 - Public Safety Breakdown**:
```
Public Safety: $48.6M (23.6% of total budget)

[Police $26.3M | Fire $22.3M | Board of Public Safety $3,415 | Controller's Office $0]
```

**Click "Fire" →**

**Level 3 - Fire Department Breakdown**:
```
Fire: $22.3M (45.9% of Public Safety)

[Main $22.1M | Station #2 $58,157 | Station #5 $39,266 | Station #4 $31,748 | Station #1 $19,323 | Station #3 $8,287 | Mobile Healthcare $0]
```

**Click "Main" →**

**Level 4 - Main Fire Station Breakdown**:
```
Main: $22.1M (99.3% of Fire budget)

[General $17.2M | LIT - Public Safety $2.7M | Fire Pension $2.2M]
```

**Click "General" →**

**Level 5 - General Fund Detail**:
```
General: $17.2M (77.9% of Main station budget)

[Related Transactions section]
- Total Spent: $4.7M
- Transactions: 1,261
- Vendors: 141

Top Vendors:
• Fire Service, INC - $1.6M (18 transactions)
• HME, INC - $884.5K (1 transaction)
• Strauser Construction Co., INC - $184.9K (5 transactions)
• 911 Fleet and Fire Equipment Holdings, LLC - $150.6K (49 transactions)
• Warm Hugs LLC (My Sports Locker) - $127.4K (46 transactions)

Recent Transactions:
• 08-Parking reimb-NAMIHP-Indy-10/21 & 10/22/25 - $73 (Dec 22, 2025)
• 08-Return to Work physicals for 2 Firefighters-11/4 & 11/14/25 - $193 (Dec 22, 2025)
• 08-Dept physicals for 2 Firefighters-11/12 & 11/21/25 - $993 (Dec 22, 2025)
• 08-Badge for Capt Matt Andrews - $90
```

**Key UX Principles**:
1. **Progressive Disclosure**: Start broad, drill down as needed
2. **Breadcrumb Navigation**: Always know where you are (City > Budget > Public Safety > Fire)
3. **Back Button**: "← Back to Overview" at every level
4. **Smooth Animations**: Bars smoothly transition/expand when drilling down
5. **Visual Hierarchy**: Size = Budget proportion (instantly clear what's largest)

### Mode 2: Sunburst View (Alternative Visualization)

**Structure**:
Circular, radial visualization where:
- **Center circle** = Total budget
- **Inner ring** = Top-level departments
- **Outer rings** = Subcategories (as you drill down)
- **Slice size** = Proportional to budget

**Example**:
```
       [Outer ring: All subcategories]
     [Middle ring: Departments]
   [Inner ring: Major categories]
 [Center: Total Budget $205.8M]
```

**Interaction**:
- **Hover**: Highlights slice and shows tooltip
- **Click slice**: Zooms into that segment (becomes new center)
- **Click center**: Zooms back out one level

**Contextual Panel** (Shown on hover/click):
```
┌─────────────────────┐
│ Fire                │
│ $22.3M              │
│                     │
│ 10.8%               │
│ of total budget     │
│                     │
│ 45.9%               │
│ of Public Safety    │
└─────────────────────┘
```

**When to Use Sunburst**:
- Better for seeing whole hierarchy at once
- Good for presentations/sharing
- More visually striking (engaging)
- Better for discovering relationships

**When to Use Bars**:
- Better for comparing specific amounts
- Easier to read exact percentages
- More familiar to most users
- Better for mobile (less screen real estate needed)

**Toggle**: Users can switch between views with "Bars" / "Sunburst" buttons

## The Three Budget Views

### View 1: Money Out (How Funds Are Spent)

**Default View** - Most commonly explored

**Top-Level Categories**:
1. **Utilities** - $56.2M (27.3%)
   - Water, sewer, electric services
2. **Public Safety** - $48.6M (23.6%)
   - Police, Fire, emergency services
3. **General Government** - $37.0M (18.0%)
   - Administration, city council, legal, HR
4. **Sustainable & Economic** - $18.8M (9.1%)
   - Economic development, sustainability initiatives
5. **Culture & Recreation** - $15.2M (7.4%)
   - Parks, libraries, community centers
6. **Highway & Streets** - $12.4M (6.0%)
   - Road maintenance, snow removal, streetlights
7. **Sanitation** - $4.6M (2.3%)
   - Trash collection, recycling
8. **Debt Service** - $4.3M (2.1%)
   - Bond payments, loan interest
9. **Urban Redevelopment** - $3.6M (1.8%)
   - Downtown development, housing initiatives
10. **Capital Outlays** - $3.3M (1.6%)
    - Large purchases, infrastructure projects
11. **Community Development** - $1.9M (0.9%)

**Drill-Down Example: Public Safety → Police**:

**Police Department: $26.3M**

**Subcategories**:
- **Salaries & Wages** - $18.5M (70.3%)
  - Officer salaries
  - Overtime pay
  - Benefits
- **Operations** - $4.2M (16.0%)
  - Fuel for patrol cars
  - Office supplies
  - Utilities for precinct buildings
- **Equipment** - $2.1M (8.0%)
  - Vehicles
  - Body cameras
  - Radios and communication equipment
- **Training** - $0.9M (3.4%)
  - Academy costs
  - Continuing education
  - Certification programs
- **Technology** - $0.6M (2.3%)
  - Records management system
  - Crime analysis software
  - IT support

**Further Drill-Down: Equipment → Vehicles**:

**Vehicles: $1.2M**

**Breakdown**:
- **Patrol Cars (15 units)** - $750K
- **Motorcycles (3 units)** - $90K
- **SUVs (5 units)** - $200K
- **Specialty Vehicles (K9, SWAT)** - $160K

**Transaction Detail**:
- Vendor: "Bloomington Ford Dealership"
- Purchase: "2025 Ford Explorer Police Interceptor (Qty: 5)"
- Date: March 15, 2025
- Amount: $200,000
- Notes: "Replacement of 2018 models reaching end of service life"

### View 2: Money In (Revenue Sources)

**Top-Level Categories**:
1. **General Government** - $66.6M (34.2%)
   - Property taxes
   - Local income tax
   - Permits and fees
2. **Utilities** - $56.5M (29.0%)
   - Water/sewer fees
   - Electric utility payments
3. **Sustainable & Economic** - $26.2M (13.5%)
   - Development fees
   - Economic development grants
4. **Highway & Streets** - $15.2M (7.8%)
   - Gas tax revenue
   - Vehicle registration fees
5. **Culture & Recreation** - $13.8M (7.1%)
   - Park entrance fees
   - Recreation program fees
   - Library fines
6. **Public Safety** - $7.8M (4.0%)
   - Traffic fines
   - Emergency response fees
7. **Sanitation** - $5.0M (2.6%)
   - Trash collection fees
8. **Other** - $3.4M (1.7%)

**Drill-Down Example: General Government → Property Taxes**:

**Property Taxes: $45.2M**

**Breakdown by Type**:
- **Residential Property** - $32.1M (71.0%)
  - Single-family homes
  - Condos/townhomes
  - Apartments
- **Commercial Property** - $10.5M (23.2%)
  - Office buildings
  - Retail spaces
  - Industrial facilities
- **Agricultural** - $1.8M (4.0%)
- **Exempt (Churches, Schools, Nonprofits)** - $0.8M (1.8%)
  - Payment in lieu of taxes (PILOT)

**Educational Context Panel**:
```
💡 Did You Know?

Property taxes are assessed based on your home's value. 
The current rate in Bloomington is $1.04 per $100 of 
assessed value.

For a home valued at $250,000:
• Assessed value: $250,000
• Tax rate: 1.04%
• Annual tax: $2,600

This revenue funds:
✓ 40% → Schools
✓ 25% → City services
✓ 20% → County services
✓ 15% → Other local entities
```

### View 3: People (Workforce & Compensation)

**Top-Level View**:
```
Total City Employees: 1,247
Total Compensation: $89.3M

Breakdown by Department:
```

**Department Breakdown**:
1. **Utilities** - 342 employees, $28.1M
2. **Public Safety** - 286 employees, $24.7M
   - Police: 158 employees
   - Fire: 128 employees
3. **Highway & Streets** - 124 employees, $8.9M
4. **Culture & Recreation** - 118 employees, $7.2M
5. **General Government** - 96 employees, $12.8M
6. **Sanitation** - 82 employees, $5.1M
7. **Sustainable & Economic** - 64 employees, $2.5M

**Drill-Down Example: Public Safety → Fire → Compensation**:

**Fire Department: 128 employees, $18.5M**

**Position Breakdown**:
- **Fire Chief** - 1 employee, $145K
- **Deputy Chiefs** - 3 employees, $125K avg
- **Battalion Chiefs** - 8 employees, $105K avg
- **Captains** - 16 employees, $85K avg
- **Lieutenants** - 24 employees, $72K avg
- **Firefighters** - 68 employees, $58K avg
- **Paramedics** - 8 employees, $62K avg

**Benefits Included**:
- Health insurance
- Pension contributions
- Retirement savings match
- Life insurance
- Disability insurance

**Why This View Matters**:
- Transparency on workforce size
- Understanding compensation (not just "Fire costs $22M" but "128 people serving the community")
- Seeing where city invests in human capital
- Contextualizing "salary is 70% of budget" (labor-intensive services)

**Educational Context**:
```
💡 Why Salaries Are the Biggest Expense

Public services are labor-intensive. Police, fire, teachers, 
sanitation workers - these are people serving your community.

In Bloomington:
• 65% of total budget = Personnel costs
• 20% = Operations (supplies, utilities, maintenance)
• 10% = Capital (equipment, infrastructure)
• 5% = Debt service

This is typical for cities. Services require people.
```

## Educational Layer: Making Data Meaningful

### Contextual Panels (Appear on Click/Hover)

**For Each Budget Category, Three Panels**:

#### Panel 1: "What This Is"
Plain-language explanation of the category.

**Example - Fire Department**:
```
🔥 Fire Department

The Fire Department responds to fires, medical emergencies, 
and other hazards. Bloomington has 6 fire stations strategically 
located to ensure response times under 6 minutes city-wide.

Services include:
• Fire suppression and prevention
• Emergency medical services (EMS)
• Hazardous materials response
• Vehicle extrication (car accidents)
• Water rescue
• Public education (fire safety classes)
```

#### Panel 2: "Why It Matters"
Impact on citizens' lives, why this spending exists.

**Example - Fire Department**:
```
🏠 Why Fire Services Matter

Fire departments save lives and protect property. 

In 2024, Bloomington Fire:
• Responded to 4,237 emergency calls
• Average response time: 4 minutes 23 seconds
• 94% of structure fires contained before spreading
• Saved an estimated $18.2M in property damage

Every 1% reduction in response time correlates with:
↓ 15% reduction in fire fatalities
↓ 8% reduction in property loss
```

#### Panel 3: "Historical Context"
How this budget has changed over time, trends.

**Example - Fire Department**:
```
📊 5-Year Budget Trend

2021: $19.2M
2022: $20.1M (+4.7%)
2023: $20.8M (+3.5%)
2024: $21.5M (+3.4%)
2025: $22.3M (+3.7%)

Major changes:
• 2022: Added 6 paramedic positions (↑ $360K)
• 2023: Replaced aging ladder truck (↑ $1.2M one-time)
• 2024: Salary increases to match inflation (↑ $400K)
• 2025: New fire station #7 planning (↑ $150K design costs)

Compared to peer cities (similar size):
• Bloomington: $282 per resident
• Comparable cities avg: $295 per resident
• Bloomington is 4.4% below average
```

### "Did You Know?" Educational Pop-Ups

**Scattered Throughout Exploration**:

**Example 1 - Property Tax**:
```
💡 Did You Know?

Indiana has the 12th lowest property tax rate in the nation.

Your property tax bill includes multiple levies:
• City general fund
• School operating costs
• Library district
• Fire protection district
• County services

You can see the breakdown on your annual tax statement.
```

**Example 2 - Debt Service**:
```
💡 Understanding Municipal Bonds

When the city issues bonds, it's like taking out a loan 
to pay for large projects (e.g., building a new fire station).

Bloomington's current debt:
• Total bonds outstanding: $42.3M
• Annual debt service: $4.3M
• Average interest rate: 3.2%
• Projected payoff: 2038

Bonds are used for:
✓ Infrastructure (roads, water lines)
✓ Buildings (city hall, fire stations)
✓ Parks and recreation facilities

NOT used for:
✗ Day-to-day operations
✗ Salaries
✗ Supplies
```

**Example 3 - Sales Tax**:
```
💡 Where Your Sales Tax Goes

Indiana sales tax: 7%

Distribution:
• 5% → State general fund
• 1% → County economic development
• 1% → City general fund

When you buy a $100 item in Bloomington:
• $5 goes to state
• $1 goes to Monroe County
• $1 stays in Bloomington

This is why local shopping matters - it directly 
funds your community services.
```

### Comparisons & Benchmarks

**Built Into Contextual Panels**:

**Example - Per-Resident Spending**:
```
Bloomington spends $2,600 per resident annually.

How does this compare?
• Carmel, IN (similar size): $2,850
• Fort Wayne, IN (larger): $2,200
• Muncie, IN (similar size): $2,450
• National avg (cities 50-100K pop): $2,575

Bloomington is roughly average for Indiana cities 
of comparable size and demographics.
```

**Example - Department Efficiency**:
```
Fire Department Operating Cost per Call:

Bloomington: $5,265 per emergency response
Peer cities average: $5,890

Bloomington's fire department responds to more 
calls with slightly lower cost per call, suggesting 
efficient operations.
```

## Year-Over-Year Comparison

### The Year Selector

**Interface**:
Dropdown in top-right: "Year 2025 ▼"

**Options**:
- 2025 (current)
- 2024
- 2023
- 2022
- 2021

**What Changes When Year Selected**:
1. **All dollar amounts update** to reflect selected year's budget
2. **Percentages recalculate** based on that year's total
3. **Historical context panels update** to show different time windows
4. **Visual indicators appear** showing year-over-year changes

### Change Indicators

**On Each Budget Segment**:

**Example - Public Safety in 2025**:
```
Public Safety
$48.6M  23.6%  ↑ +3.7% from 2024
```

**Color Coding**:
- **Green arrow ↑**: Increase from previous year
- **Red arrow ↓**: Decrease from previous year
- **Gray dash →**: Unchanged

**Hover for Details**:
```
Public Safety Budget Change (2024 → 2025)

2024: $46.9M
2025: $48.6M
Change: +$1.7M (+3.7%)

Reasons for increase:
• Salary adjustments for inflation: +$980K
• 4 new police officer positions: +$320K
• New fire station planning: +$150K
• Equipment replacement cycle: +$250K
```

### Multi-Year View (Advanced)

**Toggle Option**: "Compare Multiple Years"

**Shows Trend Line**:
```
Public Safety Budget Trend (2021-2025)

$50M ┤                           ●  $48.6M
     │                       ●  $46.9M
$45M ┤                   ●  $45.2M
     │               ●  $43.8M
$40M ┤           ●  $42.1M
     │
     └───────────────────────────────────
       2021   2022   2023   2024   2025

Average annual growth: 3.6%
Total increase (5 years): $6.5M (+15.4%)
```

## "Follow Your Tax Dollars" Calculator

### Personal Tax Contribution Estimator

**Interface**:

**Step 1 - Enter Your Info**:
```
🧮 See Where YOUR Tax Dollars Go

Enter your annual household income: [$_______]

[Calculate My Impact]

Optional (for more accuracy):
☐ I own property (home value: $_______)
☐ I rent (monthly rent: $_______)
```

**Step 2 - Results**:
```
Based on your income of $75,000:

Your annual contribution to Bloomington's budget: ~$1,950

Here's where YOUR money goes:

Utilities: $533 (27.3%)
  → Water, sewer, electric infrastructure

Public Safety: $461 (23.6%)
  → Police, fire, emergency services
  
General Government: $351 (18.0%)
  → City administration, legal, elections

[Full breakdown...]
```

**Visual Enhancement**:
When calculator is active, the main budget bar highlights with "your contribution":

```
[Bar shows in two colors]
Light color = Total budget
Dark color = Your proportional contribution

Utilities: [$533 of $56.2M]
```

**Educational Note**:
```
⚠️ Note: This is an approximation.

Your actual tax contribution depends on:
• Property ownership and value
• Sales tax from purchases
• Local income tax rates
• Other local fees

This calculator provides a rough estimate 
based on average contributions for your 
income level in Bloomington.
```

### Why This Matters

**Psychological Impact**:
- Makes budget personal ("MY $461 funds police/fire")
- Creates sense of ownership ("I'm paying for this")
- Builds civic investment ("I should care about how it's spent")
- Enables informed advocacy ("I pay $351 for general government - is that reasonable?")

**Example User Journey**:
1. User enters income: $75K
2. Sees they contribute ~$461 to Public Safety
3. Clicks on Public Safety to explore
4. Sees Police $243, Fire $218 (from their contribution)
5. Drills into Fire → sees they're funding 128 firefighters
6. Reads "Fire responded to 4,237 emergencies last year"
7. Thinks: "My $218 helps fund 34 emergency responses per day - that's worth it"

## Transaction-Level Detail (Deepest Level)

### Related Transactions Section

**Appears at Deepest Drill-Down** (e.g., Fire > Main > General)

**Summary Cards**:
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   $4.7M      │  │   1,261      │  │     141      │
│ TOTAL SPENT  │  │ TRANSACTIONS │  │   VENDORS    │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Top Vendors List**:
```
🏢 Top Vendors

1. Fire Service, INC
   $1.6M (18 transactions)
   [Click to see all transactions with this vendor]

2. HME, INC
   $884.5K (1 transaction)
   [Large equipment purchase]

3. Strauser Construction Co., INC
   $184.9K (5 transactions)
   [Station repairs and renovations]

4. 911 Fleet and Fire Equipment Holdings, LLC
   $150.6K (49 transactions)
   [Ongoing equipment supplies]

5. Warm Hugs LLC (My Sports Locker)
   $127.4K (46 transactions)
   [Uniforms and gear]

[View All 141 Vendors]
```

**Recent Transactions**:
```
📋 Recent Transactions

08-Parking reimb-NAMIHP-Indy-10/21 & 10/22/25
👤 VanDerMoere, Shelby M
📅 Dec 22, 2025
💰 $73
🏷️ EFT

08-Return to Work physicals for 2 Firefighters-11/4 & 11/14/25
👤 St. Vincent Health, Wellness & Preventive Care
📅 Dec 22, 2025
💰 $193
🏷️ EFT

08-Dept physicals for 2 Firefighters-11/12 & 11/21/25
👤 St. Vincent Health, Wellness & Preventive Care
📅 Dec 22, 2025
💰 $993
🏷️ EFT

08-Badge for Capt Matt Andrews
📅 [Date]
💰 $90
```

**Why This Level of Detail**:
1. **Maximum Transparency**: Every dollar accounted for
2. **Accountability**: Public can see exactly what was purchased
3. **Fraud Detection**: Unusual transactions visible to citizens
4. **Understanding**: "Oh, they're buying medical physicals for firefighters - that makes sense"
5. **Trust Building**: Nothing hidden, everything traceable

**Privacy Protections**:
- Individual employee names only shown for: officers (Fire Chief), public officials
- Regular employee purchases anonymized or aggregated
- Sensitive purchases (undercover equipment, etc.) can be redacted with explanation

## Integration with Other Features

### Integration with Empowered Essentials

**Scenario**: User is researching Mayor Thompson's record

**On Mayor Thompson's Essentials Page**:

**New Section - Budget Impact**:
```
📊 Budget Priorities During Tenure

Mayor Thompson took office: January 2024

Budget changes under this administration:

Public Safety: +$2.1M (+4.5%)
  "Increased police staffing to address downtown safety"

Culture & Recreation: +$1.8M (+13.4%)
  "Major investment in park renovations"

Sustainable & Economic: -$0.5M (-2.6%)
  "Reorganized economic development department"

[View Full Budget Details in Treasury Tracker →]
```

**Clicking "View Full Budget Details"**:
- Opens Treasury Tracker
- Auto-selects Mayor Thompson's years in office (2024-2025)
- Highlights categories with significant changes
- Shows year-over-year comparison focused on their tenure

**Why This Matters**:
- Voters can see if candidates' claimed priorities match actual budget allocations
- "Candidate says they prioritize parks - did they actually fund parks when in office?"
- Creates accountability loop (promises → budget → outcomes)

### Integration with Empowered Compass

**Scenario**: User has calibrated compass showing "Public Safety" as low priority, "Culture & Recreation" as high priority

**When User Opens Treasury Tracker**:

**Personalized Callout**:
```
💡 Based on Your Empowered Compass

You've indicated Culture & Recreation is a top priority for you.

Current Bloomington budget allocation:
• Culture & Recreation: 7.4% of budget
• Public Safety: 23.6% of budget

How does this align with your values?

[Explore Culture & Recreation Budget →]
[Compare With Other Cities →]
```

**What This Enables**:
- Users see if city's budget priorities match their personal values
- Can research whether they think allocation is appropriate
- Informed advocacy: "I think we should increase parks funding from 7% to 10%"

### Integration with Read & Rank

**Scenario**: Upcoming Mayor election, Read & Rank includes budget priorities question

**Read & Rank Quote**:
```
"I believe we're overspending on administration and should 
reallocate 5% of the General Government budget to Public Safety."
```

**After Ranking, User Sees in Results**:
```
You ranked this position Gold (Runner-Up):
"Reallocate 5% from General Government to Public Safety"

[See Current Budget Breakdown in Treasury Tracker →]
```

**Clicking Through**:
- Opens Treasury Tracker
- Shows General Government ($37.0M) and Public Safety ($48.6M)
- Calculates: "5% of $37.0M = $1.85M"
- Shows: "If reallocated, Public Safety would increase to $50.45M (+3.8%)"
- Provides context: "This would fund approximately 18 additional police officers"

**Why This Matters**:
- Turns abstract policy positions into concrete numbers
- Users can see actual impact of proposed changes
- Budget literacy increases through engagement

### Integration with Issues in Focus

**Scenario**: "Public Safety Funding" Issue in Focus community

**Community Creates Empowered Badge**: "Municipal Budget Basics"

**Badge Requirements**:
1. Explore Treasury Tracker for at least 15 minutes
2. Navigate to at least 3 different departments
3. Complete quiz:
   - "What percentage of budget is Public Safety?" (Answer: 23.6%)
   - "What's the largest component of Fire Department budget?" (Answer: Salaries)
   - "How has Public Safety funding changed over 5 years?" (Answer: +15.4%)

**After Unlocking Badge**:
- User can participate in "Public Safety Funding" discussions in Issues in Focus
- Badge ensures everyone debating has baseline budget knowledge
- Reduces "talking past each other" due to factual misunderstandings

**Community Produces Content for Treasury Tracker**:
- Issues in Focus members write educational panels
- "Why Public Safety Funding Matters" context
- Comparison with peer cities
- Analysis of efficiency metrics

**Quality Control**:
- Content must be non-partisan
- Must cite sources
- Veracity Rating applies (accuracy matters)

## Data Sources & Accuracy

### Where Budget Data Comes From

**Official Sources**:
1. **City of Bloomington Adopted Budget** (annual PDF)
   - Published each November for following fiscal year
   - Available at: bloomington.in.gov/budget
   - Public record, legally required

2. **Actual Expenditure Reports** (quarterly/annual)
   - Shows real spending vs. budgeted
   - Published by City Controller's Office
   - Updated quarterly

3. **Transaction-Level Data** (if available)
   - Purchased from city finance system
   - Or: Scraped from public records requests
   - Or: Provided via open data portal

**For Bloomington Prototype**:
- Manual data entry from 2025 adopted budget
- Categorization aligned with city's chart of accounts
- Verification against published reports

**Long-Term Vision**:
- Direct API integration with city finance systems
- Automated updates (weekly/monthly)
- Real-time spending dashboards

### Data Accuracy Standards

**Verification Process**:
1. **Source Citation**: Every number linked to official document
2. **Update Frequency**: Budget data refreshed annually; actuals quarterly
3. **Audit Trail**: Changes logged with timestamp and source
4. **Crowd-Sourced Validation**: Connected Accounts can flag discrepancies

**Displaying Uncertainty**:
```
⚠️ Data Status

Budget Year: 2025 (Adopted November 2024)
Last Updated: February 1, 2026
Next Update: May 1, 2026 (Q1 actuals)

Note: These are budgeted amounts. Actual spending 
may vary. Check back quarterly for actual expenditure data.
```

**When Mistakes Happen**:
- Correction banner at top: "We found an error in X category and have updated it"
- Link to correction log showing old vs. new values
- Explanation of error source

### Expanding Beyond Bloomington

**Phase 2: Other Indiana Cities**:
- Partner with cities that already have open data portals
- Indianapolis (already has similar tool)
- Fort Wayne, Evansville, South Bend
- Focus on cities with existing civic tech initiatives

**Phase 3: State Budget**:
- Indiana state budget (~$40B)
- More complex (multiple funds, agencies)
- But same principles apply

**Phase 4: Federal Budget**:
- US federal budget (~$6.75T)
- Extremely complex
- But existing tools (USAspending.gov) provide starting point
- Focus on making it more digestible and engaging

**Partnerships Needed**:
- Government Finance Officers Association (GFOA)
- Open data advocacy groups
- Local civic tech organizations
- League of Women Voters

## Success Metrics

### Engagement Metrics
- **Unique users** accessing Treasury Tracker
- **Average session duration** (target: >5 minutes)
- **Drill-down depth**: % of users clicking beyond Level 1
- **Return visits**: % of users coming back multiple times

### Understanding Metrics
- **Quiz completion rate** (embedded mini-quizzes)
- **Correct answer rate** on budget comprehension questions
- **Self-reported understanding**: Survey "How well do you understand your city budget?" (before/after)

### Civic Action Metrics
- **Budget hearing attendance** in Bloomington (does it increase?)
- **Public comments on budget** (more informed comments?)
- **Media coverage** citing Treasury Tracker data
- **Candidate campaigns** using budget data in platforms

### Trust Metrics (Long-Term)
- **Survey**: "Do you trust your city government manages money responsibly?" (track over time)
- **Survey**: "Do you feel you have access to information about how your taxes are spent?"
- **Comparison**: Trust levels in cities with Treasury Tracker vs. without

## Technical Specifications

### Data Model

**Budget Category Object**:
```json
{
  "category_id": "uuid",
  "name": "Public Safety",
  "parent_id": null,
  "level": 1,
  "fiscal_year": 2025,
  "budgeted_amount": 48600000,
  "actual_spent": 11250000,
  "percentage_of_parent": 23.6,
  "percentage_of_total": 23.6,
  "icon": "shield",
  "color": "#FF6B9D",
  "description": "Police, fire, and emergency services",
  "children": ["category_id_police", "category_id_fire", "..."]
}
```

**Transaction Object**:
```json
{
  "transaction_id": "uuid",
  "category_id": "fire_main_general",
  "vendor": "Fire Service, INC",
  "amount": 89650,
  "date": "2025-12-22",
  "description": "Equipment maintenance contract - Q4",
  "payment_method": "EFT",
  "approved_by": "Fire Chief Johnson",
  "public": true
}
```

**Historical Comparison Object**:
```json
{
  "category_id": "public_safety",
  "year_data": [
    {"year": 2021, "amount": 42100000},
    {"year": 2022, "amount": 43800000, "change_pct": 4.0},
    {"year": 2023, "amount": 45200000, "change_pct": 3.2},
    {"year": 2024, "amount": 46900000, "change_pct": 3.8},
    {"year": 2025, "amount": 48600000, "change_pct": 3.6}
  ]
}
```

### Visualization Libraries

**Recommended**:
- **D3.js**: For custom bar charts and sunburst
- **Chart.js**: For simpler charts (trend lines, comparisons)
- **Framer Motion** (React): For smooth animations

**Key Requirements**:
- Smooth transitions when drilling down
- Responsive (works on mobile)
- Accessible (screen reader compatible, keyboard navigation)
- Fast (handles large datasets without lag)

### Performance Optimization

**Data Loading**:
- Lazy load subcategories (only fetch when clicked)
- Cache frequently accessed categories
- Pre-calculate percentages server-side

**Rendering**:
- Virtual scrolling for long transaction lists
- Throttle hover events (don't recalculate on every pixel movement)
- Memoize category calculations

**Target Performance**:
- Initial page load: <2 seconds
- Category drill-down: <300ms
- Smooth 60fps animations

## Design Challenges & Solutions

### Challenge 1: Budget Complexity

**Problem**: 
Real municipal budgets have 100+ categories. Overwhelming if all shown at once.

**Solution**:
- Start with 8-12 top-level categories (aggregated)
- Progressive disclosure (drill down only if interested)
- Search function: "Find 'parks'" → highlights relevant categories
- Smart defaults: Show biggest categories first, hide tiny ones initially

### Challenge 2: Jargon & Acronyms

**Problem**: 
Budget documents full of terms like "LIT - Public Safety" (Local Income Tax), "Fund 101", "GAAP basis"

**Solution**:
- Translate all jargon to plain language
- Hover tooltips explain abbreviations
- "Learn More" links to glossary
- Educational panels use everyday examples

**Example**:
```
Budget Term: "General Fund"
Plain Language: "Day-to-day Operating Budget"

Explanation: This is the city's main checking account 
for regular expenses like salaries, supplies, and utilities. 
Think of it like your household budget for groceries, 
rent, and bills.
```

### Challenge 3: Dry Subject Matter

**Problem**: 
Budgets are boring. Hard to make engaging.

**Solution**:
- Gamification: Unlock badges for exploring
- Personal connection: "Your tax dollars" calculator
- Storytelling: "This $2M bought 15 new electric buses"
- Visual appeal: Beautiful, colorful design
- Comparisons: "Bloomington vs. peer cities"

**Gamification Example**:
```
🏆 Budget Explorer Badges

[✓] First Step: Viewed Treasury Tracker
[✓] Curious Mind: Clicked into 3 departments
[ ] Deep Diver: Explored to Level 4
[ ] Transaction Detective: Viewed transaction details
[ ] Time Traveler: Compared 3 different years
[ ] Budget Expert: Completed all educational quizzes

Progress: 2/6 badges earned
```

### Challenge 4: Apples-to-Oranges Comparisons

**Problem**: 
Not all cities budget the same way. "Public Safety" in one city might include things another city categorizes under "General Government."

**Solution**:
- Normalize categories when comparing cities
- Footnotes explaining differences
- "Comparable cities" carefully selected (similar size, demographics, services)
- Clear methodology documentation

**Example**:
```
⚠️ Comparison Note

When comparing Bloomington to Fort Wayne:

Bloomington includes animal control in Public Safety.
Fort Wayne includes it in General Government.

For this comparison, we've recategorized to ensure 
apples-to-apples comparison.
```

### Challenge 5: Mobile Experience

**Problem**: 
Detailed budget visualization hard to view on small screens.

**Solution**:
- Responsive design: Bars stack vertically on mobile
- Simplified mobile view (fewer categories visible at once)
- Swipe gestures for drilling down
- "Desktop view recommended" note for transaction details

## Future Enhancements

### 1. Budget Proposal Simulator

**Feature**: 
Users can create their own budget proposals.

**How It Works**:
1. User starts with current budget
2. Can increase/decrease any category (constrained by total budget)
3. See impact: "If you increase Parks by $2M, you must decrease X by $2M"
4. Save and share proposal
5. Compare with other users' proposals

**Why It's Valuable**:
- Educates on budget constraints (can't just increase everything)
- Fosters empathy ("Oh, every decision has tradeoffs")
- Crowdsources ideas (citizens' priorities visible to officials)

### 2. Outcomes Dashboard

**Feature**: 
Link spending to outcomes.

**Example**:
```
Public Safety: $48.6M

Outcomes:
• 911 response time: 4m 23s (↓ 15s from last year)
• Crime rate: 2.1 per 1,000 residents (↓ 8% from last year)
• Fire insurance rating: Class 2 (saves residents $X on insurance)
• Customer satisfaction: 87% (↑ 3% from last year)
```

**Data Sources**:
- Annual city performance reports
- Police/Fire department statistics
- Citizen surveys

**Why It's Valuable**:
- Shows return on investment
- Answers "Is this money well spent?"
- Enables performance-based budgeting discussions

### 3. Budget Watchdog Features

**Feature**: 
Crowdsourced budget monitoring.

**How It Works**:
1. Users can "flag" transactions that seem unusual
2. Flags reviewed by community moderators
3. If legitimate concern, escalated to city auditor
4. Results published (was it fraud? mistake? legitimate?)

**Example**:
```
🚩 Flagged Transaction

Transaction: "Office supplies - $15,000"
Vendor: "Bob's Party Supplies"
Flag reason: "Party supplies doesn't seem like legitimate office vendor"

Status: Under Review

Update (2 weeks later):
"Reviewed by City Auditor. This was a data entry error. 
Actual vendor was 'Bob's Office Supplies' (legitimate). 
Corrected in system."
```

**Safeguards**:
- Can't flag individual employees (privacy protection)
- Frivolous flags penalize user's Veracity Rating
- City auditor has final say

### 4. Participatory Budgeting Integration

**Feature**:
Link to participatory budgeting process.

**How It Works**:
- City sets aside portion of budget (e.g., $500K) for community vote
- Proposals listed in Treasury Tracker
- Citizens vote on which projects to fund
- Winners get implemented, tracked in Treasury Tracker

**Example**:
```
💰 2026 Participatory Budget: $500K Available

Vote for your top 3 projects:

☐ New playground at Highland Park ($150K)
☐ Downtown bike lane expansion ($200K)
☐ Community garden program ($75K)
☐ Free WiFi in parks ($100K)
☐ Public art installations ($125K)

[Submit Your Votes]

Results announced: March 15, 2026
```

**Integration**:
After projects funded, track in Treasury Tracker:
- Show spending on chosen projects
- Link to outcomes (photos of new playground, bike lane usage stats)
- Close the loop: "You voted, we funded, here's the result"

### 5. AI-Powered Budget Assistant

**Feature**:
Natural language queries about budget.

**Examples**:
```
User: "How much does Bloomington spend on parks?"
AI: "In 2025, Bloomington budgets $7.2M for parks and recreation, 
which is 3.5% of the total budget. This funds 8 parks, 3 community 
centers, and 42 full-time staff."

User: "Has park spending increased or decreased over time?"
AI: "Park spending has grown 12% over the past 5 years, from 
$6.4M in 2021 to $7.2M in 2025. The largest increase was in 
2023 (+$450K) for new trail construction."

User: "How does Bloomington's park spending compare to similar cities?"
AI: "Bloomington spends $91 per resident on parks. Comparable cities 
average $85 per resident. Bloomington is 7% above average."
```

**Technical Implementation**:
- LLM trained on budget data
- Can query database in real-time
- Provides sources for all answers

## Summary: Why Treasury Tracker Matters

Treasury Tracker is about **democratic participation through financial literacy**. It:

1. **Demystifies Government**: Turns incomprehensible budget documents into intuitive visualizations
2. **Builds Trust**: Radical transparency shows government has nothing to hide
3. **Enables Advocacy**: Can't advocate for priorities if you don't understand current allocations
4. **Creates Ownership**: "My tax dollars" calculator makes it personal
5. **Educates Citizens**: Every interaction is a learning opportunity
6. **Holds Officials Accountable**: Promises vs. actual budget allocations visible
7. **Empowers Participation**: Informed citizens engage more in budget hearings

Most importantly, it makes the abstract concrete. "The city budget is $205M" means nothing. "Your $461 funds 34 emergency responses per day" means everything.

As the design doc says: "This design demystifies public finance while fostering transparency, civic confidence, and a sense of shared ownership over community resources."

That's the mission. Treasury Tracker makes it real.

---

*This document represents the comprehensive understanding of Treasury Tracker as of February 2026, including all visualization modes, drill-down mechanics, educational layers, and integration points. It should be updated as the feature evolves through user testing and implementation, particularly after the Bloomington prototype launches.*
