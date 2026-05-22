# Phase 15: Los Angeles Socrata Budget Load + Enrichment — Research

**Researched:** 2026-05-22
**Domain:** Socrata SODA API + Category Enrichment (City of Los Angeles)
**Confidence:** HIGH (all key findings verified against live Socrata API)

---

## Summary

Los Angeles publishes its operating budget line-by-line on the LA Controller's Socrata portal at `controllerdata.lacity.org`. The dataset ID is `uyzw-yi8n` (City Budget and Expenditures). It has data from 1987–2026 and is structurally compatible with the existing `bulkLoadBudget.js` pipeline using only a `data_sources` row change.

The revenue dataset (`6cbx-e2fd`) is only useful through 2022 and has only 35 rows per year (summary-level projections, not line items). It is **not suitable** for the pipeline. Phase 15 should load operating expenditure data only.

Enrichment is cheap: 58 unique `department_name` values at ~$0.002/call = ~$0.12 total — well under the $5 approval threshold.

**Primary recommendation:** Seed one `data_sources` row for LA Operating Budget, run `bulkLoadBudget.js` for FY2025 and FY2026, then run `enrichCategories.js`. No code changes required.

---

## Standard Stack

### Core
| Component | Detail | Purpose |
|-----------|--------|---------|
| `bulkLoadBudget.js` | Existing script | Generic Socrata loader — zero code changes |
| `enrichCategories.js` | Existing script | AI enrichment pipeline |
| `seedDallasDataSources.js` | Pattern reference | Copy/adapt for LA seeder |
| `treasury_sync_budget_tree` | Supabase RPC | Loads budget tree into DB |

### New Script Needed
| Script | Pattern | Purpose |
|--------|---------|---------|
| `seedLADataSources.js` | Copy `seedDallasDataSources.js` | Seed LA municipality row + data_sources row |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Task Structure

```
15-01-PLAN.md  Insert LA municipality row + seed data_sources row
15-02-PLAN.md  Dry-run then live-load LA Operating FY2025 + FY2026
15-03-PLAN.md  Dry-run then live enrichment for LA; verify in app
```

### LA Operating Budget Dataset

**Base URL:** `https://controllerdata.lacity.org`
**Dataset ID:** `uyzw-yi8n`
**API endpoint:** `https://controllerdata.lacity.org/resource/uyzw-yi8n.json`

**Column schema (verified 2026-05-22):**
| Socrata field | Role in pipeline | column_mapping key |
|---|---|---|
| `budget_fiscal_year` | fiscal year filter (string "2025") | `fiscal_year_column` |
| `department_name` | top-level category | `category_column` |
| `fund_name` | subcategory | `subcategory_column` |
| `account_name` | line item description | _(used as line item label, not mapped explicitly)_ |
| `adopted_budget_amount` | approved amount | `approved_amount_column` |
| `total_expenditures` | actual spent | `actual_amount_column` |

**Note:** `account_name` does not need to be in column_mapping — the tree builder uses `category_column` and `subcategory_column`. Line items are rolled up by the builder using the raw rows.

### column_mapping JSON for LA Operating

```json
{
  "fiscal_year_column": "budget_fiscal_year",
  "approved_amount_column": "adopted_budget_amount",
  "actual_amount_column": "total_expenditures",
  "category_column": "department_name",
  "subcategory_column": "fund_name"
}
```

### Fiscal Year WHERE Clause

`budget_fiscal_year` is a **string** field, so the WHERE clause is:
```
budget_fiscal_year='2025'
```
This is identical to Dallas (`bfy='2025'`). The loader handles this automatically when `fiscal_year_column` is set.

### data_sources Row Shape

Follows the Dallas pattern exactly:
```javascript
{
  name: 'Los Angeles Operating Budget',
  api_type: 'socrata',
  dataset_type: 'operating',
  base_url: 'https://controllerdata.lacity.org',
  dataset_id: 'uyzw-yi8n',
  column_mapping: { /* see above */ },
  fiscal_years: [2025, 2026],
  municipality_id: LA_MUNICIPALITY_ID,  // resolved after insert
}
```

### Municipality Row for LA

LA does not exist in the DB yet. Need to insert:
```javascript
{
  name: 'Los Angeles',
  state: 'CA',
  entity_type: 'city',
  population: 3878704,       // Census sub-est2024_6.csv, SUMLEV=162
  population_year: 2024,
}
```

