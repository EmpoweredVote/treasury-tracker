# Phase 24: Los Angeles Data Refresh — Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 3
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/seedLADataSources.js` | config/seeder | CRUD (upsert) | `scripts/seedCaliforniaCities.js` SF_OPERATING (where_extra) | exact |
| `scripts/seedCaliforniaCities.js` | config/seeder | CRUD (upsert) | `scripts/seedCaliforniaCities.js` SD_OPERATING (actual_amount_column: null) | exact (self-referential) |
| `src/components/dashboard/PlainLanguageSummary.tsx` | component | request-response (read-only render) | `src/App.tsx` lines 771–790 (enrichment.description display) | role-match |

---

## Pattern Assignments

### `scripts/seedLADataSources.js` (config/seeder, CRUD upsert)

**Change:** Add `where_extra` key to `column_mapping` inside `LA_DATA_SOURCE()`. Expand `fiscal_years` array from `[2025, 2026]` to `[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]`.

**Analog:** `scripts/seedCaliforniaCities.js` `SF_OPERATING()` function — already uses `where_extra` in column_mapping.

**column_mapping with where_extra pattern** (seedCaliforniaCities.js lines 177–187):
```javascript
column_mapping: {
  fiscal_year_column: 'fiscal_year',
  approved_amount_column: 'budget',
  actual_amount_column: null,
  category_column: 'department',
  subcategory_column: 'fund_type',
  where_extra: "AND revenue_or_spending='Spending'",
},
fiscal_years: [2025, 2026],
```

**Target state for LA_DATA_SOURCE() column_mapping** (seedLADataSources.js lines 102–112, after edit):
```javascript
column_mapping: {
  fiscal_year_column: 'budget_fiscal_year',
  approved_amount_column: 'adopted_budget_amount',
  actual_amount_column: 'total_expenditures',
  category_column: 'department_name',
  subcategory_column: 'fund_name',
  where_extra: "AND adopted_budget_amount > 0",
},
fiscal_years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
```

**Exact lines to modify in seedLADataSources.js:**
- Lines 102–109: `column_mapping` object — add `where_extra` key after `subcategory_column`
- Line 109: `fiscal_years: [2025, 2026]` — replace with full 10-year array

**No changes to**: upsert logic, `upsertMunicipality`, `upsertDataSourceByName`, verification RPC call, or `main()` function structure.

---

### `scripts/seedCaliforniaCities.js` (config/seeder, CRUD upsert)

**Change:** Set `actual_amount_column: null` in `LA_REVENUE()` function — replace `'revenue_collected'`.

**Analog:** `scripts/seedCaliforniaCities.js` `SD_OPERATING()` — already uses `actual_amount_column: null` as the null pattern for the same field.

**null actual_amount_column pattern** (seedCaliforniaCities.js lines 203–225):
```javascript
function SD_OPERATING(municipalityId) {
  return {
    name: 'San Diego Operating Budget',
    api_type: 'csv_download',
    dataset_type: 'operating',
    ...
    column_mapping: {
      fiscal_year_column: 'report_fy',
      approved_amount_column: 'amount',
      actual_amount_column: null,   // <-- the null pattern to copy
      category_column: 'dept_name',
      subcategory_column: 'account',
      ...
    },
    ...
  };
}
```

**Current LA_REVENUE() column_mapping** (seedCaliforniaCities.js lines 243–253):
```javascript
column_mapping: {
  fiscal_year_column: 'fiscal_year',
  approved_amount_column: 'revenue_budget',
  actual_amount_column: 'revenue_collected',   // CHANGE TO: null
  category_column: 'department_name',
  subcategory_column: 'revenue_source_name',
  fiscal_year_type: 'integer',
},
```

**Target state** (one-line change at seedCaliforniaCities.js line 248):
```javascript
actual_amount_column: null,   // was: 'revenue_collected'
```

**No changes to**: `upsertMunicipality`, `getExistingMunicipalityId`, `upsertDataSourceByName`, SF_OPERATING, SF_REVENUE, SD_OPERATING, SD_REVENUE, or `main()`.

**Pitfall to avoid:** Supabase PostgREST propagates JS `null` as SQL NULL when the seeder runs `.update(src)` — this is correct behavior. Verify with:
```sql
SELECT column_mapping->'actual_amount_column' FROM treasury.data_sources WHERE id='ea3c8f7e-0ab0-4a79-9f2b-9b7093d5bb55';
-- Expected result: null (not "revenue_collected")
```

---

### `src/components/dashboard/PlainLanguageSummary.tsx` (component, request-response)

**Change:** Surface `enrichment.description` (2–3 sentence field) for the top operating category in the PlainLanguageSummary prose. Currently only `enrichment.shortDescription` (1 sentence) is shown.

**Analog:** `src/App.tsx` lines 771–790 — already implements the two-field `shortDesc` + `desc` display pattern for enrichment in drill-down navigation context.

**Existing description display pattern from App.tsx** (lines 771–790):
```tsx
{navigationPath.length > 0 && (() => {
  const currentCat = navigationPath[navigationPath.length - 1];
  const shortDesc = currentCat.enrichment?.shortDescription;
  const desc = currentCat.enrichment?.description;
  if (!shortDesc && !desc) return null;
  return (
    <div className="mt-3 space-y-2">
      {shortDesc && (
        <p className="text-[15px] font-medium text-ev-gray-700 dark:text-ev-gray-200 leading-relaxed">
          {shortDesc}
        </p>
      )}
      {desc && desc !== shortDesc && (
        <p className="text-[14px] text-ev-gray-600 leading-relaxed">
          {desc}
        </p>
      )}
    </div>
  );
})()}
```

**Guard pattern:** `desc && desc !== shortDesc` prevents duplicate display when the two fields happen to share content.

**TypeScript type shape** (src/types/budget.ts lines 63–66):
```typescript
export interface CategoryEnrichment {
  plainName: string;
  shortDescription: string;
  description: string;   // 2–3 sentence field to surface
  tags: string[];
}
```

**Current shortDescription usage in PlainLanguageSummary** (lines 222–224) — the existing inline pattern to extend:
```tsx
{topCategories[0]?.enrichment?.shortDescription && (
  <span className="text-ev-gray-400 text-[13px]">{' '}— {topCategories[0].enrichment.shortDescription.toLowerCase()}</span>
)}
```

**Implementation approach (Option 3 from RESEARCH.md — lowest friction):**
Add a new `<p>` block after the `topCategories` paragraph that renders `topCategories[0]?.enrichment?.description` when present. Style should follow the prose paragraph convention used in this component (`text-[15px] leading-relaxed text-ev-gray-600 dark:text-ev-gray-400`). Guard with `&& desc !== shortDesc` per App.tsx precedent.

```tsx
{topCategories[0]?.enrichment?.description &&
  topCategories[0].enrichment.description !== topCategories[0].enrichment.shortDescription && (
  <p className="text-[14px] text-ev-gray-500 dark:text-ev-gray-500 leading-relaxed italic">
    {topCategories[0].enrichment.description}
  </p>
)}
```

Insert this block immediately after the closing `</p>` of the `topCategories.length > 0` block (after line 250 in the current file).

**Open question before implementing:** Confirm `enrichment.description` is present in the API response for LA FY2025 by fetching the categories endpoint and checking the enrichment object. (See RESEARCH.md Open Questions #3.)

---

## Shared Patterns

### Idempotent Upsert (select-then-update-or-insert)
**Source:** `scripts/seedLADataSources.js` lines 43–91 and 117–182; `scripts/seedCaliforniaCities.js` lines 47–95
**Apply to:** Both seeder modifications (no change needed — the existing upsert logic is correct for both)

Pattern: select by name → if exists, `.update(payload).eq('id', existingId)` → if not, `.insert(payload)`. Both scripts call `.schema('treasury')` before every table access. Error paths call `process.exit(1)`.

### Optional-chaining enrichment guard
**Source:** `src/components/dashboard/PlainLanguageSummary.tsx` lines 222–224
**Apply to:** Any new `enrichment.description` render block

Pattern: `category?.enrichment?.description` — both optional chains are required because `enrichment` is typed as `CategoryEnrichment | null | undefined` and `description` may be an empty string.

---

## No Analog Found

None — all three files have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `scripts/seed*.js`, `src/components/dashboard/`, `src/App.tsx`, `src/types/budget.ts`
**Files scanned:** 4 (seedLADataSources.js, seedCaliforniaCities.js, PlainLanguageSummary.tsx, App.tsx)
**Pattern extraction date:** 2026-06-02
