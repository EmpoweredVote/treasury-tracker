# Salaries & Transactions Processors - Documentation

## Overview

I've created two new data processors to complete your multi-dataset integration:

1. **`processSalaries.js`** - Processes employee payroll data (checkbook-all.csv)
2. **`processTransactions.js`** - Processes payment/purchase transactions (payroll-all.csv)

## How to Run

```bash
# Process salaries data
npm run process-salaries

# Process transactions data  
npm run process-transactions

# Or process everything at once
npm run process-all
```

---

## Salaries Processor (`processSalaries.js`)

### What It Does

Processes employee payroll data with **privacy-first design**:

**Default Mode (Privacy Protected):**
- ✅ Aggregates by department and position
- ✅ Shows position titles with employee counts: "Police Officer (15)"
- ✅ Displays average compensation by position
- ✅ Breaks down: base pay, benefits, overtime, other
- ❌ Does NOT show individual employee names

**Optional Mode (Full Transparency):**
- Set `includeNames = true` in the script to show individual employee names
- Creates line items with specific employees and their compensation

### Data Structure

```
Department Level:
├─ Police Department ($12.5M, 145 employees)
│  ├─ Police Officer (95) - Avg $65K
│  │  └─ Base: $52K, Benefits: $8K, OT: $5K
│  ├─ Captain (8) - Avg $95K
│  └─ Telecommunicator (12) - Avg $45K
└─ Fire Department ($10.2M, 98 employees)
   └─ ...
```

### Output Format

**File:** `public/data/salaries-{year}.json`

**Metadata includes:**
- Total compensation
- Total employees
- Average compensation
- Department count
- Privacy mode indicator

**Features:**
- Cleans department names: "Pol - Police" → "Police"
- Cleans position titles: "14-006-006 - Telecommunicator" → "Telecommunicator"
- Calculates averages automatically
- Sorts by compensation amount
- Purple color theme

### Privacy Considerations

By default, employee names are **excluded** to respect privacy while maintaining transparency:

- Shows "Police Officer (15)" instead of listing 15 individual names
- Displays average salaries by position
- Maintains accountability through position-level data
- All data is still public record (available in source CSV)

Users can understand:
- How many people work in each department
- What positions exist and their compensation
- How pay is structured (base, benefits, overtime)

Without exposing:
- Individual employee identities in the app interface
- Personal compensation details by default

**To show names:** Change line 258 in `processSalaries.js`:
```javascript
const includeNames = true; // Set to true to include employee names
```

---

## Transactions Processor (`processTransactions.js`)

### What It Does

Processes individual payment and purchase transactions with smart aggregation:

**Creates Three Views:**

1. **Hierarchical Categories** (for drill-down navigation)
   - Department → Service → Individual transactions
   
2. **Monthly Analytics** (for time-based analysis)
   - Spending by month
   - Transaction counts
   
3. **Vendor Analytics** (for procurement transparency)
   - Top 100 vendors by spending
   - Transaction frequency

### Data Structure

```
Department Level:
├─ Police ($8.2M, 3,420 transactions)
│  ├─ Main ($7.5M)
│  │  └─ Recent Transactions:
│  │     - "Uniforms - Vestis Group" $425.86
│  │     - "Vehicle Maintenance - Joe's Auto" $1,250.00
│  │     - "Equipment - Axon" $4,500.00
│  └─ Training ($0.7M)
└─ Parks & Recreation ($4.1M, 2,890 transactions)
```

### Output Format

**File:** `public/data/transactions-{year}.json`

**Includes:**

1. **Main Categories** - Hierarchical drill-down structure
2. **Analytics Object:**
   - `monthlySpending`: Array of spending by month
   - `topVendors`: Top 20 vendors with totals

**Features:**
- Aggregates by department and service
- Limits line items to 100 most recent per subcategory (prevents huge files)
- Includes vendor, date, invoice #, description
- Sorts transactions by date (most recent first)
- Chestnut brown color theme
- Warns if file size exceeds 1MB

### Performance Optimization

**Smart Sampling Strategy:**
- Shows up to 100 most recent transactions per subcategory
- Prevents file sizes from growing too large
- Maintains representativeness of spending patterns

**For a category with 500 transactions:**
- ✅ Shows: 100 most recent transactions
- ✅ Still aggregates: All 500 in totals
- ✅ Result: User sees recent activity + accurate total spending

### File Size Management

Expected file sizes:
- **2021-2023:** ~200-400 KB each
- **2024-2025:** ~500-800 KB each (more transactions)

If files exceed 1MB, the processor will warn you. Options:
1. Reduce sample size (change `slice(0, 100)` to smaller number)
2. Implement lazy loading in the app
3. Consider backend API for very large datasets

---

## Configuration in treasuryConfig.json

Both processors use the unified configuration:

```json
{
  "salaries": {
    "inputFile": "data/checkbook-all.csv",
    "outputFile": "public/data/salaries-{year}.json",
    "amountColumn": "pay_total_actual",
    "hierarchy": ["department", "position_type"],
    "colorTheme": "purple",
    "colorPalette": ["#b957a8", "#9d3c89", "#cf7cc0", ...],
    "privacyMode": true,
    "aggregateByDefault": true
  },
  
  "transactions": {
    "inputFile": "data/payroll-all.csv",
    "outputFile": "public/data/transactions-{year}.json",
    "amountColumn": "Amount",
    "hierarchy": ["Priority", "Service", "Department"],
    "colorTheme": "chestnut",
    "colorPalette": ["#b0633a", "#914926", "#c05d43", ...],
    "loadStrategy": "lazy",
    "enableFiltering": true
  }
}
```

