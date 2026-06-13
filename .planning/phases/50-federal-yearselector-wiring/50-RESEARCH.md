# Phase 50 — Research: Federal YearSelector Wiring

**Researched:** 2026-06-13 (inline — no research subagent, per cost policy)
**Question:** "What does it take to make every backfilled federal period selectable, with all panels updating?"
**Requirements:** NAV-01, NAV-02

> Verified against the live frontend (`treasury-tracker/src`), the live backend
> (`../EV-Accounts/backend/src`), and the live production API. **[verified]** marks
> claims checked against running code/endpoints.

## TL;DR
1. **The year list is already free.** `/treasury/cities` returns all 153 federal dataset rows → 50 distinct years FY1976–FY2025 **[verified]**. The frontend's `availableYears` useMemo + the existing `YearSelector` + the existing `loadBudgetData` effect mean switching among the **annual** years already re-fetches the three lens trees. The work is the TQ + the landing block + sourcing the disambiguation.
2. **One real bug + one gap require a backend change (D-01).** `/budgets?fiscal_year=1976` returns **6 rows** (FY1976 *and* TQ per lens) and the API **omits `period_label`** **[verified]** → the frontend `.find(b => b.dataset_type === dataset)` resolves FY1976 ambiguously. Exposing `period_label` is required for FY1976 correctness *and* for showing the TQ.
3. **Landing bands/deficit strip switch frontend-only.** `loadFederalContext()` already returns `annual_summary` for all 64 years **[verified]**; `FederalLanding` just hardcodes `annual_summary[last]`. Pass the selected year's row instead.
4. **Cross-repo + deploy.** Backend lives in `../EV-Accounts` (Render); frontend in this repo (Netlify). The backend change must be deployed (or run locally) before the frontend can read `period_label` live.

## Change map

### Backend — `../EV-Accounts/backend/src/lib/treasuryService.ts` (+ routes unchanged)
Add `period_label` end-to-end (all additive, nullable — zero impact on city/state rows where it's NULL):
- `TreasuryDataset` + `TreasuryBudget` interfaces, and the `CityRow`/`BudgetRow` row types.
- `available_datasets` `json_build_object(...)` in **both** `getCities` and `getCityById` → add `'period_label', b.period_label`.
- `mapCity` → carry `period_label` into the mapped datasets.
- `getBudgetsByCityId` SELECTs (the `?fiscal_year=` filtered query **and** the unfiltered one) → add `b.period_label`; `mapBudget` → include it.
- Extend `tests/integration/treasury-cities.test.ts` to assert `period_label` is present (null for cities, the TQ string for the FY1976 TQ row).

### Frontend — period model
- **Period token:** represent a selectable period as a string token — annual = `'2024'`, TQ = a sentinel (e.g. `'1976-TQ'`). Add a single helper `parsePeriod(token) → { fiscalYear: number, periodLabel: string|null, label: string }` and route the ~8 `parseInt(selectedYear)` call sites through `parsePeriod(...).fiscalYear` (App.tsx lines ~168, 292, 347, 376, 412 + URL sync). This is the main correctness-sensitive edit.
- **`availableYears`** (App.tsx ~158): build from `available_datasets` distinct `(fiscal_year, period_label)`; emit `'YYYY'` for null-label rows and the TQ token for the labeled row; order desc with the TQ immediately after FY1976.
- **`YearSelector.tsx`:** label via the period helper — "FY 2024" for annual, "Transition Quarter (Jul–Sep 1976)" for the TQ (button shows a short "Transition Q 1976").
- **`loadBudgetData`** (dataLoader.ts): accept a `periodLabel` arg; cache key includes it; disambiguate `budgets.find(b => b.dataset_type === dataset && (b.period_label ?? null) === (periodLabel ?? null))`. Add `period_label` to the budget type.

### Frontend — landing block (`FederalLanding.tsx`)
- Accept a `fiscalYear` (and `isCurrent`) prop from App.tsx. Pick `summary = annual_summary.find(s => s.fiscal_year === fiscalYear) ?? headline`; pass to `DeficitStrip` + `FirstSplitBands` (both already take a single `summary` row).
- **ThisYearStrip:** render only when the current/default period is selected (D-03).
- **TQ:** `federal_annual_summary` has no TQ row → hide `FirstSplitBands`/`DeficitStrip` for the TQ (show the three lens trees + a neutral "Transition Quarter" heading). Phase 51 adds the explanation. **[verified: federal_annual_summary is year-keyed smallint, no TQ row]**

## Risks / watch-items
- **Regression surface is the period-token refactor.** Every `parseInt(selectedYear)` must go through `parsePeriod`. A missed one breaks city/state years too. Mitigure with a typecheck + an explicit regression pass (FY2025 default, a city, a state).
- **Deploy ordering:** ship backend first (or run it locally) so the frontend reads `period_label`. Frontend `period_label ?? null` handling must degrade gracefully if the field is briefly absent (annual years still work; only the TQ entry is missing until deploy).
- **Dev API target:** confirm `API_BASE` in dev (`dataLoader.ts:12`) so the frontend can be tested against the updated backend (local run vs deployed).

## Validation Architecture
> Drives `50-VALIDATION.md`. Frontend has a typecheck/build; backend has integration tests.
- **Per-task:** `npm run build` (tsc) green in each repo after its edits; backend `npm test` (treasury integration) green.
- **Contract probe:** after the backend change, `/treasury/cities` and `/budgets?fiscal_year=1976` include `period_label` (null for annual, the TQ string for the TQ row).
- **Behavior (manual/observed):** switching years updates all three lens trees + bands + deficit strip + source chip; the TQ entry loads TQ figures (not FY1976); FY1976 loads the real FY1976 (not the TQ); FY2025 default unchanged; a city and a state still switch years correctly (no regression).
- **NAV-01/02 acceptance:** every loaded period selectable; bands + deficit strip reflect the selected year.

## RESEARCH COMPLETE
