# Phase 24: Los Angeles Data Refresh — Research

**Researched:** 2026-06-02
**Domain:** Socrata SODA API, Supabase data repair, LA Controller datasets
**Confidence:** HIGH (all key claims verified via live Socrata API calls)

---

## Summary

Phase 24 has five distinct sub-tasks, each with a clear fix path verified against live data. The
root cause connecting Tasks 1, 2, and 3 is the same: the LA Controller dataset (`uyzw-yi8n`)
includes enterprise-fund rows (LADWP, Airports, Harbor) with `adopted_budget_amount=0` but
non-zero `total_expenditures`. The tree builder keeps these rows (only drops rows where _both_
amounts are zero), inflating actuals. A single `where_extra = "AND adopted_budget_amount > 0"`
filter on the operating source fixes this for all years.

The revenue accuracy problem (Task 1) is a separate expression of the same issue: `vvm4-a2zu`'s
`revenue_collected` column sums to $44.6B because it includes LADWP ($17.2B), Airports ($4B),
and Harbor ($0.9B) actual collections. The approved `revenue_budget` column ($10.2B) is the
correct figure to display. The fix is to null out `actual_amount_column` in the revenue
data_source column_mapping so the UI never reaches for `revenue_collected`.

The orphaned FK (Task 4) is auto-healed by running `treasury_sync_budget_tree` for FY2017–2024:
the RPC writes `data_source_id = 01c50191` onto the budget row, replacing the dead
`1973cbe0` reference. No separate repair script is needed.

The "improve summaries" task (Task 5) is best addressed as a UI change: the 70 enrichment rows
already store a 2–3 sentence `description` field that is never shown in `PlainLanguageSummary`.
Surfacing it (tooltip, expand toggle, or inline prose) requires no new API calls and no DB writes.

**Primary recommendation:** Fix the `column_mapping` for both data sources in `seedLADataSources.js`
and `seedCaliforniaCities.js`, re-run `bulkLoadBudget.js` for FY2017–2026, and add a UI change
to surface the existing enrichment `description` field.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Revenue accuracy fix | Database / Storage | API / Backend | Fix is a column_mapping change in data_sources row + data reload |
| Actuals backfill | Database / Storage | — | bulkLoadBudget.js run against existing Socrata data |
| Historical category trees | Database / Storage | — | Same loader, older fiscal years |
| Orphaned FK repair | Database / Storage | — | Auto-repaired by treasury_sync_budget_tree re-run |
| Summaries improvement | Browser / Client | — | UI change to display existing enrichment.description field |

---

## Standard Stack

### Core — No New Packages

All work uses existing scripts and infrastructure. No new packages are needed.

| Component | Version | Purpose |
|-----------|---------|---------|
| `scripts/bulkLoadBudget.js` | existing | Socrata SODA loader — extended via column_mapping only |
| `scripts/seedLADataSources.js` | existing | Seeder for LA municipality + operating data_source |
| `scripts/seedCaliforniaCities.js` | existing | Seeder for LA Revenue Budget (vvm4-a2zu) |
| `treasury_sync_budget_tree` | Supabase RPC | Budget row upsert by municipality_id+fiscal_year+dataset_type |

**Installation:** None needed.

---

## Package Legitimacy Audit

> Not applicable — Phase 24 installs no new packages.

---

## Dataset Reference

### Operating Budget (uyzw-yi8n at controllerdata.lacity.org)

**Current data_source:** `id=01c50191-831e-4c88-82ef-e62a2e200e2b`, `fiscal_years=[2025,2026]`

| Fiscal Year | Total Rows | Rows with adopted>0 | Adopted Budget | Actual Spend (adopted>0) |
|---|---|---|---|---|
| FY2017 | 3,599 | 1,367 | $13.4B | $11.4B |
| FY2018 | 3,646 | 1,516 | $14.2B | $11.9B |
| FY2019 | 3,814 | 1,524 | $15.1B | $12.4B |
| FY2020 | 3,813 | 1,571 | $16.2B | $13.5B |
| FY2021 | 4,235 | 1,477 | $16.2B | $13.2B |
| FY2022 | 3,912 | 1,605 | $17.4B | $13.7B |
| FY2023 | 3,781 | 1,605 | $18.2B | $14.6B |
| FY2024 | 3,904 | 1,630 | $20.0B | $15.4B |
| FY2025 | 3,786 | 1,525 | $19.9B | $16.0B |
| FY2026 | 3,317 | — | $21.4B | $39.5B (in-year, incomplete) |