**Census source:** `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_6.csv`
- Filter: `SUMLEV === '162'` AND `NAME` contains "Los Angeles"
- Column: `POPESTIMATE2024` = **3,878,704**
- Same CSV structure as TX file (`sub-est2024_48.csv`) — same column indexes

### Revenue Dataset Assessment

`6cbx-e2fd` (Revenue Budget and Receipts) is **not suitable** for the pipeline:
- Only 35 rows per year (summary totals, not line items)
- Only has data through 2022 (no FY2025 or FY2026)
- Columns: `fiscal_year`, `category`, `description`, `name`, `amount`, `forecast_type`, `type`
- No adopted budget structure compatible with the tree builder

**Decision: Load operating expenditures only for Phase 15.**

---

## Data Volume & Enrichment Cost Estimate

### Dataset Size

| Fiscal Year | Row Count | Unique departments |
|---|---|---|
| FY2025 | 3,786 | 58 |
| FY2026 | 3,306 | 59 |

Total LA budget FY2025: ~$19.8 billion (sanity check: reasonable for 3.9M-person city)

### Enrichment Cost Estimate

- Model: `claude-haiku-4-5-20251001` at ~$0.002/call (Haiku pricing)
- Unique `department_name` values (depth-0 categories): **~58–59**
- Some will be pre-enriched universally (FIRE, POLICE, LIBRARY, TRANSPORTATION are common)
- Worst case: 58 × $0.002 = **~$0.12**
- **Well under the $5 approval threshold — no pre-approval needed**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socrata pagination | Custom fetch loop | `bulkLoadBudget.js` already handles 5000-row pages | Already battle-tested for Dallas |
| Budget tree upsert | Custom INSERT | `treasury_sync_budget_tree` RPC | Handles idempotency, hierarchy, and row_count |
| Municipality insert | Raw SQL | `seedCollinCountyMunicipalities.js` pattern (or direct upsert in seeder) | Idempotent upsert pattern established |
| Population lookup | Manual entry | Read from `sub-est2024_6.csv` (same structure as TX file) | Authoritative Census source |
| Enrichment | New AI script | `enrichCategories.js` | Already handles city lookup, dry-run, idempotency |

---

## Common Pitfalls

### Pitfall 1: controllerdata.lacity.org vs data.lacity.org

**What goes wrong:** Using `https://data.lacity.org` as the base URL — this is the general LA open data portal. The budget dataset lives on the Controller's sub-portal at `controllerdata.lacity.org`.
**Why it happens:** LA has two Socrata portals.
**How to avoid:** Use `https://controllerdata.lacity.org` as `base_url` in the data_sources row.
**Warning signs:** 404 on API calls.

### Pitfall 2: fiscal_year_column filter format

**What goes wrong:** Using `budget_fiscal_year=2025` (numeric) in WHERE — the field is stored as a string in Socrata.
**Why it happens:** The field looks like a year (integer) but is returned as `"2025"` (string).
**How to avoid:** `bulkLoadBudget.js` wraps the value in quotes: `` `${fyCol}='${fiscalYear}'` `` — this already handles it correctly.
**Warning signs:** 0 rows returned for any FY query.

### Pitfall 3: Revenue dataset has no current data

**What goes wrong:** Seeding `6cbx-e2fd` (Revenue Budget and Receipts) expecting FY2025/FY2026 data.
**Why it happens:** The dataset name sounds complete but only runs through FY2022 and has summary-level rows (35/year), not line items.
**How to avoid:** Do not seed a revenue data_sources row for Phase 15. Operating only.
**Warning signs:** `bulkLoadBudget.js --dry-run` returns 0 rows for FY2025.

### Pitfall 4: Missing LA municipality_id before seeding data_sources

**What goes wrong:** Seeding data_sources before the municipality row exists — `municipality_id` FK will fail.
**Why it happens:** LA is not yet in the DB (all prior cities were TX).
**How to avoid:** Insert municipality row first, capture returned `id`, use in data_sources row.

### Pitfall 5: No --year flag for non-2025 enrichment

**What goes wrong:** `enrichCategories.js` defaults to `--year 2025` — if you load FY2026 data and enrich without `--year 2026`, no categories are found.
**Why it happens:** YEAR default is 2025 (line 66: `const YEAR = parseInt(args.year || '2025')`).
**How to avoid:** Run enrichment once without `--year` flag (covers FY2025), then with `--year 2026` (covers FY2026). Or run FY2025 only since enrichment is idempotent — FY2025 categories cover the same departments as FY2026.

