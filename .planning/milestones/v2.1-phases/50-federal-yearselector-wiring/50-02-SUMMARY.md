# Plan 50-02 Summary — Frontend period model + selector + data-layer

**Status:** Complete (tsc green; runtime verified in 50-04)
**Commit:** `feat(50-02): frontend period model — TQ in selector + period_label disambiguation`
**Requirements:** NAV-01

## What changed
- **`src/utils/period.ts`** (new): `TQ_TOKEN`/`TQ_LABEL`, `parsePeriod(token) → {fiscalYear, periodLabel, label, shortLabel}`, `buildPeriodTokens(datasets)` (annual years descending, TQ inserted right after '1976'; entities without a period_label row get a plain year list).
- **`src/App.tsx`**: `availableYears` uses `buildPeriodTokens`; **every** `parseInt(selectedYear)` routed through `parsePeriod(...).fiscalYear` (0 remaining); both data-load effects + post-donation refetch thread `periodLabel` into `loadBudgetData`.
- **`src/data/dataLoader.ts`**: `loadBudgetData` gains a `periodLabel` param; cacheKey includes it; budget selection disambiguates by `period_label` with a dataset-only fallback (annual years still resolve if the API field is briefly absent).
- **`src/components/YearSelector.tsx`**: labels via `parsePeriod` (button = shortLabel, options = full label; TQ shows "Transition Quarter (Jul–Sep 1976)").
- **`src/types/budget.ts`**: `available_datasets` element gains optional `period_label`.

## Verification
- `npx tsc -b` exits 0; `grep parseInt(selectedYear)` → 0 remaining.
- Non-federal entities unaffected (no period_label rows → `buildPeriodTokens` returns plain year tokens; `parsePeriod('2025')` → year 2025/null).

## Notes
- Option labels now read "FY 2024" (previously bare "2024") — minor, consistent with the button.
- Runtime/observed behavior (FY1976 vs TQ fetch distinctness) is proven in 50-04 against the running backend.