[VERIFIED: Socrata API `https://controllerdata.lacity.org/resource/uyzw-yi8n.json` — all counts
and amounts queried 2026-06-02]

**Key finding:** `total_expenditures` for ALL years is 2–3x the `adopted_budget_amount` because
enterprise-fund departments (WATER AND POWER, AIRPORTS, HARBOR) have `adopted_budget_amount=0`
but large actual expenditures. Filtering `AND adopted_budget_amount > 0` excludes these rows
and produces clean departmental actuals. [VERIFIED: Socrata API 2026-06-02]

**Distinct department count:** 48 (FY2017) to 58 (FY2025) when filtered to adopted>0 rows.
`department_name` and `fund_name` are populated for ALL years back to at least FY2017.
[VERIFIED: Socrata API 2026-06-02]

### Revenue Budget (vvm4-a2zu at controllerdata.lacity.org)

**Current data_source:** `id=ea3c8f7e-0ab0-4a79-9f2b-9b7093d5bb55`, `fiscal_years=[2025,2026]`
**column_mapping:** `actual_amount_column='revenue_collected'`

| Fiscal Year | revenue_budget (approved) | revenue_collected (actual — ALL FUNDS) |
|---|---|---|
| FY2025 | $10.2B | $44.6B |
| FY2026 | $10.1B | $42.9B |

[VERIFIED: Socrata API 2026-06-02]

**Root cause:** `revenue_collected` includes enterprise fund collections:
- WATER AND POWER: $17.2B (FY2025) [VERIFIED: Socrata API]
- AIRPORTS: $4.0B (FY2025) [VERIFIED: Socrata API]
- HARBOR: $0.9B (FY2025) [VERIFIED: Socrata API]

Total enterprise excess: ~$34B above approved `revenue_budget` ($10.2B).

**Fix:** Set `actual_amount_column: null` in the `LA_REVENUE` column_mapping in
`seedCaliforniaCities.js`. This prevents the tree builder from loading any actual values.
For past fiscal years, the UI falls back to `total_budget` ($10.2B approved) since
`hasActualData` will be false. No enterprise fund bleed. [ASSUMED — UI behavior depends
on `showActual` logic reading `isPastYear && hasActualData`; tested by code inspection]

**Why not filter revenue by fund_name='GENERAL FUND'?** The operating budget ($19.9B) uses
all funds too — filtering revenue to general fund only ($9.7B) would create apples-to-oranges
scope mismatch. Showing the approved revenue budget ($10.2B) is the safest display choice
until a deliberate all-funds framing decision is made. [ASSUMED — framing choice, not technical]

### Alternative Revenue Dataset (hfus-a659 at controllerdata.lacity.org)

`hfus-a659` has the same columns as `vvm4-a2zu` plus an additional `adopted_revenue_budget`
column. Using `adopted_revenue_budget` as both approved and actual columns would give a
purely-budgeted view ($9.38B FY2025 general fund only). This is a valid alternative but
changes the approved total from $10.2B to $9.38B and requires updating the data_source row
to use a different dataset_id. The simpler fix (null out actual_amount_column on vvm4-a2zu)
preserves the existing $10.2B display that was human-verified at Phase 16 completion.
[VERIFIED: hfus-a659 column schema confirmed via Socrata API 2026-06-02]

---

## Architecture Patterns

### How treasury_sync_budget_tree Handles Re-runs

The RPC matches an existing budget row by `(municipality_id, fiscal_year, dataset_type)` and
updates it in place. The `p_data_source_id` parameter is written onto the `data_source_id`
column of the budget row. This means:

- Re-running `bulkLoadBudget.js` for FY2017–2024 will **replace** the orphaned
  `data_source_id=1973cbe0` with `data_source_id=01c50191` — repairing the FK automatically.
- The `total_budget`, category tree, and actual amounts are all rebuilt from scratch.
- Idempotent: running twice produces identical results.

[VERIFIED: Phase 15 Plan 02 summary confirms clear-and-rebuild semantics; v1.4 milestone audit
confirms data_source_id is written by treasury_sync_budget_tree]

### where_extra Filter Pattern

`bulkLoadBudget.js` already supports `where_extra` in `column_mapping` (added for SF operating
budget which needed `AND revenue_or_spending='Spending'`). The filter is appended verbatim
to the Socrata `$where` clause. The caller must supply the leading `AND`.