---

## Code Examples

### Socrata count query (verified pattern)

```
GET https://controllerdata.lacity.org/resource/uyzw-yi8n.json
  ?$select=count(*)
  &$where=budget_fiscal_year='2025'
→ [{"count":"3786"}]
```

### Dry-run command (once municipality and data_sources are seeded)

```bash
node scripts/bulkLoadBudget.js --source "Los Angeles" --dry-run --fy 2025
```

### Enrichment commands

```bash
# Dry run first
node scripts/enrichCategories.js --city "Los Angeles" --state "CA" --dry-run

# Live run FY2025
node scripts/enrichCategories.js --city "Los Angeles" --state "CA"

# Live run FY2026 (same departments, idempotent — may skip most)
node scripts/enrichCategories.js --city "Los Angeles" --state "CA" --year 2026
```

---

## State of the Art

| Area | Current Approach | Notes |
|------|-----------------|-------|
| Operating budget | `uyzw-yi8n` at controllerdata.lacity.org | FY2025 (3,786 rows), FY2026 (3,306 rows) |
| Revenue budget | Not suitable for pipeline | Only through FY2022, summary rows only |
| Population | Census sub-est2024_6.csv | LA city = 3,878,704 (2024 estimate) |
| Enrichment | enrichCategories.js (Phase 14 validated) | ~58 categories, ~$0.12 cost |

---

## Open Questions

1. **Should FY2024 be loaded in addition to FY2025 and FY2026?**
   - What we know: FY2024 has 3,904 rows and adopted_budget + actual data available
   - What's unclear: Whether showing historical data adds citizen value vs. adding scope
   - Recommendation: Stick to FY2025 + FY2026 for Phase 15; historical load is a future enhancement

2. **Does LA fiscal year label ("2025") mean FY2025-26 (July–June) or calendar year 2025?**
   - What we know: LA operates on a July 1–June 30 fiscal year (standard for CA cities). The "2026" label in the dataset likely means the fiscal year ending June 30, 2026 (i.e., FY2025-26).
   - What's unclear: How the app labels this for citizens
   - Recommendation: Use value as-is; the app's existing FY label handling already displays "FY2025", "FY2026" consistently with other cities.

3. **Is there a newer LA operating budget dataset beyond uyzw-yi8n?**
   - What we know: uyzw-yi8n has FY2026 data (3,306 rows) loaded as of research date
   - What's unclear: Whether a newer dataset will be published for the adopted FY2026-27 budget
   - Recommendation: Use uyzw-yi8n for Phase 15; it is current.

---

## Milestone Context

v1.3 shipped 2026-05-22 (all 14 phases complete). Phase 15 is the first phase of a new milestone.

**Recommendation: Start v1.4 milestone.** Suggested name: "v1.4 California Geographic Expansion." Phase 15 (LA) is a natural first phase — uses existing Socrata infrastructure with a new state/city.

---

## Sources

### Primary (HIGH confidence)
- Live API query: `https://controllerdata.lacity.org/resource/uyzw-yi8n.json` — column schema, FY coverage, row counts, amount field types verified 2026-05-22
- Live API query: `https://controllerdata.lacity.org/resource/6cbx-e2fd.json` — revenue dataset schema and FY coverage verified 2026-05-22
- Census file: `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_6.csv` — LA city population 3,878,704 (2024)
- Codebase: `scripts/bulkLoadBudget.js` — column_mapping schema confirmed
- Codebase: `scripts/seedDallasDataSources.js` — data_sources row structure confirmed
- Codebase: `scripts/enrichCategories.js` — --year flag behavior confirmed (line 66)

### Secondary (MEDIUM confidence)
- WebSearch: controllerdata.lacity.org dataset discovery — confirmed both dataset IDs `uyzw-yi8n` and `6cbx-e2fd`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pipeline and enrichment scripts verified against existing codebase
- Dataset IDs + columns: HIGH — verified against live Socrata API
- Population figure: HIGH — verified against Census CSV
- Revenue dataset unsuitability: HIGH — verified row counts and max FY directly from API
- Enrichment cost: HIGH — 58 categories × $0.002 = $0.12 (well under threshold)
- Milestone recommendation: MEDIUM — logical extension of v1.3 completion, but milestone naming is a discretionary call

**Research date:** 2026-05-22
**Valid until:** 2026-08-22 (stable Socrata API; Census file valid until 2025 vintage released)
