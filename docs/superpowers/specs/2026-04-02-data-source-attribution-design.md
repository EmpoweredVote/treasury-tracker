# Data Source Attribution — Design Spec

**Goal:** Show citizens where budget data comes from via a footnote in PlainLanguageSummary, backed by a registry table that maps canonical source names to display labels and URLs.

## Database

### New table: `treasury.data_sources`

```sql
CREATE TABLE treasury.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,        -- canonical key, e.g. "indiana-gateway"
  display_name TEXT NOT NULL,       -- "Indiana Gateway"
  url TEXT NOT NULL,                -- "https://gateway.ifionline.org"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Modify `treasury.budgets`

Add `data_source_id UUID REFERENCES treasury.data_sources(id)` — nullable FK. The existing `data_source` text column stays for backward compat but is no longer the source of truth.

### Seed data

| `name` | `display_name` | `url` |
|---|---|---|
| `indiana-gateway` | Indiana Gateway | `https://gateway.ifionline.org` |
| `bloomington-open-data` | Bloomington Open Data | `https://data.bloomington.in.gov` |
| `ca-state-controller` | CA State Controller | `https://bythenumbers.sco.ca.gov` |
| `la-city-open-data` | LA City Open Data | `https://data.lacity.org` |
| `la-county-open-data` | LA County Open Data | `https://data.lacounty.gov` |
| `west-hollywood-open-data` | West Hollywood Open Data | `https://www.weho.org/city-government/city-budget/open-checkbook` |

### Normalization mapping

Update `budgets.data_source_id` based on existing `data_source` text:

| Pattern (current `data_source`) | Maps to canonical `name` |
|---|---|
| `Indiana Gateway` | `indiana-gateway` |
| `% Township Budget & Disbursements` | `indiana-gateway` |
| `Monroe County Budget & Disbursements` | `indiana-gateway` |
| `Ellettsville Budget & Disbursements` | `indiana-gateway` |
| `bloomington-open-data` | `bloomington-open-data` |
| `data/checkbook-all.csv` | `bloomington-open-data` |
| `Bloomington Annual Compensation` | `bloomington-open-data` |
| `Bloomington Public Contracts` | `bloomington-open-data` |
| `CA State Controller%` | `ca-state-controller` |
| `Socrata: https://data.lacity.org` | `la-city-open-data` |
| `LA City Budget & Expenditures` | `la-city-open-data` |
| `LA City Checkbook` | `la-city-open-data` |
| `LA City Payroll` | `la-city-open-data` |
| `ArcGIS:%LA_County%` | `la-county-open-data` |
| `ArcGIS:%Open_Expenditures%` | `la-county-open-data` |
| `West Hollywood Demand Register%` | `west-hollywood-open-data` |

## Backend API

### Budget response

The budget object returned by `GET /api/treasury/budgets/:id` already includes `data_source`. Extend it to also return the resolved source metadata:

```json
{
  "data_source": "Indiana Gateway",
  "data_source_info": {
    "displayName": "Indiana Gateway",
    "url": "https://gateway.ifionline.org"
  }
}
```

This comes from JOINing `data_sources` via `data_source_id` in `getBudgetById`.

### Frontend data flow

`dataLoader.ts` passes `data_source_info` through to `BudgetData.metadata`. The PlainLanguageSummary receives it from `operatingData` and `revenueData`.

## Frontend

### BudgetData type

Add to `metadata`:

```typescript
dataSourceInfo?: { displayName: string; url: string } | null;
```

### PlainLanguageSummary footnote

At the bottom of the component, after the revenue paragraph, render a footnote listing all unique data sources across the operating and revenue datasets:

```
Data sourced from Indiana Gateway and Bloomington Open Data
```

Where each source name is a link to its URL. If only one source, just show that one. Deduplicate across operating + revenue (an entity might have both from the same source).

**Styling:** Small text (`text-[11px]`), muted (`text-ev-gray-400`), with a subtle top border or margin to separate from the narrative. Links use the existing underline style but in the muted color.

## Out of scope

- Editing sources from the admin UI
- Per-category source attribution (all categories in a budget share the budget's source)
- Changing the import scripts to write `data_source_id` (future enhancement — currently only backfilled via SQL)