```javascript
// In seedLADataSources.js LA_DATA_SOURCE():
column_mapping: {
  fiscal_year_column: 'budget_fiscal_year',
  approved_amount_column: 'adopted_budget_amount',
  actual_amount_column: 'total_expenditures',
  category_column: 'department_name',
  subcategory_column: 'fund_name',
  where_extra: "AND adopted_budget_amount > 0",  // ADD THIS
},
```

[VERIFIED: `bulkLoadBudget.js` lines 134–151 show `whereExtra` read from `cm.where_extra` and
appended to the Socrata WHERE clause 2026-06-02]

### fiscal_years Array Expansion

Extend the operating data_source `fiscal_years` array to cover FY2017–2026. The seeder
`seedLADataSources.js` uses idempotent upsert, so updating the array and re-running the seeder
will write the new value in place.

```javascript
fiscal_years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
```

Then run:
```bash
node scripts/bulkLoadBudget.js --source "Los Angeles Operating" --fy 2017 --fy 2018 \
  --fy 2019 --fy 2020 --fy 2021 --fy 2022 --fy 2023 --fy 2024 --fy 2025 --fy 2026
```

FY2025 and FY2026 re-runs will also fix the enterprise-fund-actuals problem.

### Revenue Fix — Two-Step

**Step 1:** Update `LA_REVENUE` in `seedCaliforniaCities.js`:
```javascript
column_mapping: {
  fiscal_year_column: 'fiscal_year',
  approved_amount_column: 'revenue_budget',
  actual_amount_column: null,   // CHANGE: was 'revenue_collected'
  category_column: 'department_name',
  subcategory_column: 'revenue_source_name',
  fiscal_year_type: 'integer',
},
```

**Step 2:** Re-run `bulkLoadBudget.js --source "Los Angeles Revenue" --fy 2025 --fy 2026`
to rebuild category trees without actual amounts.

### Summaries UI Pattern (Task 5 — No AI Calls)

The 70 LA enrichment rows have a `description` field (2–3 sentence explanation) returned by
the categories API as `enrichment.description` on each `BudgetCategory`. Currently,
`PlainLanguageSummary` only uses `enrichment.shortDescription` (1-sentence) in line items like:
```
Police — largest uniformed public safety force in the western US.
```

The `description` field is available in the API response but not displayed in the summary view.
A frontend-only change (no DB writes, no API calls) can surface it. Options:

1. **Expand-on-click:** Show `description` when user taps a category in PlainLanguageSummary
2. **Tooltip:** Show `description` on hover/focus of the shortDescription line
3. **Additional prose paragraph:** Pull `topCategories[0].enrichment.description` into a
   dedicated "About" sentence below the spending headline

Option 3 is the lowest-friction implementation and adds visible citizen context.
[ASSUMED — UI approach is planner discretion]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socrata year filter | Custom WHERE logic | `bulkLoadBudget.js` with `where_extra` in column_mapping | Already supports this pattern (used by SF) |
| Enterprise fund exclusion | Custom filter script | `where_extra` in column_mapping | One-line column_mapping change, no code change |
| Orphaned FK repair | Custom SQL UPDATE | Re-run `treasury_sync_budget_tree` for affected years | RPC writes data_source_id automatically |
| Historical budget load | New loader | `bulkLoadBudget.js` with expanded `fiscal_years` | Dataset (uyzw-yi8n) goes back to 1987 |
| Revenue enrichment | New AI run | Existing 70 rows already cover LA revenue departments | Phase 16 verified all revenue dept names match operating enrichment via name_key dedup |

---

## Common Pitfalls

### Pitfall 1: Reloading without the where_extra filter causes enterprise-fund actuals to persist

**What goes wrong:** Running `bulkLoadBudget.js` for FY2025/FY2026 after updating the
fiscal_years array but BEFORE updating the column_mapping in the seeder — the old column_mapping
(without `where_extra`) is still in the DB and the loader reads it from `treasury_get_data_source_config`.
**How to avoid:** Run `seedLADataSources.js` FIRST to update column_mapping in the DB, THEN
run `bulkLoadBudget.js`. The seeder is idempotent.

### Pitfall 2: Revenue column_mapping null propagation