---

## What Gets Created

After running both processors, you'll have:

```
public/data/
├── budget-2021.json          ✅ (existing - operating budget)
├── budget-2022.json          ✅
├── budget-2023.json          ✅
├── budget-2024.json          ✅
├── budget-2025.json          ✅
├── revenue-2021.json         ✅ (new - revenue sources)
├── revenue-2022.json         ✅
├── revenue-2023.json         ✅
├── revenue-2024.json         ✅
├── revenue-2025.json         ✅
├── salaries-2021.json        🆕 (run process-salaries)
├── salaries-2022.json        🆕
├── salaries-2023.json        🆕
├── salaries-2024.json        🆕
├── salaries-2025.json        🆕
├── transactions-2021.json    🆕 (run process-transactions)
├── transactions-2022.json    🆕
├── transactions-2023.json    🆕
├── transactions-2024.json    🆕
└── transactions-2025.json    🆕
```

**Total:** 25 JSON files (5 years × 5 datasets)

---

## Key Features of Both Processors

### 1. Privacy-Aware Design (Salaries)
- Default: Aggregated by position (no names)
- Optional: Full employee list with names
- Configurable via simple boolean flag

### 2. Performance Optimized (Transactions)
- Samples large transaction sets
- Warns about large files
- Maintains aggregate accuracy

### 3. Clean Data Processing
- Removes technical codes and prefixes
- Normalizes department/vendor names
- Handles missing/malformed data gracefully

### 4. Rich Metadata
- Compensation breakdowns (base, benefits, OT)
- Transaction details (vendor, date, invoice)
- Analytics summaries (monthly, vendors)

### 5. Consistent Structure
- Same JSON format as revenue/operating
- Works with existing BudgetCategory type
- Compatible with current drill-down navigation

---

## Usage in the App

### Salaries View

```tsx
// Shows department → position hierarchy
<SalariesView>
  <DepartmentBarChart />
  {/* Drill into department */}
  <PositionBreakdown>
    {/* Shows: "Police Officer (15) - Avg $65K" */}
    {/* Breakdown: Base, Benefits, OT, Other */}
  </PositionBreakdown>
</SalariesView>
```

### Transactions View

```tsx
// Shows department → service → transactions
<TransactionsView>
  <DepartmentBarChart />
  {/* Drill into department */}
  <ServiceList>
    {/* Drill into service */}
    <TransactionsTable>
      {/* Shows: Date | Vendor | Amount | Description */}
    </TransactionsTable>
  </ServiceList>
  
  {/* Optional analytics panel */}
  <MonthlySpendingChart />
  <TopVendorsList />
</TransactionsView>
```

---

## Testing the Processors

### Test Salaries Processor

```bash
npm run process-salaries
```

**Expected output:**
```
👥 Processing salary data...
📋 City: Bloomington
📊 Hierarchy: department → position
📅 Years: 2021, 2022, 2023, 2024, 2025

📂 Reading: data/checkbook-all.csv
   Found 50,000+ total payroll records

📅 Processing Salaries FY2021...
   Found 8,500 payroll records for FY2021
   💰 Total Compensation: 45,230,000
   👥 Total Employees: 850
   📊 28 departments
   🔒 Privacy mode: Names excluded (aggregated by position)
   ✅ Wrote salaries-2021.json
```

**Verify:**
```bash
# Check files were created
ls -lh public/data/salaries-*.json

# Check one file's structure
head -50 public/data/salaries-2025.json
```

### Test Transactions Processor

```bash
npm run process-transactions
```

**Expected output:**
```
📋 Processing transaction data...
📋 City: Bloomington
📊 Hierarchy: Priority → Service → Department
📅 Years: 2021, 2022, 2023, 2024, 2025

📂 Reading: data/payroll-all.csv
   Found 75,000+ total transaction records

📅 Processing Transactions FY2021...
   Found 12,500 transaction records for FY2021
   💰 Total Spending: 82,500,000
   📋 Total Transactions: 12,500
   📊 35 departments
   🏢 450 unique vendors
   ✅ Wrote transactions-2021.json
   ⚠️  Large file: 1.2 MB
```

**Verify:**
```bash
# Check file sizes
ls -lh public/data/transactions-*.json

# If files are too large, consider:
# 1. Reducing sample size in processor
# 2. Implementing pagination in app
# 3. Using lazy loading
```

---

## Troubleshooting

### "No salary data found for FY{year}"
- Check that checkbook-all.csv has `year` column
- Verify years match fiscalYears in config
- Check CSV parsing (look for malformed rows)

### "Transaction files are very large (>2MB)"
- Reduce sample size: Change `.slice(0, 100)` to `.slice(0, 50)`
- Implement pagination in the app
- Consider backend API for largest datasets

### "Department names look weird"
- Check `cleanDepartmentName()` function
- May need to adjust parsing logic for your data format
- Current: "Pol - Police" → "Police"

### "Employee names are showing when they shouldn't"
- Check `includeNames` flag in processSalaries.js (line 258)
- Should be `false` by default
- Rerun processor after changing

---

## Next Steps

1. ✅ Run both processors: `npm run process-salaries && npm run process-transactions`
2. ✅ Verify JSON files created in `public/data/`
3. ⏭️ Ready for app integration! (I'll do this next)

---

**Your data processing pipeline is now complete! All four datasets are ready to integrate into the app. 🎉**
