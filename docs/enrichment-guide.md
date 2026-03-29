# Category Enrichment Guide

How to generate citizen-friendly descriptions for budget categories in Treasury Tracker.

## Overview

Each budget category can have an **enrichment record** that provides:
- `plain_name` — 2-5 word citizen-friendly name (e.g., "City Police Operations")
- `short_description` — One sentence explaining what it pays for
- `description` — 2-3 sentence explanation for citizens with no finance knowledge
- `tags` — 3-6 topic tags for search/filtering
- `source` — 'ai' (generated) or 'official' (from budget documents)
- `confidence` — 'high', 'medium', or 'low'

Enrichments are stored in `treasury.category_enrichment` and matched to categories by a composite key: `parent_name|category_name` (or just `category_name` for top-level).

## Two Approaches

### 1. Claude Code (Recommended — No API Cost)

Use your Claude Code subscription to generate descriptions directly in conversation. This is what we use for Bloomington.

**Process:**
1. Query categories from Supabase to see what needs enrichment
2. Ask Claude Code to generate descriptions based on category names, parent chains, and local knowledge
3. Insert via a one-time Node.js script that upserts into `treasury.category_enrichment`

**Advantages:** No API costs, higher quality (full context), can handle nuanced local knowledge

**Steps for a new municipality:**

```bash
# 1. Check what exists
node -e "
const { createClient } = require('@supabase/supabase-js');
// ... load env, connect to supabase ...
// Query budget_categories for the municipality, grouped by depth
// Show category names with parent chains and amounts
"

# 2. Ask Claude Code to generate a script that creates enrichment records
# Provide: municipality name, state, entity type, any local knowledge
# Claude generates descriptions and inserts them

# 3. Verify coverage
node -e "
// Compare enrichment keys against all budget categories
// Report coverage percentage
"
```

### 2. Claude API (Automated — Costs ~$0.003/category)

Use the enrichment script for automated batch processing.

```bash
# Top-level categories only (default)
node scripts/enrichCategories.js --city "CityName" --state "ST"

# Include depth-1 subcategories
node scripts/enrichCategories.js --city "CityName" --state "ST" --depth 1

# All depths
node scripts/enrichCategories.js --city "CityName" --state "ST" --depth all

# Dry run first to preview
node scripts/enrichCategories.js --city "CityName" --state "ST" --depth 1 --dry-run

# All municipalities in a state
node scripts/enrichCategories.js --all --state IN

# Specific entity type
node scripts/enrichCategories.js --all --state IN --entity-type township
```

**Cost estimate:** ~$0.003/category with Claude Haiku. Bloomington has ~1,000 categories = ~$3.

## Enrichment Key Format

The `name_key` in `category_enrichment` uses a composite format:

| Depth | Key Format | Example |
|-------|-----------|---------|
| 0 (top-level) | `category_name` | `general government` |
| 1+ (subcategory) | `parent_name\|category_name` | `public safety\|police` |

This prevents name collisions (e.g., "Administration" under different parents).

## Key Fields in `treasury.category_enrichment`

| Column | Type | Description |
|--------|------|-------------|
| `name_key` | text | Composite key (see above) |
| `municipality_id` | uuid | Municipality-specific. NULL = universal (shared across all municipalities with same category name) |
| `plain_name` | text | Citizen-friendly name |
| `short_description` | text | One sentence |
| `description` | text | 2-3 sentences |
| `tags` | text[] | Topic tags |
| `source` | text | 'ai', 'official', or 'hybrid' |
| `confidence` | text | 'high', 'medium', or 'low' |
| `evidence_summary` | text | Brief note on confidence reasoning |
| `generated_at` | timestamptz | When generated |

Unique constraint: `(name_key, municipality_id)`

## Coverage Verification

Run this to check enrichment coverage for any municipality:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const lines = fs.readFileSync('.env.local','utf8').split('\n');
const env = {};
for (const l of lines) { const [k,...v] = l.split('='); if(k&&v.length) env[k.trim()] = v.join('=').trim(); }
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY, {db:{schema:'treasury'}});
(async()=>{
  const CITY = 'Bloomington'; const STATE = 'IN';
  const {data:m} = await sb.from('municipalities').select('id').ilike('name',CITY).eq('state',STATE).single();
  const {data:enrichments} = await sb.from('category_enrichment').select('name_key').eq('municipality_id', m.id);
  const enrichedKeys = new Set((enrichments||[]).map(e=>e.name_key));
  const {data:budgets} = await sb.from('budgets').select('id, dataset_type').eq('municipality_id',m.id);

  const stats = { operating: {t:0,m:0}, revenue: {t:0,m:0} };
  for (const budget of budgets) {
    if (!stats[budget.dataset_type]) continue;
    const {data:allCats} = await sb.from('budget_categories').select('id, name, parent_id, amount').eq('budget_id', budget.id);
    const catMap = Object.fromEntries((allCats||[]).map(c=>[c.id, c]));
    for (const c of (allCats||[])) {
      if (c.amount <= 0) continue;
      stats[budget.dataset_type].t++;
      const p = c.parent_id && catMap[c.parent_id] ? catMap[c.parent_id].name : null;
      const key = p ? p.toLowerCase().trim()+'|'+c.name.toLowerCase().trim() : c.name.toLowerCase().trim();
      if (enrichedKeys.has(key)) stats[budget.dataset_type].m++;
    }
  }
  for (const [t,s] of Object.entries(stats)) console.log(t+': '+s.m+'/'+s.t+' ('+(s.m/s.t*100).toFixed(1)+'%)');
  console.log('Total enrichments:', enrichedKeys.size);
})();
"
```

## Common Patterns (for Claude Code generation)

When generating descriptions for a new municipality, these patterns are common:

**Revenue categories:** Taxes, Charges for Services, Intergovernmental, Miscellaneous, Licenses, Fines and Forfeitures, Other — appear under each functional area

**Fund sources (Indiana):** General Fund, LIT (Local Income Tax), MVH (Motor Vehicle Highway), Cumulative Capital Development, Rainy Day, various bond funds

**Line item groups:** Personnel Services, Supplies, Other Services and Charges, Capital Outlays

**Entity-type-specific:**
- **Cities:** Police, Fire, Parks, Streets, Utilities, HAND, Economic Development
- **Townships:** Township Assistance (poor relief), Fire Protection, Cemetery, Township Administration
- **Counties:** Sheriff, Courts, Health Dept, Highway, Assessor, Recorder, Clerk
- **School districts:** Per-pupil spending, state tuition support, referendum levies, transportation

## Bloomington Stats

As of March 2026:
- **921 enrichment records** covering all operating + revenue categories
- **FY 2014-2026** — all years covered
- **100% coverage** on operating and revenue (salaries excluded — job titles are self-descriptive)
- Generated via Claude Code (no API costs)