**What goes wrong:** Setting `actual_amount_column: null` in JavaScript and expecting it to
clear the DB value. If the seeder uses `update()` with `null`, Supabase PostgREST sets the
column to NULL. If it uses upsert without the key, the old value persists.
**How to avoid:** Verify the seeder writes `actual_amount_column: null` to the JSONB column_mapping.
Check with: `SELECT column_mapping->'actual_amount_column' FROM treasury.data_sources WHERE id='ea3c8f7e-...';`
Expected: `null`.

### Pitfall 3: FY2026 operating actuals ($39.5B) are in-year and garbage

**What goes wrong:** Re-running FY2026 with `where_extra = "AND adopted_budget_amount > 0"`
and expecting the actuals ($39.5B full-dataset) to be useful — but the in-year actuals for
FY2026 ending June 30, 2026 are mid-year garbage even after filtering.
**How to avoid:** The fix (adopted_budget_amount > 0 filter) will give cleaner actuals for
FY2025 and prior. For FY2026, `total_expenditures` may still reflect partial-year data.
The UI naturally handles this: FY2026 is the current year (`isPastYear=false`), so
`showActual=false` — the approved budget total is displayed regardless.

### Pitfall 4: Dry-run totals with filter will differ from Phase 15 dry-run

**What goes wrong:** Confusion when dry-run for FY2025 with `adopted_budget_amount > 0`
shows 1,525 rows instead of 3,786 rows.
**Why it happens:** The filter excludes enterprise-fund rows (adopted=0). This is expected.
Total approved amount remains $19.9B (same) because those rows contributed $0 to approved total.
**Warning signs:** If total_budget drops significantly from $19.9B, check the filter syntax.

### Pitfall 5: Revenue re-run fails to clear existing actual amounts from budget_categories

**What goes wrong:** After updating column_mapping and re-running revenue loader, the
old `aa` values (from revenue_collected) persist in category rows.
**How to avoid:** `treasury_sync_budget_tree` uses clear-and-rebuild semantics — it deletes
and re-inserts categories for the given budget. If the loader runs with `actual_amount_column=null`,
the `aa` field in the tree payload will be `null` for all items, which clears the actuals.
[ASSUMED — based on Phase 15 Plan 02 confirmation of "clear-and-rebuild semantics"]

### Pitfall 6: Applying where_extra to BOTH operating and revenue sources in wrong order

**What goes wrong:** Updating `seedCaliforniaCities.js` for LA Revenue while simultaneously
updating `seedLADataSources.js` for LA Operating — running one seeder but not the other.
**How to avoid:** Each seeder is independent. Update both scripts, run both seeders, then run
both loaders.

---

## Code Examples

### Verified: where_extra already supported in bulkLoadBudget.js

```javascript
// Source: scripts/bulkLoadBudget.js lines 134-151 (verified 2026-06-02)
const whereExtra = cm.where_extra || '';
const baseWhere =
  fyType === 'integer'
    ? `${fyCol}=${fiscalYear}`
    : `${fyCol}='${fiscalYear}'`;
const where = whereExtra ? `${baseWhere} ${whereExtra}` : baseWhere;
```

### Verified: LA Operating data_source column_mapping (current)

```json
// Source: scripts/seedLADataSources.js (verified 2026-06-02)
{
  "fiscal_year_column": "budget_fiscal_year",
  "approved_amount_column": "adopted_budget_amount",
  "actual_amount_column": "total_expenditures",
  "category_column": "department_name",
  "subcategory_column": "fund_name"
}
```

### Target: LA Operating column_mapping (after fix)

```json
{
  "fiscal_year_column": "budget_fiscal_year",
  "approved_amount_column": "adopted_budget_amount",
  "actual_amount_column": "total_expenditures",
  "category_column": "department_name",
  "subcategory_column": "fund_name",
  "where_extra": "AND adopted_budget_amount > 0"
}
```

### Verified: LA Revenue column_mapping (current)

```json
// Source: scripts/seedCaliforniaCities.js LA_REVENUE() (verified 2026-06-02)
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "revenue_budget",
  "actual_amount_column": "revenue_collected",
  "category_column": "department_name",
  "subcategory_column": "revenue_source_name",
  "fiscal_year_type": "integer"
}
```

### Target: LA Revenue column_mapping (after fix)

```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "revenue_budget",
  "actual_amount_column": null,
  "category_column": "department_name",
  "subcategory_column": "revenue_source_name",
  "fiscal_year_type": "integer"
}
```

### Verified: FY2025 row counts (confirms filter behavior)

```
# Without filter (current):
GET .../uyzw-yi8n.json?$where=budget_fiscal_year='2025'
→ 3786 rows, $19.86B adopted, $43.5B total_expenditures

# With adopted_budget_amount > 0 filter (target):
GET .../uyzw-yi8n.json?$where=budget_fiscal_year='2025' AND adopted_budget_amount > 0
→ 1525 rows, $19.86B adopted, $16.0B total_expenditures
// Same approved total, cleaner actuals
```

[VERIFIED: Socrata API 2026-06-02]

---

## State of the Art

| Area | Current State | Target State After Phase 24 |
|------|--------------|----------------------------|
| LA operating FY2025/2026 actuals | Inflated to $43.5B (enterprise funds included) | $16.0B / in-year (enterprise excluded) |
| LA operating FY2021-2024 | `actual_amount=0` (pre-Phase-15 data, no actuals) | Real actuals loaded ($13-15B range) |
| LA operating FY2017-2020 | Total only, `hierarchy=NULL` | Department-level hierarchy + actuals |
| LA revenue FY2025 display | $44.6B (revenue_collected, enterprise bleed) | $10.2B (approved revenue_budget only) |
| Orphaned FK (1973cbe0) | All FY2017-2024 budget rows reference dead FK | Repaired to 01c50191 via re-run |
| Enrichment display | shortDescription only (1 sentence per category) | description field (2-3 sentences) surfaced |

---

## Runtime State Inventory

> Not a rename/migration phase. Skip.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | bulkLoadBudget.js, seeders | ✓ | v18+ (project standard) | — |
| SUPABASE_SERVICE_KEY | All loaders and seeders | ✓ | — (env var, must be set) | — |
| controllerdata.lacity.org Socrata API | bulkLoadBudget.js | ✓ | Live (verified 2026-06-02) | — |

---

## Task Breakdown for Planner

### Task Group 1: Fix Revenue Accuracy (highest priority — visible user-facing bug)

**What:** Update `LA_REVENUE` column_mapping in `seedCaliforniaCities.js` to set
`actual_amount_column: null`. Re-seed and reload FY2025 + FY2026 revenue.

**Files to change:**
- `scripts/seedCaliforniaCities.js` — change `actual_amount_column: 'revenue_collected'` to `null`

**Commands:**
```bash
node scripts/seedCaliforniaCities.js          # updates column_mapping in DB
node scripts/bulkLoadBudget.js --source "Los Angeles Revenue" --fy 2025 --fy 2026
```

**Verification:** Revenue total for FY2025 should show $10.2B in app (approved), not $44.6B.

---

### Task Group 2: Fix Operating Actuals + Enterprise Fund Bleed (same code change)

**What:** Add `where_extra = "AND adopted_budget_amount > 0"` to LA Operating column_mapping
in `seedLADataSources.js`. Expand `fiscal_years` to include 2017–2024. Re-seed. Run loader
for all years FY2017–FY2026.

**Files to change:**
- `scripts/seedLADataSources.js` — add `where_extra` to column_mapping, expand `fiscal_years`

**Commands:**
```bash
node scripts/seedLADataSources.js             # updates column_mapping + fiscal_years in DB
# Load each year (can run in batches):
node scripts/bulkLoadBudget.js --source "Los Angeles Operating" \
  --fy 2017 --fy 2018 --fy 2019 --fy 2020 \
  --fy 2021 --fy 2022 --fy 2023 --fy 2024 \
  --fy 2025 --fy 2026
```

**Verification:**
- FY2021-2024: `actual_amount > 0` for top categories (police, fire, etc.)
- FY2017-2020: category tree hierarchy present (58 depth-0 categories)
- FY2025: operating total still ~$19.9B; actuals now ~$16.0B (not $43.5B)
- Orphaned FK (1973cbe0): no longer referenced on any LA budget row

---

### Task Group 3: Summaries UI Improvement (zero cost, frontend only)

**What:** Surface `enrichment.description` (the 2-3 sentence field) in `PlainLanguageSummary`
for the top operating and revenue categories.

**Files to change:**
- `src/components/dashboard/PlainLanguageSummary.tsx` — add description display

**No DB writes, no API calls required.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting `actual_amount_column: null` in column_mapping causes the UI to fall back to `total_budget` (approved) for past years | Revenue Fix approach | UI might show $0 instead of budget total; requires code inspection of `showActual` logic |
| A2 | `treasury_sync_budget_tree` clears and rebuilds category rows (clear-and-rebuild semantics) | Orphaned FK repair | If it appends instead of replaces, old categories persist; need to verify RPC behavior |
| A3 | "Improve summaries" = frontend UI change to surface `enrichment.description` | Task 5 | May be a different interpretation (e.g., manual text editing of enrichment rows) |
| A4 | FY2026 operating actuals are in-year garbage even with the adopted>0 filter | Pitfall 3 | If FY2026 actuals are actually clean, we can backfill them too — no harm either way |

---

## Open Questions

1. **Should FY2026 operating actuals be shown given the year ends June 30, 2026 (tomorrow)?**
   - What we know: FY2026 total_expenditures for budgeted rows is $39.5B (clearly incomplete
     in-year data); with adopted>0 filter it would be proportionally lower but still in-year
   - What's unclear: Whether the in-year actuals are accurate enough to display
   - Recommendation: Re-run FY2026 with the filter to fix category tree structure, but the
     UI naturally hides actuals for current year (`isPastYear=false` for 2026)

2. **Should any additional LA revenue years (FY2017-2024) be loaded?**
   - What we know: `vvm4-a2zu` has data for FY2017-2026 (all years verified via distinct
     fiscal_year query). Currently only FY2025 and FY2026 are in `fiscal_years`.
   - What's unclear: Whether backfilling LA revenue history is in-scope for Phase 24
   - Recommendation: Defer to a future phase; Phase 24 scope is data _quality_, not new years

3. **Is the enrichment.description field returned by the categories API endpoint?**
   - What we know: The type `CategoryEnrichment` in `budget.ts` has a `description` field;
     `enrichCategories.js` writes `description` to the DB
   - What's unclear: Whether the backend API at ev-accounts-api.onrender.com includes this
     field in its categories response (source not available for inspection)
   - Recommendation: Verify by fetching
     `https://ev-accounts-api.onrender.com/api/treasury/budgets/<LA-FY2025-budget-id>/categories`
     and checking for `description` in the enrichment object — do this at plan execution time

---

## Sources

### Primary (HIGH confidence — verified via Socrata API 2026-06-02)
- `https://controllerdata.lacity.org/resource/uyzw-yi8n.json` — row counts, amounts, column
  schema for FY2017-2026; with and without `adopted_budget_amount > 0` filter
- `https://controllerdata.lacity.org/resource/vvm4-a2zu.json` — column schema, FY2025/FY2026
  revenue_budget and revenue_collected totals
- `https://controllerdata.lacity.org/resource/hfus-a659.json` — column schema including
  `adopted_revenue_budget`, department breakdown by revenue_collected
- `scripts/bulkLoadBudget.js` — where_extra pattern, tree builder behavior (lines 67-127,
  134-151)
- `scripts/seedLADataSources.js` — current LA operating column_mapping
- `scripts/seedCaliforniaCities.js` — current LA Revenue column_mapping (`LA_REVENUE` function)
- `.planning/phases/15-los-angeles-socrata-budget-load-enrichment/15-02-SUMMARY.md` — confirmed
  treasury_sync_budget_tree clear-and-rebuild semantics
- `.planning/milestones/v1.4-MILESTONE-AUDIT.md` — confirmed data_source_id is cosmetic,
  no query path depends on it

### Secondary (MEDIUM confidence)
- `.planning/phases/16-california-cities-budget-load/16-05-SUMMARY.md` — confirmed LA FY2025
  revenue displayed as ~$10.2B at Phase 16 completion (issue emerged when FY2025 became past year)
- `src/App.tsx` line 567 — `isPastYear = parseInt(selectedYear) < new Date().getFullYear()`
  (confirms FY2025 is past year in 2026)

---

## Metadata

**Confidence breakdown:**
- Dataset structure (uyzw-yi8n): HIGH — all amounts verified via live API
- Revenue root cause ($44.6B = enterprise fund revenue_collected): HIGH — department breakdown
  confirmed WATER AND POWER $17.2B, AIRPORTS $4.0B
- Orphaned FK repair via re-run: HIGH — treasury_sync_budget_tree behavior confirmed in Phase 15
  Plan 02 summary
- where_extra filter approach: HIGH — pattern already proven for SF operating budget
- Summaries approach (UI change): MEDIUM — best interpretation of "use existing data more
  effectively", but planner should confirm with user if a different approach is intended

**Research date:** 2026-06-02
**Valid until:** 2026-09-02 (stable Socrata API; 90-day window)
